param(
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$ProductRoot = Join-Path $env:LOCALAPPDATA "DTC-Vivaldi-Workspace"
$BridgeSource = Join-Path $ProductRoot "bridge\dtc-vivaldi-workspace-bridge.js"
$LogDir = Join-Path $ProductRoot "logs"
$LogFile = Join-Path $LogDir "bridge-repair.log"
$InjectionLine = '<script src="dtc-mods/dtc-vivaldi-workspace-bridge.js"></script>'

function Write-RepairLog {
    param([string]$Message)
    if (!(Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    if (!$Quiet) { Write-Host $Message }
}

function Get-VivaldiApplicationRoots {
    $candidates = New-Object System.Collections.Generic.List[string]

    $known = @(
        (Join-Path $env:LOCALAPPDATA "Vivaldi\Application"),
        (Join-Path $env:ProgramFiles "Vivaldi\Application")
    )
    if (${env:ProgramFiles(x86)}) {
        $known += (Join-Path ${env:ProgramFiles(x86)} "Vivaldi\Application")
    }

    foreach ($path in $known) {
        if ($path -and (Test-Path $path)) { $candidates.Add($path) }
    }

    $uninstallRoots = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    )
    foreach ($root in $uninstallRoots) {
        if (!(Test-Path $root)) { continue }
        Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
            $item = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
            if ($item.DisplayName -like "Vivaldi*") {
                $location = $item.InstallLocation
                if ($location) {
                    $app = Join-Path $location "Application"
                    if (Test-Path $app) { $candidates.Add($app) }
                }
            }
        }
    }

    return $candidates | Sort-Object -Unique
}

function Test-VersionDirectoryName {
    param([string]$Name)
    return $Name -match '^\d+\.\d+\.\d+\.\d+$'
}

function Repair-OneVivaldiVersion {
    param([string]$VersionDirectory)

    $vivaldiResources = Join-Path $VersionDirectory "resources\vivaldi"
    $windowHtml = Join-Path $vivaldiResources "window.html"
    if (!(Test-Path $windowHtml)) { return $false }

    $modsDir = Join-Path $vivaldiResources "dtc-mods"
    $bridgeTarget = Join-Path $modsDir "dtc-vivaldi-workspace-bridge.js"
    if (!(Test-Path $modsDir)) { New-Item -ItemType Directory -Path $modsDir -Force | Out-Null }

    $sourceHash = (Get-FileHash -Path $BridgeSource -Algorithm SHA256).Hash
    $copyNeeded = $true
    if (Test-Path $bridgeTarget) {
        try {
            $targetHash = (Get-FileHash -Path $bridgeTarget -Algorithm SHA256).Hash
            $copyNeeded = $targetHash -ne $sourceHash
        } catch { $copyNeeded = $true }
    }
    if ($copyNeeded) {
        Copy-Item $BridgeSource $bridgeTarget -Force
        Write-RepairLog "Bridge copied to $bridgeTarget"
    }

    $html = Get-Content $windowHtml -Raw
    if ($html -notmatch [regex]::Escape($InjectionLine)) {
        $backup = "$windowHtml.dtc-backup"
        if (!(Test-Path $backup)) {
            Copy-Item $windowHtml $backup -Force
            Write-RepairLog "Created backup $backup"
        }

        $closingBody = $html.LastIndexOf("</body>", [System.StringComparison]::OrdinalIgnoreCase)
        if ($closingBody -lt 0) {
            Write-RepairLog "WARNING: </body> not found in $windowHtml; no injection performed"
            return $false
        }

        $newHtml = $html.Insert($closingBody, "    $InjectionLine`r`n")
        [System.IO.File]::WriteAllText($windowHtml, $newHtml, [System.Text.UTF8Encoding]::new($false))
        Write-RepairLog "Bridge injection restored in $windowHtml"
    }

    return $true
}

try {
    if (!(Test-Path $BridgeSource)) {
        Write-RepairLog "ERROR: master Bridge copy not found at $BridgeSource"
        exit 2
    }

    $roots = @(Get-VivaldiApplicationRoots)
    if ($roots.Count -eq 0) {
        Write-RepairLog "Vivaldi installation not found."
        exit 3
    }

    $repaired = 0
    foreach ($root in $roots) {
        Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
            Where-Object { Test-VersionDirectoryName $_.Name } |
            ForEach-Object {
                try {
                    if (Repair-OneVivaldiVersion $_.FullName) { $repaired++ }
                } catch {
                    Write-RepairLog "WARNING: could not repair $($_.FullName): $($_.Exception.Message)"
                }
            }
    }

    if ($repaired -eq 0) {
        Write-RepairLog "No repairable Vivaldi version directory was found."
        exit 4
    }

    Write-RepairLog "Bridge health check complete. Verified $repaired Vivaldi version installation(s)."
    exit 0
} catch {
    Write-RepairLog "ERROR: $($_.Exception.Message)"
    exit 1
}
