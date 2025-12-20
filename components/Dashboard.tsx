
import React, { useState, useMemo, useEffect } from 'react';
import { ItemReport, ReportType, ItemCategory, User, ViewState } from '../types';
import { Search, MapPin, SearchX, Box, Sparkles, Clock, Calendar, ArrowRight, Fingerprint, RefreshCw, Loader2, ScanLine } from 'lucide-react';
import ReportDetails from './ReportDetails';
import { parseSearchQuery } from '../services/geminiService';

interface DashboardProps {
  user: User;
  reports: ItemReport[];
  onNavigate: (view: ViewState) => void;
  onResolve: (id: string) => void;
  onEditReport: (report: ItemReport) => void;
  onDeleteReport: (id: string) => void;
  onCompare: (item1: ItemReport, item2: ItemReport) => void;
  onChatStart: (report: ItemReport) => void;
}

interface ReportCardProps {
  report: ItemReport;
  onClick: () => void;
}

// Improved Heuristic Logic to fix "MacBook vs Headphones" issue
const calculateMatchScore = (item1: ItemReport, item2: ItemReport): number => {
  if (item1.id === item2.id || item1.type === item2.type) return 0;
  
  // STRICT CATEGORY MATCHING
  // A "Phone" (Electronics) cannot match a "Bottle" (Accessories)
  if (item1.category !== item2.category) {
    return 0; 
  }

  let score = 0;

  // Keyword Extraction & Overlap
  // Clean strings: lowercase, remove punctuation
  const clean = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '');
  const text1 = clean(`${item1.title} ${item1.tags.join(' ')}`);
  const text2 = clean(`${item2.title} ${item2.tags.join(' ')}`);

  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3)); // Filter short words
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));

  let intersectionCount = 0;
  words1.forEach(w => {
    if (words2.has(w)) intersectionCount++;
  });

  // Base score on keyword overlap
  if (intersectionCount > 0) {
    score += 40 + (intersectionCount * 15);
  }

  // Location Proximity (Simple string check)
  if (clean(item1.location).includes(clean(item2.location)) || clean(item2.location).includes(clean(item1.location))) {
    score += 20;
  }

  return score;
};

