import { GoogleGenAI } from "@google/genai";
import { ItemCategory, GeminiAnalysisResult, ItemReport, ReportType } from "../types";

// --- TYPES ---
export interface ComparisonResult {
  confidence: number;
  explanation: string;
  similarities: string[];
  differences: string[];
}

export interface MatchCandidate {
  id: string;
  confidence: number; // 0-100
  reason?: string;
}

// --- CONFIGURATION ---

// The Cascade: Priority order for models
// 1. Standard Flash 2.0 (Best Balance)
// 2. Flash Lite 2.0 (Fast/Backup)
// 3. Flash 1.5 (Legacy/Stable Fallback)
const MODEL_CASCADE = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-1.5-flash'
];

const CACHE_PREFIX = 'retriva_ai_v5_'; 
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 Hours

// --- CACHE MANAGER ---
const CacheManager = {
  async generateKey(data: any): Promise<string> {
    try {
      const msgBuffer = new TextEncoder().encode(JSON.stringify(data));
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return 'fallback_' + JSON.stringify(data).length + '_' + Date.now();
    }
  },

  get<T>(key: string): T | null {
    try {
      const itemStr = localStorage.getItem(CACHE_PREFIX + key);
      if (!itemStr) return null;
      
      const item = JSON.parse(itemStr);
      if (Date.now() > item.expiry) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return item.value;
    } catch (e) {
      return null;
    }
  },

  set(key: string, value: any) {
    try {
      const item = { value, expiry: Date.now() + CACHE_EXPIRY };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (e) { /* Ignore cache errors */ }
  }
};

// --- HELPER: API KEY ---
const getApiKey = (): string | undefined => {
  // @ts-ignore
  const key = import.meta.env.VITE_API_KEY || import.meta.env.API_KEY;
  if (!key && typeof process !== 'undefined') {
    return process.env.VITE_API_KEY || process.env.API_KEY;
  }
  return key;
};

// --- HELPER: JSON CLEANER ---
const cleanJSON = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
      JSON.parse(cleaned);
      return cleaned;
  } catch (e) {
      const firstBrace = cleaned.indexOf('{');
      const firstBracket = cleaned.indexOf('[');
      let start = -1;
      let end = -1;

      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
          start = firstBrace;
          end = cleaned.lastIndexOf('}');
      } else if (firstBracket !== -1) {
          start = firstBracket;
          end = cleaned.lastIndexOf(']');
      }

      if (start !== -1 && end !== -1) {
          return cleaned.substring(start, end + 1);
      }
      return "{}";
  }
};

// --- HELPER: DATE PARSER ---
const parseDateVal = (dateStr: string): number => {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    }
    return new Date(dateStr).getTime();
};

// --- LOCAL LOGIC FALLBACKS ---

const localKeywordMatch = (query: string, text: string): number => {
    const qWords = query.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const tWords = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    let matches = 0;
    qWords.forEach(q => {
        if (tWords.some(t => t.includes(q))) matches++;
    });
    return matches;
};

const performLocalFallbackMatch = (queryTitle: string, queryDescription: string, queryCategory: ItemCategory, candidateList: any[]): MatchCandidate[] => {
    console.log("[RETRIVA_AI] 🛡️ Active Cascade: Switching to Local Logic...");
    const matches: MatchCandidate[] = [];

    for (const c of candidateList) {
        // Strict Category Check for local logic
        if (queryCategory !== ItemCategory.OTHER && c.cat !== ItemCategory.OTHER && queryCategory !== c.cat) continue;

        let score = 0;
        // Title match (High weight)
        const titleHits = localKeywordMatch(queryTitle, c.title);
        if (titleHits > 0) score += 40;
        
        // Desc match (Medium weight)
        const descHits = localKeywordMatch(queryTitle + " " + queryDescription, c.desc);
        if (descHits > 0) score += 20;

        // Tags match (Accumulative)
        const sharedTags = c.tags.filter((t: string) => (queryTitle + queryDescription).toLowerCase().includes(t.toLowerCase()));
        score += sharedTags.length * 10;

        if (score > 25) {
            matches.push({ 
                id: c.id, 
                confidence: Math.min(score, 75), // Cap local confidence to avoid false certainty
                reason: "Keyword overlap detected (Local Analysis)" 
            });
        }
    }
    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
};

