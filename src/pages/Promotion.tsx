import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  Users, 
  Copy, 
  Trophy, 
  CreditCard, 
  BookOpen, 
  MessageSquare, 
  BarChart3,
  Share2,
  Filter,
  User,
  Calendar,
  DollarSign,
  FileText,
  Headphones,
  Wallet,
  Coins,
  Loader2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function Promotion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showSubordinates, setShowSubordinates] = useState(false);
  const [subordinateList, setSubordinateList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    directRegister: 0,
    teamRegister: 0,
    directDepositCount: 0,
    teamDepositCount: 0,
    directDepositAmount: 0,
    teamDepositAmount: 0,
    directFirstDeposit: 0,
    teamFirstDeposit: 0,
  });

  useEffect(() => {
    if (user) {
      fetchPromotionData();
    }
  }, [user]);

  const fetchPromotionData = async () => {
    if (!user?.inviteCode) return;
    setLoading(true);
    try {
      // Fetch Level 1 (Direct)
      const q1 = query(collection(db, 'users'), where('invitedBy', '==', user.inviteCode));
      const snap1 = await getDocs(q1);
      const level1Users = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubordinateList(level1Users);
      
      const directStats = {
        register: level1Users.length,
        depositCount: level1Users.filter((u: any) => (u.totalDeposits || 0) > 0).length,
        depositAmount: level1Users.reduce((acc, u: any) => acc + (u.totalDeposits || 0), 0),
        firstDeposit: level1Users.filter((u: any) => (u.totalDeposits || 0) > 0).length,
      };

      // Fetch Level 2
      let level2Count = 0;
      let level2Deposits = 0;
      let level2DepositCount = 0;
      
      const level1Codes = level1Users.map((u: any) => u.inviteCode).filter(Boolean);
      if (level1Codes.length > 0) {
        // Firestore 'in' query limit is 30, so let's chunk if needed or just use multiple queries
        // For simplicity, let's just do it in chunks of 30
        const chunks = [];
        for (let i = 0; i < level1Codes.length; i += 30) {
          chunks.push(level1Codes.slice(i, i + 30));
        }

        for (const chunk of chunks) {
          const q2 = query(collection(db, 'users'), where('invitedBy', 'in', chunk));
          const snap2 = await getDocs(q2);
          level2Count += snap2.size;
          snap2.docs.forEach(d => {
            const data = d.data();
            level2Deposits += (data.totalDeposits || 0);
            if ((data.totalDeposits || 0) > 0) level2DepositCount++;
          });
        }
      }

      setStats({
        directRegister: directStats.register,
        teamRegister: directStats.register + level2Count,
        directDepositCount: directStats.depositCount,
        teamDepositCount: directStats.depositCount + level2DepositCount,
        directDepositAmount: directStats.depositAmount,
        teamDepositAmount: directStats.depositAmount + level2Deposits,
        directFirstDeposit: directStats.firstDeposit,
        teamFirstDeposit: directStats.firstDeposit + level2DepositCount,
      });
    } catch (error) {
      console.error('Error fetching promotion data:', error);
      toast.error('Failed to load promotion data');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const referLink = `${window.location.origin}/register?invitationCode=${user?.inviteCode}`;
    navigator.clipboard.writeText(referLink);
    toast.success('Referral link copied to clipboard!');
  };

  const handleCopyCode = () => {
    if (user?.inviteCode) {
      navigator.clipboard.writeText(user.inviteCode);
      toast.success('Invitation code copied!');
    }
  };

  const menuItems = [
    { icon: User, label: 'Partner rewards', path: '#' },
    { icon: Wallet, label: 'Copy invitation code', isCode: true },
    { icon: Calendar, label: 'Subordinate data', onClick: () => setShowSubordinates(true) },
    { icon: DollarSign, label: 'Commission detail', path: '#' },
    { icon: FileText, label: 'Invitation rules', path: '#' },
    { icon: Headphones, label: 'Agent line customer service', path: '/customer-service' },
    { icon: Coins, label: 'Rebate ratio', path: '#' },
  ];

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[#1a1d21] text-white">
      {/* Subordinates Modal */}
      <AnimatePresence>
        {showSubordinates && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSubordinates(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-[#2a2e35] rounded-[32px] overflow-hidden shadow-2xl border border-gray-800 flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-bold">Subordinate Data</h3>
                <button onClick={() => setShowSubordinates(false)} className="p-2 hover:bg-gray-800 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {subordinateList.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 font-bold uppercase text-xs">No subordinates found</div>
                ) : (
                  subordinateList.map((sub: any) => (
                    <div key={sub.id} className="bg-[#1a1d21] p-4 rounded-2xl border border-gray-800 flex justify-between items-center">
                       <div className="space-y-1">
                          <p className="text-sm font-bold">{sub.username}</p>
                          <p className="text-[10px] text-gray-500">{sub.phoneNumber || sub.email}</p>
                          <p className="text-[9px] text-gray-600 italic">UID: {sub.numericId}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black text-emerald-400">₹{(sub.totalDeposits || 0).toFixed(2)}</p>
                          <p className="text-[8px] text-gray-500 uppercase font-bold">Total Deposit</p>
                       </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="p-4 flex items-center justify-center relative bg-[#1a1d21] sticky top-0 z-10">
        <h2 className="font-bold text-lg">Agency</h2>
        <button className="absolute right-4 p-2 bg-[#2a2e35] rounded-lg">
          <Filter className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Commission Card */}
      <div className="p-6">
        <div className="bg-gradient-to-r from-[#ff9a9e] via-[#fecfef] to-[#feada6] rounded-[32px] p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <h1 className="text-5xl font-black text-white drop-shadow-lg mb-4">0</h1>
            <div className="bg-black/20 backdrop-blur-md px-6 py-2 rounded-full border border-white/30 mb-2">
              <span className="text-xs font-black text-white uppercase tracking-widest">Yesterday's total commission</span>
            </div>
            <p className="text-[10px] text-white/70 font-bold uppercase tracking-tighter">Upgrade level to increase income</p>
          </div>
        </div>
      </div>

      {/* Subordinates Stats */}
      <div className="px-6">
        <div className="bg-[#2a2e35] rounded-[32px] overflow-hidden border border-gray-800 shadow-xl">
          <div className="grid grid-cols-2 bg-[#3f445e]">
            <div className="p-3 flex items-center justify-center gap-2 border-r border-gray-700">
              <User className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-bold">Direct subordinates</span>
            </div>
            <div className="p-3 flex items-center justify-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] font-bold">Team subordinates</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 divide-x divide-gray-700">
            {/* Row 1 */}
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-lg font-bold">{stats.directRegister}</p>
              <p className="text-[8px] text-gray-500 uppercase">number of register</p>
            </div>
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-lg font-bold">{stats.teamRegister}</p>
              <p className="text-[8px] text-gray-500 uppercase">number of register</p>
            </div>
            
            {/* Row 2 */}
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-emerald-500 font-bold">{stats.directDepositCount}</p>
              <p className="text-[8px] text-gray-500 uppercase">Deposit number</p>
            </div>
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-emerald-500 font-bold">{stats.teamDepositCount}</p>
              <p className="text-[8px] text-gray-500 uppercase">Deposit number</p>
            </div>
            
            {/* Row 3 */}
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-yellow-500 font-bold">₹{stats.directDepositAmount.toFixed(2)}</p>
              <p className="text-[8px] text-gray-500 uppercase">Deposit amount</p>
            </div>
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-yellow-500 font-bold">₹{stats.teamDepositAmount.toFixed(2)}</p>
              <p className="text-[8px] text-gray-500 uppercase">Deposit amount</p>
            </div>
            
            {/* Row 4 */}
            <div className="p-4 text-center">
              <p className="text-lg font-bold">{stats.directFirstDeposit}</p>
              <p className="text-[8px] text-gray-500 uppercase">Number of people making first deposit</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-lg font-bold">{stats.teamFirstDeposit}</p>
              <p className="text-[8px] text-gray-500 uppercase">Number of people making first deposit</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-6 space-y-4">
        <button 
          onClick={handleCopyLink}
          className="w-full py-3 bg-gradient-to-r from-[#ff9a9e] to-[#feada6] rounded-full font-black text-sm shadow-xl shadow-orange-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Download QR Code
        </button>

        <div className="space-y-3">
          {menuItems.map((item: any, idx) => (
            <div 
              key={idx} 
              onClick={() => {
                if (item.onClick) return item.onClick();
                if (!item.isCode && item.path && item.path !== '#') navigate(item.path);
              }}
              className="bg-[#2a2e35] p-4 rounded-2xl flex items-center justify-between border border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[#3f445e] rounded-xl">
                  <item.icon className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-xs font-bold">{item.label}</span>
              </div>
              
              {item.isCode ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400">{user?.inviteCode}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleCopyCode(); }} className="p-1 hover:bg-gray-700 rounded-md">
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
