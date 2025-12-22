import { GoogleGenAI, Type } from "@google/genai";
import { ItemCategory, GeminiAnalysisResult, ItemReport } from "../types";

// --- TYPES ---
export interface ComparisonResult {
  confidence: number;
  explanation: string;
  similarities: string[];
  differences: string[];
}

type AIProvider = 'GOOGLE' | 'GROQ';
type TaskType = 'VISION' | 'TEXT';

// --- CONFIGURATION ---
const SYSTEM_CONFIG = {
  // Vision tasks must use Gemini (Groq vision is currently limited/beta in some tiers)
  VISION_MODELS: ['gemini-3-flash-preview', 'gemini-2.5-flash-latest', 'gemini-2.0-flash-exp'],
  
  // Text tasks can be load balanced across multiple providers
  TEXT_MODELS_GEMINI: ['gemini-3-flash-preview', 'gemini-3-pro-preview'],
  TEXT_MODELS_GROQ: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
};

// --- HELPER: API KEYS ---
const getApiKey = (provider: AIProvider): string | undefined => {
  const targetKey = provider === 'GOOGLE' ? 'API_KEY' : 'GROQ_API_KEY';
  const viteKey = `VITE_${targetKey}`;
  let key: string | undefined;

  try {
    // @ts-ignore
    if (import.meta.env) {
      // @ts-ignore
      key = import.meta.env[viteKey] || import.meta.env[targetKey];
    }
  } catch (e) {}

  if (!key && typeof process !== 'undefined' && process.env) {
    key = process.env[viteKey] || process.env[targetKey];
  }
  return key;
};

// --- HELPER: SLEEP WITH JITTER ---
// Prevents "thundering herd" where all retries hit at once
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms + Math.random() * 1000));

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

// --- PROVIDER: GOOGLE GEMINI ---
const callGemini = async (model: string, params: any) => {
  const apiKey = getApiKey('GOOGLE');
  if (!apiKey) throw new Error("MISSING_GOOGLE_KEY");

  const ai = new GoogleGenAI({ apiKey });
  
  // Ensure config doesn't have unsupported fields for older models if we fallback
  const config = { ...params.config };
  
  // Only use thinking for models that support it and if explicitly requested, 
  // but generally remove it for stability in this swarm architecture
  delete config.thinkingConfig; 

  const response = await ai.models.generateContent({
    ...params,
    model,
    config
  });
  
  return response.text || "";
};

// --- PROVIDER: GROQ (OPENAI COMPATIBLE) ---
const callGroq = async (model: string, messages: any[], jsonMode: boolean) => {
  const apiKey = getApiKey('GROQ');
  if (!apiKey) throw new Error("MISSING_GROQ_KEY");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages,
      model,
      temperature: 0.1, // Low temperature for factual consistency
      max_tokens: 1024,
      response_format: jsonMode ? { type: "json_object" } : { type: "text" }
    })
  });

  if (response.status === 429) {
    throw new Error("GROQ_RATE_LIMIT");
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq Error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
};

// --- ADAPTER: GEMINI PARAMS -> GROQ MESSAGES ---
const convertParamsToGroq = (contents: any, systemPrompt: string = "") => {
  const parts = contents.parts || [];
  let userContent = "";

  parts.forEach((part: any) => {
    if (part.text) userContent += part.text + "\n";
    // Groq text models can't handle inlineData images, so we skip them 
    // and rely on the text description provided in the system prompt usually
  });

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userContent.trim() });
  
  return messages;
};

