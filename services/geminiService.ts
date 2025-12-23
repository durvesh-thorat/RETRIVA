import { GoogleGenAI, Type } from "@google/genai";
import { ItemCategory, GeminiAnalysisResult, ItemReport } from "../types";

// --- TYPES ---
export interface ComparisonResult {
  confidence: number;
  explanation: string;
  similarities: string[];
  differences: string[];
}

// --- CONFIGURATION: THE EXPANDED FLASH PIPELINE ---
// We try standard production models first, then specific versions, then experimental.
const MODEL_PIPELINE = [
  'gemini-1.5-flash',           // Production Standard
  'gemini-1.5-flash-latest',    // Latest Alias
  'gemini-1.5-flash-001',       // Specific Version 001
  'gemini-1.5-flash-002',       // Specific Version 002
  'gemini-1.5-flash-8b',        // Flash 8b (Lite)
  'gemini-2.0-flash-exp',       // 2.0 Experimental
  'gemini-1.5-pro',             // Fallback: Pro (Standard)
  'gemini-1.5-pro-latest'       // Fallback: Pro (Latest)
];

// --- HELPER: API KEY ---
const getApiKey = (): string | undefined => {
  // @ts-ignore
  const key = import.meta.env.VITE_API_KEY || import.meta.env.API_KEY;
  // If running in node/process env fallback
  if (!key && typeof process !== 'undefined') {
    return process.env.VITE_API_KEY || process.env.API_KEY;
  }
  return key;
};

// --- HELPER: JSON CLEANER ---
const cleanJSON = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "");
  const firstOpen = cleaned.indexOf('{');
  const lastClose = cleaned.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    cleaned = cleaned.substring(firstOpen, lastClose + 1);
  }
  return cleaned.trim();
};

// --- MODEL MANAGER CLASS (MEMORY ONLY) ---
class ModelManager {
  // We utilize in-memory banning only. 
  // If the user refreshes, we want to try again, not be locked out for 24h.
  private sessionBans: Set<string> = new Set();

  public banModel(model: string, reason: string) {
    console.warn(`⚠️ Skipping model ${model} for this session: ${reason}`);
    this.sessionBans.add(model);
  }

  public resetBans() {
    console.info("🔄 Resetting model bans for retry...");
    this.sessionBans.clear();
  }

  public getAvailableModels(): string[] {
    return MODEL_PIPELINE.filter(model => !this.sessionBans.has(model));
  }
}

const modelManager = new ModelManager();

// --- CORE GENERATION FUNCTION ---
const generateWithGauntlet = async (params: any, systemInstruction?: string, retryCount = 0): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("MISSING_API_KEY");

  let pipeline = modelManager.getAvailableModels();

  // SELF-HEALING: If we ran out of models, reset bans and try one more time.
  if (pipeline.length === 0 && retryCount === 0) {
    modelManager.resetBans();
    pipeline = modelManager.getAvailableModels();
  }

  if (pipeline.length === 0) {
     // If still empty after reset, we are truly stuck.
     if (typeof window !== 'undefined') {
        const event = new CustomEvent('retriva-toast', { 
            detail: { 
                message: "Connection to AI models failed. Please check API Key or Quota.", 
                type: 'alert' 
            } 
        });
        window.dispatchEvent(event);
    }
    throw new Error("ALL_MODELS_FAILED");
  }

  const ai = new GoogleGenAI({ apiKey });
  let lastError: any = null;

  for (const model of pipeline) {
    try {
      // Clean config to be safe across models
      const config = { ...params.config };
      delete config.thinkingConfig; // Not all models support thinking
      
      if (systemInstruction) {
         config.systemInstruction = systemInstruction;
      }

      // console.log(`🚀 Attempting: ${model}`); 

      const response = await ai.models.generateContent({
        ...params,
        model,
        config
      });

      // If we get here, it worked!
      return response.text || "";

    } catch (error: any) {
      const msg = (error.message || "").toLowerCase();
      const status = error.status || 0;
      
      // LOGIC:
      // 404: Model doesn't exist (or alias invalid) -> Skip for session
      // 429: Quota exceeded -> Skip for session
      // 503: Overloaded -> Skip (maybe retry later, but for now skip)
      
      if (status === 404 || msg.includes('not found')) {
         modelManager.banModel(model, "404 Not Found");
      } else if (status === 429 || msg.includes('quota') || msg.includes('exhausted')) {
         modelManager.banModel(model, "429 Quota Exceeded");
      } else {
         // Other errors (500, 503, etc)
         console.warn(`❌ Error with ${model}: ${msg}`);
         // We usually skip these too to try the next best model
      }
      
      lastError = error;
      continue; // Try next model
    }
  }

  // If we exit the loop, all models in the current pipeline failed.
  // If we haven't retried yet, trigger the self-healing recursion
  if (retryCount === 0) {
     return generateWithGauntlet(params, systemInstruction, 1);
  }

  throw lastError || new Error("All AI models failed to respond.");
};


// --- EXPORTED FEATURES (API) ---

