'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

export function SuccessCelebration({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 pointer-events-none z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2
            const distance = 80 + Math.random() * 60
            return (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  left: '50%',
                  top: '40%',
                }}
                initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                animate={{
                  opacity: [1, 1, 0],
                  scale: [0, 1, 0.5],
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                }}
                transition={{
                  duration: 1.2,
                  delay: i * 0.05,
                  ease: 'easeOut',
                }}
              >
                <Sparkles
                  className="h-3 w-3"
                  style={{
                    color: i % 3 === 0 ? '#22c55e' : i % 3 === 1 ? '#4ade80' : '#86efac',
                  }}
                />
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
