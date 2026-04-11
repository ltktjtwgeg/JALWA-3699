import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { formatCurrency } from '../lib/utils';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Trophy, History, ShieldCheck, Bell, ChevronRight, RefreshCw } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import { motion } from 'motion/react';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const gameModes = [
    { id: '30s', name: 'WinGo 30s', time: '30 Sec', color: 'from-purple-600 to-blue-500' },
    { id: '1m', name: 'WinGo 1m', time: '1 Min', color: 'from-blue-600 to-cyan-500' },
    { id: '3m', name: 'WinGo 3m', time: '3 Min', color: 'from-emerald-600 to-teal-500' },
    { id: '5m', name: 'WinGo 5m', time: '5 Min', color: 'from-orange-600 to-red-500' },
  ];

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[#1a1d21]">
      {/* Header */}
      <div className="p-6 bg-gradient-to-b from-[#f3d078] to-[#1a1d21]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-xl font-bold shadow-lg overflow-hidden">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} 
                alt="avatar" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2 text-[#5d4037]">
                {user?.username}
                <span className="bg-white/30 text-[#5d4037] text-[10px] px-2 py-0.5 rounded-full border border-white/40 font-bold">
                  VIP {user?.vipLevel}
                </span>
              </h2>
              <p className="text-[10px] text-[#5d4037]/70 font-bold">UID: {user?.inviteCode}</p>
            </div>
          </div>
          <button className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-colors border border-white/40">
            <Bell className="w-5 h-5 text-[#5d4037]" />
          </button>
        </div>

        {/* Wallet Card Removed as requested */}
      </div>

      {/* Announcement */}
      <div className="px-6 mb-6">
        <div className="bg-[#2a2e35]/50 p-3 rounded-xl flex items-center gap-3 border border-gray-800">
          <div className="bg-purple-500/20 p-1.5 rounded-lg">
            <Bell className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs text-gray-300 whitespace-nowrap animate-marquee">
              Welcome to JALWA 369! New VIP rewards are now active. Deposit ₹500 to get VIP 1.
            </p>
          </div>
          <button className="text-[10px] font-bold text-purple-400 bg-purple-400/10 px-2 py-1 rounded-md">
            Detail
          </button>
        </div>
      </div>

      {/* Game Selection */}
      <div className="px-6 space-y-4">
        <h3 className="font-bold text-gray-300 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Popular Games
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {gameModes.map((mode) => (
            <motion.button
              key={mode.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/game/${mode.id}`)}
              className={`bg-gradient-to-br ${mode.color} p-4 rounded-3xl h-32 flex flex-col justify-between shadow-lg shadow-black/20 text-left relative overflow-hidden`}
            >
              <div className="z-10">
                <h4 className="font-bold text-lg">{mode.name}</h4>
                <p className="text-xs opacity-80">{mode.time}</p>
              </div>
              <div className="z-10 flex justify-end">
                <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
              <RefreshCw className="absolute -right-4 -bottom-4 w-20 h-20 opacity-10 rotate-12" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 mt-8 grid grid-cols-2 gap-4">
        <button className="bg-[#2a2e35] p-4 rounded-2xl flex items-center gap-3 border border-gray-800 hover:bg-gray-800 transition-colors">
          <div className="bg-blue-500/20 p-2 rounded-xl">
            <History className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold">Game History</p>
            <p className="text-[10px] text-gray-500">View results</p>
          </div>
        </button>
        <button className="bg-[#2a2e35] p-4 rounded-2xl flex items-center gap-3 border border-gray-800 hover:bg-gray-800 transition-colors">
          <div className="bg-emerald-500/20 p-2 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold">Security</p>
            <p className="text-[10px] text-gray-500">Account safety</p>
          </div>
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
