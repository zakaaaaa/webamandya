import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// GET /api/session-media/{transaction_code}
//
// Dipakai halaman unduh untuk memantau hasil yang masih dirakit di mesin
// photobooth (video & GIF) DAN cetakan yang sedang keluar dari printer.
// Mesin melapor lewat backend; di sini kita cuma membaca statusnya supaya
// pelanggan tahu prosesnya sampai mana.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: session } = await supabase
    .from('sessions')
    .select(
      'id, result_url, gif_url, gif_status, video_url, video_status, print_status, print_sheets_done, print_sheets_total, print_eta_seconds, print_reason, print_started_at',
    )
    .eq('transaction_code', uuid)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { count } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session.id)

  return NextResponse.json(
    {
      result_url: session.result_url,
      gif_url: session.gif_url,
      gif_status: session.gif_status,
      video_url: session.video_url,
      video_status: session.video_status,
      photo_count: count ?? 0,
      // Progres cetak. null = sesi ini tidak mencetak, dan kartu cetak di
      // halaman unduh disembunyikan sama sekali.
      print_status: session.print_status,
      print_sheets_done: session.print_sheets_done,
      print_sheets_total: session.print_sheets_total,
      print_eta_seconds: session.print_eta_seconds,
      print_reason: session.print_reason,
      print_started_at: session.print_started_at,
    },
    // Status berubah dari detik ke detik selagi mesin bekerja — jangan di-cache.
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
