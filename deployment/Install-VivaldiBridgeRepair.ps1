param(
    [string]$StoreExtensionId = "",
    [switch]$SkipScheduledTask
)

$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (!(Test-IsAdministrator)) {
    $args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $PSCommandPath))
    if ($StoreExtensionId) { $args += @("-StoreExtensionId", $StoreExtensionId) }
    if ($SkipScheduledTask) { $args += "-SkipScheduledTask" }
    $process = Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $args -Wait -PassThru
    exit $process.ExitCode
}

$RepoRoot = Split-Path $PSScriptRoot -Parent
$BridgeRepoSource = Join-Path $RepoRoot "vivaldi-bridge\dtc-vivaldi-workspace-bridge.js"
$RepairRepoSource = Join-Path $PSScriptRoot "Repair-VivaldiBridge.ps1"
$HiddenLauncherRepoSource = Join-Path $PSScriptRoot "Run-VivaldiBridgeRepairHidden.vbs"
$ProductRoot = Join-Path $env:LOCALAPPDATA "DTC-Vivaldi-Workspace"
$BridgeDir = Join-Path $ProductRoot "bridge"
$ToolsDir = Join-Path $ProductRoot "tools"
$ConfigFile = Join-Path $ProductRoot "config.json"
$BridgeInstalled = Join-Path $BridgeDir "dtc-vivaldi-workspace-bridge.js"
$RepairInstalled = Join-Path $ToolsDir "Repair-VivaldiBridge.ps1"
$HiddenLauncherInstalled = Join-Path $ToolsDir "Run-VivaldiBridgeRepairHidden.vbs"
$TaskName = "DTC Vivaldi Workspace Bridge Repair"
$StoreIdPlaceholder = "__DTC_STORE_EXTENSION_ID__"

function Ensure-Directory([string]$Path) {
    if (!(Test-Path $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

if (!(Test-Path $BridgeRepoSource)) { throw "Bridge source not found: $BridgeRepoSource" }
if (!(Test-Path $RepairRepoSource)) { throw "Repair helper not found: $RepairRepoSource" }
if (!(Test-Path $HiddenLauncherRepoSource)) { throw "Hidden repair launcher not found: $HiddenLauncherRepoSource" }

Ensure-Directory $BridgeDir
Ensure-Directory $ToolsDir
Ensure-Directory (Join-Path $ProductRoot "logs")

if (!$StoreExtensionId -and (Test-Path $ConfigFile)) {
    try {
        $saved = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        if ($saved.StoreExtensionId -match '^[a-p]{32}$') { $StoreExtensionId = $saved.StoreExtensionId }
    } catch {}
}
if ($StoreExtensionId -and $StoreExtensionId -notmatch '^[a-p]{32}$') {
    throw "StoreExtensionId must be a 32-character Chromium extension ID (letters a-p only)."
}
if ($StoreExtensionId) {
    @{ StoreExtensionId = $StoreExtensionId } | ConvertTo-Json | Set-Content $ConfigFile -Encoding UTF8
}

$bridgeText = Get-Content $BridgeRepoSource -Raw
if ($StoreExtensionId) { $bridgeText = $bridgeText.Replace($StoreIdPlaceholder, $StoreExtensionId) }
[System.IO.File]::WriteAllText($BridgeInstalled, $bridgeText, [System.Text.UTF8Encoding]::new($false))
Copy-Item $RepairRepoSource $RepairInstalled -Force
Copy-Item $HiddenLauncherRepoSource $HiddenLauncherInstalled -Force

Write-Host "Installed persistent Bridge source to:"
Write-Host "  $BridgeInstalled"
if ($StoreExtensionId) { Write-Host "Authorized Chrome Web Store extension ID: $StoreExtensionId" }
else { Write-Host "No Chrome Web Store ID supplied; only the stable development ID is authorized." }
Write-Host "Installed repair helper to:"
Write-Host "  $RepairInstalled"
Write-Host "Installed hidden repair launcher to:"
Write-Host "  $HiddenLauncherInstalled"

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RepairInstalled
if ($LASTEXITCODE -ne 0) { Write-Warning "Initial Bridge repair returned exit code $LASTEXITCODE. The scheduled repair can retry later." }

if (!$SkipScheduledTask) {
    # Use wscript.exe rather than powershell.exe as the scheduled-task process.
    # powershell.exe can briefly create a console window before -WindowStyle Hidden
    # takes effect; wscript.exe has no console, so periodic checks remain invisible.
    $escapedLauncher = '"' + $HiddenLauncherInstalled + '"'
    $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "//B //Nologo $escapedLauncher"
    $logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $periodicTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
    $task = New-ScheduledTask -Action $action -Trigger @($logonTrigger, $periodicTrigger) -Principal $principal -Settings $settings -Description "Silently repairs the read-only Duplicate Tabs Closer Vivaldi Workspace Bridge after Vivaldi updates."
    Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
    Write-Host "Scheduled task installed: $TaskName"
    Write-Host "It checks invisibly at logon and once per hour. If Vivaldi has not changed, it makes no changes."
}

Write-Host ""
Write-Host "Bridge persistence installation complete."
Write-Host "The source-of-truth copy is outside Vivaldi's versioned Application folders, so Vivaldi updates cannot overwrite it."
Write-Host "If a future Vivaldi internal API change breaks Workspace support, the extension will still fail closed and show its diagnostic warning."
