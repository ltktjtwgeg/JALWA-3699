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
  addDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, Game, Transaction, Bet } from '../types';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';

export default function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'games' | 'withdrawals' | 'deposits' | 'announcements'>('dashboard');
  
  // State for data
  const [users, setUsers] = useState<User[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter
  const [userSearch, setUserSearch] = useState('');
  const [adjustingBalance, setAdjustingBalance] = useState<{uid: string, amount: string} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
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

    setLoading(false);

    return () => {
      unsubUsers();
      unsubGames();
      unsubTransactions();
      unsubAnnouncements();
    };
  }, []);

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
  const handleTransactionStatus = async (tId: string, status: 'completed' | 'failed', amount?: number, uid?: string, type?: string) => {
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'transactions', tId), { status });
      
      // If rejecting a withdrawal, refund the user
      if (status === 'failed' && type === 'withdraw' && uid && amount) {
        batch.update(doc(db, 'users', uid), { balance: increment(amount) });
        toast.info('Withdrawal rejected and balance refunded');
      }

      // If approving a deposit, add to user balance (if not already handled)
      if (status === 'completed' && type === 'deposit' && uid && amount) {
        batch.update(doc(db, 'users', uid), { 
          balance: increment(amount),
          totalDeposits: increment(amount)
        });
        toast.info('Deposit approved and balance added');
      }

      await batch.commit();
      toast.success('Transaction updated successfully');
    } catch (error) {
      toast.error('Failed to update transaction');
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
            { id: 'games', label: 'Game History', icon: Gamepad2 },
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
                  <h3 className="font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    Urgent Tasks
                  </h3>
                  <div className="space-y-3">
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
                      onClick={() => handleTransactionStatus(w.id!, 'completed')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button 
                      onClick={() => handleTransactionStatus(w.id!, 'failed', w.amount, w.uid, 'withdraw')}
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
                      onClick={() => handleTransactionStatus(d.id!, 'completed', d.amount, d.uid, 'deposit')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Approve
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
