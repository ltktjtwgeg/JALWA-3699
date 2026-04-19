import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Users, 
  Gamepad2, 
  CreditCard, 
  Settings, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  ShieldCheck,
  BarChart3,
  UserPlus,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  DollarSign,
  Megaphone,
  Trash2,
  Plus,
  Wallet
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  updateDoc, 
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, Game, Transaction, Bet, GameType } from '../types';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';
import { 
  getSystemSettings, 
  updateSystemSettings, 
  SystemSettings, 
  getGamePoolStats, 
  setGameControl,
  updateTransactionStatus
} from '../services/adminService';

export default function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'games' | 'withdrawals' | 'deposits' | 'announcements' | 'control'>('dashboard');
  
  // State for data
  const [users, setUsers] = useState<User[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeControls, setActiveControls] = useState<any[]>([]);
  const [poolStats, setPoolStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Search and Filter
  const [userSearch, setUserSearch] = useState('');
  const [adjustingBalance, setAdjustingBalance] = useState<{uid: string, amount: string} | null>(null);
  
  // Announcement form
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });

  useEffect(() => {
    const isAdminEmail = user?.email === "triloksinghrathore51@gmail.com";
    if (user && user.role !== 'admin' && !isAdminEmail) {
      navigate('/');
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    setLoading(true);
    
    // Real-time listeners
    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100)), (snap) => {
      setUsers(snap.docs.map(d => d.data() as User));
    });

    const unsubGames = onSnapshot(query(collection(db, 'games'), orderBy('periodId', 'desc'), limit(50)), (snap) => {
      setGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
    });

    const unsubTransactions = onSnapshot(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(100)), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });

    const unsubAnnouncements = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')), (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSettings = onSnapshot(doc(db, 'system_config', 'settings'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as SystemSettings);
      }
    });

    const unsubControls = onSnapshot(query(collection(db, 'game_controls'), where('status', '==', 'pending')), (snap) => {
      setActiveControls(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    setLoading(false);

    return () => {
      unsubUsers();
      unsubGames();
      unsubTransactions();
      unsubAnnouncements();
      unsubSettings();
      unsubControls();
    };
  }, []);

  // Pool stats effect
  useEffect(() => {
    if (activeTab === 'control') {
      const fetchPool = async () => {
        const types: GameType[] = ['30s', '1m', '3m', '5m'];
        try {
          const results = await Promise.all(types.map(t => getGamePoolStats(t)));
          const newStats: any = {};
          types.forEach((t, i) => newStats[t] = results[i]);
          setPoolStats(newStats);
        } catch (e) {
          console.error(e);
        }
      };
      
      fetchPool();
      const interval = setInterval(fetchPool, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Stats Logic
  const stats = useMemo(() => {
    const totalBalance = users.reduce((acc, u) => acc + (u.balance || 0), 0);
    const pendingWithdrawals = transactions.filter(t => t.type === 'withdraw' && t.status === 'pending');
    const totalWithdrawals = transactions.filter(t => t.type === 'withdraw' && t.status === 'completed').reduce((acc, t) => acc + t.amount, 0);
    const totalDeposits = transactions.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((acc, t) => acc + t.amount, 0);
    const pendingDeposits = transactions.filter(t => t.type === 'deposit' && t.status === 'pending');
    
    return {
      totalUsers: users.length,
      totalBalance,
      pendingWithdrawals,
      totalWithdrawals,
      totalDeposits,
      pendingDeposits,
      profit: totalDeposits - totalWithdrawals - totalBalance // Simple estimate
    };
  }, [users, transactions]);

  // Actions
  const handleTransactionStatusAction = async (tId: string, status: 'completed' | 'failed', uid: string) => {
    setIsProcessing(true);
    try {
      await updateTransactionStatus(tId, status === 'failed' ? 'rejected' : 'completed', uid);
      toast.success(`Transaction ${status}`);
    } catch (error) {
      toast.error('Failed to update transaction');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateSetting = async (key: keyof SystemSettings, value: any) => {
    try {
      await updateSystemSettings({ [key]: value });
      toast.success('Setting updated');
    } catch (error) {
      toast.error('Failed to update setting');
    }
  };

  const handleManualControl = async (type: GameType, value: string) => {
    setIsProcessing(true);
    try {
      // Clear existing pending controls for this type first for better user experience
      const q = query(collection(db, 'game_controls'), where('gameType', '==', type), where('status', '==', 'pending'));
      const existing = await getDocs(q);
      const batch = writeBatch(db);
      existing.forEach(d => batch.delete(d.ref));
      await batch.commit();

      if (value === 'Force Big Only') await setGameControl(type, 'Big');
      else if (value === 'Force Small Only') await setGameControl(type, 'Small');
      else if (!isNaN(parseInt(value))) await setGameControl(type, undefined, parseInt(value));
      
      toast.success(`Controlled scheduled for ${type}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to schedule control');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustingBalance) return;
    const amount = parseFloat(adjustingBalance.amount);
    if (isNaN(amount)) return toast.error('Invalid amount');

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'users', adjustingBalance.uid), {
        balance: increment(amount)
      });
      
      // Record as admin adjustment
      await addDoc(collection(db, 'transactions'), {
        uid: adjustingBalance.uid,
        type: amount > 0 ? 'deposit' : 'withdraw',
        amount: Math.abs(amount),
        status: 'completed',
        description: 'Admin balance adjustment',
        createdAt: serverTimestamp()
      });

      toast.success('Balance adjusted successfully');
      setAdjustingBalance(null);
    } catch (error) {
      toast.error('Failed to adjust balance');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.content) return toast.error('Fill all fields');
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        ...newAnnouncement,
        createdAt: serverTimestamp()
      });
      setNewAnnouncement({ title: '', content: '' });
      toast.success('Announcement posted');
    } catch (error) {
      toast.error('Failed to post');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast.success('Announcement deleted');
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.uid.includes(userSearch) ||
    u.phoneNumber?.includes(userSearch)
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#0f1115] text-white">
      {/* Sidebar/Header */}
      <div className="p-4 bg-[#1a1d21] border-b border-white/5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/profile')} className="p-2 hover:bg-white/5 rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-black text-xl tracking-tighter text-purple-500 uppercase">SuperAdmin</h2>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full border border-purple-500/30 font-bold uppercase">System Active</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Tabs */}
        <div className="w-full md:w-64 bg-[#1a1d21] border-r border-white/5 p-4 flex md:flex-col gap-1 overflow-x-auto no-scrollbar whitespace-nowrap sticky top-[65px] h-auto md:h-[calc(100vh-65px)]">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpCircle, count: stats.pendingWithdrawals.length },
            { id: 'deposits', label: 'Deposits', icon: ArrowDownCircle, count: stats.pendingDeposits.length },
            { id: 'control', label: 'Game Control', icon: ShieldCheck },
            { id: 'announcements', label: 'Announcements', icon: Megaphone }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm relative",
                activeTab === tab.id ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40" : "text-gray-500 hover:bg-white/5"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
                  { label: 'Total Volume', value: formatCurrency(stats.totalDeposits), icon: TrendingUp, color: 'text-emerald-400' },
                  { label: 'User Balances', value: formatCurrency(stats.totalBalance), icon: Wallet, color: 'text-amber-400' },
                  { label: 'Total Profit', value: formatCurrency(stats.profit), icon: DollarSign, color: 'text-purple-400' }
                ].map((s, i) => (
                  <div key={i} className="bg-[#1a1d21] p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <s.icon className="w-12 h-12" />
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">{s.label}</p>
                    <h3 className={cn("text-2xl font-black italic", s.color)}>{s.value}</h3>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-[#1a1d21] p-6 rounded-3xl border border-white/5 space-y-4">
                  <h3 className="font-bold flex items-center gap-2 uppercase tracking-tighter">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    Global Game Engine
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-xs font-bold">Random Mode</p>
                        <p className="text-[10px] text-gray-500 italic">Generate results randomly if not manually set</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateSetting('randomMode', !settings?.randomMode)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative flex items-center px-1",
                          settings?.randomMode ? "bg-emerald-500" : "bg-gray-700"
                        )}
                      >
                        <div className={cn("w-4 h-4 bg-white rounded-full transition-all shadow-sm", settings?.randomMode ? "translate-x-6" : "translate-x-0")} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-xs font-bold">Auto Profit Mode</p>
                        <p className="text-[10px] text-gray-500 italic">Adjust results to ensure platform profit</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateSetting('autoProfit', !settings?.autoProfit)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative flex items-center px-1",
                          settings?.autoProfit ? "bg-purple-600" : "bg-gray-700"
                        )}
                      >
                        <div className={cn("w-4 h-4 bg-white rounded-full transition-all shadow-sm", settings?.autoProfit ? "translate-x-6" : "translate-x-0")} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1a1d21] p-6 rounded-3xl border border-white/5 space-y-4">
                    {stats.pendingWithdrawals.length > 0 ? (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between">
                        <p className="text-sm font-bold text-rose-400">{stats.pendingWithdrawals.length} Pending Withdrawals</p>
                        <button onClick={() => setActiveTab('withdrawals')} className="text-[10px] font-black uppercase text-rose-500 underline">View All</button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 italic">No urgent withdrawal tasks</p>
                    )}
                    {stats.pendingDeposits.length > 0 && (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                        <p className="text-sm font-bold text-emerald-400">{stats.pendingDeposits.length} Pending Deposits</p>
                        <button onClick={() => setActiveTab('deposits')} className="text-[10px] font-black uppercase text-emerald-500 underline">View All</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#1a1d21] p-6 rounded-3xl border border-white/5 space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    System Status
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border-b border-white/5">
                        <span className="text-sm text-gray-500">Firebase Connectivity</span>
                        <span className="text-xs font-bold text-emerald-500">Connected</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border-b border-white/5">
                        <span className="text-sm text-gray-500">Game Manager</span>
                        <span className="text-xs font-bold text-emerald-500">Running</span>
                    </div>
                    <div className="flex items-center justify-between p-3">
                        <span className="text-sm text-gray-500">Total Transactions</span>
                        <span className="text-xs font-bold text-gray-300">{transactions.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {activeTab === 'control' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Global Controls */}
              <div className="bg-[#1a1d21] p-8 rounded-[32px] border border-white/5 space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Gamepad2 className="w-32 h-32" />
                </div>
                
                <div className="relative z-10 flex flex-wrap gap-8 items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white italic tracking-tighter uppercase mb-1">Global Game Engine</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Switch between fully random and system-favoring modes</p>
                  </div>
                  <div className="flex bg-[#0f1115] p-1.5 rounded-2xl border border-white/5">
                    <button 
                      onClick={() => {
                        handleUpdateSetting('wingoRandomMode', true);
                        handleUpdateSetting('wingoAutoControl', false);
                      }}
                      className={cn(
                        "px-6 py-2.5 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all",
                        settings?.wingoRandomMode ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40" : "text-gray-500 hover:text-gray-400"
                      )}
                    >
                      Random {settings?.wingoRandomMode ? 'ON' : 'OFF'}
                    </button>
                    <button 
                      onClick={() => {
                        handleUpdateSetting('wingoRandomMode', false);
                        handleUpdateSetting('wingoAutoControl', true);
                      }}
                      className={cn(
                        "px-6 py-2.5 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all",
                        settings?.wingoAutoControl ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40" : "text-gray-500 hover:text-gray-400"
                      )}
                    >
                      Auto Profit {settings?.wingoAutoControl ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Game Pools */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {['30s', '1m', '3m', '5m'].map((type) => {
                  const pool = poolStats[type] || { total: 0, Big: 0, Small: 0, Red: 0, Green: 0, Violet: 0, numbers: Array(10).fill(0) };
                  const pendingControl = activeControls.find(c => c.gameType === type);
                  
                  // Calculate Next Period
                  const duration = type === '30s' ? 30 : type === '1m' ? 60 : type === '3m' ? 180 : 300;
                  const now = Math.floor(Date.now() / 1000);
                  const periodTimestamp = Math.floor(now / duration) * duration + duration;
                  const periodDate = new Date(periodTimestamp * 1000);
                  const periodId = periodDate.getFullYear().toString() +
                    (periodDate.getMonth() + 1).toString().padStart(2, '0') +
                    periodDate.getDate().toString().padStart(2, '0') +
                    periodDate.getHours().toString().padStart(2, '0') +
                    periodDate.getMinutes().toString().padStart(2, '0') +
                    ((periodDate.getSeconds() / duration) + 1).toString().padStart(2, '0');

                  return (
                    <div key={type} className="bg-[#1a1d21] p-6 rounded-[32px] border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                              <Gamepad2 className="w-5 h-5 text-purple-400" />
                           </div>
                           <h4 className="font-black text-lg tracking-tighter text-white uppercase italic">WinGo {type}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Current Pool</p>
                          <span className="text-sm font-black text-emerald-400 italic">₹ {pool.total.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="mb-6 flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-purple-500/30 shadow-lg shadow-purple-900/20">
                        <div className="flex flex-col">
                           <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Next Period</p>
                           <p className="text-sm font-black text-amber-500 italic font-mono tracking-widest animate-pulse">{periodId}</p>
                        </div>
                        {type === '30s' && (
                          <div className="bg-purple-600/20 px-3 py-1 rounded-full border border-purple-500/30">
                            <span className="text-[10px] font-black text-purple-400 uppercase italic">Active</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-[#0f1115] p-3 rounded-2xl border border-white/5 flex flex-col">
                           <span className="text-[8px] text-gray-600 font-bold uppercase mb-1">Big Bets</span>
                           <span className="text-sm font-black text-orange-400">₹ {pool.Big.toLocaleString()}</span>
                        </div>
                        <div className="bg-[#0f1115] p-3 rounded-2xl border border-white/5 flex flex-col">
                           <span className="text-[8px] text-gray-600 font-bold uppercase mb-1">Small Bets</span>
                           <span className="text-sm font-black text-sky-400">₹ {pool.Small.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-10 gap-1 mb-6">
                        {pool.numbers.map((amt: number, n: number) => (
                           <div key={n} className="flex flex-col items-center">
                              <div className={cn(
                                "w-6 h-6 rounded-lg mb-1 flex items-center justify-center text-[10px] font-black italic border transition-all",
                                pendingControl?.targetNumber === n ? "scale-110 shadow-lg ring-2 ring-purple-500 z-10" : "opacity-80",
                                [1,3,7,9].includes(n) ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" :
                                [2,4,6,8].includes(n) ? "bg-rose-500/20 border-rose-500/30 text-rose-400" :
                                n === 0 ? "bg-rose-500/20 border-rose-500/30 text-rose-400" : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                              )}>
                                {n}
                              </div>
                              <span className="text-[8px] font-bold text-gray-600">₹{amt > 0 ? amt : 0}</span>
                           </div>
                        ))}
                      </div>

                      {/* Controls */}
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div>
                          <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-2">Override Control</p>
                          <select 
                            value={pendingControl?.targetSize ? `Force ${pendingControl.targetSize} Only` : 'Auto'}
                            onChange={(e) => handleManualControl(type as GameType, e.target.value)}
                            className={cn(
                              "w-full bg-[#0f1115] border text-[10px] font-black p-3.5 rounded-2xl tracking-widest uppercase outline-none transition-all",
                              pendingControl?.targetSize ? "border-purple-500 text-white shadow-lg shadow-purple-900/20" : "border-white/5 text-gray-400"
                            )}
                          >
                            <option value="Auto">System Default (Auto)</option>
                            <option value="Force Big Only">Force Big Only</option>
                            <option value="Force Small Only">Force Small Only</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                           {[0,1,2,3,4,5,6,7,8,9].map(n => (
                              <button 
                                key={n}
                                onClick={() => handleManualControl(type as GameType, n.toString())}
                                className={cn(
                                  "h-12 text-xs font-black italic border-2 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center",
                                  pendingControl?.targetNumber === n 
                                    ? "bg-purple-600 text-white border-white scale-110 shadow-xl shadow-purple-900/60 z-10" 
                                    : "bg-[#0f1115] border-white/5 text-gray-500 hover:bg-white/5"
                                )}
                              >
                                {n}
                              </button>
                           ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                  type="text"
                  placeholder="Search by username, UID or phone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-[#1a1d21] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUsers.map((u) => (
                  <div key={u.uid} className="bg-[#1a1d21] p-6 rounded-3xl border border-white/5 space-y-4 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-black text-xl italic shadow-lg">
                        {u.username?.[0] || 'U'}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold flex items-center gap-2 uppercase tracking-tighter">
                          {u.username}
                          {u.isDemo && <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded font-black">DEMO</span>}
                        </h4>
                        <p className="text-[10px] text-gray-500 font-mono">UID: {u.inviteCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-emerald-400 text-lg">{formatCurrency(u.balance)}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-black">VIP {u.vipLevel}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => setAdjustingBalance({ uid: u.uid, amount: '' })}
                        className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all"
                      >
                        Adjust Balance
                      </button>
                    </div>

                    {adjustingBalance?.uid === u.uid && (
                      <div className="p-4 bg-black/40 rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                        <input 
                          type="number" 
                          placeholder="Amount (+ or -)"
                          value={adjustingBalance.amount}
                          onChange={(e) => setAdjustingBalance({...adjustingBalance, amount: e.target.value})}
                          className="w-full bg-[#0f1115] border border-white/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-purple-500"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => setAdjustingBalance(null)} className="flex-1 text-xs text-gray-500 font-bold">Cancel</button>
                          <button 
                            disabled={isProcessing}
                            onClick={handleAdjustBalance}
                            className="flex-1 bg-purple-600 py-3 rounded-xl text-xs font-black uppercase shadow-lg shadow-purple-900/40"
                          >
                            {isProcessing ? '...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              {stats.pendingWithdrawals.length === 0 && (
                <div className="text-center py-20 text-gray-600 italic">No pending withdrawals</div>
              )}
              {stats.pendingWithdrawals.map((w) => (
                <div key={w.id} className="bg-[#1a1d21] p-6 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-2xl font-black text-rose-500 italic">{formatCurrency(w.amount)}</p>
                      <p className="text-xs text-gray-400 font-medium mt-1">{w.description}</p>
                      <p className="text-[8px] text-gray-600 font-mono mt-2 uppercase">UID: {w.uid} | DATE: {w.createdAt?.toDate().toLocaleString()}</p>
                    </div>
                    <span className="bg-rose-500/10 text-rose-500 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter">Pending Approval</span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleTransactionStatusAction(w.id!, 'completed', w.uid)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button 
                      onClick={() => handleTransactionStatusAction(w.id!, 'failed', w.uid)}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-900/20 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'deposits' && (
            <div className="space-y-4">
               {stats.pendingDeposits.length === 0 && (
                <div className="text-center py-20 text-gray-600 italic">No pending deposits</div>
              )}
               {stats.pendingDeposits.map((d) => (
                <div key={d.id} className="bg-[#1a1d21] p-6 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-2xl font-black text-emerald-500 italic">{formatCurrency(d.amount)}</p>
                      <p className="text-xs text-gray-400 font-medium mt-1">{d.description}</p>
                      <p className="text-[8px] text-gray-600 font-mono mt-2 uppercase">UID: {d.uid}</p>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-500 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter">Manual Review</span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleTransactionStatusAction(d.id!, 'completed', d.uid)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleTransactionStatusAction(d.id!, 'failed', d.uid)}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="space-y-8 max-w-2xl mx-auto">
              <div className="bg-[#1a1d21] p-6 rounded-3xl border border-white/5 space-y-4">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tighter italic">
                  <Plus className="w-4 h-4 text-purple-500" />
                  New Announcement
                </h3>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Title"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                    className="w-full bg-[#0f1115] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none"
                  />
                  <textarea 
                    placeholder="Content..."
                    rows={4}
                    value={newAnnouncement.content}
                    onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                    className="w-full bg-[#0f1115] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none resize-none"
                  />
                  <button 
                    disabled={isProcessing}
                    onClick={handlePostAnnouncement}
                    className="w-full bg-purple-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-purple-900/40"
                  >
                    {isProcessing ? 'Posting...' : 'Post Announcement'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 px-2 uppercase">Active Announcements</h3>
                {announcements.map((a) => (
                  <div key={a.id} className="bg-[#1a1d21] p-6 rounded-3xl border border-white/5 flex items-start gap-4">
                    <div className="flex-1">
                      <h4 className="font-bold text-purple-400 mb-1">{a.title}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{a.content}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      className="p-2 bg-rose-500/10 text-rose-500 rounded-full hover:bg-rose-500 border border-rose-500/20 hover:text-white transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'games' && (
            <div className="space-y-4 xl:grid xl:grid-cols-2 xl:gap-4">
              {games.map((g) => (
                <div key={g.id} className="bg-[#1a1d21] p-4 rounded-2xl border border-white/5 flex items-center justify-between hover:border-white/20 transition-all">
                  <div>
                    <p className="text-lg font-black italic tracking-tighter text-white/90"># {g.periodId}</p>
                    <p className="text-[10px] font-black uppercase text-purple-500">{g.gameType}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-gray-500 uppercase">{g.resultSize || 'Pending'}</p>
                    </div>
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-black italic shadow-2xl border-2 border-white/10",
                      [1, 3, 7, 9].includes(g.resultNumber!) ? "bg-emerald-500" :
                      [2, 4, 6, 8].includes(g.resultNumber!) ? "bg-rose-500" :
                      g.resultNumber === 0 ? "bg-[linear-gradient(135deg,#f43f5e_50%,#a855f7_50%)]" :
                      g.resultNumber === 5 ? "bg-[linear-gradient(135deg,#10b981_50%,#a855f7_50%)]" : "bg-gray-800"
                    )}>
                      {g.resultNumber !== undefined ? g.resultNumber : '?'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
