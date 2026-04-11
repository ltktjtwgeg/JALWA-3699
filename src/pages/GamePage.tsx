import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { 
  ChevronLeft, 
  ChevronRight,
  Clock, 
  History, 
  Trophy, 
  Info, 
  CheckCircle2,
  XCircle,
  Rocket,
  Check,
  Wallet,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Game, Bet, GameType } from '../types';
import { toast } from 'sonner';

const COLORS = {
  GREEN: 'bg-emerald-500',
  RED: 'bg-rose-500',
  VIOLET: 'bg-purple-500',
};

const NUMBER_COLORS: Record<number, string> = {
  0: 'bg-[linear-gradient(135deg,#f43f5e_50%,#a855f7_50%)]',
  1: 'bg-emerald-500',
  2: 'bg-rose-500',
  3: 'bg-emerald-500',
  4: 'bg-rose-500',
  5: 'bg-[linear-gradient(135deg,#10b981_50%,#a855f7_50%)]',
  6: 'bg-rose-500',
  7: 'bg-emerald-500',
  8: 'bg-rose-500',
  9: 'bg-emerald-500',
};

const SOUNDS = {
  TICK: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  WIN: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  LOSS: 'https://assets.mixkit.co/active_storage/sfx/253/253-preview.mp3',
  BET: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
};

