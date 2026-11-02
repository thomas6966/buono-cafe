@echo off
rem Opens the Admin dashboard on THIS computer, connected to the LIVE server (Render).
cd /d "%~dp0admin"
set API_PROXY=https://buono-cafe.onrender.com
set VITE_CLIENT_URL=https://buono-cafe.vercel.app
start "" http://localhost:5174
call npx vite --port 5174
