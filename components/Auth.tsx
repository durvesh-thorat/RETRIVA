
import React, { useState } from 'react';
import { User } from '../types';
import { Loader2, ArrowRight, Eye, EyeOff, AlertCircle, Mail, Lock, User as UserIcon, Sparkles, Zap, ShieldCheck, BrainCircuit, Search, MessageSquare, LockKeyhole, HelpCircle, FileText, Shield } from 'lucide-react';
import { auth, db } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          onLogin(userDoc.data() as User);
        } else {
          // Auto-heal
          const fallbackUser: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            studentId: '',
            isVerified: false,
            avatar: ''
          };
          await setDoc(userDocRef, fallbackUser);
          onLogin(fallbackUser);
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        await updateProfile(firebaseUser, { displayName: name });
        const newUser: User = {
          id: firebaseUser.uid,
          name: name, 
          email: email,
          studentId: '2025-' + Math.floor(1000 + Math.random() * 9000), 
          isVerified: false,
          avatar: ''
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
        onLogin(newUser);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Incorrect email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email already registered.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password too weak (min 6 chars).');
      } else {
        setError(err.message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-12 font-sans relative overflow-hidden bg-black">
      
      {/* RICH CHANGING DARK GRADIENT BACKGROUND (Outer) - Darker & Subtler */}
      <div 
        className="absolute inset-0 animate-gradient-slow opacity-80"
        style={{
          background: 'linear-gradient(135deg, #000000 0%, #020617 25%, #0f172a 50%, #1e1b4b 75%, #000000 100%)',
          backgroundSize: '400% 400%',
        }}
      ></div>
      
      {/* Subtle Texture */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>

      {/* Decorative Orbs - Darker */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-950/10 rounded-full blur-[150px] animate-pulse-soft"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-blue-950/10 rounded-full blur-[150px] animate-pulse-soft" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* FLOATING CARD CONTAINER */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row bg-[#080808] rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden ring-1 ring-white/5 min-h-[650px]">
        
        {/* LEFT PANEL - DARKER Side (Deep Black/Indigo) */}
        <div className="lg:w-5/12 relative p-10 lg:p-12 flex flex-col justify-between bg-black overflow-hidden shrink-0 text-white border-b lg:border-b-0 lg:border-r border-white/5">
           
           {/* Deep Dark Gradient Overlay - Darker than button */}
           <div className="absolute inset-0 bg-gradient-to-b from-black via-[#050508] to-[#0a0a12] pointer-events-none"></div>
           
           {/* Subtle highlight */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-900/10 rounded-full blur-[80px] pointer-events-none"></div>

           {/* Content */}
           <div className="relative z-10 flex flex-col h-full">
              {/* Logo Area - REVERTED TO PIN LOGO */}
              <div className="mb-10">
                <div className="w-20 h-20 mb-6 filter drop-shadow-xl">
                   <svg viewBox="0 0 200 200" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="pinGradientAuth" x1="100" y1="25" x2="100" y2="190" gradientUnits="userSpaceOnUse">
                          <stop offset="0" stopColor="#ffffff" />
                          <stop offset="1" stopColor="#e0e7ff" />
                        </linearGradient>
                      </defs>
                      <g opacity="0.5">
                        <circle cx="100" cy="100" r="85" stroke="url(#pinGradientAuth)" strokeWidth="2" strokeDasharray="10 10" strokeLinecap="round" className="animate-[spin_20s_linear_infinite]" />
                        <circle cx="100" cy="100" r="70" stroke="url(#pinGradientAuth)" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" className="animate-[spin_15s_linear_infinite_reverse]" />
                      </g>
                      <ellipse cx="100" cy="190" rx="20" ry="6" fill="#000000" opacity="0.3" />
                      <path fillRule="evenodd" clipRule="evenodd" d="M100 25 C60 25 25 60 25 100 C25 140 90 185 100 190 C110 185 175 140 175 100 C175 60 140 25 100 25 Z" fill="url(#pinGradientAuth)" />
                      <circle cx="100" cy="100" r="42" fill="#4f46e5" />
                      <g transform="translate(100 100)">
                        <path d="M0 -24 V24 M-24 0 H24" stroke="white" strokeWidth="6" strokeLinecap="round" />
                        <path d="M-16 -16 L16 16 M16 -16 L-16 16" stroke="white" strokeWidth="6" strokeLinecap="round" />
                        <circle r="7" fill="white" />
                        <circle cx="0" cy="-30" r="4" fill="white" />
                        <circle cx="0" cy="30" r="4" fill="white" />
                        <circle cx="-30" cy="0" r="4" fill="white" />
                        <circle cx="30" cy="0" r="4" fill="white" />
                      </g>
                   </svg>
                </div>
                
                <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4 leading-tight bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
                  RETRIVA
                </h1>
                <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm">
                  The smart way to find what you've lost on campus.
                </p>
              </div>
              
              <div className="h-px bg-white/5 w-full mb-8"></div>

              {/* Rich Features List */}
              <div className="space-y-6 flex-1">
                 <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all duration-300">
                      <BrainCircuit className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                       <h3 className="font-bold text-slate-200 text-sm mb-0.5">Gemini Vision AI</h3>
                       <p className="text-[11px] text-slate-500 leading-relaxed">
                         Upload a photo and let our AI handle the description and tagging automatically.
                       </p>
                    </div>
                 </div>

                 <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all duration-300">
                      <Search className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                       <h3 className="font-bold text-slate-200 text-sm mb-0.5">Real-time Matching</h3>
                       <p className="text-[11px] text-slate-500 leading-relaxed">
                         Get notified instantly when a matching item is reported in the system.
                       </p>
                    </div>
                 </div>

                 <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-purple-500/10 group-hover:border-purple-500/20 transition-all duration-300">
                      <ShieldCheck className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                       <h3 className="font-bold text-slate-200 text-sm mb-0.5">Verified Students</h3>
                       <p className="text-[11px] text-slate-500 leading-relaxed">
                         A secure environment exclusively for verified campus students and staff.
                       </p>
                    </div>
                 </div>
              </div>

              {/* Footer Stats */}
              <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                 <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                       <span className="w-1 h-3 bg-indigo-900 rounded-full animate-pulse"></span>
                       <span className="w-1 h-4 bg-indigo-700 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></span>
                       <span className="w-1 h-2 bg-indigo-900 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                    Live Network
                 </div>
                 <span>© 2025</span>
              </div>

           </div>
        </div>

        {/* RIGHT PANEL - Form (Slightly Lighter Dark) */}
        <div className="lg:w-7/12 w-full flex flex-col p-8 lg:p-12 relative bg-[#0c0e14]">
           
           {/* Context Header */}
           <div className="flex justify-between items-center mb-8 sm:mb-12">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                 <LockKeyhole className="w-3 h-3 text-emerald-500" />
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Secure Campus Login</span>
              </div>
              <div className="hidden sm:flex gap-4 text-[11px] font-bold text-slate-500">
                 <button className="hover:text-white transition-colors">Help</button>
                 <button className="hover:text-white transition-colors">Privacy</button>
              </div>
           </div>

           <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto relative z-10">
              <div className="mb-8">
                 <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
                    {isLogin ? 'Welcome back' : 'Join Retriva'}
                 </h2>
                 <p className="text-slate-400 text-sm font-medium">
                    {isLogin ? 'Enter your student credentials to access.' : 'Create your account to start reporting.'}
                 </p>
              </div>

              {error && (
                 <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-red-400 leading-snug">{error}</p>
                 </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                 {!isLogin && (
                    <div className="group animate-in slide-in-from-bottom-2 fade-in">
                       <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-4">Full Name</label>
                       <div className="relative">
                          <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-500 transition-colors duration-300" />
                          <input 
                             type="text" 
                             value={name}
                             onChange={(e) => setName(e.target.value)}
                             className="w-full pl-12 pr-6 py-4 bg-[#14161f] border border-slate-800 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all duration-300 placeholder:text-slate-600 text-sm"
                             placeholder="John Doe"
                             required
                          />
                       </div>
                    </div>
                 )}

                 <div className="group">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-4">Student Email</label>
                    <div className="relative">
                       <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-500 transition-colors duration-300" />
                       <input 
                          type="email" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-12 pr-6 py-4 bg-[#14161f] border border-slate-800 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all duration-300 placeholder:text-slate-600 text-sm"
                          placeholder="student@university.edu"
                          required
                       />
                    </div>
                 </div>

                 <div className="group">
                    <div className="flex justify-between items-center mb-2 ml-4 mr-1">
                       <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
                       {isLogin && <button type="button" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Forgot?</button>}
                    </div>
                    <div className="relative">
                       <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-500 transition-colors duration-300" />
                       <input 
                          type={showPassword ? "text" : "password"} 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-12 pr-14 py-4 bg-[#14161f] border border-slate-800 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all duration-300 placeholder:text-slate-600 text-sm"
                          placeholder="••••••••"
                          required
                       />
                       <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-6 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-indigo-500 transition-colors"
                       >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </button>
                    </div>
                 </div>

                 <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full mt-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:opacity-70 disabled:transform-none flex items-center justify-center gap-2 group"
                 >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                       <>
                          {isLogin ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                       </>
                    )}
                 </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-800/50 text-center">
                 <p className="text-slate-400 text-xs font-medium">
                    {isLogin ? "New to Retriva?" : "Already have an account?"}
                    <button 
                      onClick={() => { setIsLogin(!isLogin); setError(null); }}
                      className="ml-2 text-indigo-400 font-bold hover:text-indigo-300 transition-colors hover:underline"
                    >
                       {isLogin ? 'Create Account' : 'Sign In'}
                    </button>
                 </p>
              </div>
           </div>

           {/* Mobile Footer Links (Visible only on small screens) */}
           <div className="mt-8 sm:hidden flex justify-center gap-6 text-[10px] font-bold text-slate-600 border-t border-slate-800/50 pt-6">
              <button>Terms</button>
              <button>Privacy</button>
              <button>Help</button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
