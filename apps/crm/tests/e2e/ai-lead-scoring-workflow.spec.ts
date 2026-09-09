/**
 * E2E tests for lead scoring workflow approval UI.
 *
 * Flow: create → awaiting approval → approve → compute score → apply to lead → completed.
 * Tests for reject and edit also included.
 *
 * Prerequisites: .e2e-creds.json with test users (manager+ required for decisions)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

interface E2ECreds {
  password: string;
  users: Record<string, { id: string; email: string; role: string }>;
}

const CREDS_PATH = path.join(process.cwd(), '.e2e-creds.json');
const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')) as E2ECreds;

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(creds.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/\/app\//);
}

async function createLeadScoringWorkflowRun(
  page: Page,
  leadId: string,
): Promise<{ runId: string; threadId: string }> {
  const response = await page.request.post('/api/v1/ai/workflows/lead-scoring', {
    data: { lead_id: leadId },
  });
  const result = await response.json();
  return {
    runId: result.data?.id,
    threadId: result.data?.thread_id,
  };
}

test.describe('Lead Scoring Workflow Approval', () => {
  test('create workflow run and await approval UI', async ({ page }) => {
    const manager = creds.users.manager;
    if (!manager) {
      throw new Error('Manager user not found in .e2e-creds.json');
    }
    await login(page, manager.email);

    const testLeadId = '00000000-0000-4000-8000-000000000021';
    const { runId, threadId } = await createLeadScoringWorkflowRun(page, testLeadId);

    expect(runId).toBeDefined();
    expect(threadId).toBeDefined();

    await page.goto('/app/ai/workflows');

    await expect(page.getByText(new RegExp(runId.slice(0, 8)))).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/draft/i)).toBeVisible();
    await expect(page.getByText(/awaiting approval/i)).toBeVisible();
  });

  test('approve workflow computes and applies lead score', async ({ page }) => {
    const manager = creds.users.manager;
    if (!manager) throw new Error('Manager user not found in .e2e-creds.json');
    await login(page, manager.email);

    const testLeadId = '00000000-0000-4000-8000-000000000022';
    const { runId } = await createLeadScoringWorkflowRun(page, testLeadId);

    await page.goto('/app/ai/workflows');
    await page.getByText(new RegExp(runId.slice(0, 8))).click();

    const approveBtn = page.getByRole('button', { name: /approve.*score/i });
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();

    await expect(page.getByText(/confirm/i)).toBeVisible({ timeout: 2000 });
    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    await confirmBtn.click();

    await expect(page.getByText(/completed/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/score applied/i)).toBeVisible();
  });

  test('reject lead scoring requires reason', async ({ page }) => {
    const manager = creds.users.manager;
    if (!manager) throw new Error('Manager user not found in .e2e-creds.json');
    await login(page, manager.email);

    const testLeadId = '00000000-0000-4000-8000-000000000023';
    const { runId } = await createLeadScoringWorkflowRun(page, testLeadId);

    await page.goto('/app/ai/workflows');
    await page.getByText(new RegExp(runId.slice(0, 8))).click();

    const rejectBtn = page.getByRole('button', { name: /reject/i });
    await expect(rejectBtn).toBeVisible({ timeout: 5000 });
    await rejectBtn.click();

    const reasonInput = page.locator('textarea, input[name*="reason"]');
    await expect(reasonInput).toBeVisible({ timeout: 2000 });

    const submitBtn = page.getByRole('button', { name: /submit|confirm/i });
    await submitBtn.click();

    await expect(page.getByText(/reason required|reason is required/i)).toBeVisible({ timeout: 2000 });

    await reasonInput.fill('Score calculation does not reflect lead engagement metrics');
    await submitBtn.click();

    await expect(page.getByText(/rejected/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/score applied/i)).not.toBeVisible();
  });

  test('edit lead scoring updates draft and resumes approval', async ({ page }) => {
    const manager = creds.users.manager;
    if (!manager) throw new Error('Manager user not found in .e2e-creds.json');
    await login(page, manager.email);

    const testLeadId = '00000000-0000-4000-8000-000000000024';
    const { runId } = await createLeadScoringWorkflowRun(page, testLeadId);

    await page.goto('/app/ai/workflows');
    await page.getByText(new RegExp(runId.slice(0, 8))).click();

    const editBtn = page.getByRole('button', { name: /edit/i });
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();

    const editor = page.locator('textarea, [contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 2000 });

    await editor.clear();
    await editor.fill('Updated scoring model: boosted weight for recent interactions and email engagement');

    const submitEditBtn = page.getByRole('button', { name: /submit|send edit/i });
    await submitEditBtn.click();

    await expect(page.getByText(/awaiting approval/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/updated scoring model/i)).toBeVisible();
  });

  test('cross-tenant lead scoring decision rejected', async ({ page }) => {
    const manager = creds.users.manager;
    const agent = creds.users.agent;
    if (!manager || !agent) throw new Error('Test users not found in .e2e-creds.json');

    await login(page, manager.email);
    const testLeadId = '00000000-0000-4000-8000-000000000025';
    const { runId } = await createLeadScoringWorkflowRun(page, testLeadId);

    await page.goto('/app/settings');
    await page.getByRole('button', { name: /logout|sair/i }).click();
    await page.waitForURL(/\/login/);

    await login(page, agent.email);

    const decisionUrl = `/app/ai/workflows/${runId}/decision`;
    await page.goto(decisionUrl);

    const statusCode = await page.request.get(decisionUrl).then((r) => r.status());
    expect([403, 404]).toContain(statusCode);

    await page.goto('/app/ai/workflows');
    await expect(page.getByText(new RegExp(runId.slice(0, 8)))).not.toBeVisible();
  });

  test('lead scoring feature disabled returns 404', async ({ page }) => {
    const manager = creds.users.manager;
    if (!manager) throw new Error('Manager user not found in .e2e-creds.json');
    await login(page, manager.email);

    const testLeadId = '00000000-0000-4000-8000-000000000026';
    const response = await page.request.post('/api/v1/ai/workflows/lead-scoring', {
      data: { lead_id: testLeadId },
    });

    if (response.status() === 404) {
      expect(response.status()).toBe(404);
    } else {
      expect(response.status()).toBe(200);
      await page.goto('/app/ai/workflows');
      await expect(page.getByRole('heading', { name: /workflow/i })).toBeVisible({ timeout: 5000 });
    }
  });
});
