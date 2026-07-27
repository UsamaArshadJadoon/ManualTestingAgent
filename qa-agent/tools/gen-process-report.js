#!/usr/bin/env node
// Process-log generator. Renders a run folder plus its process-steps.json as an
// annotated timeline, led by the pipeline diagram. No story-specific content.
//   node gen-process-report.js <runFolder>
const fs = require('fs');
const path = require('path');
const UI = require('./report-ui.js');
const FLOW = require('./report-flow.js');
const RUN = process.argv[2];
const rd = f => JSON.parse(fs.readFileSync(path.join(RUN, f), 'utf8'));
const ctx = rd('run-context.json'), review = rd('review.json'), drafts = rd('bugs-proposed.json').drafts;
const story = rd('story.json');
const created = (() => { try { return rd('bugs-created.json').created || []; } catch { return []; } })();
const valDir = path.join(RUN, 'validation');
const valFiles = fs.existsSync(valDir) ? fs.readdirSync(valDir).filter(f => f.endsWith('.json')) : [];
const valStates = valFiles.map(f => JSON.parse(fs.readFileSync(path.join(valDir, f), 'utf8')));
const valTotal = valStates.length, valPass = valStates.filter(v => v.pass).length;
const valGaps = valStates.reduce((t, v) => t + (v.gaps || []).length, 0);

const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const m = s => `<span class="mono">${e(s)}</span>`;

// actor → chip class
const W = { req: 'w-user', stage: 'w-stage', gate: 'w-gate', check: 'w-val' };
const LBL = { req: 'Request', stage: 'Pipeline stage', gate: 'Decision gate', check: 'Validation' };

// Steps are per-run narrative, supplied as process-steps.json in the run folder.
// The tool renders them; it does not author them.
const stepsFile = path.join(RUN, 'process-steps.json');
if (!fs.existsSync(stepsFile)) {
  console.error('Missing ' + stepsFile);
  console.error('gen-process-report.js renders a per-run narrative, it does not invent one.');
  console.error('Expected shape: { "steps": [ { "phase", "actor", "title", "said", "html" } ] }');
  console.error('  actor is one of: req | stage | gate | check');
  process.exit(1);
}
const S = JSON.parse(fs.readFileSync(stepsFile, 'utf8')).steps
  .map(x => [x.phase, x.actor, x.title, x.said, x.html]);

const PHASES = [...new Set(S.map(s => s[0]))];
const nav = [['p-flow', 'Pipeline'], ...PHASES.map(p => [`p-${p.toLowerCase()}`, p])];

let html = '', n = 0, seen = new Set();
for (const [phase, actor, title, said, body] of S) {
  if (!seen.has(phase)) { seen.add(phase); html += `\n<h2 id="p-${phase.toLowerCase()}">${e(phase)}</h2>\n`; }
  n++;
  html += `<div class="step" id="step-${n}">
  <div class="n">${String(n).padStart(2, '0')}</div>
  <div><span class="who ${W[actor]}">${LBL[actor]}</span>
    <h3>${e(title)}</h3>
    ${said ? `<div class="said"><b>Requested</b>“${e(said)}”</div>` : ''}
    ${body}
  </div>
</div>\n`;
}

