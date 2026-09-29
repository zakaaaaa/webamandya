// Label metode pembayaran sesi (sessions.payment_method) untuk dasbor.
//
//   qris        — QR dinamis DOKU (Checkout atau SNAP)
//   qris_manual — QRIS statis saat sinyal buruk, dikonfirmasi operator di kios
//   cash        — tunai ke operator, dicatat lewat voucher jenis cash
//   voucher     — voucher test/promo (gratis atau potongan, bukan pendapatan)
export const LABEL_METODE: Record<string, string> = {
  qris: 'QRIS',
  qris_manual: 'QRIS Manual',
  cash: 'Cash',
  voucher: 'Voucher',
  bypass: 'Bypass',
}

export const labelMetode = (metode?: string | null) =>
  (metode && LABEL_METODE[metode]) || metode || '—'
