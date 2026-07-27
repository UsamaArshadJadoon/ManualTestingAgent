// Shared design system (CSS + inline JS) for the QA AZM Digital Agent reports.
// No external requests: the Artifact CSP blocks CDNs, fonts and XHR.

exports.CSS = `
:root{
  --ink:#101C29; --ink-2:#33465A; --muted:#61748A; --hair:#DDE5EC; --hair-2:#EDF2F6;
  --paper:#FAFCFD; --surface:#FFFFFF; --sunk:#F1F6F9; --raise:0 1px 2px rgba(16,28,41,.05),0 12px 32px -20px rgba(16,28,41,.35);
  --accent:#0B6E85; --accent-2:#0E8AA6; --accent-soft:#E1F0F4;
  --user:#57398F; --user-soft:#EEE9F9;
  --high:#AE241D; --high-soft:#FBE8E6;
  --low:#87610F; --low-soft:#FBF1DA;
  --pass:#1B6349; --pass-soft:#E2F0EA;
  --block:#7A5B12; --block-soft:#F7EFDB;
  --r:3px;
}
@media (prefers-color-scheme:dark){:root{
  --ink:#E9EFF4; --ink-2:#B9C7D4; --muted:#8398AA; --hair:#22303D; --hair-2:#1A2733;
  --paper:#0C141C; --surface:#141F2A; --sunk:#101A24; --raise:0 1px 2px rgba(0,0,0,.5),0 12px 32px -20px rgba(0,0,0,.9);
  --accent:#48BDD6; --accent-2:#6ED0E5; --accent-soft:#10303A;
  --user:#B7A0EB; --user-soft:#211A33;
  --high:#EF8E86; --high-soft:#2C1816;
  --low:#DEB55C; --low-soft:#292112;
  --pass:#6CC7A0; --pass-soft:#10241D;
  --block:#D8B45E; --block-soft:#282213;
}}
:root[data-theme="dark"]{
  --ink:#E9EFF4; --ink-2:#B9C7D4; --muted:#8398AA; --hair:#22303D; --hair-2:#1A2733;
  --paper:#0C141C; --surface:#141F2A; --sunk:#101A24; --raise:0 1px 2px rgba(0,0,0,.5),0 12px 32px -20px rgba(0,0,0,.9);
  --accent:#48BDD6; --accent-2:#6ED0E5; --accent-soft:#10303A;
  --user:#B7A0EB; --user-soft:#211A33;
  --high:#EF8E86; --high-soft:#2C1816;
  --low:#DEB55C; --low-soft:#292112;
  --pass:#6CC7A0; --pass-soft:#10241D;
  --block:#D8B45E; --block-soft:#282213;
}
:root[data-theme="light"]{
  --ink:#101C29; --ink-2:#33465A; --muted:#61748A; --hair:#DDE5EC; --hair-2:#EDF2F6;
  --paper:#FAFCFD; --surface:#FFFFFF; --sunk:#F1F6F9; --raise:0 1px 2px rgba(16,28,41,.05),0 12px 32px -20px rgba(16,28,41,.35);
  --accent:#0B6E85; --accent-2:#0E8AA6; --accent-soft:#E1F0F4;
  --user:#57398F; --user-soft:#EEE9F9;
  --high:#AE241D; --high-soft:#FBE8E6;
  --low:#87610F; --low-soft:#FBF1DA;
  --pass:#1B6349; --pass-soft:#E2F0EA;
  --block:#7A5B12; --block-soft:#F7EFDB;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:5rem}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  font-size:16px;line-height:1.62;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.mono{font-family:ui-monospace,"Cascadia Code","SF Mono",Consolas,"Liberation Mono",monospace;font-size:.94em}

/* ---- sticky command bar ---- */
.bar{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--paper) 88%,transparent);
  backdrop-filter:blur(12px);border-bottom:1px solid var(--hair);}
.bar-in{max-width:none;margin:0;padding:.6rem clamp(1.25rem,3.5vw,3.5rem);display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
.brand{font-size:.7rem;font-weight:750;letter-spacing:.13em;text-transform:uppercase;color:var(--accent);white-space:nowrap}
.brand span{color:var(--muted)}
nav.jump{display:flex;gap:.15rem;flex-wrap:wrap;margin-left:auto}
nav.jump a{font-size:.76rem;font-weight:600;color:var(--muted);text-decoration:none;padding:.3rem .6rem;border-radius:var(--r);
  transition:background .15s,color .15s;white-space:nowrap}
nav.jump a:hover{background:var(--sunk);color:var(--ink)}
nav.jump a.on{background:var(--accent-soft);color:var(--accent)}
nav.jump a:focus-visible,button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.wrap{max-width:none;margin:0;padding:2.5rem clamp(1.25rem,3.5vw,3.5rem) 6rem}
.narrow{max-width:none}
h1,h2,h3,h4{text-wrap:balance;line-height:1.18;margin:0}
h1{font-size:clamp(1.8rem,4vw,2.7rem);font-weight:750;letter-spacing:-.03em}
h2{font-size:.78rem;font-weight:750;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);
  margin:3.5rem 0 1.1rem;padding-bottom:.55rem;border-bottom:1px solid var(--hair);scroll-margin-top:5rem}
h3{font-size:1.08rem;font-weight:700;letter-spacing:-.012em}
p{margin:0 0 .9rem}
a{color:var(--accent);text-underline-offset:2px}
.eyebrow{font-size:.68rem;font-weight:750;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 .7rem}
.lede{color:var(--ink-2);font-size:1.05rem;max-width:74ch}
.masthead{padding-bottom:2rem;border-bottom:1px solid var(--hair)}

/* ---- verdict hero ---- */
.hero{display:grid;grid-template-columns:auto 1fr;gap:1.5rem;align-items:center;margin:1.75rem 0 0;
  padding:1.35rem 1.5rem;border:1px solid var(--hair);border-left:5px solid var(--high);
  background:var(--surface);border-radius:var(--r);box-shadow:var(--raise)}
.hero.go{border-left-color:var(--pass)}
.hero-tag{font-size:2rem;font-weight:800;letter-spacing:-.03em;color:var(--high);line-height:1}
.hero.go .hero-tag{color:var(--pass)}
.hero-tag small{display:block;font-size:.6rem;font-weight:750;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:.3rem}
.hero p{margin:0;font-size:.94rem;color:var(--ink-2)}
@media(max-width:38rem){.hero{grid-template-columns:1fr;gap:.75rem}}

/* ---- metrics ---- */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:.75rem;margin:1.75rem 0}
.stat{background:var(--surface);padding:.95rem 1.05rem;border:1px solid var(--hair);border-radius:var(--r);
  transition:border-color .15s,transform .15s}
.stat:hover{border-color:var(--accent);transform:translateY(-1px)}
.stat dt{font-size:.63rem;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);font-weight:700;margin:0 0 .3rem}
.stat dd{margin:0;font-size:1.65rem;font-weight:750;font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1}
.stat.is-high dd{color:var(--high)} .stat.is-pass dd{color:var(--pass)} .stat.is-block dd{color:var(--block)}
.stat small{display:block;font-size:.7rem;color:var(--muted);margin-top:.3rem;font-weight:500}

/* ---- toolbar / filters ---- */
.toolbar{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin:1.1rem 0 .75rem}
.chip{font-size:.72rem;font-weight:650;padding:.32rem .7rem;border-radius:99px;border:1px solid var(--hair);
  background:var(--surface);color:var(--muted);cursor:pointer;transition:all .15s;font-family:inherit}
.chip:hover{border-color:var(--accent);color:var(--ink)}
.chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
@media (prefers-color-scheme:dark){.chip[aria-pressed="true"]{color:#0C141C}}
:root[data-theme="dark"] .chip[aria-pressed="true"]{color:#0C141C}
:root[data-theme="light"] .chip[aria-pressed="true"]{color:#fff}
.search{flex:1 1 12rem;min-width:9rem;font-family:inherit;font-size:.82rem;padding:.4rem .7rem;
  border:1px solid var(--hair);border-radius:var(--r);background:var(--surface);color:var(--ink)}
.search::placeholder{color:var(--muted)}
.count{font-size:.75rem;color:var(--muted);font-variant-numeric:tabular-nums;margin-left:auto}

/* ---- tables ---- */
.tablewrap{overflow-x:auto;border:1px solid var(--hair);border-radius:var(--r);background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:.86rem;min-width:36rem}
th,td{text-align:left;padding:.6rem .8rem;border-bottom:1px solid var(--hair-2);vertical-align:top}
th{font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:750;
  background:var(--sunk);white-space:nowrap;border-bottom:1px solid var(--hair)}
tbody tr{transition:background .12s}
tbody tr:hover{background:var(--sunk)}
tbody tr:last-child td{border-bottom:0}
td.num,th.num{font-variant-numeric:tabular-nums;text-align:right}
tr[hidden]{display:none}

/* ---- pills ---- */
.pill{display:inline-block;font-size:.64rem;font-weight:750;letter-spacing:.06em;text-transform:uppercase;
  padding:.17rem .48rem;border-radius:var(--r);white-space:nowrap;border:1px solid currentColor}
.p-pass{background:var(--pass-soft);color:var(--pass)}
.p-fail{background:var(--high-soft);color:var(--high)}
.p-block{background:var(--block-soft);color:var(--block)}
.p-low{background:var(--low-soft);color:var(--low)}
.p-flat{background:var(--sunk);color:var(--muted);border-color:var(--hair)}

/* ---- callouts ---- */
.note{border:1px solid var(--hair);border-left:4px solid var(--accent);background:var(--surface);
  padding:.95rem 1.15rem;border-radius:var(--r);font-size:.9rem;margin:1.35rem 0;color:var(--ink-2)}
.note strong{color:var(--ink)}
.note.warn{border-left-color:var(--low)}
.note.bad{border-left-color:var(--high)}
.note.good{border-left-color:var(--pass)}

/* ---- defect cards ---- */
.bug{border:1px solid var(--hair);border-radius:var(--r);background:var(--surface);margin:1rem 0;
  box-shadow:var(--raise);overflow:hidden}
.bug > summary{list-style:none;cursor:pointer;padding:1.05rem 1.25rem;display:grid;
  grid-template-columns:3.2rem 1fr auto;gap:1rem;align-items:start;transition:background .15s}
.bug > summary::-webkit-details-marker{display:none}
.bug > summary:hover{background:var(--sunk)}
.bug-ref{font-size:1.35rem;font-weight:800;letter-spacing:-.03em;color:var(--accent);line-height:1.1}
.bug-ref small{display:block;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-top:.2rem}
.bug-title{font-size:1rem;font-weight:700;letter-spacing:-.01em;margin:0 0 .45rem}
.chips{display:flex;flex-wrap:wrap;gap:.35rem}
.caret{color:var(--muted);font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;padding-top:.3rem}
.bug[open] .caret::after{content:"▲ close"}
.bug:not([open]) .caret::after{content:"▼ detail"}
.bug-body{padding:0 1.25rem 1.35rem;border-top:1px solid var(--hair-2)}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.15rem 1.5rem;
  margin:1.1rem 0;padding:.85rem 1rem;background:var(--sunk);border-radius:var(--r);font-size:.83rem}
.meta div{display:flex;gap:.55rem;padding:.15rem 0}
.meta dt{color:var(--muted);font-weight:650;min-width:6.8rem;flex:none}
.meta dd{margin:0;color:var(--ink-2);word-break:break-word}
.sect{margin:1.35rem 0}
.sect > h4{font-size:.66rem;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);font-weight:750;margin:0 0 .55rem}
.ea{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
.ea > div{background:var(--sunk);padding:.9rem 1rem;border-radius:var(--r);border:1px solid var(--hair-2)}
.ea h4{margin:0 0 .45rem;font-size:.66rem;letter-spacing:.13em;text-transform:uppercase;font-weight:750}
.ea .x{border-left:3px solid var(--pass)} .ea .x h4{color:var(--pass)}
.ea .y{border-left:3px solid var(--high)} .ea .y h4{color:var(--high)}
.ea p{font-size:.87rem;margin:0;color:var(--ink-2)}
@media(max-width:44rem){.ea{grid-template-columns:1fr}.bug > summary{grid-template-columns:1fr;gap:.5rem}.caret{display:none}}
ol.repro{margin:0;padding-left:1.35rem;font-size:.89rem;color:var(--ink-2)}
ol.repro li{margin-bottom:.32rem}
ul.plain{margin:0;padding-left:1.2rem;font-size:.87rem;color:var(--ink-2)}
.none{color:var(--muted);font-style:italic;font-size:.87rem}

/* ---- evidence + lightbox ---- */
.shots{display:grid;gap:.9rem}
figure{margin:0;border:1px solid var(--hair);border-radius:var(--r);background:var(--sunk);padding:.5rem;overflow:hidden}
figure img{display:block;width:100%;height:auto;border:1px solid var(--hair);border-radius:2px;background:#fff;
  cursor:zoom-in;transition:opacity .15s}
figure img:hover{opacity:.92}
figcaption{font-size:.79rem;color:var(--muted);padding:.6rem .35rem .15rem;line-height:1.5}
figcaption b{color:var(--ink-2);font-weight:650}
#lb{position:fixed;inset:0;z-index:100;background:rgba(8,14,20,.94);display:none;
  align-items:center;justify-content:center;padding:1.5rem;cursor:zoom-out}
#lb.on{display:flex}
#lb img{max-width:100%;max-height:100%;object-fit:contain;border-radius:2px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
#lb .x{position:absolute;top:1rem;right:1.25rem;color:#fff;background:rgba(255,255,255,.12);border:0;
  font-size:1.1rem;padding:.35rem .75rem;border-radius:var(--r);cursor:pointer;font-family:inherit}


/* ---- ledger (process log) ---- */
.step{display:grid;grid-template-columns:2.6rem 1fr;gap:1.35rem;padding:1.5rem 0;border-top:1px solid var(--hair-2);scroll-margin-top:5rem}
.n{font-family:ui-monospace,Consolas,monospace;font-size:.85rem;font-weight:700;color:var(--muted);
  font-variant-numeric:tabular-nums;padding-top:.42rem;border-top:2px solid var(--accent);align-self:start}
.who{display:inline-block;font-size:.6rem;font-weight:750;letter-spacing:.11em;text-transform:uppercase;
  padding:.2rem .55rem;border-radius:var(--r);margin-bottom:.55rem;border:1px solid currentColor}
.w-user{background:var(--user-soft);color:var(--user)}
.w-stage{background:var(--accent-soft);color:var(--accent)}
.w-gate{background:var(--low-soft);color:var(--low)}
.w-val{background:var(--sunk);color:var(--muted);border-color:var(--hair)}
.said{border-left:3px solid var(--user);background:var(--user-soft);padding:.55rem .85rem;margin:0 0 .85rem;
  border-radius:0 var(--r) var(--r) 0;font-size:.92rem;color:var(--ink)}
.said b{display:block;font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;color:var(--user);margin-bottom:.15rem;font-weight:750}
.ret{font-size:.92rem;color:var(--ink-2);max-width:118ch}
.ret > b,.ret strong{color:var(--ink)}
dl.kv{display:grid;grid-template-columns:auto 1fr;gap:.2rem 1rem;margin:.8rem 0 0;font-size:.84rem;
  padding:.7rem .9rem;background:var(--sunk);border-radius:var(--r);border:1px solid var(--hair-2)}
dl.kv dt{color:var(--muted);font-weight:650;white-space:nowrap}
dl.kv dd{margin:0;color:var(--ink-2)}
ul.tight{margin:.5rem 0 0;padding-left:1.15rem;font-size:.9rem;color:var(--ink-2)}
ul.tight li{margin-bottom:.3rem}
@media(max-width:40rem){.step{grid-template-columns:1fr;gap:.5rem}.n{border-top:0;padding-top:0}dl.kv{grid-template-columns:1fr}}

footer{margin-top:4.5rem;padding-top:1.35rem;border-top:1px solid var(--hair);font-size:.79rem;color:var(--muted);
  display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;justify-content:space-between}
@media print{.bar,.toolbar,.caret{display:none}.bug{break-inside:avoid;box-shadow:none}.bug-body{display:block!important}}
`;

