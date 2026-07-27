// Pipeline diagram for the QA framework: each agent, the single file it writes, the
// validator that checks it, and the retry and rerun loops. No story-specific data.

const ROWS = [
  { a: 'qa-story',         f: 'story.json',         r: 'the Jira issue',     n: 'atomic acceptance criteria', v: 1 },
  { a: 'qa-test-writer',   f: 'test-cases.json',    r: 'story.json',         n: 'happy, negative and edge cases', v: 1 },
  { a: 'qa-gap-analyzer',  f: 'gap-report.json',    r: 'test-cases.json',    n: 'coverage per criterion', v: 1 },
  { gate: 'Test-plan approval', why: 'no browser runs until a human says go' },
  { a: 'qa-test-sync',     f: 'aio-sync.json',      r: 'test-cases.json',    n: 'mirrors the plan into AIO Tests' },
  { a: 'qa-test-executor', f: 'results.json',       r: 'test-cases.json',    n: 'per-case verdict + screenshots', v: 1, live: 1 },
  { a: 'qa-bug-logger',    f: 'bugs-proposed.json', r: 'results.json',       n: 'Phase A · drafts only', v: 1 },
  { gate: 'Defect approval', why: 'no Jira write without explicit consent' },
  { a: 'qa-bug-logger',    f: 'bugs-created.json',  r: 'bugs-proposed.json', n: 'Phase B · approved drafts only', v: 1 },
  { a: 'qa-reviewer',      f: 'review.json',        r: 'every file above',   n: 'GO / NO-GO verdict', v: 1 },
  { a: 'orchestrator',     f: 'bug-report.html',    r: 'review.json',        n: 'published to the reader', out: 1 },
];

// ---- exclusive x-bands, left to right ----
const RERUN_X = 30;                     // rerun loop lane + its rotated label
const SPINE   = 92;
const AX = 126, AW = 208;               // agent box      126 → 334
const FX = 376, FW = 196;               // file box       376 → 572
const VX = 610, VW = 46;   // holds a 20px check mark, centred                // validator band 610 → 656  (slim, rotated label)
const MX = 700;                         // meta text starts here, nothing to its left
const W = 1180, PAD = 30;
const AH = 46, ROW = 66, GATE = 52;
const GATE_RIGHT = VX + VW;             // gates stop at the validator band, never past it

let y = PAD + 40, geo = [], stage = 0;
for (const r of ROWS) {
  if (r.gate) { geo.push({ ...r, y, h: GATE }); y += GATE + 16; }
  else { geo.push({ ...r, y, h: AH, i: stage++ }); y += ROW; }
}
const agents = geo.filter(g => !g.gate);
const cy = g => g.y + g.h / 2;
const validated = agents.filter(g => g.v);
const H = y + 74;


