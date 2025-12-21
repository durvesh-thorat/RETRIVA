
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ItemReport, ReportType, ItemCategory, User, ViewState } from '../types';
import { Search, MapPin, SearchX, Box, Sparkles, Clock, Calendar, ArrowRight, Fingerprint, RefreshCw, Loader2, ScanLine, History, CheckCircle2, Zap, Cpu, AlertCircle, Radar, ArrowLeftRight } from 'lucide-react';
import ReportDetails from './ReportDetails';
import { parseSearchQuery, findPotentialMatches } from '../services/geminiService';

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

const ReportCard: React.FC<ReportCardProps> = ({ report, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const isLost = report.type === ReportType.LOST;
  const isResolved = report.status === 'RESOLVED';

  return (
    <div 
      onClick={onClick}
      className={`group bg-white dark:bg-slate-900 rounded-[1.5rem] border overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full relative border-slate-200 dark:border-slate-800
        ${isResolved ? 'opacity-75 grayscale-[0.5] hover:opacity-100 hover:grayscale-0' : 
          (isLost ? 'hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/20' : 'hover:border-teal-500/50 hover:shadow-2xl hover:shadow-teal-500/20')
        }
      `}
    >
       <div className="absolute top-3 left-3 z-10 flex gap-2">
          <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-lg text-white backdrop-blur-md ${isLost ? 'bg-orange-500/90' : 'bg-teal-500/90'}`}>
            {isLost ? 'Lost' : 'Found'}
          </span>
          {isResolved && (
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-lg text-white backdrop-blur-md bg-emerald-500/90 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Resolved
            </span>
          )}
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
            <h3 className={`font-bold text-lg text-slate-900 dark:text-white leading-tight line-clamp-2 ${
                isResolved ? 'text-slate-500' : (isLost ? 'group-hover:text-orange-600' : 'group-hover:text-teal-600')
            }`}>
                {report.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mt-auto pt-2">
             <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
             <span className="truncate">{report.location}</span>
          </div>
      </div>

      <div className="px-5 pb-5 pt-0">
         <button className={`w-full py-2.5 rounded-xl bg-off-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs transition-all flex items-center justify-center gap-2
            ${isResolved ? 'hover:bg-slate-200 dark:hover:bg-slate-700' : 
              (isLost ? 'group-hover:bg-orange-600 group-hover:text-white' : 'group-hover:bg-teal-600 group-hover:text-white')
            }
         `}>
            {isResolved ? 'View History' : 'View Details'} <ArrowRight className="w-3.5 h-3.5" />
         </button>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user, reports, onNavigate, onResolve, onEditReport, onDeleteReport, onCompare, onChatStart }) => {
  const [activeTab, setActiveTab] = useState<ReportType>(ReportType.LOST);
  const [viewStatus, setViewStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessingSearch, setIsProcessingSearch] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ItemReport | null>(null);
  
  // AI Match Center State - Optimised
  const [matches, setMatches] = useState<Record<string, ItemReport[]>>({});
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  
  // CACHING KEYS
  const CACHE_SIG_KEY = `retriva_sig_${user.id}`;
  const CACHE_DATA_KEY = `retriva_matches_${user.id}`;

  // AUTOMATIC MATCH SCANNING (Optimized)
  useEffect(() => {
    const scanAll = async () => {
      const myOpenReports = reports.filter(r => r.reporterId === user.id && r.status === 'OPEN');
      
      // If I have no open reports, clear matches & cache
      if (myOpenReports.length === 0) {
          setMatches({});
          localStorage.removeItem(CACHE_SIG_KEY);
          localStorage.removeItem(CACHE_DATA_KEY);
          return;
      }

      // 1. GENERATE DATA SIGNATURE
      // We use the count + ID of the newest report to determine if DB has changed.
      // This is lightweight and avoids scanning on simple page reloads if data is same.
      const newestReportId = reports.length > 0 ? reports[0].id : 'none';
      const currentSignature = `${reports.length}-${newestReportId}-${myOpenReports.length}`;

      const cachedSignature = localStorage.getItem(CACHE_SIG_KEY);
      const cachedMatches = localStorage.getItem(CACHE_DATA_KEY);

      // 2. CHECK CACHE
      if (cachedSignature === currentSignature && cachedMatches) {
         try {
           setMatches(JSON.parse(cachedMatches));
           return; // Skip expensive scan
         } catch (e) {
           console.warn("Cache corrupted, re-scanning");
         }
      }

      // 3. PERFORM SCAN (Only if signature changed)
      setIsAutoScanning(true);
      const newMatches: Record<string, ItemReport[]> = {};
      let foundAny = false;

      // Sequential scan to avoid rate limits
      for (const myItem of myOpenReports) {
          // Look for opposite type (Lost -> Found, Found -> Lost)
          const targetType = myItem.type === ReportType.LOST ? ReportType.FOUND : ReportType.LOST;
          const candidates = reports.filter(r => r.type === targetType && r.status === 'OPEN' && r.reporterId !== user.id);
          
          if (candidates.length > 0) {
               try {
                  const query = `Title: ${myItem.title}. Desc: ${myItem.description}. Loc: ${myItem.location}`;
                  const results = await findPotentialMatches({ description: query, imageUrls: myItem.imageUrls }, candidates);
                  
                  if (results.length > 0) {
                      const matchIds = results.map(r => r.id);
                      newMatches[myItem.id] = candidates.filter(c => matchIds.includes(c.id));
                      foundAny = true;
                  }
               } catch (e) {
                   console.error("Auto scan error for", myItem.title, e);
               }
          }
      }
      
      // 4. UPDATE STATE & CACHE
      setMatches(newMatches);
      localStorage.setItem(CACHE_SIG_KEY, currentSignature);
      localStorage.setItem(CACHE_DATA_KEY, JSON.stringify(newMatches));
      setIsAutoScanning(false);
    };

    // Debounce to allow multiple quick updates (like initial load batching) to settle
    const timer = setTimeout(() => {
       scanAll();
    }, 1000);
    return () => clearTimeout(timer);

  }, [reports, user.id]); // Re-run when reports change

  const filteredReports = useMemo(() => {
    // Filter by Type AND Status
    let result = reports.filter(r => r.type === activeTab && r.status === viewStatus);
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.title.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [reports, activeTab, viewStatus, searchQuery]);

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

  const hasMatches = Object.keys(matches).length > 0;
  const myItemsCount = reports.filter(r => r.reporterId === user.id && r.status === 'OPEN').length;

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
          onViewMatch={(r) => { /* Auto-scan already handles this, but we can scroll to top */ 
             document.getElementById('match-center')?.scrollIntoView({ behavior: 'smooth' });
             setSelectedReport(null);
          }}
        />
      )}

      {/* Hero Section */}
      <section className="relative mb-8">
          {/* Foundation Layer */}
          <div className="relative rounded-[2rem] bg-slate-950 overflow-hidden shadow-2xl border border-white/10 py-8 px-6 lg:py-16 lg:px-20 min-h-[320px] flex items-center group">
              
              {/* Aurora Orbs - Animated */}
              <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[120px] mix-blend-screen pointer-events-none animate-pulse-soft"></div>
              <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] mix-blend-screen pointer-events-none animate-pulse-soft" style={{ animationDelay: '2s' }}></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-600/20 rounded-full blur-[100px] mix-blend-screen pointer-events-none animate-pulse-soft" style={{ animationDelay: '4s' }}></div>
              
              {/* Surface Texture */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
              
              <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className="space-y-6">
                      {/* Badge */}
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-black backdrop-blur-md text-white shadow-sm tracking-widest uppercase">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        AI Verified
                      </div>
                      
                      {/* Title */}
                      <h1 className="font-black tracking-tighter leading-[0.9] text-white" style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)' }}>
                        From Lost <br/>
                        to Retrieved
                      </h1>
                      
                      {/* Description */}
                      <p className="text-slate-400 text-base md:text-lg font-medium max-w-md leading-relaxed">
                        Reconnect with what you’ve lost.
                      </p>

                      {/* NEW FEATURES BUTTON: Under the Hood - UPDATED DESIGN */}
                      <div>
                        <button 
                          onClick={() => onNavigate('FEATURES')}
                          className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/30 transition-all duration-500 shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-1 overflow-hidden backdrop-blur-sm"
                        >
                           {/* Animated Gradient Background on Hover */}
                           <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-gradient-slow"></div>
                           
                           {/* Tech Scan Line */}
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer-fast pointer-events-none"></div>

                           <div className="relative flex items-center gap-3">
                               <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/20 group-hover:bg-indigo-500 text-indigo-400 group-hover:text-white transition-all duration-300">
                                  <Cpu className="w-4 h-4" />
                               </div>
                               <span className="text-slate-300 group-hover:text-white font-bold text-sm tracking-wide transition-colors uppercase">Under the Hood</span>
                               <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                           </div>
                        </button>
                        <p className="mt-2 text-xs text-slate-500 font-medium ml-2">System design and core ideas</p>
                      </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col gap-4 max-w-sm mx-auto w-full lg:ml-auto lg:mr-0">
                     <button 
                       onClick={() => onNavigate('REPORT_LOST')} 
                       className="group relative overflow-hidden p-6 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 shadow-lg transition-all duration-300 flex items-center gap-5 hover:-translate-y-1 hover:shadow-xl hover:border-white/20"
                     >
                       <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <div className="relative z-10 w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <SearchX className="w-6 h-6" />
                       </div>
                       <div className="relative z-10 text-left">
                          <h3 className="font-bold text-lg text-white leading-tight">I Lost Something</h3>
                          <p className="text-xs text-slate-400 group-hover:text-slate-200 font-medium transition-colors">Report a lost item</p>
                       </div>
                       <ArrowRight className="absolute right-6 w-5 h-5 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
                     </button>

                     <button 
                       onClick={() => onNavigate('REPORT_FOUND')} 
                       className="group relative overflow-hidden p-6 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 shadow-lg transition-all duration-300 flex items-center gap-5 hover:-translate-y-1 hover:shadow-xl hover:border-white/20"
                     >
                       <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <div className="relative z-10 w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <Box className="w-6 h-6" />
                       </div>
                       <div className="relative z-10 text-left">
                          <h3 className="font-bold text-lg text-white leading-tight">I Found Something</h3>
                          <p className="text-xs text-slate-400 group-hover:text-slate-200 font-medium transition-colors">Report a found item</p>
                       </div>
                       <ArrowRight className="absolute right-6 w-5 h-5 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
                     </button>
                  </div>
              </div>
          </div>
      </section>

      {/* ALWAYS ACTIVE AI MATCH CENTER - REFINED VISUALS */}
      <div id="match-center" className="animate-fade-in space-y-6 scroll-mt-24 mb-12">
           <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-4">
                <div className="relative">
                   <div className="absolute inset-0 bg-brand-violet/20 rounded-full blur-md animate-pulse"></div>
                   <div className="relative p-2.5 bg-gradient-to-br from-brand-violet to-purple-600 rounded-2xl shadow-xl shadow-brand-violet/20 border border-white/10">
                      <Radar className={`w-6 h-6 text-white ${isAutoScanning ? 'animate-spin' : ''}`} />
                   </div>
                   {isAutoScanning && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span></span>}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Live Intelligence</h2>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2 opacity-80">
                    <span className={`w-1.5 h-1.5 rounded-full ${isAutoScanning ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></span>
                    {isAutoScanning ? 'Analyzing Data Streams...' : `Monitoring ${myItemsCount} Active Reports`}
                  </p>
                </div>
              </div>
              
              {hasMatches && (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/20 border border-emerald-400 transform hover:scale-105 transition-transform cursor-default">
                   <Sparkles className="w-3.5 h-3.5" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Action Required</span>
                </div>
              )}
           </div>

           <div className={`rounded-[2rem] border overflow-hidden transition-all duration-500 relative min-h-[160px] ${hasMatches ? 'bg-slate-50/50 dark:bg-slate-900/40 border-indigo-200/50 dark:border-indigo-900/30 shadow-2xl shadow-indigo-500/5' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
              
              {/* Tech Overlay Effects */}
              {isAutoScanning && (
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-violet to-transparent animate-shimmer-fast z-10 opacity-50"></div>
              )}
              {/* Subtle Vignette Gradient */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none"></div>

              <div className="p-6 sm:p-8 relative z-10">
                 {isAutoScanning && !hasMatches ? (
                    <div className="flex flex-col items-center justify-center py-10">
                       <Loader2 className="w-8 h-8 text-brand-violet animate-spin mb-3" />
                       <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Scanning new reports...</p>
                    </div>
                 ) : hasMatches ? (
                    <div className="space-y-10">
                       {Object.entries(matches).map(([sourceId, matchedItems]) => {
                          const sourceItem = reports.find(r => r.id === sourceId);
                          if (!sourceItem) return null;

                          return (
                             <div key={sourceId} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-4 mb-5 pb-4 border-b border-slate-200/50 dark:border-slate-800/50">
                                   <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                       <ScanLine className="w-4 h-4" />
                                   </div>
                                   <div>
                                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Source</div>
                                       <div className="text-sm font-bold text-slate-900 dark:text-white">{sourceItem.title}</div>
                                   </div>
                                </div>
                                
                                {/* Concise Grid Layout */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                   {matchedItems.map(match => (
                                      <div 
                                        key={match.id} 
                                        onClick={() => onCompare(sourceItem, match)} 
                                        className="group relative bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 hover:border-brand-violet/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] transition-all duration-300 cursor-pointer overflow-hidden"
                                      >
                                         {/* Hover Gradient */}
                                         <div className="absolute inset-0 bg-gradient-to-br from-brand-violet/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                                         <div className="flex gap-4 relative z-10">
                                            {/* Compare Visual */}
                                            <div className="relative h-20 w-32 shrink-0">
                                                {/* Source Item (Tiny, blurred background effect) */}
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm z-10 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                                    {sourceItem.imageUrls[0] ? <img src={sourceItem.imageUrls[0]} className="w-full h-full object-cover" /> : <Box className="w-4 h-4 m-auto text-slate-400" />}
                                                </div>
                                                
                                                {/* Target Item (Main focus) */}
                                                <div className="absolute right-0 top-0 w-20 h-20 rounded-xl bg-slate-200 dark:bg-slate-900 overflow-hidden shadow-md group-hover:scale-105 transition-transform duration-500 z-20 ring-1 ring-black/5 dark:ring-white/5">
                                                    {match.imageUrls[0] ? <img src={match.imageUrls[0]} className="w-full h-full object-cover" /> : <Box className="w-6 h-6 m-auto text-slate-400" />}
                                                </div>

                                                {/* Connector Line */}
                                                <div className="absolute left-10 top-1/2 w-10 h-[2px] bg-brand-violet/20 group-hover:bg-brand-violet/50 z-0"></div>
                                            </div>
                                            
                                            {/* Info */}
                                            <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                                                <div>
                                                   <div className="flex justify-between items-start mb-1">
                                                      <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate pr-2 group-hover:text-brand-violet transition-colors">{match.title}</h4>
                                                      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                                         Match
                                                      </span>
                                                   </div>
                                                   <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                                      <MapPin className="w-3 h-3" /> {match.location}
                                                   </div>
                                                </div>

                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 group-hover:text-brand-violet transition-colors mt-2">
                                                   Compare Details <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                                                </div>
                                            </div>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          );
                       })}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                       {myItemsCount > 0 ? (
                          <>
                             <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-slate-400" />
                             </div>
                             <h3 className="text-base font-bold text-slate-900 dark:text-white">All Clear</h3>
                             <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">
                                No matching items found in the database yet. We'll alert you automatically when something appears.
                             </p>
                          </>
                       ) : (
                          <>
                             <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="w-8 h-8 text-slate-400" />
                             </div>
                             <h3 className="text-base font-bold text-slate-900 dark:text-white">Match Center Inactive</h3>
                             <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1 mb-4">
                                Report a lost or found item to activate the AI matching engine.
                             </p>
                             <button onClick={() => onNavigate('REPORT_LOST')} className="text-xs font-bold text-brand-violet hover:underline">
                                Create a Report
                             </button>
                          </>
                       )}
                    </div>
                 )}
              </div>
           </div>
      </div>

      {/* Main Content Feed */}
      <section className="space-y-6">
         <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-4">
            
            {/* Filter Group */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex p-1 bg-off-white dark:bg-slate-800 rounded-xl shrink-0">
                   <button onClick={() => setActiveTab(ReportType.LOST)} className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === ReportType.LOST ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' : 'text-slate-500'}`}>Lost</button>
                   <button onClick={() => setActiveTab(ReportType.FOUND)} className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === ReportType.FOUND ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-sm' : 'text-slate-500'}`}>Found</button>
                </div>
                
                {/* View History Toggle */}
                <button 
                  onClick={() => setViewStatus(prev => prev === 'OPEN' ? 'RESOLVED' : 'OPEN')}
                  className={`p-2.5 rounded-xl border transition-all ${viewStatus === 'RESOLVED' 
                    ? 'bg-indigo-50 dark:bg-slate-800 border-indigo-200 dark:border-slate-700 text-indigo-600' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600'
                  }`}
                  title={viewStatus === 'OPEN' ? "Show Resolved History" : "Show Active Reports"}
                >
                   <History className="w-5 h-5" />
                </button>
            </div>

            <div className="relative flex-1 w-full">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()} placeholder="Describe what you are looking for..." className="w-full pl-10 pr-4 py-3 bg-off-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-brand-violet/20 transition-all" />
               {isProcessingSearch && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-violet" />}
            </div>
         </div>

         {/* Section Title for Context */}
         <div className="flex items-center gap-2 px-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {viewStatus === 'RESOLVED' ? 'Resolved Archive' : 'Active Listings'}
            </h3>
            <span className="text-xs text-slate-500">({filteredReports.length} items)</span>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredReports.map(report => <ReportCard key={report.id} report={report} onClick={() => setSelectedReport(report)} />)}
            {filteredReports.length === 0 && (
               <div className="col-span-full py-20 text-center flex flex-col items-center justify-center text-slate-400">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                     {viewStatus === 'RESOLVED' ? <History className="w-8 h-8 opacity-50" /> : <SearchX className="w-8 h-8 opacity-50" />}
                  </div>
                  <p className="font-bold">No {viewStatus === 'RESOLVED' ? 'resolved' : 'active'} items found.</p>
                  <p className="text-xs mt-1">Try changing the category or search terms.</p>
               </div>
            )}
         </div>
      </section>
    </div>
  );
};

export default Dashboard;