const ReportCard: React.FC<ReportCardProps> = ({ report, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const isLost = report.type === ReportType.LOST;

  return (
    <div 
      onClick={onClick}
      className={`group bg-white dark:bg-slate-900 rounded-[1.5rem] border overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full relative border-slate-200 dark:border-slate-800
        ${isLost ? 'hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/20' : 'hover:border-teal-500/50 hover:shadow-2xl hover:shadow-teal-500/20'}
      `}
    >
       <div className="absolute top-3 left-3 z-10">
          <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-lg text-white backdrop-blur-md ${isLost ? 'bg-orange-500/90' : 'bg-teal-500/90'}`}>
            {isLost ? 'Lost' : 'Found'}
          </span>
       </div>

      <div className="h-52 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
          {!imgError && report.imageUrls[0] ? (
            <img src={report.imageUrls[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" onError={() => setImgError(true)} alt={report.title} loading="lazy" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/50">
              <Box className="w-12 h-12 mb-3 opacity-20" />
            </div>
          )}
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4">
          <div>
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{report.category}</span>
                <span className="text-[10px] font-medium text-slate-400">{report.date}</span>
            </div>
            <h3 className={`font-bold text-lg text-slate-900 dark:text-white leading-tight line-clamp-2 ${isLost ? 'group-hover:text-orange-600' : 'group-hover:text-teal-600'}`}>
                {report.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mt-auto pt-2">
             <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
             <span className="truncate">{report.location}</span>
          </div>
      </div>

      <div className="px-5 pb-5 pt-0">
         <button className={`w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs transition-all flex items-center justify-center gap-2
            ${isLost ? 'group-hover:bg-orange-600 group-hover:text-white' : 'group-hover:bg-teal-600 group-hover:text-white'}
         `}>
            View Details <ArrowRight className="w-3.5 h-3.5" />
         </button>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user, reports, onNavigate, onResolve, onEditReport, onDeleteReport, onCompare, onChatStart }) => {
  const [activeTab, setActiveTab] = useState<ReportType>(ReportType.LOST);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessingSearch, setIsProcessingSearch] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ItemReport | null>(null);
  const [selectedMatchSourceId, setSelectedMatchSourceId] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    let result = reports.filter(r => r.type === activeTab && r.status === 'OPEN');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.title.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [reports, activeTab, searchQuery]);

  const myActiveReports = useMemo(() => reports.filter(r => r.reporterId === user.id && r.status === 'OPEN'), [reports, user.id]);
  
  const potentialMatches = useMemo(() => {
    if (myActiveReports.length === 0) return [];
    return myActiveReports.map(sourceItem => {
      // Logic Fix: Only show matches with reasonable score (> 40)
      const matches = reports.filter(r => r.type !== sourceItem.type && r.status === 'OPEN' && calculateMatchScore(sourceItem, r) > 40);
      return matches.length > 0 ? { source: sourceItem, matches } : null;
    }).filter(g => g !== null) as { source: ItemReport, matches: ItemReport[] }[];
  }, [myActiveReports, reports]);

  useEffect(() => {
    if (potentialMatches.length > 0 && !selectedMatchSourceId) {
      setSelectedMatchSourceId(potentialMatches[0].source.id);
    }
  }, [potentialMatches, selectedMatchSourceId]);

  const activeMatchGroup = potentialMatches.find(g => g.source.id === selectedMatchSourceId) || potentialMatches[0];

  const handleSmartSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsProcessingSearch(true);
    try {
      const { userStatus, refinedQuery } = await parseSearchQuery(searchQuery);
      if (userStatus === 'LOST') setActiveTab(ReportType.FOUND);
      else if (userStatus === 'FOUND') setActiveTab(ReportType.LOST);
      setSearchQuery(refinedQuery);
    } finally {
      setIsProcessingSearch(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {selectedReport && (
        <ReportDetails 
          report={selectedReport} allReports={reports} currentUser={user} 
          onClose={() => setSelectedReport(null)}
          onResolve={(id) => { onResolve(id); setSelectedReport(null); }}
          onEdit={(r) => { onEditReport(r); setSelectedReport(null); }}
          onDelete={(id) => { onDeleteReport(id); setSelectedReport(null); }}
          onNavigateToChat={(report) => { onChatStart(report); setSelectedReport(null); }}
          onViewMatch={(r, m) => { setSelectedMatchSourceId(r.id); setSelectedReport(null); }}
        />
      )}

      {/* Hero Section - UPDATED LAYOUT */}
      <section className="relative mb-12">
          <div className="relative rounded-[2.5rem] bg-brand-violet dark:bg-[#4f4dbd] overflow-hidden shadow-2xl shadow-brand-violet/20 py-8 px-6 lg:py-16 lg:px-20 min-h-[320px] flex items-center">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4"></div>
              
              <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/10 text-[10px] font-black backdrop-blur-md text-white shadow-sm tracking-widest uppercase">
                        <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                        AI Verified
                      </div>
                      <h1 className="font-black tracking-tighter leading-[0.9] text-white" style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)' }}>
                        Campus <br/>
                        Lost & Found.
                      </h1>
                      <p className="text-indigo-50 text-base md:text-lg font-medium opacity-90 max-w-md">
                        Find your items instantly with Retriva's smart matching engine.
                      </p>
                  </div>

                  {/* Right Column: Stacked Action Buttons (Moved from bottom) */}
                  <div className="flex flex-col gap-4 max-w-sm mx-auto w-full lg:ml-auto lg:mr-0">
                     <button 
                       onClick={() => onNavigate('REPORT_LOST')} 
                       className="group relative overflow-hidden p-6 rounded-2xl bg-indigo-950/40 hover:bg-indigo-950/60 backdrop-blur-xl border border-white/10 shadow-lg transition-all duration-300 flex items-center gap-5 hover:-translate-y-1 hover:shadow-xl"
                     >
                       {/* Simplistic Background Design - Circles matching violet tone */}
                       <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border-4 border-white/5 group-hover:border-white/10 transition-colors"></div>
                       <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full border-4 border-white/5 group-hover:border-white/10 transition-colors"></div>

                       <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <div className="relative z-10 w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <SearchX className="w-6 h-6" />
                       </div>
                       <div className="relative z-10 text-left">
                          <h3 className="font-bold text-lg text-white leading-tight">I Lost Something</h3>
                          <p className="text-xs text-indigo-100 font-medium">Create a report for lost items</p>
                       </div>
                       <ArrowRight className="absolute right-6 w-5 h-5 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
                     </button>

                     <button 
                       onClick={() => onNavigate('REPORT_FOUND')} 
                       className="group relative overflow-hidden p-6 rounded-2xl bg-indigo-950/40 hover:bg-indigo-950/60 backdrop-blur-xl border border-white/10 shadow-lg transition-all duration-300 flex items-center gap-5 hover:-translate-y-1 hover:shadow-xl"
                     >
                       {/* Simplistic Background Design - Circles matching violet tone */}
                       <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border-4 border-white/5 group-hover:border-white/10 transition-colors"></div>
                       <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full border-4 border-white/5 group-hover:border-white/10 transition-colors"></div>

                       <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <div className="relative z-10 w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <Box className="w-6 h-6" />
                       </div>
                       <div className="relative z-10 text-left">
                          <h3 className="font-bold text-lg text-white leading-tight">I Found Something</h3>
                          <p className="text-xs text-indigo-100 font-medium">Report an item you found</p>
                       </div>
                       <ArrowRight className="absolute right-6 w-5 h-5 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
                     </button>
                  </div>
              </div>
          </div>
      </section>

      {/* AI Match Center */}
      {potentialMatches.length > 0 && activeMatchGroup && (
        <div id="match-center" className="animate-fade-in space-y-5 scroll-mt-24 rounded-[2.5rem]">
           <div className="flex items-center gap-3 px-2">
              <div className="p-2 bg-brand-violet rounded-lg shadow-lg shadow-brand-violet/20 animate-pulse-soft">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Match Center</h2>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                  Scanning matches for: <span className="text-brand-violet">{activeMatchGroup.source.title}</span>
                </p>
              </div>
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col lg:flex-row">
              <aside className="lg:w-72 bg-slate-50/50 dark:bg-slate-950/50 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-3">
                 {potentialMatches.map((group) => (
                    <button key={group.source.id} onClick={() => setSelectedMatchSourceId(group.source.id)} className={`p-3 rounded-2xl border transition-all flex items-center gap-3 w-full ${selectedMatchSourceId === group.source.id ? 'bg-white dark:bg-slate-800 border-brand-violet shadow-lg shadow-brand-violet/10 scale-[1.02]' : 'bg-white dark:bg-slate-800 border-transparent opacity-60'}`}>
                       <p className="font-bold text-xs truncate text-slate-900 dark:text-white">{group.source.title}</p>
                    </button>
                 ))}
              </aside>
              <div className="flex-1 p-6 bg-white dark:bg-slate-900">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {activeMatchGroup.matches.map(match => (
                        <div key={match.id} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-brand-violet/50 hover:shadow-2xl transition-all cursor-pointer overflow-hidden flex flex-col h-48" onClick={() => onCompare(activeMatchGroup.source, match)}>
                            <div className="h-28 bg-slate-100 dark:bg-slate-900 relative">
                                {match.imageUrls[0] && <img src={match.imageUrls[0]} className="w-full h-full object-cover" />}
                                <div className="absolute inset-0 bg-brand-violet/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                   <ScanLine className="w-8 h-8 text-white animate-pulse" />
                                </div>
                            </div>
                            <div className="p-3">
                                <h4 className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1 mb-1">{match.title}</h4>
                                <button className="w-full py-1.5 bg-slate-100 dark:bg-slate-700/50 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 rounded-lg group-hover:bg-brand-violet group-hover:text-white transition-colors">Compare</button>
                            </div>
                        </div>
                      ))}
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* Main Content Feed */}
      <section className="space-y-6">
         <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
               <button onClick={() => setActiveTab(ReportType.LOST)} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === ReportType.LOST ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' : 'text-slate-500'}`}>Lost</button>
               <button onClick={() => setActiveTab(ReportType.FOUND)} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === ReportType.FOUND ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-sm' : 'text-slate-500'}`}>Found</button>
            </div>
            <div className="relative flex-1">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()} placeholder="Describe what you are looking for..." className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-brand-violet/20 transition-all" />
               {isProcessingSearch && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-violet" />}
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredReports.map(report => <ReportCard key={report.id} report={report} onClick={() => setSelectedReport(report)} />)}
         </div>
      </section>
    </div>
  );
};

export default Dashboard;