const performLocalComparison = (itemA: ItemReport, itemB: ItemReport): ComparisonResult => {
    let confidence = 0;
    const similarities = [];
    const differences = [];

    if (itemA.category === itemB.category) {
        confidence += 30;
        similarities.push("Same Category");
    } else {
        differences.push("Different Category");
    }

    if (localKeywordMatch(itemA.title, itemB.title) > 0) {
        confidence += 30;
        similarities.push("Similar Title Keywords");
    }

    const timeA = parseDateVal(itemA.date);
    const timeB = parseDateVal(itemB.date);
    const dayDiff = Math.abs(timeA - timeB) / (1000 * 60 * 60 * 24);
    if (dayDiff <= 7) {
        confidence += 20;
        similarities.push("Dates are close");
    }

    return {
        confidence: Math.min(confidence, 80),
        explanation: "AI Unavailable. Estimate based on keywords, dates, and categories.",
        similarities,
        differences
    };
};

// --- THE CASCADE RUNNER ---
const runCascade = async (params: any, systemInstruction?: string): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  
  let lastError = null;

  for (const model of MODEL_CASCADE) {
    try {
      // console.log(`[RETRIVA_AI] 🔄 Trying Model: ${model}`);
      
      const config = { ...params.config };
      delete config.thinkingConfig; 
      
      if (systemInstruction) {
          config.systemInstruction = systemInstruction;
      }

      const response = await ai.models.generateContent({
          ...params,
          model,
          config
      });

      if (response.text) {
          // console.log(`[RETRIVA_AI] ✅ Success with ${model}`);
          return response.text;
      }
    } catch (error: any) {
      console.warn(`[RETRIVA_AI] ⚠️ Failed ${model}: ${error.message || error.status}`);
      lastError = error;
      // Continue to next model in loop
    }
  }
  
  console.error("[RETRIVA_AI] ❌ All models failed.", lastError);
  return null; // Trigger local fallback
};


// --- EXPORTED FEATURES (API) ---

export const findSmartMatches = async (sourceItem: ItemReport, allReports: ItemReport[]): Promise<{ report: ItemReport, confidence: number }[]> => {
    
    const targetType = sourceItem.type === 'LOST' ? 'FOUND' : 'LOST';
    const BUFFER_MS = 86400000 * 90; // 90 days window
    const sourceTime = parseDateVal(sourceItem.date);

    // 1. Initial Filtering
    let candidates = allReports.filter(r => 
        r.status === 'OPEN' && 
        r.type === targetType &&
        r.id !== sourceItem.id &&
        Math.abs(parseDateVal(r.date) - sourceTime) <= BUFFER_MS
    );

    // 2. Try AI Matching (Batching to save context window)
    let matchResults: MatchCandidate[] = [];
    
    const aiCandidates = candidates.slice(0, 12).map(c => ({ 
        id: c.id, 
        title: c.title, 
        desc: c.description, 
        cat: c.category, 
        tags: c.tags,
        date: c.date,
        loc: c.location
    }));

    if (aiCandidates.length > 0) {
        try {
            const queryDescription = `Title: ${sourceItem.title}. Desc: ${sourceItem.description}. Tags: ${sourceItem.tags.join(', ')}. Loc: ${sourceItem.location}`;
            
            const parts: any[] = [{ text: `
              Role: Lost & Found Intelligence.
              Task: Find matches for the MISSING ITEM in the CANDIDATES list.
              
              MISSING ITEM:
              ${queryDescription} (${sourceItem.category})
              
              CANDIDATES:
              ${JSON.stringify(aiCandidates)}
              
              INSTRUCTIONS:
              1. Analyze semantic similarity (e.g. "AirPods" = "Headphones").
              2. Analyze location proximity if plausible.
              3. Ignore minor date differences (Found items are often reported days later).
              
              OUTPUT JSON:
              { "matches": [ { "id": "candidate_id", "confidence": number (0-100) } ] }
              
              Return only matches > 40 confidence.
            ` }];
            
            // Optional: Add image context if available
            if (sourceItem.imageUrls[0]) {
               const data = sourceItem.imageUrls[0].split(',')[1];
               if (data) parts.push({ inlineData: { mimeType: "image/jpeg", data } });
            }

            // Run Cascade
            const text = await runCascade({
                contents: { parts },
                config: { responseMimeType: "application/json" }
            });

            if (text) {
                const data = JSON.parse(cleanJSON(text));
                matchResults = data.matches || [];
            }
        } catch (e) {
            // Cascade failed, handled below
        }
    }

    // 3. Fallback / Augment with Local Logic
    // If AI failed OR returned very few matches, run local logic to ensure we show something if it exists
    if (matchResults.length === 0) {
        const candidateList = candidates.map(c => ({ id: c.id, title: c.title, desc: c.description, cat: c.category, tags: c.tags }));
        matchResults = performLocalFallbackMatch(sourceItem.title, sourceItem.description, sourceItem.category, candidateList);
    }

    // Map back
    const results = matchResults.map(m => {
        const report = candidates.find(c => c.id === m.id);
        return report ? { report, confidence: m.confidence } : null;
    }).filter(Boolean) as { report: ItemReport, confidence: number }[];

    // Sort by confidence
    return results.sort((a, b) => b.confidence - a.confidence);
};

