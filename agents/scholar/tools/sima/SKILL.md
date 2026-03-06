---
name: "check-sima"
description: "Scan SIMA courses/calendar and notify pending activities via Telegram."
---

# SIMA Notification Skill

**URL:** https://sima.unicartagena.edu.co/login/index.php
**Command:** `/home/yhondev/.charbi-agent/agents/scholar/tools/sima/check-sima.sh`

## Directives
1. **Analyze:** Execute the command and parse the JSON output of the scraper.
2. **Filter & Query:**
   - **Week View:** Filter activities with a due date within **7 days** from NOW (including TODAY).
   - **Subject Query:** If the user asks for a specific subject, filter all activities (timeline and calendar) by that subject name.
   - **Timeline/Calendar:** Check both the calendar and the dashboard timeline.
3. **Calculate:** 
   - `DaysRemaining = DueDate - CurrentDate`
   - `HoursRemaining = (DueDate - CurrentDate) * 24`
4. **Format for Telegram (ULTRA CONCISE):**
   - If NO tasks: `✅ SIMA: Sin actividades pendientes para el período solicitado.`
   - If Tasks found: 
     ```
     🚨 SIMA: [Nombre de Tarea]
     📅 [Vence: DD/MM/AAAA]
     ⏳ Faltan: [X días, Y horas]
     📚 [Materia]
     🔗 [Link (if available)]
     ```
5. **Schedule:** Run this check every day at 10 AM.

## Context Analysis
- Store the list of activities, subjects, and links discovered. 
- If the user asks "How do I do [Task Name]?", fetch the PDF content from the stored links to provide the answer based on the unit's resources.
