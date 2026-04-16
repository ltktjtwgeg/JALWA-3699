import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { motion } from 'motion/react';

export default function CustomerService() {
  const navigate = useNavigate();

  const handleTelegramClick = () => {
    window.open('https://t.me/JALWA369official', '_blank');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Agent line customer service</h2>
        <div className="w-10" />
      </div>

      {/* Banner */}
      <div className="relative h-48 overflow-hidden">
        <img 
          src="/images/banners/customer_service.png" 
          alt="Customer Service" 
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = 'https://picsum.photos/seed/support/800/400';
          }}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      </div>

      {/* Contact Options */}
      <div className="p-6 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleTelegramClick}
          className="bg-[#2a2e35] p-5 rounded-2xl border border-gray-800 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Send className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-200">Telegram</p>
              <p className="text-[10px] text-gray-500">Fastest way to get help</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </motion.div>

        <div className="mt-8 p-6 bg-gray-800/30 rounded-3xl border border-gray-800 text-center">
          <p className="text-xs text-gray-500 leading-relaxed">
            If you have any questions or encounter any problems, please contact our online customer service. We are here to help you 24/7.
          </p>
        </div>
      </div>
    </div>
  );
}
