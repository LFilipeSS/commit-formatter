@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo  Commit Formatter — USTIBB
echo  ─────────────────────────────────
echo.

:: Verifica Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo  [ERRO] Node.js nao encontrado.
  echo.
  echo  Instale o Node.js em https://nodejs.org
  echo  ^(versao 18 ou superior^) e tente novamente.
  echo.
  start https://nodejs.org
  pause
  exit /b 1
)

setlocal enabledelayedexpansion

:: Instala dependências se necessário
if not exist "public\node_modules\" (
  echo  Instalando dependencias pela primeira vez...
  cd public
  call npm install --omit=dev
  cd ..
  echo.
)

echo  Iniciando servidor...
echo  O browser abrira automaticamente em instantes.
echo.
echo  Para encerrar, feche esta janela ou pressione Ctrl+C
echo.

:: Abre o browser após 2s em processo separado
start "" cmd /c "timeout /t 2 /nobreak > nul && start """" ""http://localhost:3456"""

node public\server.js
pause
