import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ClickSpark from '@/components/ClickSpark'
import type { IbvapEvent } from '@/types'

/**
 * Confirm/Dismiss button interaction (reference doc Feature 1): confirming
 * escalates a medium-confidence alert, so it gets a deliberate crimson
 * spark-flash; dismissing is a false-alarm, so it fades out gracefully
 * instead of just snapping to a status label.
 */
export function ReviewActions({
  status,
  onConfirm,
  onDismiss,
}: {
  status: IbvapEvent['status']
  onConfirm: () => void
  onDismiss: () => void
}) {
  const [flashConfirm, setFlashConfirm] = useState(false)

  function handleConfirm() {
    setFlashConfirm(true)
    window.setTimeout(() => onConfirm(), 260)
  }

  return (
    <div className="relative z-10 mt-2 min-h-[26px]">
      <AnimatePresence mode="wait">
        {status === 'pending' && !flashConfirm ? (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="flex gap-2"
          >
            <ClickSpark sparkColor="#ef4444" sparkCount={10} sparkRadius={18} duration={350}>
              <motion.button
                onClick={handleConfirm}
                whileTap={{ scale: 0.93 }}
                animate={flashConfirm ? { backgroundColor: 'rgba(239,68,68,0.6)' } : {}}
                className="rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30"
              >
                Confirm
              </motion.button>
            </ClickSpark>
            <motion.button
              onClick={onDismiss}
              whileTap={{ scale: 0.93 }}
              className="rounded-md bg-zinc-700/40 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700/60"
            >
              Dismiss
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="status"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-[11px] uppercase tracking-wider text-zinc-500"
          >
            {flashConfirm ? 'confirming…' : status}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
