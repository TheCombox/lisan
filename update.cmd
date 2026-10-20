@echo off
title Lisan - Update
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update.ps1" %*
echo.
pause
