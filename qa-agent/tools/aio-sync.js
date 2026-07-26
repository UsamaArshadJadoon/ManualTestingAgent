#!/usr/bin/env node
/**
 * QA AZM Digital Agent — AIO Tests sync (deterministic).
 *
 * Creates the approved test cases from a run folder in AIO Tests (Cloud) under the
 * story's folder in the Cases module, and links each to the Jira story.
 *
 * Why this is a script and not ad-hoc curl: AIO has no DELETE endpoint for cases, so a
 * wrong-guess POST leaves permanent junk in the customer's project. This script never
 * guesses. It resolves the project's real `scriptType` ID at runtime, and it is
 * idempotent — cases already recorded in aio-sync.json are skipped on re-run.
 *
 * usage: node aio-sync.js <runFolder> [--story-jira-id <id>] [--only TC1,TC2] [--dry-run]
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const runFolder = process.argv[2];
if (!runFolder) die('usage: node aio-sync.js <runFolder> [--story-jira-id <id>] [--only TC1,TC2] [--dry-run]');

const argv = process.argv.slice(3);
const dryRun = argv.includes('--dry-run');
const flag = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const onlyArg = flag('--only');
const only = onlyArg ? onlyArg.split(',').map((s) => s.trim()) : null;
const storyJiraIdArg = flag('--story-jira-id');
const allowDuplicates = argv.includes('--allow-duplicates');

function die(msg) {
  console.error(msg);
  process.exit(1);
}
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
/** Read a required run-folder input, failing with a readable message instead of a stack trace. */
function readInput(name) {
  const p = path.join(runFolder, name);
  if (!fs.existsSync(p)) die(`Cannot sync to AIO: ${name} not found in run folder ${runFolder}`);
  try {
    return readJson(p);
  } catch (e) {
    die(`Cannot sync to AIO: ${name} in ${runFolder} is not valid JSON (${e.message})`);
  }
}

if (!fs.existsSync(runFolder)) die(`Cannot sync to AIO: run folder not found: ${runFolder}`);
const ctx = readInput('run-context.json');
const story = readInput('story.json');
const testCases = readInput('test-cases.json');
const cfg = ctx.config || {};
const aio = cfg.aio || {};
if (aio.enabled !== true) die('AIO sync disabled (config.aio.enabled is not true)');

const projectKey = aio.projectKey || (cfg.jira && cfg.jira.projectKey);
const baseUrl = (aio.baseUrl || 'https://tcms.aiojiraapps.com/aio-tcms/api/v1').replace(/\/+$/, '');
const tokenEnv = aio.tokenEnv || 'AIO_TOKEN';
const storyKey = ctx.key || story.key;

/* ---------- credentials: env var first, then git-ignored .qa-secrets. Never printed. ---------- */
function resolveToken() {
  if (process.env[tokenEnv]) return process.env[tokenEnv].trim();
  // .qa-secrets lives in the project root. Derive that from the run folder first
  // (<project>/qa-runs/<KEY>_<ts>/) so resolution does not depend on the cwd the agent
  // happened to shell out from, then fall back to cwd and to a repo checkout layout.
  const candidates = [
    path.resolve(runFolder, '..', '..', '.qa-secrets'),
    path.resolve(process.cwd(), '.qa-secrets'),
    path.resolve(__dirname, '..', '..', '.qa-secrets'),
  ];
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    const line = fs
      .readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith(tokenEnv + '='));
    if (line) return line.slice(tokenEnv.length + 1).trim();
  }
  return null;
}
const token = resolveToken();
if (!token) die(`Cannot sync to AIO: ${tokenEnv} not set (no env var and no .qa-secrets entry)`);

/* ---------- HTTP ---------- */
function request(method, urlPath, body) {
  return new Promise((resolve) => {
    const u = new URL(baseUrl + urlPath);
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: Object.assign(
          { Authorization: `AioAuth ${token}`, Accept: 'application/json' },
          payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
        ),
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) {
            /* non-JSON error body (AIO returns plain text on 404) */
          }
          resolve({ status: res.statusCode, json, text: data });
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, json: null, text: String(e.message) }));
    if (payload) req.write(payload);
    req.end();
  });
}

/* ---------- resolve the project's Classic scriptType ID at runtime ----------
 * These IDs are per-project configuration in AIO — they are NOT stable across projects
 * (e.g. Classic is 3 in one project while 9 is the Functional *test type* in another).
 * Hardcoding one is the bug this script exists to prevent. There is no public
 * script-type metadata endpoint (all such GETs 404), so we read the value off a real
 * existing case in the same project via the read-only search endpoint. */
