import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RefreshCw, CreditCard, Smartphone, Globe, Plus, Info, Wallet } from 'lucide-react';
import { useAuth } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';

export default function Withdraw() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Balance updated');
    }, 1000);
  };

  const handleWithdraw = async () => {
    if (!user) return;
    const withdrawAmount = parseFloat(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (withdrawAmount > (user.balance || 0)) {
      toast.error('Insufficient balance');
      return;
    }
    if (withdrawAmount < 110) {
      toast.error('Minimum withdrawal amount is ₹110.00');
      return;
    }

    // Wagering requirement check
    const totalDeposits = user.totalDeposits || 0;
    const totalBets = user.totalBets || 0;
    if (totalBets < totalDeposits) {
      toast.error(`Need to bet ₹${(totalDeposits - totalBets).toFixed(2)} more to be able to withdraw`);
      return;
    }

    try {
      // Check daily withdrawal limit (max 3)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const q = query(
        collection(db, 'transactions'),
        where('uid', '==', user.uid),
        where('type', '==', 'withdraw'),
        where('createdAt', '>=', today)
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.size >= 3) {
        toast.error('Maximum 3 withdrawals allowed per day');
        return;
      }

      // Proceed with withdrawal request
      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        type: 'withdraw',
        amount: withdrawAmount,
        status: 'pending',
        description: `Withdrawal request via ${selectedMethod.toUpperCase()}`,
        createdAt: serverTimestamp()
      });

      // Deduct balance
      await updateDoc(doc(db, 'users', user.uid), {
        balance: increment(-withdrawAmount)
      });

      toast.success('Withdrawal request submitted successfully');
      setAmount('');
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast.error('Failed to submit withdrawal request');
    }
  };

  const paymentMethods = [
    { id: 'bank', name: 'BANK CARD', icon: CreditCard },
    { id: 'upi', name: 'UPI', icon: Smartphone },
    { id: 'usdt', name: 'USDT', icon: () => (
      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
        <span className="text-[10px] font-black text-white">T</span>
      </div>
    )},
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="bg-[#2a2e35] p-4 flex items-center justify-between sticky top-0 z-50 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold">Withdraw</h1>
        </div>
        <button 
          onClick={() => navigate('/history/withdraw')}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Withdrawal history
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-[#5c7fb1] via-[#43618a] to-[#2a3a5a] rounded-3xl p-6 shadow-xl relative overflow-hidden">
          {/* Template Background Image */}
          <img 
            src="/images/wallet/withdraw_bg.jpg" 
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => e.currentTarget.style.display = 'none'}
            referrerPolicy="no-referrer"
          />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-yellow-400 rounded flex items-center justify-center">
                <Wallet className="w-3 h-3 text-black" />
              </div>
              <span className="text-sm font-medium text-white/80">Available balance</span>
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-white">{formatCurrency(user?.balance || 0)}</h2>
              <RefreshCw 
                onClick={handleRefresh}
                className={cn(
                  "w-5 h-5 text-white/60 cursor-pointer transition-transform duration-1000",
                  isRefreshing && "rotate-180"
                )} 
              />
            </div>
          </div>
          {/* Decorative dots */}
          <div className="absolute bottom-4 right-6 flex gap-1 opacity-40">
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="w-1 h-1 bg-white rounded-full" />
            <span className="mx-1" />
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="w-1 h-1 bg-white rounded-full" />
          </div>
        </div>

        {/* ARPay Info */}
        <div className="bg-[#2a2e35] p-4 rounded-2xl border border-gray-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
            <span className="text-2xl font-black text-black">A</span>
          </div>
          <div>
            <h3 className="font-bold">ARPay</h3>
            <p className="text-xs text-gray-500">Supports UPI for fast payment</p>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="grid grid-cols-3 gap-3">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                selectedMethod === method.id
                  ? "bg-gradient-to-br from-rose-400 to-blue-500 border-transparent shadow-lg"
                  : "bg-[#2a2e35] border-gray-800 text-gray-400"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                selectedMethod === method.id ? "bg-white/20" : "bg-gray-800"
              )}>
                {typeof method.icon === 'function' ? <method.icon /> : <method.icon className={cn(
                  "w-6 h-6",
                  selectedMethod === method.id ? "text-white" : "text-gray-400"
                )} />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">{method.name}</span>
            </button>
          ))}
        </div>

        {/* Add Payment Method */}
        <button 
          onClick={() => {
            if (selectedMethod === 'bank') {
              navigate('/withdraw/add-bank');
            } else if (selectedMethod === 'upi') {
              navigate('/withdraw/add-upi');
            } else if (selectedMethod === 'usdt') {
              navigate('/withdraw/add-usdt');
            }
          }}
          className="w-full bg-[#2a2e35] p-8 rounded-2xl border border-dashed border-gray-700 flex flex-col items-center gap-2 hover:bg-gray-800 transition-colors"
        >
          <div className="w-10 h-10 border border-gray-600 rounded-lg flex items-center justify-center">
            <Plus className="w-6 h-6 text-gray-500" />
          </div>
          <span className="text-xs font-bold text-gray-500">Add {selectedMethod.toUpperCase()}</span>
        </button>

        {/* Amount Input */}
        <div className="space-y-4">
          {selectedMethod === 'usdt' && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                <span className="text-[10px] font-black text-white">T</span>
              </div>
              <span className="text-xs font-bold text-gray-300">Select amount of USDT</span>
            </div>
          )}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 font-bold">₹</div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Please enter the amount"
              className="w-full bg-[#2a2e35] border border-gray-800 rounded-2xl py-4 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          
          {selectedMethod === 'usdt' && (
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-black text-white">T</span>
                </div>
              </div>
              <input
                type="number"
                readOnly
                value={(parseFloat(amount) / 92 || 0).toFixed(2)}
                placeholder="Please enter USDT amount"
                className="w-full bg-[#2a2e35] border border-gray-800 rounded-2xl py-4 pl-10 pr-4 text-sm focus:outline-none text-gray-400"
              />
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Withdrawable balance</span>
              <span className="text-xs text-yellow-500 font-bold">{formatCurrency(user?.balance || 0)}</span>
            </div>
            <button 
              onClick={() => setAmount((user?.balance || 0).toString())}
              className="text-xs bg-indigo-500/10 text-indigo-400 px-4 py-1 rounded-full border border-indigo-500/20 font-bold"
            >
              All
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-400">Withdrawal amount received</span>
            <span className="text-xs text-yellow-500 font-bold">{formatCurrency(parseFloat(amount) || 0)}</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleWithdraw}
          className="w-full bg-gray-300 text-gray-800 font-black py-4 rounded-full shadow-xl hover:bg-white transition-all uppercase tracking-widest"
        >
          Withdraw
        </button>

        {/* Rules */}
        <div className="bg-[#2a2e35] rounded-3xl p-6 border border-gray-800 space-y-4">
          {[
            `Need to bet ₹${Math.max(0, (user?.totalDeposits || 0) - (user?.totalBets || 0)).toFixed(2)} more to be able to withdraw`,
            `Withdraw time 00:00-23:59`,
            `Inday Remaining Withdrawal Times 3`,
            `Withdrawal amount range ₹110.00-₹50,000.00`,
            `Please confirm your beneficial account information before withdrawing. If your information is incorrect, our company will not be liable for the amount of loss`,
            `If your beneficial information is incorrect, please contact customer service`
          ].map((rule, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-sm rotate-45 shrink-0 mt-1.5" />
              <p className="text-[10px] text-gray-400 leading-relaxed">{rule}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
