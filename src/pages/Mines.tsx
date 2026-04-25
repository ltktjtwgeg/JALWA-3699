import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wallet, Info, Bomb, Gem, RefreshCw, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, writeBatch, onSnapshot, runTransaction } from 'firebase/firestore';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';

const GRID_SIZE = 25;
const INITIAL_MINES = 3;

export default function Mines() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(INITIAL_MINES);
  const [grid, setGrid] = useState<(string | null)[]>(new Array(GRID_SIZE).fill(null));
  const [mines, setMines] = useState<number[]>([]);
  const [gameState, setGameState] = useState<'betting' | 'playing' | 'won' | 'lost'>('betting');
  const [revealedCount, setRevealedCount] = useState(0);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Sound effects
  const playSound = (type: 'click' | 'gem' | 'bomb' | 'win') => {
    try {
      const audio = new Audio(`/sounds/${type}.mp3`);
      audio.volume = 0.5;
      audio.play().catch(() => {}); // Ignore errors if browsers block autoplay
    } catch (e) {
      console.warn("Audio failed");
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_config', 'settings'), (snap) => {
      if (snap.exists()) setSettings(snap.data());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'mines_sessions'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  // Calculate current multiplier
  const calculateMultiplier = (nRev: number, nMines: number) => {
    if (nRev === 0) return 1;
    let multiplier = 1;
    for (let i = 0; i < nRev; i++) {
        multiplier *= (GRID_SIZE - i) / (GRID_SIZE - nMines - i);
    }
    // House edge (approx 3%)
    return multiplier * 0.97;
  };

  const currentMultiplier = calculateMultiplier(revealedCount, mineCount);
  const currentWin = betAmount * currentMultiplier;

  const startGame = async () => {
    if (!user) return toast.error('Please login first');
    if (gameState === 'playing' || isStarting) return;
    
    if (user.balance < betAmount) {
      return toast.error('Insufficient balance');
    }

    setIsStarting(true);
    playSound('click');

    try {
      // Check for Admin Control - Restricted to this user or global
      let newMines: number[] = [];
      const controlQuery = query(
        collection(db, 'game_controls'),
        where('status', '==', 'pending'),
        where('type', '==', 'mines'),
        where('targetUsername', 'in', [user.username, 'global']),
        limit(10)
      );
      
      const controlSnap = await getDocs(controlQuery);
      let controlId = null;

      // Sort and find first matching control (global or specific to this user)
      const sortedDocs = controlSnap.docs.sort((a, b) => {
        const aTime = a.data().createdAt?.toMillis() || 0;
        const bTime = b.data().createdAt?.toMillis() || 0;
        return aTime - bTime;
      });

      const matchingControl = sortedDocs.find(d => {
        const data = d.data();
        return data.targetUsername === 'global' || data.targetUsername === user.username;
      });

      if (matchingControl) {
        const cData = matchingControl.data();
        if (cData.targetMines) {
          newMines = cData.targetMines;
          controlId = matchingControl.id;
        }
      }

      // If no admin control, generate random mines
      if (newMines.length === 0) {
        while (newMines.length < mineCount) {
          const pos = Math.floor(Math.random() * GRID_SIZE);
          if (!newMines.includes(pos)) {
            newMines.push(pos);
          }
        }
      } else {
        setMineCount(newMines.length);
      }

      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User data not found');
        
        const userData = userSnap.data();
        if ((userData.balance || 0) < betAmount) throw new Error('Insufficient balance');

        transaction.update(userRef, {
          balance: increment(-betAmount),
          totalBets: increment(betAmount),
          dailyBets: increment(betAmount),
          requiredTurnover: Math.max(0, (userData.requiredTurnover || 0) - betAmount)
        });

        if (controlId) {
          transaction.update(doc(db, 'game_controls', controlId), {
            status: 'used',
            usedBy: user.username,
            usedAt: serverTimestamp()
          });
        }

        const sessionRef = doc(collection(db, 'mines_sessions'));
        transaction.set(sessionRef, {
          uid: user.uid,
          username: user.username,
          betAmount,
          mineCount: newMines.length || mineCount,
          status: 'playing',
          revealedCount: 0,
          revealedIndices: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        setSessionId(sessionRef.id);
      });

      setMines(newMines);
      setGrid(new Array(GRID_SIZE).fill(null));
      setRevealedCount(0);
      setGameState('playing');
      refreshUser();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to start game. Please check connection.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleTileClick = async (index: number) => {
    if (gameState !== 'playing' || grid[index] !== null) return;

    const newGrid = [...grid];
    const mode = settings?.minesMode || 'random';
    let isHit = mines.includes(index);

    // Global Admin Force Outcome
    if (mode === 'force_loss') isHit = true;
    if (mode === 'force_win') isHit = false;

    if (isHit) {
      // If forced hit but wasn't a mine, or just normal hit
      let finalMines = [...mines];
      if (!finalMines.includes(index)) {
         // Re-adjust mines to include this one and keep count correct
         finalMines = finalMines.filter((_, i) => i < mineCount - 1);
         finalMines.push(index);
         setMines(finalMines);
      }

      // Game Over
      newGrid[index] = 'bomb';
      setGrid(newGrid);
      setGameState('lost');
      
      // Reveal all mines
      const revealedGrid = newGrid.map((val, idx) => finalMines.includes(idx) ? 'bomb' : val);
      setGrid(revealedGrid);
      playSound('bomb');

      // Record result
      if (sessionId) {
        updateDoc(doc(db, 'mines_sessions', sessionId), {
          status: 'lost',
          revealedIndices: grid.map((v, i) => v === 'gem' ? i : (i === index ? 'bomb' : null)).filter(v => v !== null),
          updatedAt: serverTimestamp()
        });
      }

      // Record loss
      await addDoc(collection(db, 'transactions'), {
        uid: user?.uid,
        amount: betAmount,
        type: 'mines_loss',
        status: 'completed',
        createdAt: serverTimestamp(),
        description: `Mines lost (${mineCount} mines)`
      });

    } else {
      // Safe (maybe forced safe)
      let finalMines = [...mines];
      if (finalMines.includes(index)) {
         // Was supposed to be a mine but forced safe, move it to unrevealed
         const available = Array.from({length: 25}).map((_, i) => i).filter(i => i !== index && !finalMines.includes(i) && grid[i] === null);
         if (available.length > 0) {
            const newPos = available[Math.floor(Math.random() * available.length)];
            finalMines = finalMines.map(m => m === index ? newPos : m);
            setMines(finalMines);
         }
      }

      newGrid[index] = 'gem';
      setGrid(newGrid);
      playSound('gem');
      const newRevealedCount = revealedCount + 1;
      setRevealedCount(newRevealedCount);

      if (sessionId) {
        updateDoc(doc(db, 'mines_sessions', sessionId), {
          revealedCount: newRevealedCount,
          revealedIndices: newGrid.map((v, i) => v === 'gem' ? i : null).filter(v => v !== null),
          updatedAt: serverTimestamp()
        });
      }

      if (newRevealedCount === GRID_SIZE - mineCount) {
        // Auto cash out if only mines left
        handleCashOut();
      }
    }
  };

  const handleCashOut = async () => {
    if (gameState !== 'playing' || revealedCount === 0 || isCashingOut) return;

    setIsCashingOut(true);
    try {
      const winAmount = betAmount * calculateMultiplier(revealedCount, mineCount);
      
      await updateDoc(doc(db, 'users', user?.uid!), {
        balance: increment(winAmount)
      });

      if (sessionId) {
        updateDoc(doc(db, 'mines_sessions', sessionId), {
          status: 'won',
          winAmount,
          multiplier: currentMultiplier,
          updatedAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, 'transactions'), {
        uid: user?.uid,
        amount: winAmount,
        type: 'mines_win',
        status: 'completed',
        createdAt: serverTimestamp(),
        description: `Mines win x${currentMultiplier.toFixed(2)}`
      });

      setGameState('won');
      playSound('win');
      // Reveal mines
      const revealedGrid = grid.map((val, idx) => mines.includes(idx) ? 'bomb' : val);
      setGrid(revealedGrid);
      
      toast.success(`Won ${formatCurrency(winAmount)}!`);
    } catch (error) {
      console.error(error);
      toast.error('Cashout failed');
    } finally {
      setIsCashingOut(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Mines Game</h2>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowHistory(true)}
            className="p-2 hover:bg-gray-800 rounded-full"
          >
            <History className="w-5 h-5 text-gray-400" />
          </button>
          <button className="p-2 hover:bg-gray-800 rounded-full">
            <Info className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* History Drawer Overlay */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowHistory(false)}
               className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div 
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="fixed right-0 top-0 bottom-0 w-full max-w-[320px] bg-[#1a1d21] z-50 border-l border-white/5 shadow-2xl flex flex-col"
            >
               <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <History className="w-5 h-5 text-purple-400" />
                     <h3 className="font-black uppercase tracking-widest text-sm">Game History</h3>
                  </div>
                  <button 
                     onClick={() => setShowHistory(false)}
                     className="p-2 hover:bg-white/5 rounded-full"
                  >
                     <ChevronLeft className="w-6 h-6 rotate-180" />
                  </button>
               </div>
               
               <div className="flex-1 overflow-y-auto no-scrollbar p-2">
                  {history.length > 0 ? (
                    <div className="space-y-2">
                       {history.map((session) => (
                          <div key={session.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-colors">
                             <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                   <p className="text-[10px] font-black text-white italic uppercase">{session.mineCount} Mines</p>
                                   <span className={cn(
                                      "text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest",
                                      session.status === 'won' ? "bg-emerald-500/20 text-emerald-500" :
                                      session.status === 'lost' ? "bg-rose-500/20 text-rose-500" :
                                      "bg-blue-500/20 text-blue-500"
                                   )}>
                                      {session.status}
                                   </span>
                                </div>
                                <p className="text-[9px] text-gray-500">{session.createdAt?.toDate().toLocaleString()}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-xs font-black text-white italic">₹{session.betAmount}</p>
                                {session.status === 'won' && (
                                   <p className="text-[10px] font-black text-emerald-500">+{session.winAmount?.toFixed(2)}</p>
                                )}
                             </div>
                          </div>
                       ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
                       <History className="w-12 h-12 mb-4" />
                       <p className="text-[10px] font-bold uppercase tracking-widest">No history found</p>
                    </div>
                  )}
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 p-4 flex flex-col items-center gap-6">
        {/* Wallet Balance */}
        <div className="w-full bg-[#2a2e35] p-4 rounded-2xl flex items-center justify-between border border-white/5">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-500/10 p-2 rounded-lg">
              <Wallet className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Balance</p>
              <p className="text-lg font-black text-yellow-500">₹{user?.balance.toFixed(2)}</p>
            </div>
          </div>
          <button onClick={() => navigate('/deposit')} className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-yellow-500/20 active:scale-95 transition-transform">
            Deposit
          </button>
        </div>

        {/* Game Board */}
        <div className="grid grid-cols-5 gap-2 w-full aspect-square max-w-[360px] bg-[#2a2e35] p-3 rounded-3xl border border-white/5 shadow-2xl">
          {grid.map((cell, idx) => (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleTileClick(idx)}
              disabled={gameState !== 'playing' || cell !== null}
              className={cn(
                "aspect-square rounded-xl flex items-center justify-center transition-all duration-300",
                cell === null ? "bg-[#1f2228] hover:bg-[#32363e]" :
                cell === 'gem' ? "bg-emerald-500 shadow-lg shadow-emerald-500/30" :
                cell === 'bomb' ? (mines.includes(idx) && gameState === 'lost' ? "bg-rose-500" : "bg-gray-800 opacity-50") : ""
              )}
            >
              <AnimatePresence mode="wait">
                {cell === 'gem' && (
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                  >
                    <Gem className="w-6 h-6 text-white" />
                  </motion.div>
                )}
                {cell === 'bomb' && (
                  <motion.div
                    initial={{ scale: 0, rotate: 45 }}
                    animate={{ scale: 1, rotate: 0 }}
                  >
                    <Bomb className="w-6 h-6 text-white" />
                  </motion.div>
                )}
                {cell === null && (
                   <div className="w-2 h-2 bg-gray-600 rounded-full" />
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>

        {/* Controls */}
        <div className="w-full max-w-[360px] space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-widest pl-1">Bet Amount</label>
              <div className="flex items-center bg-[#2a2e35] rounded-2xl p-1 border border-white/5">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
                  disabled={gameState === 'playing'}
                  className="bg-transparent w-full text-center font-bold outline-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-widest pl-1">Mines</label>
              <div className="flex items-center bg-[#2a2e35] rounded-2xl p-1 border border-white/5">
                <select
                  value={mineCount}
                  onChange={(e) => setMineCount(Number(e.target.value))}
                  disabled={gameState === 'playing'}
                  className="bg-transparent w-full text-center font-bold outline-none appearance-none cursor-pointer"
                >
                  {[1, 2, 3, 5, 10, 15, 20, 24].map(n => (
                    <option key={n} value={n} className="bg-[#2a2e35]">{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
             {gameState === 'playing' ? (
                <div className="flex flex-col gap-2">
                   <div className="bg-[#2a2e35] p-3 rounded-2xl border border-white/5 flex justify-between items-center px-6">
                      <span className="text-xs text-gray-400 font-bold uppercase">Multi</span>
                      <span className="text-emerald-500 font-black text-lg">x{currentMultiplier.toFixed(2)}</span>
                   </div>
                   <motion.button
                     whileTap={{ scale: 0.95 }}
                     onClick={handleCashOut}
                     disabled={revealedCount === 0 || isCashingOut}
                     className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                   >
                     Cash Out ({formatCurrency(currentWin)})
                   </motion.button>
                </div>
             ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-purple-500/20"
                >
                  Bet Now
                </motion.button>
             )}

             {(gameState === 'won' || gameState === 'lost') && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => {
                    setGameState('betting');
                    setGrid(new Array(GRID_SIZE).fill(null));
                  }}
                  className="w-full flex items-center justify-center gap-2 text-purple-400 font-bold py-2"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </motion.button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
