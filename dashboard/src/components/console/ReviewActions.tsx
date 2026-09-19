import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import ClickSpark from '@/components/ClickSpark'
import { triggerConfirmFlash } from '@/lib/confirmFlash'
import type { IbvapEvent } from '@/types'

const DISMISS_REASONS = ['Animal / foliage movement', 'False positive', 'Authorized personnel', 'Other']

/**
 * Confirm/Dismiss button interaction (Feature 4): confirming dispatches a
 * real alert, so it gets a screen-wide crimson flash + a dispatch toast —
 * not just a color change on the button. Dismissing captures a reason,
 * which the backend logs into the audit trail — this is the platform's own
 * "how do we prove we're not just crying wolf" performance record.
 */
export function ReviewActions({
  status,
  onConfirm,
  onDismiss,
}: {
  status: IbvapEvent['status']
  onConfirm: () => void
  onDismiss: (reason: string) => void
}) {
  const [flashConfirm, setFlashConfirm] = useState(false)
  const [pickingReason, setPickingReason] = useState(false)

  function handleConfirm() {
    setFlashConfirm(true)
    triggerConfirmFlash()
    toast.success('Alert dispatched to duty officer', { duration: 3000 })
    window.setTimeout(() => onConfirm(), 260)
  }

  function handleDismiss(reason: string) {
    setPickingReason(false)
    onDismiss(reason)
  }

  return (
    <div className="relative z-10 mt-2 min-h-[26px]">
      <AnimatePresence mode="wait">
        {pickingReason ? (
          <motion.div
            key="reasons"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap gap-1"
          >
            {DISMISS_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => handleDismiss(reason)}
                className="rounded-md bg-zinc-800/60 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:bg-zinc-700/60"
              >
                {reason}
              </button>
            ))}
          </motion.div>
        ) : status === 'pending' && !flashConfirm ? (
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
              onClick={() => setPickingReason(true)}
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
