/*
 * galeri.css.ts - gaya khusus /galeri. Token warna, statusbar, tombol, latar
 * ambien, dan footer dipakai ulang dari LANDING_CSS (dimuat lebih dulu).
 */
export const GALERI_CSS = `
.gal-head{padding:clamp(44px,6vw,78px) 0 0;position:relative;z-index:1}
.gal-head .back{
  display:inline-flex;align-items:center;gap:8px;margin-bottom:22px;
  font-size:13px;font-weight:600;color:var(--ink-3);text-decoration:none;
}
.gal-head .back:hover{color:var(--red)}
.gal-head h1{font-size:clamp(30px,4.2vw,50px);font-weight:900;margin-bottom:14px}
.gal-head .meta{
  margin-top:18px;font-family:'IBM Plex Mono',monospace;font-size:11.5px;
  letter-spacing:.1em;text-transform:uppercase;color:var(--ink-4);
}

/* ── Tab ── */
.tabs{
  position:sticky;top:74px;z-index:40;margin-top:34px;padding:12px 0;
  background:color-mix(in srgb,var(--ground) 90%,transparent);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
}
.tablist{
  display:inline-flex;gap:4px;padding:4px;border-radius:14px;
  background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow-sm);
}
.tab{
  display:inline-flex;align-items:center;gap:8px;
  padding:9px 16px;border:0;border-radius:10px;background:transparent;cursor:pointer;
  font-size:13.5px;font-weight:700;color:var(--ink-3);
  transition:background .18s,color .18s;
}
.tab:hover{color:var(--ink)}
.tab[aria-selected="true"]{background:linear-gradient(140deg,var(--red-light),var(--red-dark));color:#fff}
.tab .n{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;opacity:.75}

.gal-body{position:relative;z-index:1;padding:14px 0 clamp(60px,8vw,96px)}

.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}
.grid.gif{grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}

.kartu{
  position:relative;display:block;width:100%;padding:0;margin:0;cursor:zoom-in;
  background:var(--surface);border:1px solid var(--line);border-radius:14px;
  overflow:hidden;box-shadow:var(--shadow-sm);text-align:left;
  transition:transform .2s cubic-bezier(.34,1.4,.64,1),box-shadow .2s;
}
.kartu:hover{transform:translateY(-3px);box-shadow:var(--shadow-md)}
.kartu .bingkai{position:relative;display:block;background:var(--surface-2)}
.grid.strip .bingkai,.grid.video .bingkai{aspect-ratio:2/3}
.grid.gif .bingkai{aspect-ratio:3/2}
.kartu .bingkai img{width:100%;height:100%;object-fit:contain}
.grid.gif .bingkai img{object-fit:cover}

.putar{
  position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;
}
.putar i{
  width:54px;height:54px;border-radius:50%;display:grid;place-items:center;
  background:rgba(21,12,9,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  box-shadow:0 8px 24px rgba(0,0,0,.25);transition:transform .2s;
}
.putar i::before{
  content:"";margin-left:4px;
  border-left:16px solid #fff;border-top:10px solid transparent;border-bottom:10px solid transparent;
}
.kartu:hover .putar i{transform:scale(1.08)}
.video .kartu{cursor:pointer}

/* ── Ajakan ── */
.ajak{
  margin-top:clamp(52px,7vw,80px);padding:clamp(26px,4vw,40px);
  display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;
  background:var(--surface);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow-sm);
}
.ajak h2{font-size:clamp(22px,2.6vw,30px);margin-bottom:8px}
.ajak .act{display:flex;gap:10px;flex-wrap:wrap}

/* ── Lightbox ── */
dialog.lb{
  width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;
  background:rgba(12,7,5,.96);color:#F7EFEB;
}
dialog.lb::backdrop{background:transparent}
dialog.lb[open]{display:flex;flex-direction:column;animation:lb-in .18s ease both}
@keyframes lb-in{from{opacity:0}to{opacity:1}}
.lb-bar{
  display:flex;align-items:center;gap:10px;padding:12px 16px;flex:none;
  font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.06em;
}
.lb-bar .posisi{color:#C3ABA1}
.lb-bar a{color:#F7EFEB;margin-left:auto;text-decoration:underline;text-underline-offset:3px}
.lb-btn{
  width:42px;height:42px;flex:none;border-radius:12px;border:1px solid rgba(247,239,235,.16);
  background:rgba(247,239,235,.06);color:#F7EFEB;cursor:pointer;font-size:20px;line-height:1;
  display:grid;place-items:center;
}
.lb-btn:hover{background:rgba(247,239,235,.16)}
.lb-btn:disabled{opacity:.3;cursor:default}
.lb-stage{
  flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:12px;
  padding:0 12px 16px;
}
.lb-media{
  flex:1;min-width:0;height:100%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:12px;
}
.lb-media .lepas{
  max-width:100%;max-height:100%;min-height:0;width:auto;height:auto;object-fit:contain;
  border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.45);background:#000;
}
.lb-media .wadah{position:relative;flex:1;min-height:0;width:100%}
.lb-media video.lepas{flex:0 1 auto}
.lb-note{
  max-width:52ch;text-align:center;font-size:12.5px;line-height:1.55;color:#C3ABA1;flex:none;
}

@media (max-width:760px){
  .tabs{top:74px}
  .tab{padding:8px 12px;font-size:13px}
  .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .grid.gif{grid-template-columns:minmax(0,1fr)}
  .lb-stage{padding:0 6px 12px;gap:6px}
  .lb-stage > .lb-btn{position:absolute;bottom:14px;z-index:2}
  .lb-stage > .lb-btn.kiri{left:14px}
  .lb-stage > .lb-btn.kanan{right:14px}
  .lb-stage{padding-bottom:70px}
  .ajak .act,.ajak .act .btn{width:100%}
}
`
