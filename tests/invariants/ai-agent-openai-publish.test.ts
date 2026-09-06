import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { loadPublishedAgentConfig } from "@/lib/agent-engine/agent/agent-config";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode via `pnpm test:db`");
}

const PORT = Number(process.env.TEST_DB_PORT ?? 54329);
const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
  max: 2,
});

const ORG = "a1111111-0000-4000-8000-000000000001";
const SESSION = "a1111111-0000-4000-8000-000000000002";
const AGENT = "a1111111-0000-4000-8000-000000000003";
const OLD_VERSION = "a1111111-0000-4000-8000-000000000004";
const NEW_VERSION = "a1111111-0000-4000-8000-000000000005";
const CREDENTIAL = "a1111111-0000-4000-8000-000000000006";

beforeAll(async () => {
  await pool.query(
    `insert into organizations (id, slug, legal_name, display_name)
     values ($1, 'openai-publish-proof', 'OpenAI Publish Proof', 'OpenAI Publish Proof')
     on conflict (id) do nothing`,
    [ORG],
  );
  await pool.query(
    `insert into channel_sessions (id, organization_id, waha_session_name, status, webhook_secret_encrypted)
     values ($1, $2, 'openai-publish-proof', 'WORKING', '\\x00'::bytea)
     on conflict (id) do nothing`,
    [SESSION, ORG],
  );
  await pool.query(
    `insert into ai_provider_credentials
       (id, organization_id, provider, label, api_key_encrypted, api_key_iv, api_key_tag,
        api_key_last4, validated_at, is_active)
     values ($1, $2, 'openai', 'local test credential', '\\x00'::bytea, '\\x00'::bytea,
             '\\x00'::bytea, 'local', now(), true)
     on conflict (id) do nothing`,
    [CREDENTIAL, ORG],
  );
  await pool.query(
    `insert into ai_agents (id, organization_id, name, system_prompt)
     values ($1, $2, 'OpenAI publish proof', 'agent system prompt')
     on conflict (id) do nothing`,
    [AGENT, ORG],
  );
  await pool.query(
    `insert into ai_agent_versions
       (id, organization_id, agent_id, version_number, system_prompt, provider, model,
        credential_id, tool_ids, trigger_config, channel_session_id, max_steps, token_budget,
        cost_budget_cents, history_message_window, history_token_window, handoff_keywords,
        handoff_tool_enabled, cases_enabled, split_messages, split_max_chars, followup,
        multimodal_input, operator_enabled, operator_model, operator_tool_ids, composio_apps,
        status, published_at)
     values ($1, $2, $3, 1, 'agent system prompt', 'anthropic', 'claude-haiku-4-5', null,
             '{}', jsonb_build_object('events', jsonb_build_array('message')), $4, 10, 50000,
             50, 20, 8000, array['atendente'], true, false, false, 1200,
             '{"enabled": false, "flow_pointer_ids": []}'::jsonb, true, false, null, '{}', '{}',
             'published', now())
     on conflict (id) do nothing`,
    [OLD_VERSION, ORG, AGENT, SESSION],
  );
  await pool.query(`update ai_agents set published_version_id = $1 where id = $2`, [OLD_VERSION, AGENT]);
});

afterAll(async () => {
  await pool.end();
});

describe("ai agent — draft → fn_publish_ai_agent_version → loader", () => {
  it("troca para openai/gpt-5.6-terra com credential_id, sem update direto", async () => {
    await expect(
      pool.query(`update ai_agent_versions set provider = 'openai' where id = $1`, [OLD_VERSION]),
    ).rejects.toThrow(/imutável/);

    await pool.query(
      `insert into ai_agent_versions
         (id, organization_id, agent_id, version_number, system_prompt, provider, model,
          credential_id, tool_ids, trigger_config, channel_session_id, max_steps, token_budget,
          cost_budget_cents, history_message_window, history_token_window, handoff_keywords,
          handoff_tool_enabled, cases_enabled, split_messages, split_max_chars, followup,
          multimodal_input, operator_enabled, operator_model, operator_tool_ids, composio_apps,
          status, created_at)
       select $1, organization_id, agent_id, version_number + 1, system_prompt, 'openai',
              'gpt-5.6-terra', $2, tool_ids, trigger_config, channel_session_id, max_steps,
              token_budget, cost_budget_cents, history_message_window, history_token_window,
              handoff_keywords, handoff_tool_enabled, cases_enabled, split_messages,
              split_max_chars, followup, multimodal_input, operator_enabled, operator_model,
              operator_tool_ids, composio_apps, 'draft', now()
         from ai_agent_versions where id = $3`,
      [NEW_VERSION, CREDENTIAL, OLD_VERSION],
    );

    const published = await pool.query(
      `select * from fn_publish_ai_agent_version($1, $2, $3)`,
      [ORG, AGENT, NEW_VERSION],
    );
    expect(published.rowCount).toBe(1);
    expect(published.rows[0]).toMatchObject({
      agent_id: AGENT,
      version_id: NEW_VERSION,
      previous_version_id: OLD_VERSION,
    });

    const pointer = await pool.query(`select published_version_id from ai_agents where id = $1`, [AGENT]);
    expect(pointer.rows[0].published_version_id).toBe(NEW_VERSION);

    const config = await loadPublishedAgentConfig(pool, ORG, SESSION);
    expect(config).not.toBeNull();
    expect(config).toMatchObject({
      agentId: AGENT,
      versionId: NEW_VERSION,
      provider: "openai",
      model: "gpt-5.6-terra",
      credentialId: CREDENTIAL,
    });
  });
});
