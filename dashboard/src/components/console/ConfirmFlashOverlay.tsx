import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export function ConfirmFlashOverlay() {
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    function handle() {
      setFlashing(true)
      window.setTimeout(() => setFlashing(false), 260)
    }
    window.addEventListener('ibvap:confirm-flash', handle)
    return () => window.removeEventListener('ibvap:confirm-flash', handle)
  }, [])

  return (
    <AnimatePresence>
      {flashing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.22 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none fixed inset-0 z-[100] bg-red-600"
        />
      )}
    </AnimatePresence>
  )
}
