
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
// AI models sometimes wrap JSON in markdown blocks or add text. This cleans it.
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
// Handles calling Puter AI with optional image
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
    // Puter chat doesn't always support a separate 'system' param in all versions, 
    // so we prepend it to the user prompt for maximum compatibility.
    const fullPrompt = systemInstruction 
      ? `SYSTEM INSTRUCTION: ${systemInstruction}\n\nUSER QUERY: ${prompt}` 
      : prompt;

    let response;
    
    // 3. Call Puter
    // Signature: puter.ai.chat(prompt, image) or puter.ai.chat(prompt)
    if (image) {
       response = await puter.ai.chat(fullPrompt, image);
    } else {
       response = await puter.ai.chat(fullPrompt);
    }

    // 4. Normalize Response
    // Puter might return a string or an object like { message: { content: "..." } }
    if (typeof response === 'string') return response;
    if (response?.message?.content) return response.message.content;
    if (response?.text) return response.text;
    
    console.warn("[Puter] Unexpected response structure:", response);
    return JSON.stringify(response);

  } catch (error: any) {
    console.error(`[Puter] AI Error:`, error);
    // If auth fails (401), Puter usually prompts the user via popup automatically on the next interaction.
    // We return null here to handle the UI gracefully.
    return null;
  }
};

// --- EXPORTED FEATURES (API) ---

export const findSmartMatches = async (sourceItem: ItemReport, allReports: ItemReport[]): Promise<{ report: ItemReport, confidence: number, isOffline: boolean }[]> => {
    
    console.log(`[Retriva] 🔍 Starting Smart Match via Puter for: ${sourceItem.title}`);

    const targetType = sourceItem.type === 'LOST' ? 'FOUND' : 'LOST';
    
    // 1. Loose Pre-Filtering (Client-side)
    let candidates = allReports.filter(r => 
        r.status === 'OPEN' && 
        r.type === targetType &&
        r.id !== sourceItem.id
    );

    // Limit candidates to avoid hitting context limits
    if (candidates.length > 30) candidates = candidates.slice(0, 30);
    if (candidates.length === 0) return [];

    let matchResults: MatchCandidate[] = [];
    let usedAI = false;
    
    // Minify data for AI context
    const aiCandidates = candidates.map(c => ({ 
        id: c.id, 
        t: c.title, 
        d: c.description, 
        c: c.category, 
        l: c.location,
        tm: `${c.date} ${c.time}`
    }));

    const sourceData = `ITEM: ${sourceItem.title}. DESC: ${sourceItem.description}. CAT: ${sourceItem.category}. LOC: ${sourceItem.location}. TIME: ${sourceItem.date} ${sourceItem.time}`;

    try {
        const systemPrompt = `
          You are a Forensic Recovery Agent matching Lost & Found items.
          TARGET ITEM: The item we are looking for.
          CANDIDATES: Potential matches.
          
          RULES:
          1. Semantic Matching: "AirPods" = "Earbuds", "MacBook" = "Laptop".
          2. Visual Constraints: If target is "Red", candidate "Blue" is 0 confidence.
          3. Time/Loc: Allow fuzzy matches (e.g. "Library" vs "Student Center" might be close).
          
          OUTPUT: JSON Object with "matches" array. 
          Format: { "matches": [ { "id": "string", "confidence": number (0-100), "reason": "string" } ] }
          Only include items with confidence > 40.
        `;

        const fullPrompt = `CANDIDATES JSON: ${JSON.stringify(aiCandidates)}\n\nTARGET ITEM DATA: ${sourceData}`;
        
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

    // 2. Fallback (Keyword Match) if AI fails
    if (!usedAI) {
        matchResults = candidates
            .map(c => {
                let score = 0;
                if (c.category === sourceItem.category) score += 30;
                if (c.title.toLowerCase().includes(sourceItem.title.toLowerCase())) score += 40;
                const commonWords = c.description.split(' ').filter(w => sourceItem.description.includes(w) && w.length > 4);
                score += commonWords.length * 5;
                return { id: c.id, confidence: Math.min(score, 100), reason: "Keyword Fallback" };
            })
            .filter(m => m.confidence > 30);
    }

    // 3. Map back to full objects
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
      `Safety Analysis Task.
       Strict Policy: 
       1. NO GORE or VIOLENCE.
       2. NO NUDITY or SEXUAL CONTENT.
       3. NO SELFIES (Accidental faces in background are OK, but primary subject cannot be a person posing).
       
       Analyze the image.
       Return JSON: { "violationType": "GORE"|"NUDITY"|"HUMAN"|"NONE", "isPrank": boolean, "reason": "short explanation" }`,
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
    // If check fails, allow permissive to avoid blocking user, but log error
    console.warn("Safety check failed", e);
    return { faceStatus: 'NONE', violationType: 'NONE', isPrank: false, reason: "Check unavailable" };
  }
};

