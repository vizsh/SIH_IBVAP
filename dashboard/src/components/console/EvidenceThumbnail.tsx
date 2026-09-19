import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { BACKEND_ORIGIN } from '@/lib/api'

/**
 * The actual annotated frame that triggered an alert — real evidence, not a
 * text description of one. Falls back to an honest "no snapshot" icon
 * rather than a broken-image glyph if the pipeline never uploaded one
 * (e.g. an event created before evidence capture existed, or the upload
 * failed).
 */
export function EvidenceThumbnail({ url, className }: { url: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <div className={`flex items-center justify-center bg-zinc-900/80 text-zinc-700 ${className ?? ''}`}>
        <ImageOff size={18} strokeWidth={1.4} />
      </div>
    )
  }

  return (
    <img
      src={`${BACKEND_ORIGIN}${url}`}
      onError={() => setFailed(true)}
      alt="Alert evidence snapshot"
      className={`object-cover ${className ?? ''}`}
    />
  )
}
