<#
.SYNOPSIS
    TFY Utility Hub - Ultra-Compact Version Backup Utility
.DESCRIPTION
    Creates a lightweight, source-only compressed ZIP backup of the current project version.
    Excludes all heavy binaries, build outputs, package caches, and installer executables.
    A complete project snapshot is preserved with tiny disk usage (~8-10 MB).
#>

[CmdletBinding()]
param(
    [string]$CustomNote = ""
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $root

# 1. Read Version from TFY.csproj
$version = "6.3.2"
try {
    $csprojXml = [xml](Get-Content (Join-Path $root "TFY.csproj") -Raw)
    if ($csprojXml.Project.PropertyGroup.Version) {
        $version = $csprojXml.Project.PropertyGroup.Version
    }
} catch {
    Write-Warning "Could not read version from TFY.csproj, defaulting to $version"
}

# 2. Setup Backups folder
$backupsDir = Join-Path $root "Backups"
if (-not (Test-Path $backupsDir)) {
    New-Item -ItemType Directory -Path $backupsDir -Force | Out-Null
}

$timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$noteSuffix = if ($CustomNote) { "-$CustomNote" } else { "" }
$zipFileName = "TFY-SourceBackup-v$version-$timestamp$noteSuffix.zip"
$zipPath = Join-Path $backupsDir $zipFileName

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " TFY Utility Hub - Ultra-Compact Backup Tool" -ForegroundColor Green
Write-Host " Version: $version" -ForegroundColor White
Write-Host " Output:  $zipFileName" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan

# 3. Create Clean Staging Directory
$stagingDir = Join-Path $env:TEMP "tfy_backup_staging_$timestamp"
if (Test-Path $stagingDir) { Remove-Item -Recurse -Force $stagingDir }
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

$excludePatterns = @(
    '\\node_modules\\',
    '\\bin\\',
    '\\obj\\',
    '\\publish\\',
    '\\publish_installer\\',
    '\\installer\\publish\\',
    '\\installer\\{userdesktop}\\',
    '\\dist\\',
    '\\.git\\',
    '\\.vs\\',
    '\\.firebase\\',
    '\\Releases\\',
    '\\Backups\\',
    '\\scratch\\',
    '\\scratch_[^\\]*\\',
    '\\extracted_[^\\]*\\',
    '\\TFY-UtilityHub\\',
    '\.exe$',
    '\.nupkg$',
    '\.zip$',
    '\.suo$',
    '\.user$',
    '\.log$',
    '\.tmp$',
    'authentic_main_ui\.png$',
    'restored_settings.*\.png$'
)

# 4. Copy Eligible Source Files
$allFiles = Get-ChildItem -Path $root -Recurse -File
$copiedCount = 0
$totalSourceBytes = 0

foreach ($f in $allFiles) {
    $rel = $f.FullName.Substring($root.Length)
    
    $skip = $false
    foreach ($pattern in $excludePatterns) {
        if ($rel -match $pattern) {
            $skip = $true
            break
        }
    }
    
    if (-not $skip) {
        $targetFile = Join-Path $stagingDir ($rel.TrimStart('\/'))
        $targetParent = [System.IO.Path]::GetDirectoryName($targetFile)
        if (-not (Test-Path $targetParent)) {
            New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
        }
        Copy-Item -Path $f.FullName -Destination $targetFile -Force
        $copiedCount++
        $totalSourceBytes += $f.Length
    }
}

# 5. Compress Staging Directory to Zip
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

# 6. Cleanup Staging
Remove-Item -Recurse -Force $stagingDir

# 7. Results
$zipSize = (Get-Item $zipPath).Length
$zipSizeMb = [math]::Round($zipSize / 1MB, 2)
$sourceMb = [math]::Round($totalSourceBytes / 1MB, 2)

Write-Host ""
Write-Host " [SUCCESS] Ultra-Compact Backup Complete!" -ForegroundColor Green
Write-Host " --------------------------------------------" -ForegroundColor DarkGray
Write-Host " Saved File:   Backups\$zipFileName" -ForegroundColor White
Write-Host " Backup Size:  $zipSizeMb MB" -ForegroundColor Yellow
Write-Host " File Count:   $copiedCount files ($sourceMb MB uncompressed)" -ForegroundColor Gray
Write-Host " Disk Savings: ~99.5% compared to full build folders!" -ForegroundColor Cyan
Write-Host " ============================================" -ForegroundColor Cyan
