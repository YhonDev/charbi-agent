#!/usr/bin/env node

const { exec } = require('child_process');

async function runCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { shell: '/bin/bash' }, (error, stdout, stderr) => {
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

async function sendMorningBriefing(options) {
    const { country_news, global_news, weather_city, limit_country = 5, limit_global = 5 } = options;
    let briefingMessage = "☀️ Buenos días, Yhon! Aquí está tu resumen matutino:\n\n";

    // --- Fetch Country News ---
    if (country_news) {
        try {
            const cmd = `openclaw web_search --query "noticias de ${country_news}" --count ${limit_country} --search_lang "es" --country "CO"`;
            const rawResults = await runCommand(cmd);
            const countryNewsResults = JSON.parse(rawResults);

            if (countryNewsResults.output && countryNewsResults.output.results && countryNewsResults.output.results.length > 0) {
                briefingMessage += `📰 Noticias de ${country_news}:\n`;
                countryNewsResults.output.results.forEach(item => {
                    briefingMessage += `- ${item.title} ([${item.url}])\n`; // Added markdown link format
                });
                briefingMessage += "\n";
            }
        } catch (error) {
            console.error(`Error fetching country news for ${country_news}:`, error);
            briefingMessage += `📰 No se pudieron cargar las noticias de ${country_news}.\n\n`;
        }
    }

    // --- Fetch Global News ---
    if (global_news) {
        try {
            const cmd = `openclaw web_search --query "noticias del mundo" --count ${limit_global} --search_lang "es"`;
            const rawResults = await runCommand(cmd);
            const globalNewsResults = JSON.parse(rawResults);

            if (globalNewsResults.output && globalNewsResults.output.results && globalNewsResults.output.results.length > 0) {
                briefingMessage += `🌍 Noticias del Mundo:\n`;
                globalNewsResults.output.results.forEach(item => {
                    briefingMessage += `- ${item.title} ([${item.url}])\n`; // Added markdown link format
                });
                briefingMessage += "\n";
            }
        } catch (error) {
            console.error("Error fetching global news:", error);
            briefingMessage += "🌍 No se pudieron cargar las noticias del mundo.\n\n";
        }
    }

    // --- Fetch Weather ---
    if (weather_city) {
        try {
            // The weather skill might output plain text, not JSON
            const weatherOutput = await runCommand(`weather --city "${weather_city}"`);
            briefingMessage += `☁️ Clima en ${weather_city}:\n`;
            briefingMessage += `${weatherOutput.trim()}\n\n`;
        } catch (error) {
            console.error(`Error fetching weather for ${weather_city}:`, error);
            briefingMessage += `☁️ No se pudo obtener el clima para ${weather_city}.\n\n`;
        }
    }

    // --- Send Message ---
    try {
        // Escape quotes in the message for shell command
        // For Discord/Telegram, markdown links [text](url) should work.
        // We also need to ensure the message is properly quoted for the shell command.
        const escapedMessage = briefingMessage.replace(/\n/g, '\\n').replace(/"/g, '\"');
        const cmd = `openclaw message send --message "${escapedMessage}" --channel "webchat"`; // Assuming 'webchat' as the target channel from inbound context
        await runCommand(cmd);
        console.log("Morning briefing sent successfully.");
    } catch (error) {
        console.error("Error sending morning briefing:", error);
    }
}

// Command-line argument parsing
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
        const key = arg.substring(2);
        let value = true; // Default for boolean flags
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
            value = args[i + 1];
            if (!isNaN(value) && !isNaN(parseFloat(value))) value = Number(value); // Check for valid number
            else if (value.toLowerCase() === 'true') value = true;
            else if (value.toLowerCase() === 'false') value = false;
            i++;
        }
        options[key] = value;
    }
}

// Execute the briefing function
(async () => {
    await sendMorningBriefing(options);
})();

module.exports = { sendMorningBriefing };
