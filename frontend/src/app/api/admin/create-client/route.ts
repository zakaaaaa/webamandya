import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { name, email, phone, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 })
    }

    // Cek apakah yang request adalah super_admin
    const supabaseUser = await createServerSupabaseClient()
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { data: adminUser } = await supabaseUser
      .from('admin_users').select('role').eq('id', user.id).single()
    if (adminUser?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    // Gunakan service role key untuk operasi admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 1. Buat auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Insert ke tabel clients
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({ name, email, phone: phone || null, is_active: true })
      .select().single()

    if (clientError) {
      // Rollback: hapus auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: clientError.message }, { status: 400 })
    }

    // 3. Insert ke admin_users
    const { error: adminError } = await supabaseAdmin
      .from('admin_users')
      .insert({
        id: authData.user.id,
        client_id: client.id,
        role: 'admin',
        full_name: name,
        is_active: true,
      })

    if (adminError) {
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('clients').delete().eq('id', client.id)
      return NextResponse.json({ error: adminError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, client_id: client.id })

  } catch (e) {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
