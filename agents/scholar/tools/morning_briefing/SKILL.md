# SKILL_MORNING_BRIEFING.md - Definition for Director 👑

## Description
Generates a daily morning briefing including news (Colombia and World) and weather for a specified city, then sends it to the user via Telegram.

## Technical Details
- **Provider:** Web Search (Brave), Weather (wttr.in or Open-Meteo)
- **Local Command:** `/home/yhondev/.charbi-agent/skills/morning_briefing/briefing.js`

## Operational Directives
1. **Trigger:** Executed daily via a `job.json` scheduler.
2. **Parameters:**
   - `country_news`: Country for local news (e.g., "colombia")
   - `global_news`: Boolean to include world news
   - `weather_city`: City for weather (e.g., "Cartagena,CO")
   - `limit_country`: Number of country news items (default 5)
   - `limit_global`: Number of global news items (default 5)
3. **Output Format (Telegram):**
   ```
   ☀️ Buenos días, Yhon! Aquí está tu resumen matutino:

   📰 Noticias de [País]:
   - [Título 1] ([URL 1])
   - [Título 2] ([URL 2])
   ...

   🌍 Noticias del Mundo:
   - [Título 1] ([URL 1])
   - [Título 2] ([URL 2])
   ...

   ☁️ Clima en [Ciudad]:
   [Condiciones actuales, temperatura, etc.]
   ```
