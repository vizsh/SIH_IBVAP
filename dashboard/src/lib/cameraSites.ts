/**
 * Real-world coordinates for the only SSB-side sites the reference doc
 * documents as actually camera-equipped (Section 17.1): Panitanki, Raxaul
 * ICP, Jogbani ICP. Demo camera IDs are mapped onto these real places
 * rather than fictional ones, so the map means something.
 */
export const CAMERA_SITES: Record<string, { lat: number; lng: number; label: string }> = {
  'BOP-01': { lat: 26.9598, lng: 88.1852, label: 'Panitanki (Indo-Nepal)' },
  'BOP-Alpha': { lat: 26.9958, lng: 84.8534, label: 'Raxaul ICP (Indo-Nepal)' },
  'BOP-Bravo': { lat: 26.3931, lng: 87.2589, label: 'Jogbani ICP (Indo-Nepal)' },
  'BOP-02': { lat: 26.9598, lng: 88.1852, label: 'Panitanki (Indo-Nepal)' },
  'BOP-TEST2': { lat: 26.9958, lng: 84.8534, label: 'Raxaul ICP (Indo-Nepal)' },
}

export function siteFor(cameraId: string) {
  return CAMERA_SITES[cameraId] ?? { lat: 26.9598, lng: 88.1852, label: cameraId }
}
