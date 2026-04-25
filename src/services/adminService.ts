import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  addDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { GameType } from '../types';
import { GAME_DURATIONS } from '../gameConstants';

export interface Banner {
  id: string;
  image: string;
  link?: string;
}

export interface SystemSettings {
  autoProfit: boolean;
  randomMode: boolean;
  wingoAutoControl: boolean; // Keep for backward compatibility if needed
  wingoRandomMode: boolean;
  usdtRate: number;
  withdrawLimit: number;
  salaryBonus: number;
  maintenanceMode: boolean;
  commissionRate: number;
  depositBonusPercentage: number;
  upiId: string;
  upiImage?: string;
  usdtAddress: string;
  usdtImage?: string;
  gameStatuses: Record<string, boolean>;
  banners?: Banner[];
  popupBannerUrl?: string;
  showPopup?: boolean;
  minesMode?: 'random' | 'force_win' | 'force_loss';
}

export const DEFAULT_SETTINGS: SystemSettings = {
  autoProfit: false,
  randomMode: true,
  wingoAutoControl: false,
  wingoRandomMode: true,
  usdtRate: 92,
  withdrawLimit: 500,
  salaryBonus: 10,
  maintenanceMode: false,
  commissionRate: 0.02,
  depositBonusPercentage: 2,
  upiId: '',
  usdtAddress: '',
  minesMode: 'random',
  gameStatuses: {
    '1m': true,
    '30s': true,
    '3m': true,
    '5m': true,
    'mines': true,
    'roulette': true,
    'wingo': true,
    'k3': false,
    '5d': false,
    'trx': false
  },
  banners: [
    { id: '1', image: '/images/slider_banner/banner1.png' },
    { id: '2', image: '/images/slider_banner/custom_banner_1.png' },
    { id: '3', image: '/images/slider_banner/custom_banner_2.png' },
    { id: '4', image: '/images/slider_banner/custom_banner_3.png' }
  ],
  popupBannerUrl: '',
  showPopup: true
};

export async function getSystemSettings(): Promise<SystemSettings> {
  const settingsDoc = await getDoc(doc(db, 'system_config', 'settings'));
  if (settingsDoc.exists()) {
    return { ...DEFAULT_SETTINGS, ...settingsDoc.data() } as SystemSettings;
  }
  return DEFAULT_SETTINGS;
}

