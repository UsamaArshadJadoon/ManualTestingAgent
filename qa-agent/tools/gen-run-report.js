#!/usr/bin/env node
/* Run-report generator. Renders report.md + report.html for a run folder.
     node gen-run-report.js <runFolder>

   Everything here is DERIVED, never asserted: the AC-to-test-to-result-to-bug
   traceability matrix, the tallies, the coverage figures and the validation
   summary are all recomputed from the run's JSON, so the report cannot
   disagree with the data it describes.

   This exists because these two files used to be hand-authored by the
   orchestrator while every other report was generated — and the traceability
   matrix is precisely the content where prose written beside data drifts from
   it. Two details the hand-written version kept getting wrong, now computed:

     - Coverage is not satisfaction. An AC whose linked case FAILED is covered
       but unsatisfied; it counts toward the percentage yet cannot clear a GO.
       Both numbers are derived separately here.
     - Validation files are overwritten per iteration, so a stage that was
       rejected and then fixed leaves only its passing record. The Outcome
       column restores that history from each file's `iteration` value, rather
       than reporting every stage as clean. */
const fs = require('fs');
const path = require('path');
const UI = require('./report-ui.js');   // sibling — works from the repo and from ~/.claude alike

const RUN = process.argv[2];

// Fail with a sentence, not a stack trace — see the note in gen-bug-report.js.
const die = (m) => { console.error(m); process.exit(1); };
if (!RUN) die('usage: node gen-run-report.js <runFolder>');
if (!fs.existsSync(RUN)) die(`gen-run-report: run folder not found: ${path.resolve(RUN)}`);

