import React from 'react';
import { ArrowLeft, ArrowRight, BrainCircuit, ShieldCheck, Zap, Database, Globe, Eye, Fingerprint, Lock, MessageCircle, ScanFace, Code2, Server, Cloud, Cpu, Sparkles, UserCircle2 } from 'lucide-react';

interface FeaturesPageProps {
  onBack: () => void;
}

const TechCard = ({ icon: Icon, title, desc, color }: { icon: any, title: string, desc: string, color: string }) => (
  <div className="group relative p-6 bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300">
     <div className={`absolute top-0 right-0 p-20 opacity-10 bg-gradient-to-br ${color} blur-[60px] group-hover:opacity-20 transition-opacity`}></div>
     <div className="relative z-10">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
           <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed font-medium">{desc}</p>
     </div>
  </div>
);

const FeatureSection = ({ align, title, subtitle, desc, icon: Icon, color, children }: { align: 'left' | 'right', title: string, subtitle: string, desc: string, icon: any, color: string, children?: React.ReactNode }) => (
  <div className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-20 py-20 ${align === 'right' ? 'lg:flex-row-reverse' : ''}`}>
     <div className="flex-1 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-slate-300">
           <Icon className={`w-4 h-4 ${color}`} />
           <span>{subtitle}</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
           {title}
        </h2>
        <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-xl">
           {desc}
        </p>
        <div className="pt-4">
           {children}
        </div>
     </div>
     <div className="flex-1 w-full">
        <div className="relative aspect-square rounded-[2.5rem] bg-gradient-to-br from-white/5 to-transparent border border-white/10 overflow-hidden shadow-2xl p-8 flex items-center justify-center group">
           <div className={`absolute inset-0 bg-gradient-to-tr ${color} opacity-5 group-hover:opacity-10 transition-opacity duration-500`}></div>
           
           {/* Abstract Visual Representation */}
           <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 border border-white/5 rounded-3xl transform rotate-3 group-hover:rotate-6 transition-transform duration-700"></div>
              <div className="absolute inset-0 border border-white/5 rounded-3xl transform -rotate-3 group-hover:-rotate-6 transition-transform duration-700"></div>
              
              <div className="relative z-10 text-center transform group-hover:scale-105 transition-transform duration-500">
                  <div className={`w-32 h-32 mx-auto rounded-full bg-gradient-to-br ${color.replace('from-', 'from-').replace('to-', 'to-')} flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)] mb-6`}>
                     <Icon className="w-16 h-16 text-white" />
                  </div>
                  <div className="space-y-2">
                     <div className="h-2 w-32 bg-white/10 rounded-full mx-auto"></div>
                     <div className="h-2 w-24 bg-white/10 rounded-full mx-auto"></div>
                     <div className="h-2 w-40 bg-white/10 rounded-full mx-auto"></div>
                  </div>
              </div>
           </div>
        </div>
     </div>
  </div>
);

const FeaturesPage: React.FC<FeaturesPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 overflow-x-hidden selection:bg-indigo-500/30">
       
       {/* Global Background Effects */}
       <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-900/10 rounded-full blur-[120px] animate-pulse-soft"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-purple-900/10 rounded-full blur-[120px] animate-pulse-soft" style={{ animationDelay: '2s' }}></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
       </div>

       <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
          
          {/* Navigation */}
          <nav className="py-6 flex justify-between items-center animate-in slide-in-from-top-4 duration-700">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                   <Zap className="w-6 h-6" />
                </div>
                <span className="font-black text-xl tracking-tight">RETRIVA <span className="text-indigo-500">INSIGHTS</span></span>
             </div>
             <button 
               onClick={onBack}
               className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all font-bold text-xs uppercase tracking-widest text-slate-300 hover:text-white"
             >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to App
             </button>
          </nav>

          {/* Hero Section */}
          <header className="py-20 lg:py-32 text-center max-w-4xl mx-auto space-y-8 animate-in zoom-in-95 duration-700">
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Powered by Gemini 1.5 Pro
             </div>
             
             <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9]">
                The Future of <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 animate-gradient-slow">Asset Recovery.</span>
             </h1>
             
             <p className="text-xl text-slate-400 font-medium leading-relaxed max-w-2xl mx-auto">
                Retriva isn't just a lost and found board. It's an intelligent agent that sees, understands, and connects items across campus using advanced multimodal AI.
             </p>
          </header>

          {/* Tech Stack Grid (Bento) */}
          <section className="mb-32">
             <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Core Architecture</h2>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <TechCard 
                  icon={BrainCircuit}
                  title="Google Gemini AI"
                  desc="The brain of Retriva. Handles image recognition, semantic matching, and safety moderation."
                  color="from-blue-600 to-cyan-600"
                />
                <TechCard 
                  icon={Database}
                  title="Firebase"
                  desc="Real-time NoSQL database ensuring instant chat delivery and live feed updates."
                  color="from-yellow-600 to-orange-600"
                />
                <TechCard 
                  icon={Code2}
                  title="React & Tailwind"
                  desc="Modern, responsive frontend with glassmorphism effects and smooth animations."
                  color="from-indigo-600 to-purple-600"
                />
                <TechCard 
                  icon={Cloud}
                  title="Cloudinary"
                  desc="Optimized media delivery network for fast image loading and transformation."
                  color="from-emerald-600 to-teal-600"
                />
             </div>
          </section>

          {/* Deep Dives */}
          <div className="space-y-12">
             
             {/* Feature 1: Vision AI */}
             <FeatureSection 
               align="left"
               title="It sees what you see."
               subtitle="Multimodal Vision"
               desc="Upload a photo, and our integration with Gemini 1.5 Flash instantly analyzes it. It doesn't just see 'a bottle'. It sees 'a blue Hydroflask with a cat sticker'. This structured data extraction powers our search engine."
               icon={Eye}
               color="from-indigo-500 to-blue-600"
             >
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-indigo-400 font-black text-xl mb-1">0.5s</div>
                      <div className="text-xs text-slate-400 font-bold uppercase">Analysis Speed</div>
                   </div>
                   <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-indigo-400 font-black text-xl mb-1">99%</div>
                      <div className="text-xs text-slate-400 font-bold uppercase">Tag Accuracy</div>
                   </div>
                </div>
             </FeatureSection>

             {/* Feature 2: Match Center */}
             <FeatureSection 
               align="right"
               title="Semantic Matching."
               subtitle="AI Comparator"
               desc="Forget keyword searching. Retriva compares the 'meaning' and 'visual features' of items. Our Match Center calculates a confidence score (0-100%) between two items and explains WHY they match or differ."
               icon={Fingerprint}
               color="from-purple-500 to-pink-600"
             >
                 <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-slate-300 font-medium">
                       <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div> Vector Similarity Search
                    </li>
                    <li className="flex items-center gap-3 text-slate-300 font-medium">
                       <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div> Visual Feature Extraction
                    </li>
                    <li className="flex items-center gap-3 text-slate-300 font-medium">
                       <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div> Temporal & Location logic
                    </li>
                 </ul>
             </FeatureSection>

             {/* Feature 3: Safety */}
             <FeatureSection 
               align="left"
               title="Safe by Design."
               subtitle="Moderation & Privacy"
               desc="Every image uploaded is scanned for policy violations (gore, nudity, spam). Sensitive information on ID cards is automatically flagged. We ensure the platform remains useful and professional."
               icon={ShieldCheck}
               color="from-emerald-500 to-teal-600"
             />

          </div>

          {/* Why Choose Retriva */}
          <section className="mt-32 py-20 border-y border-white/5 relative overflow-hidden">
             <div className="absolute inset-0 bg-indigo-900/5"></div>
             <div className="relative z-10 text-center mb-16">
                <h2 className="text-4xl font-black text-white mb-4">Why Retriva?</h2>
                <p className="text-slate-400 max-w-xl mx-auto">Designed to solve the specific pain points of campus lost and found systems.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                <div className="text-center space-y-4 p-6">
                   <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                      <Zap className="w-8 h-8 text-yellow-400" />
                   </div>
                   <h3 className="text-xl font-bold text-white">Instant</h3>
                   <p className="text-sm text-slate-400 leading-relaxed">No more waiting for admin approval. Post in seconds, match in minutes.</p>
                </div>
                <div className="text-center space-y-4 p-6">
                   <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                      <Lock className="w-8 h-8 text-emerald-400" />
                   </div>
                   <h3 className="text-xl font-bold text-white">Private</h3>
                   <p className="text-sm text-slate-400 leading-relaxed">Chat anonymously. Your phone number is never exposed to strangers.</p>
                </div>
                <div className="text-center space-y-4 p-6">
                   <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                      <Globe className="w-8 h-8 text-indigo-400" />
                   </div>
                   <h3 className="text-xl font-bold text-white">Community</h3>
                   <p className="text-sm text-slate-400 leading-relaxed">A global feed keeps everyone aware of what's happening on campus.</p>
                </div>
             </div>
          </section>

          {/* Team Section */}
          <section className="mt-32 text-center">
             <h2 className="text-4xl font-black text-white mb-16">The Team</h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Team Member 1 */}
                <div className="group relative bg-white/5 border border-white/10 rounded-3xl p-6 hover:-translate-y-2 transition-transform duration-300">
                   <div className="w-24 h-24 mx-auto bg-indigo-500/20 rounded-full mb-4 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                      <UserCircle2 className="w-12 h-12 text-indigo-300 group-hover:text-white" />
                   </div>
                   <h3 className="text-lg font-bold text-white">Member Name</h3>
                   <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">Frontend Engineer</p>
                   <p className="text-sm text-slate-400">Crafting intuitive and responsive user interfaces.</p>
                </div>

                {/* Team Member 2 */}
                <div className="group relative bg-white/5 border border-white/10 rounded-3xl p-6 hover:-translate-y-2 transition-transform duration-300">
                   <div className="w-24 h-24 mx-auto bg-purple-500/20 rounded-full mb-4 flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                      <Code2 className="w-12 h-12 text-purple-300 group-hover:text-white" />
                   </div>
                   <h3 className="text-lg font-bold text-white">Member Name</h3>
                   <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4">AI Specialist</p>
                   <p className="text-sm text-slate-400">Integrating Gemini API for intelligent processing.</p>
                </div>

                {/* Team Member 3 */}
                <div className="group relative bg-white/5 border border-white/10 rounded-3xl p-6 hover:-translate-y-2 transition-transform duration-300">
                   <div className="w-24 h-24 mx-auto bg-emerald-500/20 rounded-full mb-4 flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                      <Server className="w-12 h-12 text-emerald-300 group-hover:text-white" />
                   </div>
                   <h3 className="text-lg font-bold text-white">Member Name</h3>
                   <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Backend Developer</p>
                   <p className="text-sm text-slate-400">Managing Firebase infrastructure and security.</p>
                </div>

                {/* Team Member 4 */}
                <div className="group relative bg-white/5 border border-white/10 rounded-3xl p-6 hover:-translate-y-2 transition-transform duration-300">
                   <div className="w-24 h-24 mx-auto bg-orange-500/20 rounded-full mb-4 flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                      <Cpu className="w-12 h-12 text-orange-300 group-hover:text-white" />
                   </div>
                   <h3 className="text-lg font-bold text-white">Member Name</h3>
                   <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4">Product Designer</p>
                   <p className="text-sm text-slate-400">Ensuring a seamless and aesthetic user experience.</p>
                </div>

             </div>
          </section>

          {/* Bottom CTA */}
          <div className="mt-32 text-center">
             <button 
               onClick={onBack}
               className="inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-full font-black text-lg hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all"
             >
                Start Using Retriva <ArrowRight className="w-5 h-5" />
             </button>
          </div>

       </div>
    </div>
  );
};

export default FeaturesPage;