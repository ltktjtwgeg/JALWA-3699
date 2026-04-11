import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { 
  ChevronLeft, 
  Wallet as WalletIcon, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  History,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  CreditCard,
  Plus,
  ShieldCheck,
  ChevronRight,
  User as UserIcon,
  Phone,
  Hash,
  Save,
  X,
  Search,
  Mail,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  arrayUnion,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, PaymentMethod } from '../types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Wallet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [withdrawMethod, setWithdrawMethod] = useState<'bank' | 'upi' | 'usdt'>('upi');
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showPaymentList, setShowPaymentList] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  
  // UPI Form State
  const [upiName, setUpiName] = useState('');
  const [upiPhone, setUpiPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [confirmUpiId, setConfirmUpiId] = useState('');

  // Bank Form State
  const [bankName, setBankName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankPhone, setBankPhone] = useState('');
  const [bankEmail, setBankEmail] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  const INDIAN_BANKS = [
    'Bank of Baroda', 'Union Bank of India', 'Central Bank of India', 'Yes Bank', 'HDFC Bank',
    'Karnataka Bank', 'Standard Chartered Bank', 'IDBI Bank', 'Bank of India', 'Punjab National Bank',
    'ICICI Bank', 'Canara Bank', 'Kotak Mahindra Bank', 'State Bank of India', 'Indian Bank',
    'Axis Bank', 'FEDERAL BANK', 'Syndicate Bank', 'Citibank India', 'Bandhan Bank',
    'Indusind Bank', 'India Post Payments Bank', 'Corporation Bank', 'City Union Bank',
    'Karur Vysya Bank', 'Tamilnad Mercantile Bank', 'Sarva Haryana Gramin Bank',
    'Ahmedabad District Co-Operative Bank', 'Fino Payments Bank', 'Saraswat Cooperative Bank',
    'Telangana Grameena Bank', 'andhra pragathi grameena bank', 'rajasthan marudhara gramin bank',
    'Abhyudaya bank', 'ujjivan small finance bank', 'capital small finance bank', 'Mizoram Rural Bank',
    'Andhra Pradesh Grameena Vikas Bank', 'Karnataka Vikas Grameena Bank', 'The Ahmedabad merchantile co-op bank',
    'Madhya Bihar Gramin Bank', 'NSDL Payments Bank', 'ESAF Small Finance Bank', 'Himachal Pradesh state cooperative bank',
    'Maharashtra state cooperative bank', 'ORIENTAL BANK OF COMMERCE', 'nainital bank', 'Jharkhand Rajya Gramin Bank',
    'jio payments bank', 'MAHARASHTRA GRAMIN BANK', 'Uttarakhand Gramin Bank', 'Himachal Pradesh Gramin Bank',
    'Krishna District Co-Operative Central Bank Ltd.', 'Allahabad Bank', 'varachha co-operative bank',
    'Meghalaya Rural Bank', 'AU Small Finance Bank', 'Lakshmi Vilas Bank', 'South Indian Bank',
    'Bassein catholic co-operative Bank', 'State Bank of Hyderabad', 'Gp parsik bank', 'Kerala Gramin Bank',
    'RBL Bank', 'Dhanlaxmi Bank', 'TJSB Bank', 'Purvanchal bank'
  ];

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid),
      where('type', 'in', ['deposit', 'withdraw']),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const trans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(trans);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSaveBank = async () => {
    if (!user) return;
    if (!bankName || !recipientName || !accountNumber || !bankPhone || !bankEmail || !ifscCode) {
      return toast.error('Please fill all fields');
    }

    // Check if bank already exists
    const hasBank = user.paymentMethods?.some(m => m.type === 'bank');
    if (hasBank) return toast.error('Bank account already added');

    setLoading(true);
    try {
      const newMethod: PaymentMethod = {
        id: Math.random().toString(36).substring(7),
        type: 'bank',
        name: recipientName,
        bankName: bankName,
        bankAccount: accountNumber,
        phone: bankPhone,
        email: bankEmail,
        ifsc: ifscCode,
        createdAt: Timestamp.now()
      };

      await updateDoc(doc(db, 'users', user.uid), {
        paymentMethods: arrayUnion(newMethod)
      });

      toast.success('Bank details saved successfully');
      setShowAddBank(false);
      // Reset fields
      setBankName('');
      setRecipientName('');
      setAccountNumber('');
      setBankPhone('');
      setBankEmail('');
      setIfscCode('');
    } catch (error) {
      toast.error('Failed to save bank details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUpi = async () => {
    if (!user) return;
    if (!upiName || !upiPhone || !upiId || !confirmUpiId) return toast.error('Please fill all fields');
    if (upiId !== confirmUpiId) return toast.error('UPI IDs do not match');

    // Check if UPI already exists
    const hasUpi = user.paymentMethods?.some(m => m.type === 'upi');
    if (hasUpi) return toast.error('UPI ID already added');

    setLoading(true);
    try {
      const newMethod: PaymentMethod = {
        id: Math.random().toString(36).substring(7),
        type: 'upi',
        name: upiName,
        phone: upiPhone,
        upiId: upiId,
        createdAt: Timestamp.now()
      };

      await updateDoc(doc(db, 'users', user.uid), {
        paymentMethods: arrayUnion(newMethod)
      });

      toast.success('UPI details saved successfully');
      setShowAddPayment(false);
      setUpiName('');
      setUpiPhone('');
      setUpiId('');
      setConfirmUpiId('');
    } catch (error) {
      toast.error('Failed to save UPI details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!user || !amount || parseFloat(amount) <= 0) return toast.error('Enter valid amount');
    setLoading(true);
    try {
      const depositAmount = parseFloat(amount);
      
      // Update balance
      await updateDoc(doc(db, 'users', user.uid), {
        balance: increment(depositAmount)
      });

      // Add transaction
      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        type: 'deposit',
        amount: depositAmount,
        status: 'completed',
        description: 'Deposit via UPI (Simulated)',
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

          // Add commission to inviter
          await updateDoc(doc(db, 'users', inviterId), {
            balance: increment(commission)
          });

          // Add commission transaction record
          await addDoc(collection(db, 'transactions'), {
            uid: inviterId,
            type: 'win', // Using 'win' or could add 'commission' type
            amount: commission,
            status: 'completed',
            description: `Referral commission from ${user.username}`,
            createdAt: serverTimestamp()
          });
        }
      }

      toast.success('Deposit successful!');
      setAmount('');
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !amount || parseFloat(amount) <= 0) return toast.error('Enter valid amount');
    const withdrawAmount = parseFloat(amount);
    if (user.balance < withdrawAmount) return toast.error('Insufficient balance');
    
    // Check if payment method exists
    if (withdrawMethod === 'upi') {
      if (!upiName || !upiId || !upiPhone) {
        return toast.error('Please enter all UPI details');
      }
    }

    const hasBank = user.paymentMethods?.some(m => m.type === 'bank');

    if (withdrawMethod === 'bank' && !hasBank) {
      toast.error('Please add a Bank Card first');
      return setShowPaymentList(true);
    }

    setLoading(true);
    try {
      let description = `Withdrawal via ${withdrawMethod.toUpperCase()}`;
      
      if (withdrawMethod === 'upi') {
        description += ` (${upiId} - ${upiName} - ${upiPhone})`;
      } else {
        const selectedMethod = user.paymentMethods?.find(m => m.type === withdrawMethod);
        if (selectedMethod) {
          if (withdrawMethod === 'bank') {
            description += ` (${selectedMethod.bankName} - ${selectedMethod.bankAccount})`;
          }
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

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="font-bold text-lg">{activeTab === 'deposit' ? 'Deposit' : 'Withdraw'}</h2>
        </div>
        <button onClick={() => navigate(`/history/${activeTab}`)} className="text-xs text-gray-400 font-medium">
          {activeTab === 'deposit' ? 'Deposit history' : 'Withdrawal history'}
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Balance Card */}
        <div className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-[32px] p-8 overflow-hidden shadow-2xl">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
              <WalletIcon className="w-4 h-4" />
              Available balance
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight">{formatCurrency(user?.balance || 0)}</h1>
              <RefreshCw 
                onClick={() => {
                  setIsRefreshing(true);
                  setTimeout(() => {
                    setIsRefreshing(false);
                    toast.success('Balance updated');
                  }, 1000);
                }}
                className={cn(
                  "w-5 h-5 text-white/60 cursor-pointer transition-transform duration-1000",
                  isRefreshing && "rotate-180"
                )} 
              />
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute right-10 top-10 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute bottom-4 right-8 flex gap-2 opacity-30">
            <span className="text-xl font-bold">****</span>
            <span className="text-xl font-bold">****</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'deposit' ? 'bg-purple-600 shadow-lg shadow-purple-900/20' : 'bg-gray-800 text-gray-500'}`}
          >
            <ArrowDownCircle className="w-5 h-5" />
            Deposit
          </button>
          <button 
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'withdraw' ? 'bg-purple-600 shadow-lg shadow-purple-900/20' : 'bg-gray-800 text-gray-500'}`}
          >
            <ArrowUpCircle className="w-5 h-5" />
            Withdraw
          </button>
        </div>

        {activeTab === 'withdraw' && (
          <>
            {/* ARPay Banner */}
            <div className="bg-[#2a2e35] rounded-2xl p-4 flex items-center gap-4 border border-gray-800">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl font-black text-yellow-500">A</span>
              </div>
              <div>
                <h4 className="font-bold text-sm">ARPay</h4>
                <p className="text-[10px] text-gray-400">Supports UPI for fast payment</p>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => setWithdrawMethod('bank')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${withdrawMethod === 'bank' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 border-transparent shadow-lg' : 'bg-[#2a2e35] border-gray-800 text-gray-500'}`}
              >
                <CreditCard className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase">Bank Card</span>
              </button>
              <button 
                onClick={() => setWithdrawMethod('upi')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${withdrawMethod === 'upi' ? 'bg-gradient-to-br from-orange-400 to-rose-500 border-transparent shadow-lg' : 'bg-[#2a2e35] border-gray-800 text-gray-500'}`}
              >
                <div className="relative">
                  <span className="text-lg font-black italic">UPI</span>
                  <div className="absolute -inset-1 border border-white/20 rounded" />
                </div>
                <span className="text-[10px] font-bold uppercase">UPI</span>
              </button>
              <button 
                onClick={() => setWithdrawMethod('usdt')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${withdrawMethod === 'usdt' ? 'bg-gradient-to-br from-emerald-400 to-teal-600 border-transparent shadow-lg' : 'bg-[#2a2e35] border-gray-800 text-gray-500'}`}
              >
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold">₮</span>
                </div>
                <span className="text-[10px] font-bold uppercase">USDT</span>
              </button>
            </div>

            {/* UPI Details Form */}
            {withdrawMethod === 'upi' && (
              <div className="bg-[#1f2228] p-6 rounded-3xl border border-gray-800 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <span className="font-black italic text-orange-500 text-xs">UPI</span>
                  </div>
                  <h3 className="font-bold text-sm">UPI Information</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">UPI Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input 
                        type="text"
                        placeholder="Enter UPI name"
                        className="w-full bg-gray-800/50 border-none rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-purple-500"
                        value={upiName}
                        onChange={(e) => setUpiName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">UPI ID</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input 
                        type="text"
                        placeholder="Enter UPI ID"
                        className="w-full bg-gray-800/50 border-none rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-purple-500"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input 
                        type="tel"
                        placeholder="Enter phone number"
                        className="w-full bg-gray-800/50 border-none rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-purple-500"
                        value={upiPhone}
                        onChange={(e) => setUpiPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add Bank Button */}
            {withdrawMethod === 'bank' && (
              <button 
                onClick={() => setShowPaymentList(true)}
                className="w-full py-8 bg-[#2a2e35] rounded-2xl border border-dashed border-gray-700 flex flex-col items-center justify-center gap-2 group hover:border-purple-500 transition-colors"
              >
                <div className="w-10 h-10 border border-gray-600 rounded-xl flex items-center justify-center group-hover:border-purple-500">
                  <Plus className="w-6 h-6 text-gray-500 group-hover:text-purple-500" />
                </div>
                <span className="text-xs text-gray-500 font-medium">Add Bank Card</span>
              </button>
            )}
          </>
        )}

        {/* Amount Input Section */}
        <div className="bg-[#1f2228] rounded-3xl p-6 border border-gray-800 space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-purple-500">₹</span>
              <input 
                type="number" 
                placeholder="Please enter the amount"
                className="w-full bg-gray-800/50 border-none rounded-2xl py-4 pl-10 pr-20 text-lg font-bold text-white outline-none focus:ring-2 focus:ring-purple-500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button 
                onClick={() => setAmount(user?.balance.toString() || '0')}
                className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-gray-700 rounded-lg text-[10px] font-bold text-gray-300 hover:bg-gray-600"
              >
                All
              </button>
            </div>
            
            {activeTab === 'withdraw' && (
              <div className="space-y-2 px-1">
                <div className="flex justify-between text-[10px] font-medium">
                  <span className="text-gray-400 text-[10px]">Withdrawable balance ₹{user?.balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-medium">
                  <span className="text-gray-400">Withdrawal amount received</span>
                  <span className="text-yellow-500 font-bold">₹{amount ? (parseFloat(amount) * 0.96).toFixed(2) : '0.00'}</span>
                </div>
              </div>
            )}
          </div>

          <button
            disabled={loading}
            onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
            className="w-full py-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-400 text-gray-900 font-black text-lg shadow-xl hover:from-white hover:to-gray-300 transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : activeTab === 'deposit' ? 'Deposit' : 'Withdraw'}
          </button>

          {activeTab === 'withdraw' && (
            <div className="space-y-2 pt-4 border-t border-gray-800">
              <div className="text-[10px] text-gray-500 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rotate-45" />
                Need to bet ₹0.00 to be able to withdraw
              </div>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="mt-10 space-y-4">
          <h3 className="font-bold text-gray-300 flex items-center gap-2">
            <History className="w-5 h-5 text-purple-500" />
            Recent Transactions
          </h3>

          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="bg-[#1f2228] p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl ${t.type === 'deposit' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {t.type === 'deposit' ? <ArrowDownCircle className="w-5 h-5 text-green-500" /> : <ArrowUpCircle className="w-5 h-5 text-red-500" />}
                  </div>
                  <div>
                    <p className="font-bold text-sm capitalize">{t.type}</p>
                    <p className="text-[10px] text-gray-500">{t.createdAt?.toDate().toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${t.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                    {t.type === 'deposit' ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                  <div className="flex items-center justify-end gap-1">
                    {t.status === 'completed' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : t.status === 'pending' ? <Clock className="w-3 h-3 text-yellow-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                    <span className={`text-[10px] capitalize ${t.status === 'completed' ? 'text-green-500' : t.status === 'pending' ? 'text-yellow-500' : 'text-red-500'}`}>{t.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Method List Modal */}
      <AnimatePresence>
        {showPaymentList && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#1a1d21] flex flex-col"
          >
            <div className="p-4 flex items-center gap-4 border-b border-gray-800">
              <button onClick={() => setShowPaymentList(false)} className="p-2 hover:bg-gray-800 rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-lg">Payment method</h2>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              {user?.paymentMethods && user.paymentMethods.filter(m => m.type === withdrawMethod).length > 0 ? (
                <div className="w-full space-y-4">
                  {user.paymentMethods.filter(m => m.type === withdrawMethod).map((m) => (
                    <div key={m.id} className="bg-[#2a2e35] p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.type === 'upi' ? 'bg-orange-500/20' : 'bg-blue-500/20'}`}>
                          {m.type === 'upi' ? (
                            <span className="font-black italic text-orange-500">UPI</span>
                          ) : (
                            <CreditCard className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">{m.name}</p>
                          <p className="text-xs text-gray-500">{m.type === 'upi' ? m.upiId : `${m.bankName} - ${m.bankAccount}`}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 opacity-40">
                  <div className="w-24 h-24 mx-auto bg-gray-800 rounded-full flex items-center justify-center">
                    {withdrawMethod === 'upi' ? (
                      <span className="text-2xl font-black italic text-gray-600">UPI</span>
                    ) : (
                      <CreditCard className="w-10 h-10 text-gray-600" />
                    )}
                  </div>
                  <p className="text-gray-500 font-medium">No {withdrawMethod === 'upi' ? 'UPI ID' : 'Bank Card'} added</p>
                </div>
              )}
            </div>

            <div className="p-6">
              {(!user?.paymentMethods?.some(m => m.type === withdrawMethod)) && (
                <button 
                  onClick={() => { 
                    setShowPaymentList(false); 
                    if (withdrawMethod === 'upi') setShowAddPayment(true);
                    else if (withdrawMethod === 'bank') setShowAddBank(true);
                  }}
                  className="w-full py-4 bg-purple-600 rounded-xl font-bold text-white shadow-lg shadow-purple-900/20"
                >
                  Add {withdrawMethod === 'upi' ? 'UPI ID' : 'Bank Card'}
                </button>
              )}
              {user?.paymentMethods?.some(m => m.type === withdrawMethod) && (
                <button 
                  onClick={() => setShowPaymentList(false)}
                  className="w-full py-4 bg-gray-800 rounded-xl font-bold text-gray-400"
                >
                  Close
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add UPI Modal */}
      <AnimatePresence>
        {showAddPayment && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed inset-0 z-[70] bg-[#1a1d21] flex flex-col"
          >
            <div className="p-4 flex items-center gap-4 border-b border-gray-800">
              <button onClick={() => setShowAddPayment(false)} className="p-2 hover:bg-gray-800 rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-lg">Payment method</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <span className="font-black italic text-orange-500">UPI</span>
                </div>
                <h3 className="text-lg font-bold">Information UPI</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-300">UPI Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type="text"
                      placeholder="Please enter UPI name"
                      className="w-full bg-[#2a2e35] border-none rounded-xl py-4 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                      value={upiName}
                      onChange={(e) => setUpiName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-300">phone number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type="tel"
                      placeholder="Please enter the phone number"
                      className="w-full bg-[#2a2e35] border-none rounded-xl py-4 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                      value={upiPhone}
                      onChange={(e) => setUpiPhone(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-blue-400 flex gap-1">
                    <div className="w-3 h-3 rounded-full border border-blue-400 flex items-center justify-center text-[8px] shrink-0">i</div>
                    For the security of your account, please fill in your real mobile phone number
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-300">UPI ID</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type="text"
                      placeholder="Please enter your UPI ID"
                      className="w-full bg-[#2a2e35] border-none rounded-xl py-4 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-300">Confirm UPI ID</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type="text"
                      placeholder="Please enter your UPI ID"
                      className="w-full bg-[#2a2e35] border-none rounded-xl py-4 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                      value={confirmUpiId}
                      onChange={(e) => setConfirmUpiId(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <button 
                disabled={loading}
                onClick={handleSaveUpi}
                className="w-full py-4 bg-gradient-to-r from-gray-200 to-gray-400 text-gray-900 font-black text-lg rounded-xl shadow-xl hover:from-white hover:to-gray-300 transition-all disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Bank Modal */}
      <AnimatePresence>
        {showAddBank && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed inset-0 z-[70] bg-[#1a1d21] flex flex-col"
          >
            <div className="p-4 flex items-center gap-4 border-b border-gray-800">
              <button onClick={() => setShowAddBank(false)} className="p-2 hover:bg-gray-800 rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-lg">Add a bank account number</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Bank Selection */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-500" />
                  Choose a bank
                </label>
                <button 
                  onClick={() => setShowBankSelector(true)}
                  className="w-full bg-gradient-to-r from-rose-400 to-purple-600 p-4 rounded-xl flex items-center justify-between text-white font-bold shadow-lg"
                >
                  <span>{bankName || 'Please select a bank'}</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Recipient Name */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-purple-500" />
                  Full recipient's name
                </label>
                <input 
                  type="text"
                  placeholder="Please enter the recipient's name"
                  className="w-full bg-[#2a2e35] border-none rounded-xl py-4 px-4 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>

              {/* Bank Account Number */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-500" />
                  Bank account number
                </label>
                <input 
                  type="text"
                  placeholder="Please enter your bank account number"
                  className="w-full bg-[#2a2e35] border-none rounded-xl py-4 px-4 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-purple-500" />
                  Phone number
                </label>
                <input 
                  type="tel"
                  placeholder="Please enter your phone number"
                  className="w-full bg-[#2a2e35] border-none rounded-xl py-4 px-4 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={bankPhone}
                  onChange={(e) => setBankPhone(e.target.value)}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-purple-500" />
                  Mail
                </label>
                <input 
                  type="email"
                  placeholder="please input your email"
                  className="w-full bg-[#2a2e35] border-none rounded-xl py-4 px-4 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={bankEmail}
                  onChange={(e) => setBankEmail(e.target.value)}
                />
              </div>

              {/* IFSC Code */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <Search className="w-4 h-4 text-purple-500" />
                  IFSC code
                </label>
                <input 
                  type="text"
                  placeholder="Please enter IFSC code"
                  className="w-full bg-[#2a2e35] border-none rounded-xl py-4 px-4 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="p-6">
              <button 
                disabled={loading}
                onClick={handleSaveBank}
                className="w-full py-4 bg-gradient-to-r from-gray-200 to-gray-400 text-gray-900 font-black text-lg rounded-xl shadow-xl hover:from-white hover:to-gray-300 transition-all disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bank Selector Modal */}
      <AnimatePresence>
        {showBankSelector && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-[80] bg-[#1a1d21] flex flex-col"
          >
            <div className="p-4 flex items-center gap-4 border-b border-gray-800">
              <button onClick={() => setShowBankSelector(false)} className="p-2 hover:bg-gray-800 rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-lg">Choose a bank</h2>
            </div>

            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                  type="text"
                  placeholder="Search bank"
                  className="w-full bg-[#2a2e35] border-none rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-1">
                <p className="text-xs text-gray-500 px-4 py-2">Choose a bank</p>
                {INDIAN_BANKS.filter(b => b.toLowerCase().includes(bankSearch.toLowerCase())).map((bank, idx) => (
                  <button 
                    key={idx}
                    onClick={() => { setBankName(bank); setShowBankSelector(false); }}
                    className="w-full text-left p-4 hover:bg-white/5 border-b border-gray-800/50 last:border-0 text-sm font-medium text-gray-300"
                  >
                    {bank}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
