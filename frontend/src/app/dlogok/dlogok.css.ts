/*
 * dlogok.css.ts - gaya halaman /dlogok.
 *
 * Menyalin bahasa visual layar idle kios dan tent card: merah brand #C23A2A
 * dengan sorot & pola titik, Bristol untuk judul, League Spartan untuk label,
 * krem #FFF6E6 dan kuning #FFE3A6. Satu tema saja (poster fisik juga satu).
 * Mobile-first: kolom 460 px di tengah, latar merah memenuhi layar.
 *
 * Bayangan sengaja lembut & tipis (blur + sedikit menyebar), bukan bayangan
 * keras bergeser seperti di kios — di layar HP yang kecil, bayangan keras
 * terasa kaku.
 */
export const DLOGOK_CSS = `
/* Hanya dimuat di halaman ini: tepi layar ikut merah, tanpa margin bawaan. */
html,body{margin:0;padding:0;background:#A12A1B}
@font-face{font-family:'Bristol';src:url('/dlogok/Bristol.otf') format('opentype');font-display:swap}
@font-face{font-family:'LeagueSpartan';src:url('/dlogok/LeagueSpartan-Bold.ttf') format('truetype');font-weight:700;font-display:swap}

.dl{
  --merah:#C23A2A;--merah-t:#D34A33;--merah-g:#A12A1B;--krem:#FFF6E6;--kuning:#FFE3A6;
  --sub:rgba(252,233,206,.86);--gelap:#2B1D12;
  --bayang-1:0 4px 14px rgba(80,12,4,.22);
  --bayang-2:0 10px 30px rgba(70,10,4,.28);
  --bayang-3:0 18px 44px rgba(60,8,4,.34);
  --bintang:polygon(100% 50%,96.3% 62.2%,97% 67.1%,91.3% 76.2%,89.3% 82.1%,79.6% 87%,75% 93.3%,64.2% 94.3%,58.8% 99.2%,50% 93%,41.2% 99.2%,35.8% 94.3%,25% 93.3%,20.4% 87%,10.7% 82.1%,8.7% 76.2%,3% 67.1%,3.7% 62.2%,0% 50%,3.7% 37.8%,3% 32.9%,8.7% 23.8%,10.7% 17.9%,20.4% 13%,25% 6.7%,35.8% 5.7%,41.2% 0.8%,50% 7%,58.8% 0.8%,64.2% 5.7%,75% 6.7%,79.6% 13%,89.3% 17.9%,91.3% 23.8%,97% 32.9%,96.3% 37.8%);
  min-height:100vh;color:var(--krem);overflow-x:hidden;
  /* Tanpa background-attachment:fixed — iOS Safari mengabaikannya. Sorot
     terang hanya di layar pertama, sisanya merah rata sampai bawah. */
  background:
    radial-gradient(circle,rgba(110,24,16,.16) 1.6px,transparent 2px) 0 0/22px 22px,
    radial-gradient(ellipse 110% 900px at 50% 260px,var(--merah-t) 0%,var(--merah) 55%,transparent 100%) top/100% 1400px no-repeat,
    linear-gradient(var(--merah),var(--merah-g));
  font-family:'LeagueSpartan',system-ui,sans-serif;font-weight:700;
  -webkit-font-smoothing:antialiased;
}
.dl *{box-sizing:border-box}
.dl img{display:block;max-width:100%}
.dl .disp{font-family:'Bristol',cursive;font-weight:400;line-height:1}
.dl .lab{font-family:'LeagueSpartan',sans-serif;font-weight:700;letter-spacing:.14em}
.dl > *{max-width:460px;margin-inline:auto;padding-inline:20px}

/* ── Tombol ── */
.dl .aksi{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px}
.dl .tombol{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:14px 24px 11px;
  border-radius:40px;background:var(--krem);color:var(--merah);text-decoration:none;font-size:15px;letter-spacing:.12em;
  text-transform:uppercase;box-shadow:var(--bayang-2);transition:transform .15s,box-shadow .15s}
.dl .tombol:active{transform:translateY(2px) scale(.98);box-shadow:var(--bayang-1)}
.dl .tombol.garis{background:rgba(255,246,230,.06);color:var(--krem);box-shadow:inset 0 0 0 2px rgba(255,246,230,.85),var(--bayang-1)}
.dl .tombol.tengah{display:flex;width:max-content;margin:26px auto 0;font:inherit;font-size:15px;letter-spacing:.12em;border:0;cursor:pointer}

/* ── Stiker bergerigi ── */
.dl .stiker{position:absolute;width:120px;height:120px;filter:drop-shadow(0 6px 12px rgba(70,10,4,.3))}
.dl .stiker-isi{position:absolute;inset:0;clip-path:var(--bintang);background:var(--kuning);color:var(--merah);
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.dl .stiker-isi .lab{font-size:11px}
.dl .stiker-isi .disp{font-size:26px;line-height:1.02;margin-top:2px}

/* ── Angka harga "Rp 20 K /SESI" ── */
.dl .harga{display:inline-flex;align-items:flex-start;color:var(--merah);gap:3px;line-height:1}
.dl .harga .rp{font-size:20px;margin-top:10px}
.dl .harga .angka{font-family:'Bristol',cursive;font-weight:400;font-size:74px;line-height:.9}
.dl .harga .k{display:flex;flex-direction:column;margin-top:4px}
.dl .harga .k b{font-size:44px;line-height:.9}
.dl .harga .k i{font-style:normal;font-size:10px;letter-spacing:.14em;margin-top:4px}

/* ───────── HERO ───────── */
.dl .hero{position:relative;padding-top:26px;padding-bottom:30px;text-align:center}
.dl .sinar{position:absolute;left:50%;top:380px;width:1100px;height:1100px;margin:-550px 0 0 -550px;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,rgba(255,227,166,.14) 0deg 8deg,transparent 8deg 20deg);
  -webkit-mask:radial-gradient(circle,#000 12%,transparent 58%);mask:radial-gradient(circle,#000 12%,transparent 58%);
  animation:putar 60s linear infinite;z-index:0}
.dl .hero > *:not(.sinar){position:relative;z-index:1}
.dl .logo-duo{display:flex;align-items:center;justify-content:center;gap:12px}
.dl .logo-duo .logo-pk{width:52px;transform:rotate(-4deg)}
.dl .logo-duo .logo-dl{width:104px}
.dl .logo-duo .kali{color:var(--sub);font-size:16px}
.dl .judul{margin:22px 0 0;font-family:'Bristol',cursive;font-weight:400;font-size:clamp(40px,12.4vw,68px);line-height:1.08}
.dl .judul .baris{display:block;white-space:nowrap;animation:naik .7s cubic-bezier(.2,.8,.2,1) both}
.dl .judul .b2{color:var(--kuning);animation-delay:.15s}

.dl .kipas{position:relative;height:330px;margin-top:22px}
.dl .kp{position:absolute;top:10px;width:30%;border-radius:4px;box-shadow:var(--bayang-3);animation:masuk .9s cubic-bezier(.2,1.3,.4,1) both, apung 4s ease-in-out infinite}
.dl .kp1{left:6%;--r:-8deg;animation-delay:.2s,1.1s}
.dl .kp2{left:35%;top:0;--r:-1deg;animation-delay:.32s,1.6s}
.dl .kp3{left:64%;--r:6deg;animation-delay:.44s,2.1s}
.dl .st-promo{right:-6px;top:-18px;width:112px;height:112px;animation:cap .6s .9s cubic-bezier(.2,1.5,.4,1) both, goyang 3s 1.5s ease-in-out infinite}

.dl .label-harga{position:relative;display:inline-flex;align-items:center;gap:10px;padding:14px 24px 12px 46px;
  background:var(--krem);color:var(--merah);clip-path:polygon(0 50%,26px 0,100% 0,100% 100%,26px 100%);
  transform:rotate(-4deg);animation:cap .6s 1.1s cubic-bezier(.2,1.5,.4,1) both;z-index:2}
.dl .label-harga::before{content:'';position:absolute;left:13px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:var(--merah)}
.dl .label-harga .mulai{font-size:12px;writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:.2em}
.dl .label-bungkus{position:relative;z-index:2;margin-top:-54px;filter:drop-shadow(0 8px 14px rgba(70,10,4,.32))}

/* ───────── BLOK UMUM ───────── */
.dl .blok{padding-top:30px;padding-bottom:30px}
.dl .sub-judul{font-family:'Bristol',cursive;font-weight:400;font-size:clamp(34px,10.4vw,44px);line-height:1.08;margin:0 0 20px;text-align:center}
.dl .keterangan{font-family:system-ui,sans-serif;font-weight:500;color:var(--sub);text-align:center;font-size:15px;margin:14px 0 0;letter-spacing:0}
.dl [data-muncul]{opacity:0;transform:translateY(26px);transition:opacity .6s ease,transform .7s cubic-bezier(.2,.8,.2,1)}
.dl [data-muncul].tampak{opacity:1;transform:none}

/* ───────── SIMULASI ───────── */
.dl .bidik{position:relative;border-radius:16px;overflow:hidden;aspect-ratio:3/2;background:#0b0504;box-shadow:var(--bayang-3)}
.dl .bidik-video{width:100%;height:100%;object-fit:cover}
.dl .sudut{position:absolute;width:30px;height:30px;border:3px solid var(--krem)}
.dl .s1{left:12px;top:12px;border-right:0;border-bottom:0}.dl .s2{right:12px;top:12px;border-left:0;border-bottom:0}
.dl .s3{left:12px;bottom:12px;border-right:0;border-top:0}.dl .s4{right:12px;bottom:12px;border-left:0;border-top:0}
.dl .rec{position:absolute;left:24px;top:20px;display:flex;align-items:center;gap:6px;font-size:12px}
.dl .rec i{width:9px;height:9px;border-radius:50%;background:#FF4A3A;box-shadow:0 0 8px #FF4A3A;animation:kedip 1s steps(1) infinite}
.dl .hitung{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.dl .hitung b{grid-area:1/1;font-weight:400;font-size:130px;color:var(--krem);text-shadow:0 6px 24px rgba(0,0,0,.55);opacity:0;animation:angka 5s infinite}
.dl .hitung b:nth-child(2){animation-delay:.7s}.dl .hitung b:nth-child(3){animation-delay:1.4s}
.dl .blitz{position:absolute;inset:0;background:#FFF9EE;opacity:0;animation:blitz 5s infinite}

/* ───────── PAKET ───────── */
.dl .paket{position:relative;display:grid;grid-template-columns:44% 1fr;gap:16px;align-items:center;margin-top:18px;padding:18px;
  background:var(--krem);color:var(--merah);border-radius:22px;box-shadow:var(--bayang-3)}
.dl .paket h3{margin:0;font-size:clamp(26px,8vw,34px);color:var(--gelap)}
.dl .paket-gambar{position:relative;height:210px}
.dl .pg-strip{position:absolute;top:6px;width:48%;border-radius:3px;box-shadow:var(--bayang-2)}
.dl .m1{left:4%;transform:rotate(-7deg)}.dl .m2{left:46%;transform:rotate(5deg);top:12px}
.dl .m3{left:54%;top:20px;transform:rotate(6deg);width:44%}
.dl .dapat{list-style:none;padding:0;margin:10px 0 0;display:flex;flex-wrap:wrap;gap:6px}
.dl .dapat li{font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:7px 10px 5px;border-radius:10px;background:var(--merah);color:var(--krem);box-shadow:var(--bayang-1)}
.dl .dapat li.digital{background:rgba(194,58,42,.1);color:var(--merah);box-shadow:none}
.dl .st-kartu{left:-14px;top:-24px;width:88px;height:88px;transform:rotate(-12deg);z-index:2}
.dl .st-kartu .stiker-isi .disp{font-size:20px}.dl .st-kartu .stiker-isi .lab{font-size:9px}

/* kartu newspaper: gambar + judul di atas, dua pilihan kertas berdampingan, lalu isi paket */
.dl .paket.koran{display:block}
.dl .koran-atas{display:grid;grid-template-columns:40% 1fr;gap:16px;align-items:center}
.dl .pg-koran{width:100%;height:auto;transform:rotate(-4deg);box-shadow:var(--bayang-2);border-radius:2px}
.dl .catatan{font-family:system-ui,sans-serif;font-weight:500;font-size:14px;line-height:1.4;color:var(--gelap);opacity:.75;margin:8px 0 0;letter-spacing:0}
.dl .pilih-kertas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
.dl .kertas{background:#fff;border-radius:16px;padding:12px 10px 8px;text-align:center;box-shadow:var(--bayang-1)}
.dl .kertas .jenis{display:block;font-size:11px;color:var(--gelap);opacity:.7;margin-bottom:2px}
.dl .kertas .harga .angka{font-size:56px}.dl .kertas .harga .k b{font-size:32px}.dl .kertas .harga .rp{font-size:17px}
.dl .paket.koran .dapat{margin-top:14px;justify-content:center}

/* gantungan kunci */
.dl .kunci-wrap{overflow:visible}
.dl .kunci{position:absolute;left:0;top:-4px;width:92px;height:220px;transform-origin:46px 16px;animation:ayun 3.2s ease-in-out infinite;z-index:1}
.dl .kunci .ring{position:absolute;left:28px;top:0;width:36px;height:36px;border-radius:50%;border:4px solid #c9c9ce;box-shadow:inset 0 0 0 1px #8d8d93}
.dl .kunci .rantai{position:absolute;left:44px;top:34px;width:4px;height:26px;border-radius:2px;background:repeating-linear-gradient(#d9d9de 0 3px,#8d8d93 3px 5px)}
.dl .kunci .plat{position:absolute;left:4px;top:58px;width:84px;height:190px;border-radius:12px;background:rgba(255,255,255,.35);
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.9),var(--bayang-2);border:1px solid rgba(194,58,42,.25)}
.dl .kunci .lubang{position:absolute;left:36px;top:6px;width:12px;height:12px;border-radius:50%;background:rgba(160,40,30,.45)}
.dl .kunci .plat img{position:absolute;left:7px;top:23px;width:70px;height:160px;border-radius:3px;object-fit:cover}
.dl .kunci .kilap{position:absolute;inset:0;border-radius:12px;background:linear-gradient(115deg,rgba(255,255,255,.55),rgba(255,255,255,0) 35%,rgba(255,255,255,0) 70%,rgba(255,255,255,.2))}

/* ───────── HASIL ───────── */
.dl .hasil{max-width:none;padding-inline:0}
.dl .hasil > .sub-judul,.dl .hasil > .gerak{max-width:460px;margin-inline:auto;padding-inline:20px}
.dl .pita{display:flex;flex-direction:column;gap:14px;overflow:hidden;padding:10px 0 22px;transform:rotate(-3deg);margin-top:8px;
  /* tepi kiri-kanan memudar supaya potongan strip di pinggir layar tidak kaku */
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 14%,#000 86%,transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 14%,#000 86%,transparent 100%)}
.dl .pita-jalan{display:flex;gap:12px;width:max-content;animation:jalan 44s linear infinite}
.dl .pita-jalan.balik{animation-direction:reverse;animation-duration:50s}
.dl .pita-strip{width:140px;height:auto;aspect-ratio:340/1018;border-radius:4px;box-shadow:var(--bayang-2)}
.dl .gerak{display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:22px}
.dl .gerak figure{margin:0;background:var(--krem);border-radius:18px;padding:8px 8px 10px;box-shadow:var(--bayang-2)}
.dl .gerak-gif{width:100%}
.dl .gerak-gif img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:12px;background:#0b0504}
.dl .gerak-vid{width:72%}
.dl .gerak-video{display:block;width:100%;aspect-ratio:688/1030;object-fit:cover;border-radius:12px;background:#0b0504}
.dl .gerak figcaption{color:var(--merah);font-size:12px;text-align:center;margin-top:8px}

/* ───────── FRAME ───────── */
.dl .tab{display:flex;gap:8px;justify-content:center;margin-bottom:18px;flex-wrap:wrap}
.dl .tab button{font:inherit;font-size:13px;letter-spacing:.1em;text-transform:uppercase;padding:11px 16px 8px;border-radius:30px;border:0;
  background:rgba(255,246,230,.14);color:var(--krem);cursor:pointer;min-height:44px}
.dl .tab button small{opacity:.7;font-size:11px;margin-left:3px}
.dl .tab button.aktif{background:var(--krem);color:var(--merah);box-shadow:var(--bayang-2)}
.dl .katalog{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.dl .frame{margin:0;background:var(--krem);border-radius:12px;padding:6px;box-shadow:var(--bayang-1)}
.dl .frame-kanvas{position:relative;width:100%;border-radius:6px;overflow:hidden;background:#fff}
.dl .frame-kanvas img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}
.dl .slot{position:absolute;border:1.5px solid;display:grid;place-items:center;transform-origin:center}
.dl .slot b{color:#fff;font-family:system-ui,sans-serif;font-weight:900;font-size:12px;line-height:1;text-shadow:0 0 4px rgba(0,0,0,.8)}
.dl .frame figcaption{color:var(--gelap);font-size:11px;text-align:center;margin-top:6px;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ───────── CARA ───────── */
.dl .langkah{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}
.dl .langkah li{display:flex;gap:14px;align-items:center;background:rgba(255,246,230,.1);border-radius:18px;padding:14px 16px;box-shadow:inset 0 0 0 1px rgba(255,246,230,.16),var(--bayang-1)}
.dl .langkah .nomor{flex:none;width:56px;height:56px;border-radius:50%;background:var(--kuning);color:var(--merah);display:grid;place-items:center;font-size:36px;box-shadow:var(--bayang-2)}
.dl .langkah h3{margin:0;font-size:16px;letter-spacing:.08em;text-transform:uppercase}
.dl .langkah p{margin:4px 0 0;font-family:system-ui,sans-serif;font-weight:500;font-size:14px;line-height:1.45;color:var(--sub)}

/* ───────── PENUTUP ───────── */
.dl .penutup{text-align:center;padding-top:30px;padding-bottom:60px}
.dl .ajak{font-size:64px;margin:0}
.dl .logo-duo.kecil{margin-top:34px;opacity:.9}
.dl .logo-duo.kecil .logo-pk{width:44px}.dl .logo-duo.kecil .logo-dl{width:88px}

/* ───────── ANIMASI ───────── */
@keyframes naik{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes masuk{from{opacity:0;transform:translateY(160px) rotate(0)}to{opacity:1;transform:rotate(var(--r))}}
@keyframes apung{0%,100%{translate:0 0}50%{translate:0 -7px}}
@keyframes cap{0%{opacity:0;scale:2.2;rotate:-14deg}60%{opacity:1;scale:.94}100%{opacity:1;scale:1;rotate:0deg}}
@keyframes goyang{0%,100%{rotate:0deg}50%{rotate:8deg}}
@keyframes ayun{0%,100%{rotate:-5deg}50%{rotate:5deg}}
@keyframes putar{to{rotate:360deg}}
@keyframes jalan{to{transform:translateX(-50%)}}
@keyframes kedip{50%{opacity:.15}}
@keyframes angka{0%,1%{opacity:0;scale:1.5}4%{opacity:1;scale:1}11%{opacity:1;scale:.95}14%,100%{opacity:0;scale:.8}}
@keyframes blitz{0%,41%{opacity:0}42%{opacity:1}56%,100%{opacity:0}}

@media (prefers-reduced-motion: reduce){
  .dl *,.dl *::before{animation:none!important;transition:none!important}
  .dl [data-muncul]{opacity:1;transform:none}
}
@media (min-width:720px){
  .dl .judul{font-size:74px}
}
`
