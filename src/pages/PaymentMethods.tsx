import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, CreditCard, Plus, X, Trash2 } from 'lucide-react';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function PaymentMethods() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [showAddChoices, setShowAddChoices] = useState(false);
  const preSelectedType = location.state?.type;
  
  const paymentMethods = (user?.paymentMethods || [])
    .filter(method => !preSelectedType || method.type === preSelectedType)
    // De-duplicate in case of database sync issues
    .filter((method, index, self) => 
      index === self.findIndex((m) => m.id === method.id || 
        (m.type === method.type && (
          (m.upiId && m.upiId === method.upiId) || 
          (m.bankAccount && m.bankAccount === method.bankAccount) ||
          (m.usdtAddress && m.usdtAddress === method.usdtAddress)
        ))
      )
    );

  const addOptions = [
    { id: 'bank', name: 'BANK CARD', icon: CreditCard, path: '/withdraw/add-bank', color: 'bg-indigo-500' },
    { id: 'upi', name: 'UPI', icon: '/images/wallet/upi.png', path: '/withdraw/add-upi', color: 'bg-orange-500' },
    { id: 'usdt', name: 'USDT', icon: '/images/wallet/usdt.png', path: '/withdraw/add-usdt', color: 'bg-emerald-500' }
  ];

  const handleAddClick = () => {
    if (preSelectedType) {
      const option = addOptions.find(opt => opt.id === preSelectedType);
      if (option) {
        navigate(option.path);
        return;
      }
    }
    setShowAddChoices(true);
  };

  const handleSelectMethod = async (methodId: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        selectedPaymentMethodId: methodId
      });
      toast.success('Selected for withdrawal');
      if (location.state?.fromWithdraw) {
        setTimeout(() => navigate('/withdraw'), 500);
      }
    } catch (error) {
      toast.error('Selection failed');
    }
  };

  const handleDeleteMethod = async (e: React.MouseEvent, methodToDelete: any) => {
    e.stopPropagation();
    if (!user || !user.paymentMethods) return;

    try {
      const updatedMethods = user.paymentMethods.filter((m: any) => m.id !== methodToDelete.id);
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        paymentMethods: updatedMethods
      });
      toast.success('Method removed successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Delete failed');
    }
  };

  const getButtonText = () => {
    if (!preSelectedType) return "Add payment method";
    const option = addOptions.find(opt => opt.id === preSelectedType);
    return option ? `Add ${option.name}` : "Add payment method";
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800/50">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Payment method</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {paymentMethods.length > 0 ? (
            <div className="space-y-4">
              {paymentMethods.map((method) => {
                const isSelected = user?.selectedPaymentMethodId === method.id;
                return (
                  <div 
                    key={method.id}
                    onClick={() => handleSelectMethod(method.id)}
                    className={cn(
                      "bg-[#2a2e35] p-5 rounded-[24px] border transition-all cursor-pointer relative overflow-hidden",
                      isSelected ? "border-[#8f79f3] bg-[#8f79f3]/5 shadow-xl shadow-[#8f79f3]/10 scale-[1.02]" : "border-gray-800"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                        isSelected ? "bg-[#8f79f3] text-white" : "bg-[#1f2228] text-gray-400"
                      )}>
                        {method.type === 'bank' ? (
                          <CreditCard className="w-6 h-6" />
                        ) : (
                          <img 
                            src={method.type === 'upi' ? "/images/wallet/upi.png" : "/images/wallet/usdt.png"} 
                            alt={method.type} 
                            className={cn("w-8 h-8 object-contain", isSelected ? "brightness-200" : "")} 
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-black uppercase tracking-widest text-white truncate">
                            {method.type === 'bank' ? (method.bankName || 'Bank Card') : 
                             method.type === 'upi' ? (method.name || 'UPI') : 
                             (method.alias || 'USDT')}
                          </p>
                          {isSelected && (
                            <span className="text-[8px] bg-[#8f79f3] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Active</span>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          {method.type === 'bank' && (
                            <>
                              <p className="text-[11px] font-bold text-gray-300">A/C: <span className="font-mono text-indigo-400">{method.bankAccount}</span></p>
                              <p className="text-[10px] text-gray-500 font-medium">NAME: {method.name}</p>
                              <p className="text-[10px] text-gray-500 font-medium tracking-tighter">IFSC: {method.ifsc}</p>
                            </>
                          )}
                          {method.type === 'upi' && (
                            <>
                              <p className="text-[11px] font-bold text-gray-300">ID: <span className="font-mono text-orange-400">{method.upiId}</span></p>
                              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tighter">HOLDER: {method.name}</p>
                            </>
                          )}
                          {method.type === 'usdt' && (
                            <>
                              <p className="text-[10px] font-bold text-gray-300 break-all leading-tight mb-1">
                                ADDR: <span className="font-mono text-emerald-400">{method.usdtAddress || (method as any).address}</span>
                              </p>
                              <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">NETWORK: {method.network || 'TRC20'}</p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="absolute top-0 right-0 h-full flex flex-col items-center justify-center gap-2 p-3 bg-gray-900/40 border-l border-gray-800/50 backdrop-blur-sm">
                         <button 
                           onClick={(e) => handleDeleteMethod(e, method)}
                           className="flex flex-col items-center justify-center p-2 bg-rose-500/10 hover:bg-rose-500 rounded-xl transition-all group"
                         >
                           <Trash2 className="w-5 h-5 text-rose-500 group-hover:text-white mb-1 transition-colors" />
                           <span className="text-[8px] font-black text-rose-500 group-hover:text-white uppercase transition-colors">Delete</span>
                         </button>
                         {isSelected && (
                           <div className="w-8 h-8 bg-[#8f79f3] rounded-full flex items-center justify-center shadow-lg shadow-[#8f79f3]/20 animate-in zoom-in duration-300">
                             <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                             </svg>
                           </div>
                         )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-32 opacity-60">
            <div className="w-48 h-48 mb-6 relative">
               <img 
                 src="/images/icons/no_data.png" 
                 alt="No data" 
                 className="w-full h-full object-contain relative z-10"
                 onError={(e) => {
                   e.currentTarget.style.display = 'none';
                   e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<div class="absolute inset-0 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-700"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg></div>');
                 }}
               />
            </div>
            <p className="text-sm font-medium text-gray-500 tracking-wider">No payment method</p>
          </div>
        )}
      </div>

      {/* Bottom Button */}
      <div className="p-6 sticky bottom-0 bg-gradient-to-t from-[#1a1d21] via-[#1a1d21] to-transparent">
        <button 
          onClick={handleAddClick}
          className="w-full py-4 rounded-full bg-[#8f79f3] text-white font-bold text-sm shadow-xl shadow-[#8f79f3]/20 hover:bg-[#7b61f0] transition-all active:scale-95"
        >
          {getButtonText()}
        </button>
      </div>

      {/* Choice Modal */}
      <AnimatePresence>
        {showAddChoices && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddChoices(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 px-6 flex items-center justify-center"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#2a2e35] w-full max-w-sm rounded-[32px] overflow-hidden p-6 relative"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-white italic">SELECT METHOD</h3>
                  <button onClick={() => setShowAddChoices(false)} className="p-1 hover:bg-gray-800 rounded-lg">
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {addOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => navigate(option.path)}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-[#1f2228] border border-gray-800 hover:border-gray-700 active:scale-[0.98] transition-all"
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", option.color)}>
                        {typeof option.icon === 'string' ? (
                          <img src={option.icon} alt={option.name} className="w-8 h-8 object-contain" />
                        ) : (
                          <option.icon className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <span className="font-black text-sm tracking-widest">{option.name}</span>
                      <ChevronRight className="ml-auto w-5 h-5 text-gray-600" />
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
