import React from 'react';
import { cn } from '../lib/utils';

interface GameBallProps {
  number: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function GameBall({ number, size = 'md', className }: GameBallProps) {
  const [imgError, setImgError] = React.useState(false);
  const isGreen = [1, 3, 7, 9].includes(number);
  const isRed = [2, 4, 6, 8].includes(number);
  const isMixed0 = number === 0; // Red + Purple
  const isMixed5 = number === 5; // Green + Purple

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-12 h-12 text-base',
    lg: 'w-14 h-14 text-xl',
    xl: 'w-20 h-20 text-3xl',
  };

  const getBallStyle = () => {
    if (isMixed0) {
      return 'bg-[linear-gradient(135deg,#f43f5e_50%,#a855f7_50%)]';
    }
    if (isMixed5) {
      return 'bg-[linear-gradient(135deg,#10b981_50%,#a855f7_50%)]';
    }
    if (isGreen) return 'bg-gradient-to-br from-emerald-400 to-emerald-600';
    if (isRed) return 'bg-gradient-to-br from-rose-400 to-rose-600';
    return 'bg-gray-500';
  };

  const getNumberColor = () => {
    if (isMixed0) return 'text-rose-600';
    if (isMixed5) return 'text-emerald-600';
    if (isGreen) return 'text-emerald-700';
    if (isRed) return 'text-rose-700';
    return 'text-white';
  };

  return (
    <div className={cn(
      "relative rounded-full flex items-center justify-center shadow-lg overflow-hidden",
      !imgError ? "" : getBallStyle(),
      sizeClasses[size],
      className
    )}>
      {!imgError ? (
        <img 
          src={`/images/numbers/${number}.png`} 
          alt={number.toString()} 
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <>
          {/* Polka dots / Highlights */}
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[60%] h-[20%] bg-white/30 rounded-full blur-[1px]" />
          <div className="absolute bottom-[-5%] left-1/2 -translate-x-1/2 w-[40%] h-[15%] bg-white/20 rounded-full blur-[1px]" />
          <div className="absolute left-[-10%] top-1/2 -translate-y-1/2 w-[20%] h-[40%] bg-white/20 rounded-full blur-[1px]" />
          <div className="absolute right-[-10%] top-1/2 -translate-y-1/2 w-[20%] h-[40%] bg-white/20 rounded-full blur-[1px]" />
          
          {/* Inner White Circle */}
          <div className="absolute inset-[15%] bg-white rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center">
            <span className={cn("font-black italic", getNumberColor())}>
              {number}
            </span>
          </div>
          
          {/* Glossy Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30 pointer-events-none" />
        </>
      )}
    </div>
  );
}
