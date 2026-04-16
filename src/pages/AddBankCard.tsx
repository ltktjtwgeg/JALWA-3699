import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Landmark, User, CreditCard, Smartphone, Mail, Search, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const BANKS = [
  "Bank of Baroda", "Union Bank of India", "Central Bank of India", "Yes Bank", "HDFC Bank",
  "Karnataka Bank", "Standard Chartered Bank", "IDBI Bank", "Bank of India", "Punjab National Bank",
  "ICICI Bank", "Canara Bank", "Kotak Mahindra Bank", "State Bank of India", "Indian Bank",
  "Axis Bank", "FEDERAL BANK", "Syndicate Bank", "Citibank India", "Bandhan Bank",
  "Indusind Bank", "India Post Payments Bank", "Corporation Bank", "City Union Bank",
  "Karur Vysya Bank", "Tamilnad Mercantile Bank", "Allahabad Bank", "varachha co-operative bank",
  "Meghalaya Rural Bank", "AU Small Finance Bank", "Lakshmi Vilas Bank", "South Indian Bank",
  "Bassein catholic co-operative Bank", "State Bank of Hyderabad", "Gp parsik bank",
  "Kerala Gramin Bank", "RBL Bank", "Dhanlaxmi Bank", "TJSB Bank", "Purvanchal bank"
];

export default function AddBankCard() {
  const navigate = useNavigate();
  const [showBankList, setShowBankList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    bankName: '',
    recipientName: '',
    accountNumber: '',
    phoneNumber: '',
    email: '',
    ifscCode: ''
  });

  const filteredBanks = BANKS.filter(bank => 
    bank.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = () => {
    if (!formData.bankName || !formData.recipientName || !formData.accountNumber || !formData.ifscCode) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (formData.phoneNumber && formData.phoneNumber.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    toast.success('Bank card added successfully');
    navigate(-1);
  };

  if (showBankList) {
    return (
      <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
        <div className="bg-[#2a2e35] p-4 flex items-center gap-4 sticky top-0 z-50 border-b border-gray-800">
          <button onClick={() => setShowBankList(false)} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold">Choose a bank</h1>
        </div>

        <div className="p-4">
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search bank"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#2a2e35] border border-gray-800 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-gray-500 px-4 mb-2">Choose a bank</p>
            {filteredBanks.map((bank, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setFormData({ ...formData, bankName: bank });
                  setShowBankList(false);
                }}
                className="w-full flex items-center p-4 hover:bg-white/5 border-b border-gray-800/50 last:border-0 transition-colors"
              >
                <span className="text-sm text-gray-300">{bank}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="bg-[#2a2e35] p-4 flex items-center gap-4 sticky top-0 z-50 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-1">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">Add a bank account number</h1>
      </div>

      <div className="p-4 space-y-6 pb-24">
        {/* Bank Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <Landmark className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Choose a bank</span>
          </div>
          <button 
            onClick={() => setShowBankList(true)}
            className="w-full bg-gradient-to-r from-rose-500/80 to-indigo-600/80 p-4 rounded-xl flex items-center justify-between border border-white/10 shadow-lg"
          >
            <span className={cn("text-sm font-bold", formData.bankName ? "text-white" : "text-white/70")}>
              {formData.bankName || "Please select a bank"}
            </span>
            <ChevronRight className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Recipient Name */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <User className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Full recipient's name</span>
          </div>
          <input
            type="text"
            placeholder="Please enter the recipient's name"
            value={formData.recipientName}
            onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
            className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Bank Account Number */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <CreditCard className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Bank account number</span>
          </div>
          <input
            type="text"
            placeholder="Please enter your bank account number"
            value={formData.accountNumber}
            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
            className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Phone Number */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <Smartphone className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Phone number</span>
          </div>
          <input
            type="tel"
            maxLength={10}
            placeholder="Please enter your 10-digit phone number"
            value={formData.phoneNumber}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              if (val.length <= 10) {
                setFormData({ ...formData, phoneNumber: val });
              }
            }}
            className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Email */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <Mail className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Mail</span>
          </div>
          <input
            type="email"
            placeholder="please input your email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* IFSC Code */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <Search className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">IFSC code</span>
          </div>
          <input
            type="text"
            placeholder="Please enter IFSC code"
            value={formData.ifscCode}
            onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
            className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSubmit}
          className="w-full bg-gradient-to-r from-gray-200 to-gray-400 text-gray-900 font-black py-4 rounded-full shadow-xl hover:from-white hover:to-gray-300 transition-all uppercase tracking-widest"
        >
          Save
        </button>
      </div>
    </div>
  );
}
