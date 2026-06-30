#!/bin/bash
# macOS — duplo clique para iniciar

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Verifica Node.js
if ! command -v node &> /dev/null; then
  osascript -e 'display alert "Node.js não encontrado" message "Instale o Node.js em https://nodejs.org (versão 18 ou superior) e tente novamente." as critical'
  open "https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  osascript -e 'display alert "Node.js desatualizado" message "Atualize o Node.js para a versão 18 ou superior em https://nodejs.org" as critical'
  open "https://nodejs.org"
  exit 1
fi

# Instala dependências se necessário
if [ ! -d "public/node_modules" ]; then
  echo "Instalando dependências pela primeira vez..."
  cd public && npm install --omit=dev && cd ..
fi

echo ""
echo "✅  Iniciando Commit Formatter..."
echo "   O browser abrirá automaticamente em instantes."
echo ""
echo "   Para encerrar, feche esta janela ou pressione Ctrl+C"
echo ""

# Abre o browser após 1.5s (enquanto o Node inicializa)
(sleep 1.5 && open "http://localhost:3456") &

node public/server.js