export const instantImageCheck = async (base64Image: string): Promise<{ 
  faceStatus: 'NONE' | 'ACCIDENTAL' | 'PRANK';
  isPrank: boolean;
  violationType: 'GORE' | 'ANIMAL' | 'HUMAN' | 'NONE';
  reason: string;
}> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const text = await runCascade({
      contents: {
        parts: [
          { text: `Safety Check. Analyze image. Strict Policy: NO GORE, NO NUDITY, NO SELFIES.
            Return JSON: { "violationType": "GORE"|"NUDITY"|"HUMAN"|"NONE", "isPrank": boolean, "reason": string }` },
          { inlineData: { mimeType: "image/jpeg", data: base64Data } }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    if (!text) return { faceStatus: 'NONE', violationType: 'NONE', isPrank: false, reason: "Offline" };
    return JSON.parse(cleanJSON(text));
  } catch (e) {
    return { faceStatus: 'NONE', violationType: 'NONE', isPrank: false, reason: "Check unavailable" };
  }
};

export const detectRedactionRegions = async (base64Image: string): Promise<number[][]> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const text = await runCascade({
        contents: {
            parts: [
                { text: `Identify bounding boxes [ymin, xmin, ymax, xmax] (0-1000 scale) for FACES, ID CARDS, CREDIT CARDS. Return JSON { "regions": [[...]] }` },
                { inlineData: { mimeType: "image/jpeg", data: base64Data } }
            ]
        },
        config: { responseMimeType: "application/json" }
    });
    
    if (!text) return [];
    const data = JSON.parse(cleanJSON(text));
    return data.regions || [];
  } catch (e) {
    return [];
  }
};

