/**
 * Seed E2E do épico "Operação Visível" F2(i)/F2(ii) (aviso de retenção +
 * botão "Proteção de envio"): garante, no tenant `e2e-test-org`, os dados que
 * `RetentionNotice`/GET `/api/v1/conversations/[id]/retention` e o card de
 * Conexões (`AntiBanSheet`/GET-PUT `/api/v1/ai/pacing`) precisam pra
 * renderizar algo real, sem depender de WhatsApp conectado de verdade.
 *
 * Cria/reusa:
 *  - 1 `channel_sessions` marcada `status='WORKING'` (não conecta WAHA — só o
 *    registro que a UI lê pra decidir "conectado", condição em
 *    components/connections/ConnectionsClient.tsx);
 *  - 1 `contacts` de teste;
 *  - 1 `conversations` ligando os dois;
 *  - 1 `job_queue` (kind inbound_turn, status done) — FK obrigatória de
 *    before_send_traces.job_id;
 *  - 1 `messages` outbound com status `queued` representando a resposta
 *    retida;
 *  - 1 `before_send_traces` com veto `outside_window` (mesma família que a
 *    prova localhost do HANDOFF), `created_at` sempre re-escrito para `now()`
 *    no rerun — RETENTION_LOOKBACK_MS do endpoint é 24h, então rodar este
 *    script pouco antes de provar a UI é o esperado.
 *
 * Idempotente: reruns reusam as linhas (match por nome/marker) e só atualizam
 * created_at/status para o estado "prova recente". Nunca toca outro tenant:
 * todo insert/select é filtrado por organization_id = creds.org_id
 * (e2e-test-org), lido de .e2e-creds.json (rode scripts/seed-e2e-credentials.ts
 * antes se o arquivo não existir).
 *
 * Run: npx tsx scripts/seed-e2e-operacao-visivel.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

import { anunciarDestino, credenciaisSupabaseDeTeste } from "./lib/env-de-teste";

// `process.env` VENCE `.env.local` — ver scripts/lib/env-de-teste.ts. Rodar
// este script contra a VPS de produção exige exportar
// NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY do .env daquele host
// (mesmo projeto Supabase cloud usado por crm.lumenva.pt) ANTES do comando.
const credenciais = credenciaisSupabaseDeTeste();
anunciarDestino("seed-e2e-operacao-visivel", credenciais);

const admin = createClient(credenciais.url, credenciais.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");

const SESSION_NAME = "e2e-antiban-session";
const CONTACT_NAME = "Contato Teste F2i";
const SEED_MARKER = "operacao-visivel-f2i";

interface Creds {
  org_id: string;
  users: Record<string, { id: string }>;
  operacao_visivel?: unknown;
}

async function ensureAntiBanSession(orgId: string): Promise<string> {
  const { data: existing } = await admin
    .from("channel_sessions")
    .select("id")
    .eq("organization_id", orgId)
    .eq("waha_session_name", SESSION_NAME)
    .maybeSingle();

  if (existing) {
    const id = (existing as { id: string }).id;
    // Reafirma "conectado" a cada run — não depende de um WAHA real ter
    // batido webhook de status pra manter a prova válida.
    const { error } = await admin
      .from("channel_sessions")
      .update({
        status: "WORKING",
        status_reason: null,
        last_health_check_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw new Error(`update channel_session: ${error.message}`);
    console.log(`[seed] channel_session reafirmada WORKING: ${id}`);
    return id;
  }

  const { data, error } = await admin
    .from("channel_sessions")
    .insert({
      organization_id: orgId,
      waha_session_name: SESSION_NAME,
      display_name: "Número Teste F2ii (seed, não conectar de verdade)",
      phone_number: "+5511999990000",
      status: "WORKING",
      // bytea placeholder — esta sessão NUNCA fala com um WAHA real; o valor
      // não precisa decriptar pra nada neste teste.
      webhook_secret_encrypted: "\\x00",
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`insert channel_session: ${error?.message}`);
  const id = (data as { id: string }).id;
  console.log(`[seed] channel_session criada WORKING: ${id}`);
  return id;
}

async function ensureContact(orgId: string): Promise<string> {
  const { data: existing } = await admin
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("display_name", CONTACT_NAME)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  const { data, error } = await admin
    .from("contacts")
    .insert({
      organization_id: orgId,
      display_name: CONTACT_NAME,
      phone_number: "+5511999990001",
      source: "manual",
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`insert contact: ${error?.message}`);
  const id = (data as { id: string }).id;
  console.log(`[seed] contact criado: ${id}`);
  return id;
}

async function ensureConversation(
  orgId: string,
  contactId: string,
  sessionId: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("channel_session_id", sessionId)
    .maybeSingle();

  const state = {
    status: "ai_handling",
    last_inbound_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    last_outbound_at: null,
    last_message_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    last_message_preview: "[TESTE F2i] Qual o horário de vocês?",
  };

  if (existing) {
    const id = (existing as { id: string }).id;
    const { error } = await admin.from("conversations").update(state as never).eq("id", id);
    if (error) throw new Error(`update conversation: ${error.message}`);
    console.log(`[seed] conversation reafirmada: ${id}`);
    return id;
  }

  const { data, error } = await admin
    .from("conversations")
    .insert({ organization_id: orgId, contact_id: contactId, channel_session_id: sessionId, ...state } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`insert conversation: ${error?.message}`);
  const id = (data as { id: string }).id;
  console.log(`[seed] conversation criada: ${id}`);
  return id;
}

async function ensureJob(orgId: string, contactId: string): Promise<string> {
  // 1 job 'running' por contato é único (uniq_job_queue_one_running_per_contact)
  // — usamos status 'done' pra não colidir com um turno real em andamento.
  const { data: existing } = await admin
    .from("job_queue")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("kind", "inbound_turn")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  const { data, error } = await admin
    .from("job_queue")
    .insert({
      organization_id: orgId,
      contact_id: contactId,
      kind: "inbound_turn",
      status: "done",
      payload: { seed: SEED_MARKER },
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`insert job_queue: ${error?.message}`);
  const id = (data as { id: string }).id;
  console.log(`[seed] job_queue criado: ${id}`);
  return id;
}

async function ensureMessage(
  orgId: string,
  conversationId: string,
  sessionId: string,
  contactId: string,
): Promise<void> {
  const { data: existing } = await admin
    .from("messages")
    .select("id")
    .eq("organization_id", orgId)
    .eq("conversation_id", conversationId)
    .eq("body", "[TESTE F2i] Fora da janela de envio (7h–22h) — resposta segurada")
    .maybeSingle();
  if (existing) return;

  const { error } = await admin.from("messages").insert({
    organization_id: orgId,
    conversation_id: conversationId,
    channel_session_id: sessionId,
    contact_id: contactId,
    type: "text",
    direction: "outbound",
    status: "queued",
    sent_via: "ai",
    body: "[TESTE F2i] Fora da janela de envio (7h–22h) — resposta segurada",
  } as never);
  if (error) throw new Error(`insert message: ${error.message}`);
  console.log(`[seed] message outbound (queued) criada`);
}

async function ensureVeto(
  orgId: string,
  jobId: string,
  contactId: string,
  sessionId: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("before_send_traces")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("vetoed_code", "outside_window")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const trace = [
    { gate: "pacing_window", verdict: "veto", code: "outside_window", detail: `seed=${SEED_MARKER}` },
  ];

  if (existing) {
    const id = (existing as { id: string }).id;
    // RETENTION_LOOKBACK_MS do endpoint é 24h — reafirma created_at=now() a
    // cada run pra prova continuar válida sem reinserir a linha.
    const { error } = await admin
      .from("before_send_traces")
      .update({ created_at: new Date().toISOString(), trace, job_id: jobId } as never)
      .eq("id", id);
    if (error) throw new Error(`update before_send_traces: ${error.message}`);
    console.log(`[seed] before_send_traces reafirmado (created_at=now): ${id}`);
    return id;
  }

  const { data, error } = await admin
    .from("before_send_traces")
    .insert({
      organization_id: orgId,
      job_id: jobId,
      contact_id: contactId,
      channel_session_id: sessionId,
      trace,
      vetoed_gate: "pacing",
      vetoed_code: "outside_window",
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`insert before_send_traces: ${error?.message}`);
  const id = (data as { id: string }).id;
  console.log(`[seed] before_send_traces criado: ${id}`);
  return id;
}

async function main(): Promise<void> {
  if (!fs.existsSync(CREDS_PATH)) {
    throw new Error(
      `${CREDS_PATH} não existe — rode scripts/seed-e2e-credentials.ts primeiro (precisa do org_id/users do e2e-test-org).`,
    );
  }
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
  const orgId = creds.org_id;
  if (!orgId) throw new Error(".e2e-creds.json sem org_id");

  const sessionId = await ensureAntiBanSession(orgId);
  const contactId = await ensureContact(orgId);
  const conversationId = await ensureConversation(orgId, contactId, sessionId);
  const jobId = await ensureJob(orgId, contactId);
  await ensureMessage(orgId, conversationId, sessionId, contactId);
  const traceId = await ensureVeto(orgId, jobId, contactId, sessionId);

  creds.operacao_visivel = {
    channel_session_id: sessionId,
    contact_id: contactId,
    conversation_id: conversationId,
    job_id: jobId,
    before_send_trace_id: traceId,
    note: "seed F2i/F2ii — dado de teste marcado '[TESTE F2i]'/'Teste F2i', não é dado real do tenant Lumenva",
  };
  fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2));

  console.log("\n✅ Seed Operação Visível F2(i)/F2(ii) completo.");
  console.log(`conversation: ${conversationId}`);
  console.log(`channel_session (antiban): ${sessionId}`);
  console.log(`\nAbra /app/inbox?conversation=${conversationId} pra F2(i) e /app/connections pra F2(ii).`);
}

main().catch((err) => {
  console.error("❌ Seed Operação Visível falhou:", err);
  process.exit(1);
});
