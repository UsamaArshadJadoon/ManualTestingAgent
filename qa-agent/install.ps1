$ErrorActionPreference = "Stop"
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $HOME ".claude"
New-Item -ItemType Directory -Force -Path (Join-Path $dest "agents") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dest "commands") | Out-Null
Copy-Item -Force (Join-Path $src "agents\*.md") (Join-Path $dest "agents")
Copy-Item -Force (Join-Path $src "commands\*.md") (Join-Path $dest "commands")
Write-Host "Installed QA AZM Digital Agent to $dest"
Write-Host "  by Usama Arshad Jadoon (QC Lead, AZM Digital)"
Get-ChildItem (Join-Path $dest "agents") -Filter "qa-*.md" | ForEach-Object { Write-Host "  agent:   $($_.Name)" }
Get-ChildItem (Join-Path $dest "commands") -Filter "qa-*.md" | ForEach-Object { Write-Host "  command: $($_.Name)" }