export const detectRedactionRegions = async (base64Image: string): Promise<number[][]> => {
  try {
    const text = await callPuterAI(
      `Privacy Protection Task.
       Identify bounding boxes for: FACES, ID CARDS (Student ID, License), CREDIT CARDS, PHONE SCREENS showing text.
       Scale: 0 to 1000 (Relative to image dimensions).
       Format: [ymin, xmin, ymax, xmax].
       
       Return JSON: { "regions": [[ymin, xmin, ymax, xmax], ...] }
       If none found, return { "regions": [] }`,
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
       `Expert Appraiser Task.
        Analyze the image of the lost/found item.
        Extract JSON:
        - title: Short descriptive title (e.g. "Blue Hydroflask Water Bottle").
        - category: One of [Electronics, Stationery, Clothing, Accessories, ID Cards, Books, Other].
        - tags: Array of 3-5 visual keywords.
        - color: Dominant color name.
        - brand: Visible brand or "Unknown".
        - condition: "New", "Good", "Used", "Damaged".
        - distinguishingFeatures: Array of unique identifiers (e.g. "Sticker on laptop", "Crack on screen").`,
        base64Image
    );
    
    if (!text) throw new Error("No response");
    const parsed = JSON.parse(cleanJSON(text));
    
    return {
        title: parsed.title || "Found Item",
        category: parsed.category || ItemCategory.OTHER,
        tags: parsed.tags || [],
        color: parsed.color || "Unknown",
        brand: parsed.brand || "Unknown",
        condition: parsed.condition || "Good",
        distinguishingFeatures: parsed.distinguishingFeatures || []
    };
  } catch (e) {
    console.error("Autofill failed", e);
    return { 
      title: "", category: ItemCategory.OTHER, tags: [], 
      color: "", brand: "", condition: "", distinguishingFeatures: [] 
    };
  }
};

export const mergeDescriptions = async (userDistinguishingFeatures: string, visualData: any): Promise<string> => {
    try {
        const text = await callPuterAI(
          `Copywriting Task.
           Combine User Notes and Visual Data into a helpful description for a Lost & Found post.
           User Notes: "${userDistinguishingFeatures}"
           Visual Data: ${JSON.stringify(visualData)}
           
           Output: A concise, factual paragraph (max 3 sentences). Do not include "Here is the description". Just the text.`,
        );
        return text || userDistinguishingFeatures;
    } catch (e) {
        return userDistinguishingFeatures;
    }
};

export const validateReportContext = async (reportData: any): Promise<{ isValid: boolean, reason: string }> => {
    try {
        const text = await callPuterAI(
          `Validation Task.
           Review this report for logical consistency.
           Data: ${JSON.stringify(reportData)}
           
           Is this a valid item report?
           Reject if: 
           - Title/Description is gibberish.
           - Location is impossible (e.g. "Mars").
           - Content is abusive.
           
           Output JSON: { "isValid": boolean, "reason": "string (only if invalid)" }`
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
          Analysis Task.
          Item: "${title}"
          Desc: "${description}"
          
          1. Check for VIOLATIONS (Drugs, Weapons, Hate Speech).
          2. Summarize content.
          3. Tag attributes.
          
          Output JSON: { 
            "isViolating": boolean, 
            "violationType": string (optional), 
            "violationReason": string (optional), 
            "isPrank": boolean, 
            "category": string, 
            "summary": string, 
            "tags": string[], 
            "distinguishingFeatures": string[] 
          }
        `;
        
        // Pass first image if available to help context
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
            distinguishingFeatures: result.distinguishingFeatures || [],
            isPrank: result.isPrank || false,
            prankReason: result.violationReason,
            faceStatus: 'NONE',
            isViolating: result.isViolating || false,
            violationType: result.violationType,
            violationReason: result.violationReason
        };
    } catch (e) {
        // Fallback
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
          `NLP Task.
           Query: "${query}"
           1. Determine intent: Is user looking for something they LOST? Or reporting something they FOUND?
           2. Extract core keywords (remove stop words).
           
           Output JSON: { "userStatus": "LOST"|"FOUND"|"UNKNOWN", "refinedQuery": "string" }`
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
            Comparison Task.
            Are Item A and Item B the same physical object?
            
            Item A: ${item1.title}, ${item1.description}, ${item1.category}, Tags: ${item1.tags?.join(', ') || 'None'}
            Item B: ${item2.title}, ${item2.description}, ${item2.category}, Tags: ${item2.tags?.join(', ') || 'None'}
            
            Output JSON: { 
               "confidence": number (0-100), 
               "explanation": "Concise reasoning", 
               "similarities": ["point 1", "point 2"], 
               "differences": ["point 1", "point 2"] 
            }
         `;

         const text = await callPuterAI(prompt);

         if (!text) throw new Error("No response");
         return JSON.parse(cleanJSON(text));
    } catch (e) {
        return { confidence: 0, explanation: "Comparison service unavailable.", similarities: [], differences: [] };
    }
};