exports.JS = `
(function(){
  // scroll-spy on the jump nav
  var links=[].slice.call(document.querySelectorAll('nav.jump a'));
  var targets=links.map(function(a){return document.querySelector(a.getAttribute('href'))}).filter(Boolean);
  if(targets.length&&'IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(!e.isIntersecting)return;
        links.forEach(function(l){l.classList.toggle('on',l.getAttribute('href')==='#'+e.target.id)});
      });
    },{rootMargin:'-15% 0px -75% 0px'});
    targets.forEach(function(t){io.observe(t)});
  }

  // table filtering: [data-filter] toolbar drives the table it precedes
  document.querySelectorAll('[data-filters]').forEach(function(bar){
    var table=document.querySelector(bar.getAttribute('data-filters'));
    if(!table)return;
    var rows=[].slice.call(table.querySelectorAll('tbody tr'));
    var counter=bar.querySelector('.count');
    var input=bar.querySelector('.search');
    var chips=[].slice.call(bar.querySelectorAll('.chip'));
    function apply(){
      var active=chips.filter(function(c){return c.getAttribute('aria-pressed')==='true'})
                      .map(function(c){return c.getAttribute('data-v')});
      var q=(input&&input.value||'').trim().toLowerCase();
      var n=0;
      rows.forEach(function(r){
        var okChip=!active.length||active.indexOf(r.getAttribute('data-s'))>-1;
        var okText=!q||r.textContent.toLowerCase().indexOf(q)>-1;
        var show=okChip&&okText; r.hidden=!show; if(show)n++;
      });
      if(counter)counter.textContent=n+' of '+rows.length+' shown';
    }
    chips.forEach(function(c){c.addEventListener('click',function(){
      c.setAttribute('aria-pressed',c.getAttribute('aria-pressed')==='true'?'false':'true');apply();
    })});
    if(input)input.addEventListener('input',apply);
    apply();
  });

  // expand / collapse all defect cards
  document.querySelectorAll('[data-toggle-all]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var cards=[].slice.call(document.querySelectorAll(btn.getAttribute('data-toggle-all')));
      var anyClosed=cards.some(function(c){return !c.open});
      cards.forEach(function(c){c.open=anyClosed});
      btn.textContent=anyClosed?'Collapse all':'Expand all';
    });
  });

  // screenshot lightbox
  var lb=document.getElementById('lb');
  if(lb){
    var img=lb.querySelector('img');
    document.addEventListener('click',function(e){
      var t=e.target;
      if(t.tagName==='IMG'&&t.closest('figure')){img.src=t.src;img.alt=t.alt;lb.classList.add('on');document.body.style.overflow='hidden';}
      else if(t===lb||t.classList.contains('x')){lb.classList.remove('on');document.body.style.overflow='';}
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&lb.classList.contains('on')){lb.classList.remove('on');document.body.style.overflow='';}
    });
  }
})();
`;

exports.LIGHTBOX = '<div id="lb" role="dialog" aria-label="Screenshot viewer"><button class="x" aria-label="Close">Esc ✕</button><img alt=""></div>';
