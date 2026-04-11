import { useState } from 'react';
import { useAuth } from '../App';
import { 
  ChevronRight, 
  History, 
  Users, 
  Download, 
  Copy, 
  Trophy, 
  CreditCard, 
  BookOpen, 
  MessageSquare, 
  BarChart3,
  Share2,
  Gem
} from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '../components/BottomNav';
import { motion } from 'motion/react';

export default function Promotion() {
  const { user } = useAuth();

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
    { icon: Trophy, label: 'Partner rewards', path: '#' },
    { icon: BarChart3, label: 'Subordinate data', path: '#' },
    { icon: CreditCard, label: 'Commission detail', path: '#' },
    { icon: BookOpen, label: 'Invitation rules', path: '#' },
    { icon: MessageSquare, label: 'Agent line customer service', path: '#' },
    { icon: BarChart3, label: 'Rebate ratio', path: '#' },
  ];

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-center relative border-b border-gray-800 bg-[#1a1d21] sticky top-0 z-10">
        <h2 className="font-bold text-lg">Agency</h2>
        <button className="absolute right-4 p-2 hover:bg-gray-800 rounded-full">
          <History className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Commission Card */}
      <div className="p-6">
        <div className="bg-gradient-to-br from-orange-400 via-rose-500 to-purple-600 rounded-[32px] p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-4xl font-black mb-2">0</h1>
            <div className="inline-block bg-black/20 backdrop-blur-md px-4 py-1 rounded-full text-[10px] font-bold mb-2">
              Yesterday's total commission
            </div>
            <p className="text-[10px] text-white/60">Upgrade the level to increase commission income</p>
          </div>
          {/* Decorative elements */}
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        </div>
      </div>

      {/* Subordinates Stats */}
      <div className="px-6 grid grid-cols-2 gap-0.5 bg-gray-800/50 rounded-3xl overflow-hidden border border-gray-800 mx-6">
        <div className="bg-[#2a2e35] p-4 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-blue-400">
            <Users className="w-4 h-4" />
            <span className="text-[10px] font-bold">Direct subordinates</span>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-lg font-bold">0</p>
              <p className="text-[8px] text-gray-500">number of register</p>
            </div>
            <div>
              <p className="text-emerald-500 font-bold">0</p>
              <p className="text-[8px] text-gray-500">Deposit number</p>
            </div>
            <div>
              <p className="text-yellow-500 font-bold">0</p>
              <p className="text-[8px] text-gray-500">Deposit amount</p>
            </div>
            <div>
              <p className="text-lg font-bold">0</p>
              <p className="text-[8px] text-gray-500">Number of people making first deposit</p>
            </div>
          </div>
        </div>
        <div className="bg-[#2a2e35] p-4 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-purple-400">
            <Users className="w-4 h-4" />
            <span className="text-[10px] font-bold">Team subordinates</span>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-lg font-bold">0</p>
              <p className="text-[8px] text-gray-500">number of register</p>
            </div>
            <div>
              <p className="text-emerald-500 font-bold">0</p>
              <p className="text-[8px] text-gray-500">Deposit number</p>
            </div>
            <div>
              <p className="text-yellow-500 font-bold">0</p>
              <p className="text-[8px] text-gray-500">Deposit amount</p>
            </div>
            <div>
              <p className="text-lg font-bold">0</p>
              <p className="text-[8px] text-gray-500">Number of people making first deposit</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-6 space-y-4">
        <button 
          onClick={handleCopyLink}
          className="w-full py-4 bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full font-black text-lg shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Download QR Code
        </button>

        <div className="space-y-3">
          {menuItems.map((item, idx) => (
            <div key={idx} className="bg-[#2a2e35] p-4 rounded-2xl flex items-center justify-between border border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-purple-500/10 rounded-xl">
                  <item.icon className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-xs font-bold">{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </div>
          ))}

          {/* Copy Invite Code Item */}
          <div className="bg-[#2a2e35] p-4 rounded-2xl flex items-center justify-between border border-gray-800">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <Share2 className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-xs font-bold">Copy invitation code</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400">{user?.inviteCode}</span>
              <button onClick={handleCopyCode} className="p-1 hover:bg-gray-700 rounded-md">
                <Copy className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Promotion Data Footer */}
      <div className="px-6 mb-8">
        <div className="bg-[#1f2228] p-6 rounded-3xl border border-gray-800 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">promotion data</h4>
          </div>
          <div className="grid grid-cols-2 gap-8 text-center relative z-10">
            <div>
              <p className="text-xl font-black">0</p>
              <p className="text-[10px] text-gray-500 mt-1">This Week</p>
            </div>
            <div>
              <p className="text-xl font-black">0</p>
              <p className="text-[10px] text-gray-500 mt-1">Total commission</p>
            </div>
            <div>
              <p className="text-xl font-black">0</p>
              <p className="text-[10px] text-gray-500 mt-1">direct subordinate</p>
            </div>
            <div>
              <p className="text-xl font-black">0</p>
              <p className="text-[10px] text-gray-500 mt-1">total subordinate</p>
            </div>
          </div>
          {/* Floating Gem Icon */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2">
            <div className="bg-gradient-to-b from-purple-400 to-purple-600 p-4 rounded-2xl shadow-2xl shadow-purple-500/50 rotate-45">
              <Gem className="w-8 h-8 text-white -rotate-45" />
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
