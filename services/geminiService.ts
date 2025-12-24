
import { ItemCategory, GeminiAnalysisResult, ItemReport } from "../types";

// Declare global Puter object from the script tag in index.html
declare const puter: any;

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

// --- HELPER: ROBUST JSON PARSER ---
const cleanJSON = (text: string): string => {
  if (!text) return "{}";
  // Remove Markdown code blocks (case insensitive)
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  
  // Attempt to find the first valid JSON object or array
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
      cleaned = cleaned.substring(start, end + 1);
  }

  return cleaned;
};

// --- HELPER: TEXT SIMILARITY (Jaccard Index) ---
const calculateTextSimilarity = (str1: string, str2: string): number => {
    const set1 = new Set(str1.toLowerCase().split(/\W+/).filter(x => x.length > 2));
    const set2 = new Set(str2.toLowerCase().split(/\W+/).filter(x => x.length > 2));
    
    if (set1.size === 0 || set2.size === 0) return 0;
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
};

// --- HELPER: PUTER WRAPPER ---
const callPuterAI = async (
  prompt: string, 
  image?: string, 
  systemInstruction?: string
): Promise<string | null> => {
  if (typeof puter === 'undefined') {
      console.error("[Retriva] Puter.js is not loaded in window.");
      return null;
  }

  try {
    const fullPrompt = systemInstruction 
      ? `SYSTEM INSTRUCTION: ${systemInstruction}\n\nUSER QUERY: ${prompt}` 
      : prompt;

    let response;
    
    try {
        if (image) {
           response = await puter.ai.chat(fullPrompt, image);
        } else {
           response = await puter.ai.chat(fullPrompt);
        }
    } catch (innerError: any) {
        if (innerError?.message?.includes('401') || innerError?.code === 401) {
             console.log("[Puter] Auth required. Attempting to sign in...");
             await puter.auth.signIn();
             if (image) {
                response = await puter.ai.chat(fullPrompt, image);
             } else {
                response = await puter.ai.chat(fullPrompt);
             }
        } else {
            throw innerError;
        }
    }

    if (typeof response === 'string') return response;
    if (response?.message?.content) return response.message.content;
    if (response?.text) return response.text;
    
    return JSON.stringify(response);

  } catch (error: any) {
    console.error(`[Puter] AI Error:`, error);
    return null;
  }
};

// --- FALLBACK LOGIC ---
const fallbackComparison = (item1: ItemReport, item2: ItemReport): ComparisonResult => {
     let score = 0;
     const sim = [];
     const diff = [];
     
     // 1. Category Check (High Weight)
     if (item1.category === item2.category) {
         score += 25;
         sim.push("Same Category");
     } else {
         diff.push(`Different Categories (${item1.category} vs ${item2.category})`);
     }
     
     // 2. Title Similarity
     const titleSim = calculateTextSimilarity(item1.title, item2.title);
     if (titleSim > 0.8) {
         score += 35;
         sim.push("Identical Titles");
     } else if (titleSim > 0.4) {
         score += 20;
         sim.push("Similar Titles");
     }

     // 3. Description Similarity
     const descSim = calculateTextSimilarity(item1.description, item2.description);
     if (descSim > 0.8) {
         score += 40;
         sim.push("Matching Description");
     } else if (descSim > 0.3) {
         score += 15 + (descSim * 20);
         sim.push("Shared Keywords");
     }

     // 4. Date Logic
     if (item1.date === item2.date) {
         score += 5; 
     }

     return {
         confidence: Math.min(Math.round(score), 99),
         explanation: "AI analysis unavailable. Score calculated based on keyword overlap and category matching.",
         similarities: sim,
         differences: diff
     };
};

// --- EXPORTED FEATURES (API) ---

