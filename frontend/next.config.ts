import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  /*
   * Satu deployment melayani dua domain:
   *   www.pabrikenangan.my.id  -> "/" adalah halaman sewa photobooth
   *   app.pabrikenangan.my.id  -> "/" adalah dasbor
   *
   * Tanpa aturan ini, membuka app.pabrikenangan.my.id ikut menampilkan
   * halaman jualan, karena route "/" sama untuk semua host.
   *
   * redirects() dijalankan sebelum proxy.ts, jadi permintaan sudah berubah
   * jadi /dashboard saat pemeriksaan sesi berjalan — pengunjung yang belum
   * masuk tetap diteruskan ke /login seperti biasa.
   *
   * Sengaja bukan permanent: 308 akan disimpan browser selamanya dan
   * menyusahkan kalau pembagian domainnya berubah.
   */
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "app.pabrikenangan.my.id" }],
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
