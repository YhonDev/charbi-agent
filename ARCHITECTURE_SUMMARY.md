# 🏗️ Arquitectura de Charbi Agent (Referencia Técnica)

Charbi ha evolucionado hacia un sistema autónomo multi-agente de alto nivel, capaz de planificar y ejecutar proyectos complejos mediante un motor de grafos de tareas y memoria híbrida.

---

## 🏗️ Las 7 Capas de Charbi

1.  **Channels**: Adaptadores de entrada (CLI, Telegram, etc.) que normalizan los mensajes.
2.  **Gateway**: Punto de entrada que convierte mensajes externos en eventos internos `USER_REQUEST`.
3.  **Event Bus**: El corazón reactivo del sistema que comunica todos los módulos.
4.  **Cognitive Kernel**: 
    - **Context Builder**: Reúne Soul, Memorias y Herramientas para el LLM.
    - **Task Graph Engine**: Descompone objetivos complejos en planes de tareas.
    - **Orchestrator**: Ejecuta el bucle cognitivo avanzado.
5.  **Agent Router**: Clasifica tareas (Triage vía LLM) y asigna especialistas.
6.  **Tools / Skills**: Capacidades reales (Filesystem, Shell, Web Search, Graph).
7.  **Memory System**: Almacén híbrido (Vectorial + Grafo de Conocimiento).

---

## 🧠 Ciclo Cognitivo Avanzado (Cognitive Loop)

Cada agente especialista opera bajo un ciclo de razonamiento profundo:
- **THINK & PLAN**: Analiza el contexto y traza una ruta de acción.
- **ACT & OBSERVE**: Ejecuta herramientas y analiza los resultados.
- **REFLECT & LEARN**: Al finalizar, extrae lecciones y las persiste en la memoria.

---

## 🕸️ Modo Proyecto (Task Graph Engine)

Para tareas que exceden una simple respuesta, Charbi activa su motor de grafos:
- **Planner**: Descompone el objetivo en un DAG (Grafo Acíclico Dirigido) de tareas.
- **Executor**: Coordina a los agentes para completar el grafo respetando dependencias.
- **Reflection**: Analiza el resultado global del proyecto para mejorar estratégicamente.

---

## 🚀 Estado de Implementación

| Componente | Estado | Descripción |
| :--- | :--- | :--- |
| **Infraestructura Base** | ✅ Finalizado | EventBus, Bootstrap, Config Wizard, CLI. |
| **Memoria Híbrida** | ✅ Finalizado | Vector Store (NumPy) + Knowledge Graph (NetworkX) + Memory Server. |
| **Capa Cognitiva** | ✅ Finalizado | Context Builder, Orchestrator con THINK-PLAN-ACT. |
| **Multi-Agente** | ✅ Finalizado | Router con Triage LLM. Agentes: Director, Coder, Researcher, Operator. |
| **Task Graph Engine** | ✅ Finalizado | Motor de planificación y ejecución de proyectos complejos. |
| **Reflection Engine** | ✅ Finalizado | Sistema de post-reflexión y aprendizaje automático. |
| **Autonomía Permanente** | 📋 Pendiente | Estado persistente del agente (trabajo en segundo plano de larga duración). |

---

## 🧬 Identidades Agente (SOUL Layer)

Cada agente especialista tiene su propia identidad en `agents/[nombre]/cognition/`:
- **SOUL.md**: Personalidad y visión.
- **MISSION.md**: Objetivos estratégicos.
- **RULES.md**: Protocolos de seguridad y operación.
- **STYLE.md**: Tono y formato de respuesta.

---

## 📂 Estructura de Archivos Críticos

```
charbi/
 ├─ agents/                # Perfiles cognitivos de especialistas
 ├─ kernel/
 │   ├─ task_graph/        # Motor de proyectos autónomos
 │   ├─ cognition/         # ContextBuilder, MemoryClient, Manager
 │   ├─ reflection/        # Motor de aprendizaje estratégico
 │   └─ orchestrator.ts    # Cerebro central
 ├─ memory/                # Motores de memoria (Python Lite)
 ├─ skills/                # Herramientas (Filesystem, Web, Cognitive)
 └─ config/                # Ajustes de proveedores (Gemini, Ollama, etc.)
```

---
*Ultima actualización: 5 de Marzo, 2026 - Charbi v2.5 (High Autonomy Edition)*
