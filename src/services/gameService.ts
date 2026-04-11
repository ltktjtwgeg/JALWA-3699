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
  writeBatch
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
  const lastRoundIndex = currentRoundIndex - 1;
  
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const lastPeriodId = `${dateStr}${lastRoundIndex}`;

  try {
    // Check if result already exists
    const q = query(collection(db, 'games'), where('periodId', '==', lastPeriodId), where('gameType', '==', type));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Check for admin control
      const controlQ = query(
        collection(db, 'game_controls'), 
        where('gameType', '==', type),
        where('status', '==', 'pending')
      );
      let controlSnap;
      try {
        controlSnap = await getDocs(controlQ);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'game_controls');
        return null;
      }
      
      let resultNumber: number;
      
      if (controlSnap && !controlSnap.empty) {
        const controlDoc = controlSnap.docs[0];
        const controlData = controlDoc.data();
        
        if (controlData.targetNumber !== undefined) {
          resultNumber = controlData.targetNumber;
        } else if (controlData.targetSize === 'Big') {
          // Random big number: 5, 6, 7, 8, 9
          const bigs = [5, 6, 7, 8, 9];
          resultNumber = bigs[Math.floor(Math.random() * bigs.length)];
        } else if (controlData.targetSize === 'Small') {
          // Random small number: 0, 1, 2, 3, 4
          const smalls = [0, 1, 2, 3, 4];
          resultNumber = smalls[Math.floor(Math.random() * smalls.length)];
        } else {
          resultNumber = (parseInt(lastPeriodId.slice(-4)) * 1337) % 10;
        }
        
        // Mark control as used
        try {
          await updateDoc(doc(db, 'game_controls', controlDoc.id), { status: 'completed', usedInPeriod: lastPeriodId });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'game_controls');
        }
      } else {
        resultNumber = (parseInt(lastPeriodId.slice(-4)) * 1337) % 10;
      }

      const resultColor = getResultColor(resultNumber);
      const resultSize = resultNumber >= 5 ? 'Big' : 'Small';

      try {
        await addDoc(collection(db, 'games'), {
          periodId: lastPeriodId,
          gameType: type,
          startTime: Timestamp.fromMillis((lastRoundIndex * duration) * 1000),
          endTime: Timestamp.fromMillis(((lastRoundIndex + 1) * duration) * 1000),
          resultNumber,
          resultColor,
          resultSize,
          status: 'completed',
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'games');
      }

      return { periodId: lastPeriodId, resultNumber, resultColor, resultSize };
    }
  } catch (error) {
    console.error(`Unexpected error in processGameResults for ${type}:`, error);
  }
  
  return null;
}

function getResultColor(num: number) {
  if (num === 0 || num === 5) return 'Violet';
  return [1, 3, 7, 9].includes(num) ? 'Green' : 'Red';
}

export async function settleUserBets(uid: string, type: GameType) {
  const betsPath = 'bets';
  try {
    // Find pending bets for completed games
    const betsQ = query(
      collection(db, betsPath), 
      where('uid', '==', uid), 
      where('status', '==', 'pending'),
      where('gameType', '==', type)
    );
    const betsSnap = await getDocs(betsQ);

    if (betsSnap.empty) return;

    for (const betDoc of betsSnap.docs) {
      const bet = { id: betDoc.id, ...betDoc.data() } as Bet;
      
      // Find the game result
      const gameQ = query(collection(db, 'games'), where('periodId', '==', bet.periodId), where('gameType', '==', type));
      const gameSnap = await getDocs(gameQ);

      if (!gameSnap.empty) {
        const game = gameSnap.docs[0].data() as Game;
        const isWin = checkWin(bet.selection, game);
        
        const batch = writeBatch(db);
        const winAmount = isWin ? calculateWinAmount(bet, game) : 0;
        
        batch.update(doc(db, 'bets', bet.id!), {
          status: isWin ? 'win' : 'lost',
          winAmount: winAmount
        });

        if (isWin) {
          batch.update(doc(db, 'users', uid), {
            balance: increment(winAmount)
          });

          batch.set(doc(collection(db, 'transactions')), {
            uid,
            type: 'win',
            amount: winAmount,
            status: 'completed',
            description: `Win on ${bet.selection} (Period: ${bet.periodId})`,
            createdAt: serverTimestamp()
          });
        }

        await batch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, betsPath);
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
  const fee = bet.fee || (totalAmount * 0.04);

  let multiplier = 0;

  if (selection === 'Big' || selection === 'Small') {
    multiplier = 2;
  } else if (selection === 'Green' || selection === 'Red') {
    if (num === 0 || num === 5) {
      multiplier = 1.5; // Half win if violet also hits
    } else {
      multiplier = 2;
    }
  } else if (selection === 'Violet') {
    multiplier = 4.5;
  } else {
    // Number bet
    multiplier = 9;
  }

  // Formula: (TotalAmount * Multiplier) - Fee
  // This gives 1.96x for colors (2 - 0.04) and 8.96x for numbers (9 - 0.04)
  return (totalAmount * multiplier) - fee;
}
