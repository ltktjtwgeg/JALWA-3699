import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Gift, History, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../App';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  runTransaction, 
  serverTimestamp,
  increment,
  getDocs,
  limit
} from 'firebase/firestore';

interface GiftRecord {
  id: string;
  code: string;
  amount: number;
  timestamp: any;
}

export default function GiftPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<GiftRecord[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'giftHistory'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GiftRecord[];
      setHistory(records);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleReceive = async () => {
    if (!code.trim()) return toast.error('Please enter gift code');
    if (!user?.uid) return toast.error('Please login first');
    
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Find the gift code
        const giftCodesRef = collection(db, 'giftCodes');
        const q = query(giftCodesRef, where('code', '==', code.trim()), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error('Invalid gift code');
        }

        const giftDoc = querySnapshot.docs[0];
        const giftData = giftDoc.data();

        if (!giftData.isActive) {
          throw new Error('This gift code is no longer active');
        }

        // 2. Check if user already used it
        const usedBy = giftData.usedBy || [];
        if (usedBy.includes(user.uid)) {
          throw new Error('You have already redeemed this code');
        }

        // 3. Check usage limit
        if (giftData.maxUses && giftData.currentUses >= giftData.maxUses) {
          throw new Error('This gift code has reached its usage limit');
        }

        // 4. Update user balance
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error('User not found');
        
        const currentBalance = userDoc.data().balance || 0;
        transaction.update(userRef, {
          balance: currentBalance + giftData.amount,
          requiredTurnover: increment(giftData.amount)
        });

        // 5. Update gift code usage
        transaction.update(giftDoc.ref, {
          currentUses: (giftData.currentUses || 0) + 1,
          usedBy: [...usedBy, user.uid]
        });

        // 6. Add to history
        const historyRef = doc(collection(db, 'giftHistory'));
        transaction.set(historyRef, {
          userId: user.uid,
          code: code.trim(),
          amount: giftData.amount,
          timestamp: serverTimestamp()
        });

        // 7. Add to main transactions
        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          uid: user.uid,
          type: 'bonus',
          amount: giftData.amount,
          status: 'completed',
          description: `Collect Bonus (Code: ${code.trim()})`,
          createdAt: serverTimestamp()
        });
      });

      toast.success(`Successfully received ₹${code.trim() === 'WELCOME' ? '100' : 'bonus'}!`);
      setCode('');
    } catch (error: any) {
      console.error('Redemption error:', error);
      toast.error(error.message || 'Failed to redeem gift code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Gift</h2>
        <div className="w-10" />
      </div>

      {/* Banner */}
      <div className="relative h-48 bg-gradient-to-br from-purple-600 to-rose-500 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <Gift className="w-24 h-24 text-white drop-shadow-2xl" />
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-4 -right-4 bg-yellow-400 text-black text-[10px] font-black px-2 py-1 rounded-full shadow-lg"
            >
              FREE
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold">Hi</h3>
            <p className="text-gray-400 text-sm">We have a gift for you</p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-300">Please enter the gift code below</p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Please enter gift code"
              className="w-full bg-[#2a2e35] border border-gray-800 rounded-2xl py-4 px-6 text-sm outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
            <button
              disabled={loading}
              onClick={handleReceive}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-purple-600 rounded-full font-black text-white shadow-lg shadow-purple-900/20 disabled:opacity-50 active:scale-95 transition-all"
            >
              {loading ? 'Processing...' : 'Receive'}
            </button>
          </div>
        </div>

        {/* History */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-400">
            <History className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-wider">History</span>
          </div>

          <div className="space-y-3">
            {history.length > 0 ? (
              history.map((record) => (
                <div key={record.id} className="bg-[#2a2e35] rounded-2xl p-4 border border-gray-800 flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-emerald-400 text-sm font-bold">Successfully received</p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {record.timestamp?.toDate().toLocaleString() || 'Processing...'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Code: {record.code}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20">
                    <div className="w-4 h-4 bg-yellow-500 rounded-sm flex items-center justify-center">
                      <span className="text-[8px] font-black text-black">₹</span>
                    </div>
                    <span className="text-sm font-black text-yellow-500">{record.amount}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-[#2a2e35] rounded-3xl p-8 border border-gray-800 text-center">
                <p className="text-xs text-gray-600">No more</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
