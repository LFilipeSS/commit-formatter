#!/bin/bash
# Linux

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo ""
echo " Commit Formatter — USTIBB"
echo " ─────────────────────────────────"
echo ""

# Verifica Node.js
if ! command -v node &> /dev/null; then
  echo " [ERRO] Node.js não encontrado."
  echo ""
  echo " Instale via seu gerenciador de pacotes:"
  echo "   Ubuntu/Debian: sudo apt install nodejs npm"
  echo "   Fedora:        sudo dnf install nodejs"
  echo "   Arch:          sudo pacman -S nodejs npm"
  echo "   Ou via NVM:    https://github.com/nvm-sh/nvm"
  echo ""
  exit 1
fi

# Instala dependências se necessário
if [ ! -d "public/node_modules" ]; then
  echo " Instalando dependências pela primeira vez..."
  cd public && npm install --omit=dev && cd ..
  echo ""
fi

echo " Iniciando servidor..."
echo " O browser abrirá automaticamente em instantes."
echo ""
echo " Para encerrar, pressione Ctrl+C"
echo ""

# Abre o browser após 1.5s
(sleep 1.5 && xdg-open "http://localhost:3456" 2>/dev/null) &

node public/server.js
