import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { 
  ChevronLeft, 
  History as HistoryIcon, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  CreditCard,
  Gamepad2,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, Bet } from '../types';

type HistoryType = 'all' | 'deposit' | 'withdraw' | 'game';

export default function History() {
  const { type = 'all' } = useParams<{ type: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    if (type === 'game') {
      const q = query(
        collection(db, 'bets'),
        where('uid', '==', user.uid),
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
        data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        setBets(data);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      let q;
      if (type === 'all') {
        q = query(
          collection(db, 'transactions'),
          where('uid', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      } else {
        q = query(
          collection(db, 'transactions'),
          where('uid', '==', user.uid),
          where('type', '==', type),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, type]);

  const getTitle = () => {
    switch (type) {
      case 'deposit': return 'Deposit History';
      case 'withdraw': return 'Withdrawal History';
      case 'game': return 'Game History';
      default: return 'Transaction History';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">{getTitle()}</h2>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : type === 'game' ? (
          <div className="space-y-3">
            {bets.map((bet) => (
              <div key={bet.id} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2 rounded-xl",
                    bet.status === 'win' ? "bg-emerald-500/10" : bet.status === 'lost' ? "bg-rose-500/10" : "bg-yellow-500/10"
                  )}>
                    <Gamepad2 className={cn(
                      "w-5 h-5",
                      bet.status === 'win' ? "text-emerald-500" : bet.status === 'lost' ? "text-rose-500" : "text-yellow-500"
                    )} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">WinGo {bet.gameType} - {bet.selection}</p>
                    <p className="text-[10px] text-gray-500">{bet.createdAt?.toDate().toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 font-mono">Period: {bet.periodId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-bold",
                    bet.status === 'win' ? "text-emerald-500" : bet.status === 'lost' ? "text-rose-500" : "text-yellow-500"
                  )}>
                    {bet.status === 'win' ? `+${formatCurrency(bet.winAmount || 0)}` : `-${formatCurrency(bet.netAmount)}`}
                  </p>
                  <div className="flex flex-col items-end">
                    <span className={cn(
                      "text-[10px] font-bold uppercase italic",
                      bet.status === 'win' ? "text-emerald-500" : bet.status === 'lost' ? "text-rose-500" : "text-yellow-500"
                    )}>
                      {bet.status}
                    </span>
                    <span className="text-[8px] text-gray-500">Fee: ₹{bet.fee?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
            {bets.length === 0 && (
              <div className="text-center py-20 text-gray-600 italic">No game history found</div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2 rounded-xl",
                    t.type === 'deposit' || t.type === 'win' ? "bg-emerald-500/10" : "bg-rose-500/10"
                  )}>
                    {t.type === 'deposit' || t.type === 'win' ? (
                      <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <ArrowUpCircle className="w-5 h-5 text-rose-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm capitalize">{t.type}</p>
                    <p className="text-[10px] text-gray-500">{t.createdAt?.toDate().toLocaleString()}</p>
                    {t.description && <p className="text-[10px] text-gray-600">{t.description}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-bold",
                    t.type === 'deposit' || t.type === 'win' ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {t.type === 'deposit' || t.type === 'win' ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                  <div className="flex items-center justify-end gap-1">
                    {t.status === 'completed' ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : t.status === 'pending' ? (
                      <Clock className="w-3 h-3 text-yellow-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-rose-500" />
                    )}
                    <span className={cn(
                      "text-[10px] capitalize",
                      t.status === 'completed' ? "text-emerald-500" : t.status === 'pending' ? "text-yellow-500" : "text-rose-500"
                    )}>
                      {t.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="text-center py-20 text-gray-600 italic">No transactions found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