// --- CORE: SWARM ORCHESTRATOR ---
// This function routes requests dynamically based on health and availability
const executeSwarmRequest = async (
  taskType: TaskType, 
  params: any,
  systemInfo: string = "You are a helpful AI."
): Promise<string> => {
  
  let strategies: Array<() => Promise<string>> = [];

  // 1. BUILD STRATEGY CHAIN
  if (taskType === 'VISION') {
    // Vision MUST use Gemini models (Groq Llama 3.2 Vision is strictly rate limited often)
    // We create a chain of all available Gemini models
    strategies = SYSTEM_CONFIG.VISION_MODELS.map(model => 
      () => callGemini(model, params)
    );
  } else {
    // Text can be load balanced. 
    // We shuffle providers to prevent hitting one too hard.
    const useGroqFirst = Math.random() > 0.5;
    
    const geminiStrategies = SYSTEM_CONFIG.TEXT_MODELS_GEMINI.map(model => 
      () => callGemini(model, params)
    );
    
    const groqStrategies = SYSTEM_CONFIG.TEXT_MODELS_GROQ.map(model => 
      () => {
        const isJson = !!params.config?.responseSchema || params.config?.responseMimeType === 'application/json';
        const msgs = convertParamsToGroq(params.contents, systemInfo);
        if (isJson) msgs.unshift({ role: "system", content: systemInfo + " You must output valid JSON." });
        return callGroq(model, msgs, isJson);
      }
    );

    if (useGroqFirst) {
      strategies = [...groqStrategies, ...geminiStrategies];
    } else {
      strategies = [...geminiStrategies, ...groqStrategies];
    }
  }

  // 2. EXECUTE CHAIN
  let lastError = null;

  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result) return result;
    } catch (e: any) {
      console.warn(`Swarm Node Failed: ${e.message}. Rerouting...`);
      lastError = e;
      
      // If rate limited, wait a bit before trying next node
      if (e.message.includes("429") || e.message.includes("RATE_LIMIT") || e.message.includes("Quota")) {
        await sleep(1500); 
      }
    }
  }

  console.error("All Swarm Nodes exhausted.");
  throw lastError || new Error("AI_SWARM_FAILURE");
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
    const text = await executeSwarmRequest('VISION', {
      contents: {
        parts: [
          { text: `SYSTEM: Security Scan. Analyze image for violations (GORE, NUDITY, PRIVACY). Return JSON.` },
          { inlineData: { mimeType: "image/jpeg", data: base64Data } }
        ]
      },
      config: { responseMimeType: "application/json" } // Gemini only config, ignored by Groq adapter
    });

    return JSON.parse(cleanJSON(text));
  } catch (e) {
    return { faceStatus: 'NONE', violationType: 'NONE', isPrank: false, reason: "Check unavailable" };
  }
};

export const detectRedactionRegions = async (base64Image: string): Promise<number[][]> => {
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const text = await executeSwarmRequest('VISION', {
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
    const text = await executeSwarmRequest('VISION', {
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
    const text = await executeSwarmRequest('TEXT', {
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
    
    // If images exist, this becomes a VISION task, otherwise TEXT
    const taskType: TaskType = base64Images.length > 0 ? 'VISION' : 'TEXT';

    if (taskType === 'VISION') {
       base64Images.forEach(img => {
          const data = img.split(',')[1] || img;
          if (data) parts.push({ inlineData: { mimeType: "image/jpeg", data } });
       });
    }

    const text = await executeSwarmRequest(taskType, {
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
    return { 
      isViolating: false, isPrank: false, category: ItemCategory.OTHER, 
      title: title || "Item", description, distinguishingFeatures: [], summary: "", tags: [], faceStatus: 'NONE'
    } as any;
  }
};

export const parseSearchQuery = async (query: string): Promise<{ userStatus: 'LOST' | 'FOUND' | 'NONE'; refinedQuery: string }> => {
  try {
    const text = await executeSwarmRequest('TEXT', {
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
    // Optimization: Minimize token usage by sending minimal candidate data
    const candidateList = candidates.map(c => ({ id: c.id, t: c.title, d: c.description, c: c.category }));
    
    // If query has images, it's a VISION task, otherwise TEXT
    const taskType = query.imageUrls.length > 0 ? 'VISION' : 'TEXT';
    
    const parts: any[] = [{ text: `Find semantic matches for "${query.description}" in candidates: ${JSON.stringify(candidateList)}. Return JSON { "matches": [{ "id": "..." }] }. Strictness: High.` }];
    
    if (taskType === 'VISION' && query.imageUrls[0]) {
       const data = query.imageUrls[0].split(',')[1];
       if (data) parts.push({ inlineData: { mimeType: "image/jpeg", data } });
    }

    const text = await executeSwarmRequest(taskType, {
      contents: { parts },
      config: { responseMimeType: "application/json" }
    }, "You are a matching engine.");

    const data = JSON.parse(cleanJSON(text));
    return data.matches || [];
  } catch (e) {
    console.error("Match error", e);
    return [];
  }
};

export const compareItems = async (itemA: ItemReport, itemB: ItemReport): Promise<ComparisonResult> => {
  try {
    const parts: any[] = [{ text: `Compare Item A (${itemA.title}: ${itemA.description}) vs Item B (${itemB.title}: ${itemB.description}). Return JSON: confidence (0-100), explanation, similarities (array), differences (array).` }];
    
    const images = [itemA.imageUrls[0], itemB.imageUrls[0]].filter(Boolean);
    const taskType = images.length > 0 ? 'VISION' : 'TEXT';

    if (taskType === 'VISION') {
      images.forEach(img => {
        const data = img.split(',')[1];
        if (data) parts.push({ inlineData: { mimeType: "image/jpeg", data } });
      });
    }

    const text = await executeSwarmRequest(taskType, {
       contents: { parts },
       config: { responseMimeType: "application/json" }
    }, "You are a forensic analyst.");
    
    return JSON.parse(cleanJSON(text));
  } catch (e) {
    return { confidence: 0, explanation: "Comparison unavailable.", similarities: [], differences: [] };
  }
};
