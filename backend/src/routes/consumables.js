// Bahan habis pakai per perangkat: KERTAS dan TINTA.
//
// Level tinta EPSON L3210 tidak bisa dibaca dari software (tangki EcoTank
// tidak berchip — printer-nya sendiri tidak punya sensor). Jadi yang masuk
// ke sini adalah AKUMULASI PEMAKAIAN yang dihitung aplikasi dari piksel yang
// benar-benar dicetak, bukan hasil pembacaan sensor. Lihat catatan lengkap
// di sql/2026-08-27_consumables.sql.

const express = require('express');
const router = express.Router();
const { supabase } = require('../middleware/validateDevice');
const telegram = require('../utils/telegram');

// Jeda minimum antar notifikasi Telegram untuk jenis yang sama. Tanpa ini,
// sekali stok menipis operator akan dikirimi satu pesan SETIAP cetakan.
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 jam

/** Ambil device + baris consumables-nya dari hwid. */
async function resolveDevice(hwid) {
  const { data: device, error } = await supabase
    .from('devices')
    .select('id, device_name, client_id, clients(name)')
    .eq('hwid', hwid)
    .single();
  if (error || !device) return null;

  // Baris consumables dibuat malas (lazy): perangkat yang didaftarkan setelah
  // migrasi SQL dijalankan tetap dapat barisnya tanpa perlu migrasi ulang.
  let { data: row } = await supabase
    .from('device_consumables')
    .select('*')
    .eq('device_id', device.id)
    .single();

  if (!row) {
    const { data: created } = await supabase
      .from('device_consumables')
      .insert({ device_id: device.id })
      .select('*')
      .single();
    row = created;
  }
  return { device, row };
}

function cooldownPassed(at) {
  if (!at) return true;
  return Date.now() - new Date(at).getTime() > ALERT_COOLDOWN_MS;
}

function labelPerangkat(device) {
  const nama = device.device_name || 'Photobooth';
  const klien = device.clients?.name;
  return klien ? `${nama} (${klien})` : nama;
}

