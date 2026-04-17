import { useState, useEffect } from 'react';
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
  UserPlus
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
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, Game, Transaction } from '../types';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
// @ts-ignore
import firebaseConfig from '../../firebase-applet-config.json';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'games' | 'withdrawals' | 'control' | 'fees' | 'demo'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [withdrawals, setWithdrawals] = useState<Transaction[]>([]);
  const [pendingControls, setPendingControls] = useState<any[]>([]);
  const [platformFees, setPlatformFees] = useState<any[]>([]);
  const [totalFees, setTotalFees] = useState(0);
  const [adjustingBalance, setAdjustingBalance] = useState<{uid: string, amount: string} | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    const isAdminEmail = user?.email === "triloksinghrathore51@gmail.com";
    if (user && user.role !== 'admin' && !isAdminEmail) {
      navigate('/');
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, 'users'), where('isDemo', '!=', true), limit(50)), (snap) => {
      setUsers(snap.docs.map(d => d.data() as User));
    });
    const unsubDemoUsers = onSnapshot(query(collection(db, 'users'), where('isDemo', '==', true), limit(50)), (snap) => {
      setDemoUsers(snap.docs.map(d => d.data() as User));
    });
    const unsubGames = onSnapshot(query(collection(db, 'games'), orderBy('periodId', 'desc'), limit(20)), (snap) => {
      setGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
    });
    const unsubWithdrawals = onSnapshot(query(collection(db, 'transactions'), where('type', '==', 'withdraw'), where('status', '==', 'pending')), (snap) => {
      setWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });
    const unsubControls = onSnapshot(query(collection(db, 'game_controls'), where('status', '==', 'pending')), (snap) => {
      setPendingControls(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubFees = onSnapshot(query(collection(db, 'platform_fees'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      const fees = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setPlatformFees(fees);
      const total = fees.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      setTotalFees(total);
    });

    return () => {
      unsubUsers();
      unsubGames();
      unsubWithdrawals();
      unsubControls();
      unsubFees();
    };
  }, []);

  const handleApproveWithdrawal = async (t: Transaction) => {
    try {
      await updateDoc(doc(db, 'transactions', t.id!), { status: 'completed' });
      toast.success('Withdrawal approved');
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleRejectWithdrawal = async (t: Transaction) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'transactions', t.id!), { status: 'failed' });
      // Refund user
      batch.update(doc(db, 'users', t.uid), { balance: increment(t.amount) });
      await batch.commit();
      toast.success('Withdrawal rejected and refunded');
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustingBalance) return;
    const amount = parseFloat(adjustingBalance.amount);
    if (isNaN(amount)) return toast.error('Invalid amount');

    setIsAdjusting(true);
    try {
      const updateData: any = {
        balance: increment(amount)
      };
      
      // If adding money, count it as a deposit for wagering requirements
      if (amount > 0) {
        updateData.totalDeposits = increment(amount);
      }

      await updateDoc(doc(db, 'users', adjustingBalance.uid), updateData);
      toast.success('Balance adjusted successfully');
      setAdjustingBalance(null);
    } catch (error) {
      toast.error('Failed to adjust balance');
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21]">
      <div className="p-4 flex items-center gap-4 bg-[#1a1d21] border-b border-gray-800">
        <button onClick={() => navigate('/profile')} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Admin Control Panel</h2>
      </div>

      <div className="flex bg-[#1f2228] border-b border-gray-800">
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'users' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500'}`}
        >
          <Users className="w-4 h-4 mx-auto mb-1" />
          Users
        </button>
        <button 
          onClick={() => setActiveTab('games')}
          className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'games' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500'}`}
        >
          <Gamepad2 className="w-4 h-4 mx-auto mb-1" />
          Games
        </button>
        <button 
          onClick={() => setActiveTab('withdrawals')}
          className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'withdrawals' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500'}`}
        >
          <CreditCard className="w-4 h-4 mx-auto mb-1" />
          Withdrawals
        </button>
        <button 
          onClick={() => setActiveTab('control')}
          className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'control' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500'}`}
        >
          <Settings className="w-4 h-4 mx-auto mb-1" />
          Control
        </button>
        <button 
          onClick={() => setActiveTab('fees')}
          className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'fees' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500'}`}
        >
          <BarChart3 className="w-4 h-4 mx-auto mb-1" />
          Fees
        </button>
        <button 
          onClick={() => setActiveTab('demo')}
          className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'demo' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500'}`}
        >
          <UserPlus className="w-4 h-4 mx-auto mb-1" />
          Demo
        </button>
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        {activeTab === 'users' && (
          <div className="space-y-4">
            {users.map((u) => (
              <div key={u.uid} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{u.username}</p>
                    <p className="text-[10px] text-gray-500">{u.email || u.phoneNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">{formatCurrency(u.balance)}</p>
                    <p className="text-[10px] text-gray-500">VIP {u.vipLevel}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setAdjustingBalance({ uid: u.uid, amount: '' })}
                    className="flex-1 bg-purple-600/10 text-purple-400 py-2 rounded-xl text-[10px] font-bold border border-purple-500/20"
                  >
                    Adjust Balance
                  </button>
                </div>

                {adjustingBalance?.uid === u.uid && (
                  <div className="p-3 bg-black/20 rounded-xl space-y-3 border border-white/5">
                    <p className="text-[10px] text-gray-400">Enter amount to add (positive) or subtract (negative)</p>
                    <input 
                      type="number"
                      value={adjustingBalance.amount}
                      onChange={(e) => setAdjustingBalance({ ...adjustingBalance, amount: e.target.value })}
                      placeholder="e.g. 100 or -100"
                      className="w-full bg-[#1a1d21] border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    />
                    <div className="flex gap-2">
                      <button 
                        disabled={isAdjusting}
                        onClick={() => setAdjustingBalance(null)}
                        className="flex-1 py-2 text-[10px] font-bold text-gray-500"
                      >
                        Cancel
                      </button>
                      <button 
                        disabled={isAdjusting}
                        onClick={handleAdjustBalance}
                        className="flex-1 bg-purple-600 py-2 rounded-lg text-[10px] font-bold text-white disabled:opacity-50"
                      >
                        {isAdjusting ? 'Processing...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'games' && (
          <div className="space-y-4">
            {games.map((g) => (
              <div key={g.id} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">Period: {g.periodId}</p>
                  <p className="text-[10px] text-gray-500">{g.gameType}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black italic shadow-lg",
                    [1, 3, 7, 9].includes(g.resultNumber!) ? "bg-emerald-500 text-white" :
                    [2, 4, 6, 8].includes(g.resultNumber!) ? "bg-rose-500 text-white" :
                    g.resultNumber === 0 ? "bg-[linear-gradient(135deg,#f43f5e_50%,#a855f7_50%)] text-white" :
                    g.resultNumber === 5 ? "bg-[linear-gradient(135deg,#10b981_50%,#a855f7_50%)] text-white" : "bg-gray-500 text-white"
                  )}>
                    {g.resultNumber}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            {withdrawals.length === 0 && (
              <div className="text-center py-20 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No pending withdrawals</p>
              </div>
            )}
            {withdrawals.map((w) => (
              <div key={w.id} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg text-rose-400">{formatCurrency(w.amount)}</p>
                    <p className="text-xs text-gray-400 mt-1">{w.description}</p>
                    <p className="text-[10px] text-gray-500 mt-1">User UID: {w.uid}</p>
                  </div>
                  <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-2 py-1 rounded-md font-bold uppercase">Pending</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleApproveWithdrawal(w)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                  <button 
                    onClick={() => handleRejectWithdrawal(w)}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'control' && (
          <GameControlSection pendingControls={pendingControls} />
        )}

        {activeTab === 'demo' && (
          <DemoAccountSection demoUsers={demoUsers} />
        )}
      </div>
    </div>
  );
}

function DemoAccountSection({ demoUsers }: { demoUsers: User[] }) {
  const [loading, setLoading] = useState(false);

  const handleCreateDemo = async () => {
    const username = `Demo_${Math.floor(1000 + Math.random() * 9000)}`;
    const email = `${username.toLowerCase()}@demo.com`;
    const password = 'password123';

    setLoading(true);
    try {
      // Use secondary app to avoid logging out admin
      const secondaryApp = initializeApp(firebaseConfig, `Secondary_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        username,
        email,
        balance: 10000,
        role: 'user',
        isDemo: true,
        vipLevel: 1,
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdAt: serverTimestamp()
      });

      await signOut(secondaryAuth);
      toast.success(`Demo account created: ${email} / ${password}`);
    } catch (error: any) {
      console.error('Demo creation error:', error);
      toast.error(error.message || 'Failed to create demo account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-[#1f2228] p-6 rounded-3xl border border-gray-800 space-y-6">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-purple-500" />
          Create Demo Account
        </h3>
        <p className="text-xs text-gray-500">
          Creates a new account with ₹10,000 balance for testing. 
          Default password is <span className="text-purple-400 font-bold">password123</span>
        </p>
        <button
          disabled={loading}
          onClick={handleCreateDemo}
          className="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-2xl font-bold text-white shadow-lg shadow-purple-900/20 disabled:opacity-50 transition-all"
        >
          {loading ? 'Creating...' : 'Generate Demo Account'}
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-sm text-gray-500 px-2">Existing Demo Accounts</h3>
        {demoUsers.length === 0 && (
          <p className="text-center py-10 text-gray-600 italic text-sm">No demo accounts found</p>
        )}
        {demoUsers.map((u) => (
          <div key={u.uid} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">{u.username}</p>
              <p className="text-[10px] text-gray-500">{u.email}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-emerald-400">{formatCurrency(u.balance)}</p>
              <span className="text-[8px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-bold uppercase">Demo</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function GameControlSection({ pendingControls }: { pendingControls: any[] }) {
  const [gameType, setGameType] = useState<string>('1m');
  const [target, setTarget] = useState<string>('Big');
  const [controlType, setControlType] = useState<'wingo' | 'roulette' | 'mines'>('wingo');
  const [rouletteTarget, setRouletteTarget] = useState<number>(0);
  const [minesTarget, setMinesTarget] = useState<string>(''); // comma separated indices
  const [targetUsername, setTargetUsername] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSetControl = async () => {
    setLoading(true);
    try {
      const data: any = {
        type: controlType,
        status: 'pending',
        targetUsername: targetUsername.trim() || 'global',
        createdAt: serverTimestamp()
      };

      if (controlType === 'wingo') {
        data.gameType = gameType;
        if (['Big', 'Small'].includes(target)) {
          data.targetSize = target;
        } else {
          data.targetNumber = parseInt(target);
        }
      } else if (controlType === 'roulette') {
        data.targetNumber = rouletteTarget;
      } else if (controlType === 'mines') {
        const indices = minesTarget.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (indices.length === 0) throw new Error('Enter valid mine positions (0-24)');
        data.targetMines = indices;
      }

      await addDoc(collection(db, 'game_controls'), data);
      toast.success('Game control set successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to set control');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteControl = async (id: string) => {
    try {
      await updateDoc(doc(db, 'game_controls', id), { status: 'cancelled' });
      toast.success('Control cancelled');
    } catch (error) {
      toast.error('Failed to cancel');
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-[#1f2228] p-6 rounded-3xl border border-gray-800 space-y-6">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-500" />
          Set Next Result
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Game To Control</label>
            <div className="grid grid-cols-3 gap-2">
              {['wingo', 'roulette', 'mines'].map((t) => (
                <button
                  key={t}
                  onClick={() => setControlType(t as any)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all capitalize ${controlType === t ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Target Username (Optional - leave empty for global)</label>
            <input 
              type="text"
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              placeholder="e.g. admin"
              className="w-full bg-[#1a1d21] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          {controlType === 'wingo' && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Game Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {['30s', '1m', '3m', '5m'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setGameType(t)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${gameType === t ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">Target Result</label>
                <div className="grid grid-cols-4 gap-2">
                  {['Big', 'Small', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTarget(t)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${target === t ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {controlType === 'roulette' && (
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Target Number (0-12)</label>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({length: 13}).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setRouletteTarget(i)}
                    className={`h-10 rounded-lg text-xs font-bold transition-all ${rouletteTarget === i ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'}`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}

          {controlType === 'mines' && (
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Mine Positions (0-24, comma separated)</label>
              <input 
                type="text"
                value={minesTarget}
                onChange={(e) => setMinesTarget(e.target.value)}
                placeholder="e.g. 1,5,10"
                className="w-full bg-[#1a1d21] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
              />
              <p className="text-[10px] text-gray-600 mt-1">If user clicks any of these, they lose instantly.</p>
            </div>
          )}

          <button
            disabled={loading}
            onClick={handleSetControl}
            className="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-2xl font-bold text-white shadow-lg shadow-purple-900/20 disabled:opacity-50 transition-all"
          >
            {loading ? 'Setting...' : 'Set Result'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-sm text-gray-500 px-2">Pending Controls</h3>
        {pendingControls.length === 0 && (
          <p className="text-center py-10 text-gray-600 italic text-sm">No pending controls</p>
        )}
        {pendingControls.map((c) => (
          <div key={c.id} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm uppercase text-white/90">{c.type || 'wingo'} - {c.gameType || ''}</p>
              <p className="text-xs text-purple-400 font-bold">
                Target: {c.targetSize || c.targetNumber !== undefined ? c.targetNumber : c.targetMines?.join(',')}
              </p>
              <p className="text-[10px] text-gray-500">Target User: {c.targetUsername || 'Global'}</p>
            </div>
            <button 
              onClick={() => handleDeleteControl(c.id)}
              className="p-2 bg-rose-500/10 text-rose-500 rounded-full hover:bg-rose-500/20 transition-all"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
