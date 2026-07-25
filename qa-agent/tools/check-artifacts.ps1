# QA AZM Digital Agent — artifact lint helper.
#
# Verifies a generated or authored file has the structure it should: a real YAML
# frontmatter block with the required keys, and any required substrings.
#
# Developed by Usama Arshad Jadoon · QC Lead · AZM Digital.
param(
  [Parameter(Mandatory=$true)][string]$File,
  [string[]]$Requires = @(),
  [switch]$Frontmatter
)
$ErrorActionPreference = "Stop"
$fail = @()
if (-not (Test-Path $File)) { Write-Host "MISSING FILE: $File"; exit 1 }
# -Raw returns $null for an empty file; normalize so -match/-notmatch behave predictably.
$content = Get-Content -Raw -Path $File
if ($null -eq $content) { $content = "" }

if ($Frontmatter) {
  # Capture the frontmatter BODY (between the opening and closing ---) and check the
  # required keys inside it only. Searching the whole file would let a document that
  # merely mentions "tools:" in prose satisfy a frontmatter check it actually fails.
  $fmMatch = [regex]::Match($content, "(?s)\A---\s*\r?\n(?<body>.*?)\r?\n---\s*(\r?\n|\z)")
  if (-not $fmMatch.Success) {
    $fail += "no valid --- frontmatter block at the top of the file"
  } else {
    $body = $fmMatch.Groups["body"].Value
    foreach ($k in @("name", "description", "tools")) {
      # A key must start a line inside the frontmatter body — not appear mid-sentence.
      # Build the pattern by concatenation: interpolating a variable immediately before a
      # ':' inside a double-quoted string parses as a scope qualifier (like $env:PATH).
      $pattern = '(?m)^\s*' + [regex]::Escape($k) + '\s*:'
      if ($body -notmatch $pattern) {
        $fail += ("frontmatter missing key '" + $k + ":'")
      }
    }
  }
}
# Invoked as `powershell -File check-artifacts.ps1 -Requires a,b`, PowerShell hands the
# value over as the single literal string "a,b" rather than two elements. Split on commas
# so the -File and in-process (`-Requires @("a","b")`) call styles behave identically.
$needles = @($Requires | Where-Object { $null -ne $_ } | ForEach-Object { $_ -split ',' } |
  ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
foreach ($r in $needles) {
  if ($content -notmatch [regex]::Escape($r)) { $fail += "missing required content: '$r'" }
}
if ($fail.Count -gt 0) {
  Write-Host "CHECK FAILED for $File"
  $fail | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
Write-Host "CHECK PASSED for $File"
exit 0
