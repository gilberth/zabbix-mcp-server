#!/bin/bash

# Test script para Zabbix MCP Server SSE
# Uso: ./test-client.sh

SERVER_URL="http://localhost:3001"
SESSION_FILE="/tmp/mcp_session_id"

echo "🧪 Zabbix MCP Server - Script de Testing"
echo "======================================="

# Función para limpiar al salir
cleanup() {
    if [ -f "$SESSION_FILE" ]; then
        SESSION_ID=$(cat "$SESSION_FILE")
        echo "🧹 Limpiando sesión: $SESSION_ID"
        curl -s -X DELETE "$SERVER_URL/session/$SESSION_ID" > /dev/null
        rm -f "$SESSION_FILE"
    fi
    echo "👋 Testing completado"
}

trap cleanup EXIT

# 1. Verificar que el servidor esté corriendo
echo "1️⃣ Verificando servidor..."
if ! curl -s "$SERVER_URL/health" > /dev/null; then
    echo "❌ Servidor no disponible en $SERVER_URL"
    echo "💡 Ejecuta: npm run dev:stream"
    exit 1
fi

HEALTH=$(curl -s "$SERVER_URL/health")
echo "✅ Servidor activo: $HEALTH"

# 2. Establecer conexión SSE y capturar sessionId
echo -e "\n2️⃣ Estableciendo conexión SSE..."
timeout 5 curl -N -H "Accept: text/event-stream" "$SERVER_URL/sse" 2>/dev/null | while read line; do
    if [[ $line == data:* ]]; then
        data=${line#data: }
        if echo "$data" | grep -q '"type":"session"'; then
            session_id=$(echo "$data" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
            echo "$session_id" > "$SESSION_FILE"
            echo "🆔 Session ID capturado: $session_id"
            break
        fi
    fi
done &

# Esperar a que se capture el sessionId
sleep 2

if [ ! -f "$SESSION_FILE" ]; then
    echo "❌ No se pudo capturar session ID"
    exit 1
fi

SESSION_ID=$(cat "$SESSION_FILE")
echo "✅ Usando session ID: $SESSION_ID"

# 3. Test de herramientas disponibles
echo -e "\n3️⃣ Listando herramientas disponibles..."
TOOLS_RESPONSE=$(curl -s -X POST "$SERVER_URL/message?sessionId=$SESSION_ID" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')

echo "📋 Respuesta: $TOOLS_RESPONSE"

# 4. Test de obtener hosts
echo -e "\n4️⃣ Obteniendo hosts de Zabbix..."
HOSTS_RESPONSE=$(curl -s -X POST "$SERVER_URL/message?sessionId=$SESSION_ID" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"zabbix_get_hosts","arguments":{"limit":3}},"id":2}')

echo "🖥️ Respuesta: $HOSTS_RESPONSE"

# 5. Test de obtener items
echo -e "\n5️⃣ Obteniendo items de Zabbix..."
ITEMS_RESPONSE=$(curl -s -X POST "$SERVER_URL/message?sessionId=$SESSION_ID" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"zabbix_get_items","arguments":{"limit":5}},"id":3}')

echo "📊 Respuesta: $ITEMS_RESPONSE"

# 6. Test con header alternativo
echo -e "\n6️⃣ Test con X-Session-ID header..."
HEADER_RESPONSE=$(curl -s -X POST "$SERVER_URL/message" \
    -H "Content-Type: application/json" \
    -H "X-Session-ID: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","method":"tools/list","id":4}')

echo "📨 Respuesta con header: $HEADER_RESPONSE"

# 7. Verificar estado final del servidor
echo -e "\n7️⃣ Estado final del servidor..."
FINAL_HEALTH=$(curl -s "$SERVER_URL/health")
echo "📊 Estado: $FINAL_HEALTH"

echo -e "\n✅ Testing completado exitosamente"