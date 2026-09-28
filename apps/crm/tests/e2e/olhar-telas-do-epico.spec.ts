/**
 * OLHAR as telas que o épico produziu — não "testar o encanamento delas".
 *
 * Por que existe: medido em `dffa823a`, o app tem 47 telas e 24 delas não
 * aparecem em spec nenhum. Entre as descobertas estavam telas DO PRÓPRIO
 * ÉPICO — entregamos capacidades de acervo e nunca abrimos a tela de acervo,
 * fechamos o ciclo IA↔humano e a caixa onde o humano recebe o chamado não tinha
 * teste de tela.
 *
 * O que este spec cobra é o mínimo que ninguém tinha cobrado: a tela ABRE, tem
 * conteúdo legível, e não cospe erro no console. Não é sofisticado de propósito
 * — o defeito que ele caça é "tela em branco", "500 em produção" e "erro de
 * runtime que só aparece no build de produção", que é justamente o que passa
 * despercebido quando só se testa o caminho feliz com estado semeado.
 *
 * Uma tela sadia provada TAMBÉM é resultado: a captura fica versionada.
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const EVIDENCIA = path.join(process.cwd(), "evidence", "ia-360-w5");

interface Creds {
  password: string;
  users: { admin?: { email: string } };
}

/** Telas do épico que estavam SEM cobertura alguma na medição de `dffa823a`. */
const TELAS = [
  { rota: "/app/ai/knowledge/sources", nome: "acervo-de-conhecimento", dono: "W5" },
  { rota: "/app/ai/skills", nome: "habilidades", dono: "W5" },
  { rota: "/app/ai/memory", nome: "memoria-da-organizacao", dono: "W5" },
  { rota: "/app/ai/usage", nome: "consumo", dono: "W1" },
  { rota: "/app/ai/inbox", nome: "caixa-do-humano", dono: "W3" },
  { rota: "/app/ai/routers", nome: "roteadores", dono: "W3" },
  { rota: "/app/ai/agents/new", nome: "criar-agente", dono: "W1" },
] as const;

let creds: Creds;

test.beforeAll(() => {
  expect(fs.existsSync(CREDS_PATH), "rode scripts/seed-e2e-credentials.ts").toBe(true);
  creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
  fs.mkdirSync(EVIDENCIA, { recursive: true });
});

test.describe("as telas do épico abrem para uma pessoa", () => {
  test.describe.configure({ timeout: 180_000 });

  test("cada tela abre, tem conteúdo e não cospe erro no console", async ({ page }) => {
    const erros: string[] = [];
    const respostas429: string[] = [];
    let trocaDeSessao = "não observada";
    page.on("console", (m) => {
      if (m.type() === "error") erros.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (e) => erros.push(`PAGEERROR: ${String(e).slice(0, 200)}`));
    page.on("response", (response) => {
      if (response.status() === 429) {
        respostas429.push(new URL(response.url()).pathname);
      }
    });
    page.on("response", async (response) => {
      if (new URL(response.url()).pathname !== "/api/auth/session") return;
      const body = await response.json().catch(() => ({}));
      const code = typeof body?.error?.code === "string" ? body.error.code : "none";
      trocaDeSessao = `HTTP ${response.status()}; code=${code}`;
    });

    // Login real pela tela — sem injeção de sessão. F4 desativou o challenge MFA.
    await page.goto("/login");
    await page.locator("#email").fill(creds.users.admin!.email);
    await page.locator("#password").fill(creds.password);
    await page.getByRole("button", { name: /entrar/i }).click();
    try {
      await page.waitForURL(/\/app\//, { timeout: 30_000 });
    } catch (error) {
      const alert = await page.locator("form [role=alert]").innerText().catch(() => "sem mensagem visível");
      const cookie = (await page.context().cookies()).some((item) => item.name === "fb-session-auth");
      throw new Error(
        `Login não chegou ao app; URL=${page.url()}; troca de sessão=${trocaDeSessao}; cookie=${cookie}; alerta=${alert}`,
        { cause: error },
      );
    }

    const quebradas: string[] = [];

    for (const tela of TELAS) {
      erros.length = 0;
      respostas429.length = 0;
      const resp = await page.goto(tela.rota, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);

      const status = resp?.status() ?? 0;
      const texto = (await page.locator("body").innerText().catch(() => ""))
        .replace(/\s+/g, " ")
        .trim();

      await page.screenshot({
        path: path.join(EVIDENCIA, `tela-${tela.nome}.png`),
        fullPage: true,
      });

      // O que conta como quebrada: HTTP ruim, tela sem conteúdo legível, ou
      // erro de runtime. 120 chars é baixo de propósito — uma tela vazia de
      // verdade tem só o menu; qualquer conteúdo real passa disso com folga.
      if (status >= 400) quebradas.push(`${tela.rota} [${tela.dono}]: HTTP ${status}`);
      else if (texto.length < 120) {
        quebradas.push(`${tela.rota} [${tela.dono}]: só ${texto.length} chars — tela em branco`);
      }
      if (erros.length > 0) {
        const rotas429 = [...new Set(respostas429)];
        const detalhe429 = rotas429.length ? `; HTTP 429 em ${rotas429.join(", ")}` : "";
        quebradas.push(`${tela.rota} [${tela.dono}]: console → ${erros.slice(0, 2).join(" | ")}${detalhe429}`);
      }
    }

    expect(quebradas, `telas do épico com problema:\n  ${quebradas.join("\n  ")}`).toEqual([]);
  });
});
