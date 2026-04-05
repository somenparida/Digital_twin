# After `docker compose up -d`, checks API directly and through the frontend proxy.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Test-Url([string]$Url, [string]$Label) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
        if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode)" }
        $j = $r.Content | ConvertFrom-Json
        if (-not $j.temperature) { throw "Missing temperature in JSON" }
        Write-Host "OK $Label"
    } catch {
        Write-Error "FAIL $Label : $_"
        exit 1
    }
}

Test-Url "http://127.0.0.1:8000/data" "backend /data"
Test-Url "http://127.0.0.1:3000/api/data" "frontend nginx /api/data -> backend"

Write-Host "All integration checks passed."
