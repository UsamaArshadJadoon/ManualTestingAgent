#!/usr/bin/env node
// Defect-report generator. Renders bugs-proposed.json for a run folder: one page,
// everything visible, every field read from the draft. No story-specific content.
//   node gen-bug-report.js <runFolder>
// then run embed-screenshots.js over the output to inline the evidence.
const fs = require('fs'), path = require('path');
const RUN = process.argv[2];
const rd = f => JSON.parse(fs.readFileSync(path.join(RUN, f), 'utf8'));
const ctx = rd('run-context.json'), story = rd('story.json'), review = rd('review.json');
const drafts = rd('bugs-proposed.json').drafts;
const results = rd('results.json').cases, cases = rd('test-cases.json').cases;
const RS = Object.fromEntries(results.map(c => [c.id, c]));
const TC = Object.fromEntries(cases.map(c => [c.id, c]));

const masks = (ctx.config.safety.maskPatterns || []).map(p => {
  let f = 'g'; if (p.startsWith('(?i)')) { f += 'i'; p = p.slice(4); }
  try { return new RegExp(p, f) } catch { return null }
}).filter(Boolean);
const mask = s => { let o = String(s ?? ''); for (const r of masks) o = o.replace(r, '***'); return o };
const e = s => mask(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SEV = { Highest: ['Critical', 'crit'], High: ['High', 'high'], Low: ['Low', 'low'] };
const sev = s => SEV[s] || [s, 'low'];


// Keep the evidence to the point: the primary case's frames first, then the draft's
// own curated list, capped at 3 per defect. More than that is noise, not proof.
const MAX_SHOTS = 3;
const shotsFor = d => {
  const out = [];
  const primary = ((RS[d.testId] || {}).screenshots) || [];
  for (const s of primary) if (!out.includes(s)) out.push(s);
  for (const s of (d.screenshots || [])) if (!out.includes(s)) out.push(s);
  for (const t of (d.testIds || [])) for (const s of ((RS[t] || {}).screenshots || [])) if (!out.includes(s)) out.push(s);
  return out.slice(0, MAX_SHOTS);
};
const capFor = (f, d) => {
  const owner = (d.testIds || []).find(t => ((RS[t] || {}).screenshots || []).includes(f)) || (d.testIds || [])[0];
  return `${e(owner)} — ${e((TC[owner] || {}).title || '')}`;
};

const card = d => {
  const [label, cls] = sev(d.severity); const shots = shotsFor(d);
  return `
<article class="d ${cls}" id="${e(d.ref)}">
  <div class="d-head">
    <span class="sev ${cls}">${e(label)}</span>
    <h2>${e(d.ref)} · ${e(d.title)}</h2>
    <p class="d-meta">Acceptance criteria ${e((d.linkedAC || []).join(', ') || '—')}
      &nbsp;·&nbsp; Found by ${e((d.testIds || []).join(', '))}
      &nbsp;·&nbsp; Not filed in Jira</p>
  </div>

  <div class="d-body">
    <h3>Steps to reproduce</h3>
    <ol>${(d.reproSteps || []).map(s => `<li>${e(s)}</li>`).join('')}</ol>

    <h3>Expected result</h3>
    <p>${e(d.expectedResult)}</p>

    <h3>Actual result</h3>
    <p>${e(d.actualResult)}</p>

    <h3>Evidence</h3>
    <p class="hint">Click any screenshot to enlarge.</p>
    <div class="shots">${shots.map(f => `<figure><img src="{{IMG:${path.basename(f)}}}" alt="${e(path.basename(f))}" loading="lazy">
      <figcaption>${capFor(f, d)}</figcaption></figure>`).join('')}</div>

    <h3>How to fix it</h3>
    <p>${e(d.recommendation)}</p>
  </div>
</article>`;
};

// charset first: these pages carry Arabic UI strings, and a file:// open with no
// declared encoding is guessed as windows-1252, which mangles every one of them.
const html = `<meta charset="utf-8">
<title>${e(ctx.key)} — Defect Report</title>
<style>
:root{
  --ink:#13202D; --ink-2:#3B4E62; --muted:#6B7C8E; --line:#E1E8EE; --line-2:#F0F4F7;
  --bg:#FBFCFD; --card:#FFFFFF;
  --crit:#B02318; --high:#B4661B; --low:#5C6B7A; --ok:#1C6B4E;
}
@media (prefers-color-scheme:dark){:root{
  --ink:#EAF0F5; --ink-2:#BAC8D5; --muted:#8598A9; --line:#243342; --line-2:#1A2734;
  --bg:#0D151D; --card:#15212C;
  --crit:#F09287; --high:#E4B36A; --low:#93A5B5; --ok:#6FC9A2;
}}
:root[data-theme="dark"]{--ink:#EAF0F5;--ink-2:#BAC8D5;--muted:#8598A9;--line:#243342;--line-2:#1A2734;
  --bg:#0D151D;--card:#15212C;--crit:#F09287;--high:#E4B36A;--low:#93A5B5;--ok:#6FC9A2}
:root[data-theme="light"]{--ink:#13202D;--ink-2:#3B4E62;--muted:#6B7C8E;--line:#E1E8EE;--line-2:#F0F4F7;
  --bg:#FBFCFD;--card:#FFFFFF;--crit:#B02318;--high:#B4661B;--low:#5C6B7A;--ok:#1C6B4E}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:17px;line-height:1.65;
  -webkit-font-smoothing:antialiased}
.page{max-width:none;margin:0;padding:2.75rem clamp(1.25rem,3.5vw,3.5rem) 6rem}
h1{font-size:clamp(1.7rem,4vw,2.3rem);font-weight:700;letter-spacing:-.025em;margin:0 0 .6rem;line-height:1.15}
p{margin:0 0 1rem}
.sub{color:var(--ink-2);font-size:1.05rem;margin:0}
.top{border-bottom:2px solid var(--ink);padding-bottom:1.75rem;margin-bottom:1rem}
.facts{display:flex;flex-wrap:wrap;gap:.4rem 1.75rem;font-size:.88rem;color:var(--muted);margin-top:1.2rem}
.facts b{color:var(--ink);font-weight:650}

/* contents */
.toc{margin:2.5rem 0 0;padding:0;list-style:none;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.toc li{border-bottom:1px solid var(--line-2)}
.toc li:last-child{border-bottom:0}
.toc a{display:flex;gap:.9rem;align-items:baseline;padding:.8rem 1.1rem;text-decoration:none;color:inherit;
  transition:background .15s}
.toc a:hover{background:var(--line-2)}
.toc .r{font-weight:750;color:var(--muted);font-size:.85rem;min-width:1.6rem}
.toc .t{flex:1}
.toc .s{font-size:.7rem;font-weight:750;letter-spacing:.06em;text-transform:uppercase}

/* defect */
.d{margin:3.5rem 0 0;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden;
  scroll-margin-top:1.5rem}
.d-head{padding:1.5rem 1.75rem 1.25rem;border-bottom:1px solid var(--line);position:relative}
.d-head::before{content:"";position:absolute;top:0;left:0;right:0;height:5px;background:var(--low);
  transform-origin:left}
.d.crit .d-head::before{background:var(--crit)}
.d.high .d-head::before{background:var(--high)}
.sev{display:inline-block;font-size:.7rem;font-weight:750;letter-spacing:.09em;text-transform:uppercase;
  padding:.22rem .6rem;border-radius:4px;border:1.5px solid currentColor;color:var(--low);margin-bottom:.7rem}
.d.crit .sev{color:var(--crit)} .d.high .sev{color:var(--high)}
.d-head h2{font-size:1.22rem;font-weight:700;letter-spacing:-.015em;margin:0 0 .5rem;line-height:1.3}
.d-meta{font-size:.83rem;color:var(--muted);margin:0}
.d-body{padding:1.5rem 1.75rem 1.9rem}
/* full-width layout, but prose stops before it becomes unreadable on a wide monitor */
.d-body p,.d-body li{max-width:118ch}
.d-meta{max-width:130ch}
.d-body h3{font-size:.72rem;font-weight:750;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);
  margin:1.9rem 0 .6rem}
.d-body h3:first-child{margin-top:0}
.d-body ol{margin:0;padding-left:1.4rem}
.d-body li{margin-bottom:.4rem}
.hint{font-size:.83rem;color:var(--muted);margin:-.2rem 0 .8rem}


/* evidence */
/* two-up on wide screens now the page is full width */
.shots{display:grid;gap:1.2rem;grid-template-columns:repeat(auto-fit,minmax(38rem,1fr))}
figure{margin:0}
figure img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:6px;background:#fff;cursor:zoom-in}
figure img:hover{border-color:var(--muted)}
figcaption{font-size:.8rem;color:var(--muted);padding-top:.5rem}
/* visibility rather than display, so the fade can actually run */
#lb{position:fixed;inset:0;z-index:99;background:rgba(6,12,18,.95);display:flex;align-items:center;
  justify-content:center;padding:1.5rem;cursor:zoom-out;
  visibility:hidden;opacity:0;transition:opacity .22s ease,visibility .22s ease}
#lb.on{visibility:visible;opacity:1}
#lb img{max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;
  transform:scale(.97);transition:transform .28s cubic-bezier(.22,.61,.36,1)}
#lb.on img{transform:none}
#lb button{position:absolute;top:1rem;right:1.25rem;background:rgba(255,255,255,.14);color:#fff;border:0;
  padding:.4rem .8rem;border-radius:5px;cursor:pointer;font-family:inherit;font-size:.9rem}

footer{margin-top:4.5rem;padding-top:1.3rem;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted)}
@media(max-width:34rem){.d-head,.d-body{padding-left:1.15rem;padding-right:1.15rem}}

/* ============ motion ============
   All reveal states sit behind the .anim class, which JavaScript adds. If the script
   never runs, or the reader has asked for reduced motion, the page renders fully
   visible — a defect report must never be blank because an animation didn't fire. */
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

.anim .top{animation:rise .5s cubic-bezier(.22,.61,.36,1) both}
.anim .toc{animation:rise .5s cubic-bezier(.22,.61,.36,1) .07s both}
.anim .toc li{animation:rise .4s cubic-bezier(.22,.61,.36,1) both}
.anim .toc li:nth-child(1){animation-delay:.14s}
.anim .toc li:nth-child(2){animation-delay:.20s}
.anim .toc li:nth-child(3){animation-delay:.26s}
.anim .toc li:nth-child(4){animation-delay:.32s}

/* each defect eases in once, then stays put */
.anim .d{opacity:0;transform:translateY(16px);
  transition:opacity .55s cubic-bezier(.22,.61,.36,1),transform .55s cubic-bezier(.22,.61,.36,1)}
.anim .d.in{opacity:1;transform:none}

/* the severity rule draws itself in — the one flourish, and it encodes something real */
.anim .d-head::before{transform:scaleX(0);transition:transform .7s cubic-bezier(.22,.61,.36,1) .18s}
.anim .d.in .d-head::before{transform:scaleX(1)}

.toc a,.sev{transition:background .18s ease,transform .18s ease,color .18s ease}
.toc a:hover{transform:translateX(3px)}
figure img{transition:border-color .2s ease,transform .2s ease,box-shadow .2s ease}
figure img:hover{transform:translateY(-2px);box-shadow:0 8px 24px -12px rgba(0,0,0,.4)}

@media (prefers-reduced-motion:reduce){
  .anim .d{opacity:1!important;transform:none!important;transition:none!important}
  .anim .d-head::before,.anim .d.in .d-head::before{transform:none!important;transition:none!important}
  .anim .top,.anim .toc,.anim .toc li{animation:none!important;opacity:1!important}
  .toc a:hover,figure img:hover{transform:none}
  #lb,#lb img{transition:none!important}
}
@media print{
  .d{break-inside:avoid;box-shadow:none}
  #lb{display:none!important}
  .anim .d{opacity:1!important;transform:none!important}
  .anim .d-head::before{transform:none!important}
}
</style>

<div class="page">
<header class="top">
  <h1>${e(ctx.key)} — ${drafts.length} defects found</h1>
  <p class="sub">${e(story.summary)}</p>
  <div class="facts">
    <span><b>${e(review.verdict)}</b> — not ready to ship</span>
    <span><b>${review.passed}</b> of ${review.totalTests} tests passed</span>
    <span><b>${review.acCoveragePct}%</b> of criteria tested</span>
    <span>Tested on <b>UAT</b>, Chrome</span>
    <span>None filed in Jira</span>
  </div>
</header>

<ol class="toc">
${drafts.map(d => { const [l, c] = sev(d.severity); return `<li><a href="#${e(d.ref)}">
  <span class="r">${e(d.ref)}</span><span class="t">${e(d.title)}</span>
  <span class="s" style="color:var(--${c === 'crit' ? 'crit' : c === 'high' ? 'high' : 'low'})">${e(l)}</span></a></li>`; }).join('')}
</ol>

${drafts.map(card).join('')}

<footer><strong>QA AZM Digital Agent</strong> — Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
&nbsp;·&nbsp; ${e(ctx.key)} · ${e(ctx.timestamp)}</footer>
</div>

<div id="lb"><button aria-label="Close">Close ✕</button><img alt=""></div>
<script>
(function(){
  var lb=document.getElementById('lb'),im=lb.querySelector('img');
  document.addEventListener('click',function(ev){var t=ev.target;
   if(t.tagName==='IMG'&&t.closest('figure')){im.src=t.src;im.alt=t.alt;lb.classList.add('on');document.body.style.overflow='hidden'}
   else if(t===lb||t.tagName==='BUTTON'){lb.classList.remove('on');document.body.style.overflow=''}});
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'){lb.classList.remove('on');document.body.style.overflow=''}});

  // Reveal each defect once as it scrolls into view.
  var cards=[].slice.call(document.querySelectorAll('.d'));
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce||!('IntersectionObserver' in window)){cards.forEach(function(c){c.classList.add('in')});return}
  document.documentElement.classList.add('anim');
  var io=new IntersectionObserver(function(es){
    es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target)}});
  },{rootMargin:'0px 0px -10% 0px',threshold:.1});
  cards.forEach(function(c){io.observe(c)});
  requestAnimationFrame(function(){
    cards.forEach(function(c){if(c.getBoundingClientRect().top<window.innerHeight)c.classList.add('in')});
  });
})();
</script>`;

// Evidence is mandatory: a defect without a screenshot is an assertion, not a finding.
const noEvidence = drafts.filter(d => shotsFor(d).length === 0).map(d => d.ref);
if (noEvidence.length) {
  console.error(`REFUSING TO WRITE: no screenshot evidence for ${noEvidence.join(', ')}.`);
  console.error('Every defect must carry at least one screenshot. Fix the capture or the draft, then re-run.');
  process.exit(1);
}

fs.writeFileSync(path.join(RUN, 'bug-report.html'), html);
const per = drafts.map(d => `${d.ref}:${shotsFor(d).length}`).join('  ');
console.log(`bug-report.html written: ${drafts.length} defects · screenshots per defect — ${per}`);
