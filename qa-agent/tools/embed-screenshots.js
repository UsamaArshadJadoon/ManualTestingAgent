#!/usr/bin/env node
/**
 * embed-screenshots.js — QA AZM Digital Agent
 *
 * Replaces every {{IMG:<name>}} placeholder in an HTML file with a base64
 * `data:image/png;base64,...` URI of the matching PNG, so the published page
 * carries its evidence inline. The Artifact CSP blocks external and local file
 * refs, so a screenshot referenced by path simply does not render — embedding is
 * the only way evidence survives publishing.
 *
 * Usage:
 *   node embed-screenshots.js <html-file> [--dir <screenshots-dir>] [--min-width N]
 *
 *   <html-file>      HTML containing {{IMG:<name>}} placeholders. Rewritten in place.
 *   --dir            Where to resolve <name> from. Default: <html-dir>/screenshots
 *   --min-width      Fail if any PNG is narrower than N px (HD-evidence guard).
 *                    Default 1280. Pass 0 to disable the check.
 *
 * Exits non-zero — loudly, never silently — when a placeholder has no matching
 * file, when any placeholder survives substitution, or when an image is below
 * the HD floor. A bug report with broken or thumbnail evidence is worse than an
 * obvious hard failure, so this never "mostly works".
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");

function fail(msg) {
  console.error("embed-screenshots: " + msg);
  process.exit(1);
}

// ---- args -----------------------------------------------------------------

const argv = process.argv.slice(2);
if (!argv.length || argv.includes("-h") || argv.includes("--help")) {
  console.log(
    "usage: node embed-screenshots.js <html-file> [--dir <screenshots-dir>] [--min-width N]"
  );
  process.exit(argv.length ? 0 : 1);
}

const htmlPath = argv[0];
let shotDir = null;
let minWidth = 1280;

for (let i = 1; i < argv.length; i++) {
  if (argv[i] === "--dir") {
    shotDir = argv[++i];
    if (!shotDir) fail("--dir needs a value");
  } else if (argv[i] === "--min-width") {
    const raw = argv[++i];
    if (raw === undefined) fail("--min-width needs a value");
    minWidth = Number(raw);
    if (!Number.isFinite(minWidth) || minWidth < 0) fail("--min-width must be a non-negative number");
  } else {
    fail("unknown argument: " + argv[i]);
  }
}

if (!fs.existsSync(htmlPath)) fail("html file not found: " + htmlPath);
if (!shotDir) shotDir = path.join(path.dirname(path.resolve(htmlPath)), "screenshots");

// ---- PNG dimensions (IHDR is always the first chunk) ----------------------

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(buf, name) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
    fail(name + " is not a valid PNG (bad magic bytes) — evidence must be PNG");
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ---- substitute -----------------------------------------------------------

let html = fs.readFileSync(htmlPath, "utf8");

const placeholders = [...html.matchAll(/\{\{IMG:([^}]+)\}\}/g)].map((m) => m[1].trim());
const names = [...new Set(placeholders)];

if (!names.length) {
  fail(
    "no {{IMG:<name>}} placeholders found in " +
      htmlPath +
      " — author the page with placeholders, then run this tool"
  );
}

const embedded = [];
let payloadBytes = 0;
const tooSmall = [];

for (const name of names) {
  // A placeholder name is a FILENAME inside the screenshots directory, never a path.
  // Without this, `{{IMG:../../../.qa-secrets}}` resolves outside shotDir and this tool
  // would base64-embed that file into a page that then gets published — turning an
  // evidence embedder into an exfiltration primitive. gen-bug-report.js already emits
  // path.basename(), so nothing legitimate is rejected here; the guard exists because
  // this is also a standalone CLI that will run against any HTML it is pointed at.
  if (name !== path.basename(name) || name.includes("..") || path.isAbsolute(name)) {
    fail(
      "unsafe screenshot name: " + JSON.stringify(name) +
        "\n  a {{IMG:<name>}} placeholder must be a bare filename inside the screenshots" +
        "\n  directory — no path separators, no '..', no absolute path."
    );
  }
  const file = path.join(shotDir, name);
  if (!fs.existsSync(file)) {
    fail(
      "screenshot not found: " +
        file +
        "\n  placeholder {{IMG:" +
        name +
        "}} has no matching file. Check the name against the case's screenshots array in results.json."
    );
  }

  const buf = fs.readFileSync(file);
  const { width, height } = pngSize(buf, name);
  if (minWidth > 0 && width < minWidth) tooSmall.push(name + " (" + width + "x" + height + ")");

  const uri = "data:image/png;base64," + buf.toString("base64");
  payloadBytes += uri.length;
  html = html.split("{{IMG:" + name + "}}").join(uri);

  embedded.push({ name, width, height, kb: Math.round(buf.length / 1024) });
}

if (tooSmall.length) {
  fail(
    "these screenshots are below the HD floor of " +
      minWidth +
      "px wide: " +
      tooSmall.join(", ") +
      "\n  Re-capture at a full-HD viewport (resize to 1920x1080 before screenshotting), or pass --min-width 0 to override."
  );
}

// ---- verify nothing was left behind ---------------------------------------

if (/\{\{IMG:/.test(html)) {
  const left = [...html.matchAll(/\{\{IMG:([^}]*)\}\}/g)].map((m) => m[1]);
  fail("unreplaced placeholders remain: " + left.join(", "));
}

const pathRefs = (html.match(/<img[^>]+src="(?!data:)/g) || []).length;
if (pathRefs) {
  fail(
    pathRefs +
      " <img> tag(s) still reference a non-data: src. Every screenshot must be embedded — a file path will not render in a published Artifact."
  );
}

fs.writeFileSync(htmlPath, html);

// ---- report ---------------------------------------------------------------

const finalKb = Math.round(fs.statSync(htmlPath).size / 1024);
console.log("embedded " + embedded.length + " screenshot(s) into " + htmlPath);
for (const e of embedded) {
  console.log("  " + e.name + " — " + e.width + "x" + e.height + ", " + e.kb + " KB");
}
console.log("base64 payload: " + Math.round(payloadBytes / 1024) + " KB");
console.log("final page size: " + finalKb + " KB");
if (finalKb > 9000) {
  console.log(
    "note: page is large (" +
      finalKb +
      " KB). It will still publish, but consider trimming to the most probative screenshots per bug."
  );
}
