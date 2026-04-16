import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { 
  ChevronLeft, 
  CreditCard,
  ChevronRight,
  RefreshCw,
  Plus,
  Smartphone,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Withdraw() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<'bank' | 'upi' | 'usdt'>('bank');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleWithdraw = async () => {
    if (!user || !amount || parseFloat(amount) <= 0) return toast.error('Enter valid amount');
    const withdrawAmount = parseFloat(amount);
    if (user.balance < withdrawAmount) return toast.error('Insufficient balance');
    
    const hasMethod = user.paymentMethods?.some(m => m.type === withdrawMethod);
    if (!hasMethod) {
      toast.error(`Please add a ${withdrawMethod.toUpperCase()} first`);
      return;
    }

    setLoading(true);
    try {
      let description = `Withdrawal via ${withdrawMethod.toUpperCase()}`;
      
      const selectedMethod = user.paymentMethods?.find(m => m.type === withdrawMethod);
      if (selectedMethod) {
        if (withdrawMethod === 'bank') {
          description += ` (${selectedMethod.bankName} - ${selectedMethod.bankAccount})`;
        } else if (withdrawMethod === 'upi') {
          description += ` (${selectedMethod.upiId})`;
        } else if (withdrawMethod === 'usdt') {
          description += ` (${selectedMethod.address})`;
        }
      }

      await updateDoc(doc(db, 'users', user.uid), {
        balance: increment(-withdrawAmount)
      });

      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        type: 'withdraw',
        amount: withdrawAmount,
        status: 'pending',
        description: description,
        createdAt: serverTimestamp()
      });

      toast.success('Withdrawal request submitted!');
      setAmount('');
    } catch (error) {
      toast.error('Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const getAddPath = () => {
    switch(withdrawMethod) {
      case 'bank': return '/withdraw/add-bank';
      case 'upi': return '/withdraw/add-upi';
      case 'usdt': return '/withdraw/add-usdt';
      default: return '/withdraw/add-bank';
    }
  };

  const selectedMethod = user?.paymentMethods?.find(m => m.type === withdrawMethod);

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Withdraw</h2>
        <button onClick={() => navigate('/history/withdraw')} className="text-xs font-medium text-gray-400 hover:text-white">
          Withdrawal history
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 p-4 space-y-6">
        {/* Balance Card Section */}
        <div className="bg-gradient-to-br from-[#ff9a9e] via-[#a18cd1] to-[#fbc2eb] p-6 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-yellow-500 rounded flex items-center justify-center">
                <CreditCard className="w-3 h-3 text-white" />
              </div>
              <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">Available balance</p>
            </div>
            <div className="flex items-center gap-3 mb-8">
              <h1 className="text-3xl font-black text-white drop-shadow-lg">₹{user?.balance.toFixed(2)}</h1>
              <RefreshCw 
                onClick={handleRefresh}
                className={cn("w-5 h-5 text-white/70 cursor-pointer transition-transform duration-1000", isRefreshing && "rotate-180")} 
              />
            </div>
            <div className="flex justify-end">
              <span className="text-xs text-white/60 font-mono tracking-[0.3em]">**** ****</span>
            </div>
          </div>
        </div>

        {/* ARPay Banner */}
        <div className="bg-[#2a2e35] p-4 rounded-xl flex items-center gap-4 border border-gray-800">
          <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-2xl font-black italic text-black">A</span>
          </div>
          <div>
            <h3 className="text-sm font-bold">ARPay</h3>
            <p className="text-[10px] text-gray-500">Supports UPI for fast payment</p>
          </div>
        </div>

        {/* Withdrawal Methods Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'bank', name: 'BANK CARD', icon: CreditCard, color: 'from-blue-500/20 to-indigo-600/20', activeColor: 'from-blue-500 to-indigo-600' },
            { id: 'upi', name: 'UPI', icon: '/images/wallet/upi.png', color: 'from-orange-500/20 to-rose-600/20', activeColor: 'from-orange-500 to-rose-600' },
            { id: 'usdt', name: 'USDT', icon: '/images/wallet/usdt.png', color: 'from-emerald-400/20 to-teal-600/20', activeColor: 'from-emerald-400 to-teal-600' }
          ].map((method) => (
            <button 
              key={method.id}
              onClick={() => setWithdrawMethod(method.id as any)}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-xl border transition-all relative overflow-hidden",
                withdrawMethod === method.id 
                  ? `bg-gradient-to-br ${method.activeColor} border-transparent shadow-lg` 
                  : `bg-[#2a2e35] border-gray-800 text-gray-500`
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden",
                withdrawMethod === method.id ? "bg-white/20" : "bg-gray-800"
              )}>
                {typeof method.icon === 'string' ? (
                  <img src={method.icon} alt={method.name} className="w-8 h-8 object-contain" />
                ) : (
                  <method.icon className="w-6 h-6" />
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">{method.name}</span>
            </button>
          ))}
        </div>

        {/* Add Section */}
        <div className="space-y-4">
          {selectedMethod ? (
            <div className="bg-[#2a2e35] p-4 rounded-xl border border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center overflow-hidden">
                  {withdrawMethod === 'bank' ? <CreditCard className="w-5 h-5 text-indigo-500" /> : 
                   withdrawMethod === 'upi' ? <img src="/images/wallet/upi.png" className="w-6 h-6 object-contain" /> : 
                   <img src="/images/wallet/usdt.png" className="w-6 h-6 object-contain" />}
                </div>
                <div>
                  <p className="text-sm font-bold">{selectedMethod.name || selectedMethod.alias}</p>
                  <p className="text-[10px] text-gray-500">
                    {withdrawMethod === 'bank' ? selectedMethod.bankAccount : 
                     withdrawMethod === 'upi' ? selectedMethod.upiId : 
                     selectedMethod.address}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </div>
          ) : (
            <button 
              onClick={() => navigate(getAddPath())}
              className="w-full py-12 bg-[#2a2e35] border border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center gap-3 text-gray-500 hover:bg-[#32373e] transition-all"
            >
              <div className="w-10 h-10 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold">Add {withdrawMethod === 'usdt' ? 'address' : withdrawMethod === 'upi' ? 'UPI ID' : 'bank card'}</span>
            </button>
          )}
          
          {!selectedMethod && (
            <p className="text-center text-[10px] text-rose-500 font-medium">
              Need to add beneficiary information to be able to withdraw money
            </p>
          )}
        </div>

        {/* Amount Section */}
        <div className="bg-[#1f2228] p-6 rounded-2xl border border-gray-800 space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-emerald-500 rounded flex items-center justify-center overflow-hidden">
              {withdrawMethod === 'usdt' ? <img src="/images/wallet/usdt.png" className="w-4 h-4 object-contain" /> : 
               withdrawMethod === 'upi' ? <img src="/images/wallet/upi.png" className="w-4 h-4 object-contain" /> :
               <CreditCard className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm font-bold">Select amount of {withdrawMethod.toUpperCase()}</span>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-indigo-500">₹</span>
              <input 
                type="number" 
                placeholder="Please enter withdrawal amount"
                className="w-full bg-gray-800/50 border-none rounded-xl py-4 pl-10 pr-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {withdrawMethod === 'usdt' && (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center overflow-hidden">
                  <img src="/images/wallet/usdt.png" className="w-4 h-4 object-contain" />
                </div>
                <input 
                  type="number" 
                  placeholder="Please enter USDT amount"
                  className="w-full bg-gray-800/50 border-none rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={amount ? (parseFloat(amount) / 90).toFixed(2) : ''}
                  readOnly
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500">
              Withdrawable balance <span className="text-orange-500 font-bold">₹{user?.balance.toFixed(2)}</span>
            </p>
            <button 
              onClick={() => setAmount(user?.balance.toString() || '0')}
              className="px-6 py-1 border border-indigo-500 rounded-full text-[10px] font-bold text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all"
            >
              All
            </button>
          </div>

          <button
            disabled={loading || !amount}
            onClick={handleWithdraw}
            className="w-full py-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-400 text-gray-900 font-black text-lg shadow-xl hover:from-white hover:to-gray-300 transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Withdraw'}
          </button>
        </div>

        {/* Withdrawal Instructions */}
        <div className="bg-[#1f2228] p-6 rounded-2xl border border-gray-800 space-y-4">
          <ul className="space-y-4">
            {[
              { label: 'Need to bet', value: '₹0.00', sub: 'to be able to withdraw' },
              { label: 'Withdraw time', value: '00:10-23:50' },
              { label: 'Inday Remaining Withdrawal Times', value: '3' },
              { label: 'Withdrawal amount range', value: '₹1,000.00-₹1,000,000.00' },
              { text: 'After withdraw, you need to confirm the blockchain main network 3 times before it arrives at your account.' },
              { text: 'Please confirm that the operating environment is safe to avoid information being tampered with or leaked.' }
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-[10px] text-gray-500 leading-relaxed">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0 rotate-45" />
                <div>
                  {item.label ? (
                    <p>
                      {item.label} <span className="text-rose-500 font-bold">{item.value}</span> {item.sub}
                    </p>
                  ) : (
                    <p>{item.text}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
