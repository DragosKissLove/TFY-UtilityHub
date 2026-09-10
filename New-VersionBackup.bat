@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo  TFY Utility Hub - Create Version Backup
echo ============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\backup_version.ps1"
echo.
pause
