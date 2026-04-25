import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wallet, Info, RefreshCw, Trophy, History as HistoryIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../lib/utils';

const GRID_NUMBERS = [
  { n: 2, color: 'black' }, { n: 4, color: 'black' }, { n: 6, color: 'black' }, { n: 8, color: 'red' }, { n: 10, color: 'red' }, { n: 12, color: 'red' },
  { n: 1, color: 'red' }, { n: 3, color: 'red' }, { n: 5, color: 'red' }, { n: 7, color: 'black' }, { n: 9, color: 'black' }, { n: 11, color: 'black' }
];

const WHEEL_SQUARES = [
  { n: 0, color: '#059669' }, // Green
  { n: 3, color: '#E11D48' }, // Red
  { n: 11, color: '#1a1a1a' }, // Black
  { n: 1, color: '#E11D48' },
  { n: 9, color: '#1a1a1a' },
  { n: 5, color: '#E11D48' },
  { n: 4, color: '#1a1a1a' },
  { n: 10, color: '#E11D48' },
  { n: 6, color: '#1a1a1a' },
  { n: 7, color: '#1a1a1a' },
  { n: 12, color: '#E11D48' },
  { n: 2, color: '#1a1a1a' },
  { n: 8, color: '#E11D48' },
];

const WHEEL_NUMBERS = WHEEL_SQUARES.map(s => s.n);
const COLORS: Record<number, string> = {
  0: 'emerald',
  1: 'rose', 2: 'slate', 3: 'rose', 4: 'slate', 5: 'rose', 6: 'slate',
  7: 'rose', 8: 'rose', 9: 'slate', 10: 'rose', 11: 'slate', 12: 'rose'
};

const PAYOUTS = {
  number: 11.64,
  range: 1.94,
  evenOdd: 1.94,
  color: 1.94,
  tax: 0.03 // 3% House Edge/Tax
};

