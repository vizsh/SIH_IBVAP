import { useEffect, useState } from 'react'

export type EdgeStreamStatus = 'connecting' | 'live' | 'offline'

// Vite's dev proxy can't relay an unbounded multipart/x-mixed-replace stream
// (it hangs waiting for the response to end, which never happens) — so the
// browser hits the edge box's MJPEG server directly instead. This is
// inherently a local-dev/same-network feature: a hosted deployment has no
// route to a physical edge box anyway (see deployment notes), same reason
// RTSP itself can't cross that boundary either.
const EDGE_STREAM_URL = import.meta.env.VITE_EDGE_STREAM_URL ?? 'http://127.0.0.1:8091/stream'

/**
 * The edge pipeline (Phase 2) serves its annotated MJPEG frame only while a
 * real `python pipeline.py` process is running. This hook tracks whether
 * that stream is actually up so the UI can fall back to the placeholder
 * honestly instead of showing a broken image icon.
 */
export function useEdgeStream() {
  const [status, setStatus] = useState<EdgeStreamStatus>('connecting')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (status !== 'offline') return
    const retry = window.setTimeout(() => setNonce((n) => n + 1), 4000)
    return () => window.clearTimeout(retry)
  }, [status])

  return {
    status,
    src: `${EDGE_STREAM_URL}?_=${nonce}`,
    onLoad: () => setStatus('live'),
    onError: () => setStatus('offline'),
  }
}
