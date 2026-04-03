import React from 'react';
import { Mail, MessageCircle } from 'lucide-react';
import { ServiceType } from '@/types/risk';

export function ServiceIcon({ service, className = '' }: { service: ServiceType; className?: string }) {
  // Brand colors for standard icons
  const iconProps = { className: `w-5 h-5 ${className}` };

  switch (service) {
    case 'gmail':
      return <Mail {...iconProps} className={`${iconProps.className} text-red-500`} />;
    case 'slack':
      return <MessageCircle {...iconProps} className={`${iconProps.className} text-purple-500`} />;
    default:
      return <div className={`w-5 h-5 bg-surface-300 rounded ${className}`} />;
  }
}
