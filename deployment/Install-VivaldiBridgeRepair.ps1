param(
    [switch]$SkipScheduledTask
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path $PSScriptRoot -Parent
$BridgeRepoSource = Join-Path $RepoRoot "vivaldi-bridge\dtc-vivaldi-workspace-bridge.js"
$RepairRepoSource = Join-Path $PSScriptRoot "Repair-VivaldiBridge.ps1"
$ProductRoot = Join-Path $env:LOCALAPPDATA "DTC-Vivaldi-Workspace"
$BridgeDir = Join-Path $ProductRoot "bridge"
$ToolsDir = Join-Path $ProductRoot "tools"
$BridgeInstalled = Join-Path $BridgeDir "dtc-vivaldi-workspace-bridge.js"
$RepairInstalled = Join-Path $ToolsDir "Repair-VivaldiBridge.ps1"
$TaskName = "DTC Vivaldi Workspace Bridge Repair"

function Ensure-Directory([string]$Path) {
    if (!(Test-Path $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

if (!(Test-Path $BridgeRepoSource)) { throw "Bridge source not found: $BridgeRepoSource" }
if (!(Test-Path $RepairRepoSource)) { throw "Repair helper not found: $RepairRepoSource" }

Ensure-Directory $BridgeDir
Ensure-Directory $ToolsDir
Ensure-Directory (Join-Path $ProductRoot "logs")

Copy-Item $BridgeRepoSource $BridgeInstalled -Force
Copy-Item $RepairRepoSource $RepairInstalled -Force

Write-Host "Installed persistent Bridge source to:"
Write-Host "  $BridgeInstalled"
Write-Host "Installed repair helper to:"
Write-Host "  $RepairInstalled"

# Perform an immediate repair before registering automation.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RepairInstalled
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Initial Bridge repair returned exit code $LASTEXITCODE. The scheduled repair can retry later."
}

if (!$SkipScheduledTask) {
    $escapedRepair = '"' + $RepairInstalled + '"'
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $escapedRepair -Quiet"

    $logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $periodicTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) \
        -RepetitionInterval (New-TimeSpan -Minutes 15) \
        -RepetitionDuration (New-TimeSpan -Days 3650)

    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries \
        -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

    $task = New-ScheduledTask -Action $action -Trigger @($logonTrigger, $periodicTrigger) -Principal $principal -Settings $settings \
        -Description "Repairs the read-only Duplicate Tabs Closer Vivaldi Workspace Bridge after Vivaldi updates."

    Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
    Write-Host "Scheduled task installed: $TaskName"
    Write-Host "It checks at logon and every 15 minutes. If Vivaldi has not changed, it makes no changes."
}

Write-Host ""
Write-Host "Bridge persistence installation complete."
Write-Host "The source-of-truth copy is outside Vivaldi's versioned Application folders, so Vivaldi updates cannot overwrite it."
Write-Host "If a future Vivaldi internal API change breaks Workspace support, the extension will still fail closed and show its diagnostic warning."
