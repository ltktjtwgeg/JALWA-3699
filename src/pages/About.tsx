import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Shield, FileText } from 'lucide-react';
import { motion } from 'motion/react';

export default function About() {
  const navigate = useNavigate();

  const menuItems = [
    { 
      icon: Shield, 
      label: 'Confidentiality Agreement', 
      path: '/about/confidentiality',
      color: 'bg-indigo-500/20 text-indigo-400'
    },
    { 
      icon: FileText, 
      label: 'Risk Disclosure Agreement', 
      path: '/about/risk-disclosure',
      color: 'bg-purple-500/20 text-purple-400'
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">About us</h2>
        <div className="w-10" />
      </div>

      {/* Banner */}
      <div className="p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-48 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-3xl overflow-hidden border border-white/5 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
          <div className="relative z-10 flex flex-col items-center">
             <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-2xl mb-4 overflow-hidden p-2">
                <img 
                  src="/images/logo/logo_new.png" 
                  alt="Logo" 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer"
                />
             </div>
             <h3 className="text-xl font-black tracking-tighter uppercase italic">Jalwa 369</h3>
          </div>
        </motion.div>
      </div>

      {/* Menu List */}
      <div className="px-6 space-y-3">
        {menuItems.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => navigate(item.path)}
            className="flex items-center justify-between p-5 bg-[#2a2e35] rounded-2xl border border-gray-800 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-gray-200">{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </motion.div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="mt-auto p-8 text-center">
        <p className="text-[10px] text-gray-600 font-medium uppercase tracking-[0.2em]">Version 1.0.4</p>
        <p className="text-[10px] text-gray-700 mt-1">© 2024 JALWA 369. All rights reserved.</p>
      </div>
    </div>
  );
}
