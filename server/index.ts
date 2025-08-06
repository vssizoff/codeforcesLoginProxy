import Backendium from "backendium";
import {db, setupEnv} from "./db.js";
import {object, string} from "checkeasy";
import { JSDOM } from 'jsdom';
import superagent from 'superagent';

/**
 * Проверяет, требуется ли авторизация для доступа к странице
 * @param html HTML-контент страницы
 * @returns true если требуется логин
 */
function requiresLogin(html: string): boolean {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Проверяем наличие формы входа (стандартная форма Codeforces)
    const loginForm = document.querySelector('form#linkEnterForm');
    if (!loginForm) return false;

    // Дополнительная проверка на наличие CSRF-токена (уникальный признак страницы входа)
    return !!loginForm.querySelector('input[name="csrf_token"]');
}

/**
 * Логинится в Codeforces только если текущая сессия не валидна
 * @param agent Superagent агент с текущей сессией
 * @param domain Домен Codeforces
 * @param login Логин
 * @param password Пароль
 * @param testUrl URL для проверки сессии
 * @returns true если сессия стала валидной
 */
async function ensureValidSession(
    agent: superagent.Agent,
    domain: string,
    login: string,
    password: string,
    testUrl: string
): Promise<void> {
    // Проверяем текущую сессию с помощью тестового запроса
    const testRes = await agent.get(testUrl);

    if (!requiresLogin(testRes.text)) {
        console.log("Already authenticated");
        return; // Сессия уже валидна
    }

    // Сессия недействительна - выполняем логин
    const loginPageRes = await agent.get(`https://${domain}/enter`);
    const dom = new JSDOM(loginPageRes.text);
    const document = dom.window.document;
    const csrfTokenInput = document.querySelector('input[name="csrf_token"]');

    if (!csrfTokenInput) {
        throw new Error('CSRF token not found in login page');
    }

    const csrfToken = csrfTokenInput.getAttribute('value');
    if (!csrfToken) {
        throw new Error('CSRF token value is empty');
    }

    // Отправляем форму логина
    const loginRes = await agent
        .post(`https://${domain}/enter`)
        .type('form')
        .send({
            csrf_token: csrfToken,
            action: 'enter',
            handleOrEmail: login,
            password: password,
            remember: 'on'
        });

    // Проверяем результат логина
    if (loginRes.text.includes('Invalid handle/email or password')) {
        throw new Error('Login failed: Invalid credentials');
    }

    if (requiresLogin(loginRes.text)) {
        throw new Error('Login failed: Possible CAPTCHA or session issue');
    }
}

export async function fetchCodeforces(
    url: string,
    domain: string,
    login: string,
    password: string
): Promise<string> {
    const agent = superagent.agent();

    try {
        // Шаг 1: Убеждаемся, что сессия валидна
        await ensureValidSession(agent, domain, login, password, url);

        return (await agent.get(url)).text;
    } catch (error) {
        throw new Error(
            `Group standings retrieval failed: ${error instanceof Error ? error.message : error}`
        );
    }
}

const app = new Backendium({
    host: process.env.HOST,
    port: Number(process.env.PORT)
    // port: 8081
});

app.get("/:name(*)", {
    paramsValidator: object({
        name: string()
    }, {ignoreUnknown: true})
}, async (request, response) => {
    let row = await db.selectFrom("proxy").where("name", '=', request.params.name).selectAll().executeTakeFirst();
    if (!row) {
        response.end("", 404);
        return;
    }
    response.end(await fetchCodeforces(row.url, row.domain, row.login, row.password));
});

(async () => {
    await setupEnv();
    app.start();
})();