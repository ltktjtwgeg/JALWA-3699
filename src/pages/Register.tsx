import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toast } from 'sonner';
import { Mail, Phone, Lock, Eye, EyeOff, UserPlus, Ticket, ChevronLeft, Globe } from 'lucide-react';
import { motion } from 'motion/react';

export default function Register() {
  const [searchParams] = useSearchParams();
  const [registerMethod, setRegisterMethod] = useState<'phone' | 'email'>('phone');
  const [email, setEmail] = useState('');
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
    const identifier = registerMethod === 'email' ? email : phone;
    if (!identifier || !password || !confirmPassword) return toast.error('Please fill all fields');
    if (registerMethod === 'phone' && (identifier.length < 10 || identifier.length > 15)) return toast.error('Phone number must be between 10 and 15 digits');
    if (password !== confirmPassword) return toast.error('Passwords do not match');
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    
    setLoading(true);
    try {
      // For phone registration, we create a dummy email to use Firebase Email/Password Auth
      const authEmail = registerMethod === 'email' ? email : `${phone}@jalwa369.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
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
          numericId: nextUid,
          email: registerMethod === 'email' ? email : null,
          phoneNumber: registerMethod === 'phone' ? phone : null,
          username: `MEMBER${numericUid}`,
          nickname: `MEMBER${numericUid}`,
          avatarUrl: '/images/avatars/1.png',
          balance: 0,
          totalDeposits: 0,
          totalBets: 0,
          vipLevel: 0,
          inviteCode: numericUid,
          invitedBy: inviteCode || null,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          role: 'user',
          isDemo: false
        });
      });

      // Sign out immediately after registration so they have to login manually
      await signOut(auth);
      toast.success('Registration successful! Please login to continue.');
      navigate('/login');
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Email/Password login is not enabled in Firebase Console.');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error(registerMethod === 'email' ? 'This email is already registered.' : 'This phone number is already registered.');
      } else {
        toast.error(error.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21]">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-4 pb-12">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="p-2 text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1 rounded-lg backdrop-blur-md">
              <img 
                src="/images/logo/logo.png" 
                alt="Logo" 
                className="h-10 object-contain" 
                onError={(e) => {
                  e.currentTarget.src = "https://picsum.photos/seed/logo/200/200";
                }}
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="text-white font-black italic text-xl tracking-tighter">JALWA 369</span>
          </div>
        </div>
        
        <div className="px-2">
          <h1 className="text-xl font-bold text-white mb-1">Register</h1>
          <p className="text-white/70 text-xs">Please register by phone number or email</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-[#1a1d21] -mt-6 rounded-t-[32px] p-6 shadow-2xl">
        {/* Tabs */}
        <div className="flex bg-[#2a2e35] rounded-2xl p-1 mb-8 border border-gray-800">
          <button 
            onClick={() => setRegisterMethod('phone')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${registerMethod === 'phone' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500'}`}
          >
            <Phone className="w-4 h-4" />
            Phone Register
          </button>
          <button 
            onClick={() => setRegisterMethod('email')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${registerMethod === 'email' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500'}`}
          >
            <Mail className="w-4 h-4" />
            Email Register
          </button>
        </div>

        <motion.form 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleRegister} 
          className="space-y-6"
        >
          {registerMethod === 'phone' ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 flex items-center gap-2 ml-1">
                <Phone className="w-3 h-3 text-purple-500" />
                Phone number
              </label>
              <div className="flex gap-2">
                <div className="bg-[#2a2e35] rounded-xl px-4 py-4 flex items-center gap-2 border border-gray-800 text-white font-bold text-sm">
                  +91 <span className="text-gray-600">|</span>
                </div>
                <input
                  type="tel"
                  maxLength={15}
                  placeholder="Please enter the phone number"
                  className="flex-1 bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-white placeholder:text-gray-600 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-sm"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 15) {
                      setPhone(val);
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 flex items-center gap-2 ml-1">
                <Mail className="w-3 h-3 text-purple-500" />
                Email
              </label>
              <input
                type="email"
                placeholder="Please enter the email"
                className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-white placeholder:text-gray-600 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-2 ml-1">
              <Lock className="w-3 h-3 text-purple-500" />
              Set password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Set password"
                className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-white placeholder:text-gray-600 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-2 ml-1">
              <Lock className="w-3 h-3 text-purple-500" />
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-white placeholder:text-gray-600 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-2 ml-1">
              <Ticket className="w-3 h-3 text-purple-500" />
              Invite code
            </label>
            <input
              type="text"
              placeholder="Enter invitation code"
              className="w-full bg-[#2a2e35] border border-gray-800 rounded-xl py-4 px-4 text-white placeholder:text-gray-600 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-sm"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 px-1">
            <input type="checkbox" id="terms" className="accent-purple-600 w-4 h-4" required />
            <label htmlFor="terms" className="text-[10px] text-gray-400">
              I have read and agree <span className="text-rose-500">【Privacy Agreement】</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white font-bold py-4 rounded-full shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full py-4 rounded-full border border-gray-800 text-gray-400 font-bold hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm"
          >
            I have an account <span className="text-purple-400">Login</span>
          </button>
        </motion.form>
      </div>
    </div>
  );
}
