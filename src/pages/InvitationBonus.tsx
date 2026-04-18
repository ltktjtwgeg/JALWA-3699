import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { cn, formatCurrency } from '../lib/utils';
import { ChevronLeft, Info, FileText, ClipboardList, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  increment,
  arrayUnion,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

interface BonusTier {
  id: string;
  name: string;
  amount: number;
  requiredInvitees: number;
  requiredRecharge: number;
}

const BONUS_TIERS: BonusTier[] = [
  { id: '1', name: 'Bonus 1', amount: 38, requiredInvitees: 1, requiredRecharge: 300 },
  { id: '2', name: 'Bonus 2', amount: 158, requiredInvitees: 3, requiredRecharge: 300 },
  { id: '3', name: 'Bonus 3', amount: 580, requiredInvitees: 10, requiredRecharge: 500 },
  { id: '4', name: 'Bonus 4', amount: 1800, requiredInvitees: 30, requiredRecharge: 800 },
  { id: '5', name: 'Bonus 5', amount: 2800, requiredInvitees: 50, requiredRecharge: 1200 },
  { id: '6', name: 'Bonus 6', amount: 4500, requiredInvitees: 75, requiredRecharge: 1200 },
  { id: '7', name: 'Bonus 7', amount: 5800, requiredInvitees: 100, requiredRecharge: 1200 },
  { id: '8', name: 'Bonus 8', amount: 11800, requiredInvitees: 200, requiredRecharge: 1200 },
  { id: '9', name: 'Bonus 9', amount: 29000, requiredInvitees: 500, requiredRecharge: 1200 },
  { id: '10', name: 'Bonus 10', amount: 58000, requiredInvitees: 1000, requiredRecharge: 1200 },
  { id: '11', name: 'Bonus 11', amount: 118000, requiredInvitees: 2000, requiredRecharge: 1200 },
  { id: '12', name: 'Bonus 12', amount: 300000, requiredInvitees: 5000, requiredRecharge: 1200 },
];

export default function InvitationBonus() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    fetchReferrals();
  }, [user]);

  const fetchReferrals = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'users'),
        where('invitedBy', '==', user.inviteCode)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReferrals(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getQualifiedCount = (requiredRecharge: number) => {
    return referrals.filter(ref => (ref.totalDeposits || 0) >= requiredRecharge).length;
  };

  const handleClaim = async (tier: BonusTier) => {
    if (!user) return;
    const qualified = getQualifiedCount(tier.requiredRecharge);
    if (qualified < tier.requiredInvitees) {
      return toast.error('Condition not met');
    }
    if (user.claimedInvitationBonuses?.includes(tier.id)) {
      return toast.error('Bonus already claimed');
    }

    setClaiming(tier.id);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        balance: increment(tier.amount),
        claimedInvitationBonuses: arrayUnion(tier.id)
      });

      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        type: 'win',
        amount: tier.amount,
        status: 'completed',
        description: `Claimed ${tier.name}`,
        createdAt: serverTimestamp()
      });

      toast.success(`${tier.name} claimed successfully!`);
      refreshUser();
    } catch (error) {
      console.error(error);
      toast.error('Claim failed');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#1a1d21] z-10 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Invitation bonus</h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Banner */}
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <img 
            src="https://picsum.photos/seed/invite/800/450" 
            alt="Invite Friends" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1d21] via-transparent to-black/30 p-6 flex flex-col justify-end">
             <h1 className="text-2xl font-black text-white italic drop-shadow-lg leading-tight">Invite friends and deposit</h1>
             <p className="text-[10px] text-white/70 font-bold uppercase mt-1">Both parties can receive rewards</p>
             <div className="mt-4 flex flex-col gap-1">
                <p className="text-[10px] text-gray-400 font-bold">activity date</p>
                <p className="text-xs font-black text-orange-500">2026-03-24 - 2099-01-01</p>
             </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4 p-4 mt-[-20px] relative z-10">
          <button className="bg-[#2a2e35] p-5 rounded-3xl border border-white/5 flex flex-col items-center gap-2 shadow-xl hover:bg-[#32363e] transition-all">
             <div className="w-10 h-10 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-400" />
             </div>
             <span className="text-[10px] font-bold text-gray-400 uppercase">Invitation reward rules</span>
          </button>
          <button className="bg-[#2a2e35] p-5 rounded-3xl border border-white/5 flex flex-col items-center gap-2 shadow-xl hover:bg-[#32363e] transition-all">
             <div className="w-10 h-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-emerald-400" />
             </div>
             <span className="text-[10px] font-bold text-gray-400 uppercase">Invitation record</span>
          </button>
        </div>

        {/* Bonus Tiers */}
        <div className="p-4 space-y-4">
          {BONUS_TIERS.map((tier) => {
            const qualifiedCount = getQualifiedCount(tier.requiredRecharge);
            const isClaimed = user?.claimedInvitationBonuses?.includes(tier.id);
            const isAvailable = qualifiedCount >= tier.requiredInvitees && !isClaimed;
            
            return (
              <div 
                key={tier.id}
                className="bg-[#2a2e35] rounded-3xl border border-white/5 overflow-hidden shadow-xl"
              >
                <div className="p-4 flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-emerald-500/10 to-transparent">
                   <div className="flex items-center gap-2">
                      <div className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full italic shadow-lg shadow-emerald-500/20">
                         {tier.name}
                      </div>
                      <div className="w-6 h-6 rounded-full border-2 border-white/20 flex items-center justify-center">
                         <XIcon size={12} className="text-white/40" />
                      </div>
                   </div>
                   <span className="text-lg font-black text-orange-500 tabular-nums">₹{tier.amount.toFixed(2)}</span>
                </div>

                <div className="p-5 space-y-6">
                   <div className="grid grid-cols-1 gap-2">
                       <div className="bg-[#1f2228] p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                          <span className="text-[10px] text-gray-500 font-bold uppercase">Number of invitees</span>
                          <span className="text-xs font-black text-gray-300">{tier.requiredInvitees}</span>
                       </div>
                       <div className="bg-[#1f2228] p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                          <span className="text-[10px] text-gray-500 font-bold uppercase">Recharge per people</span>
                          <span className="text-xs font-black text-emerald-400">₹{tier.requiredRecharge.toFixed(2)}</span>
                       </div>
                   </div>

                   <div className="flex items-center justify-between gap-8 px-4">
                       <div className="flex flex-col items-center gap-1">
                          <span className="text-lg font-black text-emerald-400 tabular-nums">
                            {Math.min(qualifiedCount, tier.requiredInvitees)} / {tier.requiredInvitees}
                          </span>
                          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest text-center leading-tight">Number of invitees</span>
                       </div>
                       <div className="flex flex-col items-center gap-1">
                          <span className="text-lg font-black text-rose-500 tabular-nums">
                             {Math.min(qualifiedCount, tier.requiredInvitees)} / {tier.requiredInvitees}
                          </span>
                          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest text-center leading-tight">Deposit number</span>
                       </div>
                   </div>

                   <button
                    disabled={isClaimed || claiming === tier.id}
                    onClick={() => handleClaim(tier)}
                    className={cn(
                      "w-full py-4 rounded-full font-black text-sm uppercase tracking-widest transition-all shadow-xl",
                      isClaimed 
                        ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" 
                        : isAvailable
                          ? "bg-gradient-to-r from-emerald-400 to-emerald-600 text-white shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
                          : "bg-gray-200 text-gray-900 shadow-white/5 disabled:opacity-50"
                    )}
                   >
                     {isClaimed ? 'Claimed' : claiming === tier.id ? 'Claiming...' : isAvailable ? 'Claim Bonus' : 'Unfinished'}
                   </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function XIcon({ size = 24, className = "" }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