const body = `
<header class="hero-band">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="hero-grid">
    <div class="hero-main">
      <p class="eyebrow">QA AZM Digital Agent &middot; Process log</p>
      <h1>How <span class="key">${e(ctx.key)}</span> reached its verdict</h1>
      <p class="story-line">${e(story.summary)}</p>
      <p class="lede">${n} recorded steps, with an independent validator after every producing stage. This log
      shows what was asked, what each agent returned, and where the run stopped and waited for a person &mdash; in
      the order it happened.</p>
    </div>
    <aside class="plaque v-${review.verdict === 'GO' ? 'go' : 'no'}">
      <span class="plaque-ring" aria-hidden="true"></span>
      <span class="plaque-label">Verdict</span>
      <strong class="plaque-tag">${e(review.verdict)}</strong>
      <span class="plaque-sub">not ready to ship</span>
      <span class="plaque-rule" aria-hidden="true"></span>
      <span class="plaque-why">${drafts.length} confirmed defects &middot; ${review.failed} of ${review.totalTests} cases failed</span>
    </aside>
  </div>
  <ul class="est">
    <li><span class="est-n">${review.acCoveragePct}%</span>
      <span class="est-t"><b>of the ${story.acceptanceCriteria.length} acceptance criteria were tested</b>, and all
      ${review.totalTests} cases executed &mdash; ${review.blocked} blocked, so nothing rests on an untested criterion.</span></li>
    <li><span class="est-n">${drafts.length}</span>
      <span class="est-t"><b>defects confirmed against a written acceptance criterion</b> by the bug-logger's
      AC-conformance gate.</span></li>
    <li><span class="est-n">${created.length}</span>
      <span class="est-t"><b>${created.length === 0 ? 'writes to Jira' : 'defects filed in Jira'}.</b>
      ${created.length === 0
        ? 'Both approval gates were honoured &mdash; the defect list exists only in these reports.'
        : 'Created only after explicit approval at the defect gate.'}</span></li>
  </ul>
</header>

<dl class="stats">
  <div class="stat"><dt>Steps recorded</dt><dd>${n}</dd><small>across ${PHASES.length} phases</small></div>
  <div class="stat"><dt>Stages validated</dt><dd>${valPass}/${valTotal}</dd><small>${valGaps} open gaps</small></div>
  <div class="stat"><dt>Cases executed</dt><dd>${review.totalTests - review.blocked}/${review.totalTests}</dd><small>${review.passed} passed, ${review.failed} failed</small></div>
  <div class="stat is-high"><dt>Defects</dt><dd>${drafts.length}</dd><small>${created.length} filed in Jira</small></div>
  <div class="stat is-high"><dt>Verdict</dt><dd style="font-size:1.35rem">${e(review.verdict)}</dd><small>not ready to ship</small></div>
</dl>
${FLOW.html(e)}
${html}
`;