export const findSmartMatches = async (sourceItem: ItemReport, allReports: ItemReport[]): Promise<{ report: ItemReport, confidence: number, isOffline: boolean }[]> => {
    
    const targetType = sourceItem.type === 'LOST' ? 'FOUND' : 'LOST';
    
    // Filter candidates
    let candidates = allReports.filter(r => 
        r.status === 'OPEN' && 
        r.type === targetType &&
        r.id !== sourceItem.id
    );

    if (candidates.length === 0) return [];

    // Optimize: Pre-filter by category to save tokens, unless "Other"
    if (sourceItem.category !== ItemCategory.OTHER) {
        const strictMatches = candidates.filter(c => c.category === sourceItem.category);
        if (strictMatches.length > 0) candidates = strictMatches;
    }

    if (candidates.length > 10) candidates = candidates.slice(0, 10);

    let matchResults: MatchCandidate[] = [];
    let usedAI = false;
    
    // Minify data for Prompt
    const aiCandidates = candidates.map(c => ({ 
        id: c.id, 
        t: c.title, 
        d: c.description,
        l: c.location,
        c: c.category
    }));

    const sourceData = `ITEM: ${sourceItem.title}. DESC: ${sourceItem.description}. CAT: ${sourceItem.category}. LOC: ${sourceItem.location}`;

    try {
        const fullPrompt = `
          Task: Match a ${sourceItem.type} item to potential candidates.
          TARGET: ${sourceData}
          CANDIDATES: ${JSON.stringify(aiCandidates)}
          
          Instructions:
          - Return JSON: { "matches": [ { "id": "candidate_id", "confidence": number (0-100) } ] }
          - High confidence (80-100) for exact title/description matches.
          - Medium confidence (50-79) for same category and similar description.
          - Ignore "Lost" vs "Found" label differences, focus on the object itself.
        `;
        
        const text = await callPuterAI(fullPrompt);

        if (text) {
            const cleanText = cleanJSON(text);
            const data = JSON.parse(cleanText);
            matchResults = data.matches || [];
            usedAI = true;
        }
    } catch (e) {
        console.error("[Gemini] Smart Match Logic Error:", e);
    }

    // Fallback if AI fails or returns empty
    if (!usedAI || matchResults.length === 0) {
        matchResults = candidates.map(c => {
            const titleSim = calculateTextSimilarity(sourceItem.title, c.title);
            const descSim = calculateTextSimilarity(sourceItem.description, c.description);
            // Weighted score
            let score = (titleSim * 50) + (descSim * 50);
            if (c.category === sourceItem.category) score += 10;
            return { id: c.id, confidence: Math.min(score, 100) };
        }).filter(m => m.confidence > 20);
    }

    const results = matchResults.map(m => {
        const report = candidates.find(c => c.id === m.id);
        return report ? { report, confidence: Math.round(m.confidence), isOffline: !usedAI } : null;
    }).filter(Boolean) as { report: ItemReport, confidence: number, isOffline: boolean }[];

    return results.sort((a, b) => b.confidence - a.confidence);
};

export const instantImageCheck = async (base64Image: string): Promise<{ 
  faceStatus: 'NONE' | 'ACCIDENTAL' | 'PRANK';
  isPrank: boolean;
  violationType: 'GORE' | 'ANIMAL' | 'HUMAN' | 'NONE';
  reason: string;
}> => {
  try {
    const text = await callPuterAI(
      `Safety Check. 
       Rules: NO VIOLENCE, NO NUDITY, NO SELFIES.
       Return JSON: { "violationType": "GORE"|"NUDITY"|"HUMAN"|"NONE", "isPrank": boolean, "reason": "string" }`,
       base64Image
    );

    if (!text) return { faceStatus: 'NONE', violationType: 'NONE', isPrank: false, reason: "Offline" };
    const result = JSON.parse(cleanJSON(text));
    
    return {
        faceStatus: result.faceStatus || 'NONE',
        violationType: result.violationType || 'NONE',
        isPrank: result.isPrank || false,
        reason: result.reason || ''
    };
  } catch (e) {
    return { faceStatus: 'NONE', violationType: 'NONE', isPrank: false, reason: "Check unavailable" };
  }
};

export const detectRedactionRegions = async (base64Image: string): Promise<number[][]> => {
  try {
    const text = await callPuterAI(
      `Identify bounding boxes [ymin, xmin, ymax, xmax] (scale 0-1000) for: FACES, ID CARDS. 
       Return JSON { "regions": [[ymin, xmin, ymax, xmax], ...] }`,
       base64Image
    );
    
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
    const text = await callPuterAI(
       `Extract Item Details.
        JSON Output:
        - title: string
        - category: string
        - tags: string[]
        - color: string
        - brand: string
        - condition: string
        - distinguishingFeatures: string[]`,
        base64Image
    );
    
    if (!text) throw new Error("No response");
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
        const text = await callPuterAI(
          `Write a 2-sentence description for a Lost & Found post based on:
           User Notes: "${userDistinguishingFeatures}"
           Visuals: ${JSON.stringify(visualData)}`,
        );
        return text || userDistinguishingFeatures;
    } catch (e) {
        return userDistinguishingFeatures;
    }
};