exports.CSS = `
.flow{--cycle:${agents.length * 1.15}s;--step:1.15s;position:relative;margin:1.25rem 0 0}
.flow-lead{margin:0 0 1.6rem}
.fl-claim{font-size:1.12rem;font-weight:700;letter-spacing:-.015em;color:var(--ink);margin:0 0 .5rem;
  padding-left:.9rem;border-left:3px solid var(--accent)}
.fl-claim em{font-style:normal;color:var(--accent)}
.fl-body{font-size:.92rem;color:var(--ink-2);margin:0 0 1.25rem;padding-left:.9rem;max-width:78ch}
.fl-why{list-style:none;margin:0;padding:0;display:grid;gap:1rem;
  grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))}
.fl-why li{font-size:.85rem;color:var(--muted);line-height:1.55;padding-top:.7rem;
  border-top:2px solid var(--hair)}
.fl-why li span{display:block;font-size:.63rem;font-weight:750;letter-spacing:.13em;text-transform:uppercase;
  color:var(--accent);margin-bottom:.3rem}
.flow-wrap{position:relative;overflow-x:auto;border:1px solid var(--hair);border-radius:10px;
  background:linear-gradient(160deg,var(--surface),var(--sunk));padding:.4rem}
.flow-wrap::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:10px;
  background:radial-gradient(40rem 18rem at 15% 10%,color-mix(in srgb,var(--accent) 9%,transparent),transparent 70%),
             radial-gradient(34rem 16rem at 88% 85%,color-mix(in srgb,var(--user) 8%,transparent),transparent 70%);
  animation:dgAura 20s ease-in-out infinite}
@keyframes dgAura{0%,100%{opacity:.6}50%{opacity:1}}
svg.dg{display:block;width:100%;height:auto;min-width:64rem;position:relative}

.dg .rail{stroke:var(--hair);stroke-width:2}
.dg .box{fill:var(--surface);stroke:var(--hair);stroke-width:1.5}
.dg .file{fill:var(--sunk);stroke:var(--hair);stroke-width:1.5;stroke-dasharray:4 3}
.dg .out .file{fill:var(--accent-soft);stroke:var(--accent);stroke-dasharray:none}
.dg .wire{stroke:var(--hair);stroke-width:1.5;fill:none}
.dg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.dg .t-agent{font-family:ui-monospace,Consolas,monospace;font-size:13.5px;font-weight:700;fill:var(--ink)}
.dg .t-idx{font-family:ui-monospace,Consolas,monospace;font-size:11px;font-weight:700;fill:var(--muted)}
.dg .t-file{font-family:ui-monospace,Consolas,monospace;font-size:12px;fill:var(--ink-2)}
.dg .out .t-file{fill:var(--accent);font-weight:600}
.dg .t-meta{font-size:11.5px;fill:var(--muted)}
.dg .t-meta tspan{fill:var(--ink-2);font-weight:600}
.dg .t-col{font-size:9.5px;font-weight:750;letter-spacing:1.6px;fill:var(--muted)}
.dg .node{fill:var(--paper);stroke:var(--hair);stroke-width:2.5}

/* validator: a slim band with a rotated label — no caption to collide with rows */
.dg .t-colv{font-family:ui-monospace,Consolas,monospace;font-size:10px;font-weight:700;
  fill:var(--accent);letter-spacing:.3px}
.dg .vok{fill:color-mix(in srgb,var(--accent) 14%,transparent);stroke:var(--accent);stroke-width:1.5}
.dg .vokmark{stroke:var(--accent);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
.dg .vno{stroke:var(--hair);stroke-width:2;stroke-linecap:round}
.dg .hnode{fill:color-mix(in srgb,var(--user) 25%,var(--paper));stroke:var(--user);stroke-width:2.5}
.dg .t-human{font-size:11px;fill:var(--muted)}
.dg .t-human tspan{font-family:ui-monospace,Consolas,monospace;fill:var(--user);font-weight:700}
.dg .vtick{stroke:var(--accent);stroke-width:1.2;fill:none;opacity:.55;stroke-dasharray:3 3;
  animation:dgTick 1.4s linear infinite}
@keyframes dgTick{to{stroke-dashoffset:-6}}

.dg .loop{stroke:var(--low);stroke-width:1.8;fill:none;stroke-dasharray:7 5;
  animation:dgLoop 1.6s linear infinite}
@keyframes dgLoop{to{stroke-dashoffset:-12}}
.dg .t-loop{font-size:11px;font-weight:600;fill:var(--low)}
.dg .rerun{stroke:var(--user);stroke-width:1.8;fill:none;stroke-dasharray:8 6;
  animation:dgRerun 2s linear infinite}
@keyframes dgRerun{to{stroke-dashoffset:-14}}
.dg .t-rerun{font-size:10.5px;font-weight:600;fill:var(--user);letter-spacing:.3px}

.dg .gate{fill:color-mix(in srgb,var(--low) 12%,transparent);stroke:var(--low);stroke-width:1.5}
.dg .t-gate{font-size:12.5px;font-weight:700;fill:var(--low)}
.dg .t-gwhy{font-size:11.5px;fill:var(--ink-2)}
.dg .t-pause{font-size:9px;font-weight:750;letter-spacing:1.4px;fill:var(--low);opacity:.85}
.dg .gnode{fill:color-mix(in srgb,var(--low) 22%,var(--paper));stroke:var(--low);stroke-width:2.5;
  animation:dgBreathe 3s ease-in-out infinite}
@keyframes dgBreathe{0%,100%{r:6}50%{r:8}}

.dg .current{stroke:var(--accent);stroke-width:2.5;fill:none;stroke-linecap:round;
  stroke-dasharray:14 10;filter:url(#dgGlow);animation:dgCurrent 1.1s linear infinite}
@keyframes dgCurrent{to{stroke-dashoffset:-24}}
.dg .packet{fill:var(--accent-2);filter:url(#dgGlow);animation:dgTravel var(--cycle) linear infinite}
@keyframes dgTravel{0%{transform:translateY(0);opacity:0}3%{opacity:1}97%{opacity:1}
  100%{transform:translateY(${cy(agents[agents.length - 1]) - cy(agents[0])}px);opacity:0}}

.dg g.row{--d:calc(var(--i) * var(--step))}
.dg g.row .box{animation:dgBox var(--cycle) linear infinite;animation-delay:var(--d)}
@keyframes dgBox{0%,100%{stroke:var(--hair);stroke-width:1.5}
  2%{stroke:var(--accent);stroke-width:2.5}14%{stroke:var(--hair);stroke-width:1.5}}
.dg g.row .node{animation:dgNode var(--cycle) linear infinite;animation-delay:var(--d)}
@keyframes dgNode{0%,100%{stroke:var(--hair);r:5}2%{stroke:var(--accent);r:7.5}14%{stroke:var(--hair);r:5}}
.dg g.row .halo{fill:none;stroke:var(--accent);stroke-width:2;opacity:0;
  animation:dgHalo var(--cycle) linear infinite;animation-delay:var(--d)}
@keyframes dgHalo{0%,100%{r:5;opacity:0}2%{r:5;opacity:.85}12%{r:19;opacity:0}}
.dg g.row .wire{animation:dgWire var(--cycle) linear infinite;animation-delay:var(--d)}
@keyframes dgWire{0%,100%{stroke:var(--hair);stroke-width:1.5}
  4%{stroke:var(--accent);stroke-width:2.2}15%{stroke:var(--hair);stroke-width:1.5}}
.dg g.row .spark{fill:var(--accent-2);opacity:0;filter:url(#dgGlow);
  animation:dgSpark var(--cycle) linear infinite;animation-delay:var(--d)}
@keyframes dgSpark{0%{transform:translateX(0);opacity:0}3%{opacity:1}
  11%{transform:translateX(${FX - (AX + AW) - 8}px);opacity:1}13%{opacity:0}100%{opacity:0}}
.dg g.row .file{animation:dgFile var(--cycle) linear infinite;animation-delay:calc(var(--d) + .1s)}
@keyframes dgFile{0%,100%{stroke:var(--hair);fill:var(--sunk)}
  6%{stroke:var(--accent);fill:color-mix(in srgb,var(--accent) 16%,var(--sunk))}
  18%{stroke:var(--hair);fill:var(--sunk)}}
.dg g.row.out .file{animation:none}
.dg g.row .t-agent{animation:dgLbl var(--cycle) linear infinite;animation-delay:var(--d)}
@keyframes dgLbl{0%,100%{fill:var(--ink)}3%{fill:var(--accent)}14%{fill:var(--ink)}}
.dg .t-meta tspan.m-live{fill:var(--accent);font-weight:700;animation:dgLive 2.4s ease-out infinite}
.dg g.row.islive .box{stroke-dasharray:none;stroke-width:2}
@keyframes dgLive{0%,100%{opacity:.4}50%{opacity:1}}

.flow-wrap:hover .dg *{animation-play-state:paused}

.fl-legend{display:flex;flex-wrap:wrap;gap:.55rem 1.6rem;margin:1.3rem 0 0;font-size:.77rem;color:var(--muted)}
.fl-legend i{display:inline-block;width:.75rem;height:.75rem;border-radius:50%;margin-right:.45rem;vertical-align:-1px}
.fl-legend i.sq{border-radius:2px}
.fl-hint{font-size:.74rem;color:var(--muted);margin:.8rem 0 0;font-style:italic}

@media (prefers-reduced-motion:reduce){
  .flow-wrap::before,.dg .current,.dg .packet,.dg .vtick,.dg .loop,.dg .rerun,
  .dg .gnode,.dg .live,.dg g.row *{animation:none!important}
  .dg .packet,.dg .spark{display:none}
}
@media print{
  .flow-wrap::before,.dg .current,.dg .packet,.dg .vtick,.dg .loop,.dg .rerun,
  .dg .gnode,.dg .live,.dg g.row *{animation:none!important}
  .dg .packet,.dg .spark{display:none}
  svg.dg{min-width:0}
}
`;