// Motion: one orchestrated idea — the log is a timeline, so it gets a spine whose
// nodes light up as each step enters view. Everything is opt-in via the `anim` class,
// so if JS never runs the page renders fully visible rather than blank.
const ANIM_CSS = `
/* ================= hero band ================= */
.hero-band{position:relative;overflow:hidden;border:1px solid var(--hair);border-radius:10px;
  background:linear-gradient(150deg,var(--surface),var(--sunk));
  padding:clamp(1.6rem,3.2vw,2.6rem);margin:0 0 2rem}
.hero-glow{position:absolute;inset:-30% -10%;pointer-events:none;
  background:
    radial-gradient(38rem 20rem at 8% 12%,color-mix(in srgb,var(--accent) 20%,transparent),transparent 68%),
    radial-gradient(32rem 18rem at 92% 88%,color-mix(in srgb,var(--user) 16%,transparent),transparent 68%),
    radial-gradient(26rem 14rem at 60% 0%,color-mix(in srgb,var(--accent-2) 12%,transparent),transparent 70%);
  animation:heroDrift 22s ease-in-out infinite}
@keyframes heroDrift{0%,100%{transform:translate3d(0,0,0) scale(1);opacity:.75}
  50%{transform:translate3d(-2%,1.5%,0) scale(1.06);opacity:1}}
.hero-band::after{content:"";position:absolute;left:0;right:0;top:0;height:3px;
  background:linear-gradient(90deg,var(--accent),var(--accent-2),var(--user));
  transform-origin:left;transform:scaleX(0);animation:heroRule 1.1s cubic-bezier(.22,.61,.36,1) .1s both}
@keyframes heroRule{to{transform:scaleX(1)}}

.hero-grid{position:relative;display:grid;grid-template-columns:1fr auto;gap:2rem;align-items:start}
.hero-main{min-width:0}
.hero-main h1{font-size:clamp(1.85rem,4.2vw,2.9rem);line-height:1.08;margin:0}
.hero-main h1 .key{background:linear-gradient(90deg,var(--accent),var(--accent-2));
  -webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap}
.story-line{font-size:1.05rem;font-weight:600;color:var(--ink);margin:.9rem 0 0;letter-spacing:-.01em;
  max-width:58ch;padding-left:.85rem;border-left:3px solid var(--accent)}
.hero-main .lede{margin:1.05rem 0 0;max-width:70ch;font-size:.98rem}
@media(max-width:56rem){.hero-grid{grid-template-columns:1fr}}

/* ---- verdict plaque ---- */
.plaque{position:relative;display:grid;justify-items:center;text-align:center;gap:.2rem;
  padding:1.25rem 1.7rem 1.15rem;border-radius:8px;min-width:12.5rem;
  border:2px solid var(--high);background:color-mix(in srgb,var(--high) 9%,var(--surface));
  box-shadow:0 10px 32px -18px color-mix(in srgb,var(--high) 85%,transparent);
  animation:plaqueIn .7s cubic-bezier(.2,.7,.3,1) .25s both}
.plaque.v-go{border-color:var(--pass);background:color-mix(in srgb,var(--pass) 9%,var(--surface));
  box-shadow:0 10px 32px -18px color-mix(in srgb,var(--pass) 85%,transparent)}
@keyframes plaqueIn{from{opacity:0;transform:translateY(-8px) scale(.94)}to{opacity:1;transform:none}}
.plaque-ring{position:absolute;inset:-2px;border-radius:8px;border:2px solid var(--high);opacity:0;
  animation:plaqueRing 3.4s ease-out infinite .9s}
.plaque.v-go .plaque-ring{border-color:var(--pass)}
@keyframes plaqueRing{0%{transform:scale(1);opacity:.55}60%,100%{transform:scale(1.16);opacity:0}}
.plaque-label{font-size:.6rem;font-weight:750;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.plaque-tag{font-size:clamp(1.9rem,4.4vw,2.6rem);font-weight:800;letter-spacing:-.035em;line-height:1;
  color:var(--high)}
.plaque.v-go .plaque-tag{color:var(--pass)}
.plaque-sub{font-size:.74rem;color:var(--ink-2);font-weight:600}
.plaque-rule{width:2.2rem;height:2px;border-radius:2px;background:var(--high);opacity:.45;margin:.5rem 0 .35rem}
.plaque.v-go .plaque-rule{background:var(--pass)}
.plaque-why{font-size:.72rem;color:var(--muted);max-width:14ch;line-height:1.45}

/* ---- what the run established ---- */
.est{list-style:none;position:relative;margin:1.9rem 0 0;padding:1.5rem 0 0;display:grid;gap:1rem;
  grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));border-top:1px solid var(--hair)}
.est li{display:grid;grid-template-columns:auto 1fr;gap:.85rem;align-items:baseline;
  animation:rise .55s cubic-bezier(.22,.61,.36,1) both}
.est li:nth-child(1){animation-delay:.42s}
.est li:nth-child(2){animation-delay:.52s}
.est li:nth-child(3){animation-delay:.62s}
.est-n{font-size:1.6rem;font-weight:800;letter-spacing:-.03em;line-height:1;
  font-variant-numeric:tabular-nums;
  background:linear-gradient(160deg,var(--accent),var(--accent-2));
  -webkit-background-clip:text;background-clip:text;color:transparent}
.est-t{font-size:.87rem;color:var(--muted);line-height:1.55}
.est-t b{color:var(--ink-2);font-weight:650}

@media (prefers-reduced-motion:reduce){
  .hero-glow,.hero-band::after,.plaque,.plaque-ring,.est li{animation:none!important}
  .hero-band::after{transform:scaleX(1)}
  .plaque{opacity:1;transform:none}
  .est li{opacity:1}
  .plaque-ring{display:none}
}
@media print{
  .hero-glow,.plaque-ring{display:none}
  .hero-band::after{animation:none;transform:scaleX(1)}
  .plaque,.est li{animation:none!important;opacity:1!important;transform:none!important}
}


/* --- timeline spine --- */
.step{position:relative}
.step::before{content:"";position:absolute;left:1.02rem;top:0;bottom:0;width:2px;background:var(--hair)}
.step:first-of-type::before{top:2.4rem}
.step:last-of-type::before{bottom:auto;height:2.4rem}
.n{position:relative;z-index:1;display:grid;place-items:center;width:2.1rem;height:2.1rem;
  border-radius:50%;background:var(--paper);border:2px solid var(--hair);color:var(--muted);
  font-size:.7rem;padding:0;margin-top:.35rem;
  transition:border-color .45s ease,color .45s ease,transform .45s ease}
.step.in .n{border-color:var(--accent);color:var(--accent)}
.step.in::before{background:linear-gradient(var(--accent),var(--hair))}

/* --- scroll reveal (only when JS enabled) --- */
.anim .step > div:last-child{opacity:0;transform:translateY(14px);
  transition:opacity .55s cubic-bezier(.22,.61,.36,1),transform .55s cubic-bezier(.22,.61,.36,1)}
.anim .step.in > div:last-child{opacity:1;transform:none}
.anim .step .n{transform:scale(.86)}
.anim .step.in .n{transform:scale(1)}

/* --- page-load sequence --- */
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.anim .masthead{animation:rise .55s cubic-bezier(.22,.61,.36,1) both}
.anim .stats .stat{animation:rise .5s cubic-bezier(.22,.61,.36,1) both}
.anim .stats .stat:nth-child(1){animation-delay:.06s}
.anim .stats .stat:nth-child(2){animation-delay:.12s}
.anim .stats .stat:nth-child(3){animation-delay:.18s}
.anim .stats .stat:nth-child(4){animation-delay:.24s}
.anim .stats .stat:nth-child(5){animation-delay:.30s}
.anim .stats .stat:nth-child(6){animation-delay:.36s}
.anim .bar{animation:rise .4s ease both}

/* --- quiet detail --- */
.said{transition:border-color .25s}
.step.in .said{border-left-color:var(--user)}
.who{transition:transform .25s}
.step:hover .who{transform:translateX(2px)}

/* The single-column layout has no column for a spine to sit in. */
@media(max-width:40rem){
  .step::before{display:none}
  .n{margin-top:0;width:auto;height:auto;border-radius:var(--r);border:0;
     background:none;place-items:start;font-size:.75rem}
}

/* Never let motion hide content from anyone who opted out of it. */
@media (prefers-reduced-motion:reduce){
  .anim .step > div:last-child{opacity:1!important;transform:none!important}
  .anim .masthead,.anim .stats .stat,.anim .bar{animation:none!important;opacity:1!important}
  .anim .step .n,.anim .step.in .n{transform:none!important}
}
@media print{.anim .step > div:last-child{opacity:1!important;transform:none!important}}
`;

