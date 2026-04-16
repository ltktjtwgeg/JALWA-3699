import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Smartphone, CreditCard, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function AddUPI() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    upiName: '',
    phoneNumber: '',
    upiId: '',
    confirmUpiId: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.upiName || !formData.phoneNumber || !formData.upiId || !formData.confirmUpiId) {
      toast.error('Please fill all fields');
      return;
    }
    if (formData.phoneNumber.length !== 10) {
      toast.error('Phone number must be 10 digits');
      return;
    }
    if (formData.upiId !== formData.confirmUpiId) {
      toast.error('UPI IDs do not match');
      return;
    }
    
    toast.success('UPI information added successfully');
    navigate(-1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="bg-[#2a2e35] p-4 flex items-center gap-4 sticky top-0 z-50 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-1">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">Payment method</h1>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-gradient-to-r from-orange-400 to-blue-500 p-1.5 rounded-lg overflow-hidden">
            <img src="/images/wallet/upi.png" className="w-4 h-4 object-contain" />
          </div>
          <h2 className="text-sm font-black uppercase tracking-widest italic text-white/90">Information UPI</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* UPI Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase tracking-tighter">UPI Name</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Please enter UPI name"
                className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                value={formData.upiName}
                onChange={(e) => setFormData({ ...formData, upiName: e.target.value })}
              />
            </div>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase tracking-tighter">phone number</label>
            <div className="relative">
              <input
                type="tel"
                maxLength={10}
                placeholder="Please enter the phone number"
                className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                value={formData.phoneNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 10) {
                    setFormData({ ...formData, phoneNumber: val });
                  }
                }}
              />
            </div>
            <div className="flex gap-2 px-1">
              <Info className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-indigo-400 leading-tight">
                For the security of your account, please fill in your real mobile phone number
              </p>
            </div>
          </div>

          {/* UPI ID */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase tracking-tighter">UPI ID</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Please enter your UPI ID"
                className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                value={formData.upiId}
                onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
              />
            </div>
          </div>

          {/* Confirm UPI ID */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase tracking-tighter">Confirm UPI ID</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Please enter your UPI ID"
                className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                value={formData.confirmUpiId}
                onChange={(e) => setFormData({ ...formData, confirmUpiId: e.target.value })}
              />
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-gray-200 to-gray-400 text-gray-900 font-black py-4 rounded-full shadow-xl hover:from-white hover:to-gray-300 transition-all uppercase tracking-widest mt-8"
          >
            Save
          </button>
        </form>
      </div>
    </div>
  );
}
