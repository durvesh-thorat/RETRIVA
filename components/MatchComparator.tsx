
import React, { useEffect, useState } from 'react';
import { ItemReport } from '../types';
import { compareItems, ComparisonResult } from '../services/geminiService';
import { X, Sparkles, MessageCircle, Check, AlertTriangle, MapPin, Clock, Tag, ScanLine, BrainCircuit, Info, Bot } from 'lucide-react';

interface MatchComparatorProps {
  item1: ItemReport;
  item2: ItemReport;
  onClose: () => void;
  onContact: () => void;
}

const SafeImage = ({ src, alt }: { src?: string, alt?: string }) => {
  const [error, setError] = useState(false);
  if (src && !error) {
    return <img src={src} className="w-full h-full object-contain bg-black/20 transition-transform duration-700 hover:scale-105" onError={() => setError(true)} alt={alt} />;
  }
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/50 text-slate-500 border border-slate-800 border-dashed rounded-xl">
      <ScanLine className="w-8 h-8 mb-2 opacity-50" />
      <span className="font-bold text-[10px] uppercase tracking-widest">No Visuals</span>
    </div>
  );
};

const ComparisonRow = ({ label, val1, val2, icon: Icon }: { label: string, val1: string, val2: string, icon: any }) => {
  const isMatch = val1 === val2;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 py-3 border-b border-white/5 last:border-0 items-center group">
      <div className={`flex items-center gap-2 text-xs font-medium min-w-0 ${isMatch ? 'text-emerald-400' : 'text-slate-400'}`}>
         <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors shrink-0">
           <Icon className="w-3 h-3" />
         </div>
         <span className="truncate">{val1}</span>
      </div>
      
      <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-slate-500 uppercase tracking-widest shadow-sm whitespace-nowrap">
        {label}
      </div>

      <div className={`flex items-center justify-end gap-2 text-xs font-medium min-w-0 text-right ${isMatch ? 'text-emerald-400' : 'text-slate-400'}`}>
         <span className="truncate">{val2}</span>
         <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors shrink-0">
           <Icon className="w-3 h-3" />
         </div>
      </div>
    </div>
  );
};

