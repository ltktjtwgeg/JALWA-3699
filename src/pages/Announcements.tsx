import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Megaphone } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: any;
}

export default function Announcements() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(20));
      try {
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as any)
        })) as Announcement[];
        setAnnouncements(data);
      } catch (e) {
        console.error("Announcements fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Announcement</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-500 text-sm">Loading announcements...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Megaphone className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-[#2a2e35] rounded-2xl border border-gray-800"
              >
                <h3 className="font-bold text-purple-400 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.content}</p>
                <p className="text-[10px] text-gray-600 mt-3">
                  {item.createdAt?.toDate().toLocaleString()}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
