import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CreditCard, Plus, X } from 'lucide-react';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function PaymentMethods() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAddChoices, setShowAddChoices] = useState(false);
  const paymentMethods = user?.paymentMethods || [];

  const addOptions = [
    { id: 'bank', name: 'BANK CARD', icon: CreditCard, path: '/withdraw/add-bank', color: 'bg-indigo-500' },
    { id: 'upi', name: 'UPI', icon: '/images/wallet/upi.png', path: '/withdraw/add-upi', color: 'bg-orange-500' },
    { id: 'usdt', name: 'USDT', icon: '/images/wallet/usdt.png', path: '/withdraw/add-usdt', color: 'bg-emerald-500' }
  ];

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
            {paymentMethods.map((method) => (
              <div 
                key={method.id}
                className="bg-[#2a2e35] p-4 rounded-xl border border-gray-800 flex items-center justify-between active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                    {method.type === 'bank' ? (
                      <CreditCard className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <img 
                        src={method.type === 'upi' ? "/images/wallet/upi.png" : "/images/wallet/usdt.png"} 
                        alt={method.type} 
                        className="w-6 h-6 object-contain" 
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide">
                      {method.type === 'bank' ? (method.bankName || 'Bank Card') : method.type.toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {method.type === 'bank' ? method.bankAccount : 
                       method.type === 'upi' ? method.upiId : method.usdtAddress}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            ))}
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
          onClick={() => setShowAddChoices(true)}
          className="w-full py-4 rounded-full bg-[#8f79f3] text-white font-bold text-sm shadow-xl shadow-[#8f79f3]/20 hover:bg-[#7b61f0] transition-all active:scale-95"
        >
          Add payment method
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
