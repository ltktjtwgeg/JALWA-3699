import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, runTransaction, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toast } from 'sonner';
import { Phone, Lock, Eye, EyeOff, UserPlus, Ticket } from 'lucide-react';
import { motion } from 'motion/react';

export default function Register() {
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(searchParams.get('invitationCode') || '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const ref = searchParams.get('invitationCode');
    if (ref) {
      setInviteCode(ref);
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password || !confirmPassword) return toast.error('Please fill all fields');
    if (password !== confirmPassword) return toast.error('Passwords do not match');
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    
    setLoading(true);
    try {
      const email = `${phone}@colorprediction.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Use a transaction to get the next sequential UID
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'metadata', 'counters');
        const counterDoc = await transaction.get(counterRef);
        
        let nextUid = 251500;
        if (counterDoc.exists()) {
          nextUid = counterDoc.data().lastUid + 1;
        }
        
        transaction.set(counterRef, { lastUid: nextUid }, { merge: true });
        
        const numericUid = nextUid.toString();
        
        const userRef = doc(db, 'users', user.uid);
        transaction.set(userRef, {
          uid: user.uid,
          numericId: nextUid, // Store the numeric ID separately
          phoneNumber: phone,
          username: `MEMBER${numericUid}`,
          balance: 0,
          vipLevel: 0,
          inviteCode: numericUid,
          invitedBy: inviteCode || null,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          role: 'user'
        });
      });

      toast.success('Registration successful!');
      navigate('/');
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Email/Password login is not enabled in Firebase Console. Please enable it in the Auth section.');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('This phone number is already registered.');
      } else {
        toast.error(error.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-6 bg-[#1a1d21]">
      <div className="flex flex-col items-center mt-8 mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
          <span className="text-2xl font-bold text-white">369</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Create Account</h1>
        <p className="text-gray-400 text-sm">Join JALWA 369 today</p>
      </div>

      <motion.form 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        onSubmit={handleRegister} 
        className="space-y-5"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300 ml-1">Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="tel"
              placeholder="Enter phone number"
              className="w-full bg-[#2a2e35] border-none rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300 ml-1">Set Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter password"
              className="w-full bg-[#2a2e35] border-none rounded-xl py-4 pl-12 pr-12 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300 ml-1">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              className="w-full bg-[#2a2e35] border-none rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300 ml-1">Invite Code (Optional)</label>
          <div className="relative">
            <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Enter invitation code"
              className="w-full bg-[#2a2e35] border-none rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-start gap-2 px-1">
          <input type="checkbox" id="terms" className="mt-1 accent-purple-600" required />
          <label htmlFor="terms" className="text-xs text-gray-400 leading-relaxed">
            I have read and agree to the <span className="text-purple-400">Privacy Agreement</span> and <span className="text-purple-400">Terms of Service</span>.
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Creating Account...' : (
            <>
              Register <UserPlus className="w-5 h-5" />
            </>
          )}
        </button>
      </motion.form>

      <div className="mt-8 text-center">
        <p className="text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-purple-400 font-bold hover:text-purple-300">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
