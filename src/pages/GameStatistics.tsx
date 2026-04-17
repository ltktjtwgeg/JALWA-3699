import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trophy, Video, Gamepad2, Fish, Trophy as SportIcon, Club } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { formatCurrency } from '../lib/utils';

interface CategoryStats {
  totalBet: number;
  count: number;
  winningAmount: number;
}

interface StatsData {
  lottery: CategoryStats;
  video: CategoryStats;
  slot: CategoryStats;
  fish: CategoryStats;
  sport: CategoryStats;
  chessCard: CategoryStats;
}

const initialStats: StatsData = {
  lottery: { totalBet: 0, count: 0, winningAmount: 0 },
  video: { totalBet: 0, count: 0, winningAmount: 0 },
  slot: { totalBet: 0, count: 0, winningAmount: 0 },
  fish: { totalBet: 0, count: 0, winningAmount: 0 },
  sport: { totalBet: 0, count: 0, winningAmount: 0 },
  chessCard: { totalBet: 0, count: 0, winningAmount: 0 },
};

export default function GameStatistics() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Today');
  const [stats, setStats] = useState<StatsData>(initialStats);
  const [loading, setLoading] = useState(true);

  const tabs = ['Today', 'Yesterday', 'This week', 'This month'];

  useEffect(() => {
    fetchStats();
  }, [activeTab]);

  const fetchStats = async () => {
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      const now = new Date();
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      if (activeTab === 'Yesterday') {
        startDate.setDate(startDate.getDate() - 1);
        const endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (activeTab === 'This week') {
        const day = startDate.getDay();
        startDate.setDate(startDate.getDate() - day);
      } else if (activeTab === 'This month') {
        startDate.setDate(1);
      }

      // Fetch bets (Wingo)
      const betsQ = query(
        collection(db, 'bets'),
        where('uid', '==', auth.currentUser.uid),
        where('createdAt', '>=', Timestamp.fromDate(startDate))
      );

      // Fetch transactions (Mines, Roulette, etc.)
      const transQ = query(
        collection(db, 'transactions'),
        where('uid', '==', auth.currentUser.uid),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('type', 'in', ['mines_win', 'mines_loss', 'roulette_win', 'roulette_loss'])
      );

      const [betsSnap, transSnap] = await Promise.all([
        getDocs(betsQ),
        getDocs(transQ)
      ]);

      const newStats = JSON.parse(JSON.stringify(initialStats));

      // Process Wingo bets
      betsSnap.forEach((doc) => {
        const data = doc.data();
        newStats.lottery.totalBet += data.totalAmount || 0;
        newStats.lottery.count += 1;
        if (data.status === 'win') {
          newStats.lottery.winningAmount += data.winAmount || 0;
        }
      });

      // Process Game transactions
      transSnap.forEach((doc) => {
        const data = doc.data();
        if (data.type.includes('mines')) {
          newStats.slot.totalBet += data.type === 'mines_loss' ? data.amount : (data.amount / 2); // Approximation for bet
          newStats.slot.count += 1;
          if (data.type === 'mines_win') {
            newStats.slot.winningAmount += data.amount;
          }
        } else if (data.type.includes('roulette')) {
          newStats.lottery.totalBet += data.type === 'roulette_loss' ? data.amount : (data.amount / 5); // Approximation
          newStats.lottery.count += 1;
          if (data.type === 'roulette_win') {
            newStats.lottery.winningAmount += data.amount;
          }
        }
      });

      setStats(newStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalBetAll = (Object.values(stats) as CategoryStats[]).reduce((acc, curr) => acc + curr.totalBet, 0);

  const CategoryItem = ({ icon: Icon, label, data }: { icon: any, label: string, data: CategoryStats }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-purple-500/20 rounded-lg">
          <Icon className="w-5 h-5 text-purple-400" />
        </div>
        <span className="font-bold text-sm text-gray-200">{label}</span>
      </div>
      
      <div className="ml-4 border-l border-dashed border-gray-700 space-y-4 pb-2">
        <div className="relative pl-6 flex justify-between items-center">
          <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-purple-500 bg-[#1a1d21]" />
          <span className="text-xs text-gray-500">Total bet</span>
          <span className="text-xs font-bold text-gray-300">{formatCurrency(data.totalBet)}</span>
        </div>
        <div className="relative pl-6 flex justify-between items-center">
          <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-purple-500 bg-[#1a1d21]" />
          <span className="text-xs text-gray-500">Number of bets</span>
          <span className="text-xs font-bold text-gray-300">{data.count}</span>
        </div>
        <div className="relative pl-6 flex justify-between items-center">
          <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-purple-500 bg-[#1a1d21]" />
          <span className="text-xs text-gray-500">Winning amount</span>
          <span className="text-xs font-bold text-purple-400">{formatCurrency(data.winningAmount)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Game statistics</h2>
        <div className="w-10" />
      </div>

      {/* Tabs */}
      <div className="px-4 py-4">
        <div className="flex bg-[#2a2e35] p-1 rounded-full overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 pb-8 space-y-6">
        {/* Total Bet Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#2a2e35] p-8 rounded-3xl border border-gray-800 text-center shadow-xl"
        >
          <h3 className="text-2xl font-black text-orange-400 mb-1">{formatCurrency(totalBetAll)}</h3>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Total bet</p>
        </motion.div>

        {/* Categories */}
        <div className="bg-[#2a2e35] rounded-3xl p-6 border border-gray-800 space-y-8">
          <CategoryItem icon={Trophy} label="lottery" data={stats.lottery} />
          <CategoryItem icon={Video} label="video" data={stats.video} />
          <CategoryItem icon={Gamepad2} label="Slot" data={stats.slot} />
          <CategoryItem icon={Fish} label="Fish" data={stats.fish} />
          <CategoryItem icon={SportIcon} label="sport" data={stats.sport} />
          <CategoryItem icon={Club} label="ChessCard" data={stats.chessCard} />
        </div>
      </div>
    </div>
  );
}
