import { redirect } from 'next/navigation'
import { ambilSesiAdmin } from '@/lib/admin-session'
import StoryManager, { type ContohSesi, type StoryTemplate } from './StoryManager'

export default async function StoryPage() {
  const { supabase, adminUser } = await ambilSesiAdmin()
  if (adminUser.role === 'super_admin' || !adminUser.client_id) redirect('/dashboard')
  const clientId = adminUser.client_id

  const { data: templates } = await supabase
    .from('story_templates')
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: true })

  const { data: statistik } = await supabase
    .from('story_renders')
    .select('template_id, dibagikan, disimpan')

  // Sesi contoh untuk pratinjau editor: sesi lunas terbaru yang punya hasil
  // cetak DAN animasi siap. Frame strip didahulukan karena template strip2
  // butuh hasil yang bisa dibelah.
  const { data: sesiTerbaru } = await supabase
    .from('sessions')
    .select('transaction_code, result_url, gif_url, gif_status, frame_id, created_at, frames(paper_size, output_width, photo_slots)')
    .eq('client_id', clientId)
    .in('payment_status', ['paid', 'free'])
    .eq('transaction_type', 'session')
    .not('result_url', 'is', null)
    .eq('gif_status', 'ready')
    .order('created_at', { ascending: false })
    .limit(40)

  type Baris = {
    transaction_code: string; result_url: string; gif_url: string | null
    frames: { paper_size: string | null; output_width: number | null; photo_slots: { x: number; width: number }[] | null } | null
  }
  const strip2 = (f: Baris['frames']) => {
    if (!f || String(f.paper_size ?? '').toUpperCase() !== '4R') return false
    const W = Number(f.output_width) || 0
    const s = Array.isArray(f.photo_slots) ? f.photo_slots : []
    if (!W || s.length < 4) return false
    const kiri = s.filter(x => x.x + x.width / 2 < W / 2).length
    return kiri >= 2 && s.length - kiri >= 2 && s.every(x => x.width < W / 2)
  }
  const contoh: ContohSesi[] = ((sesiTerbaru ?? []) as unknown as Baris[])
    .map(b => ({ kode: b.transaction_code, hasil: b.result_url, animasi: b.gif_url, strip2: strip2(b.frames) }))
    .sort((a, b) => Number(b.strip2) - Number(a.strip2))
    .slice(0, 12)

  const pakai: Record<string, { render: number; dibagikan: number; disimpan: number }> = {}
  for (const r of statistik ?? []) {
    const p = (pakai[r.template_id] ??= { render: 0, dibagikan: 0, disimpan: 0 })
    p.render += 1; p.dibagikan += r.dibagikan ?? 0; p.disimpan += r.disimpan ?? 0
  }

  return (
    <StoryManager
      clientId={clientId}
      initialTemplates={(templates ?? []) as StoryTemplate[]}
      contoh={contoh}
      pakai={pakai}
    />
  )
}
