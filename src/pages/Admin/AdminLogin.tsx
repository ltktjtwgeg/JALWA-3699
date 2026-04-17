import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  ArrowRight, 
  Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return toast.error('Enter username and password');
    
    // In a real app we'd check Firebase or a special admin collection
    // For this prototype, we'll use a specific credential
    if (username === 'admin' && password === 'admin123') {
      onLogin();
      toast.success('Admin access granted');
    } else {
      toast.error('Invalid admin credentials');
    }
  };

  return (
    <div className="min-h-screen bg-[#000] relative overflow-hidden flex items-center justify-center p-4">
      {/* Abstract Plexus Background */}
      <div className="absolute inset-0 opacity-40 select-none pointer-events-none">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" style={{ stopColor: '#4f46e5', stopOpacity: 0.2 }} />
              <stop offset="100%" style={{ stopColor: '#000', stopOpacity: 0 }} />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad1)" />
          {/* Decorative lines and dots representing the plexus */}
          {[...Array(20)].map((_, i) => (
            <React.Fragment key={i}>
              <circle cx={`${Math.random() * 100}%`} cy={`${Math.random() * 100}%`} r="1" fill="#4f46e5" />
              <line 
                x1={`${Math.random() * 100}%`} y1={`${Math.random() * 100}%`} 
                x2={`${Math.random() * 100}%`} y2={`${Math.random() * 100}%`} 
                stroke="#4f46e5" strokeWidth="0.5" opacity="0.2"
              />
            </React.Fragment>
          ))}
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-[#0f172a]/60 backdrop-blur-3xl border border-white/5 rounded-[40px] p-10 shadow-[0_0_50px_rgba(30,58,138,0.5)] overflow-hidden text-center">
          <div className="mb-10">
            <h2 className="text-3xl font-black text-[#60a5fa] mb-3 tracking-tighter uppercase italic">Even Vessis Login</h2>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-relaxed">
              Use your username and password to login
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="myadmin123"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white rounded-xl py-4 pl-4 pr-12 text-black font-bold outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-gray-300"
              />
              <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-500" />
            </div>

            <div className="relative">
              <input 
                type="password" 
                placeholder="........"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white rounded-xl py-4 pl-4 pr-12 text-black font-bold outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-gray-300"
              />
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-500" />
            </div>

            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-sky-600 to-sky-400 py-4 rounded-xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-sky-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <ArrowRight className="w-5 h-5" /> Sign In
            </button>
          </form>

          <div className="mt-8 flex items-center justify-between">
            <button className="text-[10px] text-gray-500 hover:text-white transition-colors">Forgot Password?</button>
            <Send className="w-4 h-4 text-sky-500 cursor-pointer" />
          </div>
        </div>
      </div>
    </div>
  );
}