// ============================================================
// POST /api/photobooth/consumables/report
// Dipanggil aplikasi setelah cetak BERHASIL. Body berisi DELTA, bukan total:
//   { hwid, sheets, ink: { c, m, y, k } }
// Aplikasi menyimpan deltanya secara lokal sampai endpoint ini membalas 200,
// jadi hitungan tidak hilang walau internet mati.
// ============================================================
router.post('/report', async (req, res) => {
  const { hwid, sheets, ink } = req.body || {};

  if (!hwid) {
    return res.status(400).json({ success: false, message: 'hwid wajib diisi.' });
  }
  const addSheets = Number.isFinite(Number(sheets)) ? Math.max(0, Math.trunc(Number(sheets))) : 0;
  if (addSheets === 0) {
    return res.status(400).json({ success: false, message: 'sheets harus > 0.' });
  }

  try {
    const found = await resolveDevice(hwid);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Perangkat tidak terdaftar.' });
    }
    const { device, row } = found;

    const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
    const addC = num(ink?.c), addM = num(ink?.m), addY = num(ink?.y), addK = num(ink?.k);

    // Sisa kertas tidak boleh negatif: kalau operator lupa mencatat pengisian,
    // angkanya berhenti di 0 alih-alih jadi minus dan membingungkan.
    const paperRemaining = Math.max(0, (row.paper_remaining || 0) - addSheets);

    const updated = {
      paper_remaining: paperRemaining,
      ink_c: (row.ink_c || 0) + addC,
      ink_m: (row.ink_m || 0) + addM,
      ink_y: (row.ink_y || 0) + addY,
      ink_k: (row.ink_k || 0) + addK,
      total_sheets_printed: (row.total_sheets_printed || 0) + addSheets,
      updated_at: new Date().toISOString(),
    };

    // ---- Peringatan KERTAS ----
    const ambangKertas = row.paper_low_threshold ?? 20;
    const kertasMenipis = row.paper_loaded > 0 && paperRemaining <= ambangKertas;
    if (kertasMenipis && cooldownPassed(row.paper_alerted_at)) {
      const habis = paperRemaining === 0;
      await telegram.sendMessage(
        `${habis ? '🔴' : '🟠'} <b>Kertas ${habis ? 'HABIS' : 'menipis'}</b>\n` +
        `Perangkat: <b>${telegram.esc(labelPerangkat(device))}</b>\n` +
        `Sisa: <b>${paperRemaining}</b> lembar (ambang ${ambangKertas})\n` +
        `Terakhir diisi: ${row.paper_last_loaded_at ? new Date(row.paper_last_loaded_at).toLocaleString('id-ID') : '-'}`
      );
      updated.paper_alerted_at = new Date().toISOString();
    }

    // ---- Peringatan TINTA ----
    // Hanya berarti kalau kapasitasnya sudah dikalibrasi; sebelum itu kita
    // tidak punya dasar untuk menyebut sesuatu "menipis".
    const kapasitas = row.ink_page_capacity || 0;
    if (kapasitas > 0) {
      const kanal = {
        C: updated.ink_c, M: updated.ink_m, Y: updated.ink_y, K: updated.ink_k,
      };
      const ambangTinta = row.ink_low_threshold ?? 0.85;
      const kritis = Object.entries(kanal)
        .filter(([, v]) => v / kapasitas >= ambangTinta)
        .map(([nama, v]) => `${nama} ${Math.round((v / kapasitas) * 100)}%`);

      if (kritis.length && cooldownPassed(row.ink_alerted_at)) {
        await telegram.sendMessage(
          `🟠 <b>Tinta menipis (estimasi)</b>\n` +
          `Perangkat: <b>${telegram.esc(labelPerangkat(device))}</b>\n` +
          `Terpakai: <b>${telegram.esc(kritis.join(', '))}</b> dari kapasitas\n` +
          `Angka ini estimasi dari liputan cetak, bukan sensor — cek tangki langsung.`
        );
        updated.ink_alerted_at = new Date().toISOString();
      }
    }

    const { error: upErr } = await supabase
      .from('device_consumables')
      .update(updated)
      .eq('device_id', device.id);

    if (upErr) throw upErr;

    return res.json({
      success: true,
      data: {
        paper_remaining: paperRemaining,
        paper_low: kertasMenipis,
        total_sheets_printed: updated.total_sheets_printed,
      },
    });
  } catch (e) {
    console.error('[Consumables] report error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ============================================================
// POST /api/photobooth/consumables/printer-state
// Status printer apa adanya dari spooler Windows. Dikirim aplikasi saat
// cetak dibatalkan karena printer bermasalah, dan setelah tiap cetak sukses.
// ============================================================
router.post('/printer-state', async (req, res) => {
  const { hwid, printer_status, printer_blocked, printer_reason, queued_jobs } = req.body || {};
  if (!hwid) {
    return res.status(400).json({ success: false, message: 'hwid wajib diisi.' });
  }

  try {
    const found = await resolveDevice(hwid);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Perangkat tidak terdaftar.' });
    }
    const { device, row } = found;

    const blocked = Boolean(printer_blocked);
    const updated = {
      printer_status: printer_status ?? null,
      printer_blocked: blocked,
      printer_reason: printer_reason ?? null,
      queued_jobs: Number.isFinite(Number(queued_jobs)) ? Math.trunc(Number(queued_jobs)) : 0,
      printer_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Hanya kabari saat printer BARU bermasalah, bukan tiap laporan — kalau
    // tidak, satu printer macet semalaman akan mengirim puluhan pesan.
    const baruBermasalah = blocked && !row.printer_blocked;
    if (baruBermasalah && cooldownPassed(row.printer_alerted_at)) {
      await telegram.sendMessage(
        `🔴 <b>Printer bermasalah</b>\n` +
        `Perangkat: <b>${telegram.esc(labelPerangkat(device))}</b>\n` +
        `Status: <b>${telegram.esc(printer_status || '-')}</b>\n` +
        `Sebab: ${telegram.esc(printer_reason || '-')}\n` +
        `Antrian: ${updated.queued_jobs} job\n` +
        `Cetakan pelanggan TIDAK akan keluar sampai ini dibereskan.`
      );
      updated.printer_alerted_at = new Date().toISOString();
    }

    // Printer pulih — beri tahu juga, supaya operator tidak datang percuma.
    if (!blocked && row.printer_blocked) {
      await telegram.sendMessage(
        `🟢 <b>Printer normal kembali</b>\n` +
        `Perangkat: <b>${telegram.esc(labelPerangkat(device))}</b>`
      );
    }

    const { error } = await supabase
      .from('device_consumables')
      .update(updated)
      .eq('device_id', device.id);
    if (error) throw error;

    return res.json({ success: true });
  } catch (e) {
    console.error('[Consumables] printer-state error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ============================================================
// GET /api/photobooth/consumables/status?hwid=xxx
// Dipakai aplikasi untuk menampilkan sisa stok di halaman diagnostik.
// ============================================================
router.get('/status', async (req, res) => {
  const { hwid } = req.query;
  if (!hwid) {
    return res.status(400).json({ success: false, message: 'hwid wajib diisi.' });
  }
  try {
    const found = await resolveDevice(hwid);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Perangkat tidak terdaftar.' });
    }
    const { row } = found;
    return res.json({
      success: true,
      data: {
        paper_remaining: row.paper_remaining,
        paper_loaded: row.paper_loaded,
        paper_low_threshold: row.paper_low_threshold,
        ink_since_refill: Math.max(row.ink_c, row.ink_m, row.ink_y, row.ink_k),
        ink_page_capacity: row.ink_page_capacity,
        ink_c: row.ink_c,
        ink_m: row.ink_m,
        ink_y: row.ink_y,
        ink_k: row.ink_k,
        printer_status: row.printer_status,
        printer_blocked: row.printer_blocked,
        total_sheets_printed: row.total_sheets_printed,
      },
    });
  } catch (e) {
    console.error('[Consumables] status error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
