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
  Target,
  Wallet,
  Volume2,
  VolumeX,
  RefreshCw,
  Megaphone,
  BookOpen,
  BarChart3,
  ArrowUpCircle,
  ArrowDownCircle
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
  runTransaction,
  getDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Game, Bet, GameType } from '../types';
import { toast } from 'sonner';
import GameBall from '../components/GameBall';
import { placeMySQLBet, getMySQLUser } from '../services/apiService';

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
  TICK: '/sounds/countdown.mp3',
  WIN: '/sounds/results/win.mp3',
  LOSS: '/sounds/results/loss.mp3',
  BET: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
};

export default function GamePage() {
  const { type } = useParams<{ type: string }>();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(0);
  const [periodId, setPeriodId] = useState('');
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const currentPeriodRef = useRef('');
  const [history, setHistory] = useState<Game[]>([]);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedBet, setSelectedBet] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(1);
  const [multiplier, setMultiplier] = useState(1);
  const [isBetting, setIsBetting] = useState(false);
  const [activeTab, setActiveTab] = useState<'game' | 'chart' | 'my'>('game');
  const [showResultModal, setShowResultModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [resultData, setResultData] = useState<{ bet: Bet; game: Game } | null>(null);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('music_enabled');
    // If music_enabled is 'true', isMuted should be false (not muted).
    // If music_enabled is 'false', isMuted should be true (muted).
    return saved !== null ? saved === 'false' : false;
  });

  useEffect(() => {
    // Save the opposite of isMuted to music_enabled
    localStorage.setItem('music_enabled', (!isMuted).toString());
  }, [isMuted]);

  const shownBetIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);
  const [gamePage, setGamePage] = useState(1);
  const [myPage, setMyPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const hasPlayedCountdown = useRef(false);
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [linePoints, setLinePoints] = useState<string>("");

  const mountTime = useRef(Date.now());

  // Pre-load countdown sound
  useEffect(() => {
    countdownAudioRef.current = new Audio(SOUNDS.TICK);
    countdownAudioRef.current.load();
  }, []);

  useEffect(() => {
    if (activeTab !== 'chart' || history.length === 0) return;

    const calculatePoints = () => {
      const container = chartContainerRef.current;
      if (!container) return;

      const rows = container.querySelectorAll('.chart-row');
      const points: { x: number; y: number }[] = [];

      rows.forEach((row) => {
        const winningBall = row.querySelector('.winning-ball');
        if (winningBall) {
          const rect = winningBall.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          points.push({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2
          });
        }
      });

      if (points.length > 1) {
        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        setLinePoints(path);
      }
    };

    const timer = setTimeout(calculatePoints, 100);
    window.addEventListener('resize', calculatePoints);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePoints);
    };
  }, [activeTab, history, gamePage]);

  const gameModes = [
    { id: '30s', label: 'WinGo 30sec' },
    { id: '1m', label: 'WinGo 1 Min' },
    { id: '3m', label: 'WinGo 3 Min' },
    { id: '5m', label: 'WinGo 5 Min' },
    { id: 'ladder', label: 'Ladder 1m' },
  ];

  const multipliers = ['Random', 1, 5, 10, 20, 50, 100];

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
    if (url === SOUNDS.TICK && countdownAudioRef.current) {
      countdownAudioRef.current.currentTime = 0;
      countdownAudioRef.current.play().catch(err => console.warn('Countdown play failed:', err));
      return;
    }
    const audio = new Audio(url);
    audio.play().catch((err) => {
      console.warn('Sound play failed:', err);
    });
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

  // Sync with Server
  useEffect(() => {
    const syncWithServer = async () => {
      try {
        const response = await fetch(`/api/current-round/${type}`);
        const data = await response.json();
        if (data.roundId) {
          setPeriodId(data.roundId);
          currentPeriodRef.current = data.roundId;
          
          // Calculate offset between server and client time
          const offset = data.serverTime - Date.now();
          setServerTimeOffset(offset);
          
          // Set initial time left
          setTimeLeft(data.remainingTime);
        }
      } catch (error) {
        console.error('Server sync error:', error);
      }
    };

    syncWithServer();
    const interval = setInterval(syncWithServer, 2000); // Sync every 2s for faster updates
    return () => clearInterval(interval);
  }, [type]);

  // Timer Logic (Synced with Server Offset)
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now() + serverTimeOffset;
      const durationMs = duration * 1000;
      const roundIndex = Math.floor(now / durationMs);
      const roundEnd = (roundIndex + 1) * durationMs;
      
      const remaining = Math.max(0, Math.floor((roundEnd - now) / 1000));
      setTimeLeft(remaining);

      // Period ID logic
      const date = new Date(roundIndex * durationMs);
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const newPeriodId = `${dateStr}${roundIndex}`;
      
      if (newPeriodId !== currentPeriodRef.current) {
        setPeriodId(newPeriodId);
        currentPeriodRef.current = newPeriodId;
        hasPlayedCountdown.current = false;
      }

      // Play sound when displayTime hits 5
      if (remaining <= 5 && remaining > 0 && !hasPlayedCountdown.current && !isMuted) {
        playSound(SOUNDS.TICK);
        hasPlayedCountdown.current = true;
      }
    };

    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [duration, isMuted, serverTimeOffset]);

  // Fetch History
  useEffect(() => {
    const q = query(
      collection(db, 'games'),
      where('gameType', '==', type),
      where('status', '==', 'completed'),
      orderBy('periodId', 'desc'),
      limit(500)
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
      orderBy('createdAt', 'desc'),
      limit(500)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
      
      if (isFirstLoad.current) {
        bets.forEach(bet => {
          if (bet.id && bet.status !== 'pending') {
            shownBetIds.current.add(bet.id);
          }
        });
        isFirstLoad.current = false;
      }

      setMyBets(bets);
    }, (error) => {
      console.error('Bets subscription error:', error);
    });

    return () => unsubscribe();
  }, [user, type]);

  // Result Modal Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showResultModal) {
      timer = setTimeout(() => {
        setShowResultModal(false);
      }, 2000); // Reduced to 2s as requested "automatic jaldi se hat jaaye"
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showResultModal]);

  useEffect(() => {
    if (!myBets.length || !history.length || showResultModal) return;
    
    // Find bets that were recently settled (not pending) and haven't been shown yet
    const latestSettledBet = myBets.find(b => 
      b.id && 
      b.status !== 'pending' && 
      !shownBetIds.current.has(b.id) &&
      (b.settledAt || b.createdAt).toMillis() > mountTime.current - 60000 // Allow up to 1 min before mount just in case of slight clock drift
    );
    
    if (latestSettledBet) {
      const gameResult = history.find(g => g.periodId === latestSettledBet.periodId);
      if (gameResult) {
        shownBetIds.current.add(latestSettledBet.id!);
        setResultData({ bet: latestSettledBet, game: gameResult });
        setShowResultModal(true);
        
        // Refresh balance when modal shows to ensure it's up to date
        refreshUser();
        
        if (latestSettledBet.status === 'win') {
          playSound(SOUNDS.WIN);
        } else {
          playSound(SOUNDS.LOSS);
        }
      }
    }
  }, [myBets, history, showResultModal, refreshUser]);

  const handlePlaceBet = async () => {
    if (!user || !selectedBet) return;
    if (multiplier <= 0) return toast.error('Please enter a valid quantity');
    const total = betAmount * multiplier;
    if (user.balance < total) return toast.error('Insufficient balance');
    if (timeLeft < 5) return toast.error('Betting closed for this round');

    setIsBetting(true);
    try {
      // Try MySQL first if configured
      const mysqlResult = await placeMySQLBet({
        uid: user.uid,
        roundId: periodId,
        gameType: type || '1m',
        selection: selectedBet,
        amount: total
      });

      if (mysqlResult && !mysqlResult.error) {
        setShowBetModal(false);
        toast.success('Bet placed successfully!');
        playSound(SOUNDS.BET);
        refreshUser();
        return;
      }

      // Fallback to Firebase (Existing logic)
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found');
        
        const currentBalance = userSnap.data().balance;
        const currentTurnover = userSnap.data().requiredTurnover || 0;
        if (currentBalance < total) throw new Error('Insufficient balance');

        transaction.update(userRef, { 
          balance: increment(-total),
          totalBets: increment(total),
          dailyBets: increment(total),
          requiredTurnover: Math.max(0, currentTurnover - total)
        });

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

      setShowBetModal(false);
      toast.success('Bet placed successfully!');
      playSound(SOUNDS.BET);
    } catch (error: any) {
      console.error('Betting error:', error);
      toast.error(error.message || 'Failed to place bet');
    } finally {
      setIsBetting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUser();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRandom = () => {
    const randomNum = Math.floor(Math.random() * 10);
    setSelectedBet(randomNum.toString());
    setShowBetModal(true);
  };

  // Chart Statistics Logic
  const stats = useMemo(() => {
    const last100 = history.slice(0, 100);
    const result = {
      missing: Array(10).fill(0),
      avgMissing: Array(10).fill(0),
      frequency: Array(10).fill(0),
      maxConsecutive: Array(10).fill(0),
    };

    if (last100.length === 0) return result;

    // Frequency
    last100.forEach(game => {
      if (game.resultNumber !== undefined) {
        result.frequency[game.resultNumber]++;
      }
    });

    // Missing (current streak of not appearing)
    for (let i = 0; i < 10; i++) {
      let count = 0;
      for (const game of last100) {
        if (game.resultNumber === i) break;
        count++;
      }
      result.missing[i] = count;
    }

    // Avg Missing & Max Consecutive (Simplified)
    for (let i = 0; i < 10; i++) {
      result.avgMissing[i] = Math.floor(100 / (result.frequency[i] + 1));
      
      let max = 0;
      let current = 0;
      last100.forEach(game => {
        if (game.resultNumber === i) {
          current++;
          max = Math.max(max, current);
        } else {
          current = 0;
        }
      });
      result.maxConsecutive[i] = max || 1;
    }

    return result;
  }, [history]);

  const getBetTheme = () => {
    if (selectedBet === 'Big') return {
      header: "bg-gradient-to-b from-[#ffb347] to-[#ff8c00]",
      text: "text-[#ff8c00]",
      solid: "bg-[#ff8c00]",
      gradient: "bg-gradient-to-r from-[#ffb347] to-[#ff8c00]"
    };
    if (selectedBet === 'Small') return {
      header: "bg-gradient-to-b from-[#7ca6f7] to-[#5a8ef5]",
      text: "text-[#5a8ef5]",
      solid: "bg-[#5a8ef5]",
      gradient: "bg-gradient-to-r from-[#7ca6f7] to-[#5a8ef5]"
    };
    
    const isGreen = selectedBet === 'Green' || (selectedBet !== null && [1, 3, 7, 9].includes(Number(selectedBet)));
    if (isGreen) return {
      header: "bg-gradient-to-b from-[#4ade80] to-[#22c55e]",
      text: "text-[#22c55e]",
      solid: "bg-[#22c55e]",
      gradient: "bg-gradient-to-r from-[#4ade80] to-[#22c55e]"
    };
    
    const isRed = selectedBet === 'Red' || (selectedBet !== null && [2, 4, 6, 8].includes(Number(selectedBet)));
    if (isRed) return {
      header: "bg-gradient-to-b from-[#f87171] to-[#ef4444]",
      text: "text-[#ef4444]",
      solid: "bg-[#ef4444]",
      gradient: "bg-gradient-to-r from-[#f87171] to-[#ef4444]"
    };
    
    const isViolet = selectedBet === 'Violet' || (selectedBet !== null && [0, 5].includes(Number(selectedBet)));
    if (isViolet) return {
      header: "bg-gradient-to-b from-[#c084fc] to-[#a855f7]",
      text: "text-[#a855f7]",
      solid: "bg-[#a855f7]",
      gradient: "bg-gradient-to-r from-[#c084fc] to-[#a855f7]"
    };

    return {
      header: "bg-gradient-to-b from-[#7ca6f7] to-[#5a8ef5]",
      text: "text-[#5a8ef5]",
      solid: "bg-[#5a8ef5]",
      gradient: "bg-gradient-to-r from-[#7ca6f7] to-[#5a8ef5]"
    };
  };

  const theme = getBetTheme();

  // Slice history for pagination
  const pagedHistory = useMemo(() => {
    return history.slice((gamePage - 1) * ITEMS_PER_PAGE, gamePage * ITEMS_PER_PAGE);
  }, [history, gamePage]);

  // Slice my bets for pagination
  const pagedMyBets = useMemo(() => {
    return myBets.slice((myPage - 1) * ITEMS_PER_PAGE, myPage * ITEMS_PER_PAGE);
  }, [myBets, myPage]);

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] pb-10">
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-20 border-b border-gray-800"
        style={{ width: '370.323px', height: '49.6667px' }}
      >
        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
          <img 
            src="/images/logo/logo.png" 
            alt="Logo" 
            className="h-12 object-contain" 
            style={{
              paddingTop: '-3px',
              paddingBottom: '-6px',
              marginBottom: '0px',
              width: '100px',
              height: '39px',
              fontSize: '23px',
              fontFamily: 'Arial',
              textDecorationLine: 'underline',
              fontStyle: 'normal',
              fontWeight: 'normal',
              lineHeight: '18px',
              borderRadius: '0px',
              borderWidth: '0px',
              marginLeft: '31px',
              marginRight: '-3px',
              paddingRight: '-1px',
              paddingLeft: '2px'
            }}
            onError={(e) => {
              e.currentTarget.src = "https://picsum.photos/seed/logo/200/200";
            }}
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMuted(!isMuted)} className="p-1 hover:bg-gray-800 rounded-full">
            <img 
              src={!isMuted ? "/images/icons/music_on.png" : "/images/icons/music_off.png"} 
              alt="Music" 
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', !isMuted ? '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume2 text-purple-400"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volumex text-gray-500"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>');
              }}
            />
          </button>
          <button onClick={() => navigate('/customer-service')} className="p-1 hover:bg-gray-800 rounded-full">
            <img 
              src="/images/icons/customer_care.png" 
              alt="CS" 
              className="w-8 h-8 object-contain" 
              referrerPolicy="no-referrer"
            />
          </button>
        </div>
      </div>

      {/* Wallet Card */}
      <div className="px-4 py-4 mb-[-14px]">
        <div className="relative overflow-hidden rounded-[24px] shadow-xl aspect-[2.4/1] border border-white/10">
          <img 
            src="/images/backgrounds/game_top_bg.jpg" 
            alt="Wallet BG" 
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="relative h-full flex flex-col justify-between p-5 pb-[10px] mr-[-4px] mb-[-3px] pt-[6px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Available Balance</span>
              </div>
              <button 
                onClick={handleRefresh}
                className={cn("p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-all backdrop-blur-sm", isRefreshing && "animate-spin")}
              >
                <RefreshCw className="w-4 h-4 text-white" />
              </button>
            </div>
            
            <div className="flex flex-col items-center -mt-2">
              <h3 className="text-4xl font-black text-white drop-shadow-lg tracking-tight">
                {formatCurrency(user?.balance || 0)}
              </h3>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => navigate('/deposit')}
                className="flex-1 bg-gradient-to-r from-[#ffb347] to-[#ff8c00] text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-900/20 active:scale-95 transition-all"
              >
                Deposit
              </button>
              <button 
                onClick={() => navigate('/withdraw')}
                className="flex-1 bg-white/10 backdrop-blur-md text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-white/20 shadow-lg active:scale-95 transition-all"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Announcement */}
      <div className="px-4 mb-4 mr-[2px] mb-[3px]">
        <div className="bg-[#1f2228] rounded-full p-2 flex items-center gap-3 border border-gray-800">
          <div className="p-1.5 bg-purple-500/20 rounded-full">
            <Megaphone className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[10px] text-gray-400 whitespace-nowrap animate-marquee">
              Invite your friends and earn! Refer a friend and get a flat 20% bonus on their first deposit.
            </p>
          </div>
          <button className="bg-gradient-to-r from-purple-600 to-blue-500 text-[10px] px-4 py-1.5 rounded-full font-bold shadow-lg">
            Detail
          </button>
        </div>
      </div>

      {/* Game Mode Selection */}
      <div 
        className="px-4 mb-6"
        style={{ marginLeft: '-1px', paddingLeft: '21px', paddingTop: '1px' }}
      >
        <div 
          className="grid grid-cols-4 gap-2"
          style={{ marginLeft: '-3px', paddingBottom: '-7px', paddingRight: '-4px', marginRight: '-7px', marginBottom: '-15px' }}
        >
          {gameModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => navigate(`/game/${mode.id}`)}
              className={cn(
                "flex flex-col items-center p-3 rounded-2xl border transition-all",
                type === mode.id 
                  ? "bg-gradient-to-b from-purple-600 to-blue-500 border-transparent shadow-lg shadow-purple-900/20" 
                  : "bg-[#1f2228] border-gray-800 text-gray-500"
              )}
            >
              <img 
                src="/images/icons/time.png" 
                alt={mode.label} 
                className={cn("w-8 h-8 mb-2 object-contain", type !== mode.id && "opacity-50 grayscale")}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock w-6 h-6 mb-2 ${type === mode.id ? 'text-white' : 'text-gray-600'}"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`);
                }}
              />
              <span className="text-[10px] font-bold text-center leading-tight">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Timer & Results Section */}
      <div className="px-4 mb-6">
        <div className="relative aspect-[3.2/1] w-full overflow-hidden rounded-2xl shadow-2xl">
          {/* Ticket Background Image */}
          <img 
            src="/images/backgrounds/ticket_bg.png" 
            className="absolute inset-0 h-full w-full object-fill"
            onError={(e) => {
              e.currentTarget.src = "/images/backgrounds/game_top_bg.jpg";
            }}
            referrerPolicy="no-referrer"
          />
          
          {/* Fallback Gradient (if image fails) */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#ff8a71] via-[#9d6eff] to-[#4facfe] opacity-90" />

          <div 
            className="relative flex h-full items-center justify-between px-6 py-4 text-[22px] leading-[14px]"
            style={{ paddingTop: '21px', paddingBottom: '4px', paddingRight: '64px', height: '107.292px', width: '395px' }}
          >
            {/* Left Side */}
            <div className="flex h-full flex-col justify-between py-1">
              <button 
                onClick={() => setShowRulesModal(true)}
                className="flex w-fit items-center gap-2 rounded-full border border-black/20 bg-black/10 text-[10px] font-bold text-black/70 backdrop-blur-sm transition-all hover:bg-black/20 leading-[10px] text-justify"
                style={{ paddingLeft: '13px', paddingRight: '22px', paddingBottom: '5px', paddingTop: '9px', marginLeft: '4px', marginRight: '5px', marginTop: '-9px' }}
              >
                <BookOpen className="w-3 h-3" />
                How to play
              </button>
              
              <div className="space-y-2">
                <p className="text-[11px] font-black tracking-tight text-black/60">WinGo {type === '30s' ? '30sec' : type}</p>
                <div className="flex gap-1.5 h-6">
                  {history.slice(0, 5).reverse().map((game, i) => (
                    <div key={i} className="relative">
                      <GameBall number={game.resultNumber || 0} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex h-full flex-col items-end justify-between py-1 text-right">
              <div>
                <p className="mb-2 text-[13px] font-black uppercase tracking-wider text-black/60 pb-0 pt-0 ml-0 mt-[5px]">Time remaining</p>
                <div className="flex items-center gap-1">
                  <div className="flex gap-0.5">
                    <div className="flex h-9 w-7 items-center justify-center rounded-md bg-[#1a1d21] text-xl font-black text-white shadow-inner font-mono leading-none">
                      {Math.max(0, Math.floor(timeLeft / 60 / 10))}
                    </div>
                    <div className="flex h-9 w-7 items-center justify-center rounded-md bg-[#1a1d21] text-xl font-black text-white shadow-inner font-mono leading-none">
                      {Math.max(0, Math.floor(timeLeft / 60) % 10)}
                    </div>
                  </div>
                  <div className="text-xl font-black text-[#1a1d21] leading-none">:</div>
                  <div className="flex gap-0.5">
                    <div className="flex h-9 w-7 items-center justify-center rounded-md bg-[#1a1d21] text-xl font-black text-white shadow-inner font-mono leading-none">
                      {Math.max(0, Math.floor((timeLeft % 60) / 10))}
                    </div>
                    <div className={cn(
                      "flex h-9 w-7 items-center justify-center rounded-md bg-[#1a1d21] text-xl font-black shadow-inner font-mono leading-none",
                      timeLeft < 10 ? "text-rose-500" : "text-white"
                    )}>
                      {Math.max(0, timeLeft % 10)}
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-[11px] font-black tracking-widest text-black/80">{periodId}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Betting Buttons Section */}
      <div className="px-4 mb-6">
        <div 
          className="bg-[#1f2228] rounded-[32px] p-6 border border-gray-800 shadow-xl ml-[-12px] mr-[-13px] pt-[5px] pb-[5px]"
          style={{ width: '370.333px', height: '307.656px' }}
        >
          <div className="space-y-6">
            <div 
              className="grid grid-cols-3 gap-3"
              style={{ marginRight: '-13px', marginBottom: '-6px', marginTop: '4px' }}
            >
              <button 
                onClick={() => { setSelectedBet('Green'); setShowBetModal(true); }}
                className="bg-[#10b981] hover:bg-emerald-600 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all active:scale-95 pt-0 pl-[3px] pr-0 pb-0 ml-[-12px] mt-[-1px] mb-[6px] mr-[11px]"
              >
                Green
              </button>
              <button 
                onClick={() => { setSelectedBet('Violet'); setShowBetModal(true); }}
                className="bg-[#a855f7] hover:bg-purple-600 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-purple-900/20 transition-all active:scale-95 pt-0 pl-[3px] pb-0 ml-[-6px] mr-[4px] mt-[-1px] mb-[6px]"
              >
                Violet
              </button>
              <button 
                onClick={() => { setSelectedBet('Red'); setShowBetModal(true); }}
                className="bg-[#f43f5e] hover:bg-rose-600 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-rose-900/20 transition-all active:scale-95 mt-[-1px] ml-[-3px] mr-[-6px] pl-[3px] mb-[6px]"
              >
                Red
              </button>
            </div>

            <div 
              className="bg-[#1a1d21] rounded-[8px] p-4 border-[0px] border-gray-800/50 pt-[11px] ml-[-21px] mr-[-20px] mb-[5px] mt-[10px] pr-0 pb-[15px] pl-[2px]"
              style={{ width: '363px', height: '131px', marginRight: '-13px', paddingLeft: '-3px', paddingRight: '-2px', paddingBottom: '10px' }}
            >
              <div className="grid grid-cols-5 gap-y-4 gap-x-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => { setSelectedBet(num.toString()); setShowBetModal(true); }}
                    className="hover:scale-110 transition-transform flex justify-center"
                  >
                    <GameBall number={num} size="md" />
                  </button>
                ))}
              </div>
            </div>

            <div 
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
              style={{ marginBottom: '10px', marginRight: '-20px', marginLeft: '-18px', marginTop: '3px', paddingBottom: '0px', width: '361px' }}
            >
              <button
                onClick={handleRandom}
                className="px-4 py-2 rounded-lg border border-rose-500/50 text-rose-400 text-xs font-bold whitespace-nowrap bg-rose-500/5 hover:bg-rose-500/10 transition-all"
                style={{ height: '30.3333px', width: '70.0938px', paddingBottom: '-3px', paddingRight: '19px', marginBottom: '1px', marginRight: '-1px', fontSize: '14px', lineHeight: '18px', marginTop: '3px', marginLeft: '1px', paddingLeft: '5px', paddingTop: '0px' }}
              >
                Random
              </button>
              <div className="flex gap-2">
                {[1, 5, 10, 20, 50, 100].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMultiplier(m)}
                    className={cn(
                      "w-12 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center",
                      multiplier === m
                        ? "bg-[#10b981] text-white shadow-lg shadow-emerald-900/20" 
                        : "bg-[#2a2e35] text-gray-400 hover:text-gray-200"
                    )}
                    style={
                      m === 1 ? { width: '41px', height: '31px', marginRight: '-10px', paddingTop: '10px', paddingRight: '-2px', marginLeft: '1px', paddingBottom: '9px' } :
                      m === 5 ? { width: '40px', marginLeft: '8px', paddingTop: '7px', paddingBottom: '8px', marginBottom: '0px' } :
                      m === 10 ? { width: '38px' } :
                      m === 20 ? { width: '38px' } :
                      m === 50 ? { width: '38px' } :
                      {}
                    }
                  >
                    X{m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex h-14 rounded-full overflow-hidden shadow-xl">
              <button 
                onClick={() => { setSelectedBet('Big'); setShowBetModal(true); }}
                className="flex-1 bg-gradient-to-r from-[#ffb347] to-[#ffcc33] font-black text-lg text-white/90 active:scale-95 transition-all"
                style={{ fontSize: '22px', lineHeight: '41px', paddingTop: '0px', fontWeight: 'bold' }}
              >
                Big
              </button>
              <button 
                onClick={() => { setSelectedBet('Small'); setShowBetModal(true); }}
                className="flex-1 bg-gradient-to-r from-[#4facfe] to-[#00f2fe] font-black text-lg text-white/90 active:scale-95 transition-all"
                style={{ width: '146.5px', height: '57px', lineHeight: '20px', fontSize: '22px', marginRight: '-1px', marginLeft: '-1px', marginTop: '-1px', marginBottom: '-6px', paddingTop: '-2px', paddingLeft: '-1px', paddingBottom: '-4px' }}
              >
                Small
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History / Chart Tabs */}
      <div 
        className="px-4"
        style={{ paddingLeft: '4px', paddingRight: '16px', marginLeft: '-1px', marginRight: '-1px', width: '375.333px', height: '864.667px' }}
      >
        <div className="flex bg-[#1a1d21] p-1 rounded-2xl mb-6 border border-gray-800/50">
          <button 
            onClick={() => setActiveTab('game')}
            className={cn(
              "flex-1 py-3 rounded-xl text-xs font-bold transition-all",
              activeTab === 'game' ? "bg-gradient-to-r from-[#ff8a71] to-[#ff5858] text-white shadow-lg" : "text-gray-500"
            )}
          >
            Game history
          </button>
          <button 
            onClick={() => setActiveTab('chart')}
            className={cn(
              "flex-1 py-3 rounded-xl text-xs font-bold transition-all",
              activeTab === 'chart' ? "bg-[#2a2e35] text-gray-500" : "text-gray-500"
            )}
          >
            Chart
          </button>
          <button 
            onClick={() => setActiveTab('my')}
            className={cn(
              "flex-1 py-3 rounded-xl text-xs font-bold transition-all",
              activeTab === 'my' ? "bg-[#2a2e35] text-gray-500" : "text-gray-500"
            )}
            style={{ borderStyle: 'none' }}
          >
            My history
          </button>
        </div>

        {activeTab === 'game' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider px-2">
              <span>Period</span>
              <span className="text-center">Number</span>
              <span className="text-center">Big Small</span>
              <span className="text-right">Color</span>
            </div>
            {pagedHistory.map((game) => (
              <div key={game.id} className="bg-[#1f2228] p-3 rounded-xl border border-gray-800 grid grid-cols-4 items-center">
                <span className="text-xs font-mono text-gray-400">{game.periodId}</span>
                <div className="flex justify-center">
                  <span className={cn("text-2xl font-black italic", 
                    game.resultNumber === 0 ? "text-rose-500" :
                    game.resultNumber === 5 ? "text-emerald-500" :
                    [1,3,7,9].includes(game.resultNumber!) ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {game.resultNumber}
                  </span>
                </div>
                <div className="flex justify-center">
                  <span className="text-xs font-bold text-white">{game.resultSize}</span>
                </div>
                <div className="flex justify-end gap-1">
                  {game.resultNumber === 0 ? (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    </>
                  ) : game.resultNumber === 5 ? (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    </>
                  ) : (
                    <div className={cn("w-2.5 h-2.5 rounded-full", 
                      game.resultColor === 'Green' ? 'bg-emerald-500' : 
                      game.resultColor === 'Red' ? 'bg-rose-500' : 'bg-purple-500'
                    )} />
                  )}
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-center gap-6 mt-6 pb-6 bg-[#1a1d21]">
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
                <span className="text-sm font-medium text-gray-500">{Math.ceil(history.length / ITEMS_PER_PAGE) || 1}</span>
              </div>

              <button
                disabled={gamePage >= Math.ceil(history.length / ITEMS_PER_PAGE)}
                onClick={() => setGamePage(prev => Math.min(Math.ceil(history.length / ITEMS_PER_PAGE), prev + 1))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-gray-400 flex items-center justify-center disabled:opacity-20 hover:bg-gray-700 transition-colors border border-gray-700"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="bg-[#1f2228] rounded-3xl border border-gray-800 overflow-hidden relative" ref={chartContainerRef}>
            <div className="grid grid-cols-[repeat(13,1fr)] bg-gray-800/50 p-3 text-[10px] font-bold text-gray-400 border-b border-gray-800">
              <div className="col-span-2">Period</div>
              {[0,1,2,3,4,5,6,7,8,9].map(n => (
                <div key={n} className="text-center">{n}</div>
              ))}
              <div className="text-right"></div>
            </div>
            
            <div className="divide-y divide-gray-800/50 relative">
              {/* Statistics Rows */}
              <div className="grid grid-cols-[repeat(13,1fr)] p-3 text-[10px] font-medium">
                <div className="col-span-2 text-gray-500">Statistic</div>
                <div className="col-span-11 text-gray-400 text-center">(last 100 Periods)</div>
              </div>
              
              <div className="grid grid-cols-[repeat(13,1fr)] p-3 text-[10px] font-medium">
                <div className="col-span-2 text-gray-500">Winning</div>
                {[0,1,2,3,4,5,6,7,8,9].map(n => (
                  <div key={n} className="text-center text-rose-400 font-bold">{n}</div>
                ))}
                <div></div>
              </div>

              <div className="grid grid-cols-[repeat(13,1fr)] p-3 text-[10px] font-medium">
                <div className="col-span-2 text-gray-500">Missing</div>
                {stats.missing.map((m, i) => (
                  <div key={i} className="text-center text-gray-400">{m}</div>
                ))}
                <div></div>
              </div>

              <div className="grid grid-cols-[repeat(13,1fr)] p-3 text-[10px] font-medium">
                <div className="col-span-2 text-gray-500">Avg miss</div>
                {stats.avgMissing.map((m, i) => (
                  <div key={i} className="text-center text-gray-400">{m}</div>
                ))}
                <div></div>
              </div>

              <div className="grid grid-cols-[repeat(13,1fr)] p-3 text-[10px] font-medium">
                <div className="col-span-2 text-gray-500">Frequency</div>
                {stats.frequency.map((f, i) => (
                  <div key={i} className="text-center text-gray-400">{f}</div>
                ))}
                <div></div>
              </div>

              <div className="grid grid-cols-[repeat(13,1fr)] p-3 text-[10px] font-medium">
                <div className="col-span-2 text-gray-500">Max cons</div>
                {stats.maxConsecutive.map((m, i) => (
                  <div key={i} className="text-center text-gray-400">{m}</div>
                ))}
                <div></div>
              </div>

              {/* Recent Results Rows */}
              {history.slice(0, 10).map((game) => (
                <div key={game.id} className="grid grid-cols-[repeat(13,1fr)] p-3 text-[10px] font-mono chart-row items-center">
                  <div className="col-span-2 text-gray-500">{game.periodId.slice(-4)}</div>
                  {[0,1,2,3,4,5,6,7,8,9].map(n => (
                    <div key={n} className="flex justify-center items-center">
                      {game.resultNumber === n ? (
                        <GameBall number={n} size="sm" className="winning-ball z-20" />
                      ) : (
                        <span className="text-gray-700 border border-gray-800/50 rounded-full w-5 h-5 flex items-center justify-center">{n}</span>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white",
                      game.resultSize === 'Big' ? "bg-orange-500" : "bg-blue-500"
                    )}>
                      {game.resultSize === 'Big' ? 'B' : 'S'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'my' && (
          <div className="space-y-4">
            {pagedMyBets.map((bet) => (
              <div key={bet.id} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 flex items-center gap-4">
                {!isNaN(Number(bet.selection)) ? (
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black italic uppercase shadow-lg shrink-0",
                    [1, 3, 7, 9].includes(Number(bet.selection)) ? "bg-emerald-500 text-white" :
                    [2, 4, 6, 8].includes(Number(bet.selection)) ? "bg-rose-500 text-white" :
                    Number(bet.selection) === 0 ? "bg-[linear-gradient(135deg,#f43f5e_50%,#a855f7_50%)] text-white" :
                    Number(bet.selection) === 5 ? "bg-[linear-gradient(135deg,#10b981_50%,#a855f7_50%)] text-white" : "bg-gray-500 text-white"
                  )}>
                    {bet.selection}
                  </div>
                ) : (
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center text-[10px] font-black uppercase shadow-lg shrink-0",
                    bet.selection === 'Big' ? "bg-orange-500" :
                    bet.selection === 'Small' ? "bg-blue-500" :
                    bet.selection === 'Green' ? "bg-emerald-500" :
                    bet.selection === 'Red' ? "bg-rose-500" :
                    bet.selection === 'Violet' ? "bg-purple-500" : "bg-gray-700"
                  )}>
                    {bet.selection}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-sm text-gray-200 truncate">{bet.periodId}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {bet.createdAt?.toDate().toISOString().slice(0, 19).replace('T', ' ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {bet.status === 'pending' ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-yellow-500/20">Wait</span>
                      <p className="text-sm font-bold text-gray-400">₹{bet.totalAmount.toFixed(2)}</p>
                    </div>
                  ) : bet.status === 'win' ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="bg-emerald-500/10 text-emerald-500 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-emerald-500/20">Succeed</span>
                      <p className="text-sm font-bold text-emerald-500">+{formatCurrency(bet.winAmount || 0)}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <span className="bg-rose-500/10 text-rose-500 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-rose-500/20">Failed</span>
                      <p className="text-sm font-bold text-rose-500">-{formatCurrency(bet.totalAmount)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-center gap-6 mt-6 pb-6 bg-[#1a1d21]">
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
                <span className="text-sm font-medium text-gray-500">{Math.ceil(myBets.length / ITEMS_PER_PAGE) || 1}</span>
              </div>

              <button
                disabled={myPage >= Math.ceil(myBets.length / ITEMS_PER_PAGE)}
                onClick={() => setMyPage(prev => Math.min(Math.ceil(myBets.length / ITEMS_PER_PAGE), prev + 1))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-gray-400 flex items-center justify-center disabled:opacity-20 hover:bg-gray-700 transition-colors border border-gray-700"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Countdown Overlay */}
      <AnimatePresence>
        {timeLeft <= 5 && timeLeft >= 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          >
            <div className="flex gap-4">
              <motion.div
                key={`tens-${timeLeft}`}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-32 h-48 bg-[#4b4e9b] rounded-3xl flex items-center justify-center text-[120px] font-black text-white shadow-2xl"
              >
                0
              </motion.div>
              <motion.div
                key={`units-${timeLeft}`}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-32 h-48 bg-[#4b4e9b] rounded-3xl flex items-center justify-center text-[120px] font-black text-white shadow-2xl"
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
            className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/60 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-[340px] relative pointer-events-auto"
            >
              {/* Background Image */}
              <img 
                src={resultData.bet.status === 'win' ? "/images/results/win_popup.png" : "/images/results/loss_popup.png"}
                className="w-full h-auto block"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              
              {/* Close Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowResultModal(false);
                }} 
                className="absolute top-10 right-4 z-50 p-1 hover:scale-110 transition-all opacity-0 pointer-events-none"
              >
                <img 
                  src="/images/icons/close.png" 
                  alt="Close" 
                  className="w-8 h-8 object-contain"
                  referrerPolicy="no-referrer"
                />
              </button>

              <div className="absolute inset-0 flex flex-col items-center justify-between py-10 px-6">
                <div className="text-center space-y-2 mt-20">
                  <h3 className={cn(
                    "text-3xl font-black uppercase tracking-widest drop-shadow-lg",
                    resultData.bet.status === 'win' ? "text-white" : "text-blue-100"
                  )}>
                    {resultData.bet.status === 'win' ? 'Congratulations' : 'Sorry'}
                  </h3>
                </div>

                <div className="flex flex-col items-center space-y-4 w-full mb-12">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-[11px] font-bold text-white/80 uppercase tracking-tighter">Lottery results</span>
                    <div className="flex gap-2 items-center">
                      <span className={cn(
                        "text-white text-[10px] px-2.5 py-1 rounded-md font-black shadow-sm",
                        resultData.game.resultColor === 'Green' ? 'bg-emerald-500' : 
                        resultData.game.resultColor === 'Red' ? 'bg-rose-500' : 'bg-purple-500'
                      )}>
                        {resultData.game.resultColor}
                      </span>
                      <GameBall number={resultData.game.resultNumber || 0} size="sm" className="shadow-sm" />
                      <span className={cn(
                        "text-white text-[10px] px-2.5 py-1 rounded-md font-black shadow-sm",
                        resultData.game.resultSize === 'Big' ? 'bg-orange-500' : 'bg-blue-500'
                      )}>
                        {resultData.game.resultSize}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white/95 backdrop-blur-md rounded-[30px] p-6 w-full max-w-[260px] flex flex-col items-center shadow-xl border border-white/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent opacity-50" />
                    
                    <p className={cn(
                      "text-xs font-black uppercase tracking-widest mb-1",
                      resultData.bet.status === 'win' ? "text-[#ff4d4d]" : "text-gray-400"
                    )}>
                      {resultData.bet.status === 'win' ? 'Bonus' : 'Lose'}
                    </p>
                    <h2 className={cn(
                      "text-4xl font-black italic",
                      resultData.bet.status === 'win' ? "text-[#ff4d4d]" : "text-gray-400"
                    )}>
                      {resultData.bet.status === 'win' ? `₹${resultData.bet.winAmount?.toFixed(2)}` : `₹${resultData.bet.totalAmount.toFixed(2)}`}
                    </h2>
                    <div className="mt-4 text-center space-y-0.5">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Period: WinGo {type === '30s' ? '30 sec' : type}</p>
                      <p className="text-[10px] text-gray-400 font-mono tracking-tighter">{resultData.bet.periodId}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-white font-bold tracking-tight bg-black/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 mb-[-10px]">
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-inner">
                    <Check className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  2 seconds auto close
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRulesModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-[360px] bg-[#1f2228] rounded-[32px] overflow-hidden border border-gray-800 shadow-2xl"
            >
              <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-6 text-center">
                <h3 className="text-white font-black uppercase tracking-widest">Game Rules</h3>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-6 text-gray-300">
                  <section>
                    <h4 className="text-purple-400 font-bold mb-2 flex items-center gap-2">
                      <img src="/images/icons/time.png" alt="Time" className="w-4 h-4 object-contain" /> Time Duration
                    </h4>
                    <p className="text-xs leading-relaxed">Each round lasts 30 seconds.</p>
                  </section>

                  <section>
                    <h4 className="text-purple-400 font-bold mb-2 flex items-center gap-2">
                      <Target className="w-4 h-4" /> Prediction Options
                    </h4>
                    <p className="text-xs leading-relaxed mb-2 text-gray-400 italic">You can place bets in 3 ways:</p>
                    <ul className="space-y-2 text-xs">
                      <li className="flex justify-between items-center bg-gray-800/50 p-2 rounded-lg">
                        <span className="font-bold">Color</span>
                        <span className="text-gray-400">Green / Red / Violet</span>
                      </li>
                      <li className="flex justify-between items-center bg-gray-800/50 p-2 rounded-lg">
                        <span className="font-bold">Number</span>
                        <span className="text-emerald-400">0 to 9 (₹1 = ₹8.64)</span>
                      </li>
                      <li className="flex justify-between items-center bg-gray-800/50 p-2 rounded-lg">
                        <span className="font-bold">Big / Small</span>
                        <span className="text-blue-400">S: 0-4 | B: 5-9 (₹1 = ₹1.96)</span>
                      </li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="text-purple-400 font-bold mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4" /> Color Rules
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg text-center">
                        <p className="text-emerald-500 font-bold text-[10px]">Green</p>
                        <p className="text-[10px] text-gray-400">1, 3, 7, 9</p>
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg text-center">
                        <p className="text-rose-500 font-bold text-[10px]">Red</p>
                        <p className="text-[10px] text-gray-400">2, 4, 6, 8</p>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/20 p-2 rounded-lg text-center">
                        <p className="text-purple-500 font-bold text-[10px]">Violet</p>
                        <p className="text-[10px] text-gray-400">0, 5</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-purple-400 font-bold mb-2 flex items-center gap-2">
                      <Rocket className="w-4 h-4" /> Bet Placement
                    </h4>
                    <p className="text-xs leading-relaxed">Select your choice and set the amount before the timer ends.</p>
                  </section>
                </div>
              </div>
              <div className="p-4 bg-gray-800/50">
                <button 
                  onClick={() => setShowRulesModal(false)}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-500 text-white py-3 rounded-2xl font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bet Modal */}
      <AnimatePresence>
        {showBetModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-[430px] bg-[#1f2228] rounded-t-[32px] overflow-hidden border-t border-gray-800"
            >
              {/* Modal Header */}
              <div className={cn(
                "p-6 text-center space-y-3 relative transition-colors duration-300",
                theme.header
              )}>
                <h3 className="text-white font-bold text-lg">WinGo {type === '30s' ? '30sec' : type === '1m' ? '1 Min' : type === '3m' ? '3 Min' : '5 Min'}</h3>
                <div className="bg-white rounded-lg py-2 px-4 inline-block shadow-md">
                  <span className={cn(
                    "font-bold text-sm",
                    theme.text
                  )}>Select {selectedBet}</span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Balance Selection */}
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium text-sm">Balance</span>
                  <div className="flex gap-2">
                    {[1, 10, 100, 1000].map((amt) => (
                      <button 
                        key={amt} 
                        onClick={() => setBetAmount(amt)} 
                        className={cn(
                          "px-3 py-1.5 rounded-md font-bold text-xs transition-all", 
                          betAmount === amt ? theme.solid + ' text-white' : 'bg-[#2a2e35] text-gray-400'
                        )}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity Selection */}
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium text-sm">Quantity</span>
                  <div className="flex items-center bg-[#2a2e35] rounded-md overflow-hidden">
                    <button 
                      onClick={() => setMultiplier(Math.max(1, multiplier - 1))} 
                      className={cn(
                        "w-8 h-8 flex items-center justify-center text-white text-lg font-bold transition-colors",
                        theme.solid
                      )}
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      value={multiplier || ''} 
                      onChange={(e) => setMultiplier(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)} 
                      className="w-12 bg-transparent border-none text-center font-bold text-white text-sm outline-none" 
                    />
                    <button 
                      onClick={() => setMultiplier(multiplier + 1)} 
                      className={cn(
                        "w-8 h-8 flex items-center justify-center text-white text-lg font-bold transition-colors",
                        theme.solid
                      )}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Multiplier Quick Select */}
                <div className="flex justify-end gap-2">
                  {[1, 5, 10, 20, 50, 100].map((m) => (
                    <button 
                      key={m} 
                      onClick={() => setMultiplier(m)} 
                      className={cn(
                        "px-2.5 py-1.5 rounded-md font-bold text-[10px] transition-all", 
                        multiplier === m ? theme.solid + ' text-white' : 'bg-[#2a2e35] text-gray-400'
                      )}
                    >
                      X{m}
                    </button>
                  ))}
                </div>

                {/* Agreement */}
                <div className="flex items-center gap-2 pt-2">
                  <button 
                    onClick={() => setAgreed(!agreed)}
                    className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center transition-all",
                      agreed ? theme.solid : "border border-gray-600"
                    )}
                  >
                    {agreed && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                  <p className="text-[10px] text-gray-400">
                    I agree <span className="text-rose-400">《Pre-sale rules》</span>
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex h-14">
                <button 
                  onClick={() => setShowBetModal(false)} 
                  className="flex-1 bg-[#2a2e35] text-white font-bold text-sm"
                >
                  Cancel
                </button>
                <button 
                  disabled={isBetting || timeLeft < 5 || !agreed} 
                  onClick={handlePlaceBet} 
                  className={cn(
                    "flex-[2] text-white font-bold text-sm disabled:opacity-50 transition-colors",
                    theme.solid
                  )}
                >
                  {isBetting ? 'Processing...' : `Total amount ₹${(betAmount * multiplier).toFixed(2)}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
