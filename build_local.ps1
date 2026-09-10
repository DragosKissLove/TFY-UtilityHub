# TFY Utility Hub - Local Installer Build Script
# Builds the UI, compiles the C# app, packages it with Velopack, and copies the installer directly to the Desktop.

$ErrorActionPreference = "Stop"

$ProjectDir = $PSScriptRoot
Set-Location $ProjectDir
$UiDir = Join-Path $ProjectDir "project"
$DistDir = Join-Path $UiDir "dist"
$ReleasesDir = Join-Path $ProjectDir "Releases"
$Csproj = Join-Path $ProjectDir "TFY.csproj"

try {
    # 1. Build React UI
    Write-Host "[1/5] Building React UI..." -ForegroundColor Cyan
    Push-Location $UiDir
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "NPM build failed." }
    Pop-Location

    # 2. Publish C# WPF App
    Write-Host "[2/5] Publishing .NET Application & SteamWorker..." -ForegroundColor Cyan
    dotnet publish $Csproj -c Release -r win-x64 --self-contained true -o "$ProjectDir\publish"
    if ($LASTEXITCODE -ne 0) { throw "Dotnet publish failed." }
    dotnet publish "$ProjectDir\SteamWorker\SteamWorker.csproj" -c Release -r win-x64 --self-contained true -o "$ProjectDir\publish"
    if ($LASTEXITCODE -ne 0) { throw "SteamWorker publish failed." }

    # 3. Sync UI dist to Publish folder
    Write-Host "[3/5] Syncing UI to Publish folder..." -ForegroundColor Cyan
    if (Test-Path "$ProjectDir\publish\project\dist") { Remove-Item -Recurse -Force "$ProjectDir\publish\project\dist" }
    New-Item -ItemType Directory -Path "$ProjectDir\publish\project\dist" -Force | Out-Null
    xcopy "$DistDir\*" "$ProjectDir\publish\project\dist\" /E /Y /Q /I

    # 4. Create embedded zip resources for custom installer
    Write-Host "[4/6] Creating embedded resources for custom installer..." -ForegroundColor Cyan
    
    $InstallerDir = Join-Path $ProjectDir "TFY.Installer"
    $DistZip = Join-Path $InstallerDir "dist.zip"
    $PublishZip = Join-Path $InstallerDir "publish.zip"
    
    if (Test-Path $DistZip) { Remove-Item -Force $DistZip }
    $tempStaging = Join-Path $env:TEMP "tfy_dist_staging"
    if (Test-Path $tempStaging) { Remove-Item -Recurse -Force $tempStaging }
    New-Item -ItemType Directory -Force $tempStaging | Out-Null
    Copy-Item (Join-Path $DistDir "index.html") $tempStaging
    Copy-Item (Join-Path $DistDir "installer.html") $tempStaging -ErrorAction SilentlyContinue
    Copy-Item -Recurse (Join-Path $DistDir "assets") (Join-Path $tempStaging "assets")
    Compress-Archive -Path (Join-Path $tempStaging "*") -DestinationPath $DistZip -Force
    Remove-Item -Recurse -Force $tempStaging

    if (Test-Path $PublishZip) { Remove-Item -Force $PublishZip }
    Compress-Archive -Path (Join-Path $ProjectDir "publish\*") -DestinationPath $PublishZip -Force

    # 5. Build custom installer
    Write-Host "[5/6] Building custom TFY Installer..." -ForegroundColor Cyan
    $PublishInstallerDir = Join-Path $ProjectDir "publish_installer"
    if (Test-Path $PublishInstallerDir) { Remove-Item -Recurse -Force $PublishInstallerDir }
    
    dotnet publish (Join-Path $InstallerDir "TFY.Installer.csproj") -c Release -r win-x64 --self-contained true -o $PublishInstallerDir -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:PublishReadyToRun=true
    if ($LASTEXITCODE -ne 0) { throw "TFY.Installer build failed." }

    # 6. Copy to Desktop
    Write-Host "[6/6] Copying custom installer to Desktop..." -ForegroundColor Cyan
    $Version = (Select-String -Path $Csproj -Pattern "<Version>(.*)</Version>").Matches.Groups[1].Value
    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    
    # Close running setup if any to prevent file lock
    Get-Process | Where-Object { $_.Name -like "*TFY-Setup*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    
    Copy-Item (Join-Path $PublishInstallerDir "TFY.Installer.exe") -Destination "$DesktopPath\TFY-Setup-v$Version-New.exe" -Force
    
    Write-Host "`n================================================" -ForegroundColor Green
    Write-Host " SUCCESS! Custom Installer built locally." -ForegroundColor Green
    Write-Host " Installer copied to Desktop:" -ForegroundColor Gray
    Write-Host " $DesktopPath\TFY-Setup-v$Version-New.exe" -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Green
}
catch {
    Write-Host "`n[ERROR] $($_.Exception.Message)" -ForegroundColor Red
}
