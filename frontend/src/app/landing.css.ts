/*
 * landing.css.ts - gaya halaman sewa photobooth (redesign "satu tinta", 11 Okt 2026).
 *
 * Kertas putih, tinta merah logo, dan foto tamu asli sebagai satu-satunya
 * warna lain. Tanpa kartu: pemisah adalah ruang kosong, ditambah satu blok
 * merah penuh untuk software. Bentuk: tombol pill, foto bersudut tajam.
 * Font dimuat lewat next/font di page.tsx (--font-bagel, --font-jakarta).
 */
export const LANDING_CSS = `
.pk-landing{
  --paper:#FFFFFF;
  --ink:#1E1A19;
  --mute:#675F5D;
  --line:#E9E3E1;
  --red:#D42B22;
  --red-deep:#A91F18;
  --blush:#FBEDEB;
  --display:var(--font-bagel), 'Arial Black', system-ui, sans-serif;
  --body:var(--font-jakarta), system-ui, -apple-system, 'Segoe UI', sans-serif;
  --ease:cubic-bezier(.16,1,.3,1);
  background:var(--paper);color:var(--ink);font:400 17px/1.65 var(--body);
  -webkit-font-smoothing:antialiased;min-height:100dvh;
}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{background:#FFFFFF}
.pk-landing *{box-sizing:border-box}
.pk-landing img,.pk-landing video,.pk-landing canvas{max-width:100%;display:block}
.pk-landing img,.pk-landing video{height:auto}
.pk-landing a{color:inherit}
:where(.pk-landing) p{margin:0}
.pk-landing h1,.pk-landing h2,.pk-landing h3{margin:0;text-wrap:balance}
.pk-landing h1,.pk-landing h2{font-family:var(--display);font-weight:400;color:var(--red);line-height:.98;letter-spacing:-.005em}
.pk-landing h2{font-size:clamp(40px,5.6vw,72px)}
.pk-landing h3{font-size:20px;font-weight:700;line-height:1.3}
.pk-landing :focus-visible{outline:2.5px solid var(--red);outline-offset:3px}
.wrap{max-width:1200px;margin:0 auto;padding-inline:clamp(16px,4vw,40px)}

.btn{
  display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;
  height:54px;padding:0 28px;border-radius:999px;border:0;cursor:pointer;text-decoration:none;
  font:700 16px/1 var(--body);transition:transform .2s var(--ease),background .2s,color .2s;
}
.btn:active{transform:scale(.97)}
.btn-red{background:var(--red);color:#fff}
.btn-red:hover{background:var(--red-deep)}
.btn-text{height:auto;padding:0;border-radius:0;background:none;color:var(--ink);text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:6px;text-decoration-color:var(--red)}
.btn-text:hover{color:var(--red)}

.nav{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.nav .wrap{display:flex;align-items:center;gap:32px;height:72px}
.logo{display:block;width:96px;height:54px;background:url("/logo-pk.webp") left center/contain no-repeat}
.nav nav{display:flex;gap:28px;margin-left:auto;font-size:15px;font-weight:600}
.nav nav a{text-decoration:none;color:var(--mute)}
.nav nav a:hover{color:var(--red)}
.nav .btn{height:44px;padding:0 22px;font-size:15px}
@media (max-width:820px){.nav nav{display:none}.nav .btn{margin-left:auto}}

.hero{padding-top:clamp(28px,5vw,64px)}
.hero-top{display:grid;gap:28px}
.hero h1{font-size:clamp(46px,7.4vw,104px);max-width:12.5em}
.hero-side{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px 40px}
.hero-side p{color:var(--mute);font-size:18px;max-width:40ch}
.hero-side .acts{display:flex;align-items:center;gap:24px;flex-wrap:wrap}

.strips{margin-top:clamp(36px,5vw,64px);padding-bottom:clamp(48px,6vw,80px);overflow:hidden}
.strips .rail{display:flex;gap:clamp(10px,1.4vw,20px);width:max-content;padding-inline:clamp(10px,1.4vw,20px)}
.strips a{flex:none;width:clamp(128px,15vw,210px);display:block}
.strips img{width:100%;aspect-ratio:1/3;object-fit:cover;box-shadow:0 18px 30px -22px rgba(30,26,25,.55)}
/* Rak berjalan pelan ke kiri; daftar di markup digandakan, jadi -50% = satu putaran penuh. */
@media (prefers-reduced-motion:no-preference){
  .strips .rail{animation:pkRak 60s linear infinite}
  .strips:hover .rail{animation-play-state:paused}
}
@keyframes pkRak{to{transform:translateX(-50%)}}

.sec{padding-block:clamp(80px,11vw,140px)}
.sec.tight{padding-top:0}
.lede{margin-top:20px;max-width:54ch;color:var(--mute);font-size:18px}

.takeaway{display:grid;grid-template-columns:1fr 1fr 1fr;gap:clamp(20px,3vw,40px);margin-top:56px;align-items:start}
.take figure{margin:0 0 18px}
.take p{margin-top:8px;color:var(--mute);font-size:16px}
.take-print img{box-shadow:0 26px 44px -30px rgba(30,26,25,.6)}
.take-slide video{width:100%;aspect-ratio:3/2;object-fit:cover;background:var(--blush)}
.take-live video{width:100%;aspect-ratio:460/688;object-fit:cover;background:var(--blush)}
@media (max-width:860px){
  .takeaway{grid-template-columns:1fr 1fr}
  .take-print{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:end}
  .take-print figure{margin:0}
}
@media (max-width:540px){.takeaway,.take-print{grid-template-columns:1fr}}
.gal-link{margin-top:48px}

.prices{display:grid;grid-template-columns:1fr 1fr;gap:24px clamp(32px,6vw,96px);margin-top:56px}
.pk-landing .prices h3{font-size:15px;font-weight:700;color:var(--mute);padding-bottom:6px}
.prices h3 span{font-weight:500}
.prow{
  display:grid;grid-template-columns:auto auto 1fr auto;align-items:baseline;gap:12px;
  width:100%;background:none;border:0;padding:14px 0;cursor:pointer;text-align:left;font:inherit;color:var(--ink);
}
.prow .dot{width:14px;height:14px;border-radius:50%;border:2px solid #c9bebb;align-self:center;transition:background .2s,border-color .2s}
.prow .nm{font-weight:700;font-size:19px;line-height:1.25}
.prow .nm small{display:block;font-weight:500;font-size:14.5px;color:var(--mute)}
.prow .lead{border-bottom:2px dotted #cfc5c2;transform:translateY(-6px);min-width:16px}
.prow .pr{font-weight:700;font-size:19px;font-variant-numeric:tabular-nums}
.prow:hover .nm{color:var(--red)}
.prow[aria-checked="true"] .dot{background:var(--red);border-color:var(--red)}
.prow[aria-checked="true"] .nm,.prow[aria-checked="true"] .pr{color:var(--red)}
@media (max-width:760px){.prices{grid-template-columns:1fr}}

.madlib{margin-top:clamp(64px,8vw,96px);padding-top:clamp(40px,5vw,56px);border-top:2px solid var(--ink);scroll-margin-top:72px}
.sentence{margin-top:28px;font-size:clamp(22px,2.6vw,32px);line-height:1.9;font-weight:500;max-width:30em}
.sentence input,.sentence select{
  font:700 1em/1.2 var(--body);color:var(--red);background:transparent;border:0;border-bottom:2.5px solid var(--ink);
  border-radius:0;padding:0 2px 2px;margin:0 2px;appearance:none;-webkit-appearance:none;max-width:100%;
}
.sentence select{padding-right:22px;background:linear-gradient(45deg,transparent 50%,var(--ink) 50%) right 6px center/7px 7px no-repeat,linear-gradient(-45deg,transparent 50%,var(--ink) 50%) right 0 center/7px 7px no-repeat;cursor:pointer}
.sentence input::placeholder{color:#a3302a;opacity:.55;font-weight:600}
.sentence input:focus,.sentence select:focus{outline:none;border-bottom-color:var(--red);background-color:var(--blush)}
.sentence .pk{color:var(--red);font-weight:700;border-bottom:2.5px solid var(--ink)}
#tgl{width:7.6em}
#kota{width:8.5em}
.send{display:flex;flex-wrap:wrap;gap:16px 28px;align-items:center;margin-top:36px}
.send small{font-size:14.5px;color:var(--mute)}
.err{margin-top:16px;color:var(--red-deep);font-weight:600;font-size:15.5px}
.err:empty{display:none}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.unit{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(24px,5vw,64px);align-items:center;margin-top:24px}
.stage{position:relative;aspect-ratio:1/1.05;background:radial-gradient(ellipse 60% 18% at 50% 88%,rgba(30,26,25,.10),transparent 70%)}
.spec-unit{position:absolute;inset:0}
.spec-unit canvas{width:100%;height:100%;cursor:grab;filter:drop-shadow(12px 18px 20px rgba(74,25,18,.18))}
.spec-unit canvas:active{cursor:grabbing}
.spec-unit .hint{position:absolute;left:0;right:0;bottom:6px;text-align:center;pointer-events:none;font-size:13px;font-weight:600;color:var(--mute)}
.specs{margin:0;display:grid;gap:22px}
.specs div{display:grid;grid-template-columns:110px 1fr;gap:16px;align-items:baseline}
.specs dt{font-size:15px;color:var(--mute)}
.specs dd{margin:0;font-weight:700;font-size:19px;line-height:1.35}
@media (max-width:860px){.unit{grid-template-columns:1fr}.stage{max-width:480px;width:100%;justify-self:center}}

.faq{max-width:820px;margin-top:40px}
.faq details{border-top:1.5px solid var(--line)}
.faq details:last-child{border-bottom:1.5px solid var(--line)}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px 0;font-weight:700;font-size:clamp(18px,1.8vw,21px);line-height:1.35}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";flex:none;font:400 34px/1 var(--display);color:var(--red);transition:transform .3s var(--ease)}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq details p{padding:0 40px 26px 0;color:var(--mute);max-width:64ch}
.faq-more{margin-top:32px;color:var(--mute)}
.faq-more a{font-weight:700;color:var(--ink);text-decoration-color:var(--red);text-decoration-thickness:2px;text-underline-offset:5px}

.soft{background:var(--red);color:#fff;padding-block:clamp(64px,8vw,104px)}
.soft .wrap{display:grid;grid-template-columns:1.2fr 1fr;gap:32px 64px;align-items:end}
.pk-landing .soft h2{color:#fff}
.soft p{margin-top:18px;color:#FFE1DE;max-width:50ch}
.soft .acts{display:flex;flex-wrap:wrap;gap:14px 28px;align-items:center}
.soft .btn-white{background:#fff;color:var(--red)}
.soft .btn-white:hover{background:var(--ink);color:#fff}
.soft .btn-text{color:#fff;text-decoration-color:#fff}
.soft .btn-text:hover{color:#FFE1DE}
@media (max-width:820px){.soft .wrap{grid-template-columns:1fr}}

.pk-foot{padding-block:56px 40px}
.foot{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:32px;font-size:15.5px}
.foot .col{display:flex;flex-direction:column;gap:10px}
.foot b{color:var(--mute);font-weight:600;font-size:14px}
.foot a{text-decoration:none}
.foot a:hover{color:var(--red)}
.foot .logo{width:150px;height:84px}
.foot .end{grid-column:1/-1;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-top:24px;margin-top:8px;border-top:1.5px solid var(--line);color:var(--mute);font-size:14px}
@media (max-width:700px){.foot{grid-template-columns:1fr 1fr}.foot .col:first-child{grid-column:1/-1}}
`
