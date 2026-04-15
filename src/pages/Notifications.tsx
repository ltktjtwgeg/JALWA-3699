import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BellOff } from 'lucide-react';
import { motion } from 'motion/react';

export default function NotificationsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Notification</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-32 h-32 bg-gray-800/50 rounded-full flex items-center justify-center border border-gray-700/50"
        >
          <BellOff className="w-12 h-12 text-gray-600" />
        </motion.div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-gray-400">No data</h3>
          <p className="text-sm text-gray-600">You don't have any notifications yet.</p>
        </div>
      </div>
    </div>
  );
}