export const instantImageCheck = async (base64Image: string): Promise<{ 
  faceStatus: 'NONE' | 'ACCIDENTAL' | 'PRANK';
  isPrank: boolean;
  violationType: 'GORE' | 'ANIMAL' | 'HUMAN' | 'NONE';
  reason: string;
}> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const text = await generateWithGauntlet({
      contents: {
        parts: [
          { text: `SYSTEM: Security Scan. Analyze image for violations (GORE, NUDITY, PRIVACY). Return JSON.` },
          { inlineData: { mimeType: "image/jpeg", data: base64Data } }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(cleanJSON(text));
  } catch (e) {
    console.error(e);
    // Fail open (allow) but warn, or fail closed? Let's fail safe (no violation detected if AI fails)
    return { faceStatus: 'NONE', violationType: 'NONE', isPrank: false, reason: "Check unavailable" };
  }
};

export const detectRedactionRegions = async (base64Image: string): Promise<number[][]> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const text = await generateWithGauntlet({
      contents: {
        parts: [
          { text: `Identify bounding boxes [ymin, xmin, ymax, xmax] (scale 0-1000) for Faces, ID Cards, Credit Cards. Return JSON { "regions": [[...]] }` },
          { inlineData: { mimeType: "image/jpeg", data: base64Data } }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

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
    const text = await generateWithGauntlet({
      contents: {
        parts: [
          { text: `Analyze for Lost & Found. Extract: title, category (${Object.values(ItemCategory).join(',')}), tags, color, brand, condition, distinguishingFeatures. Return JSON.` },
          { inlineData: { mimeType: "image/jpeg", data: base64Data } }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJSON(text));
  } catch (e) {
    return { 
      title: "", category: ItemCategory.OTHER, tags: [], 
      color: "", brand: "", condition: "", distinguishingFeatures: [] 
    };
  }
};

export const mergeDescriptions = async (userContext: string, visualData: any): Promise<string> => {
  try {
    const text = await generateWithGauntlet({
      contents: {
        parts: [{ text: `Merge visual data (${JSON.stringify(visualData)}) with user context ("${userContext}") into a concise Lost & Found item description.` }]
      }
    }, "You are a helpful copywriter.");
    return text || userContext;
  } catch (e) {
    return userContext;
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

    const text = await generateWithGauntlet({
      contents: { parts },
      config: { responseMimeType: "application/json" }
    }, "You are a content moderator and classifier.");

    const result = JSON.parse(cleanJSON(text));
    return {
      isViolating: result.isViolating || false,
      violationType: result.violationType || 'NONE',
      violationReason: result.violationReason || '',
      isPrank: false,
      category: result.category || ItemCategory.OTHER,
      title: result.title || title,
      description: result.description || description,
      summary: result.summary || description.substring(0, 50),
      tags: result.tags || [],
      distinguishingFeatures: result.distinguishingFeatures || [],
      faceStatus: 'NONE'
    };
  } catch (error) {
    // Return safe default if analysis fails
    return { 
      isViolating: false, isPrank: false, category: ItemCategory.OTHER, 
      title: title || "Item", description, distinguishingFeatures: [], summary: "", tags: [], faceStatus: 'NONE'
    } as any;
  }
};

export const parseSearchQuery = async (query: string): Promise<{ userStatus: 'LOST' | 'FOUND' | 'NONE'; refinedQuery: string }> => {
  try {
    const text = await generateWithGauntlet({
      contents: { parts: [{ text: `Analyze query: "${query}". Return JSON: userStatus (LOST/FOUND/NONE), refinedQuery (keywords).` }] }
    }, "You are a search intent analyzer.");
    return JSON.parse(cleanJSON(text));
  } catch (e) {
    return { userStatus: 'NONE', refinedQuery: query };
  }
};

export const findPotentialMatches = async (
  query: { description: string; imageUrls: string[] },
  candidates: ItemReport[]
): Promise<{ id: string }[]> => {
  if (candidates.length === 0) return [];
  try {
    const candidateList = candidates.map(c => ({ id: c.id, t: c.title, d: c.description, c: c.category }));
    
    // Limit candidates per batch to avoid token limits
    const BATCH_SIZE = 10;
    const allMatches: { id: string }[] = [];

    for (let i = 0; i < candidateList.length; i += BATCH_SIZE) {
        const batch = candidateList.slice(i, i + BATCH_SIZE);
        const parts: any[] = [{ text: `Find matches for "${query.description}" in: ${JSON.stringify(batch)}. Return JSON { "matches": [{ "id": "..." }] }.` }];
    
        if (query.imageUrls[0]) {
            const data = query.imageUrls[0].split(',')[1];
            if (data) parts.push({ inlineData: { mimeType: "image/jpeg", data } });
        }

        try {
            const text = await generateWithGauntlet({
                contents: { parts },
                config: { responseMimeType: "application/json" }
            }, "You are a matching engine.");
            
            const data = JSON.parse(cleanJSON(text));
            if (data.matches) allMatches.push(...data.matches);
        } catch (e) {
            console.warn("Batch match failed", e);
        }
    }
    
    return allMatches;
  } catch (e) {
    console.error("Match error", e);
    return [];
  }
};

export const compareItems = async (itemA: ItemReport, itemB: ItemReport): Promise<ComparisonResult> => {
  try {
    const parts: any[] = [{ text: `Compare Item A (${itemA.title}) vs Item B (${itemB.title}). Return JSON: confidence (0-100), explanation, similarities (array), differences (array).` }];
    
    const images = [itemA.imageUrls[0], itemB.imageUrls[0]].filter(Boolean);
    images.forEach(img => {
      const data = img.split(',')[1];
      if (data) parts.push({ inlineData: { mimeType: "image/jpeg", data } });
    });

    const text = await generateWithGauntlet({
       contents: { parts },
       config: { responseMimeType: "application/json" }
    }, "You are a forensic analyst.");
    
    return JSON.parse(cleanJSON(text));
  } catch (e) {
    return { confidence: 0, explanation: "Comparison unavailable.", similarities: [], differences: [] };
  }
};