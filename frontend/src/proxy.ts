import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/*
 * Satu deployment melayani dua domain:
 *   www.pabrikenangan.my.id  -> halaman sewa photobooth (publik)
 *   app.pabrikenangan.my.id  -> dasbor pengelolaan
 *
 * Seluruh keputusan berbasis host ditaruh di berkas ini, bukan dibagi dengan
 * redirects() di next.config.ts. Alasannya terukur: proxy berjalan LEBIH DULU
 * daripada redirects(), sehingga aturan di next.config tidak pernah terpakai
 * untuk path yang dicegat di sini, sementara path yang dikecualikan matcher
 * (dulu termasuk /login) disajikan langsung dari cache prerender tanpa
 * melewati lapisan pengalihan sama sekali.
 */

const APP = 'app.pabrikenangan.my.id'

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
