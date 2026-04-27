@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  TFY Utility Hub - Build ^& Deploy Script
echo ============================================

REM ── 1. Build React UI ────────────────────────
echo [1/6] Building React UI...
pushd project
call npm run build
if errorlevel 1 ( echo [ERROR] npm build failed. & exit /b 1 )
popd

REM ── 2. Publish .NET app ─────────────────────
echo [2/6] Publishing .NET Application...
dotnet publish TFY.csproj -c Release -r win-x64 --self-contained true -o "%~dp0publish"
if errorlevel 1 ( echo [ERROR] dotnet publish failed. & exit /b 1 )

REM ── 3. Sync UI dist into publish folder ─────
echo [3/6] Syncing UI to publish folder...
if exist "publish\project\dist" rmdir /s /q "publish\project\dist"
mkdir "publish\project\dist"
xcopy "project\dist\*" "publish\project\dist\" /E /Y /Q /I

REM ── 4. Pack with Velopack ───────────────────
echo [4/6] Packing with Velopack...
for /f "tokens=*" %%v in ('powershell -NoProfile -Command "(Select-String -Path TFY.csproj -Pattern \"<Version>(.*)</Version>\").Matches.Groups[1].Value"') do set VERSION=%%v
echo Packing version %VERSION% ...
vpk pack -u TFY -v %VERSION% -p "%~dp0publish" -e TFY.exe -i "%~dp0installer\icon.ico" -y
if errorlevel 1 ( echo [ERROR] Velopack pack failed. & exit /b 1 )
move /y "Releases\TFY-win-Setup.exe" "Releases\TFY-UtilityHub-Setup.exe" >nul 2>&1

REM ── 5. Deploy UI to Firebase ────────────────
echo [5/6] Deploying UI to Firebase Hosting...
if exist "project\dist\Releases" rmdir /s /q "project\dist\Releases"
mkdir "project\dist\Releases"
xcopy "Releases\RELEASES" "project\dist\Releases\" /Y /Q /I
xcopy "Releases\*.nupkg" "project\dist\Releases\" /Y /Q /I
xcopy "Releases\*.json" "project\dist\Releases\" /Y /Q /I
pushd project
call npx cross-env firebase deploy --only hosting
if errorlevel 1 ( echo [ERROR] Firebase deploy failed. & popd & exit /b 1 )
popd

REM ── 6. Publish to GitHub Releases ───────────
echo [6/6] Publishing to GitHub Releases...
gh release list --repo "DragosKissLove/TFY-UtilityHub-Releases" | findstr "v%VERSION%" >nul 2>&1
if not errorlevel 1 (
    echo Replacing existing release v%VERSION%...
    gh release delete "v%VERSION%" --yes --cleanup-tag --repo "DragosKissLove/TFY-UtilityHub-Releases"
)
gh release create "v%VERSION%" --title "v%VERSION%" --notes "Automated build/update" --repo "DragosKissLove/TFY-UtilityHub-Releases"
gh release upload "v%VERSION%" "Releases\RELEASES" --clobber --repo "DragosKissLove/TFY-UtilityHub-Releases"
gh release upload "v%VERSION%" "Releases\*.nupkg" --clobber --repo "DragosKissLove/TFY-UtilityHub-Releases"
gh release upload "v%VERSION%" "Releases\TFY-UtilityHub-Setup.exe" --clobber --repo "DragosKissLove/TFY-UtilityHub-Releases"

REM ── Copy installer to Desktop ────────────────
echo Copying installer to Desktop...
copy /y "Releases\TFY-UtilityHub-Setup.exe" "%USERPROFILE%\Desktop\TFY-Setup-v%VERSION%.exe" >nul
echo Copied to: %USERPROFILE%\Desktop\TFY-Setup-v%VERSION%.exe

echo.
echo ============================================
echo  SUCCESS! Version %VERSION% live on GitHub + Firebase
echo  Installer: %USERPROFILE%\Desktop\TFY-Setup-v%VERSION%.exe
echo ============================================
pause
