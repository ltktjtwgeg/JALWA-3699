import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'sonner';

export default function Feedback() {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) {
      toast.error('Please enter your feedback');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email,
        content: feedback,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      toast.success('Feedback submitted successfully!');
      setFeedback('');
      setTimeout(() => navigate(-1), 1500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Feedback</h2>
        <div className="w-10" />
      </div>

      <div className="p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#2a2e35] rounded-3xl p-6 border border-gray-800 shadow-xl"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-purple-500/20 p-3 rounded-2xl">
              <MessageSquare className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Send Feedback</h3>
              <p className="text-xs text-gray-500">We value your suggestions</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                Your Message
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="How can we improve JALWA 369?"
                className="w-full h-40 bg-[#1a1d21] border border-gray-800 rounded-2xl p-4 text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full font-bold shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Feedback
                </>
              )}
            </button>
          </form>
        </motion.div>

        <div className="mt-8 p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10">
          <h4 className="text-sm font-bold text-indigo-400 mb-2">Why Feedback Matters?</h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your feedback helps us build a better experience for everyone. Whether it's a bug report, a feature request, or general praise, we read every message.
          </p>
        </div>
      </div>
    </div>
  );
}
