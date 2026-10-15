@echo off
REM ============================================================
REM  Controle de PDAs - liga o banco, a API e o site do balcao
REM  Clique duas vezes. Para desligar, feche as 3 janelas.
REM ============================================================

cd /d "%~dp0"

set MYSQLD="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"
set DATADIR=C:\Users\Public\mysql-dev\data

if not exist %MYSQLD% (
  echo ERRO: mysqld.exe nao encontrado. Ajuste a linha MYSQLD neste arquivo.
  pause
  exit /b 1
)

REM Se a porta 3307 ja esta em uso, o banco ja esta ligado
netstat -ano | findstr /R /C:":3307 .*LISTENING" >nul
if %errorlevel%==0 (
  echo MySQL ja esta ligado. Pulando...
) else (
  echo Ligando o MySQL - porta 3307...
  start "MySQL - NAO FECHE" %MYSQLD% --no-defaults --datadir=%DATADIR% --port=3307 --bind-address=127.0.0.1 --mysqlx=OFF --console
  timeout /t 8 /nobreak >nul
)

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if %errorlevel%==0 (
  echo API ja esta ligada. Pulando...
) else (
  echo Ligando a API - porta 3000...
  start "API - NAO FECHE" cmd /k "cd /d "%~dp0api-pda" && node src/server.js"
  timeout /t 3 /nobreak >nul
)

netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if %errorlevel%==0 (
  echo Site do balcao ja esta ligado. Pulando...
) else (
  echo Ligando o site do balcao - porta 5173...
  start "Balcao - NAO FECHE" cmd /k "cd /d "%~dp0frontend" && npm run dev"
  timeout /t 5 /nobreak >nul
)

start http://localhost:5173

echo.
echo Tudo ligado. Pode fechar esta janela.
timeout /t 5 >nul
