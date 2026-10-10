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

.strips{
  display:flex;align-items:flex-start;justify-content:center;gap:clamp(8px,1.2vw,16px);
  margin-top:clamp(36px,5vw,64px);padding-bottom:clamp(48px,6vw,80px);overflow:hidden;
}
.strips a{flex:none;width:clamp(120px,14vw,200px);display:block;transition:transform .45s var(--ease)}
.strips a:hover{transform:translateY(-10px)}
.strips img{width:100%;aspect-ratio:1/3;object-fit:cover;box-shadow:0 18px 30px -22px rgba(30,26,25,.55)}
.strips a:nth-child(1){margin-top:48px}
.strips a:nth-child(3){margin-top:86px}
.strips a:nth-child(4){margin-top:24px}
.strips a:nth-child(5){margin-top:110px}
.strips a:nth-child(6){margin-top:12px}
.strips a:nth-child(7){margin-top:70px}
.strips a:nth-child(8){margin-top:30px}
.strips a:nth-child(9){margin-top:96px}
/* Strip "keluar dari printer": terbuka dari atas ke bawah, bergiliran */
@media (prefers-reduced-motion:no-preference){
  .strips img{animation:pkPrint 1.3s var(--ease) both;animation-delay:calc(var(--i) * 80ms)}
}
@keyframes pkPrint{from{clip-path:inset(0 0 100% 0);transform:translateY(-24px)}to{clip-path:inset(0 0 0 0);transform:none}}

.sec{padding-block:clamp(80px,11vw,140px)}
.sec.tight{padding-top:0}
.lede{margin-top:20px;max-width:54ch;color:var(--mute);font-size:18px}

.takeaway{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:clamp(20px,3vw,40px);margin-top:56px;align-items:start}
.take figure{margin:0 0 20px}
.take p{margin-top:8px;color:var(--mute);font-size:16px}
.take-print img{box-shadow:0 26px 44px -30px rgba(30,26,25,.6)}
.take-gif{margin-top:120px}
.take-gif img{width:100%;aspect-ratio:3/2;object-fit:cover}
.take-live{margin-top:40px}
.take-live video{width:100%;aspect-ratio:460/688;object-fit:cover;background:var(--blush)}
@media (max-width:860px){
  .takeaway{grid-template-columns:1fr 1fr}
  .take-print{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:end}
  .take-print figure{margin:0}
  .take-gif,.take-live{margin-top:0}
}
@media (max-width:540px){.takeaway,.take-print{grid-template-columns:1fr}}
.gal-link{margin-top:48px}

.ai-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(28px,5vw,72px);align-items:center}
.compare{position:relative;aspect-ratio:4/5;overflow:hidden;background:#d9d2d0;touch-action:pan-y;user-select:none}
.compare img,.compare canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.compare .after{clip-path:inset(0 0 0 var(--pos,50%))}
.compare .bar{position:absolute;top:0;bottom:0;left:var(--pos,50%);width:3px;margin-left:-1.5px;background:#fff;pointer-events:none}
.compare .knob{position:absolute;top:50%;left:var(--pos,50%);width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;background:var(--red);color:#fff;display:grid;place-items:center;font:700 18px/1 var(--body);pointer-events:none;box-shadow:0 6px 16px rgba(0,0,0,.25)}
.compare input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;margin:0}
.compare input:focus-visible ~ .knob{outline:3px solid #fff;outline-offset:3px}
.bgs{display:flex;flex-wrap:wrap;gap:6px 22px;margin-top:28px}
.bgs button{background:none;border:0;padding:6px 0;cursor:pointer;font:600 17px var(--body);color:var(--mute);border-bottom:2px solid transparent}
.bgs button:hover{color:var(--ink)}
.bgs button[aria-pressed="true"]{color:var(--red);border-bottom-color:var(--red)}
.ai-copy .body{margin-top:20px;max-width:44ch;color:var(--mute)}
@media (max-width:860px){.ai-top{grid-template-columns:1fr}.compare{max-width:520px}}

.styles{margin-top:clamp(80px,10vw,120px)}
.pk-landing .styles h2,.pk-landing .madlib h2{font-size:clamp(34px,4.4vw,56px)}
.style-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(8px,1.4vw,16px);margin-top:36px}
.style-row figure{margin:0}
.style-row img{width:100%;aspect-ratio:730/520;object-fit:cover}
.style-row figcaption{margin-top:10px;font-weight:600;font-size:15px}
.style-row figure:first-child figcaption{color:var(--mute)}
.styles .note{margin-top:20px;font-size:14px;color:var(--mute)}
@media (max-width:700px){.style-row{grid-template-columns:1fr 1fr}}

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
.addons{display:flex;flex-wrap:wrap;gap:10px 28px;margin-top:22px;font-size:17px;font-weight:600}
.addons label{display:flex;gap:10px;align-items:center;cursor:pointer}
.addons input{width:20px;height:20px;accent-color:var(--red);margin:0}
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
