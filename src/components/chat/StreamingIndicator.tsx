import React from 'react';
import { motion } from 'framer-motion';

export function StreamingIndicator() {
  const dotVariants = {
    initial: { y: 0 },
    animate: { y: -4 },
  };

  const transition = {
    duration: 0.5,
    repeat: Infinity,
    repeatType: "reverse" as const,
    ease: [0.42, 0, 0.58, 1] as const,
  };

  return (
    <div className="flex items-center gap-1.5 h-6 px-1">
      <motion.div
        className="w-1.5 h-1.5 bg-brand-500 rounded-full"
        variants={dotVariants}
        initial="initial"
        animate="animate"
        transition={{ ...transition, delay: 0 }}
      />
      <motion.div
        className="w-1.5 h-1.5 bg-brand-500 rounded-full"
        variants={dotVariants}
        initial="initial"
        animate="animate"
        transition={{ ...transition, delay: 0.15 }}
      />
      <motion.div
        className="w-1.5 h-1.5 bg-brand-500 rounded-full"
        variants={dotVariants}
        initial="initial"
        animate="animate"
        transition={{ ...transition, delay: 0.3 }}
      />
    </div>
  );
}
