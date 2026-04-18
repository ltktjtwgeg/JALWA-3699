import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Gift, Users, TrendingUp, Trophy, Calendar, ChevronRight, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../App';
import { formatCurrency } from '../lib/utils';

export default function Activity() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const activityIcons = [
    { icon: Trophy, label: 'Activity Award', color: 'bg-orange-500', path: '/activity/award' },
    { icon: Users, label: 'Invitation bonus', color: 'bg-blue-500', path: '/activity/invitation-bonus' },
    { icon: TrendingUp, label: 'Betting rebate', color: 'bg-yellow-500', path: '/activity/rebate' },
    { icon: Trophy, label: 'Super Jackpot', color: 'bg-emerald-500', path: '/activity/jackpot' },
    { icon: Gift, label: 'First gift', color: 'bg-purple-500', path: '/activity/first-gift' },
  ];

  const banners = [
    { 
      title: 'Gifts', 
      desc: 'Enter the redemption code to receive gift rewards', 
      image: 'https://picsum.photos/seed/gift/400/200',
      path: '/gift'
    },
    { 
      title: 'Attendance bonus', 
      desc: 'The more consecutive days you sign in, the higher the reward will be.', 
      image: 'https://picsum.photos/seed/attendance/400/200',
      path: '/activity/attendance'
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white pb-24">
      {/* Header */}
      <div className="bg-[#2a2e35] p-4 flex items-center justify-center sticky top-0 z-50 border-b border-gray-800">
        <img 
          src="/images/logo/logo.png" 
          alt="Logo" 
          className="h-10 object-contain" 
          onError={(e) => {
            e.currentTarget.src = "https://picsum.photos/seed/logo/200/200";
          }}
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Bonus Stats */}
      <div className="p-4">
        <div className="bg-gradient-to-r from-rose-500 via-purple-600 to-blue-500 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 flex justify-between items-center mb-6">
            <div className="text-center flex-1 border-r border-white/20">
              <p className="text-[10px] text-white/70 uppercase font-bold mb-1">Today's bonus</p>
              <h2 className="text-xl font-black">₹0.00</h2>
            </div>
            <div className="text-center flex-1">
              <p className="text-[10px] text-white/70 uppercase font-bold mb-1">Total bonus</p>
              <h2 className="text-xl font-black">₹0.00</h2>
            </div>
          </div>
          <button className="w-full bg-indigo-900/40 backdrop-blur-md border border-white/20 py-2.5 rounded-full text-sm font-bold hover:bg-indigo-900/60 transition-all">
            Bonus details
          </button>
        </div>
      </div>

      {/* Activity Icons Grid */}
      <div className="px-4 py-6 grid grid-cols-4 gap-y-8">
        {activityIcons.map((item, idx) => (
          <div 
            key={idx} 
            className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform"
            onClick={() => navigate(item.path)}
          >
            <div className={`${item.color} w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-black/20`}>
              <item.icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] text-gray-400 font-bold text-center leading-tight px-1">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Banners Grid */}
      <div className="px-4 grid grid-cols-2 gap-4">
        {banners.map((banner, idx) => (
          <div 
            key={idx} 
            onClick={() => navigate(banner.path)}
            className="bg-[#2a2e35] rounded-2xl overflow-hidden border border-gray-800 flex flex-col"
          >
            <img src={banner.image} alt={banner.title} className="w-full h-24 object-cover" />
            <div className="p-3">
              <h4 className="text-sm font-bold mb-1">{banner.title}</h4>
              <p className="text-[10px] text-gray-500 leading-tight">{banner.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Large Banners */}
      <div className="px-4 mt-6 space-y-4">
        <div className="bg-[#2a2e35] rounded-2xl overflow-hidden border border-gray-800">
           <img src="https://picsum.photos/seed/chicken/800/300" alt="Chicken Road" className="w-full h-40 object-cover" />
           <div className="p-4 flex justify-between items-center">
              <h4 className="font-bold">CHICKEN ROAD 2</h4>
              <ChevronRight className="w-5 h-5 text-gray-600" />
           </div>
        </div>
        <div className="bg-[#2a2e35] rounded-2xl overflow-hidden border border-gray-800">
           <img src="https://picsum.photos/seed/roulette/800/300" alt="Lucky Roulette" className="w-full h-40 object-cover" />
           <div className="p-4 flex justify-between items-center">
              <h4 className="font-bold">Lucky Roulette</h4>
              <ChevronRight className="w-5 h-5 text-gray-600" />
           </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
