import { NavLink } from 'react-router-dom';
import { Home, Trophy, Share2, Wallet, User, Gem } from 'lucide-react';
import { cn } from '../lib/utils';

export default function BottomNav() {
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Trophy, label: 'Activity', path: '/activity' },
    { icon: Gem, label: 'Promotion', path: '/promotion', special: true },
    { icon: Wallet, label: 'Wallet', path: '/wallet' },
    { icon: User, label: 'Account', path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-[#1f2228] border-t border-gray-800 px-2 py-2 flex justify-around items-end z-50 h-20">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 p-2 transition-all min-w-[64px] relative",
              item.special ? "mb-4" : "mb-1",
              isActive && !item.special ? "text-purple-500" : "text-gray-500 hover:text-gray-300"
            )
          }
        >
          {item.special ? (
            <div className="flex flex-col items-center">
               <div className="w-14 h-14 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/40 border-4 border-[#1f2228] -mt-8 relative z-10">
                  <item.icon className="w-8 h-8 text-white" />
               </div>
               <span className={cn("text-[10px] font-bold mt-1 uppercase tracking-tighter")}>
                  {item.label}
               </span>
            </div>
          ) : (
            <>
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}
