/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { StrictMode, useEffect, useState, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User as AppUser } from './types';
import './index.css';

// Pages
import Home from './pages/Home';
import GamePage from './pages/GamePage';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Wallet from './pages/Wallet';
import Admin from './pages/Admin';
import History from './pages/History';
import Promotion from './pages/Promotion';

const AuthContext = createContext<{
  user: AppUser | null;
  loading: boolean;
  firebaseUser: FirebaseUser | null;
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
      const unsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), (doc) => {
        if (doc.exists()) {
          setUser(doc.data() as AppUser);
        }
      });
      return () => unsubscribe();
    }
  }, [firebaseUser]);

  return (
    <AuthContext.Provider value={{ user, loading, firebaseUser }}>
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

    const interval = setInterval(() => {
      ['30s', '1m', '3m', '5m'].forEach(async (type) => {
        try {
          await processGameResults(type as any);
          await settleUserBets(firebaseUser.uid, type as any);
        } catch (error) {
          console.error(`Error in GameManager for ${type}:`, error);
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [firebaseUser]);

  return null;
}

export default function App() {
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
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
      <div className="min-h-screen bg-[#1a1d21] text-white font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/game/:type" element={<PrivateRoute><GamePage /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/wallet" element={<PrivateRoute><Wallet /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
            <Route path="/history/:type" element={<PrivateRoute><History /></PrivateRoute>} />
            <Route path="/promotion" element={<PrivateRoute><Promotion /></PrivateRoute>} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </div>
    </AuthProvider>
  );
}

