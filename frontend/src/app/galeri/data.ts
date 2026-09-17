/*
 * Sesi yang tampil di /galeri: seluruh sesi PK ASUS 14-16 September 2026 WIB
 * (23 sesi, termasuk 4 yang berstatus expired), dipilih pemilik bersama izin
 * pemakaian fotonya. Berkas tidak disalin ke repo; semuanya dibaca langsung
 * dari R2 lewat cdn.pabrikenangan.my.id.
 *
 * Tiap sesi di R2 berpola results/<client>/<sesi>/{final.png, animation.gif,
 * video.mp4}, jadi yang disimpan cukup path-nya. Ukuran berkas terukur dari
 * header PNG/GIF dan ffmpeg:
 *   4r  strip 1202x1800, video 688x1030 (±2 MB)
 *   a4  strip 2480x3508, video 4960x7016 (27-85 MB) - frame newspaper
 *   GIF selalu 480x320 (±0,3 MB)
 */

export type Frame = '4r' | 'a4'

/* `waktu` hanya catatan asal sesi; halaman sengaja tidak menampilkan jam/tanggal. */
export type SesiGaleri = { waktu: string; path: string; frame: Frame }

export const CDN = 'https://cdn.pabrikenangan.my.id/results/'

export const UKURAN: Record<Frame, { width: number; height: number }> = {
  '4r': { width: 1202, height: 1800 },
  a4: { width: 2480, height: 3508 },
}
export const GIF = { width: 480, height: 320 }

/* Terbaru lebih dulu. */
export const SESI: SesiGaleri[] = [
  { waktu: '2026-09-16T13:56:03.228Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/0440f785-1c3d-4667-b5c0-c1ea71e73ced', frame: '4r' },
  { waktu: '2026-09-16T13:49:10.440Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/8062d1a4-b303-4d87-b3bb-2c68575a23d9', frame: '4r' },
  { waktu: '2026-09-16T13:25:49.276Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/5943ab4a-8e64-4e1e-b4f4-70e4dbcf8ac9', frame: '4r' },
  { waktu: '2026-09-16T11:54:09.014Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/2569d5ec-a320-4602-aa1b-ea5c63cb72c8', frame: '4r' },
  { waktu: '2026-09-16T10:50:11.950Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/eeed0793-7b3b-4e9c-90f6-6343ba089223', frame: '4r' },
  { waktu: '2026-09-16T10:43:39.719Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/d5defc21-c4fc-4f91-99df-5eb56185ddc6', frame: '4r' },
  { waktu: '2026-09-16T10:09:27.391Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/b64b6cd2-53a5-433d-8d8b-1ca0ff7b1be9', frame: '4r' },
  { waktu: '2026-09-16T09:07:43.388Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/15f7c981-9a96-480b-933d-dbafc6f6bca2', frame: '4r' },
  { waktu: '2026-09-16T08:17:28.729Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/4dcb938e-12a6-434f-a4ad-cbf9bb9f9a2a', frame: '4r' },
  { waktu: '2026-09-16T08:10:38.302Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/d0aa5924-93a8-4412-affa-a018786228de', frame: '4r' },
  { waktu: '2026-09-16T08:00:04.259Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/d600bc9c-afe1-493a-8570-b52db76fbe58', frame: '4r' },
  { waktu: '2026-09-15T14:48:45.589Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/3ea566ca-7085-4d65-b775-0c29d1471cce', frame: '4r' },
  { waktu: '2026-09-15T13:36:31.534Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/255936e8-c74d-4a4d-a629-87d161b73080', frame: '4r' },
  { waktu: '2026-09-15T13:12:28.367Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/da2a1c36-ade4-4b77-ad1c-853687c48d48', frame: '4r' },
  { waktu: '2026-09-15T11:12:31.645Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/b4031f26-0910-4dce-8335-9ab1010ead4a', frame: '4r' },
  { waktu: '2026-09-15T08:56:52.614Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/ac40e309-70d3-4f6d-8c3a-0075b192d864', frame: 'a4' },
  { waktu: '2026-09-15T08:44:31.356Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/168e73a6-ec8b-45ed-a811-0196e4295193', frame: '4r' },
  { waktu: '2026-09-15T08:20:46.091Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/86896870-45bf-442c-a096-4180a87f40e0', frame: 'a4' },
  { waktu: '2026-09-15T08:14:21.267Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/f97478cc-b816-4ab9-a823-12ac9810b214', frame: 'a4' },
  { waktu: '2026-09-15T07:55:20.134Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/a7c120f5-98c9-4f16-996f-254bad1b7a99', frame: 'a4' },
  { waktu: '2026-09-14T08:18:56.348Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/4516f3e3-c9b7-41df-9a94-17d9690c64ca', frame: '4r' },
  { waktu: '2026-09-14T08:05:22.653Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/41e854c0-7955-4e11-a59a-25fa584d2467', frame: 'a4' },
  { waktu: '2026-09-14T07:59:28.189Z', path: '8b7e2163-239b-4267-8f8a-f088ee3541a5/f011912c-de95-4479-a753-6290714ee342', frame: 'a4' },
]

export const strip = (s: SesiGaleri) => `${CDN}${s.path}/final.png`
export const gif = (s: SesiGaleri) => `${CDN}${s.path}/animation.gif`
export const video = (s: SesiGaleri) => `${CDN}${s.path}/video.mp4`
