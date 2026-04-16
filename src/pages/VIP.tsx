import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { 
  ChevronLeft, 
  Trophy, 
  Star, 
  Crown, 
  Gift, 
  Zap, 
  Info,
  ChevronRight,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';

export default function VIP() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);

  const vipLevels = [
    { level: 1, exp: 0, reward: 10, rebate: 0.6, color: 'from-gray-400 to-gray-600' },
    { level: 2, exp: 1000, reward: 50, rebate: 0.7, color: 'from-blue-400 to-blue-600' },
    { level: 3, exp: 5000, reward: 200, rebate: 0.8, color: 'from-emerald-400 to-emerald-600' },
    { level: 4, exp: 20000, reward: 1000, rebate: 0.9, color: 'from-purple-400 to-purple-600' },
    { level: 5, exp: 100000, reward: 5000, rebate: 1.0, color: 'from-amber-400 to-amber-600' },
    { level: 6, exp: 500000, reward: 20000, rebate: 1.2, color: 'from-rose-400 to-rose-600' },
  ];

  const currentVip = user?.vipLevel || 0;
  const nextVip = vipLevels.find(v => v.level > currentVip) || vipLevels[vipLevels.length - 1];
  const progress = Math.min(100, (user?.totalBets || 0) / nextVip.exp * 100);

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white pb-10">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="font-bold text-lg">VIP Level</h2>
        </div>
        <button 
          onClick={() => setShowRules(true)}
          className="p-2 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
        >
          <Info className="w-5 h-5 text-purple-400" />
        </button>
      </div>

      {/* VIP Status Card */}
      <div className="p-6">
        <div className="relative bg-gradient-to-br from-[#2a2e35] to-[#1a1d21] rounded-[32px] p-8 overflow-hidden border border-gray-800 shadow-2xl">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 p-1 shadow-lg shadow-orange-500/20">
                <div className="w-full h-full rounded-full bg-[#1a1d21] flex items-center justify-center">
                  <Crown className="w-10 h-10 text-yellow-500" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">VIP {currentVip}</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Current Status</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-gray-400">Exp: {user?.totalBets || 0} / {nextVip.exp}</span>
                <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Next: VIP {nextVip.level}</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700 p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-600 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                />
              </div>
              <p className="text-[10px] text-gray-500 text-center">Bet {formatCurrency(nextVip.exp - (user?.totalBets || 0))} more to reach VIP {nextVip.level}</p>
            </div>
          </div>
          
          {/* Decorative background elements */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-yellow-500/5 rounded-full blur-3xl" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
      </div>

      {/* Rewards Grid */}
      <div className="px-6 grid grid-cols-2 gap-4 mb-8">
        <div className="bg-[#1f2228] p-5 rounded-3xl border border-gray-800 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
            <Gift className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Level Reward</p>
            <p className="text-lg font-black text-white">₹{vipLevels[currentVip]?.reward || 0}</p>
          </div>
        </div>
        <div className="bg-[#1f2228] p-5 rounded-3xl border border-gray-800 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Rebate Ratio</p>
            <p className="text-lg font-black text-white">{vipLevels[currentVip]?.rebate || 0.6}%</p>
          </div>
        </div>
      </div>

      {/* VIP Levels List */}
      <div className="px-6 space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 px-2">VIP Privileges</h3>
        {vipLevels.map((vip) => (
          <div 
            key={vip.level}
            className={cn(
              "relative overflow-hidden rounded-[24px] border transition-all",
              currentVip >= vip.level 
                ? "bg-[#1f2228] border-gray-800" 
                : "bg-[#1a1d21] border-gray-800/50 opacity-60"
            )}
          >
            <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b", vip.color)} />
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                  currentVip >= vip.level ? "bg-gray-800" : "bg-gray-900"
                )}>
                  <Star className={cn("w-6 h-6", currentVip >= vip.level ? "text-yellow-500" : "text-gray-700")} />
                </div>
                <div>
                  <h4 className="font-black italic text-lg uppercase tracking-tighter">VIP {vip.level}</h4>
                  <p className="text-[10px] text-gray-500 font-bold">Exp: {vip.exp}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <Gift className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs font-bold">₹{vip.reward}</span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Zap className="w-3 h-3 text-blue-500" />
                  <span className="text-xs font-bold">{vip.rebate}%</span>
                </div>
              </div>
            </div>
            {currentVip < vip.level && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                <Lock className="w-5 h-5 text-white/20" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-[360px] bg-[#1f2228] rounded-[32px] overflow-hidden border border-gray-800 shadow-2xl"
            >
              <div className="bg-gradient-to-r from-yellow-500 to-orange-600 p-6 text-center">
                <h3 className="text-white font-black uppercase tracking-widest">VIP Rules</h3>
              </div>
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <section>
                  <h4 className="text-yellow-500 font-bold mb-2 flex items-center gap-2">
                    <Star className="w-4 h-4" /> VIP Upgrade
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    VIP level is based on your total betting amount. Once you reach the required experience (EXP), your VIP level will be upgraded automatically.
                  </p>
                </section>
                <section>
                  <h4 className="text-yellow-500 font-bold mb-2 flex items-center gap-2">
                    <Gift className="w-4 h-4" /> Level Rewards
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Every time you upgrade to a new VIP level, you will receive a one-time level-up bonus. The higher the level, the bigger the reward!
                  </p>
                </section>
                <section>
                  <h4 className="text-yellow-500 font-bold mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Rebate Ratio
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Higher VIP levels enjoy higher rebate ratios on their bets. This means you get more money back regardless of whether you win or lose.
                  </p>
                </section>
              </div>
              <div className="p-4 bg-gray-800/50">
                <button 
                  onClick={() => setShowRules(false)}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-white py-3 rounded-2xl font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