export default function Roulette() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [betAmount, setBetAmount] = useState(1);
  const [selectedBets, setSelectedBets] = useState<{ type: string, value: any, amount: number }[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showPaytable, setShowPaytable] = useState(false);
  const [activeChip, setActiveChip] = useState(1);
  const [ballRotation, setBallRotation] = useState(0);
  const [lastBets, setLastBets] = useState<{ type: string, value: any, amount: number }[]>([]);
  const wheelRef = useRef<HTMLDivElement>(null);

  const chips = [1, 10, 50, 100, 500];

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid),
      where('type', 'in', ['roulette_win', 'roulette_loss']),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(docs);
    });

    return () => unsubscribe();
  }, [user]);

  const handlePlaceBet = (type: string, value: any) => {
    if (isSpinning) return;
    
    const existingIndex = selectedBets.findIndex(b => b.type === type && b.value === value);
    const newBets = [...selectedBets];
    
    if (existingIndex > -1) {
      newBets[existingIndex].amount += activeChip;
    } else {
      newBets.push({ type, value, amount: activeChip });
    }
    
    setSelectedBets(newBets);
  };

  const clearBets = () => {
    if (isSpinning) return;
    setSelectedBets([]);
  };

  const totalBetAmount = selectedBets.reduce((sum, b) => sum + b.amount, 0);

  const spin = async () => {
    if (isSpinning || selectedBets.length === 0 || !user) return;
    if (user.balance < totalBetAmount) return toast.error('Insufficient balance');

    setIsSpinning(true);
    setResultNumber(null);

    try {
      // Check for Admin Control - Restricted to this user or global
      let targetNumber = WHEEL_NUMBERS[Math.floor(Math.random() * WHEEL_NUMBERS.length)];
      
      const controlQuery = query(
        collection(db, 'game_controls'),
        where('status', '==', 'pending'),
        where('type', '==', 'roulette'),
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
        if (cData.targetNumber !== undefined) {
          targetNumber = cData.targetNumber;
          controlId = matchingControl.id;
        }
      }

      // Deduct balance and update control in one batch
      const batch = writeBatch(db);
      const currentTurnover = user?.requiredTurnover || 0;
      
      batch.update(doc(db, 'users', user.uid), {
        balance: increment(-totalBetAmount),
        totalBets: increment(totalBetAmount),
        dailyBets: increment(totalBetAmount),
        requiredTurnover: Math.max(0, currentTurnover - totalBetAmount)
      });

      if (controlId) {
        batch.update(doc(db, 'game_controls', controlId), {
          status: 'used',
          usedBy: user.username,
          usedAt: serverTimestamp()
        });
      }
      
      await batch.commit();

      // Animation
      const extraSpins = 8 + Math.random() * 2;
      const targetIndex = WHEEL_NUMBERS.indexOf(targetNumber);
      const sectorAngle = 360 / WHEEL_NUMBERS.length;
      
      // Wheel rotates clockwise
      const targetWheelRotation = rotation + (extraSpins * 360) - (targetIndex * sectorAngle) - (sectorAngle / 2);
      setRotation(targetWheelRotation);

      // Ball rotates counter-clockwise and lands at the top
      const ballSpins = 12 + Math.random() * 4;
      const targetBallRotation = ballRotation - (ballSpins * 360);
      setBallRotation(targetBallRotation);

      // Save current bets for rebet
      setLastBets([...selectedBets]);

        // Wait for animation
        setTimeout(async () => {
          setResultNumber(targetNumber);
          setIsSpinning(false);
          
          // Calculate Win
          let totalWin = 0;
          selectedBets.forEach(bet => {
            let won = false;
            let multiplier = 0;

            if (bet.type === 'number' && bet.value === targetNumber) {
              won = true;
              multiplier = PAYOUTS.number;
            } else if (bet.type === 'range') {
              if (bet.value === '1-6' && targetNumber >= 1 && targetNumber <= 6) won = true;
              if (bet.value === '7-12' && targetNumber >= 7 && targetNumber <= 12) won = true;
              multiplier = PAYOUTS.range;
            } else if (bet.type === 'evenOdd') {
              if (bet.value === 'Even' && targetNumber !== 0 && targetNumber % 2 === 0) won = true;
              if (bet.value === 'Odd' && targetNumber % 2 !== 0) won = true;
              multiplier = PAYOUTS.evenOdd;
            } else if (bet.type === 'color') {
              // Nine is black (slate), Red is rose
              if (bet.value === 'red' && COLORS[targetNumber] === 'rose') won = true;
              if (bet.value === 'black' && COLORS[targetNumber] === 'slate') won = true;
              multiplier = PAYOUTS.color;
            }

            if (won) {
              totalWin += bet.amount * multiplier;
            }
          });

          // Calculate "Tax" (House edge)
          const rouletteTax = totalBetAmount - totalWin;
          if (rouletteTax !== 0) {
                const taxRef = doc(db, 'stats', 'roulette');
                await updateDoc(taxRef, { 
                  totalTax: increment(rouletteTax),
                  updatedAt: serverTimestamp() 
                }).catch(() => {
                  // Create if doesn't exist
                  return setDoc(taxRef, { totalTax: rouletteTax, updatedAt: serverTimestamp() });
                });
          }

          // Record Transaction
          if (totalWin > 0) {
            await updateDoc(doc(db, 'users', user.uid), {
              balance: increment(totalWin)
            });
            await addDoc(collection(db, 'transactions'), {
              uid: user.uid,
              amount: totalWin,
              type: 'roulette_win',
              status: 'completed',
              createdAt: serverTimestamp(),
              description: `Roulette win on ${targetNumber}`
            });
            toast.success(`Won ${formatCurrency(totalWin)}!`);
          } else {
            await addDoc(collection(db, 'transactions'), {
              uid: user.uid,
              amount: totalBetAmount,
              type: 'roulette_loss',
              status: 'completed',
              createdAt: serverTimestamp(),
              description: `Roulette loss on ${targetNumber}`
            });
          }
          
          refreshUser();
        }, 7000); // 7 seconds for the result to show up after spin

    } catch (error) {
      console.error(error);
      setIsSpinning(false);
      toast.error('Transaction failed');
    }
  };

  const handleRebet = () => {
    if (isSpinning || lastBets.length === 0) return;
    setSelectedBets([...lastBets]);
  };

  const handleBack = () => {
    if (isSpinning) return;
    const newBets = [...selectedBets];
    newBets.pop();
    setSelectedBets(newBets);
  };

  useEffect(() => {
    if (resultNumber !== null && !isSpinning) {
      const timer = setTimeout(() => {
        setResultNumber(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [resultNumber, isSpinning]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a8a3a] text-white font-sans overflow-x-hidden select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-2">
           <button 
             onClick={() => navigate('/')} 
             className="bg-emerald-600/80 p-1.5 rounded-lg border border-white/20 active:scale-90 transition-all"
           >
             <ChevronLeft className="w-5 h-5" />
           </button>
           <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-tighter text-emerald-300 transform -rotate-2">Mini Roulette</span>
              <div className="flex items-center gap-1">
                 <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                 <span className="text-[10px] uppercase font-bold text-gray-400">Live</span>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-2">
           {/* Removed How to Play and Fun Mode */}
        </div>

        <div className="flex items-center gap-3">
           <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest leading-tight">Balance</span>
              <span className="text-sm font-black text-white tabular-nums">₹{user?.balance.toFixed(2)}</span>
           </div>
           {/* Menu button removed as per request */}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-4 lg:p-8 max-w-7xl mx-auto w-full">
        {/* Wheel Assembly */}
        <div className="relative w-full aspect-square max-w-[340px] flex items-center justify-center lg:max-w-[420px]">
            {/* Outer Wood Ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#3e2723] via-[#5d4037] to-[#3e2723] border-4 border-[#212121] shadow-2xl" />
            
            {/* Inner Metallic Shadow Rendering */}
            <div className="absolute inset-2 rounded-full border-4 border-[#1a1a1a] shadow-[inset_0_0_30px_rgba(0,0,0,1)] bg-black" />

            {/* Spinning Wheel */}
            <motion.div 
              animate={{ rotate: rotation }}
              transition={{ duration: 6, ease: [0.33, 1, 0.68, 1] }} // Heavy bearing finish
              className="relative w-[92%] h-[92%] rounded-full overflow-hidden"
            >
                <div 
                  className="absolute inset-0"
                  style={{
                    background: `conic-gradient(${
                        WHEEL_SQUARES.map((s, i) => {
                            const start = (i * 360) / WHEEL_SQUARES.length;
                            const end = ((i + 1) * 360) / WHEEL_SQUARES.length;
                            return `${s.color} ${start}deg ${end}deg`;
                        }).join(', ')
                    })`
                  }}
                />

                {WHEEL_NUMBERS.map((num, i) => {
                    const angle = i * (360 / WHEEL_NUMBERS.length);
                    const halfSector = (180 / WHEEL_NUMBERS.length);
                    return (
                        <React.Fragment key={i}>
                            {/* Segment Number - Centered */}
                            <div 
                                className="absolute h-1/2 w-[15%] left-[42.5%] top-0 origin-bottom flex flex-col items-center pt-2"
                                style={{ 
                                    transform: `rotate(${angle + halfSector}deg)` 
                                }}
                            >
                                <span className="font-black text-xs lg:text-sm drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] text-white/90">
                                    {num}
                                </span>
                            </div>
                            
                            {/* Segment Divider (Patia) */}
                            <div 
                                className="absolute h-1/2 w-[2px] left-[50%] -translate-x-1/2 top-0 origin-bottom bg-gradient-to-t from-transparent via-white/20 to-white/40"
                                style={{ 
                                    transform: `rotate(${angle}deg)` 
                                }}
                            />
                        </React.Fragment>
                    );
                })}
            </motion.div>

            {/* Ball Track Animation */}
            <motion.div
              animate={{ rotate: ballRotation }}
              transition={{ duration: 6, ease: [0.33, 1, 0.68, 1] }}
              className="absolute inset-0 z-20 pointer-events-none"
            >
              <div className="absolute top-[4%] left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white,inset_-1px_-1px_3px_rgba(0,0,0,0.3)]" />
            </motion.div>

            {/* Inner Static Hub */}
            <div className="absolute w-[36%] aspect-square bg-gradient-to-tr from-[#cfd8dc] via-white to-[#cfd8dc] rounded-full border-4 border-[#212121] shadow-2xl z-30 flex items-center justify-center">
                 <div className="relative w-full h-full flex items-center justify-center">
                    <div className="w-[70%] h-1 bg-black/80 rounded-full" />
                    <div className="w-1 h-[70%] bg-black/80 rounded-full absolute" />
                    <div className="w-3 h-3 bg-black rounded-full absolute" />
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full absolute" />
                 </div>
            </div>

            <AnimatePresence>
              {resultNumber !== null && !isSpinning && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute z-50 flex flex-col items-center justify-center"
                >
                  <div className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center border-4 border-white text-4xl font-black shadow-[0_0_40px_rgba(0,0,0,0.8)]",
                    targetColor(resultNumber)
                  )}>
                    {resultNumber}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
        </div>

        {/* Right Section: Table & Controls */}
        <div className="flex-1 flex flex-col items-center gap-4 w-full px-2">
            <div className="flex items-center gap-4 mb-2">
               <div className="bg-black/30 px-4 py-1.5 rounded-lg border border-white/5 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Bet:</span>
                  <span className="text-white font-black tabular-nums">{formatCurrency(totalBetAmount)}</span>
               </div>
               <button onClick={() => setShowPaytable(true)} className="text-emerald-300 font-bold text-[10px] uppercase tracking-widest underline decoration-emerald-500/50 underline-offset-4">Paytable</button>
            </div>

            <div className="relative w-full max-w-[480px] bg-emerald-900/80 p-2 rounded-xl border-2 border-emerald-400/30 shadow-2xl shadow-black/40">
                <div className="flex gap-1 mb-1">
                    <div className="grid grid-cols-6 gap-1 flex-1 h-14 lg:h-16">
                        {[2, 4, 6, 8, 10, 12].map(n => {
                            const gridObj = GRID_NUMBERS.find(gn => gn.n === n)!;
                            return (
                                <button 
                                    key={n} 
                                    onClick={() => handlePlaceBet('number', n)}
                                    className={cn(
                                        "rounded-full flex items-center justify-center relative font-black transition-transform active:scale-90 border-2 border-white/10 shadow-inner text-sm lg:text-lg",
                                        gridObj.color === 'red' ? 'bg-[#ff1744]' : 'bg-[#1a1a1a]',
                                        hasBet('number', n) && "ring-4 ring-yellow-400 scale-105 z-10"
                                    )}
                                >
                                    {n}
                                    {getBetAmount('number', n) > 0 && (
                                       <div className="absolute -top-1 -right-1 bg-white text-black text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-emerald-500">
                                          {getBetAmount('number', n)}
                                       </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex gap-1 mb-1">
                    <div className="grid grid-cols-6 gap-1 flex-1 h-14 lg:h-16">
                        {[1, 3, 5, 7, 9, 11].map(n => {
                             const gridObj = GRID_NUMBERS.find(gn => gn.n === n)!;
                             return (
                                <button 
                                    key={n} 
                                    onClick={() => handlePlaceBet('number', n)}
                                    className={cn(
                                        "rounded-full flex items-center justify-center relative font-black transition-transform active:scale-90 border-2 border-white/10 shadow-inner text-sm lg:text-lg",
                                        gridObj.color === 'red' ? 'bg-[#ff1744]' : 'bg-[#1a1a1a]',
                                        hasBet('number', n) && "ring-4 ring-yellow-400 scale-105 z-10"
                                    )}
                                >
                                    {n}
                                    {getBetAmount('number', n) > 0 && (
                                       <div className="absolute -top-1 -right-1 bg-white text-black text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-emerald-500">
                                          {getBetAmount('number', n)}
                                       </div>
                                    )}
                                </button>
                             );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-6 gap-1 h-11 lg:h-14">
                   <button 
                     onClick={() => handlePlaceBet('range', '1-6')} 
                     className={cn(
                       "rounded-lg bg-emerald-800/80 flex items-center justify-center font-black text-[9px] tracking-tighter border border-white/10 active:scale-90 shadow-md relative",
                       hasBet('range', '1-6') && "ring-2 ring-yellow-400 z-10"
                     )}
                   >
                     1-6
                     {getBetAmount('range', '1-6') > 0 && (
                        <div className="absolute -top-1 -right-1 bg-white text-black text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-emerald-500 shadow-sm">
                           {getBetAmount('range', '1-6')}
                        </div>
                     )}
                   </button>
                   <button 
                     onClick={() => handlePlaceBet('evenOdd', 'Even')} 
                     className={cn(
                       "rounded-lg bg-emerald-800/80 flex items-center justify-center font-black text-[9px] tracking-tighter border border-white/10 active:scale-90 shadow-md relative",
                       hasBet('evenOdd', 'Even') && "ring-2 ring-yellow-400 z-10"
                     )}
                   >
                     Even
                     {getBetAmount('evenOdd', 'Even') > 0 && (
                        <div className="absolute -top-1 -right-1 bg-white text-black text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-emerald-500 shadow-sm">
                           {getBetAmount('evenOdd', 'Even')}
                        </div>
                     )}
                   </button>
                   <button 
                     onClick={() => handlePlaceBet('color', 'black')} 
                     className={cn(
                       "rounded-lg bg-black flex items-center justify-center active:scale-90 border border-white/10 shadow-md relative",
                       hasBet('color', 'black') && "ring-2 ring-yellow-400 z-10"
                     )}
                   >
                     <div className="w-5 h-5 bg-black rounded-full border-2 border-white/20 shadow-[inset_0_0_5px_white]"/>
                     {getBetAmount('color', 'black') > 0 && (
                        <div className="absolute -top-1 -right-1 bg-white text-black text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-emerald-500 shadow-sm">
                           {getBetAmount('color', 'black')}
                        </div>
                     )}
                   </button>
                   <button 
                     onClick={() => handlePlaceBet('color', 'red')} 
                     className={cn(
                       "rounded-lg bg-[#ff1744] flex items-center justify-center active:scale-90 border border-white/10 shadow-md relative",
                       hasBet('color', 'red') && "ring-2 ring-yellow-400 z-10"
                     )}
                   >
                     <div className="w-5 h-5 bg-[#ff1744] rounded-full border-2 border-white/20 shadow-[inset_0_0_5px_white]"/>
                     {getBetAmount('color', 'red') > 0 && (
                        <div className="absolute -top-1 -right-1 bg-white text-black text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-emerald-500 shadow-sm">
                           {getBetAmount('color', 'red')}
                        </div>
                     )}
                   </button>
                   <button 
                     onClick={() => handlePlaceBet('evenOdd', 'Odd')} 
                     className={cn(
                       "rounded-lg bg-emerald-800/80 flex items-center justify-center font-black text-[9px] tracking-tighter border border-white/10 active:scale-90 shadow-md relative",
                       hasBet('evenOdd', 'Odd') && "ring-2 ring-yellow-400 z-10"
                     )}
                   >
                     Odd
                     {getBetAmount('evenOdd', 'Odd') > 0 && (
                        <div className="absolute -top-1 -right-1 bg-white text-black text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-emerald-500 shadow-sm">
                           {getBetAmount('evenOdd', 'Odd')}
                        </div>
                     )}
                   </button>
                   <button 
                     onClick={() => handlePlaceBet('range', '7-12')} 
                     className={cn(
                       "rounded-lg bg-emerald-800/80 flex items-center justify-center font-black text-[9px] tracking-tighter border border-white/10 active:scale-90 shadow-md relative",
                       hasBet('range', '7-12') && "ring-2 ring-yellow-400 z-10"
                     )}
                   >
                     7-12
                     {getBetAmount('range', '7-12') > 0 && (
                        <div className="absolute -top-1 -right-1 bg-white text-black text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-emerald-500 shadow-sm">
                           {getBetAmount('range', '7-12')}
                        </div>
                     )}
                   </button>
                </div>
                
                <button 
                  onClick={() => handlePlaceBet('number', 0)}
                  className={cn(
                    "absolute -left-12 top-0 bottom-14 w-11 bg-emerald-600 rounded-l-xl border-2 border-emerald-400/50 flex items-center justify-center transition-transform active:scale-95 shadow-lg",
                    hasBet('number', 0) && "ring-4 ring-yellow-400 z-10"
                  )}
                >
                  <span className="font-black text-xl rotate-0 lg:-rotate-90">0</span>
                  {getBetAmount('number', 0) > 0 && (
                    <div className="absolute top-1 right-1 bg-white text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-emerald-500">
                      {getBetAmount('number', 0)}
                    </div>
                  )}
                </button>
            </div>

            <div className="flex gap-2 w-full max-w-[480px]">
               <button onClick={handleBack} className="flex-1 bg-emerald-800/60 py-2.5 rounded-lg border border-white/10 flex items-center justify-center gap-1 active:scale-95">
                  <RefreshCw className="w-3.5 h-3.5 transform -scale-x-100" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
               </button>
               <button onClick={clearBets} className="flex-1 bg-emerald-800/60 py-2.5 rounded-lg border border-white/10 flex items-center justify-center gap-1 active:scale-95">
                  <X className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Clear</span>
               </button>
               <button onClick={handleRebet} className="flex-1 bg-emerald-800/60 py-2.5 rounded-lg border border-white/10 flex items-center justify-center gap-1 active:scale-95">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Rebet</span>
               </button>
            </div>

            <div className="flex items-end justify-between w-full max-w-[480px] mt-4 relative">
                <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar px-2 flex-grow">
                    {chips.map(chip => (
                        <button
                            key={chip}
                            onClick={() => setActiveChip(chip)}
                            className={cn(
                                "min-w-[48px] h-12 rounded-full flex items-center justify-center text-[10px] font-black border-2 shadow-[0_5px_0_rgba(0,0,0,0.3)] transition-all active:translate-y-1 active:shadow-none",
                                activeChip === chip ? "ring-2 ring-white scale-110 z-10" : "opacity-70",
                                chip === 1 ? "bg-gray-400 border-gray-300 text-gray-800" :
                                chip === 10 ? "bg-rose-500 border-rose-400 text-white" :
                                chip === 50 ? "bg-blue-600 border-blue-400 text-white" :
                                chip === 100 ? "bg-emerald-600 border-emerald-400 text-white" : "bg-neutral-800 border-neutral-600 text-white"
                            )}
                        >
                            {chip}
                        </button>
                    ))}
                </div>

                <motion.button
                   whileTap={{ scale: 0.9 }}
                   onClick={spin}
                   disabled={isSpinning || selectedBets.length === 0}
                   className={cn(
                     "w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-800 to-emerald-500 border-4 border-white/30 shadow-2xl flex items-center justify-center disabled:opacity-50 ml-4 mb-2 active:shadow-none transition-all",
                     isSpinning && "animate-pulse"
                   )}
                >
                   <RefreshCw className={cn("w-8 h-8 text-white", isSpinning && "animate-spin")} />
                </motion.button>
                
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-300 italic">
                   1 = 1.00 INR
                </div>
            </div>
        </div>
      </div>

      {history.length > 0 && (
         <div className="p-4 bg-black/20 flex gap-2 overflow-x-auto no-scrollbar border-t border-white/5">
            {history.map(tx => {
               const numParts = tx.description.split('on ');
               const num = numParts.length > 1 ? parseInt(numParts[1]) : 0;
               return (
                  <div key={tx.id} className="min-w-[80px] p-2 bg-black/40 rounded-lg border border-white/5 flex flex-col items-center">
                     <div className={cn("w-6 h-6 rounded-full mb-1 flex items-center justify-center text-[10px] font-black", targetColor(num))}>
                        {num}
                     </div>
                     <span className={cn("text-[9px] font-bold", tx.type === 'roulette_win' ? "text-emerald-400" : "text-gray-500")}>
                       {tx.type === 'roulette_win' ? `+₹${tx.amount.toFixed(0)}` : `Lost`}
                     </span>
                  </div>
               );
            })}
         </div>
      )}

      {/* Paytable Modal */}
      <AnimatePresence>
        {showPaytable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowPaytable(false)}
               className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
               initial={{ y: 20, scale: 0.95 }}
               animate={{ y: 0, scale: 1 }}
               exit={{ y: 20, scale: 0.95 }}
               className="relative w-full max-w-md bg-[#1c1c1c] rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl"
            >
               <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-emerald-600/20 to-transparent">
                  <h3 className="text-lg font-black uppercase tracking-tighter">Paytable</h3>
                  <button onClick={() => setShowPaytable(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               <div className="p-6 space-y-4">
                  <div className="space-y-3">
                     {[
                        { label: 'Single Number', multi: '11.64x', desc: 'Any one number' },
                        { label: 'Ranges (1-6, 7-12)', multi: '1.94x', desc: 'Numbers in range' },
                        { label: 'Colors (Red/Black)', multi: '1.94x', desc: 'Any color match' },
                        { label: 'Properties (Even/Odd)', multi: '1.94x', desc: 'Excludes zero' }
                     ].map(item => (
                        <div key={item.label} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/5">
                           <div>
                              <p className="text-white font-black text-sm uppercase tracking-tight">{item.label}</p>
                              <p className="text-[10px] text-gray-500 font-bold">{item.desc}</p>
                           </div>
                           <span className="text-emerald-400 font-black text-lg">{item.multi}</span>
                        </div>
                     ))}
                  </div>
                  <button 
                    onClick={() => setShowPaytable(false)}
                    className="w-full py-4 bg-emerald-500 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                  >
                    Got It
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  function hasBet(type: string, value: any) {
    return selectedBets.some(b => b.type === type && b.value === value);
  }

  function getBetAmount(type: string, value: any) {
    return selectedBets.find(b => b.type === type && b.value === value)?.amount || 0;
  }

  function targetColor(num: number) {
    const c = COLORS[num];
    if (c === 'emerald') return 'bg-emerald-600';
    if (c === 'rose') return 'bg-[#E11D48]'; // Explicit Red match
    if (c === 'slate') return 'bg-[#1a1a1a]'; // Explicit Black match
    return 'bg-[#121212]';
  }
}
