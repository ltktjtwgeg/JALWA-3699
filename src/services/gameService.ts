import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  Timestamp,
  increment,
  writeBatch,
  setDoc,
  getDoc, 
  runTransaction,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Game, Bet, GameType } from '../types';

export const GAME_DURATIONS: Record<GameType, number> = {
  '30s': 30,
  '1m': 60,
  '3m': 180,
  '5m': 300,
};

export async function processGameResults(type: GameType) {
  const duration = GAME_DURATIONS[type];
  const now = Math.floor(Date.now() / 1000);
  const currentRoundIndex = Math.floor(now / duration);
  
  // Process last 2 rounds to ensure no gaps
  for (let i = 1; i <= 2; i++) {
    const targetRoundIndex = currentRoundIndex - i;
    const targetTime = targetRoundIndex * duration;
    const targetDate = new Date(targetTime * 1000);
    const dateStr = targetDate.toISOString().slice(0, 10).replace(/-/g, '');
    const targetPeriodId = `${dateStr}${targetRoundIndex}`;
    const docId = `${type}_${targetPeriodId}`;

    try {
      // Use getDoc with deterministic ID to check existence efficiently
      const gameRef = doc(db, 'games', docId);
      const gameSnap = await getDoc(gameRef);

      if (!gameSnap.exists()) {
        // Check for admin control
        const controlQ = query(
          collection(db, 'game_controls'), 
          where('status', '==', 'pending'),
          where('type', '==', 'wingo'),
          where('gameType', '==', type),
          orderBy('createdAt', 'asc'),
          limit(1)
        );
        const controlSnap = await getDocs(controlQ);
        
        let resultNumber: number;
        
        if (!controlSnap.empty) {
          const controlDoc = controlSnap.docs[0];
          const controlData = controlDoc.data();
          
          if (controlData.targetNumber !== undefined) {
            resultNumber = controlData.targetNumber;
          } else if (controlData.targetSize === 'Big') {
            const bigs = [5, 6, 7, 8, 9];
            resultNumber = bigs[Math.floor(Math.random() * bigs.length)];
          } else if (controlData.targetSize === 'Small') {
            const smalls = [0, 1, 2, 3, 4];
            resultNumber = smalls[Math.floor(Math.random() * smalls.length)];
          } else {
            resultNumber = Math.floor(Math.random() * 10);
          }
          
          await updateDoc(doc(db, 'game_controls', controlDoc.id), { 
            status: 'completed', 
            usedInPeriod: targetPeriodId,
            usedAt: serverTimestamp()
          });
        } else {
          // Use true randomness instead of deterministic pattern
          resultNumber = Math.floor(Math.random() * 10);
        }

        const resultColor = getResultColor(resultNumber);
        const resultSize = resultNumber >= 5 ? 'Big' : 'Small';

        try {
          await setDoc(gameRef, {
            periodId: targetPeriodId,
            gameType: type,
            startTime: Timestamp.fromMillis(targetTime * 1000),
            endTime: Timestamp.fromMillis((targetTime + duration) * 1000),
            resultNumber,
            resultColor,
            resultSize,
            status: 'completed',
            createdAt: serverTimestamp()
          });
        } catch (err: any) {
          // If it fails with permission error, it might be because someone else just created it
          // or we are trying to overwrite a completed game. We can ignore this if the game now exists.
          const checkSnap = await getDoc(gameRef);
          if (!checkSnap.exists()) {
            throw err;
          }
        }
      }
    } catch (error) {
      console.error(`Error processing results for ${type} round ${targetRoundIndex}:`, error);
    }
  }
  
  return null;
}

function getResultColor(num: number) {
  if (num === 0 || num === 5) return 'Violet';
  return [1, 3, 7, 9].includes(num) ? 'Green' : 'Red';
}

