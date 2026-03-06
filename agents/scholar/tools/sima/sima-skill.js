const path = require('path');
// Carga robusta del .env
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');

// --- CONFIGURACIÓN ---
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
const COOKIES_PATH = path.join(__dirname, 'cookies.json');
const TASKS_DB_PATH = path.join(__dirname, '../../../../memory/sima_tasks.json');
const BASE_URL = 'https://sima.unicartagena.edu.co';

async function runCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { shell: '/bin/bash' }, (error, stdout, stderr) => {
            if (error) reject(stderr);
            else resolve(stdout);
        });
    });
}

function parseSIMADate(dateStr) {
    try {
        const months = {
            'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
            'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
        };

        let temp = dateStr.toLowerCase()
            .replace(/vence el /g, '')
            .replace(/,/g, '')
            .replace(/de /g, '')
            .trim();

        const parts = temp.split(' ');
        
        if (parts.length >= 5) {
            const day = parseInt(parts[1]);
            const month = months[parts[2]];
            const year = parseInt(parts[3]);
            const [hh, mm] = parts[4].split(':');
            return new Date(year, month, day, parseInt(hh), parseInt(mm));
        }

        const shortMatch = temp.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/);
        if (shortMatch) {
            const [, d, m, y, hh, mm] = shortMatch;
            const year = parseInt(y) < 100 ? 2000 + parseInt(y) : parseInt(y);
            return new Date(year, parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
        }

        return new Date(dateStr);
    } catch (e) {
        return null;
    }
}

async function getActivityDetails(browser, url) {
    if (!url || !url.startsWith('http')) return { description: 'URL inválida.', resources: [] };
    const page = await browser.newPage();
    try {
        await page.setUserAgent(USER_AGENT);
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const data = await page.evaluate(() => {
            const intro = document.querySelector('div[role="main"] #intro')?.innerText.trim() || 'Sin descripción detallada.';
            const resourceSelectors = '.activity-attachments a, .resource-attachment a, .box.generalbox a[href*="/resource/"]';
            const res = Array.from(document.querySelectorAll(resourceSelectors))
                .map(a => ({ name: a.innerText.trim(), link: a.href }))
                .filter(r => r.name);
            return { description: intro, resources: res };
        });
        return data;
    } catch (error) {
        return { description: 'Error al obtener detalles.', resources: [] };
    } finally {
        await page.close();
    }
}

async function login(browser) {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });

    if (fs.existsSync(COOKIES_PATH)) {
        await page.setCookie(...JSON.parse(fs.readFileSync(COOKIES_PATH)));
    }

    await page.goto(`${BASE_URL}/my/`, { waitUntil: 'networkidle2', timeout: 60000 });

    if (page.url().includes('login/index.php') || await page.$('.loginform')) {
        const user = process.env.SIMA_USER;
        const pass = process.env.SIMA_PASS;
        if (!user || !pass) throw new Error("SIMA_USER o SIMA_PASS no definidos en el .env");

        await page.type('#username', user);
        await page.type('#password', pass);
        await Promise.all([
            page.click('#loginbtn'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(await page.cookies(), null, 2));
    }
    return page;
}

async function performCheck(options = {}) {
    const notify = options.notify || false;
    const horizonDays = options.horizon || 7;
    const now = new Date();
    const horizonDate = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
        const page = await login(browser);
        const [calendarResults, timelineResults] = await Promise.all([
            (async () => {
                const p = await browser.newPage();
                await p.setUserAgent(USER_AGENT);
                await p.goto(`${BASE_URL}/calendar/view.php?view=upcoming`, { waitUntil: 'networkidle2' });
                const events = await p.evaluate(() =>
                    Array.from(document.querySelectorAll('.eventlist .event')).map(e => ({
                        name: e.querySelector('h3.name')?.innerText.trim(),
                        dateStr: e.querySelector('.description')?.innerText.trim(),
                        course: e.querySelector('.course')?.innerText.trim(),
                        link: e.querySelector('h3.name a')?.href
                    }))
                );
                await p.close(); return events;
            })(),
            (async () => {
                const p = await browser.newPage();
                await p.setUserAgent(USER_AGENT);
                await p.goto(`${BASE_URL}/my/`, { waitUntil: 'networkidle2' });
                try { await p.waitForSelector('.block-timeline', { timeout: 5000 }); } catch (e) {}
                const events = await p.evaluate(() =>
                    Array.from(document.querySelectorAll('[data-region="event-list-item"]')).map(item => ({
                        name: item.querySelector('[data-region="event-name"]')?.innerText.trim(),
                        dateStr: item.querySelector('small')?.innerText.trim(),
                        course: item.querySelector('.text-muted')?.innerText.trim(),
                        link: item.querySelector('a[data-action="view-event"]')?.href
                    }))
                );
                await p.close(); return events;
            })()
        ]);

        const allRaw = [...calendarResults, ...timelineResults];
        const unique = allRaw.reduce((acc, curr) => {
            if (curr.link && !acc.find(x => x.link === curr.link)) acc.push(curr);
            return acc;
        }, []);

        const enriched = [];
        for (const event of unique) {
            const dueDate = parseSIMADate(event.dateStr);
            const diffMs = dueDate ? (dueDate - now) : -1;
            
            if (dueDate && diffMs >= 0 && dueDate <= horizonDate) {
                const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                
                const details = await getActivityDetails(browser, event.link);
                enriched.push({
                    name: event.name,
                    date: event.dateStr,
                    dueDate: dueDate.toISOString(),
                    course: event.course,
                    link: event.link,
                    daysRemaining: days,
                    hoursRemaining: hours,
                    ...details
                });
            }
        }

        const result = {
            status: enriched.length > 0 ? "success" : "no_data",
            message: enriched.length > 0 ? "Datos recuperados" : "✅ SIMA: Sin actividades pendientes para el período solicitado.",
            data: enriched,
            timestamp: now.toISOString()
        };

        const memDir = path.dirname(TASKS_DB_PATH);
        if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
        fs.writeFileSync(TASKS_DB_PATH, JSON.stringify(result, null, 2));

        if (notify) {
            let msg = enriched.length === 0 ? result.message : "";
            enriched.forEach(e => {
                const d = new Date(e.dueDate);
                const formattedDate = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
                msg += `🚨 SIMA: ${e.name}\n📅 [Vence: ${formattedDate}]\n⏳ Faltan: ${e.daysRemaining} días, ${e.hoursRemaining} horas\n📚 ${e.course}\n🔗 ${e.link}\n\n`;
            });
            // En Charbi v2.5, las herramientas solo retornan datos/mensajes.
            // El componente que las invoca (Job/Orchestrator) decide cómo enviarlos.
            result.notification_text = msg;
            console.log(`[SIMA] Notification ready (${enriched.length} tasks)`);
        }

        return result;

    } catch (e) {
        throw e;
    } finally {
        await browser.close();
    }
}

// --- Charbi Tool Export ---
const checkSimaTool = {
    schema: {
        name: "check-sima",
        description: "Escanea las actividades pendientes en el portal SIMA (Calendario y Timeline).",
        parameters: {
            type: "object",
            properties: {
                horizon: { type: "number", description: "Días a futuro para escanear (default 7)" },
                notify: { type: "boolean", description: "Enviar notificación a Telegram" }
            },
            required: []
        }
    },
    handler: async (params) => {
        try {
            const res = await performCheck(params);
            return { success: true, data: res };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
};

module.exports = checkSimaTool;

// --- CLI Execution Support ---
if (require.main === module) {
    const args = process.argv.slice(2);
    const notify = args.includes('--notify');
    performCheck({ notify }).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => console.error(e));
}
