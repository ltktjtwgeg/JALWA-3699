import { useState } from 'react';
import { useAuth } from '../App';
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
  Coins
} from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '../components/BottomNav';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Promotion() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
    { icon: Calendar, label: 'Subordinate data', path: '#' },
    { icon: DollarSign, label: 'Commission detail', path: '#' },
    { icon: FileText, label: 'Invitation rules', path: '#' },
    { icon: Headphones, label: 'Agent line customer service', path: '/customer-service' },
    { icon: Coins, label: 'Rebate ratio', path: '#' },
  ];

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[#1a1d21] text-white">
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
              <p className="text-lg font-bold">0</p>
              <p className="text-[8px] text-gray-500 uppercase">number of register</p>
            </div>
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-lg font-bold">0</p>
              <p className="text-[8px] text-gray-500 uppercase">number of register</p>
            </div>
            
            {/* Row 2 */}
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-emerald-500 font-bold">0</p>
              <p className="text-[8px] text-gray-500 uppercase">Deposit number</p>
            </div>
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-emerald-500 font-bold">0</p>
              <p className="text-[8px] text-gray-500 uppercase">Deposit number</p>
            </div>
            
            {/* Row 3 */}
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-yellow-500 font-bold">0</p>
              <p className="text-[8px] text-gray-500 uppercase">Deposit amount</p>
            </div>
            <div className="p-4 text-center border-b border-gray-700">
              <p className="text-yellow-500 font-bold">0</p>
              <p className="text-[8px] text-gray-500 uppercase">Deposit amount</p>
            </div>
            
            {/* Row 4 */}
            <div className="p-4 text-center">
              <p className="text-lg font-bold">0</p>
              <p className="text-[8px] text-gray-500 uppercase">Number of people making first deposit</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-lg font-bold">0</p>
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
          {menuItems.map((item, idx) => (
            <div 
              key={idx} 
              onClick={() => !item.isCode && item.path !== '#' && navigate(item.path)}
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
