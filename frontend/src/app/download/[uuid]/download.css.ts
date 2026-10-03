/*
 * download.css.ts - gaya halaman /download/[uuid].
 *
 * Satu bahasa visual dengan /dlogok, layar idle kios, dan tent card: merah
 * brand dengan pola titik & sorot, Bristol untuk judul besar, League Spartan
 * untuk label, kartu krem, stiker bintang kuning, bayangan lembut.
 *
 * Catatan Bristol: huruf "b" kecilnya terbaca seperti "l" — teks Bristol di
 * halaman ini sengaja dipilih tanpa huruf b.
 */
export const DOWNLOAD_CSS = `
html,body{margin:0;padding:0;background:#A12A1B}
@font-face{font-family:'Bristol';src:url('/dlogok/Bristol.otf') format('opentype');font-display:swap}
@font-face{font-family:'LeagueSpartan';src:url('/dlogok/LeagueSpartan-Bold.ttf') format('truetype');font-weight:700;font-display:swap}

.dw{
  --merah:#C23A2A;--merah-t:#D34A33;--merah-g:#A12A1B;--krem:#FFF6E6;--kuning:#FFE3A6;
  --sub:rgba(252,233,206,.86);--gelap:#2B1D12;--abu:#8A6F60;
  --bayang-1:0 4px 14px rgba(80,12,4,.22);
  --bayang-2:0 10px 30px rgba(70,10,4,.28);
  --bayang-3:0 18px 44px rgba(60,8,4,.34);
  --bintang:polygon(100% 50%,96.3% 62.2%,97% 67.1%,91.3% 76.2%,89.3% 82.1%,79.6% 87%,75% 93.3%,64.2% 94.3%,58.8% 99.2%,50% 93%,41.2% 99.2%,35.8% 94.3%,25% 93.3%,20.4% 87%,10.7% 82.1%,8.7% 76.2%,3% 67.1%,3.7% 62.2%,0% 50%,3.7% 37.8%,3% 32.9%,8.7% 23.8%,10.7% 17.9%,20.4% 13%,25% 6.7%,35.8% 5.7%,41.2% 0.8%,50% 7%,58.8% 0.8%,64.2% 5.7%,75% 6.7%,79.6% 13%,89.3% 17.9%,91.3% 23.8%,97% 32.9%,96.3% 37.8%);
  position:relative;min-height:100dvh;color:var(--krem);overflow-x:hidden;
  background:
    radial-gradient(circle,rgba(110,24,16,.16) 1.6px,transparent 2px) 0 0/22px 22px,
    radial-gradient(ellipse 110% 800px at 50% 220px,var(--merah-t) 0%,var(--merah) 55%,transparent 100%) top/100% 1200px no-repeat,
    linear-gradient(var(--merah),var(--merah-g));
  font-family:'LeagueSpartan',system-ui,sans-serif;font-weight:700;-webkit-font-smoothing:antialiased;
}
.dw *,.dw *::before,.dw *::after{box-sizing:border-box}
.dw img{display:block;max-width:100%}
.dw p,.dw h1,.dw h2,.dw h3,.dw ul{margin:0;padding:0}
.dw .disp{font-family:'Bristol',cursive;font-weight:400;line-height:1}
.dw .lab{font-family:'LeagueSpartan',sans-serif;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.dw .teks{font-family:system-ui,sans-serif;font-weight:500;letter-spacing:0}
.dw .isi{position:relative;z-index:1;max-width:460px;margin-inline:auto;padding:26px 20px 64px}

.dw .sinar{position:absolute;left:50%;top:150px;width:1000px;height:1000px;margin:-500px 0 0 -500px;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,rgba(255,227,166,.13) 0deg 8deg,transparent 8deg 20deg);
  -webkit-mask:radial-gradient(circle,#000 10%,transparent 55%);mask:radial-gradient(circle,#000 10%,transparent 55%);
  animation:dw-putar 60s linear infinite;z-index:0}

/* ── Kepala ── */
.dw .kepala{text-align:center}
.dw .logo-duo{display:flex;align-items:center;justify-content:center;gap:12px}
.dw .logo-duo .logo-pk{width:52px;transform:rotate(-4deg)}
.dw .logo-duo .logo-dl{width:104px}
.dw .logo-duo .kali{color:var(--sub);font-size:16px}
.dw .judul{margin-top:20px;font-family:'Bristol',cursive;font-weight:400;font-size:clamp(42px,12.6vw,64px);line-height:1.06}
.dw .judul span{display:block;white-space:nowrap;animation:dw-naik .7s cubic-bezier(.2,.8,.2,1) both}
.dw .judul span:nth-child(2){color:var(--kuning);animation-delay:.12s}
.dw .tanggal{display:inline-block;margin-top:14px;padding:8px 14px 6px;border-radius:30px;background:rgba(255,246,230,.12);
  box-shadow:inset 0 0 0 1px rgba(255,246,230,.22);color:var(--sub);font-size:11px}

/* ── Judul blok ── */
.dw .blok{margin-top:44px}
.dw .sub-judul{font-family:'Bristol',cursive;font-weight:400;font-size:clamp(34px,10vw,42px);line-height:1.05;text-align:center}
.dw .sub-ket{display:block;margin-top:6px;text-align:center;color:var(--sub);font-size:11px}

/* ── Kartu krem ── */
.dw .kartu{position:relative;background:var(--krem);color:var(--merah);border-radius:22px;box-shadow:var(--bayang-3)}

/* ── Tombol ── */
.dw .tombol{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:54px;padding:15px 22px 12px;
  border:0;border-radius:40px;background:var(--krem);color:var(--merah);font:inherit;font-size:15px;letter-spacing:.12em;
  text-transform:uppercase;cursor:pointer;box-shadow:var(--bayang-2);transition:transform .15s,box-shadow .15s}
.dw .tombol:active:not(:disabled){transform:translateY(2px) scale(.98);box-shadow:var(--bayang-1)}
.dw .tombol:disabled{opacity:.6;cursor:default}
.dw .tombol.kuning{background:var(--kuning)}
.dw .tombol.garis{background:rgba(255,246,230,.06);color:var(--krem);box-shadow:inset 0 0 0 2px rgba(255,246,230,.85),var(--bayang-1)}
.dw .tombol.merah{background:var(--merah);color:var(--krem);box-shadow:var(--bayang-1)}
.dw .tombol.kecil{min-height:42px;padding:11px 14px 8px;font-size:12px;letter-spacing:.1em;gap:7px}
.dw .tombol.lunak{background:rgba(194,58,42,.1);color:var(--merah);box-shadow:none}
.dw button:focus-visible{outline:3px solid var(--kuning);outline-offset:3px}

/* ── Stiker bergerigi ── */
.dw .stiker{position:absolute;width:104px;height:104px;z-index:3;filter:drop-shadow(0 6px 12px rgba(70,10,4,.32))}
.dw .stiker-isi{position:absolute;inset:0;clip-path:var(--bintang);background:var(--kuning);color:var(--merah);
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.dw .stiker-isi .lab{font-size:9.5px}
.dw .stiker-isi .disp{font-size:24px;margin-top:2px}

/* ── Progres media (foto "muncul") ── */
.dw .muncul{display:flex;gap:16px;align-items:center;padding:18px}
.dw .muncul-foto{flex:none;width:118px;background:#fff;padding:6px 6px 4px;border-radius:6px;box-shadow:var(--bayang-1);transform:rotate(-4deg)}
.dw .muncul-foto .gbr{aspect-ratio:1;background:#2B1D12;border-radius:3px;overflow:hidden}
.dw .muncul-foto .gbr img{width:100%;height:100%;object-fit:cover;object-position:center top;transition:opacity .7s,filter .7s}
.dw .muncul-foto .persen{font-family:'Bristol',cursive;font-size:28px;text-align:center;color:var(--merah);line-height:1.2}
.dw .muncul h3{font-size:17px;letter-spacing:.04em;color:var(--gelap);line-height:1.2}
.dw .muncul .teks{font-size:13px;line-height:1.45;color:var(--abu);margin-top:6px}
.dw .langkah{list-style:none;display:flex;flex-wrap:wrap;gap:6px;padding:0 18px 18px;justify-content:center}
.dw .langkah li{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  padding:7px 10px 5px;border-radius:10px;background:rgba(194,58,42,.1);color:rgba(194,58,42,.6)}
.dw .langkah li.selesai{background:var(--merah);color:var(--krem);box-shadow:var(--bayang-1)}
.dw .langkah li.jalan{background:var(--kuning);color:var(--merah)}

/* ── Printer ── */
.dw .cetak{text-align:center}
.dw .printer{position:relative;width:240px;margin:6px auto 0}
.dw .printer-baki{width:150px;height:30px;margin:0 auto;position:relative;overflow:hidden}
.dw .printer-baki span{position:absolute;left:12px;right:12px;top:4px;bottom:-6px;background:#fff;border-radius:3px 3px 0 0;box-shadow:0 0 0 1px rgba(0,0,0,.06)}
.dw .printer-badan{position:relative;z-index:2;height:90px;border-radius:22px 22px 14px 14px;
  background:linear-gradient(#FFF9EF,#F1E2C8);box-shadow:inset 0 2px 0 #fff,inset 0 -3px 0 rgba(160,110,60,.18),var(--bayang-2)}
.dw .printer.jalan .printer-badan{animation:dw-dengung .14s linear infinite}
.dw .printer-layar{position:absolute;left:18px;top:20px;min-width:52px;height:26px;padding:3px 7px 0;border-radius:7px;background:#2B1D12;
  color:var(--kuning);font-size:13px;letter-spacing:.06em;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 3px rgba(0,0,0,.6)}
.dw .printer-merk{position:absolute;right:40px;top:23px;font-size:10px;letter-spacing:.14em;color:var(--merah);opacity:.75}
.dw .led{position:absolute;right:18px;top:27px;width:10px;height:10px;border-radius:50%}
.dw .led.jalan{background:#3DDC84;box-shadow:0 0 8px #3DDC84;animation:dw-kedip 1s steps(1) infinite}
.dw .led.ok{background:#3DDC84;box-shadow:0 0 8px #3DDC84}
.dw .led.awas{background:#FFB020;box-shadow:0 0 8px #FFB020;animation:dw-kedip .6s steps(1) infinite}
.dw .printer-mulut{position:absolute;left:24px;right:24px;bottom:-1px;height:14px;border-radius:8px 8px 0 0;background:#3A1E14;box-shadow:inset 0 3px 4px rgba(0,0,0,.6)}
.dw .keluar{position:relative;z-index:1;width:160px;height:240px;margin:-6px auto 0;overflow:hidden;padding-bottom:0}
.dw .keluar-bayang{position:absolute;inset:8px 0 0;border:2px dashed rgba(255,246,230,.35);border-radius:6px;display:flex;align-items:flex-end;justify-content:center;padding:0 10px 14px}
.dw .keluar-bayang span{font-size:9.5px;color:var(--sub);line-height:1.4}
.dw .lembar-gerak{position:relative;width:100%;height:100%;transition:transform .6s linear}
.dw .lembar{width:100%;height:100%;background:#fff;padding:6px;border-radius:2px;box-shadow:var(--bayang-2)}
.dw .lembar-grid{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:4px;width:100%;height:100%}
.dw .hitung-lembar{position:absolute;right:-4px;bottom:22px;font-size:10px;letter-spacing:.1em;background:var(--kuning);color:var(--merah);
  padding:6px 9px 4px;border-radius:20px;box-shadow:var(--bayang-1);transform:rotate(5deg)}
.dw .st-ambil{left:50%;top:44%;margin:-52px 0 0 -52px;animation:dw-cap .6s .3s cubic-bezier(.2,1.5,.4,1) both}
.dw .st-ambil.awas .stiker-isi{background:#FFF6E6}
.dw .cetak-judul{margin-top:16px;font-family:'Bristol',cursive;font-weight:400;font-size:clamp(36px,10.6vw,46px);line-height:1.05}
.dw .cetak-judul.ok{color:var(--kuning)}
.dw .cetak-angka{margin-top:8px;font-size:12px;color:var(--kuning)}
.dw .cetak-ket{margin:8px auto 0;max-width:320px;font-size:14px;line-height:1.5;color:var(--sub)}
.dw .bunyi{display:inline-flex;width:auto;margin-top:16px}
.dw .bunyi.siap{background:rgba(255,227,166,.16);color:var(--kuning);box-shadow:inset 0 0 0 2px rgba(255,227,166,.6)}
.dw .cetak-ringkas{display:flex;gap:14px;align-items:center;padding:14px 16px;text-align:left}
.dw .cetak-ringkas .mini{width:40px;height:60px;flex:none;transform:rotate(-5deg)}
.dw .cetak-ringkas h3{font-size:15px;letter-spacing:.06em;color:var(--gelap)}
.dw .cetak-ringkas .teks{font-size:13px;color:var(--abu);margin-top:3px;line-height:1.4}

/* ── Hasil utama ── */
.dw .utama{position:relative;margin:30px auto 0;background:var(--krem);padding:10px;border-radius:10px;box-shadow:var(--bayang-3);transform:rotate(-1.5deg)}
.dw .utama button{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in}
.dw .utama img{width:100%;border-radius:4px}
.dw .st-hasil{right:-16px;top:-22px;width:92px;height:92px;transform:rotate(12deg);animation:dw-goyang 3s ease-in-out infinite}
.dw .st-hasil .stiker-isi .disp{font-size:22px}

/* ── Foto asli ── */
.dw .kisi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}
.dw .kisi:has(> :nth-child(4)){grid-template-columns:repeat(2,minmax(0,1fr))}
.dw .kisi .foto:last-child:nth-child(odd){grid-column:1/-1;justify-self:center;width:calc(50% - 7px)}
.dw .foto{position:relative;margin:0;background:var(--krem);border-radius:14px;padding:6px;box-shadow:var(--bayang-2);cursor:zoom-in}
.dw .foto img{width:100%;aspect-ratio:1;object-fit:cover;object-position:center top;border-radius:9px}
.dw .foto figcaption{color:var(--merah);font-size:11px;letter-spacing:.12em;text-align:center;padding:7px 0 3px}
.dw .unduh-bulat{position:absolute;right:-6px;top:-6px;width:40px;height:40px;border-radius:50%;border:0;cursor:pointer;
  display:grid;place-items:center;background:var(--kuning);color:var(--merah);box-shadow:var(--bayang-2)}

/* ── GIF & video ── */
.dw .duo{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:14px;margin-top:20px}
.dw .media{margin:0;padding:8px 8px 10px;display:flex;flex-direction:column}
.dw .media-isi{aspect-ratio:3/4;background:#2B1D12;border-radius:14px;overflow:hidden;display:grid;place-items:center;color:var(--abu)}
.dw .media-isi img,.dw .media-isi video{width:100%;height:100%;object-fit:cover;object-position:center top}
.dw .media-isi video{object-fit:contain}
.dw .media h3{font-size:13px;letter-spacing:.12em;text-transform:uppercase;text-align:center;margin-top:10px;color:var(--merah)}
.dw .media .teks{font-size:11.5px;color:var(--abu);text-align:center;line-height:1.35;margin:3px 0 10px;flex:1}

/* ── Laporan & kaki ── */
.dw .lapor{margin-top:46px;text-align:center}
.dw .lapor-link{background:none;border:0;cursor:pointer;padding:8px 12px;color:var(--sub);font-size:14px;text-decoration:underline;text-underline-offset:4px}
.dw .terkirim{display:flex;gap:12px;align-items:flex-start;padding:16px 18px;text-align:left}
.dw .terkirim h3{font-size:14px;letter-spacing:.06em;color:var(--gelap)}
.dw .terkirim .teks{font-size:13px;color:var(--abu);margin-top:3px;line-height:1.45}
.dw .kaki{margin-top:40px;text-align:center}
.dw .kaki .logo-duo{opacity:.92}
.dw .kaki .logo-duo .logo-pk{width:44px}.dw .kaki .logo-duo .logo-dl{width:88px}
.dw .kaki code{display:block;margin-top:14px;font-size:10px;color:rgba(255,246,230,.45);font-family:ui-monospace,monospace}

/* ── Modal laporan ── */
.dw-scrim{position:fixed;inset:0;z-index:150;padding:20px;background:rgba(43,29,18,.6);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;animation:dw-pudar .15s ease both}
.dw-modal{width:100%;max-width:420px;max-height:min(88vh,88dvh);overflow-y:auto;background:#FFF6E6;color:#2B1D12;border-radius:22px;
  padding:26px 22px;box-shadow:0 18px 44px rgba(60,8,4,.4);animation:dw-naik .25s ease both;font-family:system-ui,sans-serif}
.dw-modal h2{font-family:'Bristol',cursive;font-weight:400;font-size:38px;line-height:1;color:#C23A2A;margin:0 0 8px}
.dw-modal .ket{font-size:13px;color:#8A6F60;line-height:1.55;margin:0 0 20px}
.dw-modal .label{display:block;font-family:'LeagueSpartan',sans-serif;font-weight:700;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8A6F60;margin-bottom:7px}
.dw-modal .field{width:100%;padding:12px 14px;border-radius:14px;border:1.5px solid rgba(194,58,42,.2);background:#fff;color:#2B1D12;font:500 15px system-ui,sans-serif;outline:none}
.dw-modal .field:focus{border-color:#C23A2A;box-shadow:0 0 0 3px rgba(194,58,42,.12)}
.dw-modal .chip{padding:9px 14px 7px;border-radius:20px;cursor:pointer;border:0;background:rgba(194,58,42,.1);color:#C23A2A;
  font-family:'LeagueSpartan',sans-serif;font-weight:700;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase}
.dw-modal .chip.aktif{background:#C23A2A;color:#FFF6E6}
.dw-modal .aksi{display:flex;gap:10px}
.dw-modal .btn{flex:1;min-height:50px;border-radius:40px;border:0;cursor:pointer;font-family:'LeagueSpartan',sans-serif;font-weight:700;
  font-size:13px;letter-spacing:.1em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:8px}
.dw-modal .btn.utama{flex:2;background:#C23A2A;color:#FFF6E6;box-shadow:0 4px 14px rgba(80,12,4,.22)}
.dw-modal .btn.batal{background:rgba(194,58,42,.1);color:#C23A2A}
.dw-modal .btn:disabled{opacity:.6;cursor:default}

.dw-lb{position:fixed;inset:0;z-index:200;background:rgba(43,29,18,.94);backdrop-filter:blur(10px);display:flex;align-items:center;
  justify-content:center;padding:20px;cursor:zoom-out;animation:dw-pudar .15s ease both}

@keyframes dw-spin{to{transform:rotate(360deg)}}
@keyframes dw-naik{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes dw-pudar{from{opacity:0}to{opacity:1}}
@keyframes dw-putar{to{rotate:360deg}}
@keyframes dw-kedip{50%{opacity:.2}}
@keyframes dw-dengung{0%,100%{transform:translateX(0)}50%{transform:translateX(.6px)}}
@keyframes dw-cap{0%{opacity:0;scale:2.2;rotate:-14deg}60%{opacity:1;scale:.94}100%{opacity:1;scale:1;rotate:0deg}}
@keyframes dw-goyang{0%,100%{rotate:0deg}50%{rotate:7deg}}
.dw .muter{animation:dw-spin .9s linear infinite}
.dw .masuk{animation:dw-naik .6s cubic-bezier(.2,.8,.2,1) both}
.dw .masuk-2{animation:dw-naik .6s .1s cubic-bezier(.2,.8,.2,1) both}

@media (prefers-reduced-motion: reduce){
  .dw *,.dw *::before,.dw-modal,.dw-scrim{animation:none!important;transition:none!important}
}
`
