import { ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DotGrid from '@/components/DotGrid'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  const navigate = useNavigate()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // No real auth backend in this prototype — this is a UI-only gate.
    navigate('/console')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05070C] px-6">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <DotGrid baseColor="#1e293b" activeColor="#22d3ee" proximity={140} gap={28} dotSize={3} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <ShieldCheck className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" size={22} />
          <div className="text-sm font-bold tracking-widest text-zinc-100">IBVAP C2 CONSOLE</div>
        </div>
        <div onSubmit={handleSubmit}>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-[11px] text-zinc-600">
          Prototype build — no real authentication backend. This gate is UI-only.
        </p>
      </div>
    </div>
  )
}