exports.html = (e) => {
  const P = [];

  // ---- validator column: an explicit mark per row, never a band ----
  // A continuous band would enclose qa-test-sync and both gates, which are not checked.

  // ---- spine + current + packet ----
  const y0 = cy(agents[0]), y1 = cy(agents[agents.length - 1]);
  P.push(`<line class="rail" x1="${SPINE}" y1="${y0}" x2="${SPINE}" y2="${y1}"/>`);
  P.push(`<line class="current" x1="${SPINE}" y1="${y0}" x2="${SPINE}" y2="${y1}"/>`);
  P.push(`<circle class="packet" cx="${SPINE}" cy="${y0}" r="6"/>`);

  // ---- column headers, each over its own band ----
  P.push(`<text class="t-col" x="${AX}" y="${PAD + 6}">AGENT</text>`);
  P.push(`<text class="t-col" x="${FX}" y="${PAD + 6}">WRITES</text>`);
  P.push(`<text class="t-colv" x="${VX + VW / 2}" y="${PAD + 6}" text-anchor="middle">qa-validator</text>`);
  P.push(`<text class="t-col" x="${MX}" y="${PAD + 6}">READS &#183; RESULT</text>`);

  for (const g of geo) {
    const m = cy(g);
    if (g.gate) {
      P.push(`<g class="gaterow">
      <circle class="gnode" cx="${SPINE}" cy="${m}" r="6"/>
      <rect class="gate" x="${AX}" y="${g.y}" width="${GATE_RIGHT - AX}" height="${g.h}" rx="6"/>
      <text class="t-pause" x="${AX + 16}" y="${m + 4}">PAUSE</text>
      <text class="t-gate" x="${AX + 62}" y="${m + 4}">${e(g.gate)}</text>
      <text class="t-gwhy" x="${MX}" y="${m + 4}">&#8212; ${e(g.why)}</text>
    </g>`);
      continue;
    }
    P.push(`<g class="row${g.out ? ' out' : ''}${g.live ? ' islive' : ''}" style="--i:${g.i}">
      <circle class="halo" cx="${SPINE}" cy="${m}" r="5"/>
      <circle class="node" cx="${SPINE}" cy="${m}" r="5"/>
      <line class="wire" x1="${SPINE + 9}" y1="${m}" x2="${AX - 5}" y2="${m}"/>
      <rect class="box" x="${AX}" y="${g.y}" width="${AW}" height="${AH}" rx="6"/>
      <text class="t-idx" x="${AX + 14}" y="${m + 4}">${String(g.i + 1).padStart(2, '0')}</text>
      <text class="t-agent" x="${AX + 42}" y="${m + 5}">${e(g.a)}</text>
      <line class="wire" x1="${AX + AW}" y1="${m}" x2="${FX - 9}" y2="${m}" marker-end="url(#dgArrow)"/>
      <circle class="spark" cx="${AX + AW + 4}" cy="${m}" r="3.5"/>
      <rect class="file" x="${FX}" y="${m - 20}" width="${FW}" height="40" rx="5"/>
      <text class="t-file" x="${FX + 12}" y="${m + 4}">${e(g.f)}</text>
      ${g.v
        ? `<path class="vtick" d="M ${FX + FW + 6} ${m} H ${VX - 6}" marker-end="url(#dgArrowA)"/>
           <circle class="vok" cx="${VX + VW / 2}" cy="${m}" r="10"/>
           <path class="vokmark" d="M ${VX + VW / 2 - 4.5} ${m} l 3.2 3.4 l 6-7"/>`
        : `<line class="vno" x1="${VX + VW / 2 - 6}" y1="${m}" x2="${VX + VW / 2 + 6}" y2="${m}"/>`}
      <text class="t-meta" x="${MX}" y="${m + 4}">reads <tspan>${e(g.r)}</tspan> &#183; ${e(g.n)}${g.live ? ' &#183; <tspan class="m-live">drives the live app</tspan>' : ''}</text>
    </g>`);
  }

  // ---- fix-retry: a self-loop on the stage itself, in the gap below its row ----
  const rt = agents[4], rm = cy(rt), gy = rt.y + AH + 13;
  P.push(`<path class="loop" d="M ${VX + VW / 2} ${rm + 12} V ${gy} H ${AX + AW / 2} V ${rt.y + AH + 4}"
    marker-end="url(#dgArrowL)"/>`);
  P.push(`<text class="t-loop" x="${MX}" y="${gy + 4}">pass=false &#8594; the same stage re-runs, max 2, then escalates to a human &#183; any checked stage</text>`);

  // ---- rerun: human-initiated after the run ends, not emitted by any agent ----
  const exY = cy(agents[4]), endY = cy(agents[agents.length - 1]) + 34;
  P.push(`<circle class="hnode" cx="${SPINE}" cy="${endY}" r="5"/>`);
  P.push(`<text class="t-human" x="${SPINE + 14}" y="${endY + 4}">a person may then run <tspan>--rerun</tspan></text>`);
  P.push(`<path class="rerun" d="M ${SPINE - 9} ${endY} H ${RERUN_X + 14} V ${exY} H ${SPINE - 10}"
    marker-end="url(#dgArrowR)"/>`);
  P.push(`<text class="t-rerun" x="${RERUN_X + 4}" y="${(endY + exY) / 2}" text-anchor="middle"
    transform="rotate(-90 ${RERUN_X + 4} ${(endY + exY) / 2})">--rerun &#183; re-executes blocked cases</text>`);

  return `<h2 id="p-flow">How the pipeline moves information</h2>
<div class="flow">
  <div class="flow-lead">
    <p class="fl-claim">The files <em>are</em> the interface &mdash; not a conversation.</p>
    <p class="fl-body">Every agent runs in isolation with no shared memory. It reads the previous agent's file from
    disk, writes exactly one file of its own, and stops. Nothing is handed over in memory.</p>
    <ul class="fl-why">
      <li><span>Isolated</span>An agent cannot see another agent's reasoning &mdash; only what it wrote down.</li>
      <li><span>Re-runnable</span>Any stage can run again from its inputs, which is what makes a retry or a rerun safe.</li>
      <li><span>Independently checked</span>qa-validator re-derives what a stage should have produced from the source,
      never from the agent that produced it.</li>
    </ul>
  </div>
  <div class="flow-wrap">
    <svg class="dg" viewBox="0 0 ${W} ${H}" role="img"
         aria-label="Pipeline diagram: ${agents.length} agents, each reading the previous agent's file and writing exactly one file of its own; ${geo.length - agents.length} human approval gates; qa-validator independently checking ${validated.length} stages; a fix-retry loop and a rerun loop.">
      <defs>
        <filter id="dgGlow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="3.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <marker id="dgArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--hair)"/></marker>
        <marker id="dgArrowA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" opacity=".75"/></marker>
        <marker id="dgArrowL" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--low)"/></marker>
        <marker id="dgArrowR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--user)"/></marker>
      </defs>
${P.join('\n')}
    </svg>
  </div>
  <div class="fl-legend">
    <span><i style="background:var(--accent)"></i>current flowing between stages</span>
    <span><i class="sq" style="background:color-mix(in srgb,var(--low) 30%,transparent);box-shadow:inset 0 0 0 1.5px var(--low)"></i>human gate &mdash; the run stops here</span>
    <span><i class="sq" style="background:transparent;box-shadow:inset 0 0 0 1.5px var(--accent)"></i>validator check</span>
    <span><i class="sq" style="background:transparent;box-shadow:inset 0 0 0 1.5px var(--low)"></i>fix-retry loop</span>
    <span><i class="sq" style="background:transparent;box-shadow:inset 0 0 0 1.5px var(--user)"></i>rerun loop</span>
  </div>
  <p class="fl-hint">Hover the diagram to freeze the flow and study a single stage.</p>
</div>`;
};
