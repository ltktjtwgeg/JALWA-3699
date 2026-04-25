import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Plus,
  X,
  History,
  Bomb,
  CreditCard,
  CreditCard as PaymentIcon,
  Send,
  Upload
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Deposit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositMethod, setDepositMethod] = useState<'razorpay' | 'manual'>('razorpay');
  const [depositChannel, setDepositChannel] = useState('Razorpay-Automated');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [transactionId, setTransactionId] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [manualStep, setManualStep] = useState(1);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) {
       return toast.error('Image too large. Please use a smaller screenshot (<500KB).');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
       const base64 = event.target?.result as string;
       setProofUrl(base64);
       toast.success('Screenshot uploaded successfully');
    };
    reader.readAsDataURL(file);
  };
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_config', 'settings'), (snap) => {
      if (snap.exists()) setSettings(snap.data());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Load Razorpay Script
    const razorScript = document.createElement('script');
    razorScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
    razorScript.async = true;
    document.body.appendChild(razorScript);

    return () => {
      if (document.body.contains(razorScript)) document.body.removeChild(razorScript);
    };
  }, []);

  const handleRazorpayPayment = async (depositAmount: number) => {
    try {
      setLoading(true);
      
      // Check if Razorpay script is actually loaded
      if (typeof (window as any).Razorpay === 'undefined') {
        const checkScript = setInterval(() => {
          if (typeof (window as any).Razorpay !== 'undefined') {
            clearInterval(checkScript);
            handleRazorpayPayment(depositAmount);
          }
        }, 1000);
        
        // Timeout after 5 seconds
        setTimeout(() => clearInterval(checkScript), 5000);
        toast.info('Loading payment gateway...');
        return;
      }

      // 1. Create order on server
      const orderResponse = await fetch('/api/payment/razorpay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: depositAmount, receipt: `receipt_${Date.now()}` })
      });
      const order = await orderResponse.json();

      if (order.error) {
        let msg = order.error;
        if (order.error.includes('not configured')) {
          msg = 'Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in App Settings.';
        }
        throw new Error(msg);
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: order.keyId || (import.meta as any).env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder', 
        amount: order.amount,
        currency: order.currency,
        name: "Jalwa 369",
        description: "Wallet Deposit",
        order_id: order.id,
        handler: async function (response: any) {
          setLoading(true);
          try {
            // 3. Verify on server
            const verifyResponse = await fetch('/api/payment/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...response,
                uid: user?.uid,
                amount: depositAmount
              })
            });
            const result = await verifyResponse.json();
            if (result.success) {
              toast.success('Payment successful and balance updated!');
              setAmount('');
              setSelectedAmount(null);
              // Wait a bit then refresh or navigate
              setTimeout(() => window.location.reload(), 1500);
            } else {
              toast.error('Payment verification failed');
            }
          } catch (err) {
            console.error('Verification Error:', err);
            toast.error('Error verifying payment');
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: user?.username || "",
          email: user?.email || "",
          contact: user?.phoneNumber || ""
        },
        theme: {
          color: "#8b5cf6"
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        toast.error('Payment failed: ' + response.error.description);
      });
      rzp.open();
    } catch (err: any) {
      console.error('Razorpay Error:', err);
      toast.error(err.message || 'Could not initiate Razorpay');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!user || !amount || parseFloat(amount) <= 0) return toast.error('Please enter a valid amount');
    const depositAmount = parseFloat(amount);
    if (depositAmount < 110) return toast.error('Minimum deposit amount is ₹110.00');
    if (depositAmount > 10000) return toast.error('Maximum deposit amount is ₹10,000.00');
    
    if (depositMethod === 'razorpay') {
      return handleRazorpayPayment(depositAmount);
    }

    if (depositMethod === 'manual') {
      if (manualStep === 1) {
        setManualStep(2);
        return;
      }

      if (!transactionId) return toast.error('Please enter Transaction ID');
      if (!proofUrl) return toast.error('Please provide payment proof URL');

      try {
        setLoading(true);
        await addDoc(collection(db, 'transactions'), {
          uid: user.uid,
          username: user.username,
          amount: depositAmount,
          type: 'deposit',
          status: 'pending',
          description: `Manual Deposit (${depositChannel})`,
          transactionId,
          proofUrl,
          createdAt: serverTimestamp()
        });
        toast.success('Deposit request submitted! Please wait for admin approval.');
        setAmount('');
        setTransactionId('');
        setProofUrl('');
        setSelectedAmount(null);
        setManualStep(1);
      } catch (err) {
        toast.error('Failed to submit request');
      } finally {
        setLoading(false);
      }
      return;
    }

    // For any other method, we disable manual balance update to prevent unauthorized deposits
    toast.error('Only Razorpay is currently supported for automated deposits. Please use the Razorpay option.');
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

        {/* Payment Methods Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
              <div className="w-1 h-4 bg-purple-500 rounded-full" />
              Payment method
            </div>
            <a 
              href="https://t.me/Jalwa369deposit" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#24A1DE] hover:bg-[#24A1DE]/80 text-white rounded-lg text-[10px] font-black flex items-center gap-1.5 shadow-lg shadow-sky-500/20 active:scale-95 transition-all uppercase tracking-wider"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
              </svg>
              Fast Deposit
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'razorpay', name: 'Razorpay', icon: '/images/wallet/razorpay.png', promo: '+2%' },
              { id: 'manual', name: 'Manual UPI', icon: '/images/wallet/upi.png', promo: '+5%' },
            ].map((method) => (
              <button
                key={method.id}
                onClick={() => setDepositMethod(method.id as any)}
                className={cn(
                  "relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                  depositMethod === method.id 
                    ? "bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border-purple-500 shadow-lg" 
                    : "bg-[#2a2e35] border-gray-800 text-gray-500"
                )}
              >
                {method.promo && (
                  <div className="absolute -top-2 -right-1 bg-rose-500 text-[10px] font-black text-white px-2 py-0.5 rounded-md shadow-lg flex items-center gap-0.5">
                    <Plus className="w-3 h-3" />
                    {method.promo}
                  </div>
                )}
                <div className="w-10 h-10 flex items-center justify-center overflow-hidden relative">
                  <img 
                    src={method.icon} 
                    alt={method.name} 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        if (method.id === 'razorpay') parent.insertAdjacentHTML('beforeend', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-credit-card text-purple-500"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>');
                        else parent.insertAdjacentHTML('beforeend', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-smartphone text-purple-500"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>');
                      }
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-center leading-tight">{method.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Channel Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
            <div className="w-1 h-4 bg-purple-500 rounded-full" />
            Select channel
          </div>
          <div className="grid grid-cols-1 gap-3">
            {manualStep === 1 ? (
              depositMethod === 'razorpay' ? (
                [
                  { id: 'Razorpay-Automated', range: '110 - 10K' },
                ].map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setDepositChannel(channel.id)}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all",
                      depositChannel === channel.id
                        ? "bg-gradient-to-br from-indigo-500 to-purple-600 border-transparent shadow-lg text-white"
                        : "bg-[#2a2e35] border-gray-800 text-gray-400"
                    )}
                  >
                    <p className="text-sm font-bold">{channel.id}</p>
                    <p className="text-xs text-white/50 mt-1">Range: {channel.range}</p>
                  </button>
                ))
              ) : (
                [
                  { id: 'UPI-Fast-Manual', range: '110 - 100K' },
                ].map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setDepositChannel(channel.id)}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all",
                      depositChannel === channel.id
                        ? "bg-gradient-to-br from-indigo-500 to-purple-600 border-transparent shadow-lg text-white"
                        : "bg-[#2a2e35] border-gray-800 text-gray-400"
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold">{channel.id}</p>
                        <p className="text-xs text-white/50 mt-1">Range: {channel.range}</p>
                      </div>
                      {settings?.upiId && (
                        <div className="text-right">
                          <p className="text-[10px] text-white/40 uppercase tracking-tighter">UPI ID</p>
                          <p className="text-xs font-black text-yellow-500">{settings.upiId}</p>
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )
            ) : (
              <button
                onClick={() => setManualStep(1)}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest text-gray-400"
              >
                ← Back to Selection
              </button>
            )}
          </div>
        </div>

        {depositMethod === 'manual' && settings?.upiId && manualStep === 2 && (
          <div className="bg-[#1f2228] p-8 rounded-[40px] border border-gray-800 space-y-6 animate-in zoom-in duration-300 shadow-2xl">
             <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
               <div className="w-1 h-4 bg-yellow-500 rounded-full" />
               Manual Payment Details
             </div>
             
             {settings.upiImage && (
                <div className="flex justify-center">
                   <div className="p-4 bg-white rounded-2xl w-48 h-48">
                      <img src={settings.upiImage} alt="QR Code" className="w-full h-full object-contain" />
                   </div>
                </div>
             )}

             <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Receiver UPI ID</p>
                  <p className="text-sm font-black text-white">{settings.upiId}</p>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(settings.upiId);
                    toast.success('UPI ID Copied');
                  }}
                  className="bg-purple-600 p-2 rounded-xl text-white active:scale-90 transition-transform"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
             </div>

             <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <p className="text-[10px] text-blue-400 font-bold leading-relaxed">
                  Please complete the payment on your UPI app first, then enter the Transaction reference ID/Screenshot URL below to verify.
                </p>
             </div>

             <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold uppercase ml-2">UPI Transaction ID (Ref No)</label>
                  <input 
                    type="text" 
                    placeholder="Enter 12 digit Ref No"
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-purple-500"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] text-gray-400 font-bold uppercase ml-2">Payment Proof (Screenshot URL)</label>
                   <input 
                      type="file" 
                      ref={proofInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleProofUpload} 
                   />
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       placeholder="Paste Screenshot Link Here"
                       className="flex-1 bg-gray-800/50 border border-gray-700 rounded-2xl py-3 px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                       value={proofUrl}
                       onChange={(e) => setProofUrl(e.target.value)}
                     />
                     <button 
                        onClick={() => proofInputRef.current?.click()}
                        className="bg-purple-600/20 text-purple-400 border border-purple-500/30 px-4 rounded-2xl text-[10px] font-black uppercase hover:bg-purple-600/30 transition-all flex items-center gap-2"
                     >
                        <Upload className="w-3 h-3" /> Upload
                     </button>
                   </div>
                   {proofUrl && proofUrl.startsWith('data:image') && (
                      <div className="mt-2 p-2 bg-black/20 rounded-xl border border-white/5 flex items-center gap-3">
                         <div className="w-10 h-10 bg-white rounded-lg p-1 shrink-0">
                           <img src={proofUrl} alt="Preview" className="w-full h-full object-contain" />
                         </div>
                         <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest">Screenshot ready for submission</p>
                      </div>
                   )}
                </div>
             </div>
          </div>
        )}

        {/* Right Panel: Amount & Buttons */}
        <div className="bg-[#1f2228] p-6 rounded-3xl border border-gray-800 space-y-6">
          <AnimatePresence mode="wait">
            {manualStep === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                  <div className="w-1 h-4 bg-purple-500 rounded-full" />
                  Deposit amount
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {[110, 200, 300, 500, 1000, 2000, 3000, 5000, 10000].map((amt) => (
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
                    placeholder="Min 110 - Max 10,000"
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
                      "Minimum deposit amount is ₹110.00",
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
                  onClick={handleDeposit}
                  disabled={loading || !amount || parseFloat(amount) < 110}
                  className="w-full py-5 rounded-[40px] bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Deposit Now'}
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                 <div className="bg-emerald-500/10 p-5 rounded-3xl border border-emerald-500/20 flex flex-col items-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 tracking-[0.1em]">Confirming Deposit Amount</p>
                    <h3 className="text-3xl font-black text-emerald-500 italic">₹{amount}</h3>
                 </div>
                 
                 <button 
                  onClick={handleDeposit}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-5 rounded-[40px] font-black uppercase tracking-[0.2em] shadow-xl shadow-orange-900/40 active:scale-95 transition-all text-sm border-t border-white/20"
                >
                  {loading ? 'Submitting Request...' : 'Verify Manually'}
                </button>

                <div className="flex items-center gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                   <p className="text-[9px] text-blue-400 font-bold leading-relaxed uppercase tracking-tighter">
                      Manual deposits take 15-30 minutes for verification. For instant credits, please use Automated "Instant Pay" mode.
                   </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
