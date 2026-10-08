<#
  Ulfa: run backend + frontend behind Cloudflare quick tunnels (phone testing).

    .\tunnel.cmd          start tunnels + backend + frontend, print the phone URL
    .\tunnel.cmd url      print the current links again
    .\tunnel.cmd stop     stop everything and point the frontend back to localhost

  Backend and frontend each open in their own window so you can watch the logs.
  Quick tunnel URLs change on every start, so just run it again when you need it.
#>
param([ValidateSet('start', 'stop', 'url')][string]$Action = 'start')

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$State = Join-Path $env:TEMP 'ulfa-tunnel'
$PidFile = Join-Path $State 'pids.txt'
$EnvLocal = Join-Path $Root 'Ulfa-F\.env.development.local'
$BackPort = 3000
$FrontPort = 5175

function Show-Links([string]$Front, [string]$Back) {
  try { Set-Clipboard $Front } catch {}
  Write-Host ''
  Write-Host "  Open on your phone:  $Front" -ForegroundColor Green
  Write-Host "  Backend API:         $Back/api/v1"
  Write-Host '  (phone URL copied to clipboard)'
  Write-Host ''
  Write-Host '  Show links again:      .\tunnel.cmd url'
  Write-Host '  Stop everything with:  .\tunnel.cmd stop'
}

# Double-clicked from Explorer: keep the window open so the links stay visible.
function Wait-IfDoubleClicked {
  try {
    $cmd = Get-CimInstance Win32_Process -Filter "ProcessId=$((Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId)"
    $parent = Get-Process -Id $cmd.ParentProcessId -ErrorAction Stop
    if ($parent.ProcessName -eq 'explorer') { Read-Host '  Press Enter to close this window (servers keep running)' | Out-Null }
  } catch {}
}

function Read-Link([string]$Name) {
  $text = try { Get-Content (Join-Path $State "$Name.log") -Raw -ErrorAction Stop } catch { '' }
  if ($text -match 'https://[a-z0-9-]+\.trycloudflare\.com') { return $Matches[0] }
}

function Kill-Tree([int]$Id) {
  cmd /c "taskkill /T /F /PID $Id >nul 2>&1" | Out-Null
}

function Stop-All {
  if (Test-Path $PidFile) {
    Get-Content $PidFile | Where-Object { $_ } | ForEach-Object { Kill-Tree $_ }
    Remove-Item $PidFile -Force
  }
  # Anything else still holding the ports (e.g. a backend started by hand).
  foreach ($port in $BackPort, $FrontPort) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { Kill-Tree $_.OwningProcess }
  }
  if (Test-Path $EnvLocal) { Remove-Item $EnvLocal -Force }
}

function Start-Tunnel([int]$Port, [string]$Name) {
  $log = Join-Path $State "$Name.log"
  Remove-Item $log, "$log.out" -ErrorAction SilentlyContinue
  $p = Start-Process cloudflared -WindowStyle Hidden -PassThru `
    -ArgumentList 'tunnel', '--url', "http://localhost:$Port", '--no-autoupdate' `
    -RedirectStandardError $log -RedirectStandardOutput "$log.out"
  Add-Content $PidFile $p.Id
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    $text = try { Get-Content $log -Raw -ErrorAction Stop } catch { '' }
    if ($text -match 'https://[a-z0-9-]+\.trycloudflare\.com') { return $Matches[0] }
  }
  throw "Tunnel for port $Port did not come up. See $log"
}

function Start-Window([string]$Title, [string]$Dir, [string]$Command) {
  $script = "`$host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$Dir'; $Command"
  $p = Start-Process powershell -PassThru -ArgumentList '-NoExit', '-NoProfile', '-Command', $script
  Add-Content $PidFile $p.Id
}

function Wait-Port([int]$Port, [string]$Name) {
  for ($i = 0; $i -lt 120; $i++) {
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { return }
    Start-Sleep -Seconds 1
  }
  Write-Warning "$Name is not listening on $Port yet - check its window."
}

New-Item -ItemType Directory -Force $State | Out-Null
if ($Action -eq 'url') {
  $front = Read-Link 'frontend'; $back = Read-Link 'backend'
  if ($front -and (Get-NetTCPConnection -LocalPort $FrontPort -State Listen -ErrorAction SilentlyContinue)) {
    Show-Links $front $back
    Wait-IfDoubleClicked
  } else {
    Write-Host 'Nothing is running. Start it with:  .\tunnel.cmd' -ForegroundColor Yellow
  }
  return
}
Write-Host 'Stopping anything left from before...'
Stop-All
if ($Action -eq 'stop') {
  Write-Host 'Stopped. Frontend points to localhost again.' -ForegroundColor Green
  return
}

Write-Host 'Opening Cloudflare tunnels...'
$back = Start-Tunnel $BackPort 'backend'
$front = Start-Tunnel $FrontPort 'frontend'

# Frontend talks to the backend tunnel (Vite reads .env.development.local over .env).
Set-Content -Path $EnvLocal -Encoding ASCII -Value @(
  '# TEMP: written by dev-tunnel.ps1 for phone testing. "tunnel.cmd stop" removes it.'
  "VITE_API_BASE_URL=$back/api/v1"
)

# Backend builds signed media URLs and setup/view links from these.
Start-Window 'Ulfa backend' (Join-Path $Root 'Ulfa-B') (
  "`$env:PUBLIC_API_URL = '$back/api/v1'; " +
  "`$env:NFC_SETUP_BASE_URL = '$front/setup'; " +
  "`$env:NFC_VIEW_BASE_URL = '$front/nfc'; " +
  'npm run start:dev')
Start-Window 'Ulfa frontend' (Join-Path $Root 'Ulfa-F') "npm run dev -- --port $FrontPort --strictPort"

Write-Host 'Waiting for backend and frontend to start...'
Wait-Port $FrontPort 'Frontend'
Wait-Port $BackPort 'Backend'

Show-Links $front $back
Wait-IfDoubleClicked
