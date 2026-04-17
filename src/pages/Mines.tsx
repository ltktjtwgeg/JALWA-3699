import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wallet, Info, Bomb, Gem, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';

const GRID_SIZE = 25;
const INITIAL_MINES = 3;

export default function Mines() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(INITIAL_MINES);
  const [grid, setGrid] = useState<(string | null)[]>(new Array(GRID_SIZE).fill(null));
  const [mines, setMines] = useState<number[]>([]);
  const [gameState, setGameState] = useState<'betting' | 'playing' | 'won' | 'lost'>('betting');
  const [revealedCount, setRevealedCount] = useState(0);
  const [isCashingOut, setIsCashingOut] = useState(false);

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
    if (!user) return;
    if (user.balance < betAmount) {
      return toast.error('Insufficient balance');
    }

    try {
      // Deduct balance
      await updateDoc(doc(db, 'users', user.uid), {
        balance: increment(-betAmount)
      });

      // Generate mines
      const newMines: number[] = [];
      while (newMines.length < mineCount) {
        const pos = Math.floor(Math.random() * GRID_SIZE);
        if (!newMines.includes(pos)) {
          newMines.push(pos);
        }
      }

      setMines(newMines);
      setGrid(new Array(GRID_SIZE).fill(null));
      setRevealedCount(0);
      setGameState('playing');
    } catch (error) {
      console.error(error);
      toast.error('Failed to start game');
    }
  };

  const handleTileClick = async (index: number) => {
    if (gameState !== 'playing' || grid[index] !== null) return;

    const newGrid = [...grid];
    if (mines.includes(index)) {
      // Game Over
      newGrid[index] = 'bomb';
      setGrid(newGrid);
      setGameState('lost');
      
      // Reveal all mines
      const revealedGrid = newGrid.map((val, idx) => mines.includes(idx) ? 'bomb' : val);
      setGrid(revealedGrid);

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
      // Safe
      newGrid[index] = 'gem';
      setGrid(newGrid);
      const newRevealedCount = revealedCount + 1;
      setRevealedCount(newRevealedCount);

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

      await addDoc(collection(db, 'transactions'), {
        uid: user?.uid,
        amount: winAmount,
        type: 'mines_win',
        status: 'completed',
        createdAt: serverTimestamp(),
        description: `Mines win x${currentMultiplier.toFixed(2)}`
      });

      setGameState('won');
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
        <button className="p-2 hover:bg-gray-800 rounded-full">
          <Info className="w-5 h-5 text-gray-400" />
        </button>
      </div>

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
