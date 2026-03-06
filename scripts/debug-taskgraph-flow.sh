#!/bin/bash
################################################################################
# 🔍 DEBUG: TaskGraph Flow Inspector
# Intercepta y muestra cada paso del flujo de tareas complejas
################################################################################

CHARBI_HOME="${CHARBI_HOME:-$HOME/.charbi-agent}"
LOG_FILE="$CHARBI_HOME/logs/debug-taskgraph.log"
CORRELATION_ID="debug_$(date +%s)"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_step() {
    echo -e "${CYAN}[STEP $1]${NC} $2" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[⚠️]${NC} $1" | tee -a "$LOG_FILE"
}

# Crear carpeta de logs si no existe
mkdir -p "$(dirname "$LOG_FILE")"

# Limpiar log anterior
> "$LOG_FILE"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     🔍 TASKGRAPH FLOW DEBUGGER                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Correlation ID: $CORRELATION_ID"
echo "Log file: $LOG_FILE"
echo ""

# Prompt de prueba 
TEST_PROMPT="${1:-crea un proyecto java basico en /home/yhondev/java/demo que explique poo}"

log_step "1" "Iniciando flujo con prompt: '$TEST_PROMPT'"

# ═══════════════════════════════════════════════════════════════
# PASO 1: Verificar complejidad
# ═══════════════════════════════════════════════════════════════

log_step "2" "Verificando detección de complejidad..."

COMPLEXITY_RESPONSE=$(curl -s -X POST http://localhost:18790/api/v1/debug/complexity \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"$TEST_PROMPT\", \"correlationId\": \"$CORRELATION_ID\"}")

if [ $? -eq 0 ]; then
    log_success "Complejidad evaluada"
    echo "$COMPLEXITY_RESPONSE" | tee -a "$LOG_FILE"
else
    log_error "Error evaluando complejidad"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# PASO 2: Enviar solicitud de chat
# ═══════════════════════════════════════════════════════════════

log_step "3" "Enviando solicitud completa al kernel..."

CHAT_RESPONSE=$(curl -s -X POST http://localhost:18790/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"$TEST_PROMPT\",
    \"chatId\": \"debug_user\",
    \"mode\": \"autonomous\",
    \"correlationId\": \"$CORRELATION_ID\"
  }" \
  --max-time 120)

echo ""
log_step "4" "Respuesta del Kernel:"
echo "$CHAT_RESPONSE" | tee -a "$LOG_FILE"

echo ""

# ═══════════════════════════════════════════════════════════════
# PASO 3: Obtener flujo de eventos para correlationId
# ═══════════════════════════════════════════════════════════════

log_step "5" "Obteniendo flujo de eventos del DebugTracker..."

FLOW_LOG=$(curl -s "http://localhost:18790/api/v1/debug/flow?correlationId=$CORRELATION_ID")

if [ -n "$FLOW_LOG" ] && [ "$FLOW_LOG" != "[]" ]; then
    echo "$FLOW_LOG" | tee -a "$LOG_FILE"
    
    # Mostrar respuesta RAW del LLM si existe
    # Usamos grep basico para extraer el campo 'raw' si es posible, o solo mostramos el log completo
    echo ""
    log_step "6" "Eventos capturados (Raw JSON):"
    echo "$FLOW_LOG" | tee -a "$LOG_FILE"
else
    log_warning "No se encontraron eventos en el DebugTracker (¿se reinició el kernel o falló el ID?)"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# RESUMEN
# ═══════════════════════════════════════════════════════════════

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    📋 RESUMEN                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

if echo "$CHAT_RESPONSE" | grep -q "Proyecto completado"; then
    log_warning "Respuesta genérica detectada. Verifique si realmente se ejecutaron herramientas."
fi

if [ -z "$RAW_LLM" ]; then
    log_error "No se capturó respuesta RAW del LLM. Revisa IntelligenceProxy.ts"
fi

echo ""
echo "📄 Log completo guardado en: $LOG_FILE"
echo ""
