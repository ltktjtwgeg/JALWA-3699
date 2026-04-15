import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Camera, 
  User as UserIcon, 
  Lock, 
  Mail, 
  Info, 
  Copy,
  Check,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { toast } from 'sonner';

const AVATARS = [
  '/images/avatars/1.png',
  '/images/avatars/2.png',
  '/images/avatars/3.png',
  '/images/avatars/4.png',
  '/images/avatars/5.png',
  '/images/avatars/6.png',
  '/images/avatars/7.png',
  '/images/avatars/8.png',
  '/images/avatars/9.png',
  '/images/avatars/10.png',
  '/images/avatars/11.png',
  '/images/avatars/12.png',
  '/images/avatars/13.png',
  '/images/avatars/14.png',
  '/images/avatars/15.png',
  '/images/avatars/16.png',
  '/images/avatars/17.png',
  '/images/avatars/18.png',
  '/images/avatars/19.png',
  '/images/avatars/20.png',
];

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Modals
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Form States
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });

  const handleCopyUid = () => {
    if (user?.numericId) {
      navigator.clipboard.writeText(user.numericId.toString());
      toast.success('UID copied');
    }
  };

  const handleUpdateAvatar = async (url: string) => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { avatarUrl: url });
      toast.success('Avatar updated successfully');
      setShowAvatarModal(false);
    } catch (error) {
      toast.error('Failed to update avatar');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNickname = async () => {
    if (!user || !nickname.trim()) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { nickname: nickname.trim() });
      toast.success('Nickname updated successfully');
      setShowNicknameModal(false);
    } catch (error) {
      toast.error('Failed to update nickname');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!auth.currentUser || !currentPassword || !newPassword || !confirmPassword) {
      return toast.error('Please fill all fields');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match');
    }
    if (newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      toast.success('Password updated successfully');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Settings Center</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-gradient-to-br from-[#2a2e35] to-[#1f2228] rounded-[32px] p-6 border border-gray-800 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-purple-500/30 overflow-hidden">
                <img 
                  src={user?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`} 
                  alt="avatar" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button 
                onClick={() => setShowAvatarModal(true)}
                className="absolute -right-1 -bottom-1 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center border-2 border-[#1a1d21] shadow-lg"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={() => setShowAvatarModal(true)}
              className="text-xs text-gray-400 flex items-center gap-1 hover:text-white transition-colors"
            >
              Change avatar <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-6">
            <div 
              onClick={() => setShowNicknameModal(true)}
              className="flex items-center justify-between cursor-pointer group"
            >
              <span className="text-sm text-gray-400">Nickname</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-200">{user?.nickname || user?.username}</span>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">UID</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold text-gray-200">{user?.numericId}</span>
                <button onClick={handleCopyUid} className="p-1 hover:bg-white/5 rounded transition-colors">
                  <Copy className="w-4 h-4 text-purple-500" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-1 h-4 bg-purple-500 rounded-full" />
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Security information</h3>
          </div>

          <div className="bg-[#2a2e35] rounded-3xl overflow-hidden border border-gray-800">
            {/* Login Password */}
            <div 
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center justify-between p-5 hover:bg-white/5 cursor-pointer transition-colors border-b border-gray-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-sm font-medium">Login password</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Edit</span>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </div>

            {/* Bind Mailbox */}
            <div className="flex items-center justify-between p-5 hover:bg-white/5 cursor-pointer transition-colors border-b border-gray-800/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-sm font-medium">Bind mailbox</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">to bind</span>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </div>

            {/* Version */}
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <Info className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-sm font-medium">Updated version</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">1.0.9</span>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nickname Modal */}
      <AnimatePresence>
        {showNicknameModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNicknameModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#2a2e35] rounded-[32px] overflow-hidden border border-gray-800 shadow-2xl"
            >
              <div className="bg-gradient-to-r from-rose-500 to-purple-600 p-6 text-center">
                <h3 className="text-lg font-black italic">Change Nickname</h3>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <UserIcon className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Nickname</span>
                  </div>
                  <input 
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-gray-800/50 border-none rounded-2xl py-4 px-6 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter nickname"
                  />
                </div>
                <button 
                  disabled={loading}
                  onClick={handleUpdateNickname}
                  className="w-full py-4 bg-gradient-to-r from-rose-500 to-purple-600 rounded-full font-black text-white shadow-lg shadow-purple-900/20 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Confirm'}
                </button>
              </div>
              <button 
                onClick={() => setShowNicknameModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Avatar Modal */}
      <AnimatePresence>
        {showAvatarModal && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-[100] bg-[#1a1d21] flex flex-col"
          >
            <div className="p-4 flex items-center gap-4 border-b border-gray-800">
              <button onClick={() => setShowAvatarModal(false)} className="p-2 hover:bg-gray-800 rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-lg">Change avatar</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-3 gap-4">
                {AVATARS.map((url, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleUpdateAvatar(url)}
                    className={cn(
                      "relative aspect-square rounded-2xl overflow-hidden border-2 cursor-pointer transition-all hover:scale-105",
                      user?.avatarUrl === url ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-gray-800"
                    )}
                  >
                    <img src={url} alt={`avatar-${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {user?.avatarUrl === url && (
                      <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                        <div className="bg-purple-500 rounded-full p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-[100] bg-[#1a1d21] flex flex-col"
          >
            <div className="p-4 flex items-center gap-4 border-b border-gray-800">
              <button onClick={() => setShowPasswordModal(false)} className="p-2 hover:bg-gray-800 rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-lg">Change login password</h2>
            </div>
            <div className="flex-1 p-6 space-y-8">
              <div className="space-y-6">
                {/* Current Password */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <Lock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Login password</span>
                  </div>
                  <div className="relative">
                    <input 
                      type={showPass.current ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-[#2a2e35] border-none rounded-2xl py-4 px-6 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Current password"
                    />
                    <button 
                      onClick={() => setShowPass(prev => ({ ...prev, current: !prev.current }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showPass.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <Lock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">New login password</span>
                  </div>
                  <div className="relative">
                    <input 
                      type={showPass.new ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#2a2e35] border-none rounded-2xl py-4 px-6 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="New password"
                    />
                    <button 
                      onClick={() => setShowPass(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showPass.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <Lock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Confirm new password</span>
                  </div>
                  <div className="relative">
                    <input 
                      type={showPass.confirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-[#2a2e35] border-none rounded-2xl py-4 px-6 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Confirm new password"
                    />
                    <button 
                      onClick={() => setShowPass(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showPass.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button 
                disabled={loading}
                onClick={handleUpdatePassword}
                className="w-full py-4 bg-gradient-to-r from-rose-500 to-purple-600 rounded-full font-black text-white shadow-lg shadow-purple-900/20 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
