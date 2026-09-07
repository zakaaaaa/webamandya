import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { DASH_COOKIE, sesiSah } from '@/lib/dash-auth'

/*
 * Satu deployment melayani tiga domain:
 *   www.pabrikenangan.my.id   -> halaman sewa photobooth (publik)
 *   app.pabrikenangan.my.id   -> dasbor pengelolaan (akun admin_users)
 *   dash.pabrikenangan.my.id  -> dasbor talent pool (satu kata sandi bersama)
 *
 * Seluruh keputusan berbasis host ditaruh di berkas ini, bukan dibagi dengan
 * redirects() di next.config.ts. Alasannya terukur: proxy berjalan LEBIH DULU
 * daripada redirects(), sehingga aturan di next.config tidak pernah terpakai
 * untuk path yang dicegat di sini, sementara path yang dikecualikan matcher
 * (dulu termasuk /login) disajikan langsung dari cache prerender tanpa
 * melewati lapisan pengalihan sama sekali.
 */

const APP = 'app.pabrikenangan.my.id'

// Dasbor talent pool. Host ketiga di deployment yang sama, dengan pintu masuk
// sendiri: satu kata sandi bersama, bukan akun admin_users seperti APP.
const DASH = 'dash.pabrikenangan.my.id'

// Halaman yang HANYA boleh hidup di host dash. Kalau alamatnya diketik di www
// atau app, pengunjung dilempar ke dash supaya tidak ada dua pintu ke data
// yang sama dengan penjagaan berbeda.
const HALAMAN_DASH = ['/talent', '/masuk']

/*
 * Bagian yang tinggal di dasbor. SENGAJA TIDAK termasuk:
 *   /download/[uuid] - tautan QR yang dipindai tamu di acara. Cetakan dan QR
 *                      yang sudah beredar menunjuk ke www; memindahkannya
 *                      akan mematikan tautan yang sudah tersebar.
 *   /antri/[slug]    - antrean pelanggan, dipindai dari QR di standee CETAK.
 *                      Alasannya sama dan lebih keras: standee tidak bisa
 *                      diralat setelah masuk percetakan, jadi path ini harus
 *                      tetap publik dan tetap di www selamanya.
 *   /api/*           - dipanggil dari sisi klien pada origin-nya sendiri.
 */
const DASBOR = new Set([
  'dashboard', 'clients', 'devices', 'frames',
  'gallery', 'settings', 'transactions', 'vouchers', 'login',
])

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const host = request.headers.get('host') ?? ''
  const bagian = pathname.split('/')[1] ?? ''

  // ── HOST DASH ──
  // Ditangani lebih dulu daripada aturan lain: host ini tidak punya halaman
  // sewa, tidak punya dasbor klien, dan tidak boleh ikut jatuh ke pemeriksaan
  // sesi Supabase di bawah (yang akan melempar ke /login milik app).
  // Di pengembangan, "dash.localhost:3112" ikut dihitung sebagai host dash.
  // Tanpa ini dasbor talent tidak bisa dibuka dari browser lokal sama sekali —
  // hanya lewat curl dengan header Host palsu, yang tidak bisa dipakai untuk
  // memeriksa tampilannya.
  const hostDash = host === DASH
    || (process.env.NODE_ENV !== 'production' && host.startsWith('dash.'))

  if (hostDash) {
    if (pathname === '/masuk') return NextResponse.next()

    const sandi = process.env.DASH_PASSWORD ?? ''
    const sesi = request.cookies.get(DASH_COOKIE)?.value
    if (!(await sesiSah(sesi, sandi))) {
      return NextResponse.redirect(new URL('/masuk', request.url))
    }

    // Akar host ini ADALAH talent pool. Dipakai rewrite, bukan redirect,
    // supaya alamat yang dibagikan tetap dash.pabrikenangan.my.id tanpa /talent
    // menempel di belakangnya.
    if (pathname === '/') return NextResponse.rewrite(new URL('/talent', request.url))
    if (pathname.startsWith('/talent')) return NextResponse.next()

    // Sisanya bukan milik host ini (halaman sewa, dasbor klien, unduhan tamu).
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Halaman dash yang dibuka dari host lain dipindahkan ke dash.
  if (HALAMAN_DASH.some((h) => pathname === h || pathname.startsWith(`${h}/`))) {
    return NextResponse.redirect(new URL(pathname + search, `https://${DASH}`))
  }

  // Dasbor yang dibuka di www dipindahkan ke app, beserta query-nya.
  if (host !== APP && DASBOR.has(bagian)) {
    return NextResponse.redirect(new URL(pathname + search, `https://${APP}`))
  }

  // Di app, root bukan halaman jualan melainkan dasbor.
  if (host === APP && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Halaman sewa di root terbuka untuk umum.
  if (pathname === '/') {
    return NextResponse.next()
  }

  // Galeri hasil yang dibuka tamu lewat QR: tanpa login.
  if (pathname.startsWith('/download')) {
    return NextResponse.next()
  }

  // Antrean pelanggan yang dipindai dari standee: tanpa login. Termasuk
  // /antri/[slug]/operator, yang dijaga PIN-nya sendiri, bukan sesi Supabase —
  // operator berdiri di booth dengan HP pribadi dan tidak punya akun dasbor.
  if (pathname.startsWith('/antri')) {
    return NextResponse.next()
  }

  // Pendaftaran talent pool crew freelance. Dibagikan sebagai tautan terbuka
  // ke orang yang justru belum punya hubungan apa pun dengan Pabrik Kenangan --
  // menuntut sesi di sini akan memantulkan setiap pelamar ke /login.
  if (pathname.startsWith('/karir')) {
    return NextResponse.next()
  }

  // Halaman masuk tidak boleh menuntut sesi, kalau tidak jadi lingkaran.
  if (pathname.startsWith('/login')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  // `.*\..*` mengecualikan semua path yang punya ekstensi file — aset di folder
  // public/ (logo, gambar contoh, mesh 3D) tidak melewati _next/static, jadi
  // tanpa ini aset tersebut ikut dialihkan ke /login dan rusak bagi pengunjung
  // yang belum masuk.
  //
  // `login` sengaja TIDAK lagi dikecualikan: pengalihan www -> app di atas
  // harus bisa melihatnya. Pengecualiannya kini ditangani di dalam fungsi.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|download|antri|.*\\..*).*)'],
}
