import type { Metadata } from 'next'
import MasukForm from './MasukForm'

// Pintu masuk dash.pabrikenangan.my.id. Sengaja tidak diindeks: halaman ini
// tidak punya nilai bagi siapa pun selain pengelola, dan alamat yang muncul di
// hasil pencarian hanya mengundang tebakan sandi.
export const metadata: Metadata = {
  title: 'Masuk - Talent Pool Pabrik Kenangan',
  robots: { index: false, follow: false },
}

export default function MasukPage() {
  return <MasukForm />
}
