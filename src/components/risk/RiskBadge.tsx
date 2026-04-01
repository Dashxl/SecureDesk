import React from 'react';
import { RiskLevel } from '@/types/risk';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export function RiskBadge({ level }: { level: RiskLevel }) {
  const isHigh = level === 'high';
  
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`risk-badge-${isHigh ? 'high' : 'low'}`}
    >
      {isHigh ? (
        <ShieldAlert className="w-3.5 h-3.5" />
      ) : (
        <ShieldCheck className="w-3.5 h-3.5" />
      )}
      {isHigh ? 'HIGH RISK' : 'LOW RISK'}
    </motion.div>
  );
}
