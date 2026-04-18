import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { 
  ChevronLeft, 
  Wallet as WalletIcon, 
  History
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction } from '../types';
import { useNavigate } from 'react-router-dom';

export default function Wallet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isMusicOn, setIsMusicOn] = useState(() => {
    const saved = localStorage.getItem('music_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('music_enabled', isMusicOn.toString());
  }, [isMusicOn]);

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

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white relative">
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Wallet</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMusicOn(!isMusicOn)}
            className="p-2 hover:bg-gray-800 rounded-full"
          >
            <img 
              src={isMusicOn ? "/images/icons/music_on.png" : "/images/icons/music_off.png"} 
              alt="Music" 
              className="w-5 h-5 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music ${isMusicOn ? 'text-purple-500' : 'text-gray-500'}"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`);
              }}
            />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Balance Card Section */}
        <div className="bg-gradient-to-br from-[#ff9a9e] via-[#a18cd1] to-[#fbc2eb] p-8 text-center shadow-2xl relative overflow-hidden">
           <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
           <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/30">
              <WalletIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white mb-1 drop-shadow-lg">₹{user?.balance.toFixed(2)}</h1>
            <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest mb-6">Total balance</p>
            
            <div className="w-full grid grid-cols-2 divide-x divide-white/20">
              <div className="text-center">
                <p className="text-lg font-black text-white">₹{(user?.dailyBets || 0).toFixed(2)}</p>
                <p className="text-[8px] text-white/60 font-bold uppercase tracking-tighter">Total amount</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-white">₹{(user?.dailyDeposits || 0).toFixed(2)}</p>
                <p className="text-[8px] text-white/60 font-bold uppercase tracking-tighter">Total deposit amount</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Distribution Section */}
        <div className="p-6">
          <div className="bg-[#2a2e35] rounded-[32px] p-8 shadow-xl border border-gray-800">
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-800" />
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={0} className="text-indigo-500" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black">100%</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black">₹{user?.balance.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Main wallet</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-800" />
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2} className="text-purple-500" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black">0%</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black">₹0.00</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">3rd party wallet</p>
                </div>
              </div>
            </div>

            <button className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full font-black text-sm shadow-lg shadow-indigo-900/20 mb-8 active:scale-95 transition-all">
              Main wallet transfer
            </button>

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-4 gap-4">
              <div onClick={() => navigate('/deposit')} className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center group-hover:bg-yellow-500/30 transition-all overflow-hidden">
                  <img 
                    src="/images/wallet/deposit.png" 
                    alt="Deposit" 
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-circle text-yellow-500"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="m8 12 4 4 4-4"/></svg>');
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-400">Deposit</span>
              </div>
              <div onClick={() => navigate('/withdraw')} className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center group-hover:bg-blue-500/30 transition-all overflow-hidden">
                  <img 
                    src="/images/wallet/withdraw.png" 
                    alt="Withdraw" 
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-circle text-blue-500"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>');
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-400">Withdraw</span>
              </div>
              <div onClick={() => navigate('/history/deposit')} className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center group-hover:bg-rose-500/30 transition-all overflow-hidden">
                  <img 
                    src="/images/wallet/deposit_history.png" 
                    alt="Deposit History" 
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history text-rose-500"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>');
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-400 text-center leading-tight">Deposit history</span>
              </div>
              <div onClick={() => navigate('/history/withdraw')} className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/30 transition-all overflow-hidden">
                  <img 
                    src="/images/wallet/withdraw_history.png" 
                    alt="Withdrawal History" 
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history text-emerald-500"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>');
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-400 text-center leading-tight">Withdrawal history</span>
              </div>
            </div>
          </div>
        </div>

        {/* Game Specific Balances */}
        <div className="px-6 grid grid-cols-2 gap-4">
          <div className="bg-[#2a2e35] p-6 rounded-[32px] border border-gray-800 text-center">
            <p className="text-lg font-black">0.00</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase">ARGame</p>
          </div>
          <div className="bg-gradient-to-br from-[#ff9a9e] to-[#a18cd1] p-6 rounded-[32px] text-center shadow-lg">
            <p className="text-lg font-black text-white">{user?.balance.toFixed(2)}</p>
            <p className="text-[10px] text-white/70 font-bold uppercase">Lottery</p>
          </div>
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
