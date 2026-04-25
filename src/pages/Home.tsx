import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Trophy, History, ShieldCheck, Bell, ChevronRight, RefreshCw, Gift, Download, Globe, Plus, PlayCircle, Gamepad2, LayoutGrid, ChevronLeft, Flame, Target, Rocket, X, Check, Users } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';
import { getSystemSettings, SystemSettings } from '../services/adminService';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('popular');
  const [currentBanner, setCurrentBanner] = useState(0);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    getSystemSettings().then(setSettings);
  }, []);

  const banners = settings?.banners || [
    { id: '1', image: '/images/slider_banner/banner1.png' },
    { id: '2', image: '/images/slider_banner/custom_banner_1.png' },
    { id: '3', image: '/images/slider_banner/custom_banner_2.png' },
    { id: '4', image: '/images/slider_banner/custom_banner_3.png' },
  ];

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const gameModes = [
    { id: 'mines', name: 'Mines', type: 'mines', color: 'bg-indigo-600', image: 'https://cdn-icons-png.flaticon.com/512/3593/3593441.png', fallback: 'https://picsum.photos/seed/mines/200/200', category: 'popular' },
    { id: 'wingo', name: 'WinGo', color: 'bg-orange-600', image: 'https://cdn-icons-png.flaticon.com/512/2858/2858908.png', fallback: 'https://picsum.photos/seed/bingo/200/200', category: 'popular' },
    { id: 'roulette', name: 'Roulette', color: 'bg-emerald-600', image: 'https://cdn-icons-png.flaticon.com/512/10512/10512739.png', fallback: 'https://picsum.photos/seed/roulette/200/200', category: 'popular' },
    { id: 'mines_mini', id_real: 'mines', name: 'Mines', type: 'mines', color: 'bg-indigo-600', image: 'https://cdn-icons-png.flaticon.com/512/3593/3593441.png', fallback: 'https://picsum.photos/seed/mines/200/200', category: 'mini' },
  ];

  interface Category {
    id: string;
    name: string;
    icon: any;
    badge?: string;
  }

  const categories: Category[] = [
    { id: 'popular', name: 'Popular', icon: Flame },
    { id: 'lottery', name: 'Lottery', icon: Target },
    { id: 'mini', name: 'Mini games', icon: Rocket },
  ];

  const lotteryGames = [
    { id: '1m', name: 'Win Go', color: 'from-[#b349ff] to-[#4d39ff]', image: 'https://picsum.photos/seed/wingo/200/200', fallback: 'https://picsum.photos/seed/wingo/200/200' },
    { id: 'k3', name: 'K3', color: 'from-[#b349ff] to-[#4d39ff]', image: 'https://picsum.photos/seed/k3/200/200', fallback: 'https://picsum.photos/seed/k3/200/200', isUpcoming: true },
    { id: '5d', name: '5D', color: 'from-[#b349ff] to-[#4d39ff]', image: 'https://picsum.photos/seed/5d/200/200', fallback: 'https://picsum.photos/seed/5d/200/200', isUpcoming: true },
    { id: 'trx', name: 'Trx Wingo', color: 'from-[#b349ff] to-[#4d39ff]', image: 'https://picsum.photos/seed/trx/200/200', fallback: 'https://picsum.photos/seed/trx/200/200', isUpcoming: true },
  ];

  const [showBonusPopup, setShowBonusPopup] = useState(false);
  const [noMoreToday, setNoMoreToday] = useState(false);

  useEffect(() => {
    if (settings?.showPopup === false) {
      setShowBonusPopup(false);
      return;
    }

    const sessionHidden = sessionStorage.getItem('bonus_popup_shown_session');
    
    if (!sessionHidden) {
      setShowBonusPopup(true);
      sessionStorage.setItem('bonus_popup_shown_session', 'true');
    }
  }, [settings?.showPopup]);

  const handleBonusPopupClose = () => {
    setShowBonusPopup(false);
  };

  const getIsUpcoming = (gameId: string, defaultStatus: boolean = false) => {
    if (!settings) return defaultStatus;
    // If the game status is explicitly set to false by admin, it is upcoming (off)
    return settings.gameStatuses?.[gameId] === false;
  };

  const dynamicGameModes = gameModes.map(game => ({
    ...game,
    isUpcoming: getIsUpcoming(game.id, (game as any).isUpcoming)
  }));

  const dynamicLotteryGames = lotteryGames.map(game => ({
    ...game,
    isUpcoming: getIsUpcoming(game.id, game.isUpcoming)
  }));

  const filteredGames = activeCategory === 'lottery' 
    ? dynamicLotteryGames 
    : dynamicGameModes.filter(game => game.category === activeCategory);

  const handleGameClick = (game: any) => {
    if (game.isUpcoming) return; // Prevent clicking upcoming games
    
    // Check if it's a mines game by ID or type
    if (game.id === 'mines' || game.id === 'mines_mini' || game.type === 'mines') {
       navigate('/mines');
    } else if (game.id === 'roulette') {
       navigate('/roulette');
    } else if (game.id === 'wingo') {
       // Since it's WinGo, maybe it should go to a specific WinGo page? 
       // For now, let's treat it as the 1m WinGo.
       navigate('/game/1m');
    } else {
       navigate(`/game/${game.id_real || game.id}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="bg-[#2a2e35] p-3 flex items-center justify-between sticky top-0 z-50 border-b border-gray-800">
        <div className="flex items-center gap-2 bg-indigo-900/40 px-3 py-1.5 rounded-full border border-white/10">
          <span className="text-yellow-400 font-bold text-xs">₹{user?.balance.toFixed(2)}</span>
          <button onClick={() => navigate('/deposit')} className="bg-yellow-500 rounded-full p-0.5">
            <Plus className="w-3 h-3 text-black" />
          </button>
        </div>
        
        <img 
          src="/images/logo/logo.png" 
          alt="Logo" 
          className="h-10 object-contain" 
          onError={(e) => {
            e.currentTarget.src = "https://picsum.photos/seed/logo/200/200";
          }}
          referrerPolicy="no-referrer"
        />

        <div className="flex items-center gap-3">
          <a 
            href="https://t.me/JALWA369official/21" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center p-1 hover:bg-white/10 rounded-full transition-colors"
            title="Download App"
          >
            <Download className="w-5 h-5 text-gray-400" />
          </a>
        </div>
      </div>

      {/* Banner Slider */}
      <div className="p-3 pt-10">
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
                onClick={() => handleGameClick(game)}
                className="flex flex-col gap-2"
              >
                <div className={cn(
                  "aspect-[4/5] rounded-2xl p-2 flex flex-col items-center justify-between relative overflow-hidden shadow-xl border border-white/5 bg-[#1f2228]",
                )}>
                  {/* Ticket Background Image */}
                  <img 
                    src="/images/backgrounds/ticket_bg.png" 
                    className="absolute inset-0 h-full w-full object-fill opacity-40"
                    onError={(e) => {
                      e.currentTarget.src = "/images/backgrounds/game_top_bg.jpg";
                    }}
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
                onClick={() => handleGameClick(mode)}
                className="flex flex-col gap-2"
              >
                <div className={cn("aspect-square rounded-2xl overflow-hidden relative shadow-xl border border-white/5", mode.color)}>
                  {/* Upcoming Overlay */}
                  {mode.isUpcoming && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                      <div className="bg-rose-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full text-white rotate-[-15deg] shadow-lg border border-white/20">
                        Upcoming
                      </div>
                    </div>
                  )}
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

      <BottomNav />
      {/* Bonus Popup */}
      <AnimatePresence>
        {showBonusPopup && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="w-full max-w-sm bg-[#322c5c] rounded-[32px] overflow-hidden shadow-2xl relative"
            >
              {settings?.popupBannerUrl ? (
                <div className="relative">
                  <img 
                    src={settings.popupBannerUrl} 
                    alt="Promotion" 
                    className="w-full object-contain"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                  <button 
                    onClick={handleBonusPopupClose}
                    className="absolute top-4 right-4 p-1 bg-black/40 hover:bg-black/60 rounded-full transition-colors z-10"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                  <div className="p-4 bg-[#322c5c] flex justify-between items-center">
                    <div 
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setNoMoreToday(!noMoreToday)}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        noMoreToday ? "border-emerald-500 bg-emerald-500" : "border-white/30"
                      )}>
                        {noMoreToday && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-tight">No reminders today</span>
                    </div>
                    <button 
                      onClick={() => { navigate('/activity'); handleBonusPopupClose(); }}
                      className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[11px] font-black px-6 py-2 rounded-full uppercase tracking-widest shadow-lg"
                    >
                      Activity
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="bg-[#b191ff] p-5 text-center relative">
                <h2 className="text-white font-black text-lg italic uppercase tracking-widest">Extra first deposit bonus</h2>
                <p className="text-[10px] text-white/80 font-bold mt-1 uppercase tracking-tighter">Each account can only receive rewards once</p>
                <button 
                  onClick={handleBonusPopupClose}
                  className="absolute top-4 right-4 p-1 hover:bg-black/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Bonus Items */}
              <div className="p-4 pt-2 space-y-3">
                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">First Deposit Bonuses</h3>
                {[
                  { amount: 100, bonus: 18 },
                  { amount: 300, bonus: 28 },
                  { amount: 500, bonus: 108 },
                  { amount: 1000, bonus: 188 },
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#413b7a] rounded-2xl p-4 border border-white/5 relative group">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-black text-white italic">First deposit{item.amount}</h4>
                      <span className="text-orange-400 font-bold text-xs">+ ₹{item.bonus}.00</span>
                    </div>
                    <p className="text-[10px] text-white/50 leading-tight mb-3">
                      Deposit {item.amount} for the first time and you will receive {item.bonus} bonus
                    </p>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-6 bg-white/10 rounded-full relative overflow-hidden border border-white/10 shadow-inner">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/30 z-10">0/{item.amount}</div>
                        <div 
                           className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full opacity-30 shadow-lg"
                           style={{ width: '0%' }}
                        />
                      </div>
                      <button 
                         onClick={() => { navigate('/deposit'); handleBonusPopupClose(); }}
                         className="bg-[#6b58ce] hover:bg-[#7d68e0] text-orange-400 text-[11px] font-black px-5 py-1.5 rounded-xl border border-white/10 shadow-lg active:scale-95 transition-all uppercase tracking-widest"
                      >
                         Deposit
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-2 flex items-center justify-between">
                <div 
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => setNoMoreToday(!noMoreToday)}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    noMoreToday ? "border-emerald-500 bg-emerald-500" : "border-white/30"
                  )}>
                    {noMoreToday && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className="text-[10px] font-bold text-white/50 group-hover:text-white/80 transition-colors uppercase tracking-tight">No more reminders today</span>
                </div>
                
                <button 
                  onClick={() => { navigate('/activity'); handleBonusPopupClose(); }}
                  className="bg-gradient-to-r from-[#ff6b95] to-[#7d68e0] text-white text-[11px] font-black px-6 py-2.5 rounded-full shadow-xl shadow-purple-900/40 active:scale-95 transition-all uppercase tracking-widest"
                >
                  Activity
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
</div>
);
}
