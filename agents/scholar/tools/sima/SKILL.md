# SKILL_SIMA.md - Definition for Scholar 🎓

## Description
Scan SIMA courses/calendar and notify pending activities via Telegram.

## Technical Details
- **Provider:** Universidad de Cartagena (SIMA)
- **Endpoint:** https://sima.unicartagena.edu.co/
- **Local Command:** `/home/yhondev/.charbi-agent/skills/sima/check-sima.sh`

## Operational Directives
1. **Frequency:** Daily at 10 AM.
2. **Horizon:** 7 Days look-ahead.
3. **Output Format:**
   ```
   🚨 SIMA: [Nombre de Tarea]
   📅 [Vence: DD/MM/AAAA]
   ⏳ Faltan: [X días, Y horas]
   📚 [Materia]
   ```

## Special Instructions
- Filter by Subject if specified.
- Use stored PDF links for "How-to" queries.
- Report "✅ SIMA: Sin actividades pendientes" if empty.
