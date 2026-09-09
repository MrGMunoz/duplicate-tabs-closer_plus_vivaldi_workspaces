param(
    [string]$StoreExtensionId = "",
    [string]$StoreUrl = ""
)

$ErrorActionPreference = "Stop"
$BridgeInstaller = Join-Path $PSScriptRoot "Install-VivaldiBridgeRepair.ps1"

if (!(Test-Path $BridgeInstaller)) { throw "Bridge installer not found: $BridgeInstaller" }
if ($StoreExtensionId -and $StoreExtensionId -notmatch '^[a-p]{32}$') {
    throw "StoreExtensionId must be a 32-character Chromium extension ID (letters a-p only)."
}
if ($StoreUrl -and $StoreUrl -notmatch '^https://chromewebstore\.google\.com/') {
    throw "StoreUrl must be a Chrome Web Store URL."
}

$args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $BridgeInstaller))
if ($StoreExtensionId) { $args += @("-StoreExtensionId", $StoreExtensionId) }
$process = Start-Process -FilePath "powershell.exe" -ArgumentList $args -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Bridge persistence installer failed with exit code $($process.ExitCode)." }

Write-Host ""
Write-Host "Local Vivaldi Workspace Bridge persistence is installed."

if ($StoreUrl) {
    Write-Host "Opening the Unlisted Chrome Web Store item in Vivaldi/default browser..."
    Start-Process $StoreUrl
    Write-Host "Use the normal 'Add to Vivaldi' / 'Add to Chrome' button on that page."
} else {
    Write-Host "No StoreUrl was supplied. The local Bridge is ready, but normal extension installation"
    Write-Host "must wait until the Unlisted Chrome Web Store item has been created and approved."
    Write-Host "Build the upload ZIP with:"
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\build\build.ps1 -Target vivaldi-store"
}

Write-Host ""
Write-Host "Do not remove the existing unpacked fork until the Web Store installation has been verified."
