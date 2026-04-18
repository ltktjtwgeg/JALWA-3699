import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { 
  ChevronLeft, 
  Plus,
  X,
  CreditCard
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  collection, 
  addDoc, 
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Deposit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositMethod, setDepositMethod] = useState<'innate' | 'expert' | 'paytm' | 'usdt' | 'arpay'>('expert');
  const [depositChannel, setDepositChannel] = useState('QR-WePay');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const handleDeposit = async () => {
    if (!user || !amount || parseFloat(amount) <= 0) return toast.error('Enter valid amount');
    const depositAmount = parseFloat(amount);
    if (depositAmount < 110) return toast.error('Minimum deposit amount is ₹110.00');
    
    setLoading(true);
    try {
      // Update balance and total deposits
      await updateDoc(doc(db, 'users', user.uid), {
        balance: increment(depositAmount),
        totalDeposits: increment(depositAmount),
        dailyDeposits: increment(depositAmount),
        requiredTurnover: increment(depositAmount)
      });

      // Add transaction
      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        type: 'deposit',
        amount: depositAmount,
        status: 'completed',
        description: `Deposit via ${depositMethod.toUpperCase()} (${depositChannel})`,
        createdAt: serverTimestamp()
      });

      // Handle Referral Commission (10%)
      if (user.invitedBy) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('inviteCode', '==', user.invitedBy));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const inviterDoc = querySnapshot.docs[0];
          const inviterId = inviterDoc.id;
          const commission = depositAmount * 0.10;

          await updateDoc(doc(db, 'users', inviterId), {
            balance: increment(commission)
          });

          await addDoc(collection(db, 'transactions'), {
            uid: inviterId,
            type: 'win',
            amount: commission,
            status: 'completed',
            description: `Referral commission from ${user.username}`,
            createdAt: serverTimestamp()
          });
        }
      }

      toast.success('Deposit successful!');
      setAmount('');
      setSelectedAmount(null);
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white relative">
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Deposit</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/history/deposit')} className="text-xs font-medium text-gray-400 hover:text-white">
            Deposit history
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 p-6 space-y-6">
        {/* Balance Card Section */}
        <div className="bg-gradient-to-br from-[#ff9a9e] via-[#a18cd1] to-[#fbc2eb] p-6 rounded-3xl text-center shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
          <div className="relative z-10 flex flex-col items-center">
            <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest mb-2">Balance</p>
            <h1 className="text-3xl font-black text-white mb-1 drop-shadow-lg">₹{user?.balance.toFixed(2)}</h1>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-white/60 font-bold">
              <span>**** **** ****</span>
            </div>
          </div>
        </div>

        {/* Payment Methods Grid */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { id: 'innate', name: 'Innate UPI-QR', icon: '/images/wallet/upi.png' },
            { id: 'expert', name: 'Expert UPI-QR', icon: '/images/wallet/upi.png', badge: 'Expert' },
            { id: 'paytm', name: 'PAYTM', icon: '/images/wallet/paytm.png' },
            { id: 'usdt', name: 'USDT', icon: '/images/wallet/usdt.png' },
            { id: 'arpay', name: 'ARPay', icon: '/images/wallet/arpay.png', promo: '+2%' }
          ].map((method) => (
            <button
              key={method.id}
              onClick={() => setDepositMethod(method.id as any)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                depositMethod === method.id 
                  ? "bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border-purple-500 shadow-lg" 
                  : "bg-[#2a2e35] border-gray-800 text-gray-500"
              )}
            >
              {method.promo && (
                <div className="absolute -top-2 -right-1 bg-rose-500 text-[8px] font-black text-white px-1.5 py-0.5 rounded-md shadow-lg flex items-center gap-0.5">
                  <Plus className="w-2 h-2" />
                  {method.promo}
                </div>
              )}
              <div className="w-8 h-8 flex items-center justify-center overflow-hidden">
                <img 
                  src={method.icon} 
                  alt={method.name} 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', `<div class="w-full h-full bg-gray-700 rounded-lg flex items-center justify-center text-[8px] font-bold">${method.id.toUpperCase()}</div>`);
                  }}
                />
              </div>
              <span className="text-[8px] font-bold text-center leading-tight">{method.name}</span>
            </button>
          ))}
        </div>

        {/* Channel Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
            <div className="w-1 h-4 bg-purple-500 rounded-full" />
            Select channel
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'QR-WePay', range: '110 - 10K' },
              { id: 'QR-Umoney', range: '110 - 10K' },
              { id: 'QR-YayaPay', range: '110 - 50K' }
            ].map((channel) => (
              <button
                key={channel.id}
                onClick={() => setDepositChannel(channel.id)}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all",
                  depositChannel === channel.id
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 border-transparent shadow-lg"
                    : "bg-[#2a2e35] border-gray-800"
                )}
              >
                <p className="text-xs font-bold">{channel.id}</p>
                <p className="text-[10px] text-white/50 mt-1">Balance:{channel.range}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Deposit Amount Grid */}
        <div className="bg-[#1f2228] p-6 rounded-3xl border border-gray-800 space-y-6">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
            <div className="w-1 h-4 bg-purple-500 rounded-full" />
            Deposit amount
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {[100, 300, 500, 800, 1000, 2000, 3000, 5000, 6000, 8000, 9000, 10000].map((amt) => (
              <button
                key={amt}
                onClick={() => {
                  setSelectedAmount(amt);
                  setAmount(amt.toString());
                }}
                className={cn(
                  "py-3 rounded-xl border text-sm font-bold transition-all",
                  selectedAmount === amt
                    ? "bg-purple-600 border-purple-400 shadow-lg"
                    : "bg-gray-800/50 border-gray-700 text-gray-400"
                )}
              >
                ₹ {amt >= 1000 ? `${amt/1000}K` : amt}
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-xl font-bold text-purple-500">₹</span>
              <div className="w-[1px] h-4 bg-gray-700" />
            </div>
            <input 
              type="number" 
              placeholder="110.00 - 10,000.00"
              className="w-full bg-gray-800/50 border border-gray-700 rounded-2xl py-4 pl-12 pr-12 text-lg font-bold text-white outline-none focus:ring-2 focus:ring-purple-500"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setSelectedAmount(null);
              }}
            />
            {amount && (
              <button 
                onClick={() => { setAmount(''); setSelectedAmount(null); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-gray-700 rounded-full"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
              <div className="w-1 h-4 bg-purple-500 rounded-full" />
              Recharge instructions
            </div>
            <ul className="space-y-3">
              {[
                "If the transfer time is up, please fill out the deposit",
                "The minimum deposit amount is ₹110.00",
                "Please follow the instructions carefully to avoid delays"
              ].map((inst, i) => (
                <li key={i} className="flex items-start gap-3 text-[10px] text-gray-500 leading-relaxed">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1 shrink-0 rotate-45" />
                  {inst}
                </li>
              ))}
            </ul>
          </div>

          <button
            disabled={loading || !amount}
            onClick={handleDeposit}
            className="w-full py-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Deposit'}
          </button>
        </div>
      </div>

      {/* Floating Customer Service Icon */}
      <button 
        onClick={() => navigate('/customer-service')}
        className="fixed bottom-24 right-6 w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center z-50 hover:scale-110 active:scale-95 transition-all"
      >
        <img 
          src="/images/icons/customer_care.png" 
          alt="Support" 
          className="w-10 h-10 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bot text-purple-600"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>');
          }}
        />
      </button>
    </div>
  );
}
