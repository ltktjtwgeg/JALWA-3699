import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Wallet,
  Bomb,
  Upload,
  Eye,
  Zap,
  Globe,
  Trophy
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
  const [selectedUserDetailed, setSelectedUserDetailed] = useState<User | null>(null);
  const [inviteeStats, setInviteeStats] = useState<{ 
    count: number, 
    totalDeposits: number, 
    totalWithdrawals: number,
    inviteesList: User[]
  } | null>(null);
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  
  // Announcement form
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });

  useEffect(() => {
    const isAdminEmail = user?.email === "triloksinghrathore51@gmail.com";
    if (user && user.role !== 'admin' && !isAdminEmail) {
      navigate('/');
      return;
    }
  }, [user, navigate]);

  const fetchAllData = async () => {
    try {
      setIsProcessing(true);
      
      // Fetch everything in parallel
      const [usersSnap, gamesSnap, transactionsSnap, announcementsSnap, settingsSnap, controlsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100))),
        getDocs(query(collection(db, 'games'), orderBy('periodId', 'desc'), limit(50))),
        getDocs(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(100))),
        getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))),
        getDoc(doc(db, 'system_config', 'settings')),
        getDocs(query(collection(db, 'game_controls'), where('status', '==', 'pending')))
      ]);

      setUsers(usersSnap.docs.map(d => d.data() as User));
      setGames(gamesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
      setTransactions(transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setAnnouncements(announcementsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (settingsSnap.exists()) setSettings(settingsSnap.data() as SystemSettings);
      setActiveControls(controlsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (error) {
      console.error("SuperAdmin Fetch error:", error);
      toast.error("Database limit reached. Please try again later.");
    } finally {
      setIsProcessing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    // Manual polling for heavy stats every 5 minutes
    const statsInterval = setInterval(fetchAllData, 300000);

    // Real-time listener for settings
    const unsubSettings = onSnapshot(doc(db, 'system_config', 'settings'), (snap) => {
       if (snap.exists()) setSettings(snap.data() as SystemSettings);
    });

    // Real-time listener for pending transactions to keep dashboard snappy
    const qPending = query(
      collection(db, 'transactions'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubTrans = onSnapshot(qPending, (snap) => {
      const pendingTrans = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(prev => {
        // Merge pending with existing non-pending from fetchAllData (to keep stats accurate-ish)
        const nonPending = prev.filter(t => t.status !== 'pending');
        return [...pendingTrans, ...nonPending];
      });
    });

    return () => {
      clearInterval(statsInterval);
      unsubSettings();
      unsubTrans();
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
    setProcessingId(tId);
    try {
      await updateTransactionStatus(tId, status === 'failed' ? 'rejected' : 'completed', uid);
      toast.success(`Transaction ${status}`);
    } catch (error) {
      toast.error('Failed to update transaction');
    } finally {
      setProcessingId(null);
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

  const qrInputRef = useRef<HTMLInputElement>(null);

  const handleQRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) { // 500KB limit for base64 storage
       return toast.error('Image too large. Please use a smaller QR code image (<500KB).');
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
       const base64 = event.target?.result as string;
       await handleUpdateSetting('upiImage', base64);
    };
    reader.readAsDataURL(file);
  };
  const [minesControl, setMinesControlState] = useState<{
    targetMines: number[];
    targetUsername: string;
  }>({ targetMines: [], targetUsername: 'global' });
  const [minesSessions, setMinesSessions] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [depositFilter, setDepositFilter] = useState<'pending' | 'history'>('pending');

  useEffect(() => {
    const q = query(
      collection(db, 'mines_sessions'),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMinesSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleMinesControlSave = async () => {
    if (minesControl.targetMines.length === 0) return toast.error('Select at least one mine');
    setIsProcessing(true);
    try {
      // Clear existing pending mines controls
      const q = query(
        collection(db, 'game_controls'), 
        where('type', '==', 'mines'), 
        where('status', '==', 'pending')
      );
      const existing = await getDocs(q);
      const batch = writeBatch(db);
      existing.forEach(d => batch.delete(d.ref));
      await batch.commit();

      await addDoc(collection(db, 'game_controls'), {
        type: 'mines',
        targetUsername: minesControl.targetUsername,
        targetMines: minesControl.targetMines,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      toast.success('Mines control scheduled successfully');
      setMinesControlState({ targetMines: [], targetUsername: 'global' });
    } catch (e) {
      console.error(e);
      toast.error('Failed to schedule mines control');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleMineSelection = (idx: number) => {
    setMinesControlState(prev => {
      const newMines = prev.targetMines.includes(idx)
        ? prev.targetMines.filter(m => m !== idx)
        : [...prev.targetMines, idx];
      return { ...prev, targetMines: newMines };
    });
  };

  const handleFlushMines = async () => {
    setIsProcessing(true);
    try {
      const q = query(collection(db, 'mines_sessions'), where('status', '==', 'playing'));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.set(d.ref, { status: 'flushed', updatedAt: serverTimestamp() }, { merge: true });
      });
      await batch.commit();
      toast.success('Active sessions flushed');
    } catch (e) {
      toast.error('Flush failed');
    } finally {
      setIsProcessing(false);
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

  const fetchInviteeStats = async (targetUser: User) => {
    setSelectedUserDetailed(targetUser);
    setIsFetchingStats(true);
    setInviteeStats(null);
    
    try {
      // 1. Get all direct invitees - invitedBy stores the inviter's inviteCode (numericId)
      const inviteesQuery = query(collection(db, 'users'), where('invitedBy', '==', targetUser.inviteCode));
      const inviteesSnap = await getDocs(inviteesQuery);
      const invitees = inviteesSnap.docs.map(d => d.data() as User);
      
      if (invitees.length === 0) {
        setInviteeStats({ count: 0, totalDeposits: 0, totalWithdrawals: 0 });
        return;
      }

      let totalDeposits = invitees.reduce((acc, u) => acc + (u.totalDeposits || 0), 0);
      let totalWithdrawals = 0;

      // 2. We need to fetch withdrawals for these invitees
      // We'll query in chunks of 30 if there are many, but for simple MVP let's query all completed withdrawals 
      // where uid is in the invitees list (using 'in' operator limited to 30)
      const uids = invitees.map(u => u.uid);
      
      // Split into chunks of 30 for Firestore 'in' query
      const chunks = [];
      for (let i = 0; i < uids.length; i += 30) {
        chunks.push(uids.slice(i, i + 30));
      }

      const withdrawalResults = await Promise.all(chunks.map(async (chunk) => {
        const q = query(
          collection(db, 'transactions'), 
          where('uid', 'in', chunk), 
          where('type', '==', 'withdraw'), 
          where('status', '==', 'completed')
        );
        const snap = await getDocs(q);
        return snap.docs.reduce((acc, d) => acc + (d.data().amount || 0), 0);
      }));

      totalWithdrawals = withdrawalResults.reduce((acc, sum) => acc + sum, 0);

      setInviteeStats({
        count: invitees.length,
        totalDeposits,
        totalWithdrawals,
        inviteesList: invitees
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch stats');
    } finally {
      setIsFetchingStats(false);
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

                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div className="flex-1">
                        <p className="text-xs font-bold">Deposit Bonus Percentage (%)</p>
                        <p className="text-[10px] text-gray-500 italic">Bonus added to every deposit automatically</p>
                        <div className="mt-2 flex items-center gap-2">
                          <input 
                            type="number" 
                            className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs w-24 outline-none focus:border-purple-500"
                            value={settings?.depositBonusPercentage || 0}
                            onChange={(e) => handleUpdateSetting('depositBonusPercentage', parseFloat(e.target.value) || 0)}
                          />
                          <span className="text-xs font-bold text-gray-500">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Manual Payment Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-3">
                         <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Manual UPI ID</p>
                         <input 
                            type="text"
                            placeholder="example@upi"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-purple-500 font-mono"
                            value={settings?.upiId || ''}
                            onChange={(e) => handleUpdateSetting('upiId', e.target.value)}
                         />
                         <p className="text-[9px] text-gray-500 italic">This ID will be shown to users during manual deposit.</p>
                      </div>

                      <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-3">
                         <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Upload QR Code Image</p>
                         <div className="flex flex-col gap-2">
                            <input 
                              type="file" 
                              ref={qrInputRef} 
                              className="hidden" 
                              accept="image/*" 
                              onChange={handleQRUpload} 
                            />
                            <div 
                              onClick={() => qrInputRef.current?.click()}
                              className="relative group aspect-square max-w-[120px] mx-auto bg-black/40 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center p-2 cursor-pointer hover:border-emerald-500/50 transition-colors"
                            >
                               {settings?.upiImage ? (
                                  <img src={settings.upiImage} alt="UPI QR" className="w-full h-full object-contain rounded-lg" />
                               ) : (
                                  <>
                                    <Upload className="w-6 h-6 text-gray-600 mb-2" />
                                    <span className="text-[8px] text-gray-600 font-bold uppercase">Click to Upload</span>
                                  </>
                               )}
                            </div>
                            <input 
                               type="text"
                               placeholder="Or paste image URL here"
                               className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-emerald-500"
                               value={settings?.upiImage || ''}
                               onChange={(e) => handleUpdateSetting('upiImage', e.target.value)}
                            />
                         </div>
                      </div>
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
                {/* Mines Game Control */}
                <div className="lg:col-span-2 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2 bg-[#1a1d21] p-6 rounded-[32px] border border-white/5 flex flex-col justify-between relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/10 transition-colors" />
                         <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                               <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                  <Zap className="w-4 h-4 text-orange-400" />
                               </div>
                               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Engine Status</span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase italic leading-relaxed max-w-xs">
                               Active sessions can be forcefully terminated to secure site profit or perform maintenance.
                            </p>
                         </div>
                         <button 
                           onClick={handleFlushMines}
                           disabled={isProcessing}
                           className="relative z-10 mt-6 w-full bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95 disabled:opacity-50"
                         >
                           {isProcessing ? 'Terminating...' : 'Force Flush Active Sessions'}
                         </button>
                      </div>

                      {[
                        { mode: 'random', label: 'Random', icon: Globe, color: 'text-emerald-400', desc: 'Natural RNG outcomes' },
                        { mode: 'force_win', label: 'Force Win', icon: Trophy, color: 'text-blue-400', desc: 'Higher player success' },
                        { mode: 'force_loss', label: 'Force Loss', icon: ShieldCheck, color: 'text-rose-400', desc: 'Secure platform profit' }
                      ].map((item) => {
                        const isActive = (settings?.minesMode || 'random') === item.mode;
                        return (
                          <button 
                            key={item.mode}
                            onClick={() => handleUpdateSetting('minesMode', item.mode)}
                            className={cn(
                              "p-6 rounded-[32px] border transition-all duration-300 flex flex-col items-center justify-center gap-3 group relative overflow-hidden",
                              isActive 
                               ? "bg-purple-600 border-purple-400 shadow-xl shadow-purple-900/40" 
                               : "bg-[#1a1d21] border-white/5 hover:border-white/10 hover:translate-y-[-2px]"
                            )}
                          >
                             <div className={cn(
                               "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                               isActive ? "bg-white/20" : "bg-black/20"
                             )}>
                                <item.icon className={cn("w-6 h-6", isActive ? "text-white" : item.color)} />
                             </div>
                             <div className="text-center">
                                <span className={cn("text-xs font-black uppercase tracking-tighter block", isActive ? "text-white" : "text-gray-300")}>
                                  {item.label}
                                </span>
                                <span className={cn("text-[8px] font-bold uppercase tracking-widest block mt-1 opacity-50", isActive ? "text-white" : "text-gray-500")}>
                                  {item.desc}
                                </span>
                             </div>
                          </button>
                        );
                      })}
                  </div>

                  {/* Tile Selection Panel */}
                  <div className="bg-[#1a1d21] p-8 rounded-[40px] border border-white/5 relative overflow-hidden group">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                              <Bomb className="w-6 h-6" />
                           </div>
                           <div>
                              <h4 className="font-black text-xl tracking-tighter text-white uppercase italic">Targeted Mine Rigging</h4>
                              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Select exact bomb positions for next round</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <input 
                             type="text"
                             placeholder="Target User (Optional)"
                             className="bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs outline-none focus:border-purple-500 w-56 font-bold"
                             value={minesControl.targetUsername === 'global' ? '' : minesControl.targetUsername}
                             onChange={(e) => setMinesControlState(prev => ({ ...prev, targetUsername: e.target.value || 'global' }))}
                           />
                           <button 
                             onClick={handleMinesControlSave}
                             disabled={isProcessing}
                             className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-purple-900/40 active:scale-95 disabled:opacity-50"
                           >
                             {isProcessing ? 'Setting...' : 'Activate Rig'}
                           </button>
                        </div>
                     </div>

                     <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
                        <div className="grid grid-cols-5 gap-3 bg-black/40 p-6 rounded-[32px] border border-white/5 w-fit">
                           {Array.from({ length: 25 }).map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => toggleMineSelection(idx)}
                                className={cn(
                                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 border-2 relative group-button",
                                  minesControl.targetMines.includes(idx) 
                                    ? "bg-rose-600 border-white scale-110 shadow-xl shadow-rose-900/50" 
                                    : "bg-[#0f1115] border-white/5 hover:border-white/20 active:scale-90"
                                )}
                              >
                                 {minesControl.targetMines.includes(idx) ? (
                                   <Bomb className="w-5 h-5 text-white animate-in zoom-in duration-300" />
                                 ) : (
                                   <div className="w-2 h-2 bg-gray-800 rounded-full group-hover:bg-gray-600 transition-colors" />
                                 )}
                              </button>
                           ))}
                        </div>
                        
                        <div className="lg:w-48 text-center lg:text-left space-y-2">
                           <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Summary</p>
                           <div className="space-y-1">
                              <p className="text-3xl font-black text-rose-500 italic uppercase">
                                 {minesControl.targetMines.length} <span className="text-xs text-gray-400 not-italic tracking-normal">Bombs</span>
                              </p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase">
                                 Effect: <span className="text-emerald-400">Guaranteed Hit</span>
                              </p>
                           </div>
                           <button 
                             onClick={() => setMinesControlState(prev => ({ ...prev, targetMines: [] }))}
                             className="text-[9px] text-gray-500 hover:text-white underline font-black uppercase tracking-widest mt-4"
                           >
                              Clear Grid
                           </button>
                        </div>
                     </div>
                  </div>

                  {/* Live Mines Monitor */}
                  <div className="bg-[#1a1d21] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
                     <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/10">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                              <TrendingUp className="w-5 h-5 text-purple-400" />
                           </div>
                           <div>
                              <h3 className="text-xs font-black text-white uppercase tracking-widest italic">Live Mines Monitor</h3>
                              <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">Real-time session tracking</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                           <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                             {minesSessions.filter(s => s.status === 'playing').length} Active sessions
                           </span>
                        </div>
                     </div>
                     
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="bg-black/20 text-[9px] font-black uppercase text-gray-500 border-b border-white/5">
                                 <th className="px-8 py-5">Player Entity</th>
                                 <th className="px-8 py-5 text-center">Stake (₹)</th>
                                 <th className="px-8 py-5 text-center">Config</th>
                                 <th className="px-8 py-5 text-center">Stage Progress</th>
                                 <th className="px-8 py-5 text-right font-mono italic">Mini Map</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/5">
                              {minesSessions.length === 0 ? (
                                 <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                       <div className="flex flex-col items-center justify-center opacity-10">
                                          <Bomb className="w-16 h-16 mb-4" />
                                          <p className="text-xs font-black uppercase tracking-widest">No active games detected</p>
                                       </div>
                                    </td>
                                 </tr>
                              ) : (
                                 minesSessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-white/5 transition-all group/row">
                                       <td className="px-8 py-6">
                                          <div className="flex items-center gap-4">
                                             <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black italic text-sm shadow-lg group-hover/row:scale-110 transition-transform">
                                                {session.username?.[0]?.toUpperCase() || 'U'}
                                             </div>
                                             <div>
                                                <p className="text-xs font-black text-white uppercase tracking-tighter">{session.username}</p>
                                                <p className="text-[8px] text-gray-500 font-mono mt-0.5">SID: {session.id.slice(-8).toUpperCase()}</p>
                                             </div>
                                          </div>
                                       </td>
                                       <td className="px-8 py-6 text-center text-sm font-black text-white italic tracking-tighter">
                                          ₹{session.betAmount}
                                       </td>
                                       <td className="px-8 py-6 text-center">
                                          <div className="inline-flex flex-col items-center gap-1">
                                             <span className="bg-rose-500/10 text-rose-500 px-3 py-1 rounded-xl text-[9px] font-black italic border border-rose-500/20">
                                                {session.mineCount} BOMBS
                                             </span>
                                          </div>
                                       </td>
                                       <td className="px-8 py-6 text-center">
                                          <div className="flex flex-col items-center gap-1">
                                             <span className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-xl text-[10px] font-black italic border border-emerald-500/20 font-mono">
                                                Revealed: {session.revealedCount}
                                             </span>
                                             {session.status !== 'playing' && (
                                                <span className={cn(
                                                   "text-[8px] font-black uppercase px-2 py-0.5 rounded-lg",
                                                   session.status === 'won' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                                )}>
                                                   {session.status}
                                                </span>
                                             )}
                                          </div>
                                       </td>
                                       <td className="px-8 py-6">
                                          <div className="flex justify-end">
                                             <div className="grid grid-cols-5 gap-0.5 p-1 bg-black/60 rounded-xl shadow-inner group-hover/row:border-purple-500/30 border border-transparent transition-colors">
                                                {Array.from({ length: 25 }).map((_, idx) => {
                                                   const isRevealed = session.revealedIndices?.includes(idx);
                                                   const isMine = session.mines?.includes(idx);
                                                   return (
                                                      <div key={idx} className={cn(
                                                         "w-2.5 h-2.5 rounded-[1px] transition-all duration-500",
                                                         isRevealed 
                                                          ? (session.status === 'lost' && isMine ? "bg-rose-400 animate-pulse" : "bg-emerald-400") 
                                                          : "bg-white/5 group-hover/row:bg-white/10"
                                                      )} />
                                                   );
                                                })}
                                             </div>
                                          </div>
                                       </td>
                                    </tr>
                                 ))
                              )}
                           </tbody>
                        </table>
                     </div>
                  </div>
                </div>

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
              {selectedUserDetailed ? (
                <div className="bg-[#1a1d21] p-8 rounded-[32px] border border-white/5 animate-in slide-in-from-right-4 duration-300 space-y-6">
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={() => setSelectedUserDetailed(null)}
                      className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Back to list</span>
                    </button>
                    <div className="bg-purple-600/10 px-4 py-2 rounded-2xl border border-purple-500/20">
                      <span className="text-xs font-black text-purple-400 uppercase tracking-tighter italic">User Network Analytics</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-3xl font-black italic shadow-2xl">
                      {selectedUserDetailed.username?.[0] || 'U'}
                    </div>
                    <div>
                      <h4 className="text-2xl font-black italic uppercase tracking-tighter text-white">{selectedUserDetailed.username}</h4>
                      <p className="text-xs text-gray-500 font-mono mt-1">UID: {selectedUserDetailed.inviteCode}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-black">ACTIVE</span>
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full font-black">VIP {selectedUserDetailed.vipLevel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-y border-white/5">
                    <div className="bg-black/20 p-6 rounded-3xl border border-white/5">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">My Balance</p>
                      <h3 className="text-2xl font-black text-emerald-400 italic font-mono">{formatCurrency(selectedUserDetailed.balance)}</h3>
                    </div>
                    <div className="bg-black/20 p-6 rounded-3xl border border-white/5">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">My Deposits</p>
                      <h3 className="text-2xl font-black text-blue-400 italic font-mono">{formatCurrency(selectedUserDetailed.totalDeposits || 0)}</h3>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-purple-400 mb-2">
                      <Users className="w-5 h-5" />
                      <h3 className="font-bold uppercase tracking-widest text-sm">Direct Invitees Stats</h3>
                    </div>
                    
                    {isFetchingStats ? (
                      <div className="py-10 flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-gray-500 font-bold animate-pulse">Calculating network volume...</p>
                      </div>
                    ) : inviteeStats ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-purple-600/5 p-6 rounded-3xl border border-purple-500/20 group hover:bg-purple-600/10 transition-colors">
                           <p className="text-[10px] text-purple-400/60 font-bold uppercase tracking-widest mb-2">Team Size</p>
                           <h3 className="text-4xl font-black text-purple-400 italic">{inviteeStats.count}</h3>
                           <p className="text-[10px] text-gray-600 font-bold uppercase mt-2">Direct Referrals</p>
                        </div>
                        <div className="bg-emerald-600/5 p-6 rounded-3xl border border-emerald-500/20 group hover:bg-emerald-600/10 transition-colors">
                           <p className="text-[10px] text-emerald-400/60 font-bold uppercase tracking-widest mb-2">Team Deposits</p>
                           <h3 className="text-4xl font-black text-emerald-400 italic">₹ {inviteeStats.totalDeposits.toLocaleString()}</h3>
                           <p className="text-[10px] text-gray-600 font-bold uppercase mt-2">Total Combined Deposits</p>
                        </div>
                        <div className="bg-rose-600/5 p-6 rounded-3xl border border-rose-500/20 group hover:bg-rose-600/10 transition-colors">
                           <p className="text-[10px] text-rose-400/60 font-bold uppercase tracking-widest mb-2">Team Withdrawals</p>
                           <h3 className="text-4xl font-black text-rose-400 italic">₹ {inviteeStats.totalWithdrawals.toLocaleString()}</h3>
                           <p className="text-[10px] text-gray-600 font-bold uppercase mt-2">Total Combined Withdrawals</p>
                        </div>
                      </div>

                      <div className="space-y-4 pt-6">
                        <h3 className="text-xs font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                           <ArrowDownCircle className="w-4 h-4" />
                           Network Members ({inviteeStats.count})
                        </h3>
                        <div className="bg-black/20 rounded-3xl border border-white/5 overflow-hidden">
                           <table className="w-full text-left">
                              <thead className="bg-white/5 border-b border-white/5">
                                 <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">User</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">UID</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Balance</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 text-right">Joined</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                 {inviteeStats.inviteesList.length === 0 ? (
                                    <tr>
                                       <td colSpan={4} className="px-6 py-10 text-center text-xs text-gray-600 italic">No one has joined using this code yet</td>
                                    </tr>
                                 ) : (
                                    inviteeStats.inviteesList.map(inv => (
                                       <tr key={inv.uid} className="hover:bg-white/5 transition-colors">
                                          <td className="px-6 py-4">
                                             <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center font-black text-xs text-purple-400 italic mb-0">
                                                   {inv.username?.[0] || 'U'}
                                                </div>
                                                <span className="text-xs font-bold">{inv.username}</span>
                                             </div>
                                          </td>
                                          <td className="px-6 py-4 text-xs font-mono text-gray-500">{inv.inviteCode}</td>
                                          <td className="px-6 py-4 text-xs font-bold text-emerald-500 italic">{formatCurrency(inv.balance)}</td>
                                          <td className="px-6 py-4 text-[10px] font-medium text-gray-500 text-right">
                                             {inv.createdAt?.toDate?.() ? inv.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                          </td>
                                       </tr>
                                    ))
                                 )}
                              </tbody>
                           </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 bg-black/20 rounded-3xl text-center border border-dashed border-white/10">
                      <p className="text-gray-500 text-sm">Failed to load statistics.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
                <>
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
                              {u.role === 'admin' && <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-black border border-amber-500/20">ADMIN</span>}
                              {u.isDemo && <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded font-black">DEMO</span>}
                            </h4>
                            <button 
                              onClick={() => fetchInviteeStats(u)}
                              className="text-[10px] text-purple-400 font-mono font-bold hover:underline text-left block mt-0.5"
                            >
                              UID: {u.inviteCode}
                            </button>
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
                          <button 
                            onClick={() => fetchInviteeStats(u)}
                            className="flex-1 bg-purple-600/10 hover:bg-purple-600/20 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-purple-400 border border-purple-500/20 transition-all flex items-center justify-center gap-2"
                          >
                            <TrendingUp className="w-3 h-3" /> View Network
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
                </>
              )}
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
                      disabled={processingId === w.id}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" /> {processingId === w.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button 
                      onClick={() => handleTransactionStatusAction(w.id!, 'failed', w.uid)}
                      disabled={processingId === w.id}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> {processingId === w.id ? '...' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'deposits' && (
            <div className="space-y-6">
               <div className="flex bg-[#1a1d21] p-1 rounded-2xl border border-white/5 w-fit">
                  <button 
                    onClick={() => setDepositFilter('pending')}
                    className={cn(
                      "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      depositFilter === 'pending' ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-400"
                    )}
                  >
                    Pending ({stats.pendingDeposits.length})
                  </button>
                  <button 
                    onClick={() => setDepositFilter('history')}
                    className={cn(
                      "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      depositFilter === 'history' ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-400"
                    )}
                  >
                    History
                  </button>
               </div>

               <div className="space-y-4">
                  {(depositFilter === 'pending' ? stats.pendingDeposits : transactions.filter(t => t.type === 'deposit' && t.status !== 'pending')).length === 0 && (
                    <div className="text-center py-20 text-gray-600 italic">No {depositFilter} deposits</div>
                  )}
                  {(depositFilter === 'pending' ? stats.pendingDeposits : transactions.filter(t => t.type === 'deposit' && t.status !== 'pending')).map((d) => (
                    <div key={d.id} className="bg-[#1a1d21] p-6 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden">
                      {d.status !== 'pending' && (
                        <div className={cn(
                          "absolute top-0 right-0 px-6 py-1 text-[8px] font-black uppercase tracking-[0.2em] transform rotate-45 translate-x-6 translate-y-2 shadow-sm",
                          d.status === 'completed' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                        )}>
                          {d.status}
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <div>
                          <p className={cn("text-2xl font-black italic", d.status === 'completed' ? "text-emerald-500" : d.status === 'rejected' ? "text-rose-500" : "text-emerald-500")}>
                            {formatCurrency(d.amount)}
                          </p>
                          <p className="text-xs text-gray-400 font-medium mt-1 uppercase tracking-tighter">{d.description}</p>
                          <p className="text-[8px] text-gray-600 font-mono mt-2 uppercase flex items-center gap-2">
                            <span className="bg-white/5 px-2 py-0.5 rounded">UID: {d.uid}</span>
                            <span className="bg-white/5 px-2 py-0.5 rounded">DATE: {d.createdAt?.toDate().toLocaleString()}</span>
                          </p>
                          
                          <div className="flex flex-wrap gap-2 mt-4">
                            {d.transactionId && (
                              <div className="flex-1 min-w-[120px] p-2 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Transaction ID</p>
                                <p className="text-xs font-mono text-emerald-400 break-all">{d.transactionId}</p>
                              </div>
                            )}
                            {d.proofUrl && (
                              <div className="flex-1 min-w-[150px] p-2 bg-black/40 rounded-xl border border-white/5 space-y-2">
                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Payment Proof</p>
                                <div className="space-y-2">
                                  <div 
                                    onClick={() => window.open(d.proofUrl, '_blank')}
                                    className="w-full aspect-video bg-white/5 rounded-lg p-1 cursor-pointer overflow-hidden group relative"
                                  >
                                    <img src={d.proofUrl} className="w-full h-full object-contain transition-transform group-hover:scale-110" alt="Proof" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-bold uppercase">
                                      Click to Expand
                                    </div>
                                  </div>
                                  <a 
                                    href={d.proofUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="w-full text-center block text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase py-2 bg-blue-500/10 rounded-lg border border-blue-500/20"
                                  >
                                    View full proof
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {d.status === 'pending' && (
                          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter">Manual Review</span>
                        )}
                      </div>
                      
                      {d.status === 'pending' && (
                        <div className="flex gap-3">
                          <button 
                            onClick={() => handleTransactionStatusAction(d.id!, 'completed', d.uid)}
                            disabled={processingId === d.id}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            {processingId === d.id ? 'Processing...' : 'Approve'}
                          </button>
                          <button 
                            onClick={() => handleTransactionStatusAction(d.id!, 'failed', d.uid)}
                            disabled={processingId === d.id}
                            className="flex-1 bg-rose-600 hover:bg-rose-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            {processingId === d.id ? '...' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'mines' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Global Mines Status */}
              <div className="relative overflow-hidden bg-[#1a1c2e] p-8 rounded-[40px] border border-white/5 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full -mr-32 -mt-32" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                           <Zap className="w-4 h-4 text-purple-400" />
                        </div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Global Mines Status</h3>
                     </div>
                     <p className="text-[10px] text-gray-500 font-bold uppercase italic max-w-sm ml-11">
                        Rigged mode increases the probability of hitting a mine in early clicks to secure site profit.
                     </p>
                  </div>
                  <div className="flex items-center gap-6">
                     <div className="text-right">
                        <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Current State</p>
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                           <span className="text-xl font-black text-white uppercase italic">Active</span>
                        </div>
                     </div>
                  </div>
                </div>
              </div>

              {/* Mode Selection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {[
                   { mode: 'random', label: 'Random Mode', desc: 'Fair play. AI determines outcomes naturally.', icon: Globe, color: 'bg-[#7c3aed]' },
                   { mode: 'force_win', label: 'Force Win', desc: 'Players always hit Diamonds. High payout risk.', icon: Trophy, color: 'bg-emerald-500' },
                   { mode: 'force_loss', label: 'Force Loss', desc: 'Players always hit Mines. Maximum profit mode.', icon: ShieldCheck, color: 'bg-rose-500' }
                 ].map((item) => {
                   const isActive = (settings?.minesMode || 'random') === item.mode;
                   return (
                     <button 
                       key={item.mode}
                       onClick={() => handleUpdateSetting('minesMode', item.mode)}
                       className={cn(
                         "relative group p-6 rounded-[32px] border transition-all duration-300 text-left overflow-hidden",
                         isActive 
                          ? "bg-[#252a41] border-purple-500/50 shadow-2xl shadow-purple-500/10" 
                          : "bg-[#1a1d21] border-white/5 hover:border-white/10"
                       )}
                     >
                        {isActive && (
                          <div className="absolute top-4 right-4 bg-purple-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest animate-in zoom-in duration-300">
                             Active
                          </div>
                        )}
                        
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
                          isActive ? item.color : "bg-white/5 text-gray-400 group-hover:scale-110"
                        )}>
                           <item.icon className={cn("w-6 h-6", isActive ? "text-white" : "text-gray-400")} />
                        </div>
                        
                        <h4 className={cn(
                          "text-sm font-black uppercase tracking-tight italic mb-1",
                          isActive ? "text-white" : "text-white/90"
                        )}>
                          {item.label}
                        </h4>
                        <p className={cn(
                          "text-[10px] leading-relaxed font-bold uppercase",
                          isActive ? "text-gray-400" : "text-gray-500"
                        )}>
                          {item.desc}
                        </p>
                     </button>
                   );
                 })}
              </div>
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