export const validateReportContext = async (reportData: any): Promise<{ isValid: boolean, reason: string }> => {
    try {
        const text = await callPuterAI(
          `Validate Report. Return JSON { "isValid": boolean, "reason": string }. Data: ${JSON.stringify(reportData)}`
        );
        if (!text) return { isValid: true, reason: "" };
        const result = JSON.parse(cleanJSON(text));
        return { isValid: result.isValid ?? true, reason: result.reason || "" };
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
        const prompt = `
          Analyze: "${title} - ${description}".
          Output JSON: { "isViolating": boolean, "violationType": string, "summary": string, "tags": string[] }
        `;
        
        const img = base64Images.length > 0 ? base64Images[0] : undefined;
        const text = await callPuterAI(prompt, img);

        if (!text) throw new Error("Failed");
        
        const result = JSON.parse(cleanJSON(text));
        return {
            category: result.category || ItemCategory.OTHER,
            title: title,
            summary: result.summary || description,
            tags: result.tags || [],
            description: description,
            distinguishingFeatures: [],
            isPrank: false,
            faceStatus: 'NONE',
            isViolating: result.isViolating || false,
            violationType: result.violationType,
            violationReason: result.violationReason
        };
    } catch (e) {
        return {
            category: ItemCategory.OTHER,
            title,
            summary: description,
            tags: [],
            description,
            distinguishingFeatures: [],
            isPrank: false,
            faceStatus: 'NONE',
            isViolating: false
        };
    }
};

export const parseSearchQuery = async (query: string): Promise<{ userStatus: 'LOST' | 'FOUND' | 'UNKNOWN', refinedQuery: string }> => {
    try {
        const text = await callPuterAI(
          `Analyze query: "${query}". Return JSON { "userStatus": "LOST"|"FOUND"|"UNKNOWN", "refinedQuery": "keywords" }`
        );
        
        if (!text) throw new Error("No text");
        const result = JSON.parse(cleanJSON(text));
        return { userStatus: result.userStatus || 'UNKNOWN', refinedQuery: result.refinedQuery || query };
    } catch (e) {
        return { userStatus: 'UNKNOWN', refinedQuery: query };
    }
};

export const compareItems = async (item1: ItemReport, item2: ItemReport): Promise<ComparisonResult> => {
    // 1. DETERMINISTIC PRE-CHECK (Fix for identical items)
    const titleSim = calculateTextSimilarity(item1.title, item2.title);
    const descSim = calculateTextSimilarity(item1.description, item2.description);
    
    // If text is extremely similar, bypass AI to avoid randomness/hallucinations
    if (titleSim > 0.9 && descSim > 0.9) {
        return {
            confidence: 99,
            explanation: "Items have identical titles and descriptions. Highly likely to be the same match.",
            similarities: ["Title matches perfectly", "Description matches perfectly", "Category matches"],
            differences: []
        };
    }

    try {
         const prompt = `
            ACT AS AN OBJECT RECOGNITION EXPERT.
            Task: Compare Item A (Lost) with Item B (Found).
            Goal: Determine if they are the SAME physical object.
            
            Item A (Lost):
            - Title: ${item1.title}
            - Description: ${item1.description}
            - Category: ${item1.category}
            - Color/Brand: ${item1.tags.join(', ')}

            Item B (Found):
            - Title: ${item2.title}
            - Description: ${item2.description}
            - Category: ${item2.category}
            - Color/Brand: ${item2.tags.join(', ')}

            IMPORTANT INSTRUCTIONS:
            1. Ignore the fact that one is "Lost" and one is "Found". Focus only on visual/physical properties.
            2. If Title and Description are nearly identical, Confidence MUST be 95-100.
            3. Return JSON ONLY.
            
            JSON Structure:
            { 
               "confidence": number (Integer 0-100), 
               "explanation": "concise reason", 
               "similarities": ["point 1", "point 2"], 
               "differences": ["point 1", "point 2"] 
            }
         `;

         // Use image from item2 (Found) as the visual anchor if available, 
         // assuming user wants to check if the Found item matches their Lost description.
         const img = item2.imageUrls?.[0] || item1.imageUrls?.[0];
         
         const text = await callPuterAI(prompt, img);

         if (!text) throw new Error("No response");
         
         const result = JSON.parse(cleanJSON(text));
         
         // Robust Normalization
         let conf = result.confidence;
         
         // Handle AI returning string "95%"
         if (typeof conf === 'string') {
            conf = parseFloat(conf.replace('%', ''));
         }

         // Handle AI returning decimal 0.95
         if (typeof conf === 'number') {
            if (conf <= 1 && conf > 0) {
                conf = conf * 100;
            }
         } else {
             conf = 50; // Safety default
         }
         
         // Final deterministic boost if string similarity is high but AI scored low
         if ((titleSim > 0.8 || descSim > 0.8) && conf < 60) {
             conf += 30; // Boost score because text matches strongly
         }

         return {
             ...result,
             confidence: Math.round(Math.min(conf, 100))
         };

    } catch (e) {
        console.error("AI Compare Failed, using fallback:", e);
        return fallbackComparison(item1, item2);
    }
};
