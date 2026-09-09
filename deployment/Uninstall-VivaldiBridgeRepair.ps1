$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (!(Test-IsAdministrator)) {
    $process = Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $PSCommandPath)) -Wait -PassThru
    exit $process.ExitCode
}

$TaskName = "DTC Vivaldi Workspace Bridge Repair"
$ProductRoot = Join-Path $env:LOCALAPPDATA "DTC-Vivaldi-Workspace"
$InjectionLine = '<script src="dtc-mods/dtc-vivaldi-workspace-bridge.js"></script>'

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$roots = @(
    (Join-Path $env:LOCALAPPDATA "Vivaldi\Application"),
    (Join-Path $env:ProgramFiles "Vivaldi\Application")
)
if (${env:ProgramFiles(x86)}) {
    $roots += (Join-Path ${env:ProgramFiles(x86)} "Vivaldi\Application")
}

foreach ($root in ($roots | Sort-Object -Unique)) {
    if (!(Test-Path $root)) { continue }
    Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } |
        ForEach-Object {
            $vivaldiResources = Join-Path $_.FullName "resources\vivaldi"
            $windowHtml = Join-Path $vivaldiResources "window.html"
            if (Test-Path $windowHtml) {
                $html = Get-Content $windowHtml -Raw
                if ($html -match [regex]::Escape($InjectionLine)) {
                    $html = $html.Replace("    $InjectionLine`r`n", "").Replace("$InjectionLine`r`n", "").Replace($InjectionLine, "")
                    [System.IO.File]::WriteAllText($windowHtml, $html, [System.Text.UTF8Encoding]::new($false))
                }
            }
            $modsDir = Join-Path $vivaldiResources "dtc-mods"
            $bridge = Join-Path $modsDir "dtc-vivaldi-workspace-bridge.js"
            if (Test-Path $bridge) { Remove-Item $bridge -Force }
            if ((Test-Path $modsDir) -and -not (Get-ChildItem $modsDir -Force -ErrorAction SilentlyContinue)) {
                Remove-Item $modsDir -Force
            }
        }
}

if (Test-Path $ProductRoot) { Remove-Item $ProductRoot -Recurse -Force }

Write-Host "DTC Vivaldi Workspace Bridge repair automation removed."
Write-Host "Any window.html.dtc-backup files were intentionally preserved for manual recovery."
