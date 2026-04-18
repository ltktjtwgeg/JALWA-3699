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
import { GAME_DURATIONS } from './gameService';

export interface Banner {
  id: string;
  image: string;
  link?: string;
}

export interface SystemSettings {
  wingoAutoControl: boolean;
  wingoRandomMode: boolean;
  usdtRate: number;
  withdrawLimit: number;
  salaryBonus: number;
  maintenanceMode: boolean;
  commissionRate: number;
  upiId: string;
  upiImage?: string;
  usdtAddress: string;
  usdtImage?: string;
  gameStatuses: Record<string, boolean>;
  banners?: Banner[];
  popupBannerUrl?: string;
  showPopup?: boolean;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  wingoAutoControl: false,
  wingoRandomMode: true,
  usdtRate: 92,
  withdrawLimit: 500,
  salaryBonus: 10,
  maintenanceMode: false,
  commissionRate: 0.02,
  upiId: '',
  usdtAddress: '',
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
    { id: '1', image: '/images/slider_banner/custom_banner_1.png' },
    { id: '2', image: '/images/slider_banner/custom_banner_2.png' },
    { id: '3', image: '/images/slider_banner/custom_banner_3.png' }
  ],
  popupBannerUrl: '',
  showPopup: true
};

export async function getSystemSettings(): Promise<SystemSettings> {
  const settingsDoc = await getDoc(doc(db, 'system_config', 'main'));
  if (settingsDoc.exists()) {
    return { ...DEFAULT_SETTINGS, ...settingsDoc.data() } as SystemSettings;
  }
  return DEFAULT_SETTINGS;
}

export async function updateSystemSettings(settings: Partial<SystemSettings>) {
  await setDoc(doc(db, 'system_config', 'main'), {
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
  const now = Math.floor(Date.now() / 1000);
  const currentRoundIndex = Math.floor(now / duration);
  const targetDate = new Date(now * 1000);
  const dateStr = targetDate.toISOString().slice(0, 10).replace(/-/g, '');
  const currentPeriodId = `${dateStr}${currentRoundIndex}`;
  
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
  await addDoc(collection(db, 'game_controls'), {
    type: 'wingo',
    gameType: type,
    targetSize,
    targetNumber,
    status: 'pending',
    createdAt: serverTimestamp()
  });
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
  const transRef = doc(db, 'transactions', id);
  const transSnap = await getDoc(transRef);
  if (!transSnap.exists()) return;
  
  const transData = transSnap.data();
  if (transData.status !== 'pending') return;

  const userRef = doc(db, 'users', uid);
  
  if (status === 'completed') {
    if (transData.type === 'deposit') {
      await updateDoc(userRef, { 
        balance: increment(transData.amount),
        totalDeposits: increment(transData.amount),
        dailyDeposits: increment(transData.amount),
        requiredTurnover: increment(transData.amount)
      });
    }
  } else if (status === 'rejected') {
    if (transData.type === 'withdraw') {
      // Refund balance if withdrawal rejected
      await updateDoc(userRef, { balance: increment(transData.amount) });
    }
  }

  await updateDoc(transRef, { 
    status, 
    updatedAt: serverTimestamp() 
  });
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