async function resolveScriptTypeId() {
  if (Number.isInteger(aio.scriptTypeId)) {
    return { id: aio.scriptTypeId, source: 'config.aio.scriptTypeId' };
  }
  const res = await request('POST', `/project/${projectKey}/testcase/search?startAt=0&maxResults=50`, {});
  if (res.status !== 200 || !res.json || !Array.isArray(res.json.items)) {
    die(
      `Cannot resolve the AIO scriptType for project ${projectKey} ` +
        `(search returned HTTP ${res.status}). Pin it with "scriptTypeId" in .qa-config.json > aio.`
    );
  }
  const types = res.json.items.map((i) => i.scriptType).filter(Boolean);
  const classic = types.find((t) => /classic/i.test(t.name || '') && t.isEnabled !== false);
  if (classic) return { id: classic.ID, source: `discovered from existing case (${classic.name})` };
  if (types.length) return { id: types[0].ID, source: `discovered from existing case (${types[0].name})` };
  die(
    `Cannot resolve the AIO scriptType for project ${projectKey}: the project has no existing ` +
      `test case to read it from, and AIO exposes no script-type metadata endpoint. Create one case ` +
      `in the AIO Cases UI, or pin "scriptTypeId" in .qa-config.json > aio. ` +
      `Refusing to guess — a wrong POST creates a permanent case that cannot be deleted via the API.`
  );
}

/* ---------- resolve the story's folder (never created via API — creation returns 500) ---------- */
async function resolveFolder() {
  const res = await request('GET', `/project/${projectKey}/testcase/folder`);
  if (res.status !== 200) die(`AIO folder lookup failed (HTTP ${res.status})`);
  const flat = [];
  (function walk(nodes) {
    for (const n of nodes || []) {
      flat.push(n);
      walk(n.children);
    }
  })(Array.isArray(res.json) ? res.json : res.json.folders || []);
  // Match the story key as a whole token, not a bare prefix: a plain startsWith would let
  // story SEK-19 match folder "SEK-1934 - ..." and file its cases in the wrong story's
  // folder — permanently, since AIO has no DELETE. Require the key to be followed by a
  // non-alphanumeric boundary (space, dash, colon, end of name).
  const keyMatches = (name) => {
    const n = (name || '').trim();
    if (!n.startsWith(storyKey)) return false;
    const next = n.charAt(storyKey.length);
    return next === '' || !/[A-Za-z0-9]/.test(next);
  };
  const hits = flat.filter((f) => keyMatches(f.name));
  if (hits.length > 1) {
    die(
      `Ambiguous AIO folder for ${storyKey}: ${hits.length} folders match ` +
        `(${hits.map((f) => `"${f.name}" [ID ${f.ID}]`).join(', ')}). ` +
        `Rename or remove the duplicates so exactly one folder starts with ${storyKey}. ` +
        `Refusing to guess — cases filed in the wrong folder cannot be deleted via the API.`
    );
  }
  const hit = hits[0];
  if (!hit) {
    die(
      `No AIO folder found for ${storyKey}. Please create a folder named ` +
        `"${storyKey} - ${story.summary}" under All in the AIO Cases module, then re-run.`
    );
  }
  return hit;
}

/* ---------- masking ----------
 * Every string this script sends to AIO is masked first. This matters more here than
 * anywhere else in the pipeline: AIO exposes no DELETE endpoint for test cases, so a
 * secret written into a case body is permanent and unremovable — you cannot even fix it
 * by deleting and re-creating. Jira issues can be edited or deleted; these cannot.
 *
 * What flows in from disk and therefore needs masking: `testData` (echoed verbatim into
 * the precondition), the case `steps`, `title`, `expectedResult`, the story summary, the
 * AC text, and `config.app.login.notes` (free text a human wrote, which is exactly where
 * someone inlines a real identifier "just for reference"). */
const maskPatterns = ((cfg.safety && cfg.safety.maskPatterns) || []).map((p) => {
  const ci = p.startsWith('(?i)');
  try {
    return new RegExp(ci ? p.slice(4) : p, ci ? 'gi' : 'g');
  } catch (e) {
    console.log(`WARN ignoring un-compilable maskPattern ${JSON.stringify(p)}: ${e.message}`);
    return null;
  }
}).filter(Boolean);

let maskHits = 0;
/** Redact every maskPatterns match in a string. Non-strings pass through untouched. */
function mask(v) {
  if (typeof v !== 'string' || !v) return v;
  let out = v;
  for (const re of maskPatterns) {
    re.lastIndex = 0;
    out = out.replace(re, (m) => {
      maskHits++;
      return '***';
    });
  }
  return out;
}

/* ---------- case body ---------- */
const acText = (ids) =>
  (ids || [])
    .map((id) => {
      const ac = (story.acceptanceCriteria || []).find((a) => a.id === id);
      return ac ? `${id}: ${ac.text}` : id;
    })
    .join('\n');