const MatchComparator: React.FC<MatchComparatorProps> = ({ item1, item2, onClose, onContact }) => {
  const [analysis, setAnalysis] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % 4);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [loading]);

  useEffect(() => {
    const runAnalysis = async () => {
      setLoading(true);
      try {
        const result = await compareItems(item1, item2);
        setAnalysis(result || { 
            confidence: 50, 
            explanation: "Could not retrieve full analysis.", 
            similarities: ["Comparison attempted"], 
            differences: ["Data unavailable"] 
        });
      } catch (e) {
        setAnalysis({ confidence: 0, explanation: "Comparison unavailable.", similarities: [], differences: [] });
      } finally {
        setLoading(false);
      }
    };
    runAnalysis();
  }, [item1, item2]);

  const score = analysis?.confidence || 0;
  
  // Google Colors Helper
  const getScoreColor = (s: number) => {
      if (s >= 90) return '#34A853'; // Green
      if (s >= 70) return '#4285F4'; // Blue
      if (s >= 50) return '#FBBC05'; // Yellow
      return '#EA4335'; // Red
  };

  const strokeColor = getScoreColor(score);
  const circumference = 2 * Math.PI * 52; // Radius 52
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#050505]/90 backdrop-blur-xl animate-fade-in font-sans">
       
       {/* MAIN CONTAINER */}
       <div className="relative w-full max-w-6xl h-[90vh] sm:h-[800px] flex flex-col md:flex-row rounded-[2.5rem] bg-[#0F0F0F] shadow-2xl overflow-hidden border border-white/10">
          
          {/* GOOGLE GLOW BACKGROUND */}
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#4285F4]/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#34A853]/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen"></div>
          <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-[#EA4335]/10 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
          <div className="absolute bottom-[20%] left-[20%] w-[20%] h-[20%] bg-[#FBBC05]/10 blur-[80px] rounded-full pointer-events-none mix-blend-screen"></div>

          {/* Close Button */}
          <button 
            onClick={onClose} 
            className="absolute top-6 right-6 z-50 p-2.5 bg-black/50 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all backdrop-blur-md border border-white/5"
          >
             <X className="w-5 h-5" />
          </button>

          {loading ? (
             <div className="w-full h-full flex flex-col items-center justify-center relative z-20">
                <div className="relative w-24 h-24 mb-8">
                   <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                   <div className="absolute inset-0 border-t-4 border-[#4285F4] rounded-full animate-spin"></div>
                   <div className="absolute inset-1 border-r-4 border-[#EA4335] rounded-full animate-spin-reverse opacity-70"></div>
                   <div className="absolute inset-2 border-b-4 border-[#FBBC05] rounded-full animate-spin opacity-50"></div>
                   
                   <div className="absolute inset-0 flex items-center justify-center">
                      <BrainCircuit className="w-8 h-8 text-white animate-pulse" />
                   </div>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight mb-2">
                   Gemini Vision <span className="text-[#4285F4]">Processing</span>
                </h2>
                <div className="h-6 overflow-hidden">
                   <p className="text-sm font-medium text-slate-400 animate-slide-up key-{loadingStep}">
                      {loadingStep === 0 && "Analyzing semantic features..."}
                      {loadingStep === 1 && "Comparing visual vectors..."}
                      {loadingStep === 2 && "Validating metadata..."}
                      {loadingStep === 3 && "Calculating match probability..."}
                   </p>
                </div>
             </div>
          ) : (
             <>
                {/* LEFT PANEL: VISUAL & DATA COMPARISON */}
                <div className="w-full md:w-[65%] h-full flex flex-col border-b md:border-b-0 md:border-r border-white/10 bg-[#0F0F0F]/50 relative z-10">
                   
                   {/* Header */}
                   <div className="px-8 py-6 border-b border-white/5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4285F4] to-[#34A853] flex items-center justify-center shadow-lg shadow-[#4285F4]/20">
                         <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                         <h2 className="text-lg font-bold text-white leading-none mb-1">Visual Comparison</h2>
                         <p className="text-xs font-medium text-slate-500">Side-by-side artifact analysis</p>
                      </div>
                   </div>

                   {/* Scrollable Content */}
                   <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      
                      {/* Image Comparison */}
                      <div className="flex gap-4 md:gap-8 mb-8 relative">
                         {[item1, item2].map((item, idx) => (
                            <div key={idx} className="flex-1 flex flex-col gap-3 group">
                               <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl">
                                  <SafeImage src={item.imageUrls[0]} alt={item.title} />
                                  
                                  {/* Badge */}
                                  <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-white/10 text-white shadow-lg ${item.type === 'LOST' ? 'bg-[#EA4335]/80' : 'bg-[#34A853]/80'}`}>
                                     {item.type}
                                  </div>
                               </div>
                               <div className="px-1">
                                  <h3 className="text-sm font-bold text-white line-clamp-1">{item.title}</h3>
                                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{item.description}</p>
                               </div>
                            </div>
                         ))}
                         
                         {/* VS Badge in Center */}
                         <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#1A1A1A] border border-white/20 flex items-center justify-center z-20 shadow-xl">
                            <span className="text-[10px] font-black text-slate-400">VS</span>
                         </div>
                      </div>

                      {/* Data Table */}
                      <div className="bg-[#141414] rounded-2xl border border-white/5 overflow-hidden p-1">
                         <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadata Match</span>
                            <Info className="w-3.5 h-3.5 text-slate-600" />
                         </div>
                         <div className="px-4">
                            <ComparisonRow label="CATEGORY" icon={Tag} val1={item1.category} val2={item2.category} />
                            <ComparisonRow label="TIME" icon={Clock} val1={item1.time} val2={item2.time} />
                            <ComparisonRow label="DATE" icon={Clock} val1={item1.date} val2={item2.date} />
                            <ComparisonRow label="LOCATION" icon={MapPin} val1={item1.location} val2={item2.location} />
                         </div>
                      </div>

                   </div>
                </div>

                {/* RIGHT PANEL: AI VERDICT */}
                <div className="w-full md:w-[35%] h-full flex flex-col bg-[#0A0A0A] relative overflow-hidden z-10">
                   
                   {/* Background Gradient Mesh */}
                   <div className="absolute top-0 right-0 w-full h-[400px] bg-gradient-to-b from-[#4285F4]/5 to-transparent pointer-events-none"></div>

                   <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
                      
                      {/* Score Circle */}
                      <div className="flex flex-col items-center justify-center mb-10 mt-4">
                         <div className="relative w-40 h-40 flex items-center justify-center">
                            {/* SVG Circle */}
                            <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl">
                               <circle
                                 cx="80"
                                 cy="80"
                                 r="52"
                                 stroke="currentColor"
                                 strokeWidth="8"
                                 fill="transparent"
                                 className="text-white/5"
                               />
                               <circle
                                 cx="80"
                                 cy="80"
                                 r="52"
                                 stroke={strokeColor}
                                 strokeWidth="8"
                                 fill="transparent"
                                 strokeDasharray={circumference}
                                 strokeDashoffset={strokeDashoffset}
                                 strokeLinecap="round"
                                 className="transition-all duration-1000 ease-out"
                               />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                               <span className="text-4xl font-black text-white tracking-tighter" style={{ textShadow: `0 0 20px ${strokeColor}60` }}>
                                  {score}%
                               </span>
                               <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">Match</span>
                            </div>
                         </div>
                         
                         <div className="text-center mt-2">
                             <h3 className="text-lg font-bold text-white mb-1" style={{ color: strokeColor }}>
                                {score >= 80 ? 'High Probability' : score >= 50 ? 'Potential Match' : 'Unlikely Match'}
                             </h3>
                             <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                                Based on visual vectors and semantic analysis.
                             </p>
                         </div>
                      </div>

                      {/* AI Explanation Card */}
                      <div className="mb-8 p-5 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group hover:bg-white/10 transition-colors">
                          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#4285F4] via-[#EA4335] to-[#FBBC05]"></div>
                          
                          <div className="flex items-center gap-2 mb-3">
                             <Bot className="w-4 h-4 text-[#4285F4]" />
                             <span className="text-xs font-bold text-white uppercase tracking-widest">Gemini Analysis</span>
                          </div>
                          <p className="text-sm text-slate-300 leading-relaxed font-medium">
                             {analysis?.explanation}
                          </p>
                      </div>

                      {/* Key Features List */}
                      <div className="space-y-6">
                         <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                               <Check className="w-3 h-3 text-[#34A853]" /> Matching Features
                            </h4>
                            <div className="space-y-2">
                               {analysis?.similarities.slice(0, 3).map((sim, i) => (
                                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#34A853]/5 border border-[#34A853]/10">
                                     <div className="w-1.5 h-1.5 rounded-full bg-[#34A853] mt-1.5 shrink-0"></div>
                                     <span className="text-xs text-[#34A853] font-medium leading-snug">{sim}</span>
                                  </div>
                               ))}
                            </div>
                         </div>

                         {analysis?.differences && analysis.differences.length > 0 && (
                            <div>
                               <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                  <AlertTriangle className="w-3 h-3 text-[#EA4335]" /> Discrepancies
                               </h4>
                               <div className="space-y-2">
                                  {analysis.differences.slice(0, 2).map((diff, i) => (
                                     <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#EA4335]/5 border border-[#EA4335]/10">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#EA4335] mt-1.5 shrink-0"></div>
                                        <span className="text-xs text-[#EA4335] font-medium leading-snug">{diff}</span>
                                     </div>
                                  ))}
                               </div>
                            </div>
                         )}
                      </div>

                   </div>

                   {/* Footer Action */}
                   <div className="p-6 border-t border-white/5 bg-[#0A0A0A] relative z-20">
                      <button 
                        onClick={onContact}
                        className="w-full py-4 rounded-xl font-bold text-sm text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden group"
                      >
                         <div className="absolute inset-0 bg-gradient-to-r from-[#4285F4] to-[#34A853] opacity-90 group-hover:opacity-100 transition-opacity"></div>
                         <span className="relative z-10 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" /> Start Conversation
                         </span>
                      </button>
                   </div>
                </div>
             </>
          )}
       </div>
    </div>
  );
};

export default MatchComparator;
