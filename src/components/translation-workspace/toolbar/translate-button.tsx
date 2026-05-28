'use client'

import { motion } from 'framer-motion'
import { Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WorkspaceToolbarProps } from './types'

export function ToolbarTranslateButton({
  translationState,
  sourceCode,
  onTranslate,
}: Pick<WorkspaceToolbarProps, 'translationState' | 'sourceCode' | 'onTranslate'>) {
  return (
    <div className="relative">
      {translationState === 'idle' && sourceCode.trim() && (
        <motion.div
          className="absolute -inset-[2px] rounded-lg pointer-events-none animate-glow-pulse"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.3), transparent 40%, rgba(139,92,246,0.2), transparent 80%, rgba(34,197,94,0.3))',
            backgroundSize: '200% 200%',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '2px',
          }}
          animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}
      <motion.div
        className="absolute inset-0 rounded-md pointer-events-none"
        animate={{
          opacity: translationState === 'idle' && sourceCode.trim() ? 0 : 0,
        }}
        whileHover={{
          opacity: 0.4,
        }}
        style={{
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4), transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
      <Button
        onClick={onTranslate}
        disabled={translationState === 'loading' || !sourceCode.trim()}
        className={cn(
          'relative gap-2 font-medium transition-all duration-200',
          translationState === 'idle' && 'bg-[#22c55e] hover:bg-[#22c55e]/90 text-white shadow-md shadow-[#22c55e]/20 hover:shadow-lg hover:shadow-[#22c55e]/30',
          translationState === 'loading' && 'bg-[#22c55e]/70 text-white/80',
          translationState === 'success' && 'bg-[#22c55e] hover:bg-[#22c55e]/90 text-white shadow-md shadow-[#22c55e]/20',
          translationState === 'error' && 'bg-[#ef4444] hover:bg-[#ef4444]/90 text-white',
        )}
      >
        {translationState === 'loading' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            翻译中...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            翻译
          </>
        )}
      </Button>
    </div>
  )
}
