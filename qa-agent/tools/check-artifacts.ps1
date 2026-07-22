param(
  [Parameter(Mandatory=$true)][string]$File,
  [string[]]$Requires = @(),
  [switch]$Frontmatter
)
$ErrorActionPreference = "Stop"
$fail = @()
if (-not (Test-Path $File)) { Write-Host "MISSING FILE: $File"; exit 1 }
$content = Get-Content -Raw -Path $File

if ($Frontmatter) {
  if ($content -notmatch "(?s)^---\s*\r?\n.*?\r?\n---") { $fail += "no valid --- frontmatter block" }
  foreach ($k in @("name:", "description:", "tools:")) {
    if ($content -notmatch [regex]::Escape($k)) { $fail += "frontmatter missing key '$k'" }
  }
}
foreach ($r in $Requires) {
  if ($content -notmatch [regex]::Escape($r)) { $fail += "missing required content: '$r'" }
}
if ($fail.Count -gt 0) {
  Write-Host "CHECK FAILED for $File"
  $fail | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
Write-Host "CHECK PASSED for $File"
exit 0
