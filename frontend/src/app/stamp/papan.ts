/*
 * Menggambar Papan Kenangan ke kanvas 1080x1920 untuk disimpan / dibagikan ke
 * Story IG. Posisi dan hiasan harus sama dengan tampilan DOM di Papan.tsx —
 * keduanya membaca SLOT_STAMP dan memakai rumus pasDiSlot yang sama.
 */
import {
  LATAR_PAPAN, PAPAN_H, PAPAN_W, SLOT_STAMP, STIKER_PAPAN,
  gambarKecil, pasDiSlot, type SlotStamp,
} from '@/lib/stamp'

function muat(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`gagal memuat ${src}`))
    img.src = src
  })
}

function kotakBulat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/* Hiasan di tepi atas strip. Koordinat lokal: (0,0) = tengah atas strip. */
export function gambarHiasan(ctx: CanvasRenderingContext2D, slot: SlotStamp) {
  ctx.save()
  if (slot.hiasan === 'pin') {
    ctx.shadowColor = 'rgba(40,20,10,.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6
    ctx.fillStyle = slot.warna
    ctx.beginPath(); ctx.arc(0, 18, 24, 0, Math.PI * 2); ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.beginPath(); ctx.arc(-8, 10, 8, 0, Math.PI * 2); ctx.fill()
  } else if (slot.hiasan === 'selotip') {
    ctx.rotate((-4 * Math.PI) / 180)
    ctx.shadowColor = 'rgba(40,20,10,.18)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2
    ctx.globalAlpha = 0.86
    ctx.fillStyle = slot.warna
    ctx.fillRect(-80, -20, 160, 48)
  } else {
    ctx.shadowColor = 'rgba(40,20,10,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4
    ctx.lineWidth = 9
    ctx.strokeStyle = slot.warna
    kotakBulat(ctx, -22, -46, 44, 112, 22); ctx.stroke()
    ctx.shadowColor = 'transparent'
    ctx.lineWidth = 7
    kotakBulat(ctx, -12, -30, 24, 76, 12); ctx.stroke()
  }
  ctx.restore()
}

/**
 * gambar[i] = URL strip asli (result_url) untuk slot i, atau null bila kosong.
 * Hasilnya Blob PNG 1080x1920.
 */
export async function rakitPapan(gambar: (string | null)[]): Promise<Blob> {
  await Promise.all([
    document.fonts.load('700 30px LeagueSpartan').catch(() => null),
  ])

  const [latar, stiker, ...strip] = await Promise.all([
    muat(LATAR_PAPAN),
    STIKER_PAPAN ? muat(STIKER_PAPAN) : Promise.resolve(null),
    ...gambar.map((g) => (g ? muat(gambarKecil(g, 1080)) : Promise.resolve(null))),
  ])

  const kanvas = document.createElement('canvas')
  kanvas.width = PAPAN_W
  kanvas.height = PAPAN_H
  const ctx = kanvas.getContext('2d')!
  ctx.drawImage(latar, 0, 0, PAPAN_W, PAPAN_H)

  SLOT_STAMP.forEach((slot, i) => {
    const img = strip[i]
    ctx.save()
    ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2)
    ctx.rotate((slot.rot * Math.PI) / 180)

    if (!img) {
      // Slot kosong: garis putus-putus + nomor, sama seperti di layar.
      ctx.setLineDash([18, 14])
      ctx.lineWidth = 5
      ctx.strokeStyle = 'rgba(255,246,230,.75)'
      kotakBulat(ctx, -slot.w / 2 + 20, -slot.h / 2 + 20, slot.w - 40, slot.h - 40, 18)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,246,230,.85)'
      ctx.font = '700 120px LeagueSpartan, sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), 0, 0)
      ctx.restore()
      return
    }

    const pas = pasDiSlot(slot, img.naturalWidth, img.naturalHeight)
    const kiri = pas.x - slot.x - slot.w / 2
    const atas = pas.y - slot.y - slot.h / 2
    ctx.shadowColor = 'rgba(30,14,6,.45)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 12
    ctx.fillStyle = '#fff'
    ctx.fillRect(kiri, atas, pas.w, pas.h)
    ctx.shadowColor = 'transparent'
    ctx.drawImage(img, kiri, atas, pas.w, pas.h)

    ctx.translate(0, atas)
    gambarHiasan(ctx, slot)
    ctx.restore()
  })

  if (stiker) ctx.drawImage(stiker, 0, 0, PAPAN_W, PAPAN_H)

  return new Promise<Blob>((resolve, reject) =>
    kanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('kanvas kosong'))), 'image/png'),
  )
}
