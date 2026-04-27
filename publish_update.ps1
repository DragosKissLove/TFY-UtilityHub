# TFY Utility Hub - Automated Update & Deploy Script
# This script builds the UI, C# App, Packs with Velopack, and Deploys to Firebase Hosting.

$ErrorActionPreference = "Stop"

# 1. Configuration
$ProjectDir = $PSScriptRoot
Set-Location $ProjectDir
$UiDir = Join-Path $ProjectDir "project"
$DistDir = Join-Path $UiDir "dist"
$ReleasesDir = Join-Path $ProjectDir "Releases"
$Csproj = Join-Path $ProjectDir "TFY.csproj"

try {
    Write-Host "[1/5] Building React UI..." -ForegroundColor Cyan
    Push-Location $UiDir
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "NPM build failed. Make sure you are in the correct folder." }
    Pop-Location

    Write-Host "[2/5] Publishing .NET Application..." -ForegroundColor Cyan
    dotnet publish $Csproj -c Release -r win-x64 --self-contained true -o "$ProjectDir\publish"
    if ($LASTEXITCODE -ne 0) { throw "Dotnet publish failed. Check for build errors in Visual Studio." }

    Write-Host "[3/5] Syncing UI to Publish folder..." -ForegroundColor Cyan
    if (Test-Path "$ProjectDir\publish\project\dist") { Remove-Item -Recurse -Force "$ProjectDir\publish\project\dist" }
    New-Item -ItemType Directory -Path "$ProjectDir\publish\project\dist" -Force | Out-Null
    xcopy "$DistDir\*" "$ProjectDir\publish\project\dist\" /E /Y /Q /I

    Write-Host "[4/5] Packing Release with Velopack..." -ForegroundColor Cyan
    # Check if vpk is installed
    if (!(Get-Command vpk -ErrorAction SilentlyContinue)) {
        Write-Host "VPK tool not found! Installing..." -ForegroundColor Yellow
        dotnet tool install -g vpk
    }
    
    $Version = (Select-String -Path $Csproj -Pattern "<Version>(.*)</Version>").Matches.Groups[1].Value
    Write-Host "Packing version $Version ..." -ForegroundColor Gray
    vpk pack -u TFY -v $Version -p "$ProjectDir\publish" -e TFY.exe -i "$ProjectDir\installer\icon.ico" -y
    if ($LASTEXITCODE -ne 0) { throw "Velopack pack failed." }

    # Rename the setup for a more professional look
    Write-Host "Polishing installer name..." -ForegroundColor Gray
    Move-Item "$ReleasesDir\TFY-win-Setup.exe" "$ReleasesDir\TFY-UtilityHub-Setup.exe" -Force

    Write-Host "[5/5] Deploying UI to Firebase Hosting..." -ForegroundColor Cyan
    # Prepare Releases folder in dist (BUT exclude .exe to avoid Firebase Spark errors)
    if (Test-Path "$DistDir\Releases") { Remove-Item -Recurse -Force "$DistDir\Releases" }
    New-Item -ItemType Directory -Path "$DistDir\Releases" -Force | Out-Null
    
    # Copy RELEASES, .nupkg, and .json but NOT .exe
    xcopy "$ReleasesDir\RELEASES" "$DistDir\Releases\" /Y /Q /I
    xcopy "$ReleasesDir\*.nupkg" "$DistDir\Releases\" /Y /Q /I
    xcopy "$ReleasesDir\*.json" "$DistDir\Releases\" /Y /Q /I

    Push-Location $UiDir
    npx cross-env firebase deploy --only hosting
    if ($LASTEXITCODE -ne 0) { throw "Firebase deployment failed." }
    Pop-Location

    Write-Host "[6/6] Publishing Update to GitHub Releases..." -ForegroundColor Cyan
    $Version = (Select-String -Path $Csproj -Pattern "<Version>(.*)</Version>").Matches.Groups[1].Value
    
    # Check if release exists
    Write-Host "Checking GitHub for v$Version..." -ForegroundColor Gray
    $releaseList = gh release list --repo "DragosKissLove/TFY-UtilityHub-Releases"
    if ($releaseList -match "v$Version") {
        Write-Host "Replacing existing GitHub release v$Version..." -ForegroundColor Yellow
        gh release delete "v$Version" --yes --cleanup-tag --repo "DragosKissLove/TFY-UtilityHub-Releases"
    }

    Write-Host "Creating clean GitHub Release v$Version..." -ForegroundColor Gray
    gh release create "v$Version" --title "v$Version" --notes "Automated build/update" --repo "DragosKissLove/TFY-UtilityHub-Releases"
    if ($LASTEXITCODE -ne 0) { throw "GitHub Release creation failed." }

    Write-Host "Uploading all release assets to GitHub..." -ForegroundColor Gray
    # Upload RELEASES file
    gh release upload "v$Version" "$ReleasesDir\RELEASES" --clobber --repo "DragosKissLove/TFY-UtilityHub-Releases"
    # Upload each nupkg individually (glob patterns don't expand in gh on Windows)
    Get-ChildItem "$ReleasesDir\*.nupkg" | ForEach-Object {
        gh release upload "v$Version" $_.FullName --clobber --repo "DragosKissLove/TFY-UtilityHub-Releases"
        Write-Host "  Uploaded: $($_.Name)" -ForegroundColor Gray
    }
    # Upload the installer exe
    gh release upload "v$Version" "$ReleasesDir\TFY-UtilityHub-Setup.exe" --clobber --repo "DragosKissLove/TFY-UtilityHub-Releases"
    Write-Host "  Uploaded: TFY-UtilityHub-Setup.exe" -ForegroundColor Gray

    # Copy installer to Desktop
    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    Copy-Item "$ReleasesDir\TFY-UtilityHub-Setup.exe" -Destination "$DesktopPath\TFY-Setup-v$Version.exe" -Force
    Write-Host "Installer copied to Desktop: TFY-Setup-v$Version.exe" -ForegroundColor Green

    Write-Host "`n[SUCCESS] UI deployed to Firebase & Updates live on GitHub!" -ForegroundColor Green
    Write-Host "Current Version: $Version" -ForegroundColor Gray
    Write-Host "Update URL (Firebase): https://tfy-project.web.app/Releases" -ForegroundColor Gray
}
catch {
    Write-Host "`n[ERROR] $($_.Exception.Message)" -ForegroundColor Red
}