const rd = (f) => {
  const p = path.join(RUN, f);
  if (!fs.existsSync(p)) die(`gen-run-report: ${f} not found in run folder ${path.resolve(RUN)}`);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { die(`gen-run-report: ${f} is not valid JSON (${e.message})`); }
};
const rdOpt = (f) => {
  const p = path.join(RUN, f);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

const ctx = rd('run-context.json');
const story = rd('story.json');
const tcDoc = rd('test-cases.json');
const results = rd('results.json');
const gap = rdOpt('gap-report.json');
const review = rd('review.json');
const proposed = rdOpt('bugs-proposed.json');
const created = rdOpt('bugs-created.json');
const verif = rdOpt('verification.json');
const aio = rdOpt('aio-sync.json');
// Optional, written by the orchestrator on a --rerun: { prior: { "<caseId>": "<status>" } }.
// It exists so the before/after comparison survives regeneration — a table hand-patched
// into the HTML would be silently dropped the next time this tool runs.
const rerun = rdOpt('rerun-status.json');

const cases = tcDoc.testCases || tcDoc.cases || [];
const res = results.results || results.cases || [];
const acs = story.acceptanceCriteria || [];
const drafts = (proposed && proposed.drafts) || [];
const madeBugs = (created && created.created) || [];

/* ---------- redaction: maskPatterns are Go-flavoured, JS has no inline (?i) ---------- */
const masks = ((ctx.config.safety || {}).maskPatterns || []).map((p) => {
  let flags = 'g';
  let src = p;
  if (src.startsWith('(?i)')) { src = src.slice(4); flags += 'i'; }
  try { return new RegExp(src, flags); } catch { return null; }
}).filter(Boolean);
const mask = (s) => masks.reduce((acc, re) => acc.replace(re, '***'), String(s == null ? '' : s));

/* ---------- derive ---------- */
const statusOf = {};
res.forEach((c) => { statusOf[c.id] = c.status; });
const shotsOf = {};
res.forEach((c) => { shotsOf[c.id] = c.screenshots || []; });

const casesForAC = {};
acs.forEach((a) => { casesForAC[a.id] = []; });
cases.forEach((c) => [].concat(c.linkedAC || []).forEach((a) => {
  if (!casesForAC[a]) casesForAC[a] = [];
  casesForAC[a].push(c.id);
}));

// a draft covers an AC if any of its testIds is linked to that AC
const bugsForAC = {};
acs.forEach((a) => {
  const ids = casesForAC[a.id] || [];
  bugsForAC[a.id] = drafts
    .filter((d) => ([].concat(d.testIds || [])).some((t) => ids.includes(t)))
    .map((d) => d.ref);
});

const tally = res.reduce((t, c) => { t[c.status] = (t[c.status] || 0) + 1; return t; }, {});
const passed = tally.passed || 0, failed = tally.failed || 0,
      flaky = tally.flaky || 0, blocked = tally.blocked || 0;

const satisfied = (acId) => (casesForAC[acId] || []).some((id) => statusOf[id] === 'passed');
const unsatisfied = acs.filter((a) => (casesForAC[a.id] || []).length && !satisfied(a.id)).map((a) => a.id);
const uncovered = acs.filter((a) => !(casesForAC[a.id] || []).length).map((a) => a.id);

/* validation summary — iteration N means N fix-retries before it passed */
const vDir = path.join(RUN, 'validation');
const vFiles = fs.existsSync(vDir) ? fs.readdirSync(vDir).filter((f) => f.endsWith('.json')) : [];
const vRows = vFiles.map((f) => {
  const v = JSON.parse(fs.readFileSync(path.join(vDir, f), 'utf8'));
  const stage = f.replace(/\.json$/, '');
  const iter = v.iteration === undefined ? 0 : v.iteration;
  return { stage, pass: v.pass, gaps: (v.gaps || []).length, retries: iter,
           outcome: iter === 0 ? 'clean on first pass' : `passed after ${iter} fix-retry${iter > 1 ? 'ies' : ''}` };
});
const EXPECTED_STAGES = ['story', 'test-writer', 'gap-analyzer', 'test-executor',
                         'bug-logger-propose', 'bug-logger-create', 'reviewer'];
const notRun = EXPECTED_STAGES.filter((s) => !vRows.some((r) => r.stage === s));

const vf = {};
if (verif) (verif.verifications || []).forEach((v) => { vf[v.ref] = v.status; });

/* ---------- markdown ---------- */
const MD = [];
MD.push(`# QA AZM Digital Agent — Run Report · ${ctx.key}`);
MD.push('');
MD.push(`**${mask(story.summary || '')}**`);
MD.push('');
MD.push(`Story \`${ctx.key}\` was tested against \`${ctx.appBaseUrl}\` on ${ctx.timestamp} in \`${ctx.mode}\` mode. ` +
  `${acs.length} atomic acceptance criteria produced ${cases.length} test cases, executed in a real browser: ` +
  `**${passed} passed, ${failed} failed, ${flaky} flaky, ${blocked} blocked**. ` +
  `${drafts.length} defect${drafts.length === 1 ? '' : 's'} were drafted and ${madeBugs.length} filed to Jira. ` +
  `Verdict: **${review.verdict}**.`);
MD.push('');
MD.push(`## Verdict — ${review.verdict}`);
MD.push('');
MD.push(mask(review.rationale || '(no rationale recorded)'));
MD.push('');
MD.push('## Tallies');
MD.push('');
MD.push('| Metric | Value |');
MD.push('|---|---|');
MD.push(`| Total tests | ${cases.length} |`);
MD.push(`| Passed | ${passed} |`);
MD.push(`| Failed | ${failed} |`);
MD.push(`| Flaky | ${flaky} |`);
MD.push(`| Blocked | ${blocked} |`);
MD.push(`| AC coverage | ${review.acCoveragePct}% (${acs.length - uncovered.length}/${acs.length}) |`);
MD.push(`| AC covered but **unsatisfied** | ${unsatisfied.length ? unsatisfied.join(', ') : 'none'} |`);
MD.push(`| AC uncovered | ${uncovered.length ? uncovered.join(', ') : 'none'} |`);
MD.push(`| Bugs proposed / created | ${drafts.length} / ${madeBugs.length} |`);
MD.push('');
MD.push('> **Coverage is not satisfaction.** A criterion with a linked case that *failed* is covered but unsatisfied — it counts toward the coverage percentage yet cannot clear a GO.');
MD.push('');
MD.push('## Traceability matrix');
MD.push('');
MD.push('| AC | Criterion | Test cases | Results | Defects | Satisfied |');
MD.push('|---|---|---|---|---|---|');
acs.forEach((a) => {
  const ids = casesForAC[a.id] || [];
  const rs = ids.map((id) => `${id}:${statusOf[id] || '—'}`).join(', ');
  const bg = bugsForAC[a.id] || [];
  const sat = !ids.length ? '**UNCOVERED**' : (satisfied(a.id) ? 'yes' : '**NO**');
  MD.push(`| ${a.id} | ${mask((a.text || '').replace(/\|/g, '\\|')).slice(0, 110)} | ${ids.join(', ') || '—'} | ${rs || '—'} | ${bg.join(', ') || '—'} | ${sat} |`);
});
MD.push('');
MD.push('## Defects');
MD.push('');
if (!drafts.length) {
  MD.push('No defects were drafted — a clean run.');
} else {
  MD.push('| Ref | Severity | Title | Linked AC | Jira | Live re-verification |');
  MD.push('|---|---|---|---|---|---|');
  drafts.forEach((d) => {
    const j = madeBugs.find((b) => b.ref === d.ref);
    MD.push(`| ${d.ref} | ${d.severity || '—'} | ${mask((d.title || '').replace(/\|/g, '\\|')).slice(0, 90)} | ${([].concat(d.linkedAC || [])).join(', ') || '_none — incidental_' } | ${j ? `[${j.key}](${j.url})` : '**not filed**'} | ${vf[d.ref] || '—'} |`);
  });
  MD.push('');
  if (!madeBugs.length) {
    MD.push(`> **${madeBugs.length} of ${drafts.length} filed to Jira.** ${mask((created && created._validation && created._validation.notes) || '')}`);
  }
}
MD.push('');
MD.push('## Validation summary');
MD.push('');
MD.push('| Stage | Result | Gaps | Outcome |');
MD.push('|---|---|---|---|');
vRows.forEach((r) => MD.push(`| ${r.stage} | ${r.pass ? 'pass' : 'FAIL'} | ${r.gaps} | ${r.outcome} |`));
notRun.forEach((s) => MD.push(`| ${s} | _not run_ | — | ${s === 'bug-logger-create' ? 'no bugs approved for creation, so no subject to validate' : 'stage did not run'} |`));
MD.push('');
MD.push('> Validation files are overwritten per iteration, so a stage rejected then fixed leaves only its passing record. The **Outcome** column above restores that history from each file\'s `iteration` value.');
MD.push('');
if (rerun && rerun.prior) {
  const ids = Object.keys(rerun.prior).filter((id) => statusOf[id] !== undefined);
  MD.push('## Re-run comparison');
  MD.push('');
  MD.push('| Case | Before | After | Change |');
  MD.push('|---|---|---|---|');
  ids.forEach((id) => {
    const was = rerun.prior[id], now = statusOf[id];
    // A previously-blocked case that now passes is NEWLY COVERED, not fixed — it was
    // never evidence of a defect, so calling it "fixed" would imply a repair that
    // never happened.
    const change = was === now ? 'unchanged'
      : now === 'passed' && was === 'blocked' ? '**newly covered**'
      : now === 'passed' ? '**fixed**'
      : was === 'passed' ? '**regressed**' : 'changed';
    MD.push(`| ${id} | ${was} | ${now} | ${change} |`);
  });
  MD.push('');
  MD.push('> A previously `blocked` case that now passes is **newly covered** — the criterion behind it was untested, not broken. That is a different claim from a previously `failed` case that now passes, which is **fixed**.');
  MD.push('');
}
MD.push('## Evidence');
MD.push('');
MD.push(`${res.reduce((n, c) => n + (c.screenshots || []).length, 0)} screenshots captured under \`screenshots/\`, full-page PNG at 1920×1080.`);
MD.push('');
MD.push('| Case | Status | Screenshots |');
MD.push('|---|---|---|');
res.forEach((c) => {
  const s = (c.screenshots || []).map((f) => `\`screenshots/${f}\``).join(', ');
  MD.push(`| ${c.id} | ${c.status} | ${s || '—'} |`);
});
if (aio) {
  MD.push('');
  MD.push('## AIO Tests sync');
  MD.push('');
  MD.push(`${aio.createdCount}/${aio.total} cases created in AIO project \`${aio.project}\`, folder \`${aio.folderName}\` (id ${aio.folderID}), script type ${aio.scriptTypeID} — ${aio.scriptTypeSource}. **AIO has no DELETE endpoint; these cases are permanent.**`);
}
MD.push('');
MD.push('---');
MD.push('');
MD.push('**QA AZM Digital Agent** — Developed by **Usama Arshad Jadoon** · QC Lead · **AZM Digital**');
MD.push('');

fs.writeFileSync(path.join(RUN, 'report.md'), MD.join('\n'));

/* ---------- html ---------- */
const e = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const em = (s) => e(mask(s));
const chip = (st) => {
  const k = { passed: 'ok', failed: 'bad', flaky: 'warn', blocked: 'warn' }[st] || 'mut';
  return `<span class="pill ${k}">${e(st)}</span>`;
};

const matrixRows = acs.map((a) => {
  const ids = casesForAC[a.id] || [];
  const bg = bugsForAC[a.id] || [];
  const sat = !ids.length ? '<b class="bad">UNCOVERED</b>' : (satisfied(a.id) ? '<b class="ok">yes</b>' : '<b class="bad">NO</b>');
  return `<tr>
    <td class="mono">${e(a.id)}</td>
    <td>${em(a.text || '')}</td>
    <td class="mono">${ids.map((i) => `${e(i)} ${chip(statusOf[i] || '—')}`).join('<br>') || '—'}</td>
    <td class="mono">${bg.map(e).join(', ') || '—'}</td>
    <td>${sat}</td>
  </tr>`;
}).join('');

const defectRows = drafts.map((d) => {
  const j = madeBugs.find((b) => b.ref === d.ref);
  const lac = ([].concat(d.linkedAC || []));
  return `<tr>
    <td class="mono">${e(d.ref)}</td>
    <td><span class="pill ${String(d.severity).toLowerCase() === 'low' ? 'mut' : 'bad'}">${e(d.severity)}</span></td>
    <td>${em(d.title || '')}</td>
    <td class="mono">${lac.length ? lac.map(e).join(', ') : '<i class="mut-t">none — incidental</i>'}</td>
    <td>${j ? `<a href="${e(j.url)}">${e(j.key)}</a>` : '<b class="warn-t">not filed</b>'}</td>
    <td>${vf[d.ref] ? `<span class="pill ${vf[d.ref] === 'reproduced' ? 'ok' : 'warn'}">${e(vf[d.ref])}</span>` : '—'}</td>
  </tr>`;
}).join('');

const valRows = vRows.map((r) => `<tr><td class="mono">${e(r.stage)}</td>
  <td><span class="pill ${r.pass ? 'ok' : 'bad'}">${r.pass ? 'pass' : 'FAIL'}</span></td>
  <td>${r.gaps}</td><td>${e(r.outcome)}</td></tr>`).join('') +
  notRun.map((s) => `<tr><td class="mono">${e(s)}</td><td><span class="pill mut">not run</span></td><td>—</td>
  <td>${s === 'bug-logger-create' ? 'no bugs approved for creation, so no subject to validate' : 'stage did not run'}</td></tr>`).join('');

const rerunHtml = (() => {
  if (!rerun || !rerun.prior) return '';
  const ids = Object.keys(rerun.prior).filter((id) => statusOf[id] !== undefined);
  if (!ids.length) return '';
  const rows = ids.map((id) => {
    const was = rerun.prior[id], now = statusOf[id];
    const change = was === now ? '<span class="mut-t">unchanged</span>'
      : now === 'passed' && was === 'blocked' ? '<b class="ok">newly covered</b>'
      : now === 'passed' ? '<b class="ok">fixed</b>'
      : was === 'passed' ? '<b class="bad">regressed</b>' : 'changed';
    return `<tr><td class="mono">${e(id)}</td><td>${chip(was)}</td><td>${chip(now)}</td><td>${change}</td></tr>`;
  }).join('');
  return `<h2>Re-run comparison</h2>
<div class="scroll"><table>
<thead><tr><th>Case</th><th>Before</th><th>After</th><th>Change</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<div class="note">A previously <b>blocked</b> case that now passes is <b>newly covered</b> — the criterion behind it was
untested, not broken. That is a different claim from a previously <b>failed</b> case that now passes, which is <b>fixed</b>.
Letting the first read as the second implies a repair that never happened.</div>`;
})();

const evidenceRows = res.map((c) => `<tr><td class="mono">${e(c.id)}</td><td>${chip(c.status)}</td>
  <td class="mono sm">${(c.screenshots || []).map(e).join('<br>') || '—'}</td></tr>`).join('');

const html = `<meta charset="utf-8">
<title>${e(ctx.key)} — QA Run Report</title>
<style>
${UI.CSS}
.pill{display:inline-block;font-size:.72rem;font-weight:700;padding:2px 9px;border-radius:999px;letter-spacing:.02em}
.pill.ok{background:#e6f6ed;color:#116b3a}.pill.bad{background:#fdeaec;color:#a3202f}
.pill.warn{background:#fdf3e3;color:#8a5a12}.pill.mut{background:#eef2f6;color:#5b6a7d}
b.ok{color:#1f9d57}b.bad{color:#c02a3c}.warn-t{color:#8a5a12}.mut-t{color:#7d8a99}
td.sm{font-size:.78rem;line-height:1.5}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:.9rem}
th,td{text-align:left;padding:9px 11px;border-bottom:1px solid var(--hair,#dde5ec);vertical-align:top}
th{font-size:.7rem;text-transform:uppercase;letter-spacing:.09em;color:#61748a}
.wrapper{max-width:1100px;margin:0 auto;padding:0 22px}
.verdict{display:inline-block;border:2px solid #c02a3c;color:#c02a3c;border-radius:12px;padding:10px 20px;font-size:1.5rem;font-weight:800}
.verdict.go{border-color:#1f9d57;color:#1f9d57}
.note{border-left:4px solid #3b6fd4;background:#f2f6fd;padding:12px 16px;border-radius:0 10px 10px 0;margin:16px 0}
.scroll{overflow-x:auto}
</style>
<div class="wrapper">
<header>
  <p class="mono" style="letter-spacing:.18em;text-transform:uppercase;font-size:.72rem;color:#0e7c86"><b>QA AZM Digital Agent</b> &middot; Run report</p>
  <h1>${e(ctx.key)} — ${em(story.summary || '')}</h1>
  <p><span class="verdict${review.verdict === 'GO' ? ' go' : ''}">${e(review.verdict)}</span></p>
  <p>Story <span class="mono">${e(ctx.key)}</span> was tested against <span class="mono">${e(ctx.appBaseUrl)}</span>
     on ${e(ctx.timestamp)} in <span class="mono">${e(ctx.mode)}</span> mode.
     ${acs.length} atomic acceptance criteria produced ${cases.length} test cases, executed in a real browser:
     <b>${passed} passed, ${failed} failed, ${flaky} flaky, ${blocked} blocked</b>.
     ${drafts.length} defect${drafts.length === 1 ? '' : 's'} drafted, <b>${madeBugs.length}</b> filed to Jira.</p>
</header>

<h2>Verdict rationale</h2>
<p>${em(review.rationale || '')}</p>

<h2>Tallies</h2>
<div class="scroll"><table><tbody>
<tr><th>Total tests</th><td>${cases.length}</td></tr>
<tr><th>Passed</th><td>${passed}</td></tr>
<tr><th>Failed</th><td>${failed}</td></tr>
<tr><th>Flaky</th><td>${flaky}</td></tr>
<tr><th>Blocked</th><td>${blocked}</td></tr>
<tr><th>AC coverage</th><td>${review.acCoveragePct}% (${acs.length - uncovered.length}/${acs.length})</td></tr>
<tr><th>Covered but unsatisfied</th><td>${unsatisfied.length ? `<b class="bad">${unsatisfied.map(e).join(', ')}</b>` : 'none'}</td></tr>
<tr><th>Uncovered</th><td>${uncovered.length ? `<b class="bad">${uncovered.map(e).join(', ')}</b>` : 'none'}</td></tr>
<tr><th>Bugs proposed / created</th><td>${drafts.length} / ${madeBugs.length}</td></tr>
</tbody></table></div>
<div class="note"><b>Coverage is not satisfaction.</b> A criterion whose linked case <i>failed</i> is covered but unsatisfied — it counts toward the percentage yet cannot clear a GO. That distinction is the whole basis of this verdict.</div>

<h2>Traceability matrix</h2>
<p>One row per acceptance criterion: the cases that exercise it, what each returned, and any defect raised against it.</p>
<div class="scroll"><table>
<thead><tr><th>AC</th><th>Criterion</th><th>Cases &amp; results</th><th>Defects</th><th>Satisfied</th></tr></thead>
<tbody>${matrixRows}</tbody></table></div>

<h2>Defects</h2>
<div class="scroll"><table>
<thead><tr><th>Ref</th><th>Severity</th><th>Title</th><th>Linked AC</th><th>Jira</th><th>Live re-verification</th></tr></thead>
<tbody>${defectRows || '<tr><td colspan="6">No defects drafted.</td></tr>'}</tbody></table></div>
${!madeBugs.length && drafts.length ? `<div class="note"><b>${madeBugs.length} of ${drafts.length} filed to Jira.</b> ${em((created && created._validation && created._validation.notes) || '')}</div>` : ''}

<h2>Validation summary</h2>
<div class="scroll"><table>
<thead><tr><th>Stage</th><th>Result</th><th>Gaps</th><th>Outcome</th></tr></thead>
<tbody>${valRows}</tbody></table></div>
<div class="note">Validation files are overwritten per iteration, so a stage rejected and then fixed leaves behind only its passing record. The <b>Outcome</b> column restores that history from each file's <span class="mono">iteration</span> value.</div>

${rerunHtml}
<h2>Evidence</h2>
<p>${res.reduce((n, c) => n + (c.screenshots || []).length, 0)} screenshots under <span class="mono">screenshots/</span>, full-page PNG at 1920&times;1080.</p>
<div class="scroll"><table>
<thead><tr><th>Case</th><th>Status</th><th>Screenshots</th></tr></thead>
<tbody>${evidenceRows}</tbody></table></div>

${aio ? `<h2>AIO Tests sync</h2><p><b>${aio.createdCount}/${aio.total}</b> cases created in AIO project
<span class="mono">${e(aio.project)}</span>, folder <span class="mono">${e(aio.folderName)}</span> (id ${e(aio.folderID)}),
script type ${e(aio.scriptTypeID)} — ${e(aio.scriptTypeSource)}.
<b>AIO exposes no DELETE endpoint for test cases; these are permanent.</b></p>` : ''}

<footer style="margin:40px 0 60px;padding-top:18px;border-top:1px solid #dde5ec;font-size:.86rem;color:#61748a">
  <b>QA AZM Digital Agent</b> — Developed by <b>Usama Arshad Jadoon</b> &middot; QC Lead &middot; <b>AZM Digital</b>
  <span style="float:right" class="mono">${e(ctx.key)} &middot; run ${e(ctx.timestamp)}</span>
</footer>
</div>`;

fs.writeFileSync(path.join(RUN, 'report.html'), html);
console.log(`report.md + report.html written`);
console.log(`  AC rows: ${acs.length} · defects: ${drafts.length} · validation rows: ${vRows.length} (+${notRun.length} not run)`);
console.log(`  unsatisfied: ${unsatisfied.join(', ') || 'none'} · uncovered: ${uncovered.join(', ') || 'none'}`);
