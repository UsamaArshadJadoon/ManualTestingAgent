$ErrorActionPreference = "Stop"
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $HOME ".claude"
New-Item -ItemType Directory -Force -Path (Join-Path $dest "agents") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dest "commands") | Out-Null
# Helper scripts the agents shell out to (e.g. tools\aio-sync.js). Installed under
# ~\.claude\qa-agent\ so a globally-installed agent can find them from ANY project,
# not just from a checkout of this repo.
New-Item -ItemType Directory -Force -Path (Join-Path $dest "qa-agent\tools") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dest "qa-agent\references") | Out-Null
Copy-Item -Force (Join-Path $src "agents\*.md") (Join-Path $dest "agents")
Copy-Item -Force (Join-Path $src "commands\*.md") (Join-Path $dest "commands")
Copy-Item -Force (Join-Path $src "tools\*") (Join-Path $dest "qa-agent\tools")
if (Test-Path (Join-Path $src "references\*")) {
  Copy-Item -Force (Join-Path $src "references\*") (Join-Path $dest "qa-agent\references")
}
Write-Host "Installed QA AZM Digital Agent to $dest"
Write-Host "  by Usama Arshad Jadoon (QC Lead, AZM Digital)"
Get-ChildItem (Join-Path $dest "agents") -Filter "qa-*.md" | ForEach-Object { Write-Host "  agent:   $($_.Name)" }
Get-ChildItem (Join-Path $dest "commands") -Filter "qa-*.md" | ForEach-Object { Write-Host "  command: $($_.Name)" }
Get-ChildItem (Join-Path $dest "qa-agent\tools") | ForEach-Object { Write-Host "  tool:    $($_.Name)" }

# Orphan check. A `qa-*.md` sitting in ~\.claude\agents that this repo no longer
# ships is almost always a leftover from an older version of the framework — and
# it stays registered as a dispatchable agent, so a stale orchestrator can be
# invoked by mistake and quietly contradict the current pipeline. Report them and
# let the human delete; never remove files from a home directory unasked.
$repoAgents = Get-ChildItem (Join-Path $src "agents") -Filter "qa-*.md" | ForEach-Object { $_.Name }
$orphans = Get-ChildItem (Join-Path $dest "agents") -Filter "qa-*.md" |
  Where-Object { $repoAgents -notcontains $_.Name }
if ($orphans) {
  Write-Host ""
  Write-Host "WARNING: these qa-* agents are installed but are NOT part of this framework:" -ForegroundColor Yellow
  $orphans | ForEach-Object { Write-Host "  orphan:  $($_.Name)" -ForegroundColor Yellow }
  Write-Host "They remain dispatchable and may shadow or contradict the current pipeline." -ForegroundColor Yellow
  Write-Host "Remove any you no longer want, e.g.:" -ForegroundColor Yellow
  $orphans | ForEach-Object { Write-Host "  Remove-Item '$($_.FullName)'" -ForegroundColor Yellow }
}
