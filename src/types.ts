import { Timestamp } from 'firebase/firestore';

export type GameType = '30s' | '1m' | '3m' | '5m';

export interface PaymentMethod {
  id: string;
  type: 'upi' | 'bank' | 'usdt';
  name: string;
  phone?: string;
  email?: string;
  upiId?: string;
  bankName?: string;
  bankAccount?: string;
  ifsc?: string;
  usdtAddress?: string;
  createdAt: Timestamp;
}

export interface User {
  uid: string;
  email?: string;
  phoneNumber?: string;
  username?: string;
  nickname?: string;
  avatarUrl?: string;
  numericId?: number;
  balance: number;
  totalDeposits?: number;
  totalBets?: number;
  dailyDeposits?: number;
  dailyBets?: number;
  requiredTurnover?: number;
  claimedInvitationBonuses?: string[];
  lastStatsResetAt?: Timestamp;
  vipLevel: number;
  inviteCode: string;
  invitedBy?: string;
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
  role: 'user' | 'admin';
  isDemo?: boolean;
  paymentMethods?: PaymentMethod[];
  selectedPaymentMethodId?: string;
}

export interface Game {
  id?: string;
  periodId: string;
  gameType: GameType;
  startTime: Timestamp;
  endTime: Timestamp;
  resultNumber?: number;
  resultColor?: string;
  resultSize?: 'Big' | 'Small';
  status: 'active' | 'completed';
}

export interface Bet {
  id?: string;
  uid: string;
  periodId: string;
  gameType: GameType;
  selection: string; // 'Green', 'Red', 'Violet', 'Big', 'Small', or '0'-'9'
  amount: number;
  multiplier: number;
  totalAmount: number;
  fee: number;
  netAmount: number;
  status: 'pending' | 'win' | 'lost';
  winAmount?: number;
  createdAt: Timestamp;
}

export interface Transaction {
  id?: string;
  uid: string;
  type: 'deposit' | 'withdraw' | 'bet' | 'win' | 'bonus';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description?: string;
  createdAt: Timestamp;
}
