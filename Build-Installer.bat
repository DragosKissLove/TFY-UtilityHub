@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  TFY Utility Hub - Build ^& Deploy Script
echo ============================================

set CHANNEL=stable
set /p CHANNEL_CHOICE="Deploy as [S]table or [B]eta update channel? (S/B, default is S): "
if /i "%CHANNEL_CHOICE%"=="B" (
    set CHANNEL=beta
    echo Selected update channel: BETA
) else (
    echo Selected update channel: STABLE
)

REM ── 1. Build React UI ────────────────────────
echo [1/9] Building React UI...
pushd project
call npm run build
if errorlevel 1 ( echo [ERROR] npm build failed. & exit /b 1 )
popd

REM ── 2. Publish .NET app ─────────────────────
echo [2/9] Publishing .NET Application ^& SteamWorker...
if exist obj rmdir /s /q obj
if exist bin rmdir /s /q bin
if exist publish rmdir /s /q publish
dotnet publish TFY.csproj -c Release -r win-x64 --self-contained true -o "%~dp0publish"
if errorlevel 1 ( echo [ERROR] dotnet publish failed. & exit /b 1 )
dotnet publish SteamWorker\SteamWorker.csproj -c Release -r win-x64 --self-contained true -o "%~dp0publish"
if errorlevel 1 ( echo [ERROR] SteamWorker publish failed. & exit /b 1 )

REM ── 3. Sync UI dist into publish folder ─────
echo [3/9] Syncing UI to publish folder...
if exist "publish\project\dist" rmdir /s /q "publish\project\dist"
mkdir "publish\project\dist"
xcopy "project\dist\*" "publish\project\dist\" /E /Y /Q /I

REM ── 4. Pack with Velopack ───────────────────
echo [4/9] Packing with Velopack...
for /f "tokens=*" %%v in ('powershell -NoProfile -Command "([xml](Get-Content TFY.csproj)).Project.PropertyGroup.Version"') do set VERSION=%%v
echo Packing version %VERSION% ...
vpk pack -u TFY -v %VERSION% -p "%~dp0publish" -e TFY.exe -i "%~dp0installer\icon.ico" -y
if errorlevel 1 ( echo [ERROR] Velopack pack failed. & exit /b 1 )
powershell -NoProfile -Command "[System.IO.File]::WriteAllText('Releases\RELEASES', (Get-Content 'Releases\RELEASES' -Raw), (New-Object System.Text.UTF8Encoding $false))"
move /y "Releases\TFY-win-Setup.exe" "Releases\TFY-UtilityHub-Setup.exe" >nul 2>&1

REM ── 5. Create embedded zip resources for custom installer ──
echo [5/9] Creating embedded resources for custom installer...

REM  5a. dist.zip – React build assets for WebView2
if exist "TFY.Installer\dist.zip" del /f "TFY.Installer\dist.zip"
powershell -NoProfile -Command "$s=Join-Path $env:TEMP 'tfy_dist_staging'; if(Test-Path $s){Remove-Item -Recurse -Force $s}; New-Item -ItemType Directory -Force $s|Out-Null; Copy-Item 'project\dist\index.html' $s; Copy-Item 'project\dist\installer.html' $s -ErrorAction SilentlyContinue; Copy-Item -Recurse 'project\dist\assets' (Join-Path $s 'assets'); Compress-Archive -Path (Join-Path $s '*') -DestinationPath 'TFY.Installer\dist.zip' -Force; Remove-Item -Recurse -Force $s"
if errorlevel 1 ( echo [ERROR] dist.zip creation failed. & exit /b 1 )
echo   Created TFY.Installer\dist.zip

REM  5b. publish.zip – compiled application files
if exist "TFY.Installer\publish.zip" del /f "TFY.Installer\publish.zip"
powershell -NoProfile -Command "Compress-Archive -Path 'publish\*' -DestinationPath 'TFY.Installer\publish.zip' -Force"
if errorlevel 1 ( echo [ERROR] publish.zip creation failed. & exit /b 1 )
echo   Created TFY.Installer\publish.zip

REM ── 6. Build custom installer ───────────────
echo [6/9] Building custom TFY Installer...
if exist "publish_installer" rmdir /s /q "publish_installer"
dotnet publish TFY.Installer\TFY.Installer.csproj -c Release -r win-x64 --self-contained true -o "%~dp0publish_installer" -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:PublishReadyToRun=true
if errorlevel 1 ( echo [ERROR] TFY.Installer build failed. & exit /b 1 )

