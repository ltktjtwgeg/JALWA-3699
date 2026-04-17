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
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAdminStats, getSystemSettings, updateSystemSettings, SystemSettings, getGamePoolStats, setGameControl } from '../../services/adminService';
import { formatCurrency, cn } from '../../lib/utils';
import { toast } from 'sonner';
import { db } from '../../firebase';
import { collection, query, getDocs, limit, where } from 'firebase/firestore';
import { GameType } from '../../types';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Dashboard']);

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

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
    { label: 'Total Users', value: stats?.totalUsers, sub: 'View Details', icon: Users, color: 'bg-purple-600', view: 'Users' },
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
            icon={TrendingUp} 
            label="K3 Manager" 
            sidebarOpen={sidebarOpen}
            isOpen={expandedMenus.includes('K3')}
            onClick={() => toggleMenu('K3')}
            onItemClick={(item: string) => setCurrentView(item)}
            items={['K3 Game Settings', 'K3 History']}
          />

          <MenuSection 
            icon={Globe} 
            label="5D Manager" 
            sidebarOpen={sidebarOpen}
            isOpen={expandedMenus.includes('5D')}
            onClick={() => toggleMenu('5D')}
            onItemClick={(item: string) => setCurrentView(item)}
            items={['5D Game Settings', '5D History']}
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
               'Users', 'Daily Salary', 'Gift Code', 'Telegram', 
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
            <AdminSubView 
               view={currentView} 
               settings={settings!} 
               updateSetting={handleUpdateSetting}
               onBack={() => setCurrentView('dashboard')} 
            />
          )}
        </main>
      </div>
    </div>
  );
}

function AdminSubView({ view, settings, updateSetting, onBack }: any) {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [poolStats, setPoolStats] = React.useState<Record<string, any>>({});

  const handleManualControl = async (type: GameType, value: string) => {
    try {
      if (value === 'Force Big Only') await setGameControl(type, 'Big');
      else if (value === 'Force Small Only') await setGameControl(type, 'Small');
      else if (!isNaN(parseInt(value))) await setGameControl(type, undefined, parseInt(value));
      toast.success(`Manual control scheduled for ${type}`);
    } catch (e) {
      toast.error('Failed to schedule control');
    }
  };

  React.useEffect(() => {
    if (view === 'Users') {
      fetchUsers();
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
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), limit(50));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
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
              <button className="bg-[#7c3aed] text-white px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-tighter">Search</button>
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
          </div>
        )}

        {view === 'Random ON/OFF' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">Enable or disable random result generation for Wingo games.</p>
            <div className="flex items-center gap-4">
               <button 
                  onClick={() => updateSetting('wingoRandomMode', !settings.wingoRandomMode)}
                  className={cn(
                    "w-20 h-10 rounded-full p-1 transition-colors relative",
                    settings.wingoRandomMode ? "bg-[#7c3aed]" : "bg-gray-300"
                  )}
               >
                  <div className={cn(
                    "w-8 h-8 bg-white rounded-full shadow-md transition-transform",
                    settings.wingoRandomMode ? "translate-x-10" : "translate-x-0"
                  )} />
               </button>
               <span className="font-bold text-gray-700">{settings.wingoRandomMode ? 'System is in Random Mode' : 'Random Mode Disabled'}</span>
            </div>
          </div>
        )}

        {view === 'Auto Control' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">If ON, the game will automatically select the result where users have bet the LEAST amount of money.</p>
            <div className="flex items-center gap-4">
               <button 
                  onClick={() => updateSetting('wingoAutoControl', !settings.wingoAutoControl)}
                  className={cn(
                    "w-20 h-10 rounded-full p-1 transition-colors relative",
                    settings.wingoAutoControl ? "bg-[#7c3aed]" : "bg-gray-300"
                  )}
               >
                  <div className={cn(
                    "w-8 h-8 bg-white rounded-full shadow-md transition-transform",
                    settings.wingoAutoControl ? "translate-x-10" : "translate-x-0"
                  )} />
               </button>
               <span className="font-bold text-gray-700">{settings.wingoAutoControl ? 'Auto Control is ACTIVE' : 'Auto Control is INACTIVE'}</span>
            </div>
          </div>
        )}

        {view === 'Game Settings' && (
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
                            onChange={(e) => handleManualControl(type as GameType, e.target.value)}
                            className="bg-white border-2 border-gray-100 text-xs p-3 rounded-xl font-bold w-full outline-none focus:border-[#7c3aed] transition-all"
                         >
                            <option value="Auto">System Default (Auto)</option>
                            <option value="Force Big Only">Force Big Only</option>
                            <option value="Force Small Only">Force Small Only</option>
                         </select>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
                         <p className="text-[10px] text-gray-400 uppercase font-black">Force Specific Number</p>
                         <div className="grid grid-cols-5 gap-2">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                               <button 
                                  key={n}
                                  onClick={() => handleManualControl(type as GameType, n.toString())}
                                  className="h-10 text-xs font-black bg-white border border-gray-200 rounded-xl hover:bg-[#7c3aed] hover:text-white transition-all shadow-sm hover:scale-105 active:scale-95"
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
        )}

        {view === 'Add UPI' && (
           <div className="space-y-6">
              <p className="text-xs text-gray-400 font-bold uppercase">Update UPI ID for Deposits</p>
              <input 
                 type="text" 
                 value={settings.upiId}
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
                    value={settings.usdtRate}
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
                    value={settings.salaryBonus}
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
                    value={settings.withdrawLimit}
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
                    value={settings.commissionRate * 100}
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

        {['Gift Code', 'Telegram', 'Add Admin', 'Demo User', 'Agent User', 'Edit Bank Details', 'Add Advanced Functions', 'Hold Wallet', 'Get User Report'].includes(view) && (
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
