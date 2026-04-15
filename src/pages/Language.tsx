import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const LANGUAGES = [
  { id: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
  { id: 'hi', name: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
  { id: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { id: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
];

export default function LanguagePage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('en');

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Language</h2>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="p-4 space-y-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            onClick={() => setSelected(lang.id)}
            className={cn(
              "w-full flex items-center justify-between p-5 rounded-2xl transition-all border",
              selected === lang.id 
                ? "bg-[#2a2e35] border-purple-500/50 shadow-lg shadow-purple-500/5" 
                : "bg-transparent border-transparent hover:bg-white/5"
            )}
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">{lang.flag}</span>
              <div className="text-left">
                <p className="font-bold text-sm">{lang.native}</p>
                {lang.name !== lang.native && (
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{lang.name}</p>
                )}
              </div>
            </div>
            <div className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
              selected === lang.id 
                ? "bg-purple-600 border-purple-600" 
                : "border-gray-700"
            )}>
              {selected === lang.id && <Check className="w-4 h-4 text-white" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
