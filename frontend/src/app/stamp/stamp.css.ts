/*
 * stamp.css.ts - gaya halaman /stamp.
 *
 * Kulit halaman mengikuti /dlogok dan /download (merah brand, krem, Bristol +
 * League Spartan). Papan gabusnya sendiri adalah gambar (public/stamp/papan.jpg),
 * jadi desain papan bisa diganti tanpa menyentuh CSS ini.
 *
 * Papan adalah hero halaman: kepala dibuat ringkas supaya papan langsung
 * terlihat, dan progres cukup satu baris teks di bawahnya (slot kosong di
 * papan sudah bernomor, jadi tidak perlu indikator kedua).
 *
 * Di dalam papan, satuan --u = 1 piksel kanvas 1080x1920 (lewat container
 * query), supaya posisi strip di layar sama persis dengan gambar ekspor.
 * Teks Bristol jangan memuat huruf "b" (terbaca "l").
 */
export const STAMP_CSS = `
html,body{margin:0;padding:0;background:#A12A1B}
@font-face{font-family:'Bristol';src:url('/dlogok/Bristol.otf') format('opentype');font-display:swap}
@font-face{font-family:'LeagueSpartan';src:url('/dlogok/LeagueSpartan-Bold.ttf') format('truetype');font-weight:700;font-display:swap}

.st{
  --merah:#C23A2A;--merah-t:#D34A33;--merah-g:#A12A1B;--krem:#FFF6E6;--kuning:#FFE3A6;--gelap:#2B1D12;--abu:#8A6F60;
  --sub:rgba(252,233,206,.86);
  --bayang-1:0 4px 14px rgba(80,12,4,.22);--bayang-3:0 18px 44px rgba(60,8,4,.34);
  min-height:100dvh;color:var(--krem);overflow-x:hidden;padding-bottom:56px;
  background:
    radial-gradient(circle,rgba(110,24,16,.16) 1.6px,transparent 2px) 0 0/22px 22px,
    radial-gradient(ellipse 110% 700px at 50% 200px,var(--merah-t) 0%,var(--merah) 55%,transparent 100%) top/100% 1200px no-repeat,
    linear-gradient(var(--merah),var(--merah-g));
  font-family:'LeagueSpartan',system-ui,sans-serif;font-weight:700;-webkit-font-smoothing:antialiased;
}
.st *{box-sizing:border-box}
.st > *{max-width:460px;margin-inline:auto;padding-inline:16px}
.st p,.st h1,.st h2,.st h3{margin:0}
.st .disp{font-family:'Bristol',cursive;font-weight:400;line-height:1}
.st .lab{font-family:'LeagueSpartan',sans-serif;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.st .teks{font-family:system-ui,sans-serif;font-weight:400;font-size:15px;line-height:1.5}

/* ── Kepala: ringkas, papan harus segera terlihat ── */
.st .kepala{text-align:center;padding-top:24px}
.st .logo-duo{display:flex;align-items:center;justify-content:center;gap:12px}
.st .logo-pk{width:52px;height:auto;transform:rotate(-4deg);filter:drop-shadow(0 4px 10px rgba(70,10,4,.3))}
.st .logo-dl{width:104px;height:auto}
.st .kali{color:var(--sub);font-size:16px}
.st h1{margin-top:16px;font-size:clamp(44px,13vw,60px);color:var(--krem);text-shadow:0 4px 14px rgba(70,10,4,.3)}
.st .tagar{margin-top:8px;font-size:12px;color:var(--kuning)}
.st .sub{margin:14px auto 0;max-width:330px;font-family:system-ui,sans-serif;font-weight:400;font-size:15px;line-height:1.5;color:var(--sub)}

/* ── Papan ── */
.st .bingkai{margin-top:22px}
.st .papan{position:relative;width:100%;container-type:inline-size;border-radius:14px;overflow:hidden;
  box-shadow:var(--bayang-3);background:#B9824F}
.st .papan.memuat{animation:kedip 1.2s ease-in-out infinite alternate}
@keyframes kedip{to{opacity:.6}}
.st .papan-isi{--u:calc(100cqw / 1080);position:absolute;inset:0}
.st .latar{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
.st .stiker{z-index:5}
.st .slot{position:absolute;transform-origin:50% 50%}
.st .kosong{position:absolute;inset:calc(var(--u)*20);display:grid;place-items:center;
  border:calc(var(--u)*5) dashed rgba(255,246,230,.75);border-radius:calc(var(--u)*18)}
.st .kosong span{font-size:calc(var(--u)*120);color:rgba(255,246,230,.85)}
.st .strip{position:absolute;background:#fff;box-shadow:0 calc(var(--u)*12) calc(var(--u)*22) rgba(30,14,6,.45);transition:opacity .2s}
.st .strip img{display:block;width:100%;height:100%}
.st .slot.tempel .strip{animation:tempel .9s cubic-bezier(.2,1.3,.4,1)}
@keyframes tempel{
  0%{transform:translateY(-60%) scale(1.25) rotate(8deg);opacity:0}
  60%{opacity:1}
}
.st .progres{margin-top:12px;text-align:center;font-size:11px;color:var(--sub)}

.st .hiasan{position:absolute;left:50%;top:0;display:block}
.st .hiasan.pin{width:calc(var(--u)*48);height:calc(var(--u)*48);margin:calc(var(--u)*-6) 0 0 calc(var(--u)*-24);border-radius:50%;
  background:radial-gradient(circle at 33% 33%,rgba(255,255,255,.6) 0 calc(var(--u)*8),transparent calc(var(--u)*9)),var(--warna);
  box-shadow:0 calc(var(--u)*6) calc(var(--u)*10) rgba(40,20,10,.45)}
.st .hiasan.selotip{width:calc(var(--u)*160);height:calc(var(--u)*48);margin:calc(var(--u)*-20) 0 0 calc(var(--u)*-80);
  background:var(--warna);opacity:.86;transform:rotate(-4deg);box-shadow:0 calc(var(--u)*2) calc(var(--u)*4) rgba(40,20,10,.18)}
.st .hiasan.klip{width:calc(var(--u)*44);height:calc(var(--u)*112);margin:calc(var(--u)*-46) 0 0 calc(var(--u)*-22);
  border:calc(var(--u)*9) solid var(--warna);border-radius:calc(var(--u)*22);
  filter:drop-shadow(0 calc(var(--u)*4) calc(var(--u)*4) rgba(40,20,10,.35))}
.st .hiasan.klip::after{content:'';position:absolute;left:calc(var(--u)*1);right:calc(var(--u)*1);top:calc(var(--u)*7);bottom:calc(var(--u)*-1);
  border:calc(var(--u)*7) solid var(--warna);border-radius:calc(var(--u)*12)}

/* ── Pesan ── */
.st .pesan{margin:16px auto 0;padding:12px 16px;border-radius:14px;font-size:14px;line-height:1.4;text-align:center;max-width:428px;
  font-family:system-ui,sans-serif;font-weight:600}
.st .pesan.ok{background:var(--kuning);color:var(--gelap)}
.st .pesan.gagal{background:var(--gelap);color:var(--krem)}

/* ── Kartu krem: satu per keadaan, judulnya kalimat biasa ── */
.st .kartu-form{margin-top:18px;background:var(--krem);color:var(--gelap);border-radius:22px;padding:22px 20px;
  box-shadow:var(--bayang-1);max-width:428px}
.st .kartu-form h2{font-size:21px;line-height:1.2;letter-spacing:0;color:var(--gelap)}
.st .kartu-form h3{font-size:17px;line-height:1.2;letter-spacing:0;color:var(--gelap)}
.st .kartu-form .teks{margin-top:6px;color:#5a4a40}
.st .kartu-form .teks b{color:var(--gelap)}
.st .kartu-form form{margin-top:14px}
.st .sekat{height:2px;margin:20px -20px;background:repeating-linear-gradient(90deg,rgba(43,29,18,.18) 0 8px,transparent 8px 14px)}
.st .baris{display:flex;gap:8px}
.st input{flex:1;min-width:0;height:50px;border-radius:14px;border:0;background:#fff;padding:0 14px;
  box-shadow:inset 0 0 0 1.5px rgba(43,29,18,.12);font:500 15px system-ui,sans-serif;color:var(--gelap);outline:none}
.st input::placeholder{color:#9b8b80}
.st input:focus{box-shadow:inset 0 0 0 2px var(--merah)}
.st .kecil-btn{height:50px;padding:0 16px;border-radius:14px;border:0;background:rgba(43,29,18,.08);color:var(--gelap);
  font:700 12px 'LeagueSpartan',sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.st .kecil-btn:disabled{opacity:.45}
.st .tombol{display:flex;width:100%;align-items:center;justify-content:center;min-height:52px;margin-top:12px;padding:14px 20px 11px;
  border-radius:40px;border:0;background:var(--merah);color:var(--krem);font:700 14px 'LeagueSpartan',sans-serif;letter-spacing:.12em;
  text-transform:uppercase;cursor:pointer;box-shadow:0 6px 18px rgba(160,30,15,.3);transition:transform .15s}
.st .tombol:active:not(:disabled){transform:translateY(2px) scale(.98)}
.st .tombol:disabled{opacity:.5;cursor:default}
.st .tautan{display:block;margin:18px auto 0;padding:4px 8px;border:0;background:none;color:var(--merah);
  font:700 13px 'LeagueSpartan',sans-serif;letter-spacing:.08em;text-decoration:underline;text-underline-offset:3px;cursor:pointer}

.st .bantuan{margin-top:16px;font:400 14px/1.5 system-ui,sans-serif;color:#5a4a40}
.st .bantuan summary{cursor:pointer;font-weight:700;color:var(--merah)}
.st .bantuan ol{padding-left:20px;margin:10px 0 0}
.st .bantuan li{margin-bottom:6px}

.st .voucher{text-align:center}
.st .voucher h2{font-size:44px;color:var(--merah)}
.st .kode-voucher{display:block;width:100%;margin:14px 0 10px;padding:18px 10px 14px;border-radius:16px;border:3px dashed var(--merah);
  background:#fff;color:var(--merah);font:700 30px 'LeagueSpartan',monospace;letter-spacing:.12em;cursor:pointer}

.st .kaki{margin-top:22px;text-align:center;font:400 13px/1.5 system-ui,sans-serif;color:var(--sub)}
.st .kaki p{margin:4px 0}
.st .peringatan{color:var(--kuning)}
`
