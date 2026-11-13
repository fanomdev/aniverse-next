@echo off
rem Start the whole thing: Kuhi stream host (port 9797) then the Next.js app.
setlocal
set "APP_DIR=D:\aniverse-next"
set "PORT=3001"
netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul && set "PORT=3102"

echo Starting Kuhi stream host on :9797 ...
start "Kuhi Stream Host" /min "%APP_DIR%\kuhi\start.bat"
timeout /t 2 /nobreak >nul

echo Starting AniVerse (Next.js) on :%PORT% ...
start "AniVerse Next.js" /min cmd /k "cd /d "%APP_DIR%" && set "ANIME_SOURCES_BASE=http://localhost:9797" && pnpm dev -p %PORT%"
echo.
echo Open: http://localhost:%PORT%
start http://localhost:%PORT%
endlocal
