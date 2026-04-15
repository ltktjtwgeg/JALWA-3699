import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function RiskDisclosure() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Risk Disclosure Agreement</h2>
        <div className="w-10" />
      </div>

      <div className="p-6 overflow-y-auto">
        <div className="prose prose-invert max-w-none text-sm text-gray-400 leading-relaxed space-y-6">
          <section>
            <h3 className="text-white font-bold text-base mb-4">User Agreement</h3>
            <div className="space-y-4">
              <p>
                1. To avoid betting disputes, members must read the company's rules before entering the app. Once the player "I agree" By entering this company to bet, you will be considered to be in agreement with the company's User Agreement.
              </p>
              <p>
                2. It is the member's responsibility to ensure the confidentiality of their account and login information. Any online bets placed using your account number and member password will be considered valid. Please change your password from time to time. The company is not responsible for any compensation for bets made with a stolen account and password.
              </p>
              <p>
                3. The company reserves the right to change this agreement or the game rules or confidentiality rules from time to time. The modified terms will take effect on the date specified after the change occurs, and the right to make final decisions on all disputes is reserved by the company.
              </p>
              <p>
                4. Users must be of legal age according to the laws of the country of residence to use an online casino or application. Online bets that have not been successfully submitted will be considered void.
              </p>
              <p>
                5. When a player is automatically or forcibly disconnected from the game before the game result is announced, it will not affect the game result.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
