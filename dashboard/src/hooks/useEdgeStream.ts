import { useEffect, useState } from 'react'

export type EdgeStreamStatus = 'connecting' | 'live' | 'offline'

// Vite's dev proxy can't relay an unbounded multipart/x-mixed-replace stream
// (it hangs waiting for the response to end, which never happens) — so the
// browser hits the edge box's MJPEG server directly instead. This is
// inherently a local-dev/same-network feature: a hosted deployment has no
// route to a physical edge box anyway (see deployment notes), same reason
// RTSP itself can't cross that boundary either.
const EDGE_HOST = (import.meta.env.VITE_EDGE_STREAM_HOST as string | undefined) ?? '127.0.0.1'

// One MJPEG port per simultaneously-running pipeline process — run a second
// edge process with `--camera-id BOP-Alpha --stream-port 8092` (or Bravo on
// 8093) to see a genuine second live feed on the dual-feed correlation view.
const STREAM_PORTS: Record<string, number> = {
  'BOP-01': 8091,
  'BOP-Alpha': 8092,
  'BOP-Bravo': 8093,
  'BOP-Sentry-Thermal': 8094,
}
const DEFAULT_PORT = 8091

/**
 * The edge pipeline (Phase 2) serves its annotated MJPEG frame only while a
 * real `python pipeline.py` process is running. This hook tracks whether
 * that stream is actually up so the UI can fall back to the placeholder
 * honestly instead of showing a broken image icon.
 */
export function useEdgeStream(cameraId: string = 'BOP-01') {
  const [status, setStatus] = useState<EdgeStreamStatus>('connecting')
  const [nonce, setNonce] = useState(0)
  const port = STREAM_PORTS[cameraId] ?? DEFAULT_PORT

  useEffect(() => {
    setStatus('connecting')
    setNonce((n) => n + 1)
  }, [cameraId])

  useEffect(() => {
    if (status !== 'offline') return
    const retry = window.setTimeout(() => setNonce((n) => n + 1), 4000)
    return () => window.clearTimeout(retry)
  }, [status])

  return {
    status,
    src: `http://${EDGE_HOST}:${port}/stream?_=${nonce}`,
    onLoad: () => setStatus('live'),
    onError: () => setStatus('offline'),
  }
}
