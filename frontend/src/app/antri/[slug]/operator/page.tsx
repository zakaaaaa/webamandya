import OperatorPanel from './OperatorPanel'

// Panel operator dibuka di HP operator sendiri, bukan di kiosk.
//
// Alasannya operasional: operator harus bisa bergerak di sekitar booth, dan
// kalau aplikasi kiosk crash di tengah acara, antrean tetap harus bisa
// dijalankan. Penjaganya PIN per booth, bukan sesi Supabase. Operator
// lapangan tidak punya akun dasbor dan tidak seharusnya perlu punya.

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Panel Antrean Operator',
  robots: { index: false, follow: false },
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <OperatorPanel slug={slug.toLowerCase()} />
}