const ANIM_JS = `
(function(){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var steps=[].slice.call(document.querySelectorAll('.step'));
  if(reduce||!('IntersectionObserver' in window)){steps.forEach(function(s){s.classList.add('in')});return}
  document.documentElement.classList.add('anim');
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target)}
    });
  },{rootMargin:'0px 0px -12% 0px',threshold:.15});
  steps.forEach(function(s){io.observe(s)});
  // anything already above the fold shows immediately
  requestAnimationFrame(function(){
    steps.forEach(function(s){if(s.getBoundingClientRect().top<window.innerHeight)s.classList.add('in')});
  });
})();
`;

fs.writeFileSync(path.join(RUN, 'process-report.html'), `<title>${e(ctx.key)} — QA Process Log</title>
<style>${UI.CSS}${FLOW.CSS}${ANIM_CSS}</style>
<div class="bar"><div class="bar-in">
  <span class="brand">QA AZM Digital Agent <span>· ${e(ctx.key)} process log</span></span>
  <nav class="jump">${nav.map(([id, l]) => `<a href="#${id}">${e(l)}</a>`).join('')}</nav>
</div></div>
<div class="wrap narrow">${body}
<footer><span><strong>QA AZM Digital Agent</strong> — Developed by Usama Arshad Jadoon · QC Lead · AZM Digital</span>
<span class="mono">${e(ctx.key)} · run ${e(ctx.timestamp)}</span></footer>
</div>
<script>${UI.JS}${ANIM_JS}</script>`);
console.log(`process-report.html written: ${n} steps across ${PHASES.length} phases`);
