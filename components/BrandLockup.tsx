import React from 'react';
import { HeartPulse } from 'lucide-react';

interface BrandLockupProps {
  compact?: boolean;
  className?: string;
}

export const BrandLockup: React.FC<BrandLockupProps> = ({ compact = false, className = '' }) => (
  <div className={`flex items-center gap-3 ${className}`} aria-label="Conecta Saude Olinda">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B60C9] text-white shadow-[0_8px_20px_rgba(6,41,111,0.14)]">
      <HeartPulse className="h-6 w-6" />
    </div>
    <div className="leading-none">
      <p className={`${compact ? 'text-base' : 'text-lg'} font-black uppercase tracking-normal text-[#06296F]`}>Conecta Saude</p>
      <p className={`${compact ? 'text-[10px]' : 'text-xs'} mt-1 font-black uppercase tracking-normal text-[#048C47]`}>Olinda</p>
    </div>
  </div>
);
