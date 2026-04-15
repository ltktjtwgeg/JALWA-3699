import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Trophy, History, ShieldCheck, Bell, ChevronRight, RefreshCw, Gift, Download, Globe, Plus, PlayCircle, Gamepad2, LayoutGrid, ChevronLeft, Flame, Target, Rocket } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('popular');
  const [currentBanner, setCurrentBanner] = useState(0);

  const banners = [
    { id: 1, image: '/images/slider_banner/banner1.png', fallback: 'https://picsum.photos/seed/banner1/800/400' },
    { id: 2, image: '/images/slider_banner/banner2.png', fallback: 'https://picsum.photos/seed/banner2/800/400' },
    { id: 3, image: '/images/slider_banner/banner3.png', fallback: 'https://picsum.photos/seed/banner3/800/400' },
    { id: 4, image: '/images/slider_banner/banner4.png', fallback: 'https://picsum.photos/seed/banner4/800/400' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const gameModes = [
    { id: '1m', name: 'Wingo 1M', time: '1 Min', color: 'bg-rose-600', image: '/images/wingo_game/logo.png', fallback: 'https://picsum.photos/seed/wingo1m/200/200', category: 'popular' },
    { id: '30s', name: 'Wingo 30s', time: '30 Sec', color: 'bg-rose-500', image: '/images/wingo_game/logo.png', fallback: 'https://picsum.photos/seed/wingo30/200/200', category: 'lottery' },
    { id: '1m_lottery', id_real: '1m', name: 'Wingo 1M', time: '1 Min', color: 'bg-rose-600', image: '/images/wingo_game/logo.png', fallback: 'https://picsum.photos/seed/wingo1m/200/200', category: 'lottery' },
    { id: '3m', name: 'Wingo 3M', time: '3 Min', color: 'bg-rose-700', image: '/images/wingo_game/logo.png', fallback: 'https://picsum.photos/seed/wingo3m/200/200', category: 'lottery' },
    { id: '5m', name: 'Wingo 5M', time: '5 Min', color: 'bg-rose-800', image: '/images/wingo_game/logo.png', fallback: 'https://picsum.photos/seed/wingo5m/200/200', category: 'lottery' },
  ];

  const categories = [
    { id: 'popular', name: 'Popular', icon: Flame },
    { id: 'lottery', name: 'Lottery', icon: Target },
    { id: 'mini', name: 'Mini games', icon: Rocket, badge: 'Upcoming' },
  ];

  const lotteryGames = [
    { id: '1m', name: 'Win Go', color: 'from-[#b349ff] to-[#4d39ff]', image: 'https://picsum.photos/seed/wingo/200/200', fallback: 'https://picsum.photos/seed/wingo/200/200' },
    { id: 'k3', name: 'K3', color: 'from-[#b349ff] to-[#4d39ff]', image: 'https://picsum.photos/seed/k3/200/200', fallback: 'https://picsum.photos/seed/k3/200/200', isUpcoming: true },
    { id: '5d', name: '5D', color: 'from-[#b349ff] to-[#4d39ff]', image: 'https://picsum.photos/seed/5d/200/200', fallback: 'https://picsum.photos/seed/5d/200/200', isUpcoming: true },
    { id: 'trx', name: 'Trx Wingo', color: 'from-[#b349ff] to-[#4d39ff]', image: 'https://picsum.photos/seed/trx/200/200', fallback: 'https://picsum.photos/seed/trx/200/200', isUpcoming: true },
    { id: 'moto', name: 'Moto Racing', color: 'from-[#b349ff] to-[#4d39ff]', image: 'https://picsum.photos/seed/moto/200/200', fallback: 'https://picsum.photos/seed/moto/200/200', isUpcoming: true },
  ];

  const filteredGames = activeCategory === 'lottery' 
    ? lotteryGames 
    : gameModes.filter(game => game.category === activeCategory);

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="bg-[#2a2e35] p-3 flex items-center justify-between sticky top-0 z-50 border-b border-gray-800">
        <div className="flex items-center gap-2 bg-indigo-900/40 px-3 py-1.5 rounded-full border border-white/10">
          <span className="text-yellow-400 font-bold text-xs">₹{user?.balance.toFixed(2)}</span>
          <button onClick={() => navigate('/wallet')} className="bg-yellow-500 rounded-full p-0.5">
            <Plus className="w-3 h-3 text-black" />
          </button>
        </div>
        
        <img 
          src="/images/logo/logo_new.png" 
          alt="Logo" 
          className="h-7 object-contain" 
          referrerPolicy="no-referrer"
        />

        <div className="flex items-center gap-3">
          <Download className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Banner Slider */}
      <div className="p-3">
        <div className="relative h-40 bg-[#2a2e35] rounded-2xl overflow-hidden shadow-2xl border border-white/5">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentBanner}
              src={banners[currentBanner].image}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full object-cover"
              onError={(e) => e.currentTarget.src = banners[currentBanner].fallback}
            />
          </AnimatePresence>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  currentBanner === idx ? "bg-white w-4" : "bg-white/30"
                )} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Announcement */}
      <div className="px-4 mb-6">
        <div className="bg-[#2a2e35]/50 p-2.5 rounded-xl flex items-center gap-3 border border-gray-800">
          <Bell className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="flex-1 overflow-hidden">
            <p className="text-[10px] text-gray-400 whitespace-nowrap animate-marquee font-medium">
              Welcome to JALWA 369! Join the referral program and earn up to ₹300,000. New games added weekly!
            </p>
          </div>
          <button className="text-[10px] font-bold text-white bg-purple-600 px-3 py-1 rounded-full shadow-lg shadow-purple-600/20">
            Detail
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="px-3 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button 
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap relative",
              activeCategory === cat.id 
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 border-transparent shadow-lg shadow-indigo-600/20" 
                : "bg-[#2a2e35] border-gray-800 text-gray-400"
            )}
          >
            <cat.icon className={cn("w-4 h-4", activeCategory === cat.id ? "text-white" : "text-gray-500")} />
            <span className="text-xs font-bold uppercase tracking-wide">{cat.name}</span>
            {cat.badge && (
              <span className="absolute -top-2 -right-1 bg-rose-500 text-[8px] px-1.5 py-0.5 rounded-full text-white font-black animate-pulse">
                {cat.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Game Grid */}
      <div className="px-3 space-y-3">
        <div className="flex justify-between items-center px-1">
           <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <div className="w-1 h-4 bg-purple-500 rounded-full" />
              {categories.find(c => c.id === activeCategory)?.name}
           </h3>
           <button className="text-[10px] font-bold text-gray-500 flex items-center gap-1 uppercase tracking-tighter">
              {activeCategory === 'lottery' ? 'ALL' : 'All'} <ChevronRight className="w-3 h-3" />
           </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {activeCategory === 'lottery' ? (
            filteredGames.map((game) => (
              <motion.div
                key={game.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/game/${game.id === '1m' ? '1m' : '1m'}`)} // Defaulting to 1m for demo
                className="flex flex-col gap-2"
              >
                <div className={cn(
                  "aspect-[4/5] rounded-2xl p-2 flex flex-col items-center justify-between relative overflow-hidden shadow-xl border border-white/5 bg-[#1f2228]",
                )}>
                  {/* Ticket Background Image */}
                  <img 
                    src="/images/backgrounds/ticket_bg.png" 
                    className="absolute inset-0 h-full w-full object-fill opacity-40"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Color Overlay */}
                  <div className={cn("absolute inset-0 -z-10 opacity-60 bg-gradient-to-br", game.color)} />

                  {/* Upcoming Overlay */}
                  {game.isUpcoming && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                      <div className="bg-rose-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full text-white rotate-[-15deg] shadow-lg border border-white/20">
                        Upcoming
                      </div>
                    </div>
                  )}
                  
                  {/* Ticket Cutouts */}
                  <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-[#1a1d21] rounded-full" />
                  <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-[#1a1d21] rounded-full" />
                  
                  <h4 className="text-[10px] font-bold uppercase tracking-tighter text-white/90">{game.name}</h4>
                  
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <img src={game.image} alt={game.name} className="w-8 h-8 object-contain" />
                  </div>

                  <div className="w-full bg-black/20 backdrop-blur-sm py-1 rounded-full text-center border border-white/10">
                    <span className="text-[8px] font-black uppercase tracking-widest">Bet Now</span>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            filteredGames.map((mode) => (
              <motion.div
                key={mode.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/game/${(mode as any).id_real || mode.id}`)}
                className="flex flex-col gap-2"
              >
                <div className={cn("aspect-square rounded-2xl overflow-hidden relative shadow-xl border border-white/5", mode.color)}>
                  <img 
                    src={mode.image} 
                    alt={mode.name} 
                    className="w-full h-full object-cover mix-blend-overlay opacity-80" 
                    onError={(e) => e.currentTarget.src = mode.fallback}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                     <h4 className="text-[10px] font-black tracking-tighter uppercase italic">{mode.name}</h4>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-3 mt-6 grid grid-cols-2 gap-3">
        <button className="bg-[#2a2e35] p-4 rounded-2xl flex items-center gap-3 border border-gray-800 hover:bg-gray-800 transition-colors">
          <div className="bg-blue-500/20 p-2 rounded-xl">
            <History className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold">Game History</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-tighter">View results</p>
          </div>
        </button>
        <button 
          onClick={() => navigate('/settings')}
          className="bg-[#2a2e35] p-4 rounded-2xl flex items-center gap-3 border border-gray-800 hover:bg-gray-800 transition-colors"
        >
          <div className="bg-emerald-500/20 p-2 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold">Security</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Account safety</p>
          </div>
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