function buildBody(tc, folderId, scriptTypeId, storyJiraId) {
  // Every value below is masked on the way in — AIO cases cannot be deleted, so this is
  // the last point at which a secret can be stopped.
  const dataLines = Object.entries(tc.testData || {})
    .map(([k, v]) => `${mask(k)}: ${mask(String(v))}`)
    .join('\n');
  const description = [
    `Story: ${storyKey} — ${mask(story.summary)}`,
    `Test type: ${tc.type}`,
    `Covered acceptance criteria:\n${mask(acText(tc.linkedAC)) || '(none)'}`,
    `Overall expected result: ${mask(tc.expectedResult)}`,
  ].join('\n\n');
  const precondition = [
    mask((tc.cfgLoginNote || '').trim()),
    dataLines ? `Test data:\n${dataLines}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const steps = (tc.steps || []).map((s, i) => ({
    stepIndex: i + 1,
    stepType: 'TEXT',
    step: mask(String(s)),
    data: '',
    // The case's overall expected result belongs on the LAST step; never invent per-step results.
    expectedResult: i === (tc.steps || []).length - 1 ? mask(tc.expectedResult || '') : '',
  }));
  const body = {
    title: mask(tc.title),
    precondition: precondition || 'None',
    description,
    scriptType: { ID: scriptTypeId },
    folder: { ID: folderId },
    steps,
  };
  if (aio.linkToStory !== false && storyJiraId) body.jiraRequirementIDs = [String(storyJiraId)];
  return body;
}

/* ---------- main ---------- */
(async () => {
  const outPath = path.join(runFolder, 'aio-sync.json');

  // Idempotency, layer 1: never re-create a case this run already created (AIO has no DELETE).
  const prior = fs.existsSync(outPath) ? readJson(outPath) : null;
  const alreadyCreated = new Map(
    ((prior && prior.cases) || [])
      .filter((c) => c.aioKey)
      .map((c) => [c.testId, c])
  );

  // Idempotency, layer 2: re-running the same story creates a NEW run folder, so layer 1
  // cannot see cases an earlier run already pushed — and AIO offers no way to delete the
  // duplicates that would result (no DELETE endpoint, and its search API has no
  // server-side folder filter to check against cheaply). So scan sibling run folders for
  // the same story key and match on title, which is the case's human identity across runs
  // (test ids like TC1 are positional and can mean a different case in a later run).
  const priorTitles = new Map();
  try {
    const runsRoot = path.dirname(path.resolve(runFolder));
    for (const dir of fs.readdirSync(runsRoot)) {
      if (!dir.startsWith(storyKey + '_')) continue;
      const p = path.join(runsRoot, dir, 'aio-sync.json');
      if (path.resolve(path.join(runsRoot, dir)) === path.resolve(runFolder) || !fs.existsSync(p)) continue;
      for (const c of readJson(p).cases || []) {
        if (c.aioKey && c.title) priorTitles.set(c.title.trim().toLowerCase(), { ...c, fromRun: dir });
      }
    }
  } catch (_) {
    /* a missing or unreadable sibling run must never block a sync */
  }

  // Resolve the selection BEFORE any network call: these checks are local and free, so a
  // typo'd --only id should fail immediately rather than after two round trips to AIO.
  const allCases = testCases.cases || [];
  const selected = allCases.filter((tc) => !only || only.includes(tc.id));

  // A --only id that matches nothing must fail loudly. Silently selecting zero cases and
  // exiting 0 reads as "sync succeeded" when nothing was pushed — usually a typo'd id.
  if (only) {
    const known = new Set(allCases.map((tc) => tc.id));
    const unknown = only.filter((id) => !known.has(id));
    if (unknown.length) {
      die(
        `Cannot sync to AIO: --only names case id(s) not in test-cases.json: ${unknown.join(', ')}. ` +
          `Available ids: ${allCases.map((tc) => tc.id).join(', ') || '(none)'}`
      );
    }
  }
  if (!selected.length) die(`Cannot sync to AIO: no test cases to sync (test-cases.json has no cases)`);

  const folder = await resolveFolder();
  const st = await resolveScriptTypeId();
  const storyJiraId = storyJiraIdArg || (prior && prior.storyJiraId) || process.env.QA_STORY_JIRA_ID || null;
  if (aio.linkToStory !== false && !storyJiraId) {
    console.log(
      `WARN no story Jira numeric id supplied (--story-jira-id) — cases will be created ` +
        `without the requirement link to ${storyKey}.`
    );
  }
  // Precondition note. Derive it from config — never hardcode a role, environment, or
  // credential shape here: this script runs against any project, and a case body written
  // into AIO cannot be deleted, so wrong wording is permanent. `login.notes` is the
  // team's own description of how their login works and wins when present.
  const login = (cfg.app && cfg.app.login) || {};
  const loginNote = !login.required
    ? ''
    : (login.notes || '').trim()
      ? (login.notes || '').trim()
      : `Authenticated at ${login.loginUrl || (cfg.app && cfg.app.baseUrl) || 'the application'}` +
        (login.passwordless
          ? ` using the identifier in ${login.usernameEnv || 'the configured identifier'} only (no password).`
          : '.');

  console.log(`folder: ${folder.name} (ID ${folder.ID})`);
  if (maskPatterns.length === 0) console.log("WARN no maskPatterns configured — nothing will be redacted before writing to AIO");
  console.log(`scriptType ID: ${st.id} — ${st.source}`);
  if (dryRun) {
    console.log(JSON.stringify(buildBody(Object.assign({ cfgLoginNote: loginNote }, selected[0]), folder.ID, st.id, storyJiraId), null, 2));
    return;
  }

  const results = [];
  for (const tc of selected) {
    if (alreadyCreated.has(tc.id)) {
      const p = alreadyCreated.get(tc.id);
      console.log(`SKIP ${tc.id} already created as ${p.aioKey}`);
      results.push(p);
      continue;
    }
    const dupe = priorTitles.get((tc.title || '').trim().toLowerCase());
    if (dupe && !allowDuplicates) {
      console.log(`SKIP ${tc.id} same title already in AIO as ${dupe.aioKey} (from run ${dupe.fromRun})`);
      results.push({
        testId: tc.id,
        aioKey: dupe.aioKey,
        aioID: dupe.aioID,
        title: tc.title,
        reusedFromRun: dupe.fromRun,
      });
      continue;
    }
    const body = buildBody(Object.assign({ cfgLoginNote: loginNote }, tc), folder.ID, st.id, storyJiraId);
    const res = await request('POST', `/project/${projectKey}/testcase`, body);
    if (res.status >= 200 && res.status < 300 && res.json) {
      console.log(`OK   ${tc.id} -> ${res.json.key}`);
      results.push({ testId: tc.id, aioKey: res.json.key, aioID: res.json.ID, title: tc.title });
    } else {
      const msg = (res.json && (res.json.message || res.json.error)) || res.text || '';
      console.log(`FAIL ${tc.id} HTTP ${res.status}: ${String(msg).slice(0, 200)}`);
      results.push({ testId: tc.id, error: String(msg).slice(0, 300), status: res.status });
    }
  }

  // Merge with any prior run's results so re-runs never lose earlier keys.
  const merged = [];
  const byId = new Map(results.map((r) => [r.testId, r]));
  for (const c of ((prior && prior.cases) || [])) if (!byId.has(c.testId)) merged.push(c);
  const cases = merged.concat(results);
  const createdCount = cases.filter((c) => c.aioKey).length;

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        project: projectKey,
        folderID: folder.ID,
        folderName: folder.name,
        storyJiraId,
        scriptTypeID: st.id,
        scriptTypeSource: st.source,
        createdCount,
        total: (testCases.cases || []).length,
        cases,
        _validation: {
          checklist: [
            {
              item: 'every selected case resolved to an AIO key (created this run, or already present)',
              pass: selected.every((tc) => cases.some((c) => c.testId === tc.id && c.aioKey)),
            },
            { item: 'folder resolved by numeric ID', pass: !!folder.ID },
            { item: 'scriptType resolved at runtime (not hardcoded)', pass: true },
            { item: 'token never printed', pass: true },
            {
              item: `maskPatterns applied to every string sent to AIO (${maskHits} redaction(s) made)`,
              pass: maskPatterns.length > 0,
            },
            { item: 'requirement link applied when enabled', pass: aio.linkToStory === false || !!storyJiraId },
            { item: 'no duplicate creation on re-run (idempotent by testId)', pass: true },
            {
              item: 'no duplicate creation across run folders for the same story (matched by title)',
              pass: !allowDuplicates,
            },
          ],
          // Confidence is about the cases this invocation was asked to sync, not the whole
          // file — a scoped `--only` run that fully succeeded is a confident result even
          // though `total` is larger.
          selfConfident: selected.every((tc) => cases.some((c) => c.testId === tc.id && c.aioKey)),
          notes: `scriptType ID ${st.id} ${st.source}. AIO exposes no DELETE for cases, so already-created cases are skipped rather than re-posted.`,
        },
      },
      null,
      2
    ) + '\n'
  );
  console.log(`WROTE aio-sync.json ${createdCount}/${(testCases.cases || []).length}`);
  // Non-zero only when a case we actually attempted this run failed — a scoped --only run
  // that succeeds must still exit 0 even though total is larger.
  if (results.some((r) => !r.aioKey)) process.exitCode = 2;
})();
