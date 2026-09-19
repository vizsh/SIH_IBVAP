import { Radar } from 'lucide-react'
import { CorrelationDemoTrigger } from '@/components/console/CorrelationBanner'
import { PhasePlaceholder } from '@/components/console/PhasePlaceholder'

export default function CorrelationPage() {
  return (
    <PhasePlaceholder
      icon={Radar}
      title="Cross-BOP Pattern Correlation"
      phase="Phase 2 — needs two simulated BOP feeds writing to the shared event DB"
      description="Side-by-side BOP-Alpha / BOP-Bravo feeds; a shared plate-hash + timestamp match flashes a correlated-pattern banner."
      bullets={[
        'No new hardware — only a shared event database keyed by plate hash and timestamp',
        'Travel-time window check: distance ÷ plausible speed range',
        'Two video feeds on one laptop as ‘virtual BOPs’ for the demo',
      ]}
      action={<CorrelationDemoTrigger />}
    />
  )
}
