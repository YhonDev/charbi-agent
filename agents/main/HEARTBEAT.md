# HEARTBEAT.md - Proactive System Tasks 💓

_This file defines background tasks the system (primarily the Director) should execute during scheduled or spontaneous system heartbeats._

## Core Directives for Heartbeats

1. **Do not interrupt active sessions:** Execute these tasks silently in the background unless immediate action is required by the user.
2. **Be concise:** If reporting back to the user, aggregate findings into a single, brief summary.
3. **Log activity:** Record completed routine checks in `memory/heartbeat-state.json` to prevent redundant execution.

## Daily Routine Checks (To be executed 1-2 times daily)

### 1. Repository & Workspace Hygiene
- Check for uncommitted changes in active workspaces (e.g., OpenClaw source code).
- Identify and report any `tmp` or outdated staging files that can be cleaned up.

### 2. Academic & SIMA Monitoring
- **SIMA Check (Daily at 10:00 AM UTC):** El Director debe invocar al especialista `Scholar` para ejecutar el comando de chequeo de SIMA.
- **Comando a ejecutar:** 
  ```bash
  /home/yhondev/.charbi-agent/skills/sima/check-sima.sh check --notify --horizon 7
  ```
- **Flujo de Notificación:** El resultado de este comando producirá una lista de acciones `send_message`. El Director debe ejecutar cada una de estas acciones para notificar al usuario en el canal principal.
- **Reporte de Inactividad:** Si el comando no devuelve acciones, el Director debe enviar un único mensaje confirmando: "✅ SIMA: Sin actividades pendientes para los próximos 7 días."

### 3. System Evolution (Scout coordination)
- Coordinate with the Scout agent to verify if `openclaw update` has run successfully.
- Review any new discoveries from `npx clawhub search` and format a weekly digest for Yhon.

### 4. Memory Consolidation
- Analyze `memory/YYYY-MM-DD.md` files older than 48 hours.
- Distill persistent facts, architectural decisions, and repeating technical preferences into `MEMORY.md`.
- Flag the consolidation as complete for those specific dates.

---
*Note: If no anomalies or urgent items are found during a heartbeat, simply log the check internally and return `HEARTBEAT_OK`.*
