import type { ScenarioStatus } from "../contracts/scenario";
import { assertScenarioTransition } from "./state-machine";

export interface ScenarioRepositoryDb {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface CreateScenarioInput {
  title?: string;
  question: string;
  decisionVariables: Record<string, unknown>;
  constraints: Record<string, unknown>;
  budget: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateScenarioDraftInput {
  title?: string;
  question?: string;
  decisionVariables?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  budget?: Record<string, unknown>;
}

export interface ScenarioRepository {
  createScenario(organizationId: string, input: CreateScenarioInput): Promise<Record<string, unknown>>;
  getScenario(organizationId: string, scenarioId: string): Promise<Record<string, unknown> | null>;
  listScenarios(organizationId: string, limit?: number): Promise<Array<Record<string, unknown>>>;
  updateDraft(organizationId: string, scenarioId: string, input: UpdateScenarioDraftInput): Promise<Record<string, unknown>>;
  transitionScenario(
    organizationId: string,
    scenarioId: string,
    expectedStatus: ScenarioStatus,
    nextStatus: ScenarioStatus,
  ): Promise<Record<string, unknown>>;
  requestRun(organizationId: string, scenarioId: string, requestId: string): Promise<Record<string, unknown>>;
}

function first(rows: Array<Record<string, unknown>>): Record<string, unknown> | null {
  return rows[0] ?? null;
}

export function createScenarioRepository(db: ScenarioRepositoryDb): ScenarioRepository {
  return {
    async createScenario(organizationId, input) {
      const { rows } = await db.query(
        `with created as (
           insert into scenario_definitions
             (organization_id, title, question, decision_variables, constraints, budget, created_by)
           values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
           returning *
         ), logged as (
           insert into event_log
             (organization_id, event_type, entity_kind, entity_id, payload, metadata)
           select
             organization_id,
             'scenario.created',
             'scenario',
             id,
             jsonb_build_object('status', status, 'question', question),
             jsonb_build_object('synthetic', false, 'source', 'scenario_lab')
           from created
           returning id
         )
         select created.* from created cross join logged`,
        [
          organizationId,
          input.title ?? null,
          input.question,
          JSON.stringify(input.decisionVariables),
          JSON.stringify(input.constraints),
          JSON.stringify(input.budget),
          input.createdBy ?? null,
        ],
      );
      const row = first(rows);
      if (!row) throw new Error("Scenario creation did not return a row.");
      return row;
    },

    async getScenario(organizationId, scenarioId) {
      const { rows } = await db.query(
        `select * from scenario_definitions
         where organization_id = $1 and id = $2
         limit 1`,
        [organizationId, scenarioId],
      );
      return first(rows);
    },

    async listScenarios(organizationId, limit = 50) {
      const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
      const { rows } = await db.query(
        `select * from scenario_definitions
         where organization_id = $1
         order by updated_at desc
         limit $2`,
        [organizationId, safeLimit],
      );
      return rows;
    },

    async updateDraft(organizationId, scenarioId, input) {
      const { rows } = await db.query(
        `with changed as (
           update scenario_definitions
              set title = coalesce($3, title),
                  question = coalesce($4, question),
                  decision_variables = coalesce($5::jsonb, decision_variables),
                  constraints = coalesce($6::jsonb, constraints),
                  budget = coalesce($7::jsonb, budget),
                  updated_at = now()
            where id = $1
              and organization_id = $2
              and status = 'DRAFT'
            returning *
         ), logged as (
           insert into event_log
             (organization_id, event_type, entity_kind, entity_id, payload, metadata)
           select organization_id, 'scenario.updated', 'scenario', id,
                  jsonb_build_object('status', status),
                  jsonb_build_object('synthetic', false, 'source', 'scenario_lab')
             from changed
           returning id
         )
         select changed.* from changed cross join logged`,
        [
          scenarioId,
          organizationId,
          input.title ?? null,
          input.question ?? null,
          input.decisionVariables === undefined ? null : JSON.stringify(input.decisionVariables),
          input.constraints === undefined ? null : JSON.stringify(input.constraints),
          input.budget === undefined ? null : JSON.stringify(input.budget),
        ],
      );
      const row = first(rows);
      if (!row) throw new Error(`Scenario update conflict for ${scenarioId}: expected DRAFT.`);
      return row;
    },

    async transitionScenario(organizationId, scenarioId, expectedStatus, nextStatus) {
      assertScenarioTransition(expectedStatus, nextStatus);
      const { rows } = await db.query(
        `with changed as (
           update scenario_definitions
              set status = $4,
                  updated_at = now(),
                  completed_at = case when $4 = 'COMPLETED' then now() else completed_at end
            where id = $1
              and organization_id = $2
              and status = $3
            returning *
         ), logged as (
           insert into event_log
             (organization_id, event_type, entity_kind, entity_id, payload, metadata)
           select
             organization_id,
             'scenario.status_changed',
             'scenario',
             id,
             jsonb_build_object('from', $3, 'to', status),
             jsonb_build_object('synthetic', false, 'source', 'scenario_lab')
           from changed
           returning id
         )
         select changed.* from changed cross join logged`,
        [scenarioId, organizationId, expectedStatus, nextStatus],
      );
      const row = first(rows);
      if (!row) {
        throw new Error(`Scenario transition conflict for ${scenarioId}: expected ${expectedStatus}.`);
      }
      return row;
    },

    async requestRun(organizationId, scenarioId, requestId) {
      const { rows } = await db.query(
        `with changed as (
           update scenario_definitions
              set status = 'RUNNING',
                  updated_at = now()
            where id = $1
              and organization_id = $2
              and status = 'READY'
            returning *
         ), logged as (
           insert into event_log
             (organization_id, event_type, entity_kind, entity_id, payload, metadata)
           select
             organization_id,
             'scenario.run_requested',
             'scenario',
             id,
             jsonb_build_object('status', status),
             jsonb_build_object(
               'synthetic', false,
               'source', 'scenario_lab',
               'request_id', $3,
               'idempotency_key', concat('scenario.run_requested:', id::text, ':', $3)
             )
           from changed
           returning id as run_request_event_id
         )
         select changed.*, logged.run_request_event_id
           from changed cross join logged`,
        [scenarioId, organizationId, requestId],
      );
      const row = first(rows);
      if (!row) {
        throw new Error(`Scenario run request conflict for ${scenarioId}: expected READY.`);
      }
      return row;
    },
  };
}
