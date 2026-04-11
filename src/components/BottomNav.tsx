import { NavLink } from 'react-router-dom';
import { Home, Trophy, Share2, Wallet, User } from 'lucide-react';
import { cn } from '../lib/utils';

export default function BottomNav() {
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Trophy, label: 'Activity', path: '/activity' },
    { icon: Share2, label: 'Promotion', path: '/promotion' },
    { icon: Wallet, label: 'Wallet', path: '/wallet' },
    { icon: User, label: 'Account', path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#1f2228] border-t border-gray-800 px-2 py-2 flex justify-around items-center z-50">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[64px]",
              isActive ? "text-purple-500 bg-purple-500/10" : "text-gray-500 hover:text-gray-300"
            )
          }
        >
          <item.icon className="w-6 h-6" />
          <span className="text-[10px] font-medium">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}
