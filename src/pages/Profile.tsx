import React, { useState } from 'react';
import { useAuth } from '../App';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Shield, 
  LogOut, 
  ChevronRight, 
  CreditCard, 
  History, 
  Users, 
  Gift,
  Headphones,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Copy,
  RefreshCw,
  Trophy,
  Bell,
  BarChart3,
  Globe,
  MessageSquare,
  BookOpen,
  Info,
  Megaphone
} from 'lucide-react';
import BottomNav from '../components/BottomNav';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Balance updated');
    }, 1000);
  };

  const handleCopyUid = () => {
    if (user?.inviteCode) {
      navigator.clipboard.writeText(user.inviteCode);
      toast.success('UID copied to clipboard');
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[#1a1d21] text-white">
      {/* Profile Header Section */}
      <div className="relative pt-12 pb-24 px-6 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border-2 border-white/40 overflow-hidden flex items-center justify-center shadow-xl">
            <img 
              src={user?.avatarUrl || '/images/avatars/1.png'} 
              alt="avatar" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-black tracking-tight text-white uppercase">{user?.nickname || user?.username || 'MEMBER'}</h2>
              <div className="bg-white/30 backdrop-blur-md px-2 py-0.5 rounded flex items-center gap-1 border border-white/40">
                <Trophy className="w-3 h-3 text-yellow-300" />
                <span className="text-[10px] font-bold text-white">VIP{user?.vipLevel || 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-xs mb-1">
              <span className="font-bold">UID</span>
              <span className="font-mono">|</span>
              <span className="font-mono font-bold">{user?.inviteCode}</span>
              <button onClick={handleCopyUid} className="p-1 hover:bg-white/10 rounded">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[10px] text-white/70 font-medium">
              {new Date().toLocaleString()}
            </p>
            <p className="text-[10px] text-white/70 font-medium">
              Last login: {user?.lastLoginAt?.toDate().toLocaleString() || 'N/A'}
            </p>
          </div>
        </div>

        {/* Balance Card Overlay */}
        <div className="absolute -bottom-16 left-6 right-6 bg-[#2a2e35] rounded-3xl p-6 shadow-2xl border border-gray-800">
          <div className="mb-6">
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-2">
              Total balance
            </p>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-[#f3d078]">{formatCurrency(user?.balance || 0)}</h1>
              <RefreshCw 
                onClick={handleRefresh}
                className={cn(
                  "w-5 h-5 text-gray-400 cursor-pointer transition-transform duration-1000",
                  isRefreshing && "rotate-180"
                )} 
              />
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            <div onClick={() => navigate('/wallet')} className="flex flex-col items-center gap-2 cursor-pointer group">
              <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                <Wallet className="w-6 h-6 text-rose-500" />
              </div>
              <span className="text-[10px] font-bold text-gray-400">Wallet</span>
            </div>
            <div onClick={() => navigate('/deposit')} className="flex flex-col items-center gap-2 cursor-pointer group">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                <ArrowDownCircle className="w-6 h-6 text-orange-500" />
              </div>
              <span className="text-[10px] font-bold text-gray-400">Deposit</span>
            </div>
            <div onClick={() => navigate('/withdraw')} className="flex flex-col items-center gap-2 cursor-pointer group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <ArrowUpCircle className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-[10px] font-bold text-gray-400">Withdraw</span>
            </div>
            <div onClick={() => navigate('/vip')} className="flex flex-col items-center gap-2 cursor-pointer group">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <Trophy className="w-6 h-6 text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold text-gray-400">VIP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Menu Grid */}
      <div className="mt-20 px-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div onClick={() => navigate('/history/game')} className="bg-[#2a2e35] p-4 rounded-2xl flex items-center gap-3 border border-gray-800 cursor-pointer">
            <div className="bg-blue-500/20 p-2 rounded-xl">
              <History className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-bold">Game History</p>
              <p className="text-[10px] text-gray-500">My game history</p>
            </div>
          </div>
          <div onClick={() => navigate('/history/all')} className="bg-[#2a2e35] p-4 rounded-2xl flex items-center gap-3 border border-gray-800 cursor-pointer">
            <div className="bg-emerald-500/20 p-2 rounded-xl">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold">Transaction</p>
              <p className="text-[10px] text-gray-500">My transaction history</p>
            </div>
          </div>
          <div onClick={() => navigate('/history/deposit')} className="bg-[#2a2e35] p-4 rounded-2xl flex items-center gap-3 border border-gray-800 cursor-pointer">
            <div className="bg-rose-500/20 p-2 rounded-xl">
              <ArrowDownCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-xs font-bold">Deposit</p>
              <p className="text-[10px] text-gray-500">My deposit history</p>
            </div>
          </div>
          <div onClick={() => navigate('/history/withdraw')} className="bg-[#2a2e35] p-4 rounded-2xl flex items-center gap-3 border border-gray-800 cursor-pointer">
            <div className="bg-orange-500/20 p-2 rounded-xl">
              <ArrowUpCircle className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs font-bold">Withdraw</p>
              <p className="text-[10px] text-gray-500">My withdraw history</p>
            </div>
          </div>
        </div>

        {/* List Menu */}
        <div className="bg-[#2a2e35] rounded-3xl overflow-hidden border border-gray-800">
          {[
            { icon: Bell, label: 'Notification', path: '/notifications' },
            { icon: Gift, label: 'Gifts', path: '/gift' },
            { icon: BarChart3, label: 'Game statistics', path: '/game-statistics' },
            { icon: Globe, label: 'Language', extra: 'English', path: '/language' },
            ...(user?.role === 'admin' || user?.email === "triloksinghrathore51@gmail.com" ? [{ icon: Settings, label: 'Admin Panel', path: '/admin' }] : []),
          ].map((item, idx) => (
            <div 
              key={idx} 
              onClick={() => item.path && navigate(item.path)}
              className="flex items-center justify-between p-4 border-b border-gray-800/50 last:border-0 hover:bg-white/5 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-gray-300">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.extra && <span className="text-xs text-gray-500">{item.extra}</span>}
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          ))}
        </div>

        {/* Service Center */}
        <div className="bg-[#2a2e35] rounded-3xl p-6 border border-gray-800">
          <h4 className="text-sm font-bold text-gray-400 mb-6">Service center</h4>
          <div className="grid grid-cols-3 gap-y-8">
            {[
              { icon: Settings, label: 'Settings', path: '/settings' },
              { icon: MessageSquare, label: 'Feedback', path: '/feedback' },
              { icon: Megaphone, label: 'Announcement', path: '/announcements' },
              { icon: Headphones, label: 'Customer Service', path: '/customer-service' },
              { icon: BookOpen, label: "Beginner's Guide" },
              { icon: Info, label: 'About us', path: '/about' },
            ].map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => item.path && navigate(item.path)}
                className="flex flex-col items-center gap-2 cursor-pointer group"
              >
                <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                  <item.icon className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-[10px] text-gray-500 text-center">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="w-full py-4 rounded-full border border-gray-800 text-gray-500 font-bold hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
