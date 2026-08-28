import type { NextConfig } from "next";

/*
 * Pembagian domain (www = halaman sewa, app = dasbor) diurus seluruhnya di
 * src/proxy.ts, bukan di sini. Proxy berjalan lebih dulu daripada redirects(),
 * jadi aturan di next.config tidak pernah terpakai untuk path yang dicegat
 * proxy — menaruhnya di dua tempat hanya menyembunyikan bug.
 */
const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default nextConfig;
