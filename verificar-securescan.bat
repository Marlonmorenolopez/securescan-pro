@echo off
setlocal enabledelayedexpansion
title SecureScan Pro - Verificacion de estado
color 0A

echo ============================================================
echo   SecureScan Pro - Verificacion de estado de contenedores
echo ============================================================
echo.

REM ── Cargar REDIS_PASSWORD desde .env (si existe) ───────────────────────────
set "REDIS_PASSWORD=changeme-redis-password"
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
        if "%%A"=="REDIS_PASSWORD" set "REDIS_PASSWORD=%%B"
    )
)

echo [1/5] Estado general de los contenedores (docker compose ps)
echo ------------------------------------------------------------
docker compose ps
if errorlevel 1 (
    echo.
    echo [ERROR] No se pudo ejecutar "docker compose ps".
    echo         Verifica que Docker Desktop este corriendo y que estas
    echo         parado dentro de la carpeta del proyecto ^(securescan-pro-main^).
    goto :end
)
echo.

echo [2/5] Backend Flask ^(/api/health^)
echo ------------------------------------------------------------
curl -s http://localhost:5000/api/health
if errorlevel 1 (
    echo [FALLO] El backend no responde en http://localhost:5000
) else (
    echo.
    echo [OK] Backend respondiendo.
)
echo.

echo [3/5] Frontend Next.js ^(puerto 3000^)
echo ------------------------------------------------------------
curl -s -o nul -w "HTTP %%{http_code}\n" http://localhost:3000
if errorlevel 1 (
    echo [FALLO] El frontend no responde en http://localhost:3000
) else (
    echo [OK] Frontend respondiendo.
)
echo.

echo [4/5] Redis ^(PING^)
echo ------------------------------------------------------------
docker exec securescan-redis redis-cli -a "%REDIS_PASSWORD%" ping 2>nul
if errorlevel 1 (
    echo [FALLO] Redis no respondio. Revisa: docker compose logs redis
) else (
    echo [OK] Redis respondio PONG.
)
echo.

echo [5/5] Celery worker ^(ultimas lineas del log^)
echo ------------------------------------------------------------
docker compose logs celery-worker --tail=15
echo.
echo   Busca una linea tipo "celery@... ready." arriba.
echo   Si no aparece, dale 1-2 minutos mas y vuelve a correr este script.
echo.

echo ============================================================
echo   Labs de practica (deberian responder con HTTP 200/302)
echo ============================================================
echo Juice Shop  (http://localhost:3001):
curl -s -o nul -w "  HTTP %%{http_code}\n" http://localhost:3001
echo DVWA        (http://localhost:3002):
curl -s -o nul -w "  HTTP %%{http_code}\n" http://localhost:3002
echo WebGoat     (http://localhost:3003):
curl -s -o nul -w "  HTTP %%{http_code}\n" http://localhost:3003
echo.

echo ============================================================
echo   Nota: Metasploit (msfrpcd) y ZAP pueden tardar 3-5 minutos
echo   en arrancar la primera vez. Si aparecen "unhealthy" o
echo   "Restarting" recien despues de levantar todo, espera un
echo   poco y vuelve a correr este script antes de asumir un error.
echo ============================================================

:end
echo.
pause
