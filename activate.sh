#!/bin/bash

# Script de activación del entorno Zabbix MCP Server
# Uso: source activate.sh

echo "🔧 Activando entorno Zabbix MCP Server..."

# Activar entorno conda
conda activate zabbix-mcp-server

# Verificar que el entorno esté activo
if [[ "$CONDA_DEFAULT_ENV" == "zabbix-mcp-server" ]]; then
    echo "✅ Entorno conda activado: $CONDA_DEFAULT_ENV"
    echo "📦 Node.js version: $(node --version)"
    echo "📦 npm version: $(npm --version)"
    echo ""
    echo "🚀 Comandos disponibles:"
    echo "  npm install    - Instalar dependencias"
    echo "  npm run build  - Compilar TypeScript"
    echo "  npm test       - Ejecutar pruebas"
    echo "  npm start      - Iniciar servidor (producción)"
    echo "  npm run dev    - Iniciar servidor (desarrollo)"
    echo ""
    echo "📁 Directorio actual: $(pwd)"
else
    echo "❌ Error: No se pudo activar el entorno conda"
    echo "💡 Asegúrate de que el entorno 'zabbix-mcp-server' existe:"
    echo "   conda create -n zabbix-mcp-server -c conda-forge nodejs -y"
fi