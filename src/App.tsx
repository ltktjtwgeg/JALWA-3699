/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { StrictMode, useEffect, useState, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User as AppUser, GameType } from './types';
import { syncUser } from './services/apiService';
import './index.css';

// Pages
import Home from './pages/Home';
import Activity from './pages/Activity';
import GamePage from './pages/GamePage';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Wallet from './pages/Wallet';
import Deposit from './pages/Deposit';
import Withdraw from './pages/Withdraw';
import AddBankCard from './pages/AddBankCard';
import AddUPI from './pages/AddUPI';
import AddUSDT from './pages/AddUSDT';
import Admin from './pages/Admin';
import History from './pages/History';
import Promotion from './pages/Promotion';
import Settings from './pages/Settings';
import Language from './pages/Language';
import Gift from './pages/Gift';
import Notifications from './pages/Notifications';
import About from './pages/About';
import Confidentiality from './pages/Confidentiality';
import RiskDisclosure from './pages/RiskDisclosure';
import Announcements from './pages/Announcements';
import Feedback from './pages/Feedback';
import CustomerService from './pages/CustomerService';
import GameStatistics from './pages/GameStatistics';
import VIP from './pages/VIP';
import Mines from './pages/Mines';
import Roulette from './pages/Roulette';
import InvitationBonus from './pages/InvitationBonus';
import PaymentMethods from './pages/PaymentMethods';
import SuperAdmin from './pages/SuperAdmin';
import AdminPortal from './pages/Admin/AdminPortal';
import MobileLayout from './components/MobileLayout';

const AuthContext = createContext<{
  user: AppUser | null;
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  refreshUser: () => Promise<void>;
} | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        // Sync with MySQL if enabled
        syncUser(fUser.uid, fUser.displayName || 'User', fUser.email || '');
        
        // Fetch app user data
        const userDoc = await getDoc(doc(db, 'users', fUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as AppUser);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen for real-time user updates (balance, etc)
  useEffect(() => {
    if (firebaseUser) {
      const unsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data() as AppUser;
          
          // Daily Reset Logic
          const lastReset = userData.lastStatsResetAt?.toDate();
          const now = new Date();
          const isDifferentDay = !lastReset || 
            lastReset.getDate() !== now.getDate() || 
            lastReset.getMonth() !== now.getMonth() || 
            lastReset.getFullYear() !== now.getFullYear();

          if (isDifferentDay) {
            import('firebase/firestore').then(({ updateDoc, Timestamp }) => {
              updateDoc(userDoc.ref, {
                dailyDeposits: 0,
                dailyBets: 0,
                lastStatsResetAt: Timestamp.now()
              });
            });
          }
          
          setUser(userData);
        }
      });
      return () => unsubscribe();
    }
  }, [firebaseUser]);

  const refreshUser = async () => {
    if (firebaseUser) {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        setUser(userDoc.data() as AppUser);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, firebaseUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen bg-[#1a1d21] text-white">Loading...</div>;
  return firebaseUser ? <>{children}</> : <Navigate to="/login" />;
}

import { processGameResults, settleUserBets } from './services/gameService';

function GameManager() {
  const { firebaseUser } = useAuth();

  useEffect(() => {
    if (!firebaseUser) return;

    let isRunning = false;
    const runManager = async () => {
      if (isRunning) return;
      isRunning = true;
      
      try {
        const types: GameType[] = ['30s', '1m', '3m', '5m'];
        for (const type of types) {
          await processGameResults(type);
          await settleUserBets(firebaseUser.uid, type);
        }
      } catch (error) {
        console.error('Error in GameManager:', error);
      } finally {
        isRunning = false;
      }
    };

    const interval = setInterval(runManager, 1000);
    return () => clearInterval(interval);
  }, [firebaseUser]);

  return null;
}

export default function App() {
  useEffect(() => {
    async function testConnection() {
      try {
        await getDoc(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  return (
    <AuthProvider>
      <GameManager />
      <div className="min-h-screen bg-[#1a1d21] text-white font-sans overflow-x-hidden">
        <BrowserRouter>
          <Routes>
            {/* Super Admin - Full Width */}
            <Route path="/super-admin" element={<PrivateRoute><SuperAdmin /></PrivateRoute>} />
            <Route path="/admin" element={<AdminPortal />} />
            
            {/* Mobile Layout Routes */}
            <Route path="*" element={
              <MobileLayout>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/activity" element={<PrivateRoute><Activity /></PrivateRoute>} />
                  <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
                  <Route path="/game/:type" element={<PrivateRoute><GamePage /></PrivateRoute>} />
                  <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                  <Route path="/wallet" element={<PrivateRoute><Wallet /></PrivateRoute>} />
                  <Route path="/deposit" element={<PrivateRoute><Deposit /></PrivateRoute>} />
                  <Route path="/withdraw" element={<PrivateRoute><Withdraw /></PrivateRoute>} />
                  <Route path="/withdraw/add-bank" element={<PrivateRoute><AddBankCard /></PrivateRoute>} />
                  <Route path="/withdraw/add-upi" element={<PrivateRoute><AddUPI /></PrivateRoute>} />
                  <Route path="/withdraw/add-usdt" element={<PrivateRoute><AddUSDT /></PrivateRoute>} />
                  <Route path="/history/:type" element={<PrivateRoute><History /></PrivateRoute>} />
                  <Route path="/promotion" element={<PrivateRoute><Promotion /></PrivateRoute>} />
                  <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
                  <Route path="/language" element={<PrivateRoute><Language /></PrivateRoute>} />
                  <Route path="/gift" element={<PrivateRoute><Gift /></PrivateRoute>} />
                  <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
                  <Route path="/about" element={<PrivateRoute><About /></PrivateRoute>} />
                  <Route path="/about/confidentiality" element={<PrivateRoute><Confidentiality /></PrivateRoute>} />
                  <Route path="/about/risk-disclosure" element={<PrivateRoute><RiskDisclosure /></PrivateRoute>} />
                  <Route path="/announcements" element={<PrivateRoute><Announcements /></PrivateRoute>} />
                  <Route path="/feedback" element={<PrivateRoute><Feedback /></PrivateRoute>} />
                  <Route path="/customer-service" element={<PrivateRoute><CustomerService /></PrivateRoute>} />
                  <Route path="/game-statistics" element={<PrivateRoute><GameStatistics /></PrivateRoute>} />
                  <Route path="/vip" element={<PrivateRoute><VIP /></PrivateRoute>} />
                  <Route path="/mines" element={<PrivateRoute><Mines /></PrivateRoute>} />
                  <Route path="/roulette" element={<PrivateRoute><Roulette /></PrivateRoute>} />
                  <Route path="/activity/invitation-bonus" element={<PrivateRoute><InvitationBonus /></PrivateRoute>} />
                  <Route path="/withdraw/payment-methods" element={<PrivateRoute><PaymentMethods /></PrivateRoute>} />
                </Routes>
              </MobileLayout>
            } />
          </Routes>
        </BrowserRouter>
        <Toaster 
          position="top-center" 
          richColors 
          duration={1500} 
          visibleToasts={1}
          closeButton={true}
        />
      </div>
    </AuthProvider>
  );
}

