/*
 * landing.css.ts - gaya halaman sewa photobooth.
 *
 * Disalin dari mockup statis. Token warna, tipografi, dan latar ambien
 * mengikuti dashboard (lihat globals.css dan (dashboard)/layout.tsx).
 * Logo diambil dari /public/logo-pk.webp, bukan base64 di dalam CSS.
 */
export const LANDING_CSS = `
/* ============================================================
   PABRIK KENANGAN — Landing (mockup statis)
   Sistem warna & tipografi mengikuti dashboard pabrikenangan.
   Angka, harga, dan nomor WA masih PLACEHOLDER.
   ============================================================ */

/* ── Token: terang (default) ── */
:root{
  --ground:#FAF7F5;
  --surface:#FFFFFF;
  --surface-2:#F4EDE9;
  --ink:#150C09;
  --ink-2:#4A2E22;
  --ink-3:#7A6259;
  --ink-4:#9E8880;
  --line:rgba(212,43,34,.12);
  --line-2:rgba(212,43,34,.22);
  --hair:rgba(21,12,9,.08);
  --red:#D42B22;
  --red-light:#E83530;
  --red-dark:#C02018;
  --red-wash:rgba(212,43,34,.06);
  --red-wash-2:rgba(212,43,34,.10);
  --ok:#059669;
  --warn:#D97706;
  --shadow-sm:0 2px 12px rgba(212,43,34,.06), 0 1px 3px rgba(0,0,0,.04);
  --shadow-md:0 12px 36px rgba(212,43,34,.10), 0 2px 10px rgba(0,0,0,.05);
  --shadow-lg:0 26px 70px rgba(180,30,20,.16), 0 6px 18px rgba(0,0,0,.07);

  /* Layar booth — identik di kedua tema (ini benda fisik) */
  --screen:#17100D;
  --screen-2:#241713;
  --screen-ink:#F7EFEB;
  --screen-ink-2:#C3ABA1;
  --screen-line:rgba(247,239,235,.14);
}

/* Halaman ini sengaja SATU TEMA saja — persis dashboard pabrikenangan,
   yang juga light-only. Tidak ada blok prefers-color-scheme: apapun tema
   perangkat pengunjung, latarnya tetap #FAF7F5 seperti dasbor. */

*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:102px;-webkit-text-size-adjust:100%}

body{
  margin:0;
  background:var(--ground);
  color:var(--ink);
  font-family:'Poppins',system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:15px;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}

img,svg{max-width:100%;display:block}
a{color:inherit}
button{font:inherit;color:inherit}

:focus-visible{
  outline:2px solid var(--red);
  outline-offset:3px;
  border-radius:6px;
}

/* ══════════ Primitif ══════════ */
.wrap{width:100%;max-width:1180px;margin:0 auto;padding:0 28px}

.mono{font-family:'IBM Plex Mono',ui-monospace,'SFMono-Regular',monospace}
.num{font-variant-numeric:tabular-nums}




h1,h2,h3,h4{margin:0;font-weight:800;letter-spacing:-.025em;text-wrap:balance;line-height:1.1}
h2{font-size:clamp(27px,3.4vw,42px);font-weight:900}
h3{font-size:19px;letter-spacing:-.015em}
p{margin:0}

.lede{color:var(--ink-3);font-size:15.5px;max-width:56ch;line-height:1.66}

.sec{padding:clamp(66px,8vw,104px) 0;position:relative}
.sec-head{display:flex;flex-direction:column;gap:14px;margin-bottom:40px;max-width:64ch}

/* ══════════ Latar ambien — angka disalin dari (dashboard)/layout.tsx ══════════ */
.amb{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.amb i{position:fixed;border-radius:50%;filter:blur(70px);display:block}
.amb i:nth-child(1){
  width:600px;height:600px;top:-150px;left:-150px;
  background:radial-gradient(circle,rgba(232,53,48,.06) 0%,transparent 70%);
  animation:float-1 18s ease-in-out infinite;
}
.amb i:nth-child(2){
  width:500px;height:500px;bottom:-100px;right:-100px;
  background:radial-gradient(circle,rgba(212,43,34,.05) 0%,transparent 70%);
  animation:float-2 22s ease-in-out infinite;
}
.amb i:nth-child(3){
  width:350px;height:350px;top:40%;left:40%;
  background:radial-gradient(circle,rgba(217,119,6,.04) 0%,transparent 70%);
  animation:float-3 26s ease-in-out infinite 4s;
}
.amb u{
  position:fixed;inset:0;display:block;
  background-image:linear-gradient(rgba(212,43,34,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(212,43,34,.025) 1px,transparent 1px);
  background-size:56px 56px;
}
@keyframes float-1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-25px)}}
@keyframes float-2{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,30px)}}
@keyframes float-3{0%,100%{transform:translate(0,0)}50%{transform:translate(15px,20px)}}

/* ══════════ Status bar (nav) ══════════ */
.statusbar{
  position:sticky;top:0;z-index:60;
  background:color-mix(in srgb,var(--ground) 86%,transparent);
  backdrop-filter:blur(18px) saturate(160%);
  -webkit-backdrop-filter:blur(18px) saturate(160%);
  border-bottom:1px solid var(--line);
}
.statusbar .wrap{display:flex;align-items:center;gap:22px;height:74px}

/* Logo asli Pabrik Kenangan (logo-pk.webp), disematkan sebagai data URI */
.logo{
  display:block;flex:none;
  background:url("/logo-pk.webp") left center/contain no-repeat;
}
.brand{display:flex;align-items:center;text-decoration:none;flex:none}
.brand .logo{width:86px;height:49px}

.navlinks{display:flex;align-items:center;gap:4px;margin-left:auto}
.navlinks a{
  padding:8px 13px;border-radius:9px;text-decoration:none;
  font-size:13.5px;font-weight:600;color:var(--ink-3);
  transition:color .18s,background .18s;
}
.navlinks a:hover{color:var(--ink);background:var(--red-wash)}




.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:9px;
  padding:12px 20px;border-radius:12px;border:none;cursor:pointer;
  font-size:14px;font-weight:700;text-decoration:none;white-space:nowrap;
  transition:transform .18s cubic-bezier(.34,1.4,.64,1),box-shadow .18s,background .18s,border-color .18s;
}
.btn-primary{
  background:linear-gradient(140deg,var(--red-light),var(--red-dark));
  color:#fff;box-shadow:0 5px 18px rgba(212,43,34,.32);
}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(212,43,34,.42)}
.btn-ghost{
  background:transparent;color:var(--ink);
  border:1.5px solid var(--line-2);
}
.btn-ghost:hover{background:var(--red-wash);border-color:var(--red)}
.btn-sm{padding:9px 16px;font-size:13px;border-radius:10px}
.btn-screen{
  background:rgba(247,239,235,.08);color:var(--screen-ink);
  border:1.5px solid var(--screen-line);
}
.btn-screen:hover{background:rgba(247,239,235,.16)}

/* ══════════ HERO — teks kiri, unit 3D menembus tepi kanan ══════════ */
.hero{
  position:relative;z-index:1;overflow:hidden;
  padding:clamp(40px,6vw,80px) 0 clamp(52px,8vw,104px);
}
.hero .wrap{position:relative;z-index:2}
.hero-copy{max-width:min(560px,54%)}

.hero h1{
  font-size:clamp(33px,5.2vw,62px);font-weight:900;
  letter-spacing:-.038em;line-height:1.02;margin-bottom:0;
}
.hero h1 em{font-style:normal;color:var(--red)}
/* Kalimat kedua tagline selalu turun baris sendiri — dua ketukan, bukan satu
   paragraf panjang yang ragged di kolom sempit. */
.hero h1 span{display:block}
.hero-acts{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}




/* Unit 3D: besar, condong ke kiri, sisi kanan sengaja terpotong tepi layar */
.hero-unit{
  position:absolute;z-index:1;
  top:50%;
  /* -50% memusatkan; -10% pada kedua sumbu adalah pergeseran yang diminta,
     relatif terhadap ukuran kotak unit sendiri. */
  transform:translate(-10%,calc(-60% + 24px));
  right:-12.5vw;
  width:min(54vw,900px);
  height:min(130%,820px);
  min-height:430px;
  touch-action:pan-y;
}
/* Bayangan mengikuti siluet model dari alpha kanvas, jadi ikut berputar
   sendiri. Arah jatuhnya searah key light di shader (datang dari kiri-atas). */
.hero-unit canvas{
  position:relative;z-index:1;
  width:100%;height:100%;display:block;cursor:grab;
  filter:drop-shadow(22px 30px 28px rgba(74,25,18,.26));
}
.hero-unit canvas:active{cursor:grabbing}
.hero-unit .hint{
  position:absolute;z-index:2;right:12%;bottom:-4px;pointer-events:none;
  font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.14em;
  color:var(--ink-4);
}












/* — Viewfinder — */









/* HUD */










/* Cincin hitung mundur */













/* Salinan judul di dalam layar */




/* — Kolom strip — */


.strip{
  --strip-bg:#FFFFFF;
  --strip-ink:#150C09;
  --strip-sub:#9E8880;
  --strip-edge:transparent;
  --strip-gap:6px;
  background:var(--strip-bg);
  border:2px solid var(--strip-edge);
  border-radius:8px;
  padding:9px 9px 0;
  box-shadow:0 14px 34px rgba(0,0,0,.4);
  display:flex;flex-direction:column;
  transition:background .3s,border-color .3s;
}
.strip[data-frame="pita"]{--strip-edge:#D42B22}
.strip[data-frame="malam"]{--strip-bg:#1A1210;--strip-ink:#F7EFEB;--strip-sub:#A3897F}
.strip[data-frame="kraft"]{--strip-bg:#E7D8C6;--strip-ink:#4A3320;--strip-sub:#8B7355}

.strip .cells{display:flex;flex-direction:column;gap:var(--strip-gap);flex:1}
.strip .cell{
  aspect-ratio:4/3;border-radius:3px;overflow:hidden;position:relative;
  background:color-mix(in srgb,var(--strip-ink) 8%,transparent);
  display:grid;place-items:center;
}
.strip .cell svg{width:100%;height:100%;object-fit:cover}
@keyframes land{
  0%{transform:scale(.86) translateY(-14px);opacity:0;filter:brightness(2.2)}
  100%{transform:none;opacity:1;filter:none}
}
.strip .foot{
  padding:10px 2px 11px;display:flex;align-items:baseline;justify-content:space-between;gap:8px;
}
.strip .foot b{
  font-size:8.5px;font-weight:800;letter-spacing:.14em;color:var(--strip-ink);
  text-transform:uppercase;
}
.strip .foot span{
  font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:.1em;color:var(--strip-sub);
}




/* — Baris kontrol frame — */








/* ══════════ Alur booth (urutan nyata) ══════════ */








/* ══════════ Paket ══════════ */
.pakets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:start}
.paket{
  position:relative;text-align:left;width:100%;
  background:var(--surface);border:1.5px solid var(--line);border-radius:20px;
  padding:26px 24px 24px;cursor:pointer;
  box-shadow:var(--shadow-sm);
  transition:border-color .2s,box-shadow .2s,transform .2s;
}
.paket:hover{border-color:var(--line-2);transform:translateY(-3px);box-shadow:var(--shadow-md)}
.paket[aria-checked="true"]{
  border-color:var(--red);
  box-shadow:0 0 0 4px var(--red-wash),var(--shadow-md);
}
.paket .top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}
.paket .nm{font-size:17px;font-weight:800;letter-spacing:-.02em}
.paket .kode{
  font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.12em;
  color:var(--ink-4);display:block;margin-top:3px;
}
.paket .mark{
  width:20px;height:20px;border-radius:50%;flex:none;
  border:2px solid var(--line-2);display:grid;place-items:center;
  transition:border-color .2s,background .2s;
}
.paket[aria-checked="true"] .mark{border-color:var(--red);background:var(--red)}
.paket .mark::after{
  content:'';width:7px;height:7px;border-radius:50%;background:#fff;
  transform:scale(0);transition:transform .2s cubic-bezier(.34,1.5,.64,1);
}
.paket[aria-checked="true"] .mark::after{transform:scale(1)}

.paket .harga{
  font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;
  font-size:25px;font-weight:600;letter-spacing:-.02em;color:var(--ink);
}
.paket .harga small{font-size:12px;font-weight:400;color:var(--ink-4);letter-spacing:0;margin-left:6px}

.spec{margin-top:20px;border-top:1px solid var(--line);padding-top:4px}
.spec div{
  display:flex;align-items:baseline;justify-content:space-between;gap:14px;
  padding:8px 0;border-bottom:1px dashed var(--hair);
  font-size:12.5px;
}
.spec div:last-child{border-bottom:0}
.spec dt{color:var(--ink-4);font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.06em}
.spec dd{margin:0;color:var(--ink-2);font-weight:600;text-align:right}

.badge-pop{
  position:absolute;top:-11px;left:24px;
  padding:4px 11px;border-radius:100px;
  background:linear-gradient(140deg,var(--red-light),var(--red-dark));color:#fff;
  font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.14em;
  box-shadow:0 4px 12px rgba(212,43,34,.34);
}

.paket-cta{
  margin-top:24px;display:flex;align-items:center;justify-content:center;
  gap:16px;flex-wrap:wrap;
  padding:18px 22px;border-radius:16px;
  background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow-sm);
}

/* ══════════ Keluaran per sesi ══════════
   Sengaja tidak tiga kartu sejajar identik: cetakan adalah keluaran utama
   (dan satu-satunya yang punya wujud fisik), dua lainnya pelengkap digital.
   Bobot kolomnya mengikuti kenyataan itu. */
.outputs{
  display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);
  gap:18px;align-items:stretch;
}
.out{
  background:var(--surface);border:1px solid var(--line);border-radius:18px;
  padding:24px 22px;box-shadow:var(--shadow-sm);
}
.out h3{margin-bottom:8px}
.out p{color:var(--ink-3);font-size:13.5px;line-height:1.62;max-width:52ch}
.out-side{display:flex;flex-direction:column;gap:18px}
.out-side .out{flex:1}
/* Contoh strip didorong ke dasar kartu, jadi tepi bawahnya sejajar dengan
   kartu Live photo di kolom sebelah berapa pun panjang teksnya. */
.out-main{display:flex;flex-direction:column}
.out-main .gal{margin-top:auto;padding-top:24px}

/* ══════════ Galeri ══════════ */





.gal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:24px}
.gal .strip{box-shadow:var(--shadow-md);animation:land .4s ease both}
.gal .strip .cell{background:none}

/* ══════════ Datasheet mesin ══════════ */
.sheet{
  display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:0;
  background:var(--surface);border:1px solid var(--line);border-radius:22px;
  overflow:hidden;box-shadow:var(--shadow-sm);
}
.sheet .side{padding:clamp(28px,3.4vw,42px);display:flex;flex-direction:column;gap:16px}
.sheet .side + .side{border-left:1px solid var(--line);background:var(--surface-2)}

/* Penampil 3D di sebelah tabel spesifikasi. Di bawah 900px .sheet jatuh jadi
   satu kolom, jadi penampilnya otomatis pindah ke bawah tabel.
   touch-action:pan-y — seret mendatar memutar model, seret tegak tetap
   menggulung halaman, supaya tidak menjebak jari di HP. */
.sheet .side.viewer{
  padding:0;display:block;position:relative;
  min-height:430px;
  background:radial-gradient(ellipse 70% 55% at 50% 45%,var(--surface),var(--surface-2));
  touch-action:pan-y;
}
.spec-unit{position:absolute;inset:0}
.spec-unit canvas{
  width:100%;height:100%;display:block;cursor:grab;
  filter:drop-shadow(14px 20px 22px rgba(74,25,18,.20));
}
.spec-unit canvas:active{cursor:grabbing}
.spec-unit .hint{
  position:absolute;left:0;right:0;bottom:16px;text-align:center;pointer-events:none;
  font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.14em;
  color:var(--ink-4);
}
.dl{margin:0}
.dl .row{
  display:flex;align-items:baseline;gap:16px;padding:11px 0;
  border-bottom:1px dashed var(--hair);
}
.dl .row:last-child{border-bottom:0}
.dl dt{
  font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink-4);width:118px;flex:none;
}
.dl dd{margin:0;font-size:13.5px;color:var(--ink-2);font-weight:500}
.dl dd b{font-weight:700;color:var(--ink)}





/* ══════════ Tanya jawab ══════════ */
.faq{display:flex;flex-direction:column;gap:0;max-width:820px}
.faq details{border-bottom:1px solid var(--line)}
.faq summary{
  list-style:none;cursor:pointer;padding:19px 0;
  display:flex;align-items:center;gap:16px;
  font-size:15.5px;font-weight:600;color:var(--ink);
}
.faq summary::-webkit-details-marker{display:none}
.faq summary .q{
  font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--red);
  flex:none;letter-spacing:.08em;
}
.faq summary .pm{
  margin-left:auto;flex:none;width:22px;height:22px;position:relative;
  border-radius:50%;border:1px solid var(--line-2);
  transition:background .2s,transform .2s;
}
.faq summary .pm::before,.faq summary .pm::after{
  content:'';position:absolute;inset:50% 5px;height:1.5px;background:var(--red);
  transform:translateY(-50%);transition:transform .2s;
}
.faq summary .pm::after{transform:translateY(-50%) rotate(90deg)}
.faq details[open] summary .pm{background:var(--red-wash-2)}
.faq details[open] summary .pm::after{transform:translateY(-50%) rotate(0)}
.faq .ans{padding:0 0 22px 42px;color:var(--ink-3);font-size:14px;max-width:64ch;line-height:1.68}

/* ══════════ Booking ══════════ */
.book{
  display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:clamp(28px,4vw,56px);
  align-items:center;
}
.form{
  background:var(--surface);border:1px solid var(--line);border-radius:22px;
  padding:30px 28px;box-shadow:var(--shadow-md);
  display:flex;flex-direction:column;gap:16px;position:relative;overflow:hidden;
}
.form::before{
  content:'';position:absolute;top:0;left:28px;right:28px;height:1px;
  background:linear-gradient(90deg,transparent,var(--line-2),transparent);
}
.field{display:flex;flex-direction:column;gap:7px}
.field label{
  font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-4);
}
.field input,.field select{
  width:100%;padding:12px 14px;border-radius:11px;
  border:1.5px solid var(--line);background:var(--ground);
  color:var(--ink);font-size:14px;font-family:'Poppins',sans-serif;
  outline:none;transition:border-color .18s,box-shadow .18s;
}
.field input::placeholder{color:var(--ink-4)}
.field input:focus,.field select:focus{
  border-color:var(--red);box-shadow:0 0 0 3px var(--red-wash-2);
}
.form .note{font-size:11.5px;color:var(--ink-4);text-align:center;line-height:1.5}

/* ══════════ Cross-sell software ══════════ */
.soft{
  position:relative;z-index:1;
  background:var(--screen);border-radius:26px;overflow:hidden;
  padding:clamp(34px,4.4vw,54px);
  display:grid;grid-template-columns:minmax(0,1fr) auto;gap:32px;align-items:center;
  box-shadow:var(--shadow-lg);
  border:1px solid rgba(247,239,235,.09);
}
.soft::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(rgba(247,239,235,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(247,239,235,.05) 1px,transparent 1px);
  background-size:44px 44px;
  -webkit-mask-image:radial-gradient(ellipse 70% 100% at 100% 50%,#000,transparent 70%);
  mask-image:radial-gradient(ellipse 70% 100% at 100% 50%,#000,transparent 70%);
}
.soft > *{position:relative}


.soft h2{color:var(--screen-ink);margin:14px 0 12px;max-width:19ch}
.soft p{color:rgba(247,239,235,.66);font-size:14.5px;max-width:52ch}
.soft .pts{display:flex;gap:24px;flex-wrap:wrap;margin-top:22px}
.soft .pts div{
  font-family:'IBM Plex Mono',monospace;font-size:11.5px;letter-spacing:.06em;
  color:var(--screen-ink-2);display:flex;align-items:center;gap:8px;
}
.soft .pts div::before{content:'';width:5px;height:5px;border-radius:1px;background:var(--red-light)}
.soft .act{display:flex;flex-direction:column;gap:10px;align-items:stretch;min-width:210px}
.soft .act .btn{width:100%}
.soft .act small{
  font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.08em;
  color:rgba(247,239,235,.4);text-align:center;
}

/* ══════════ Footer ══════════ */
footer{border-top:1px solid var(--line);padding:44px 0 52px;position:relative;z-index:1}
.sitefoot{display:flex;align-items:flex-start;gap:32px;flex-wrap:wrap}
.sitefoot .col{display:flex;flex-direction:column;gap:9px}
.sitefoot .col b{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-4);font-family:'IBM Plex Mono',monospace;font-weight:500}
.sitefoot .col a{font-size:13.5px;color:var(--ink-3);text-decoration:none}
.sitefoot .col a:hover{color:var(--red)}
.sitefoot .end{margin-left:auto;text-align:right;display:flex;flex-direction:column;gap:6px}
.sitefoot .end span{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.12em;color:var(--ink-4)}

/* ══════════ Responsif ══════════ */
/* Layar sempit memakai komposisi yang sama persis dengan desktop — teks di
   kiri, unit mengambang di kanan dan menembus tepi — hanya diperkecil.
   Kolom teks di sini 50%, bukan 56%: setelah unit digeser kiri 10%, lebar
   56% membuat model menabrak teks di seluruh rentang tablet. Titik ganti
   juga dinaikkan ke 1180px karena di 1101px aturan desktop masih bertabrakan
   tipis (−3px). */
@media (max-width:1180px){
  .hero-copy{max-width:50%}
  .hero h1{font-size:clamp(27px,4.6vw,40px)}
  .hero-unit{
    width:min(58vw,620px);
    height:min(124%,640px);
    min-height:380px;
    right:-15vw;
    transform:translate(-10%,calc(-60% + 18px));
  }
}
@media (max-width:1080px){
  
  
  
  
}
@media (max-width:900px){
  
  .navlinks{display:none}
  .statusbar .wrap{gap:12px}
  .statusbar .btn{margin-left:auto}
  .pakets{grid-template-columns:1fr}
  .outputs{grid-template-columns:1fr;gap:12px}
  .sheet{grid-template-columns:1fr}
  .sheet .side + .side{border-left:0;border-top:1px solid var(--line)}
  .book{grid-template-columns:1fr}
  .soft{grid-template-columns:1fr;gap:26px}
  .soft .act{min-width:0}
}
@media (max-width:760px){
  .wrap{padding:0 18px}
  
  

  /* ── HP: komposisi tetap sama, tinggal diperkecil ── */
  .hero{padding:62px 0 46px}
  .hero-copy{max-width:59%}
  .hero h1{font-size:clamp(22px,6.1vw,30px);margin-bottom:0}
  .hero-acts{gap:8px;margin-top:22px}
  .hero-acts .btn{padding:10px 15px;font-size:12.5px;border-radius:10px}
  
  
  
  .hero-unit{
    width:min(72vw,500px);
    height:min(122%,480px);
    min-height:290px;
    right:-40vw;
    transform:translate(-10%,calc(-60% + 8px));
  }
  .hero-unit canvas{filter:drop-shadow(12px 16px 16px rgba(74,25,18,.24))}
  .hero-unit .hint{font-size:8.5px;right:16%;bottom:-2px}
  
  
  .strip .cells{flex-direction:row}
  .strip .cell{flex:1;aspect-ratio:3/4}
  
  
  
  
  
  .gal{gap:8px}
  .sheet .side.viewer{min-height:360px}
  .paket-cta .btn{margin-left:0;width:100%}
  .sitefoot .end{margin-left:0;text-align:left}
}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important}
  html{scroll-behavior:auto}
}
`
