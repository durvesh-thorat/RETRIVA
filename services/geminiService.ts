
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

// --- HELPER: PUTER WRAPPER ---
const callPuterAI = async (
  prompt: string, 
  image?: string, 
  systemInstruction?: string
): Promise<string | null> => {
  // 1. Check if Puter is loaded
  if (typeof puter === 'undefined') {
      console.error("[Retriva] Puter.js is not loaded in window. Please check index.html script tag.");
      return null;
  }

  try {
    // 2. Construct Prompt
    const fullPrompt = systemInstruction 
      ? `SYSTEM INSTRUCTION: ${systemInstruction}\n\nUSER QUERY: ${prompt}` 
      : prompt;

    let response;
    
    // 3. Call Puter
    // If not logged in, this might throw or return null. 
    // Puter typically handles the UI popup if it's a user interaction context.
    // If we get a 401 error caught here, we can try to force auth.
    
    try {
        if (image) {
           response = await puter.ai.chat(fullPrompt, image);
        } else {
           response = await puter.ai.chat(fullPrompt);
        }
    } catch (innerError: any) {
        // Check for Auth error
        if (innerError?.message?.includes('401') || innerError?.code === 401) {
             console.log("[Puter] Auth required. Attempting to sign in...");
             await puter.auth.signIn();
             // Retry once
             if (image) {
                response = await puter.ai.chat(fullPrompt, image);
             } else {
                response = await puter.ai.chat(fullPrompt);
             }
        } else {
            throw innerError;
        }
    }

    // 4. Normalize Response
    if (typeof response === 'string') return response;
    if (response?.message?.content) return response.message.content;
    if (response?.text) return response.text;
    
    console.warn("[Puter] Unexpected response structure:", response);
    return JSON.stringify(response);

  } catch (error: any) {
    console.error(`[Puter] AI Error:`, error);
    return null;
  }
};

// --- EXPORTED FEATURES (API) ---

export const findSmartMatches = async (sourceItem: ItemReport, allReports: ItemReport[]): Promise<{ report: ItemReport, confidence: number, isOffline: boolean }[]> => {
    
    console.log(`[Retriva] 🔍 Starting Smart Match via Puter for: ${sourceItem.title}`);

    const targetType = sourceItem.type === 'LOST' ? 'FOUND' : 'LOST';
    
    let candidates = allReports.filter(r => 
        r.status === 'OPEN' && 
        r.type === targetType &&
        r.id !== sourceItem.id
    );

    if (candidates.length > 20) candidates = candidates.slice(0, 20);
    if (candidates.length === 0) return [];

    let matchResults: MatchCandidate[] = [];
    let usedAI = false;
    
    // Minify data
    const aiCandidates = candidates.map(c => ({ 
        id: c.id, 
        t: c.title, 
        d: c.description, 
        c: c.category
    }));

    const sourceData = `ITEM: ${sourceItem.title}. DESC: ${sourceItem.description}. CAT: ${sourceItem.category}.`;

    try {
        const systemPrompt = `
          Match LOST/FOUND items.
          OUTPUT: JSON { "matches": [ { "id": "string", "confidence": number } ] }
          Confidence > 40 only.
        `;

        const fullPrompt = `CANDIDATES: ${JSON.stringify(aiCandidates)}\nTARGET: ${sourceData}`;
        
        const text = await callPuterAI(fullPrompt, undefined, systemPrompt);

        if (text) {
            const cleanText = cleanJSON(text);
            const data = JSON.parse(cleanText);
            matchResults = data.matches || [];
            usedAI = true;
        }
    } catch (e) {
        console.error("[Gemini] Smart Match Logic Error:", e);
    }

    // Fallback
    if (!usedAI) {
        matchResults = candidates
            .map(c => {
                let score = 0;
                if (c.category === sourceItem.category) score += 30;
                if (c.title.toLowerCase().includes(sourceItem.title.toLowerCase())) score += 40;
                return { id: c.id, confidence: score };
            })
            .filter(m => m.confidence > 30);
    }

    const results = matchResults.map(m => {
        const report = candidates.find(c => c.id === m.id);
        return report ? { report, confidence: m.confidence, isOffline: !usedAI } : null;
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
    try {
         const prompt = `
            Compare Item A and B. Return JSON { "confidence": number, "explanation": string, "similarities": string[], "differences": string[] }
            A: ${item1.title} ${item1.description}
            B: ${item2.title} ${item2.description}
         `;

         const text = await callPuterAI(prompt);

         if (!text) throw new Error("No response");
         return JSON.parse(cleanJSON(text));
    } catch (e) {
        return { confidence: 0, explanation: "Comparison unavailable.", similarities: [], differences: [] };
    }
};
