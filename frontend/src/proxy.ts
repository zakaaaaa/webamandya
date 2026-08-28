import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Root "/" adalah halaman sewa photobooth untuk umum, bukan bagian dasbor.
  // Tanpa pengecualian ini pengunjung yang belum masuk langsung dilempar ke
  // /login dan halaman jualannya tidak pernah terlihat.
  if (request.nextUrl.pathname === '/') {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith('/download')) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith('/login')) {
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
  // public/ (logo, gambar contoh) tidak melewati _next/static, jadi tanpa ini
  // aset tersebut ikut dialihkan ke /login dan gambarnya rusak bagi pengunjung
  // yang belum masuk.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|download|login|.*\\..*).*)'],
}