export async function settleUserBets(uid: string, type: GameType) {
  try {
    const betsPath = 'bets';
    const betsQ = query(
      collection(db, betsPath), 
      where('uid', '==', uid), 
      where('status', '==', 'pending'),
      where('gameType', '==', type)
    );
    
    const betsSnap = await getDocs(betsQ);
    if (betsSnap.empty) return;

    // Group bets by periodId to fetch games
    const periodIds = Array.from(new Set(betsSnap.docs.map(d => d.data().periodId)));
    const gamesMap = new Map<string, Game>();

    for (const pid of periodIds) {
      const gameRef = doc(db, 'games', `${type}_${pid}`);
      const gameSnap = await getDoc(gameRef);
      if (gameSnap.exists()) {
        gamesMap.set(pid, { id: gameSnap.id, ...gameSnap.data() } as Game);
      } else {
        // Fallback to query if deterministic ID fails
        const gameQ = query(
          collection(db, 'games'), 
          where('periodId', '==', pid), 
          where('gameType', '==', type)
        );
        const qSnap = await getDocs(gameQ);
        if (!qSnap.empty) {
          gamesMap.set(pid, { id: qSnap.docs[0].id, ...qSnap.docs[0].data() } as Game);
        }
      }
    }

    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) return;

      // Fetch all relevant bets inside the transaction first to satisfy "reads before writes" rule
      const betRefs = betsSnap.docs.map(d => doc(db, 'bets', d.id));
      const freshBetSnaps = await Promise.all(betRefs.map(ref => transaction.get(ref)));

      let totalWinAmount = 0;

      for (const freshBetSnap of freshBetSnaps) {
        if (!freshBetSnap.exists() || freshBetSnap.data()?.status !== 'pending') continue;
        
        const bet = { id: freshBetSnap.id, ...freshBetSnap.data() } as Bet;
        const game = gamesMap.get(bet.periodId);

        if (game) {
          const isWin = checkWin(bet.selection, game);
          const winAmount = isWin ? calculateWinAmount(bet, game) : 0;
          
          transaction.update(freshBetSnap.ref, {
            status: isWin ? 'win' : 'lost',
            winAmount: winAmount,
            settledAt: serverTimestamp()
          });

          if (isWin) {
            totalWinAmount += winAmount;

            const transRef = doc(collection(db, 'transactions'));
            transaction.set(transRef, {
              uid,
              type: 'win',
              amount: winAmount,
              status: 'completed',
              description: `Win on ${bet.selection} (Period: ${bet.periodId})`,
              createdAt: serverTimestamp()
            });
          }
        }
      }

      if (totalWinAmount > 0) {
        transaction.update(userRef, {
          balance: increment(totalWinAmount)
        });
      }
    });
  } catch (error) {
    console.error('Error in settleUserBets:', error);
  }
}

function checkWin(selection: string, game: Game): boolean {
  const num = game.resultNumber!;
  const color = game.resultColor!;
  const size = game.resultSize!;

  if (selection === 'Big' || selection === 'Small') return selection === size;
  if (selection === 'Green' || selection === 'Red' || selection === 'Violet') {
    if (selection === color) return true;
    // Special cases for 0 and 5 (Violet + Red/Green)
    if (num === 0 && selection === 'Red') return true;
    if (num === 5 && selection === 'Green') return true;
    return false;
  }
  return selection === num.toString();
}

function calculateWinAmount(bet: Bet, game: Game): number {
  const selection = bet.selection;
  const num = game.resultNumber!;
  const totalAmount = bet.totalAmount;
  
  // User requirements:
  // Number: 1 bet = 8.64 received
  // Big/Small: 1 bet = 1.96 received
  // Color: Usually same as Big/Small (1.96)
  
  if (selection === 'Big' || selection === 'Small') {
    return totalAmount * 1.96;
  } else if (selection === 'Green' || selection === 'Red') {
    if (num === 0 || num === 5) {
      return totalAmount * 1.47; // Half win (1.96 * 0.75 or similar, but let's keep it proportional)
    }
    return totalAmount * 1.96;
  } else if (selection === 'Violet') {
    return totalAmount * 4.41; // Proportional to 4.5 * 0.98
  } else {
    // Number bet
    return totalAmount * 8.64;
  }
}
