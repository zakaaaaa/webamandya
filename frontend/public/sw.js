/*
 * Service worker khusus notifikasi antrean.
 *
 * Sengaja TIDAK menyentuh caching sama sekali. Halaman antrean menampilkan
 * posisi yang berubah tiap beberapa detik — service worker yang ikut menyajikan
 * respons dari cache justru akan menampilkan posisi basi, kesalahan yang
 * gejalanya sangat membingungkan di lapangan. Satu-satunya tugasnya adalah
 * menerima push dan membuka kembali halaman tiketnya.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Payload tak terbaca tetap harus memunculkan sesuatu — pengunjung yang
    // sedang jauh dari booth lebih baik menerima notifikasi samar daripada
    // tidak menerima apa pun.
  }

  const judul = data.judul || 'Antrean photobooth'
  const opsi = {
    body: data.isi || 'Ada kabar soal antreanmu.',
    icon: '/icon.png',
    badge: '/icon.png',
    lang: 'id',
    // Notifikasi antrean saling menggantikan: yang penting posisi TERBARU,
    // bukan tumpukan riwayat. Tanpa tag, HP pengunjung bisa penuh notifikasi
    // basi dan yang benar-benar penting tenggelam.
    tag: 'antrean',
    renotify: true,
    vibrate: [200, 100, 200, 100, 400],
    requireInteraction: true,
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(judul, opsi))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const tujuan = event.notification.data?.url || '/'

  // Kalau tabnya masih terbuka, fokuskan yang itu alih-alih membuka tab kedua —
  // pengunjung sudah pegang halaman tiketnya, jangan buat dia bingung punya dua.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((daftar) => {
      for (const c of daftar) {
        if (c.url.includes('/antri/') && 'focus' in c) return c.focus()
      }
      return self.clients.openWindow(tujuan)
    })
  )
})
