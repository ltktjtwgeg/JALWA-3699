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
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (fUser) {
        // Immediate load from cache
        const cached = localStorage.getItem(`user_profile_${fUser.uid}`);
        if (cached) {
          setUser(JSON.parse(cached));
          setLoading(false);
        }
        
        // Real-time listener for current user (Instant balance updates)
        unsubscribeProfile = onSnapshot(doc(db, 'users', fUser.uid), (snap) => {
          if (snap.exists()) {
            const userData = snap.data() as AppUser;
            console.log('[PROFILE] Updated:', userData.uid, 'Balance:', userData.balance);
            setUser(userData);
            localStorage.setItem(`user_profile_${fUser.uid}`, JSON.stringify(userData));
          }
          setLoading(false);
        }, (err) => {
          console.error("Profile snapshot error:", err);
          if (err.message.includes('permission-denied') || err.message.includes('Missing or insufficient permissions')) {
             // Fallback to a basic user object if rules block reading
             const cached = localStorage.getItem(`user_profile_${fUser.uid}`);
             if (cached) {
               setUser(JSON.parse(cached));
             } else {
               setUser({ uid: fUser.uid, email: fUser.email, username: fUser.email?.split('@')[0], balance: 0 } as any);
             }
          }
          setLoading(false);
        });
        
        // Sync with MySQL if enabled
        syncUser(fUser.uid, fUser.displayName || 'User', fUser.email || '').catch(() => {});
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeProfile) (unsubscribeProfile as () => void)();
    };
  }, []);

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

export default function App() {
  useEffect(() => {
    // Persist invitation code from URL if present
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invitationCode') || params.get('inviteCode');
    if (code) {
      sessionStorage.setItem('pendingInvitationCode', code);
    }

    async function testConnection() {
      try {
        // Try a simple read to check connectivity
        await getDoc(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error?.message?.includes('the client is offline')) {
          console.warn("Firestore client is offline. This might be temporary in dev environments.");
        } else if (error?.code === 'not-found' || error?.message?.includes('NOT_FOUND')) {
          // Document not found is fine, connectivty works
        } else {
          console.error("Firestore connectivity check error:", error);
        }
      }
    }
    testConnection();
  }, []);

  return (
    <AuthProvider>
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