export const extractVisualDetails = async (base64Image: string): Promise<{
  title: string;
  category: ItemCategory;
  tags: string[];
  color: string;
  brand: string;
  condition: string;
  distinguishingFeatures: string[];
}> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const text = await runCascade({
      contents: {
        parts: [
          { text: `Analyze image for Lost & Found. Extract JSON: title, category, tags, color, brand, condition, distinguishingFeatures.` },
          { inlineData: { mimeType: "image/jpeg", data: base64Data } }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    
    if (!text) throw new Error("No AI response");
    const parsed = JSON.parse(cleanJSON(text));
    return {
        title: parsed.title || "",
        category: parsed.category || ItemCategory.OTHER,
        tags: parsed.tags || [],
        color: parsed.color || "",
        brand: parsed.brand || "",
        condition: parsed.condition || "",
        distinguishingFeatures: parsed.distinguishingFeatures || []
    };
  } catch (e) {
    return { 
      title: "", category: ItemCategory.OTHER, tags: [], 
      color: "", brand: "", condition: "", distinguishingFeatures: [] 
    };
  }
};

export const mergeDescriptions = async (userDistinguishingFeatures: string, visualData: any): Promise<string> => {
    try {
        const text = await runCascade({
            contents: {
                parts: [{ text: `Merge these details into a short lost item description (max 300 chars): User Notes: "${userDistinguishingFeatures}", Visuals: ${JSON.stringify(visualData)}` }]
            }
        });
        return text || userDistinguishingFeatures;
    } catch (e) {
        return userDistinguishingFeatures;
    }
};

export const validateReportContext = async (reportData: any): Promise<{ isValid: boolean, reason: string }> => {
    try {
        const text = await runCascade({
            contents: {
                parts: [{ text: `Validate report logic. JSON: { "isValid": boolean, "reason": string }. Data: ${JSON.stringify(reportData)}` }]
            },
            config: { responseMimeType: "application/json" }
        });
        if (!text) return { isValid: true, reason: "" };
        return JSON.parse(cleanJSON(text));
    } catch (e) {
        return { isValid: true, reason: "" };
    }
};

export const analyzeItemDescription = async (
  description: string,
  base64Images: string[] = [],
  title: string = ""
): Promise<GeminiAnalysisResult> => {
    try {
        const parts: any[] = [{ text: `Analyze item: "${title} - ${description}". JSON output: isViolating (bool), violationType, category, summary, tags.` }];
        base64Images.forEach(img => {
            const data = img.split(',')[1] || img;
            if (data) parts.push({ inlineData: { mimeType: "image/jpeg", data } });
        });

        const text = await runCascade({
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });

        if (!text) throw new Error("Cascade failed");
        
        const resultRaw = JSON.parse(cleanJSON(text));
        return {
            isViolating: resultRaw.isViolating || false,
            violationType: resultRaw.violationType || 'NONE',
            violationReason: resultRaw.violationReason || '',
            isPrank: false,
            category: resultRaw.category || ItemCategory.OTHER,
            title: resultRaw.title || title,
            description: resultRaw.description || description,
            summary: resultRaw.summary || description.substring(0, 50),
            tags: resultRaw.tags || [],
            distinguishingFeatures: resultRaw.distinguishingFeatures || [],
            faceStatus: 'NONE'
        } as any;

    } catch (e) {
        // Fallback result
        return { 
            isViolating: false, isPrank: false, category: ItemCategory.OTHER, 
            title: title || "Item", description, distinguishingFeatures: [], summary: "", tags: [], faceStatus: 'NONE'
        } as any;
    }
};

export const parseSearchQuery = async (query: string): Promise<{ userStatus: 'LOST' | 'FOUND' | 'NONE'; refinedQuery: string }> => {
    // Quick heuristic
    const lower = query.toLowerCase();
    if (lower.includes('lost')) return { userStatus: 'LOST', refinedQuery: query.replace('lost', '').trim() };
    if (lower.includes('found')) return { userStatus: 'FOUND', refinedQuery: query.replace('found', '').trim() };
    
    // AI Fallback
    try {
        const text = await runCascade({
            contents: { parts: [{ text: `Analyze query: "${query}". JSON: userStatus (LOST/FOUND/NONE), refinedQuery.` }] },
            config: { responseMimeType: "application/json" }
        });
        if (text) return JSON.parse(cleanJSON(text));
    } catch(e) {}

    return { userStatus: 'NONE', refinedQuery: query };
};

export const compareItems = async (itemA: ItemReport, itemB: ItemReport): Promise<ComparisonResult> => {
  try {
    const prompt = `
      Compare these two items. Are they the same object?
      Item 1: ${itemA.title}, ${itemA.description}, ${itemA.location}, ${itemA.date}
      Item 2: ${itemB.title}, ${itemB.description}, ${itemB.location}, ${itemB.date}
      
      JSON Output:
      {
        "confidence": number (0-100),
        "explanation": "string summary",
        "similarities": ["string"],
        "differences": ["string"]
      }
    `;

    const parts: any[] = [{ text: prompt }];
    
    // Use images if available (First image of each)
    const images = [itemA.imageUrls[0], itemB.imageUrls[0]].filter(Boolean);
    images.forEach(img => {
      const data = img.split(',')[1];
      if (data) parts.push({ inlineData: { mimeType: "image/jpeg", data } });
    });

    const text = await runCascade({
       contents: { parts },
       config: { responseMimeType: "application/json" }
    });
    
    if (!text) return performLocalComparison(itemA, itemB);
    return JSON.parse(cleanJSON(text));
  } catch (e) {
    return performLocalComparison(itemA, itemB);
  }
};