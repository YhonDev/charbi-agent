# Charbi: Kernel-Based Digital Ghost Director 👻

**Charbi** es un ecosistema de automatización avanzada que ha evolucionado de un simple agente a un **Kernel Cognitivo**. Utiliza un Supervisor robusto y un sistema de eventos para orquestar agentes autónomos de forma segura y eficiente.

---

## 🔐 Kernel Guarantees (Contrato)

Para garantizar la estabilidad y seguridad del sistema, el Kernel asume los siguientes compromisos técnicos:
- **Aislamiento Total:** Ningún agente puede ejecutar procesos o escribir archivos fuera de su directorio `runtime/sessions/{id}`.
- **Mediación Obligatoria:** Ninguna herramienta (*tool*) se ejecuta sin pasar por el `safeToolCall` y la inspección del Supervisor.
- **Determinismo de Seguridad:** El Supervisor utiliza reglas deterministas (YAML); no depende de LLMs para decisiones de permitir/bloquear.
- **Independencia de Canal:** El Kernel es agnóstico al medio de comunicación; puede funcionar sin Telegram, WhatsApp o Web.
- **Falla Segura (Fail-Safe):** Si el Supervisor encuentra un error o una acción ambigua, la acción se bloquea por defecto.

---

## 🏗️ Gobernanza y Contratos de Acción

Charbi no procesa intenciones ambiguas. Cada pensamiento del agente debe ser serializado en un **Contrato de Acción** formal:

### 1. El Contrato (`KernelAction`)
El sistema solo acepta tipos de acción predefinidos:
- `filesystem.read`: Lectura de archivos (restringido a sesión).
- `filesystem.write`: Escritura de archivos (restringido a sesión).
- `shell.execute`: Ejecución de comandos (inspeccionado por heurística).
- `network.access`: Acceso a red (validado contra whitelist).

### 2. Máquina de Estados y Presupuesto (Runtime)
El Kernel gestiona el ciclo de vida de cada sesión de forma estricta:
- **Estados de Sesión:** `IDLE` -> `PLANNING` -> `EXECUTING` -> `COMPLETED` (o `BLOCKED`/`FAILED`).
- **Budget Engine:** Controla el consumo de recursos en tiempo real:
    - **Límite de Acciones:** Máximo 20 por sesión.
    - **Límite de Tiempo:** 30 segundos por ejecución.
    - **Interrupción Física (Kill):** El Kernel utiliza `AbortController` para forzar la terminación inmediata de una herramienta si excede el presupuesto o el tiempo.

### 4. Journaling y Auditoría (Journal System)
Cada sesión genera un **Journal Estructurado** (`.jsonl`) en `charbi/logs/journals/` que captura:
- Cada cambio de estado (`IDLE` -> `PLANNING`, etc.).
- Cada petición de acción y su resultado de riesgo/política.
- El consumo detallado del presupuesto.
- Incidentes de seguridad o interrupciones forzadas.

---

### 5. Capas de Validación (Defense in Depth)
1. **RiskEngine (Análisis Estructural):** Verifica que la acción sea válida estructuralmente y no contenga patrones de ataque obvios (ej. `rm -rf`).
2. **Supervisor (Enforcement de Política):** Valida la acción contra las reglas YAML definidas en `config/policies/`.

---

## 🚀 Arquitectura Kernel (V2)

La nueva arquitectura se basa en un diseño de **Micro-Kernel** donde cada componente tiene una responsabilidad única:

### 1. El Núcleo (`charbi/kernel/`)
- **Event Bus:** El sistema nervioso central que maneja la comunicación asíncrona (`USER_REQUEST`, `AGENT_RESPONSE`, `SYSTEM_CRON`).
- **Router:** Analizador cognitivo que clasifica tareas por complejidad, riesgo y determina qué especialista invocar.
- **Supervisor:** Motor de políticas que inspecciona cada acción (lectura/escritura de archivos, ejecución de comandos, acceso a red) antes de permitirla.
- **Process Manager:** Gestiona la ejecución aislada en `runtime/sessions/`, asegurando que ningún agente afecte al sistema global.

### 2. Especialistas y Herramientas (`charbi/agents/`)
Los especialistas ahora operan bajo el wrapper `safeToolCall`:
- **Coder 💻:** Desarrollo y arquitectura técnica.
- **Scholar 🎓:** Gestión académica (SIMA) y búsqueda de información.
- **Scout 🛰️:** Mantenimiento y optimización del sistema.

### 3. Canales y Adaptadores (`charbi/channels/`)
Puentes con el mundo exterior:
- **Telegram Adapter:** Convierte mensajes de chat en eventos del Kernel.
- **OpenClaw Adapter:** Permite ejecutar skills de OpenClaw dentro del sandbox del Kernel.

---

## 💡 Flujo de Ejecución Seguro

1. **Evento:** Un mensaje llega vía Telegram -> `emitEvent(USER_REQUEST)`.
2. **Triaje:** El `Router` analiza el riesgo y asigna un `Specialist`.
3. **Sandbox:** Se crea una sesión en `runtime/sessions/`.
4. **Inspección:** Cada herramienta que el agente intente usar es validada por el `Supervisor` contra `config/policies/default.yaml`.
5. **Reporte:** El resultado se sintetiza y se envía de vuelta al canal original.

---

## 🛠️ Stack Tecnológico Actualizado

| Componente | Tecnología |
| :--- | :--- |
| **Arquitectura** | Event-Driven Micro-Kernel |
| **Lenguaje** | Node.js / TypeScript |
| **Seguridad** | Policy DSL (YAML) + Safe Wrapper |
| **Persistencia** | SQLite + Session Workspaces |
| **Red** | Whitelist-based access control |

---
*Charbi Kernel: Infraestructura inteligente para agentes autónomos.*