export default function GamePage() {
  const { type } = useParams<{ type: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(0);
  const [periodId, setPeriodId] = useState('');
  const [history, setHistory] = useState<Game[]>([]);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedBet, setSelectedBet] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(1);
  const [multiplier, setMultiplier] = useState(1);
  const [isBetting, setIsBetting] = useState(false);
  const [activeTab, setActiveTab] = useState<'game' | 'my'>('game');
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultData, setResultData] = useState<{ bet: Bet; game: Game } | null>(null);
  const [lastProcessedPeriod, setLastProcessedPeriod] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const shownBetIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);
  const [gamePage, setGamePage] = useState(1);
  const [myPage, setMyPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (showResultModal) {
      const timer = setTimeout(() => {
        setShowResultModal(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showResultModal]);

  const playSound = (url: string) => {
    if (isMuted) return;
    const audio = new Audio(url);
    audio.play().catch(() => {});
  };

  const duration = useMemo(() => {
    switch (type) {
      case '30s': return 30;
      case '1m': return 60;
      case '3m': return 180;
      case '5m': return 300;
      default: return 60;
    }
  }, [type]);

  // Timer and Period Logic
  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = duration - (now % duration);
      setTimeLeft(remaining);

      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const roundIndex = Math.floor(now / duration);
      setPeriodId(`${dateStr}${roundIndex}`);
    };

    updateTimer();
    const interval = setInterval(() => {
      updateTimer();
      // Play tick sound for last 3 seconds
      const now = Math.floor(Date.now() / 1000);
      const remaining = duration - (now % duration);
      if (remaining <= 3 && remaining > 0) {
        playSound(SOUNDS.TICK);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [duration, isMuted]);

  // Fetch History
  useEffect(() => {
    const q = query(
      collection(db, 'games'),
      where('gameType', '==', type),
      where('status', '==', 'completed'),
      orderBy('periodId', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setHistory(games);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'games');
    });

    return () => unsubscribe();
  }, [type]);

  // Fetch My Bets
  useEffect(() => {
    if (!user) return;
    isFirstLoad.current = true;
    const q = query(
      collection(db, 'bets'),
      where('uid', '==', user.uid),
      where('gameType', '==', type),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
      
      // On first load, mark all currently settled bets as "shown" so they don't trigger popups
      if (isFirstLoad.current && bets.length > 0) {
        bets.forEach(bet => {
          if (bet.status !== 'pending' && bet.id) {
            shownBetIds.current.add(bet.id);
          }
        });
        isFirstLoad.current = false;
      }

      // Sort in memory to avoid composite index requirement
      bets.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      setMyBets(bets);
    }, (error) => {
      console.error('Bets subscription error:', error);
    });

    return () => unsubscribe();
  }, [user, type]);

  // Result Modal Logic
  useEffect(() => {
    if (!myBets.length || !history.length || showResultModal) return;
    
    // Find the most recent settled bet that hasn't been shown yet
    // We only care about bets from the last 2 periods to avoid showing very old results
    const latestSettledBet = myBets.find(b => 
      b.id && 
      b.status !== 'pending' && 
      !shownBetIds.current.has(b.id)
    );
    
    if (latestSettledBet) {
      const gameResult = history.find(g => g.periodId === latestSettledBet.periodId);
      if (gameResult) {
        shownBetIds.current.add(latestSettledBet.id!);
        setResultData({ bet: latestSettledBet, game: gameResult });
        setShowResultModal(true);
        
        // Play result sound
        if (latestSettledBet.status === 'win') {
          playSound(SOUNDS.WIN);
        } else {
          playSound(SOUNDS.LOSS);
        }
      }
    }
  }, [myBets, history, showResultModal]);

  // Separate effect for auto-closing the modal to ensure it's stable
  useEffect(() => {
    if (showResultModal) {
      const timer = setTimeout(() => {
        setShowResultModal(false);
      }, 2000); // 2 seconds
      return () => clearTimeout(timer);
    }
  }, [showResultModal]);

  const handlePlaceBet = async () => {
    if (!user || !selectedBet) return;
    const total = betAmount * multiplier;
    if (user.balance < total) return toast.error('Insufficient balance');
    if (timeLeft < 5) return toast.error('Betting closed for this round');

    setIsBetting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found');
        
        const currentBalance = userSnap.data().balance;
        if (currentBalance < total) throw new Error('Insufficient balance');

        // Deduct balance
        transaction.update(userRef, { balance: increment(-total) });

        // Create bet
        const fee = total * 0.04;
        const netAmount = total - fee;
        const betRef = doc(collection(db, 'bets'));
        transaction.set(betRef, {
          uid: user.uid,
          periodId,
          gameType: type,
          selection: selectedBet,
          amount: betAmount,
          multiplier,
          totalAmount: total,
          fee,
          netAmount,
          status: 'pending',
          createdAt: serverTimestamp()
        });

        // Create transaction record
        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          uid: user.uid,
          type: 'bet',
          amount: total,
          status: 'completed',
          description: `Bet on ${selectedBet} (Period: ${periodId})`,
          createdAt: serverTimestamp()
        });
      });

      toast.success('Bet placed successfully!');
      playSound(SOUNDS.BET);
      setShowBetModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to place bet');
    } finally {
      setIsBetting(false);
    }
  };

  const getResultColor = (num: number) => {
    if (num === 0 || num === 5) return 'Violet';
    return [1, 3, 7, 9].includes(num) ? 'Green' : 'Red';
  };

  const getResultSize = (num: number) => {
    return num >= 5 ? 'Big' : 'Small';
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] pb-10">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-20 border-b border-gray-800">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">WINGO {type === '30s' ? '30 sec' : type}</h2>
        <div 
          onClick={() => navigate('/wallet')}
          className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
        >
          <Wallet className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-bold text-yellow-500">{formatCurrency(user?.balance || 0)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className="p-2 hover:bg-gray-800 rounded-full"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-gray-500" /> : <Volume2 className="w-5 h-5 text-purple-400" />}
          </button>
          <button className="p-2 hover:bg-gray-800 rounded-full">
            <Info className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Timer Section */}
      <div className="p-6 bg-gradient-to-b from-[#2a2e35] to-[#1a1d21]">
        <div className="bg-[#1f2228] rounded-3xl p-6 border border-gray-800 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Period ID</p>
            <h3 className="text-xl font-mono font-bold text-purple-400">{periodId}</h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1 flex items-center justify-end gap-1">
              <Clock className="w-3 h-3" /> Time Remaining
            </p>
            <div className="flex gap-1 justify-end">
              <div className="bg-gray-800 px-2 py-1 rounded-md text-xl font-mono font-bold text-white">
                {Math.floor(timeLeft / 60).toString().padStart(2, '0')}
              </div>
              <div className="text-xl font-bold text-gray-600">:</div>
              <div className={`bg-gray-800 px-2 py-1 rounded-md text-xl font-mono font-bold ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Betting Options */}
      <div className="px-6 space-y-6">
        {/* Colors */}
        <div className="grid grid-cols-3 gap-3">
          <button 
            onClick={() => { setSelectedBet('Green'); setShowBetModal(true); }}
            className="bg-emerald-500 hover:bg-emerald-600 py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all"
          >
            Green
          </button>
          <button 
            onClick={() => { setSelectedBet('Violet'); setShowBetModal(true); }}
            className="bg-purple-500 hover:bg-purple-600 py-3 rounded-xl font-bold shadow-lg shadow-purple-900/20 transition-all"
          >
            Violet
          </button>
          <button 
            onClick={() => { setSelectedBet('Red'); setShowBetModal(true); }}
            className="bg-rose-500 hover:bg-rose-600 py-3 rounded-xl font-bold shadow-lg shadow-rose-900/20 transition-all"
          >
            Red
          </button>
        </div>

        {/* Numbers */}
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => { setSelectedBet(num.toString()); setShowBetModal(true); }}
              className={`${NUMBER_COLORS[num]} aspect-square rounded-full flex items-center justify-center text-xl font-bold shadow-md hover:scale-110 transition-transform`}
            >
              {num}
            </button>
          ))}
        </div>

        {/* Big / Small */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => { setSelectedBet('Big'); setShowBetModal(true); }}
            className="bg-gradient-to-r from-orange-500 to-amber-600 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-orange-900/20"
          >
            Big
          </button>
          <button 
            onClick={() => { setSelectedBet('Small'); setShowBetModal(true); }}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-900/20"
          >
            Small
          </button>
        </div>
      </div>

      {/* History Tabs */}
      <div className="mt-10 px-6">
        <div className="flex gap-6 border-b border-gray-800 mb-6">
          <button 
            onClick={() => setActiveTab('game')}
            className={`pb-3 border-b-2 font-bold text-sm transition-all ${activeTab === 'game' ? 'border-purple-500 text-purple-500' : 'border-transparent text-gray-500'}`}
          >
            Game History
          </button>
          <button 
            onClick={() => setActiveTab('my')}
            className={`pb-3 border-b-2 font-bold text-sm transition-all ${activeTab === 'my' ? 'border-purple-500 text-purple-500' : 'border-transparent text-gray-500'}`}
          >
            My History
          </button>
        </div>

        {activeTab === 'game' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider px-2">
              <span>Period</span>
              <span className="text-center">Number</span>
              <span className="text-center">Size</span>
              <span className="text-right">Color</span>
            </div>
            
            {history.slice((gamePage - 1) * ITEMS_PER_PAGE, gamePage * ITEMS_PER_PAGE).map((game) => (
              <div key={game.id} className="bg-[#1f2228] p-3 rounded-xl border border-gray-800 grid grid-cols-4 items-center">
                <span className="text-xs font-mono text-gray-400">{game.periodId.slice(-4)}</span>
                <span className={`text-center font-bold text-lg ${NUMBER_COLORS[game.resultNumber || 0].includes('emerald') ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {game.resultNumber}
                </span>
                <span className="text-center text-xs text-gray-300">{game.resultSize}</span>
                <div className="flex justify-end">
                  <div className={cn("w-3 h-3 rounded-full", NUMBER_COLORS[game.resultNumber || 0])} />
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-center gap-6 mt-6 pb-4">
              <button
                disabled={gamePage === 1}
                onClick={() => setGamePage(prev => Math.max(1, prev - 1))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-gray-400 flex items-center justify-center disabled:opacity-20 hover:bg-gray-700 transition-colors border border-gray-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-purple-500">{gamePage}</span>
                <span className="text-gray-600">/</span>
                <span className="text-sm font-medium text-gray-500">5</span>
              </div>

              <button
                disabled={gamePage === 5}
                onClick={() => setGamePage(prev => Math.min(5, prev + 1))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-gray-400 flex items-center justify-center disabled:opacity-20 hover:bg-gray-700 transition-colors border border-gray-700"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
            <div className="space-y-4">
              {myBets.slice((myPage - 1) * ITEMS_PER_PAGE, myPage * ITEMS_PER_PAGE).map((bet) => (
                <div key={bet.id} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 flex items-center gap-4">
                  {/* Selection Badge */}
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center text-[10px] font-black uppercase shadow-lg shrink-0",
                    bet.selection === 'Big' ? "bg-orange-500" :
                    bet.selection === 'Small' ? "bg-blue-500" :
                    bet.selection === 'Green' ? "bg-emerald-500" :
                    bet.selection === 'Red' ? "bg-rose-500" :
                    bet.selection === 'Violet' ? "bg-purple-500" :
                    !isNaN(Number(bet.selection)) ? NUMBER_COLORS[Number(bet.selection)] : "bg-gray-700"
                  )}>
                    {bet.selection}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-sm text-gray-200 truncate">{bet.periodId}</p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {bet.createdAt?.toDate().toISOString().slice(0, 19).replace('T', ' ')}
                    </p>
                  </div>

                  {/* Status & Amount */}
                  <div className="text-right shrink-0">
                    {bet.status === 'pending' ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-yellow-500/20">
                          Wait
                        </span>
                        <p className="text-sm font-bold text-gray-400">₹{bet.totalAmount.toFixed(2)}</p>
                      </div>
                    ) : bet.status === 'win' ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="bg-emerald-500/10 text-emerald-500 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-emerald-500/20">
                          Succeed
                        </span>
                        <p className="text-sm font-bold text-emerald-500">+{formatCurrency(bet.winAmount || 0)}</p>
                        <p className="text-[8px] text-gray-500 italic">Fee: ₹{bet.fee?.toFixed(2)}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <span className="bg-rose-500/10 text-rose-500 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-rose-500/20">
                          Failed
                        </span>
                        <p className="text-sm font-bold text-rose-500">-{formatCurrency(bet.totalAmount)}</p>
                        <p className="text-[8px] text-gray-500 italic">Fee: ₹{bet.fee?.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Pagination */}
              <div className="flex items-center justify-center gap-6 mt-6 pb-4">
                <button
                  disabled={myPage === 1}
                  onClick={() => setMyPage(prev => Math.max(1, prev - 1))}
                  className="w-10 h-10 rounded-xl bg-gray-800 text-gray-400 flex items-center justify-center disabled:opacity-20 hover:bg-gray-700 transition-colors border border-gray-700"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-purple-500">{myPage}</span>
                  <span className="text-gray-600">/</span>
                  <span className="text-sm font-medium text-gray-500">5</span>
                </div>

                <button
                  disabled={myPage === 5}
                  onClick={() => setMyPage(prev => Math.min(5, prev + 1))}
                  className="w-10 h-10 rounded-xl bg-gray-800 text-gray-400 flex items-center justify-center disabled:opacity-20 hover:bg-gray-700 transition-colors border border-gray-700"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {myBets.length === 0 && (
                <div className="text-center py-20 text-gray-600">
                  <p className="text-sm italic">No bets found in your history</p>
                </div>
              )}
            </div>
        )}
      </div>

      {/* Large Countdown Overlay */}
      <AnimatePresence>
        {timeLeft > 0 && timeLeft <= 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          >
            <div className="flex gap-2">
              {/* Tens digit (always 0 for < 10s) */}
              <motion.div
                key={`tens-${timeLeft}`}
                initial={{ scale: 0.5, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="w-16 h-24 bg-[#4b4e9b] rounded-xl flex items-center justify-center text-[50px] font-bold text-[#b2b5ff] shadow-xl border border-white/10"
              >
                0
              </motion.div>
              {/* Units digit */}
              <motion.div
                key={`units-${timeLeft}`}
                initial={{ scale: 0.5, opacity: 0, y: 10 }}
                animate={{ scale: 1.1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="w-16 h-24 bg-[#4b4e9b] rounded-xl flex items-center justify-center text-[50px] font-bold text-[#b2b5ff] shadow-xl border border-white/10"
              >
                {timeLeft}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Modal */}
      <AnimatePresence>
        {showResultModal && resultData && (
          <div 
            onClick={() => setShowResultModal(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
              className={cn(
                "w-full max-w-xs rounded-[40px] overflow-hidden shadow-2xl relative",
                resultData.bet.status === 'win' 
                  ? "bg-gradient-to-b from-[#ff6b4a] to-[#ff4d4d]" 
                  : "bg-gradient-to-b from-[#d1e3f8] to-[#b8d1f1]"
              )}
            >
              {/* Top Ribbon/Rocket Header */}
              <div className="flex flex-col items-center pt-8 pb-4 relative">
                <button 
                  onClick={() => setShowResultModal(false)}
                  className="absolute top-4 right-4 p-1 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
                >
                  <XCircle className={cn(
                    "w-6 h-6",
                    resultData.bet.status === 'win' ? "text-white/70" : "text-blue-400"
                  )} />
                </button>
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center shadow-lg border-4 mb-4",
                  resultData.bet.status === 'win' 
                    ? "bg-gradient-to-br from-yellow-400 to-orange-500 border-orange-300" 
                    : "bg-gradient-to-br from-blue-100 to-blue-300 border-blue-50"
                )}>
                  <Rocket className={cn(
                    "w-10 h-10",
                    resultData.bet.status === 'win' ? "text-white" : "text-blue-500"
                  )} />
                </div>
                
                <h3 className={cn(
                  "text-2xl font-black uppercase tracking-wider",
                  resultData.bet.status === 'win' ? "text-white" : "text-blue-600"
                )}>
                  {resultData.bet.status === 'win' ? 'Congratulations' : 'Better Luck'}
                </h3>
              </div>

              {/* Lottery Results Row */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-[10px] font-bold opacity-60 text-black/60">Lottery results</span>
                <div className="flex gap-1.5">
                  <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-md font-bold">
                    {resultData.game.resultColor}
                  </span>
                  <span className="bg-emerald-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
                    {resultData.game.resultNumber}
                  </span>
                  <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-md font-bold">
                    {resultData.game.resultSize}
                  </span>
                </div>
              </div>

              {/* White Ticket Section */}
              <div className="px-6 pb-8">
                <div className="bg-white rounded-3xl p-6 shadow-inner relative overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100/50" />
                  
                  <p className={cn(
                    "text-lg font-bold mb-1",
                    resultData.bet.status === 'win' ? "text-rose-500" : "text-gray-400"
                  )}>
                    {resultData.bet.status === 'win' ? 'Bonus' : 'Lose'}
                  </p>
                  
                  {resultData.bet.status === 'win' ? (
                    <div className="flex flex-col items-center mb-2">
                      <h2 className="text-3xl font-black text-rose-500">
                        ₹{resultData.bet.winAmount?.toFixed(2)}
                      </h2>
                      <p className="text-[10px] text-gray-400 mt-1">
                        (4% Fee deducted: ₹{resultData.bet.fee?.toFixed(2)})
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center mb-2">
                      <h2 className="text-3xl font-black text-gray-400">
                        -₹{resultData.bet.netAmount.toFixed(2)}
                      </h2>
                      <p className="text-[10px] text-gray-400 mt-1">
                        (4% Fee deducted: ₹{resultData.bet.fee?.toFixed(2)})
                      </p>
                    </div>
                  )}

                  <div className="space-y-0.5 mt-2">
                    <p className="text-[10px] text-gray-400 font-medium">Period: WINGO {type === '30s' ? '30 sec' : type}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{resultData.bet.periodId}</p>
                  </div>

                  {/* Auto Close Footer */}
                  <div className="mt-6 flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                    2 seconds auto close
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bet Modal */}
      <AnimatePresence>
        {showBetModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-[#1f2228] rounded-t-[40px] p-8 space-y-8 border-t border-gray-800"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  Select {selectedBet}
                </h3>
                <button onClick={() => setShowBetModal(false)} className="p-2 bg-gray-800 rounded-full">
                  <XCircle className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-400">Select Amount</p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 10, 100, 1000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setBetAmount(amt)}
                      className={`py-2 rounded-xl font-bold transition-all ${betAmount === amt ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-400">Multiplier</p>
                <div className="flex items-center gap-4">
                  <button onClick={() => setMultiplier(Math.max(1, multiplier - 1))} className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-xl font-bold">-</button>
                  <input 
                    type="number" 
                    value={multiplier} 
                    onChange={(e) => setMultiplier(parseInt(e.target.value) || 1)}
                    className="flex-1 bg-gray-800 border-none rounded-xl py-2 text-center font-bold outline-none"
                  />
                  <button onClick={() => setMultiplier(multiplier + 1)} className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-xl font-bold">+</button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 5, 10, 20, 50].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMultiplier(m)}
                      className={`py-1 rounded-lg text-xs font-bold ${multiplier === m ? 'bg-purple-600/20 text-purple-400 border border-purple-500/50' : 'bg-gray-800 text-gray-500'}`}
                    >
                      X{m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-purple-500/10 p-4 rounded-2xl flex items-center justify-between border border-purple-500/20">
                <span className="text-sm text-gray-400">Total Amount</span>
                <span className="text-xl font-bold text-purple-400">{formatCurrency(betAmount * multiplier)}</span>
              </div>

              <button
                disabled={isBetting || timeLeft < 5}
                onClick={handlePlaceBet}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-500 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-purple-900/20 disabled:opacity-50"
              >
                {isBetting ? 'Processing...' : timeLeft < 5 ? 'Time Up' : 'Confirm Bet'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
