import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Wallet, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Trophy, 
  DollarSign, 
  ChevronRight,
  Menu,
  Settings,
  Bell,
  Gamepad2,
  Phone,
  Gift,
  LayoutDashboard,
  ShieldCheck,
  Globe,
  MessageSquare,
  LogOut,
  ChevronDown,
  RefreshCw,
  Search,
  Plus,
  History,
  Trash2,
  Bomb,
  Gem,
  Square,
  Circle,
  Zap,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  getAdminStats, 
  getSystemSettings, 
  updateSystemSettings, 
  SystemSettings, 
  getGamePoolStats, 
  setGameControl, 
  createGiftCode, 
  getGiftCodes, 
  deleteGiftCode,
  getPendingTransactions,
  updateTransactionStatus,
  setMinesControl,
  setRouletteControl,
  getUsers
} from '../../services/adminService';
import { formatCurrency, cn } from '../../lib/utils';
import { toast } from 'sonner';
import { db } from '../../firebase';
import { collection, query, getDocs, limit, where, onSnapshot, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';
import { GameType } from '../../types';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Dashboard']);
  const [pendingControls, setPendingControls] = useState<Record<string, any>>({});

  const navigate = useNavigate();

  useEffect(() => {
    // Real-time listener for pending controls
    const q = query(
      collection(db, 'game_controls'),
      where('status', '==', 'pending'),
      where('type', '==', 'wingo')
    );
    
    // Use serverTimestamps: 'estimate' for immediate local feedback on selection
    const unsubscribe = onSnapshot(q, (snap) => {
      const mapping: Record<string, any> = {};
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      // Sort in memory - handle null createdAt by putting them at the top (newest)
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || Date.now();
        const timeB = b.createdAt?.toMillis() || Date.now();
        return timeB - timeA;
      });
      
      docs.forEach(data => {
        if (!mapping[data.gameType]) {
          mapping[data.gameType] = data;
        }
      });
      setPendingControls(mapping);
    });

    return () => unsubscribe();
  }, []);

  const handleManualControl = async (type: GameType, value: string) => {
    try {
      const current = pendingControls[type];
      
      let targetSize: string | undefined = undefined;
      let targetNum: number | undefined = undefined;
      
      if (value === 'Big' || value === 'Small') {
        targetSize = value;
      } else if (!isNaN(parseInt(value))) {
        targetNum = parseInt(value);
      }
      
      // Determine if we are clearing or setting
      const isAlreadySelected = value === 'Auto' || 
         (targetSize && current?.targetSize === targetSize && current?.targetNumber === undefined) ||
         (targetNum !== undefined && current?.targetNumber === targetNum);

      // Optimistic update for UI responsiveness
      const nextControls = { ...pendingControls };
      if (isAlreadySelected) {
        delete nextControls[type];
        setPendingControls(nextControls);
        await setGameControl(type, undefined, undefined);
        toast.info(`Reset ${type} to System Default`);
      } else {
        nextControls[type] = { targetSize, targetNumber: targetNum, status: 'pending' };
        setPendingControls(nextControls);
        await setGameControl(type, targetSize, targetNum);
        toast.success(`Forced ${value} for ${type}`);
      }
    } catch (e) {
       // Refresh or handle error
       toast.error('Failed to update control');
    }
  };

  const [currentView, setCurrentView] = useState('dashboard');
  const [adjustingBalance, setAdjustingBalance] = useState<{uid: string, amount: string} | null>(null);

  useEffect(() => {
    fetchData();
  }, [currentView]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, set] = await Promise.all([getAdminStats(), getSystemSettings()]);
      setStats(s);
      setSettings(set);
    } catch (error) {
      toast.error('Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (key: keyof SystemSettings, value: any) => {
    try {
      await updateSystemSettings({ [key]: value });
      setSettings(prev => prev ? { ...prev, [key]: value } : null);
      toast.success('Setting updated');
    } catch (error) {
      toast.error('Failed to update setting');
    }
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const toggleMenu = (menu: string) => {
    setExpandedMenus(prev => 
      prev.includes(menu) ? prev.filter(m => m !== menu) : [...prev, menu]
    );
  };

  const handleFlushMines = async () => {
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
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f1f3f9] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers, sub: 'View Details', icon: Users, color: 'bg-purple-600', view: 'Users' },
    { label: "Today's Recharge", value: formatCurrency(stats?.todayRecharge || 0), sub: 'View Details', icon: ArrowDownCircle, color: 'bg-purple-600', view: 'Deposit Update' },
    { label: "Today's Withdrawal", value: formatCurrency(stats?.todayWithdrawal || 0), sub: 'View Details', icon: ArrowUpCircle, color: 'bg-purple-600', view: 'Withdraw Sent' },
    { label: 'User Balance', value: formatCurrency(stats?.totalBalance || 0), sub: 'View Details', icon: Wallet, color: 'bg-purple-600', view: 'Users' },
    { label: 'Pending Recharge', value: formatCurrency(stats?.pendingRecharge || 0), sub: 'View Details', icon: Clock, color: 'bg-purple-600', view: 'Deposit Update' },
    { label: 'Success Recharge', value: stats?.successRecharge, sub: 'View Details', icon: CheckCircle2, color: 'bg-purple-600', view: 'Deposit Update' },
    { label: 'Total Withdrawal', value: formatCurrency(stats?.totalWithdrawal || 0), sub: 'View Details', icon: DollarSign, color: 'bg-purple-600', view: 'Withdraw Sent' },
    { label: 'Withdrawal Requests', value: stats?.withdrawalRequests, sub: 'View Details', icon: Clock, color: 'bg-purple-600', view: 'Withdraw Apply' },
    { label: "Today's Total Bet", value: formatCurrency(stats?.todayBets || 0), sub: 'View Details', icon: Gamepad2, color: 'bg-purple-600' },
    { label: "Today's Total Win", value: formatCurrency(stats?.todayWins || 0), sub: 'View Details', icon: Trophy, color: 'bg-purple-600' },
    { label: "Today's Profit", value: formatCurrency(stats?.todayProfit || 0), sub: 'View Details', icon: TrendingUp, color: 'bg-purple-600' },
  ];

  return (
    <div className="flex h-screen bg-[#f1f3f9]">
      {/* Sidebar */}
      <div className={cn(
        "bg-[#7c3aed] text-white flex flex-col transition-all duration-300 shadow-xl overflow-hidden",
        sidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-4 border-b border-white/10 flex flex-col items-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-2">
            <Gamepad2 className="w-8 h-8" />
          </div>
          {sidebarOpen && (
            <>
              <p className="font-bold text-sm tracking-tighter uppercase">Igaming Developers</p>
              <p className="text-[10px] opacity-70">Admin</p>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 space-y-2">
          <MenuItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={currentView === 'dashboard'}
            sidebarOpen={sidebarOpen}
            onClick={() => { setCurrentView('dashboard'); setExpandedMenus(['Dashboard']); }}
          />
          
          <MenuSection 
            icon={Trophy} 
            label="WinGo Manager" 
            sidebarOpen={sidebarOpen}
            isOpen={expandedMenus.includes('WinGo')}
            onClick={() => toggleMenu('WinGo')}
            onItemClick={(item: string) => setCurrentView(item)}
            items={['Random ON/OFF', 'Auto Control', 'Game Settings']}
          />

          <MenuSection 
            icon={Gamepad2} 
            label="Casino Manager" 
            sidebarOpen={sidebarOpen}
            isOpen={expandedMenus.includes('Casino')}
            onClick={() => toggleMenu('Casino')}
            onItemClick={(item: string) => setCurrentView(item)}
            items={['Mines Control', 'Roulette Control', 'Casino Status']}
          />

          <MenuSection 
            icon={Wallet} 
            label="Finance" 
            sidebarOpen={sidebarOpen}
            isOpen={expandedMenus.includes('Finance')}
            onClick={() => toggleMenu('Finance')}
            onItemClick={(item: string) => setCurrentView(item)}
            items={[
              'Add UPI', 'USDT RATE', 'Add USDT', 
              'Add Upi Image', 'Add USDT Image', 'Deposit Update', 
              'Withdraw Apply', 'Rupeelink Withdrawal', 'Withdraw Sent', 'Withdraw Reject'
            ]}
          />

          <MenuSection 
            icon={MessageSquare} 
            label="Support" 
            sidebarOpen={sidebarOpen}
            isOpen={expandedMenus.includes('Support')}
            onClick={() => toggleMenu('Support')}
            onItemClick={(item: string) => setCurrentView(item)}
            items={['Tickets', 'Contacts']}
          />

          <MenuSection 
            icon={Users} 
            label="Manage Game" 
            sidebarOpen={sidebarOpen}
            isOpen={expandedMenus.includes('Manage')}
            onClick={() => toggleMenu('Manage')}
            onItemClick={(item: string) => setCurrentView(item)}
            items={[
               'Users', 'Daily Salary', 'Gift Code', 'Banner Settings', 'Popup Settings', 'Telegram', 
               'Add Admin', 'Demo User', 'Agent User', 'Edit Bank Details',
               'Withdrawal Limit', 'First Deposit Bonus', 'Update Game Commission',
               'Update Turnover', 'Add Advanced Functions', 'Hold Wallet', 'Get User Report'
            ]}
          />

          <MenuItem 
            icon={LogOut} 
            label="Go To Website" 
            sidebarOpen={sidebarOpen}
            onClick={() => navigate('/')}
          />
        </nav>

        <div className="p-4 bg-white/5 text-[10px] text-center opacity-60">
          Powered by Igaming Developers
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#7c3aed] text-white flex items-center justify-between px-6 shadow-md z-10 transition-all">
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="p-2 hover:bg-white/10 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-bold tracking-tight uppercase text-sm">{currentView} Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-lg transition-transform active:rotate-180">
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {currentView === 'dashboard' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {statCards.map((card, idx) => (
                <div 
                  key={idx} 
                  onClick={() => card.view && setCurrentView(card.view)}
                  className="bg-[#a855f7] rounded-3xl p-6 text-white shadow-xl transition-all hover:scale-[1.03] active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4 text-white">
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <card.icon className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{card.label}</p>
                        <h3 className="text-2xl font-black italic">{card.value}</h3>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <span className="text-[10px] font-black uppercase tracking-tighter">{card.sub}</span>
                    <ChevronRight className="w-4 h-4 opacity-40 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            settings ? (
              <AdminSubView 
                 view={currentView} 
                 settings={settings} 
                 updateSetting={handleUpdateSetting}
                 onBack={() => setCurrentView('dashboard')}
                 pendingControls={pendingControls}
                 handleManualControl={handleManualControl}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-xl">
                 <RefreshCw className="w-12 h-12 text-[#7c3aed] animate-spin mb-4" />
                 <p className="text-gray-500 font-bold uppercase tracking-widest">Loading Settings...</p>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
}

function AdminSubView({ view, settings, updateSetting, onBack, pendingControls, handleManualControl }: any) {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [poolStats, setPoolStats] = React.useState<Record<string, any>>({});
  const [giftCodes, setGiftCodes] = React.useState<any[]>([]);
  const [newGift, setNewGift] = React.useState({ code: '', amount: 10, maxUses: 100 });
  const [pendingTrans, setPendingTrans] = React.useState<any[]>([]);
  const [txnFilter, setTxnFilter] = React.useState<'pending' | 'history'>('pending');
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [minesConfig, setMinesConfig] = React.useState({ targetUser: 'global', mines: '' });
  const [rouletteConfig, setRouletteConfig] = React.useState({ targetUser: 'global', number: 0 });
  const [minesSessions, setMinesSessions] = React.useState<any[]>([]);

  React.useEffect(() => {
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

  const handleFlushMines = async () => {
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
    }
  };

  const handleCreateGift = async () => {
    if (!newGift.code) return toast.error('Enter code');
    try {
      await createGiftCode(newGift.code, newGift.amount, newGift.maxUses);
      toast.success('Gift code created');
      setNewGift({ code: '', amount: 10, maxUses: 100 });
      fetchGiftCodes();
    } catch (e) {
      toast.error('Failed to create');
    }
  };

  const fetchGiftCodes = async () => {
    const codes = await getGiftCodes();
    setGiftCodes(codes);
  };

  const handleDeleteGift = async (id: string) => {
    try {
      await deleteGiftCode(id);
      fetchGiftCodes();
      toast.success('Deleted');
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const fetchTransactions = async (type: 'deposit' | 'withdraw') => {
    setLoading(true);
    try {
      const data = await getPendingTransactions(type);
      setPendingTrans(data);
    } catch (e) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleTransAction = async (id: string, status: 'completed' | 'rejected', uid: string) => {
    setProcessingId(id);
    try {
      await updateTransactionStatus(id, status, uid);
      toast.success(`Transaction ${status}`);
    } catch (e) {
      toast.error('Failed to update transaction');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMinesControl = async () => {
    try {
      const minePositions = minesConfig.mines.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      await setMinesControl(minesConfig.targetUser, minePositions);
      toast.success('Mines control scheduled');
      setMinesConfig({ targetUser: 'global', mines: '' });
    } catch (e) {
      toast.error('Failed to schedule Mines control');
    }
  };

  const handleRouletteControl = async () => {
    try {
      await setRouletteControl(rouletteConfig.targetUser, rouletteConfig.number);
      toast.success('Roulette control scheduled');
    } catch (e) {
      toast.error('Failed to schedule Roulette control');
    }
  };

  React.useEffect(() => {
    if (view === 'Users') {
      fetchUsers();
    }
    if (view === 'Gift Code') {
      fetchGiftCodes();
    }
    if (view === 'Deposit Update' || view === 'Withdraw Apply') {
      const type = view === 'Deposit Update' ? 'deposit' : 'withdraw';
      let q;
      if (txnFilter === 'pending') {
        q = query(
          collection(db, 'transactions'),
          where('type', '==', type),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'transactions'),
          where('type', '==', type),
          where('status', '!=', 'pending'),
          orderBy('status'), // Needed for inequality filter
          limit(50)
        );
        // Note: Firestore inequality filter requires ordering by that field first if using orderBy on other fields
        // Actually, simplest is just fetch status != pending and order by status.
        // But users want to see most recent.
        // Let's use a simpler approach: fetch all type == 'deposit' limited to 100 and filter client side.
        q = query(
          collection(db, 'transactions'),
          where('type', '==', type),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
      }
      
      const unsub = onSnapshot(q, (snap) => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (txnFilter === 'pending') {
          docs = docs.filter((d: any) => d.status === 'pending');
        } else {
          docs = docs.filter((d: any) => d.status !== 'pending');
        }
        setPendingTrans(docs);
      });
      return () => unsub();
    }
    if (view === 'Game Settings') {
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
  }, [view]);

  const fetchUsers = async () => {
    const data = await getUsers(searchTerm);
    setUsers(data);
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 mb-6">
        <h2 className="text-2xl font-black text-[#7c3aed] mb-8 uppercase tracking-tighter flex items-center gap-3">
          <Settings className="w-8 h-8" />
          {view}
        </h2>

        {view === 'Users' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-200">
              <Search className="w-5 h-5 ml-2 text-gray-400" />
              <input 
                 type="text" 
                 placeholder="Search user by UID or phone..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="flex-1 bg-transparent py-2 outline-none text-sm font-bold"
              />
              <button 
                onClick={fetchUsers}
                className="bg-[#7c3aed] text-white px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-tighter"
              >
                Search
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b border-gray-100 uppercase text-gray-400">
                    <th className="py-4">User</th>
                    <th className="py-4">UID</th>
                    <th className="py-4">Balance</th>
                    <th className="py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-4">{u.username || 'N/A'}</td>
                      <td className="py-4 text-[#7c3aed]">{u.id}</td>
                      <td className="py-4">₹{u.balance?.toFixed(2)}</td>
                      <td className="py-4">
                        <button className="text-[#a855f7] hover:underline uppercase">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination Placeholder */}
            <div className="flex items-center justify-center gap-2 pt-4">
               {[1,2,3,4,5,6,7,8,9,10].map(p => (
                 <button key={p} className="w-8 h-8 rounded-lg bg-gray-100 text-[10px] font-black hover:bg-[#7c3aed] hover:text-white transition-all">
                   {p}
                 </button>
               ))}
            </div>
          </div>
        )}

        {view === 'Popup Settings' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
               <h3 className="text-sm font-black text-[#7c3aed] uppercase tracking-widest mb-6">Login Popup Settings</h3>
               <div className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Popup Banner URL (Leave empty for default bonus popup)</label>
                     <input 
                      type="text" 
                      value={settings.popupBannerUrl || ''}
                      onChange={e => updateSetting('popupBannerUrl', e.target.value)}
                      placeholder="https://..."
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                     />
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-700 uppercase tracking-tighter">Enable Popup</span>
                        <span className="text-[10px] text-gray-400 font-bold">Show popup to users when they login today</span>
                     </div>
                     <button 
                        onClick={() => updateSetting('showPopup', !settings.showPopup)}
                        className={cn(
                          "w-12 h-6 rounded-full p-1 transition-colors relative",
                          settings.showPopup ? "bg-emerald-500" : "bg-gray-300"
                        )}
                      >
                         <div className={cn(
                            "w-4 h-4 bg-white rounded-full shadow-md transition-transform",
                            settings.showPopup ? "translate-x-6" : "translate-x-0"
                         )} />
                      </button>
                  </div>
               </div>
            </div>
            {settings.popupBannerUrl && (
              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm max-w-xs mx-auto text-center">
                 <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Preview</p>
                 <img src={settings.popupBannerUrl} alt="Popup Preview" className="w-full rounded-2xl shadow-lg" />
              </div>
            )}
          </div>
        )}

        {view === 'Banner Settings' && (
          <div className="space-y-8">
            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
               <h3 className="text-sm font-black text-[#7c3aed] uppercase tracking-widest mb-4">Add New Banner</h3>
               <div className="flex gap-4">
                  <input 
                    type="text" 
                    placeholder="Enter Image URL..."
                    id="new-banner-url"
                    className="flex-1 p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                  />
                  <button 
                    onClick={() => {
                      const input = document.getElementById('new-banner-url') as HTMLInputElement;
                      if (!input.value) return toast.error('Enter URL');
                      const newBanners = [...(settings.banners || []), { id: Date.now().toString(), image: input.value }];
                      updateSetting('banners', newBanners);
                      input.value = '';
                    }}
                    className="bg-[#7c3aed] text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg"
                  >
                    Add Banner
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(settings.banners || []).map((banner: any, index: number) => (
                <div key={banner.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm relative group">
                  <img 
                    src={banner.image} 
                    alt="Banner" 
                    className="w-full h-32 object-cover rounded-2xl mb-4"
                    onError={(e) => e.currentTarget.src = 'https://picsum.photos/seed/error/800/400'}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Banner #{index + 1}</span>
                    <button 
                      onClick={() => {
                        const newBanners = (settings.banners || []).filter((b: any) => b.id !== banner.id);
                        updateSetting('banners', newBanners);
                      }}
                      className="text-rose-500 hover:bg-rose-50 p-2 rounded-xl"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}        {view === 'Deposit Update' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-emerald-500 uppercase tracking-widest">Deposit Requests</h3>
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                <button 
                  onClick={() => setTxnFilter('pending')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    txnFilter === 'pending' ? "bg-[#7c3aed] text-white" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  Pending
                </button>
                <button 
                  onClick={() => setTxnFilter('history')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    txnFilter === 'history' ? "bg-[#7c3aed] text-white" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  History
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {pendingTrans.map((tx) => (
                <div key={tx.id} className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 flex items-center justify-between relative overflow-hidden">
                  {tx.status !== 'pending' && (
                    <div className={cn(
                      "absolute top-0 right-0 px-6 py-1 text-[8px] font-black uppercase tracking-[0.2em] transform rotate-45 translate-x-6 translate-y-2 shadow-sm text-white",
                      tx.status === 'completed' ? "bg-emerald-500" : "bg-rose-500"
                    )}>
                      {tx.status}
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                      <ArrowDownCircle className={cn("w-6 h-6", tx.status === 'completed' ? "text-emerald-500" : tx.status === 'rejected' ? "text-rose-500" : "text-emerald-500")} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-800">₹{tx.amount}</p>
                      <p className="text-[10px] text-gray-400 font-bold">UID: {tx.uid}</p>
                      <p className="text-[10px] text-gray-400">Time: {tx.createdAt?.toDate().toLocaleString()}</p>
                      {tx.transactionId && <p className="text-[10px] text-purple-600 font-black mt-1">TXN: {tx.transactionId}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {tx.proofUrl && (
                      <a 
                        href={tx.proofUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="group relative w-16 h-16 rounded-xl overflow-hidden border-2 border-purple-100 hover:border-purple-500 transition-all"
                      >
                        <img src={tx.proofUrl} alt="Proof" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </a>
                    )}
                    
                    {tx.status === 'pending' && (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleTransAction(tx.id, 'rejected', tx.uid)}
                          disabled={processingId === tx.id}
                          className="bg-rose-500/10 text-rose-500 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                        >
                          {processingId === tx.id ? '...' : 'Reject'}
                        </button>
                        <button 
                          onClick={() => handleTransAction(tx.id, 'completed', tx.uid)}
                          disabled={processingId === tx.id}
                          className="bg-emerald-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:translate-y-[-2px] transition-all disabled:opacity-50"
                        >
                          {processingId === tx.id ? 'Processing...' : 'Approve'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {pendingTrans.length === 0 && (
                <div className="py-20 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-100">
                  <p className="text-xs font-black text-gray-300 uppercase italic tracking-widest">No {txnFilter} deposits</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'Withdraw Apply' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest">Withdrawal Requests</h3>
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                <button 
                  onClick={() => setTxnFilter('pending')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    txnFilter === 'pending' ? "bg-orange-500 text-white" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  Pending
                </button>
                <button 
                  onClick={() => setTxnFilter('history')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    txnFilter === 'history' ? "bg-orange-500 text-white" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  History
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {pendingTrans.map((tx) => (
                <div key={tx.id} className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 flex items-center justify-between relative overflow-hidden">
                  {tx.status !== 'pending' && (
                    <div className={cn(
                      "absolute top-0 right-0 px-6 py-1 text-[8px] font-black uppercase tracking-[0.2em] transform rotate-45 translate-x-6 translate-y-2 shadow-sm text-white",
                      tx.status === 'completed' ? "bg-emerald-500" : "bg-rose-500"
                    )}>
                      {tx.status}
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                      <ArrowUpCircle className={cn("w-6 h-6", tx.status === 'completed' ? "text-emerald-500" : tx.status === 'rejected' ? "text-rose-500" : "text-orange-500")} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-800">₹{tx.amount}</p>
                      <p className="text-[10px] text-gray-400 font-bold">UID: {tx.uid}</p>
                      <p className="text-[10px] text-gray-400">Method: {tx.description}</p>
                      <p className="text-[10px] text-gray-400 italic">Time: {tx.createdAt?.toDate().toLocaleString()}</p>
                    </div>
                  </div>
                  {tx.status === 'pending' && (
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleTransAction(tx.id, 'rejected', tx.uid)}
                        disabled={processingId === tx.id}
                        className="bg-rose-500/10 text-rose-500 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                      >
                        {processingId === tx.id ? '...' : 'Reject'}
                      </button>
                      <button 
                        onClick={() => handleTransAction(tx.id, 'completed', tx.uid)}
                        disabled={processingId === tx.id}
                        className="bg-[#7c3aed] text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-500/20 hover:translate-y-[-2px] transition-all disabled:opacity-50"
                      >
                        {processingId === tx.id ? 'Processing...' : 'Set Success'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {pendingTrans.length === 0 && (
                <div className="py-20 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-100">
                  <p className="text-xs font-black text-gray-300 uppercase italic tracking-widest">No {txnFilter} withdrawals</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'Mines Control' && (
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
              
              <button 
                onClick={handleFlushMines}
                className="mt-8 w-full bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] transition-all"
              >
                Force Flush Active Sessions
              </button>
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
                     onClick={() => updateSetting('minesMode', item.mode)}
                     className={cn(
                       "relative group p-6 rounded-[32px] border transition-all duration-300 text-left overflow-hidden",
                       isActive 
                        ? "bg-[#1f2228] border-purple-500/50 shadow-2xl shadow-purple-500/10" 
                        : "bg-white border-gray-100 hover:border-gray-200"
                     )}
                   >
                      {isActive && (
                        <div className="absolute top-4 right-4 bg-purple-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest animate-in zoom-in duration-300">
                           Active
                        </div>
                      )}
                      
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
                        isActive ? item.color : "bg-gray-50 text-gray-400 group-hover:scale-110"
                      )}>
                         <item.icon className={cn("w-6 h-6", isActive ? "text-white" : "text-gray-400")} />
                      </div>
                      
                      <h4 className={cn(
                        "text-sm font-black uppercase tracking-tight italic mb-1",
                        isActive ? "text-white" : "text-gray-800"
                      )}>
                        {item.label}
                      </h4>
                      <p className={cn(
                        "text-[10px] leading-relaxed font-bold uppercase",
                        isActive ? "text-gray-400" : "text-gray-400"
                      )}>
                        {item.desc}
                      </p>
                   </button>
                 );
               })}
            </div>

            {/* Live Sessions Table */}
            <div className="bg-white rounded-[40px] border border-gray-100 overflow-hidden shadow-sm">
               <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-3">
                     <TrendingUp className="w-5 h-5 text-purple-500" />
                     <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest italic">Live Mines Sessions</h3>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                     <span className="text-[10px] font-black text-gray-400 uppercase">{minesSessions.filter(s => s.status === 'playing').length} Players Playing</span>
                  </div>
               </div>
               
               <div className="overflow-x-auto">
                  <table className="w-full">
                     <thead>
                        <tr className="border-b border-gray-50">
                           <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Player</th>
                           <th className="px-8 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Bet (₹)</th>
                           <th className="px-8 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Mines</th>
                           <th className="px-8 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Stage</th>
                           <th className="px-8 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Profit (₹)</th>
                           <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Map View</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {minesSessions.map((session) => (
                           <tr key={session.id} className="group hover:bg-gray-50/50 transition-colors">
                              <td className="px-8 py-5">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-[#7c3aed] font-black italic">
                                       {session.username?.[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                       <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{session.username}</p>
                                       <p className="text-[8px] text-gray-400 font-bold font-mono">ID: {session.id.slice(-6)}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-8 py-5 text-center font-black text-gray-800 text-xs">
                                 ₹{session.betAmount}
                              </td>
                              <td className="px-8 py-5 text-center">
                                 <span className="bg-rose-50 text-rose-500 px-3 py-1 rounded-lg text-[10px] font-black italic">
                                    {session.mineCount} Boms
                                 </span>
                              </td>
                              <td className="px-8 py-5 text-center">
                                 <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black italic">
                                    STEP {session.revealedCount}
                                 </span>
                              </td>
                              <td className="px-8 py-5 text-center font-black text-emerald-500 text-xs italic">
                                 +₹{session.winAmount || 0}
                              </td>
                              <td className="px-8 py-5">
                                 <div className="flex justify-end">
                                    <div className="grid grid-cols-5 gap-0.5 p-1 bg-gray-100 rounded-lg">
                                       {Array.from({ length: 25 }).map((_, idx) => {
                                          const isRevealed = session.revealedIndices?.includes(idx);
                                          return (
                                             <div key={idx} className={cn(
                                                "w-2.5 h-2.5 rounded-sm",
                                                isRevealed ? (session.status === 'lost' ? "bg-rose-500" : "bg-emerald-500") : "bg-white"
                                             )} />
                                          );
                                       })}
                                    </div>
                                 </div>
                              </td>
                           </tr>
                        ))}
                        {minesSessions.length === 0 && (
                           <tr>
                              <td colSpan={6} className="py-20 text-center">
                                 <div className="flex flex-col items-center justify-center opacity-20">
                                    <Bomb className="w-12 h-12 mb-4" />
                                    <p className="text-xs font-black uppercase tracking-widest italic">No active sessions</p>
                                 </div>
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Manual Target Grid */}
            <div className="bg-gray-50 p-8 rounded-[40px] border border-gray-100">
               <div className="flex items-center justify-between mb-8">
                  <div className="space-y-1">
                     <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest italic">Precision Mine Placement</h3>
                     <p className="text-[10px] text-gray-400 font-bold uppercase">Manually override the next game bomb positions</p>
                  </div>
                  <div className="flex items-center gap-3">
                     <input 
                       type="text" 
                       value={minesConfig.targetUser}
                       onChange={e => setMinesConfig({...minesConfig, targetUser: e.target.value})}
                       placeholder="Target User (username or 'global')"
                       className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#7c3aed] w-48 shadow-sm"
                     />
                     <button 
                       onClick={async () => {
                         try {
                           const minePositions = minesConfig.mines.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                           if (minePositions.length === 0) return toast.error('Select at least one mine on the grid');
                           await setMinesControl(minesConfig.targetUser, minePositions);
                           toast.success('Mines control scheduled');
                           setMinesConfig({ targetUser: 'global', mines: '' });
                         } catch (e) {
                           toast.error('Failed to schedule Mines control');
                         }
                       }}
                       className="bg-[#7c3aed] text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-purple-500/20 hover:translate-y-[-2px] transition-all"
                     >
                       Set Bombs
                     </button>
                  </div>
               </div>

               <div className="flex flex-col lg:flex-row gap-8 items-start">
                  <div className="grid grid-cols-5 gap-2 bg-white p-4 rounded-[32px] border border-gray-200 shadow-sm max-w-sm w-full mx-auto md:mx-0">
                     {Array.from({ length: 25 }).map((_, idx) => {
                        const selectedMines = minesConfig.mines.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                        const isSelected = selectedMines.includes(idx);
                        return (
                           <button
                             key={idx}
                             onClick={() => {
                                const newMines = isSelected 
                                   ? selectedMines.filter(m => m !== idx)
                                   : [...selectedMines, idx];
                                setMinesConfig({ ...minesConfig, mines: newMines.join(',') });
                             }}
                             className={cn(
                                "aspect-square rounded-xl flex items-center justify-center transition-all duration-300 border-2",
                                isSelected 
                                  ? "bg-rose-500 border-rose-600 shadow-lg shadow-rose-200 scale-105" 
                                  : "bg-gray-50 border-gray-100 hover:border-gray-200"
                             )}
                           >
                              {isSelected ? (
                                <Bomb className="w-5 h-5 text-white" />
                              ) : (
                                <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
                              )}
                           </button>
                        );
                     })}
                  </div>

                  <div className="flex-1 space-y-4">
                     <div className="p-6 bg-purple-50 rounded-3xl border border-purple-100">
                        <h4 className="text-xs font-black text-purple-900 uppercase mb-2">How it works</h4>
                        <ul className="text-[10px] text-purple-800 space-y-2 font-bold list-disc pl-4 uppercase leading-relaxed">
                           <li>Click on the grid to direct exactly where bombs will appear.</li>
                           <li>Selected tiles (Red) will be forced to contain BOMBS.</li>
                           <li>Target 'global' to affect the very next session by ANY user.</li>
                           <li>Target a username to bait a specific player session.</li>
                        </ul>
                     </div>
                     <div className="bg-white p-4 rounded-2xl border border-gray-100">
                        <p className="text-[10px] text-gray-500 font-black uppercase mb-1 tracking-widest">Active Selections</p>
                        <code className="text-[10px] font-mono font-black text-purple-500">{minesConfig.mines || 'Grid is empty'}</code>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}
        {view === 'Roulette Control' && (
          <div className="space-y-8">
            <div className="bg-gray-50 p-8 rounded-[40px] border border-gray-100">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Roulette Outcome Control</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Target User</label>
                   <input 
                    type="text" 
                    value={rouletteConfig.targetUser}
                    onChange={e => setRouletteConfig({...rouletteConfig, targetUser: e.target.value})}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Result Number (0-12)</label>
                   <input 
                    type="number" 
                    min={0}
                    max={12}
                    value={rouletteConfig.number}
                    onChange={e => setRouletteConfig({...rouletteConfig, number: parseInt(e.target.value)})}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                   />
                </div>
              </div>
              <button 
                onClick={handleRouletteControl}
                className="mt-6 w-full bg-[#7c3aed] text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:translate-y-[-2px] transition-all"
              >
                Schedule Next Spin Result
              </button>
            </div>
          </div>
        )}

        {view === 'Casino Status' && (
           <div className="space-y-8">
              <div className="bg-gray-50 p-8 rounded-[40px] border border-gray-100 shadow-sm">
                 <div className="flex items-center justify-between mb-6">
                   <h3 className="text-sm font-black text-[#7c3aed] uppercase tracking-widest">Casino Games Visibility Control</h3>
                   {Object.keys(settings?.gameStatuses || {}).length === 0 && (
                     <button 
                       onClick={() => {
                         const defaults = {
                           '1m': true, '30s': true, '3m': true, '5m': true,
                           'mines': true, 'roulette': true, 'wingo': true,
                           'k3': false, '5d': false, 'trx': false
                         };
                         updateSetting('gameStatuses', defaults);
                       }}
                       className="text-[10px] font-black uppercase text-[#7c3aed] hover:underline"
                     >
                       Initialize Defaults
                     </button>
                   )}
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(settings?.gameStatuses || {}).length === 0 ? (
                      <div className="col-span-full py-12 text-center text-gray-400 font-bold uppercase text-xs">
                         No games configured. Click "Initialize Defaults" above.
                      </div>
                    ) : (
                      Object.entries(settings?.gameStatuses || {}).map(([gameId, isActive]) => (
                         <div key={gameId} className="bg-white p-6 rounded-3xl border border-gray-100 flex items-center justify-between shadow-sm group hover:border-[#7c3aed] transition-all">
                            <div>
                               <p className="text-xs font-black text-gray-800 uppercase tracking-tighter italic">{gameId}</p>
                               <p className={cn(
                                  "text-[10px] font-bold uppercase",
                                  isActive ? "text-emerald-500" : "text-rose-500"
                               )}>
                                  Status: {isActive ? 'Live (Continue)' : 'Off (Upcoming)'}
                               </p>
                            </div>
                            <button 
                               onClick={() => {
                                  const newStatuses = { ...(settings?.gameStatuses || {}), [gameId]: !isActive };
                                  updateSetting('gameStatuses', newStatuses);
                               }}
                              className={cn(
                                "w-12 h-6 rounded-full p-1 transition-colors relative",
                                isActive ? "bg-emerald-500" : "bg-gray-300"
                              )}
                            >
                               <div className={cn(
                                  "w-4 h-4 bg-white rounded-full shadow-md transition-transform",
                                  isActive ? "translate-x-6" : "translate-x-0"
                               )} />
                            </button>
                         </div>
                      ))
                    )}
                 </div>
              </div>
           </div>
        )}

        {view === 'Random ON/OFF' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">Enable or disable random result generation for Wingo games.</p>
            <div className="flex items-center gap-4">
               <button 
                  onClick={() => updateSetting('wingoRandomMode', !settings?.wingoRandomMode)}
                  className={cn(
                    "w-20 h-10 rounded-full p-1 transition-colors relative",
                    settings?.wingoRandomMode ? "bg-[#7c3aed]" : "bg-gray-300"
                  )}
               >
                  <div className={cn(
                    "w-8 h-8 bg-white rounded-full shadow-md transition-transform",
                    settings?.wingoRandomMode ? "translate-x-10" : "translate-x-0"
                  )} />
               </button>
               <span className="font-bold text-gray-700">{settings?.wingoRandomMode ? 'System is in Random Mode' : 'Random Mode Disabled'}</span>
            </div>
          </div>
        )}

        {view === 'Auto Control' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">If ON, the game will automatically select the result where users have bet the LEAST amount of money.</p>
            <div className="flex items-center gap-4">
               <button 
                  onClick={() => updateSetting('wingoAutoControl', !settings?.wingoAutoControl)}
                  className={cn(
                    "w-20 h-10 rounded-full p-1 transition-colors relative",
                    settings?.wingoAutoControl ? "bg-[#7c3aed]" : "bg-gray-300"
                  )}
               >
                  <div className={cn(
                    "w-8 h-8 bg-white rounded-full shadow-md transition-transform",
                    settings?.wingoAutoControl ? "translate-x-10" : "translate-x-0"
                  )} />
               </button>
               <span className="font-bold text-gray-700">{settings?.wingoAutoControl ? 'Auto Control is ACTIVE' : 'Auto Control is INACTIVE'}</span>
            </div>
          </div>
        )}

        {view === 'Game Settings' && (
          <div className="space-y-6">
            <div className="bg-[#7c3aed]/5 p-6 rounded-[32px] border border-[#7c3aed]/20 flex flex-wrap gap-4 items-center justify-between">
               <div>
                  <h3 className="text-sm font-black text-[#7c3aed] uppercase tracking-widest">Global Wingo Control</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase italic">Switch between fully random and house-favorable modes</p>
               </div>
               <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      updateSetting('wingoRandomMode', true);
                      updateSetting('wingoAutoControl', false);
                    }}
                    className={cn(
                      "px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg",
                      settings?.wingoRandomMode ? "bg-[#7c3aed] text-white shadow-purple-500/20" : "bg-white text-gray-400 hover:bg-gray-50"
                    )}
                  >
                    Random Mode
                  </button>
                  <button 
                    onClick={() => {
                      updateSetting('wingoRandomMode', false);
                      updateSetting('wingoAutoControl', true);
                    }}
                    className={cn(
                      "px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg",
                      settings?.wingoAutoControl ? "bg-orange-500 text-white shadow-orange-500/20" : "bg-white text-gray-400 hover:bg-gray-50"
                    )}
                  >
                    Manual (Least Amount)
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {['30s', '1m', '3m', '5m'].map((type) => {
                const pool = poolStats[type] || { total: 0, Big: 0, Small: 0, Red: 0, Green: 0, Violet: 0, numbers: Array(10).fill(0) };
                return (
                   <div key={type} className="border border-gray-100 p-6 rounded-3xl bg-gray-50 flex flex-col group hover:shadow-xl transition-all">
                      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                         <h3 className="font-black text-[#7c3aed] uppercase tracking-tighter">WinGo {type}</h3>
                         <div className="text-right">
                           <p className="text-[10px] text-gray-400 font-black uppercase">Current Pool</p>
                           <span className="text-sm font-black text-[#7c3aed] italic">{formatCurrency(pool.total)}</span>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                         <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <span className="text-[10px] uppercase font-black text-gray-400">BIG</span>
                            <span className="text-xs font-black text-orange-500">{formatCurrency(pool.Big)}</span>
                         </div>
                         <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <span className="text-[10px] uppercase font-black text-gray-400">SMALL</span>
                            <span className="text-xs font-black text-sky-500">{formatCurrency(pool.Small)}</span>
                         </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-white p-2 rounded-xl text-center border border-gray-100">
                           <p className="text-[8px] font-black text-red-500">RED</p>
                           <p className="text-[10px] font-bold">{pool.Red}</p>
                        </div>
                        <div className="bg-white p-2 rounded-xl text-center border border-gray-100">
                           <p className="text-[8px] font-black text-green-500">GREEN</p>
                           <p className="text-[10px] font-bold">{pool.Green}</p>
                        </div>
                        <div className="bg-white p-2 rounded-xl text-center border border-gray-100">
                           <p className="text-[8px] font-black text-purple-500">VIOLET</p>
                           <p className="text-[10px] font-bold">{pool.Violet}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-2 mb-6">
                         {pool.numbers.map((amt: number, n: number) => (
                            <div key={n} className="bg-white p-2 rounded-xl text-center border border-white hover:border-[#7c3aed] transition-colors shadow-sm">
                               <p className="text-[10px] font-black text-gray-400">{n}</p>
                               <p className={cn(
                                 "text-[10px] font-black italic",
                                 amt > 0 ? "text-[#7c3aed]" : "text-gray-200"
                               )}>{amt}</p>
                            </div>
                         ))}
                      </div>

                      <div className="mt-auto pt-4 border-t border-gray-200 flex flex-col gap-3">
                         <p className="text-[10px] text-gray-400 uppercase font-black">Admin Manual Control</p>
                         <select 
                            value={pendingControls[type]?.targetSize || "Auto"}
                            onChange={(e) => handleManualControl(type as GameType, e.target.value)}
                            className={cn(
                              "bg-white border-2 text-xs p-3 rounded-xl font-bold w-full outline-none transition-all",
                              pendingControls[type]?.targetSize ? "border-[#7c3aed] text-[#7c3aed]" : "border-gray-100"
                            )}
                         >
                            <option value="Auto">System Default (Auto)</option>
                            <option value="Big">Force Big Only</option>
                            <option value="Small">Force Small Only</option>
                         </select>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
                         <p className="text-[10px] text-gray-400 uppercase font-black">Force Specific Number</p>
                         <div className="grid grid-cols-5 gap-2">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                               <button 
                                  key={n}
                                  onClick={() => handleManualControl(type as GameType, n.toString())}
                                  className={cn(
                                    "h-10 text-xs font-black rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95 border",
                                    pendingControls[type]?.targetNumber === n 
                                      ? "bg-[#7c3aed] text-white border-[#7c3aed] scale-105" 
                                      : "bg-white text-gray-700 border-gray-200 hover:border-[#7c3aed]"
                                  )}
                               >
                                  {n}
                               </button>
                            ))}
                         </div>
                      </div>
                   </div>
                );
             })}
          </div>
        </div>
      )}

      {view === 'Add UPI' && (
           <div className="space-y-6">
              <p className="text-xs text-gray-400 font-bold uppercase">Update UPI ID for Deposits</p>
              <input 
                 type="text" 
                 value={settings?.upiId || ''}
                 onChange={(e) => updateSetting('upiId', e.target.value)}
                 placeholder="yourname@upi"
                 className="w-full max-w-md p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
              />
           </div>
        )}

        {view === 'USDT RATE' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">Set the conversion rate for USDT to INR.</p>
            <div className="flex items-center gap-4">
               <div className="relative flex-1 max-w-xs">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#7c3aed]">₹</span>
                 <input 
                    type="number" 
                    value={settings?.usdtRate || 0}
                    onChange={(e) => updateSetting('usdtRate', parseFloat(e.target.value))}
                    className="w-full pl-10 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed]"
                 />
               </div>
               <span className="text-xs text-gray-400 font-bold">Current Rate</span>
            </div>
          </div>
        )}

        {view === 'Daily Salary' && (
           <div className="space-y-6">
              <p className="text-xs text-gray-400 font-bold uppercase">Set Daily Salary Bonus for Active Players</p>
              <div className="flex items-center gap-4">
                 <input 
                    type="number" 
                    value={settings?.salaryBonus || 0}
                    onChange={(e) => updateSetting('salaryBonus', parseFloat(e.target.value))}
                    className="flex-1 max-w-xs p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                 />
                 <span className="font-bold text-gray-700">INR</span>
              </div>
           </div>
        )}

        {view === 'Withdrawal Limit' && (
           <div className="space-y-6">
              <p className="text-xs text-gray-400 font-bold uppercase">Minimum Withdrawal Amount</p>
              <div className="flex items-center gap-4">
                 <input 
                    type="number" 
                    value={settings?.withdrawLimit || 0}
                    onChange={(e) => updateSetting('withdrawLimit', parseFloat(e.target.value))}
                    className="flex-1 max-w-xs p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                 />
                 <span className="font-bold text-gray-700">INR</span>
              </div>
           </div>
        )}

        {view === 'First Deposit Bonus' && (
           <div className="space-y-6">
              <p className="text-xs text-gray-400 font-bold uppercase">First Deposit Commission (%)</p>
              <div className="flex items-center gap-4">
                 <input 
                    type="number" 
                    value={(settings?.commissionRate || 0) * 100}
                    onChange={(e) => updateSetting('commissionRate', parseFloat(e.target.value) / 100)}
                    className="flex-1 max-w-xs p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                 />
                 <span className="font-bold text-gray-700">%</span>
              </div>
           </div>
        )}

        {view === 'Update Game Commission' && (
           <div className="space-y-6">
              <p className="text-xs text-gray-400 font-bold uppercase">Game Betting Commission (%)</p>
              <div className="flex items-center gap-4">
                 <input 
                    type="number" 
                    defaultValue={2}
                    className="flex-1 max-w-xs p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                 />
                 <span className="font-bold text-gray-700">%</span>
              </div>
           </div>
        )}

        {view === 'Update Turnover' && (
           <div className="space-y-6">
              <p className="text-xs text-gray-400 font-bold uppercase">Required Turnover Multiplier for Withdraw</p>
              <div className="flex items-center gap-4">
                 <input 
                    type="number" 
                    defaultValue={1}
                    className="flex-1 max-w-xs p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                 />
                 <span className="font-bold text-gray-700">x</span>
              </div>
           </div>
        )}

        {view === 'Gift Code' && (
           <div className="space-y-8">
              <div className="bg-gray-50 p-8 rounded-[32px] border border-gray-100 shadow-sm">
                 <h3 className="text-sm font-black text-[#7c3aed] uppercase tracking-widest mb-6">Create New Redemption Key (Gift Code)</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Code Name</label>
                       <input 
                          type="text" 
                          placeholder="e.g. WELCOME2024"
                          value={newGift.code}
                          onChange={e => setNewGift({...newGift, code: e.target.value})}
                          className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Amount (INR)</label>
                       <input 
                          type="number" 
                          value={newGift.amount}
                          onChange={e => setNewGift({...newGift, amount: parseFloat(e.target.value)})}
                          className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Max Uses</label>
                       <input 
                          type="number" 
                          value={newGift.maxUses}
                          onChange={e => setNewGift({...newGift, maxUses: parseInt(e.target.value)})}
                          className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#7c3aed] font-bold"
                       />
                    </div>
                 </div>
                 <button 
                    onClick={handleCreateGift}
                    className="mt-6 w-full md:w-auto bg-[#7c3aed] text-white px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:translate-y-[-2px] active:translate-y-0 transition-all"
                 >
                    Generate & Save Key
                 </button>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-gray-400 ml-2">
                    <History className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Active Redemption Keys</span>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {giftCodes.map((gc) => (
                       <div key={gc.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-[#7c3aed]" />
                          <div className="flex items-center justify-between">
                             <span className="font-black text-lg text-gray-800">{gc.code}</span>
                             <span className="text-xs font-black text-[#7c3aed] bg-[#7c3aed]/10 px-3 py-1 rounded-full italic">₹{gc.amount}</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                             <div>
                                <p className="text-[10px] text-gray-400 uppercase font-black">Usage</p>
                                <p className="text-xs font-bold text-gray-600">{gc.currentUses} / {gc.maxUses}</p>
                             </div>
                             <button 
                                onClick={() => handleDeleteGift(gc.id)}
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                             >
                                <Trash2 className="w-5 h-5" />
                             </button>
                          </div>
                       </div>
                    ))}
                    {giftCodes.length === 0 && (
                       <div className="col-span-full py-12 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-100">
                          <p className="text-xs font-black text-gray-300 uppercase italic">No active keys found</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        )}

        {['Telegram', 'Add Admin', 'Demo User', 'Agent User', 'Edit Bank Details', 'Add Advanced Functions', 'Hold Wallet', 'Get User Report'].includes(view) && (
           <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <Plus className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Manage {view} Module</p>
              <button className="mt-6 bg-[#7c3aed] text-white px-8 py-3 rounded-xl font-bold text-xs uppercase shadow-lg">Open Management</button>
           </div>
        )}

        <button 
          onClick={onBack}
          className="mt-12 bg-gray-100 hover:bg-gray-200 text-gray-500 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, active, sidebarOpen, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all",
        active ? "bg-white text-[#7c3aed] font-bold" : "hover:bg-white/10"
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {sidebarOpen && <span className="text-sm">{label}</span>}
    </button>
  );
}

function MenuSection({ icon: Icon, label, sidebarOpen, isOpen, onClick, onItemClick, items }: any) {
  return (
    <div className="space-y-1">
      <button 
        onClick={onClick}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:bg-white/10",
          isOpen && "bg-white/30 font-bold"
        )}
      >
        <div className="flex items-center gap-4">
          <Icon className="w-5 h-5 shrink-0" />
          {sidebarOpen && <span className="text-sm uppercase tracking-tighter">{label}</span>}
        </div>
        {sidebarOpen && (
          <ChevronRight className={cn("w-4 h-4 transition-transform", isOpen && "rotate-90")} />
        )}
      </button>
      {isOpen && sidebarOpen && (
        <div className="pl-12 pr-4 py-2 space-y-1 bg-black/10 rounded-b-2xl border-t border-white/10 animate-in slide-in-from-top-2 duration-200">
          {items.map((item: string) => (
            <button 
              key={item} 
              onClick={() => onItemClick(item)}
              className="w-full text-left py-2 text-[10px] font-bold uppercase tracking-widest opacity-70 hover:opacity-100 flex items-center gap-2 transition-all hover:translate-x-1"
            >
              <div className="w-1.5 h-1.5 rounded-full border-2 border-white/40" />
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