REM Rename to branded setup name
set SETUP_NAME=TFY-Setup-v%VERSION%.exe
copy /y "publish_installer\TFY.Installer.exe" "Releases\%SETUP_NAME%" >nul
copy /y "publish_installer\TFY.Installer.exe" "Releases\TFY-UtilityHub-Setup.exe" >nul
echo   Built Custom Installer: Releases\%SETUP_NAME% and Releases\TFY-UtilityHub-Setup.exe

REM ── 7. Deploy UI to Firebase ────────────────
echo [7/9] Deploying UI to Firebase Hosting...
if exist "project\dist\Releases\%CHANNEL%" rmdir /s /q "project\dist\Releases\%CHANNEL%"
if not exist "project\dist\Releases\%CHANNEL%" mkdir "project\dist\Releases\%CHANNEL%"
xcopy "Releases\RELEASES" "project\dist\Releases\%CHANNEL%\" /Y /Q /I
xcopy "Releases\*.nupkg" "project\dist\Releases\%CHANNEL%\" /Y /Q /I
xcopy "Releases\*.json" "project\dist\Releases\%CHANNEL%\" /Y /Q /I
REM Also mirror to /Releases/ root for backward compatibility (old app versions without trailing slash)
if not exist "project\dist\Releases" mkdir "project\dist\Releases"
xcopy "Releases\RELEASES" "project\dist\Releases\" /Y /Q /I
xcopy "Releases\*.nupkg" "project\dist\Releases\" /Y /Q /I
xcopy "Releases\*.json" "project\dist\Releases\" /Y /Q /I
pushd project
call npx cross-env firebase deploy --only hosting
if errorlevel 1 ( echo [ERROR] Firebase deploy failed. & popd & exit /b 1 )
popd

REM ── 8. Publish to GitHub Releases ───────────
echo [8/9] Publishing to GitHub Releases...
set RELEASE_TAG=v%VERSION%
if "%CHANNEL%"=="beta" (
    set RELEASE_TAG=v%VERSION%-beta
)
gh release list --repo "DragosKissLove/TFY-UtilityHub-Releases" | findstr "%RELEASE_TAG%" >nul 2>&1
if not errorlevel 1 (
    echo Replacing existing release %RELEASE_TAG%...
    gh release delete "%RELEASE_TAG%" --yes --cleanup-tag --repo "DragosKissLove/TFY-UtilityHub-Releases"
)
if "%CHANNEL%"=="beta" (
    gh release create "%RELEASE_TAG%" --prerelease --title "%RELEASE_TAG% (Beta Testing)" --notes "Beta pre-release updates." --repo "DragosKissLove/TFY-UtilityHub-Releases"
) else (
    gh release create "%RELEASE_TAG%" --title "%RELEASE_TAG%" --notes "Official stable updates." --repo "DragosKissLove/TFY-UtilityHub-Releases"
)
gh release upload "%RELEASE_TAG%" "Releases\RELEASES" --clobber --repo "DragosKissLove/TFY-UtilityHub-Releases"
gh release upload "%RELEASE_TAG%" "Releases\*.nupkg" --clobber --repo "DragosKissLove/TFY-UtilityHub-Releases"
gh release upload "%RELEASE_TAG%" "Releases\TFY-UtilityHub-Setup.exe" --clobber --repo "DragosKissLove/TFY-UtilityHub-Releases"
gh release upload "%RELEASE_TAG%" "Releases\%SETUP_NAME%" --clobber --repo "DragosKissLove/TFY-UtilityHub-Releases"

REM ── 9. Copy installers to Desktop ───────────
echo [9/9] Copying installers to Desktop...
copy /y "Releases\TFY-UtilityHub-Setup.exe" "%USERPROFILE%\Desktop\TFY-UtilityHub-Setup-v%VERSION%.exe" >nul
copy /y "Releases\%SETUP_NAME%" "%USERPROFILE%\Desktop\%SETUP_NAME%" >nul
echo   Velopack Installer: %USERPROFILE%\Desktop\TFY-UtilityHub-Setup-v%VERSION%.exe
echo   Custom Installer:   %USERPROFILE%\Desktop\%SETUP_NAME%

echo.
echo ============================================
echo  SUCCESS! Version %VERSION% (%CHANNEL%) live on GitHub + Firebase
echo  Velopack: %USERPROFILE%\Desktop\TFY-UtilityHub-Setup-v%VERSION%.exe
echo  Custom:   %USERPROFILE%\Desktop\%SETUP_NAME%
echo ============================================
pause
