import React from 'react';
import { HeartPulse } from 'lucide-react';

interface BrandLockupProps {
  compact?: boolean;
  light?: boolean;
  className?: string;
}

export const BrandLockup: React.FC<BrandLockupProps> = ({ compact = false, light = false, className = '' }) => (
  <span
    className={`brand-lockup${compact ? ' brand-compact' : ''}${light ? ' brand-lockup-light' : ''} ${className}`}
    aria-label="Conecta Saúde Olinda"
  >
    <span className="brand-symbol">
      <HeartPulse aria-hidden="true" />
    </span>
    <span className="brand-copy">
      <strong>Conecta Saúde</strong>
      <small>Olinda</small>
    </span>
  </span>
);
