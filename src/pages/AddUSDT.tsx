import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, Globe, Tag } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function AddUSDT() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    network: 'TRC',
    address: '',
    alias: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address) {
      toast.error('Please enter USDT address');
      return;
    }
    
    toast.success('USDT address added successfully');
    navigate(-1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="bg-[#2a2e35] p-4 flex items-center gap-4 sticky top-0 z-50 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-1">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">Add USDT address</h1>
      </div>

      <div className="p-4 space-y-8">
        {/* Security Warning */}
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex gap-3">
          <div className="w-6 h-6 rounded-full border border-rose-500 flex items-center justify-center shrink-0">
            <span className="text-rose-500 font-bold text-sm">!</span>
          </div>
          <p className="text-xs text-rose-400 font-medium leading-relaxed">
            To ensure the safety of your funds, please link your wallet
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Network Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-400">
              <Globe className="w-4 h-4 text-indigo-500" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Select main network</span>
            </div>
            <div className="relative">
              <select
                value={formData.network}
                onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white appearance-none focus:outline-none focus:border-indigo-500"
              >
                <option value="TRC">TRC</option>
                <option value="ERC">ERC</option>
                <option value="BEP20">BEP20</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronLeft className="w-4 h-4 text-gray-500 rotate-[-90deg]" />
              </div>
            </div>
          </div>

          {/* USDT Address */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center overflow-hidden">
                <img src="/images/wallet/usdt.png" className="w-4 h-4 object-contain" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">USDT Address</span>
            </div>
            <input
              type="text"
              placeholder="Please enter the USDT address"
              className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          {/* Address Alias */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-400">
              <Tag className="w-4 h-4 text-indigo-500" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Address Alias</span>
            </div>
            <input
              type="text"
              placeholder="Please enter a remark of the withdrawal address"
              className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500"
              value={formData.alias}
              onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
            />
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-gray-200 to-gray-400 text-gray-900 font-black py-4 rounded-full shadow-xl hover:from-white hover:to-gray-300 transition-all uppercase tracking-widest mt-12"
          >
            Save
          </button>
        </form>
      </div>
    </div>
  );
}