export async function updateSystemSettings(settings: Partial<SystemSettings>) {
  await setDoc(doc(db, 'system_config', 'settings'), {
    ...settings,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function getAdminStats() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayStartTimestamp = Timestamp.fromDate(startOfDay);

  const usersSnap = await getDocs(collection(db, 'users'));
  const totalUsers = usersSnap.size;
  const totalBalance = usersSnap.docs.reduce((acc, d) => acc + (d.data().balance || 0), 0);

  const transSnap = await getDocs(collection(db, 'transactions'));
  const todayTransSnap = await getDocs(query(collection(db, 'transactions'), where('createdAt', '>=', dayStartTimestamp)));

  const totalRecharge = transSnap.docs
    .filter(d => d.data().type === 'deposit' && d.data().status === 'completed')
    .reduce((acc, d) => acc + d.data().amount, 0);

  const totalWithdrawal = transSnap.docs
    .filter(d => d.data().type === 'withdraw' && d.data().status === 'completed')
    .reduce((acc, d) => acc + d.data().amount, 0);

  const pendingRecharge = transSnap.docs
    .filter(d => d.data().type === 'deposit' && d.data().status === 'pending')
    .reduce((acc, d) => acc + d.data().amount, 0);

  const pendingWithdrawalCount = transSnap.docs
    .filter(d => d.data().type === 'withdraw' && d.data().status === 'pending').length;

  const todayRecharge = todayTransSnap.docs
    .filter(d => d.data().type === 'deposit' && d.data().status === 'completed')
    .reduce((acc, d) => acc + d.data().amount, 0);

  const todayWithdrawal = todayTransSnap.docs
    .filter(d => d.data().type === 'withdraw' && d.data().status === 'completed')
    .reduce((acc, d) => acc + d.data().amount, 0);

  // Profit calculation logic: Total Bets - Total Wins - Total Fees (simplified)
  // Actually usually defined as Revenue - Payouts
  const betsSnap = await getDocs(query(collection(db, 'bets'), where('createdAt', '>=', dayStartTimestamp)));
  const todayBets = betsSnap.docs.reduce((acc, d) => acc + (d.data().amount || 0), 0);
  const todayWins = betsSnap.docs.reduce((acc, d) => acc + (d.data().winAmount || 0), 0);
  const todayProfit = todayBets - todayWins;

  return {
    totalUsers,
    totalBalance,
    totalRecharge,
    totalWithdrawal,
    pendingRecharge,
    withdrawalRequests: pendingWithdrawalCount,
    successRecharge: transSnap.docs.filter(d => d.data().type === 'deposit' && d.data().status === 'completed').length,
    todayRecharge,
    todayWithdrawal,
    todayBets,
    todayWins,
    todayProfit
  };
}

export async function getGamePoolStats(type: GameType) {
  const duration = GAME_DURATIONS[type];
  const now = Date.now();
  const durMs = duration * 1000;
  const currentRoundIndex = Math.floor(now / durMs);
  const targetDate = new Date(currentRoundIndex * durMs);
  
  const dateStr = targetDate.toISOString().slice(0, 10).replace(/-/g, '');
  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayIndex = Math.floor((targetDate.getTime() - dayStart.getTime()) / durMs) + 1;
  const currentPeriodId = `${dateStr}${dayIndex.toString().padStart(4, '0')}`;
  
  const betsQ = query(
    collection(db, 'bets'),
    where('gameType', '==', type),
    where('periodId', '==', currentPeriodId),
    where('status', '==', 'pending')
  );
  
  const snap = await getDocs(betsQ);
  const stats = {
    total: 0,
    Big: 0,
    Small: 0,
    Red: 0,
    Green: 0,
    Violet: 0,
    numbers: Array(10).fill(0)
  };
  
  snap.docs.forEach(d => {
    const data = d.data();
    const amount = data.totalAmount || 0;
    const sel = data.selection;
    stats.total += amount;
    
    if (sel === 'Big') stats.Big += amount;
    else if (sel === 'Small') stats.Small += amount;
    else if (sel === 'Red') stats.Red += amount;
    else if (sel === 'Green') stats.Green += amount;
    else if (sel === 'Violet') stats.Violet += amount;
    else if (!isNaN(parseInt(sel))) {
       const num = parseInt(sel);
       if (num >= 0 && num <= 9) stats.numbers[num] += amount;
    }
  });
  
  return stats;
}

export async function setGameControl(type: GameType, targetSize?: string, targetNumber?: number) {
  const docId = `wingo_next_${type}`;
  const data: any = {
    type: 'wingo',
    gameType: type,
    status: 'pending',
    createdAt: serverTimestamp()
  };
  
  // If both are undefined, it means we are clearing the override
  if (targetSize === undefined && targetNumber === undefined) {
    // We can either delete the doc or update it to 'cancelled'
    // To keep simple, we'll just set target fields to null
    data.targetSize = null;
    data.targetNumber = null;
    data.status = 'deleted'; // Not used by server
  } else {
    if (targetSize !== undefined && targetSize !== null) data.targetSize = targetSize;
    if (targetNumber !== undefined && targetNumber !== null) data.targetNumber = targetNumber;
  }
  
  await setDoc(doc(db, 'game_controls', docId), data);
}

export async function createGiftCode(code: string, amount: number, maxUses: number) {
  await setDoc(doc(db, 'giftCodes', code), {
    code,
    amount,
    maxUses,
    currentUses: 0,
    isActive: true,
    usedBy: [],
    createdAt: serverTimestamp()
  });
}

export async function getGiftCodes() {
  const q = query(collection(db, 'giftCodes'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteGiftCode(id: string) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'giftCodes', id));
}

export async function getPendingTransactions(type: 'deposit' | 'withdraw') {
  const q = query(
    collection(db, 'transactions'),
    where('type', '==', type),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateTransactionStatus(id: string, status: 'completed' | 'rejected', uid: string) {
  const { runTransaction } = await import('firebase/firestore');
  
  try {
    await runTransaction(db, async (transaction) => {
      const transRef = doc(db, 'transactions', id);
      const userRef = doc(db, 'users', uid);
      const settingsRef = doc(db, 'system_config', 'settings');

      const [transSnap, settingsSnap] = await Promise.all([
        transaction.get(transRef),
        transaction.get(settingsRef)
      ]);

      if (!transSnap.exists()) throw new Error('Transaction not found');
      const transData = transSnap.data();
      if (transData.status !== 'pending') throw new Error('Transaction already processed');

      if (status === 'completed' && transData.type === 'deposit') {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found');
        const userData = userSnap.data();
        
        const isFirstDeposit = !userData?.totalDeposits || userData.totalDeposits === 0;
        const settingsData = settingsSnap.exists() ? settingsSnap.data() : DEFAULT_SETTINGS;
        const bonusPercent = settingsData?.depositBonusPercentage || 0;
        
        // Calculate normal deposit bonus for all deposits
        let bonusAmount = transData.amount * (bonusPercent / 100);

        // Add First Deposit Bonus if applicable
        if (isFirstDeposit) {
          if (transData.amount >= 1000) bonusAmount += 188;
          else if (transData.amount >= 500) bonusAmount += 108;
          else if (transData.amount >= 300) bonusAmount += 28;
          else if (transData.amount >= 100) bonusAmount += 18;
        }

        const totalAdd = transData.amount + bonusAmount;

        transaction.update(userRef, { 
          balance: increment(totalAdd),
          totalDeposits: increment(transData.amount),
          dailyDeposits: increment(transData.amount),
          requiredTurnover: increment(totalAdd)
        });

        if (bonusAmount > 0) {
          const bonusRef = doc(collection(db, 'transactions'));
          transaction.set(bonusRef, {
            uid,
            type: 'bonus',
            amount: bonusAmount,
            status: 'completed',
            description: `Deposit Bonus (${bonusPercent}%) ${isFirstDeposit ? '+ First Deposit Reward' : ''}`,
            createdAt: serverTimestamp()
          });
        }
      } else if (status === 'rejected' && transData.type === 'withdraw') {
        // Refund balance if withdrawal rejected
        transaction.update(userRef, { balance: increment(transData.amount) });
      }

      transaction.update(transRef, { 
        status, 
        updatedAt: serverTimestamp() 
      });
    });
  } catch (error: any) {
    console.error('UpdateTransactionStatus error:', error);
    throw error;
  }
}

export async function setMinesControl(targetUsername: string, targetMines: number[]) {
  await addDoc(collection(db, 'game_controls'), {
    type: 'mines',
    targetUsername, // 'global' or specific username
    targetMines,
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

export async function setRouletteControl(targetUsername: string, targetNumber: number) {
  await addDoc(collection(db, 'game_controls'), {
    type: 'roulette',
    targetUsername,
    targetNumber,
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

export async function getUsers(search?: string) {
  let q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
  if (search) {
     q = query(collection(db, 'users'), where('username', '==', search));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
