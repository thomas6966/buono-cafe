@echo off
rem Starts the BUONO API + Telegram bot, the public tunnel for Telegram and the Admin dashboard (localhost only).
cd /d "%~dp0"
start "BUONO API + Bot" cmd /k "npm run dev"
timeout /t 4 >nul
start "BUONO Tunnel (Telegram)" cmd /k "npm run tunnel"
start "BUONO Admin" cmd /k "npm run admin:dev"
timeout /t 5 >nul
start http://localhost:5174
