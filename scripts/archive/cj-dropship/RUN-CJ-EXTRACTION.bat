@echo off
echo ========================================
echo  CJ Variant Extraction for Lebon Grace
echo ========================================
echo.
echo This script extracts product variants from CJ Dropshipping.
echo A browser window will open - log into CJ when prompted.
echo.
echo Press any key to start...
pause > nul

cd /d "%~dp0.."
node scripts/extract-cj-variants.js 20

echo.
echo ========================================
echo  Extraction complete!
echo  To import variants: node scripts/import-cj-variants.js
echo ========================================
pause
