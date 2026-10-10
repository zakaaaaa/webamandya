/*
 * stamp.css.ts - gaya halaman /stamp.
 *
 * Kulit halaman mengikuti /dlogok (merah brand, krem, Bristol + League
 * Spartan). Papan gabusnya sendiri adalah gambar (public/stamp/papan.png),
 * jadi desain papan bisa diganti tanpa menyentuh CSS ini.
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
  --merah:#C23A2A;--merah-t:#D34A33;--merah-g:#A12A1B;--krem:#FFF6E6;--kuning:#FFE3A6;--gelap:#2B1D12;
  --sub:rgba(252,233,206,.86);
  min-height:100vh;color:var(--krem);overflow-x:hidden;padding-bottom:48px;
  background:
    radial-gradient(circle,rgba(110,24,16,.16) 1.6px,transparent 2px) 0 0/22px 22px,
    radial-gradient(ellipse 110% 700px at 50% 200px,var(--merah-t) 0%,var(--merah) 55%,transparent 100%) top/100% 1200px no-repeat,
    linear-gradient(var(--merah),var(--merah-g));
  font-family:'LeagueSpartan',system-ui,sans-serif;font-weight:700;-webkit-font-smoothing:antialiased;
}
.st *{box-sizing:border-box}
.st > *{max-width:460px;margin-inline:auto;padding-inline:16px}
.st .disp{font-family:'Bristol',cursive;font-weight:400;line-height:1}
.st .lab{font-family:'LeagueSpartan',sans-serif;font-weight:700;letter-spacing:.14em}

.st .kepala{text-align:center;padding-top:22px}
.st .logo{width:120px;height:auto;margin:0 auto 14px;display:block;filter:drop-shadow(0 4px 10px rgba(70,10,4,.3))}
.st .kecil{font-size:12px;color:var(--kuning);margin:0}
.st h1{font-size:46px;margin:8px 0 10px;color:var(--krem);text-shadow:0 4px 14px rgba(70,10,4,.3)}
.st .sub{font-size:15px;line-height:1.45;color:var(--sub);margin:0 auto;max-width:360px;font-weight:400;font-family:system-ui,sans-serif}

/* ── Hitungan stamp ── */
.st .hitung{display:flex;justify-content:center;gap:8px;margin-top:20px}
.st .hitung span{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:15px;
  border:2px dashed rgba(255,246,230,.55);color:rgba(255,246,230,.7)}
.st .hitung span.isi{border:0;background:var(--kuning);color:var(--merah);font-size:22px;box-shadow:0 4px 12px rgba(70,10,4,.3);
  animation:cap .5s cubic-bezier(.3,1.6,.5,1)}
.st .hitung .hadiah{width:auto;padding:0 12px;border-radius:22px;border:2px solid var(--krem);color:var(--krem);font-size:12px;letter-spacing:.12em}
@keyframes cap{from{transform:scale(1.8) rotate(-20deg);opacity:0}}

/* ── Papan ── */
.st .bingkai{margin-top:18px}
.st .papan{position:relative;width:100%;container-type:inline-size;border-radius:14px;overflow:hidden;
  box-shadow:0 18px 44px rgba(60,8,4,.4);background:#B9824F}
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


/* ── Pesan & form ── */
.st .pesan{margin:16px auto 0;padding:12px 16px;border-radius:14px;font-size:14px;line-height:1.4;text-align:center;max-width:428px;
  font-family:system-ui,sans-serif;font-weight:600}
.st .pesan.ok{background:var(--kuning);color:var(--gelap)}
.st .pesan.gagal{background:var(--gelap);color:var(--krem)}

.st .kartu-form{margin-top:18px;background:var(--krem);color:var(--gelap);border-radius:22px;padding:20px 18px;
  box-shadow:0 10px 30px rgba(70,10,4,.28);max-width:428px}
.st .kartu-form h2{margin:0 0 12px;font-size:13px;color:var(--merah)}
.st .baris{display:flex;gap:8px}
.st input{flex:1;min-width:0;height:50px;border-radius:14px;border:2px solid rgba(43,29,18,.15);background:#fff;padding:0 14px;
  font:600 15px system-ui,sans-serif;color:var(--gelap);outline:none}
.st input:focus{border-color:var(--merah)}
.st .kecil-btn{height:50px;padding:0 16px;border-radius:14px;border:0;background:var(--gelap);color:var(--krem);
  font:700 13px 'LeagueSpartan',sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.st .kecil-btn:disabled{opacity:.45}
.st .tombol{display:flex;width:100%;align-items:center;justify-content:center;min-height:52px;margin-top:12px;padding:14px 20px 11px;
  border-radius:40px;border:0;background:var(--merah);color:var(--krem);font:700 15px 'LeagueSpartan',sans-serif;letter-spacing:.12em;
  text-transform:uppercase;cursor:pointer;box-shadow:0 6px 18px rgba(160,30,15,.3);transition:transform .15s}
.st .tombol:active{transform:translateY(2px) scale(.98)}
.st .tombol:disabled{opacity:.5;cursor:default}
.st .tombol.garis{background:transparent;color:var(--merah);box-shadow:inset 0 0 0 2px var(--merah)}

.st .bantuan{margin-top:14px;font:400 14px/1.5 system-ui,sans-serif}
.st .bantuan summary{cursor:pointer;font-weight:700;color:var(--merah)}
.st .bantuan ol,.st .langkah{padding-left:20px;margin:10px 0 0}
.st .langkah{font:400 14px/1.5 system-ui,sans-serif}
.st .langkah li{margin-bottom:16px}
.st .langkah li::marker{font-weight:700;color:var(--merah)}
.st .langkah b{font-weight:700}
.st .langkah .baris{margin-top:10px}
.st .tunggu{margin:4px 0 0;padding:12px 14px;border-radius:14px;background:#FCE9CE;font:400 14px/1.45 system-ui,sans-serif}

.st .voucher{text-align:center}
.st .kode-voucher{display:block;width:100%;margin:6px 0 10px;padding:18px 10px 14px;border-radius:16px;border:3px dashed var(--merah);
  background:#fff;color:var(--merah);font:700 30px 'LeagueSpartan',monospace;letter-spacing:.12em;cursor:pointer}
.st .voucher p{font:400 14px/1.45 system-ui,sans-serif;margin:0}

.st .kaki{margin-top:22px;text-align:center;font:400 13px/1.5 system-ui,sans-serif;color:var(--sub)}
.st .kaki p{margin:4px 0}
.st .kaki b{color:var(--krem);letter-spacing:.06em}
.st .peringatan{color:var(--kuning)}
`
