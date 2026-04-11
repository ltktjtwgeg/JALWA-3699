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
  AlertCircle
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
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, Game, Transaction } from '../types';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/utils';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'games' | 'withdrawals' | 'control'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [withdrawals, setWithdrawals] = useState<Transaction[]>([]);
  const [pendingControls, setPendingControls] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(50)), (snap) => {
      setUsers(snap.docs.map(d => d.data() as User));
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

    return () => {
      unsubUsers();
      unsubGames();
      unsubWithdrawals();
      unsubControls();
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
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        {activeTab === 'users' && (
          <div className="space-y-4">
            {users.map((u) => (
              <div key={u.uid} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
                <div>
                  <p className="font-bold">{u.username}</p>
                  <p className="text-xs text-gray-500">{u.phoneNumber}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-400">{formatCurrency(u.balance)}</p>
                  <p className="text-[10px] text-gray-500">VIP {u.vipLevel}</p>
                </div>
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
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-400">{g.resultNumber}</p>
                    <p className="text-[10px] text-gray-500">{g.resultColor}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${g.resultColor === 'Green' ? 'bg-emerald-500' : g.resultColor === 'Red' ? 'bg-rose-500' : 'bg-purple-500'}`} />
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
      </div>
    </div>
  );
}

function GameControlSection({ pendingControls }: { pendingControls: any[] }) {
  const [gameType, setGameType] = useState<string>('1m');
  const [target, setTarget] = useState<string>('Big');
  const [loading, setLoading] = useState(false);

  const handleSetControl = async () => {
    setLoading(true);
    try {
      const data: any = {
        gameType,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      if (['Big', 'Small'].includes(target)) {
        data.targetSize = target;
      } else {
        data.targetNumber = parseInt(target);
      }

      await addDoc(collection(db, 'game_controls'), data);
      toast.success('Game control set for next round');
    } catch (error) {
      toast.error('Failed to set control');
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
              <p className="font-bold text-sm">{c.gameType}</p>
              <p className="text-xs text-purple-400 font-bold">
                Target: {c.targetSize || c.targetNumber}
              </p>
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
