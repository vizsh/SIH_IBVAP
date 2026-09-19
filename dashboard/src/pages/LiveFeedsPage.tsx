import { Video } from 'lucide-react'
import { PhasePlaceholder } from '@/components/console/PhasePlaceholder'

export default function LiveFeedsPage() {
  return (
    <PhasePlaceholder
      icon={Video}
      title="Live Feeds & Tactical HUD"
      phase="Phase 2 — wired once the YOLOv8n + ByteTrack pipeline lands"
      description="Full-screen tactical overlay: polygon geofence mask, bounding boxes with tracking breadcrumbs, multi-frame ANPR voting panel."
      bullets={[
        'Glowing SVG virtual-fence polygon, pulses on intrusion crossing',
        'Per-track motion trail behind ByteTrack IDs',
        'Live coordinate/FPS HUD overlay on the video canvas',
        'Multi-frame ANPR modal-vote card next to each tracked vehicle',
      ]}
    />
  )
}
