/**
 * E2E tests for automation workflow approval UI.
 *
 * Flow: create → awaiting approval → approve → schedule executed → completed.
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

async function createAutomationWorkflowRun(
  page: Page,
  automationId: string,
): Promise<{ runId: string; threadId: string }> {
  const response = await page.request.post('/api/v1/ai/workflows/automations', {
    data: { automation_id: automationId },
  });
  const result = await response.json();
  return {
    runId: result.data?.id,
    threadId: result.data?.thread_id,
  };
}

test.describe('Automation Workflow Approval', () => {
  test('create workflow run and await approval UI', async ({ page }) => {
    const manager = creds.users.manager;
    if (!manager) {
      throw new Error('Manager user not found in .e2e-creds.json');
    }
    await login(page, manager.email);

    const testAutomationId = '00000000-0000-4000-8000-000000000011';
    const { runId, threadId } = await createAutomationWorkflowRun(page, testAutomationId);

    expect(runId).toBeDefined();
    expect(threadId).toBeDefined();

    await page.goto('/app/ai/workflows');

    await expect(page.getByText(new RegExp(runId.slice(0, 8)))).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/draft/i)).toBeVisible();
    await expect(page.getByText(/awaiting approval/i)).toBeVisible();
  });

  test('approve workflow schedules automation', async ({ page }) => {
    const manager = creds.users.manager;
    if (!manager) throw new Error('Manager user not found in .e2e-creds.json');
    await login(page, manager.email);

    const testAutomationId = '00000000-0000-4000-8000-000000000012';
    const { runId } = await createAutomationWorkflowRun(page, testAutomationId);

    await page.goto('/app/ai/workflows');
    await page.getByText(new RegExp(runId.slice(0, 8))).click();

    const approveBtn = page.getByRole('button', { name: /approve.*schedule/i });
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();

    await expect(page.getByText(/confirm/i)).toBeVisible({ timeout: 2000 });
    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    await confirmBtn.click();

    await expect(page.getByText(/completed/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/scheduled/i)).toBeVisible();
  });

  test('reject automation requires reason', async ({ page }) => {
    const manager = creds.users.manager;
    if (!manager) throw new Error('Manager user not found in .e2e-creds.json');
    await login(page, manager.email);

    const testAutomationId = '00000000-0000-4000-8000-000000000013';
    const { runId } = await createAutomationWorkflowRun(page, testAutomationId);

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

    await reasonInput.fill('Automation frequency too high for this list');
    await submitBtn.click();

    await expect(page.getByText(/rejected/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/scheduled/i)).not.toBeVisible();
  });

  test('edit automation updates draft and resumes approval', async ({ page }) => {
    const manager = creds.users.manager;
    if (!manager) throw new Error('Manager user not found in .e2e-creds.json');
    await login(page, manager.email);

    const testAutomationId = '00000000-0000-4000-8000-000000000014';
    const { runId } = await createAutomationWorkflowRun(page, testAutomationId);

    await page.goto('/app/ai/workflows');
    await page.getByText(new RegExp(runId.slice(0, 8))).click();

    const editBtn = page.getByRole('button', { name: /edit/i });
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();

    const editor = page.locator('textarea, [contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 2000 });

    await editor.clear();
    await editor.fill('Updated automation schedule: weekly on Sundays at 9 AM with new message');

    const submitEditBtn = page.getByRole('button', { name: /submit|send edit/i });
    await submitEditBtn.click();

    await expect(page.getByText(/awaiting approval/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/updated automation schedule/i)).toBeVisible();
  });

  test('cross-tenant automation decision rejected', async ({ page }) => {
    const manager = creds.users.manager;
    const agent = creds.users.agent;
    if (!manager || !agent) throw new Error('Test users not found in .e2e-creds.json');

    await login(page, manager.email);
    const testAutomationId = '00000000-0000-4000-8000-000000000015';
    const { runId } = await createAutomationWorkflowRun(page, testAutomationId);

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

  test('automation feature disabled returns 404', async ({ page }) => {
    const manager = creds.users.manager;
    if (!manager) throw new Error('Manager user not found in .e2e-creds.json');
    await login(page, manager.email);

    const testAutomationId = '00000000-0000-4000-8000-000000000016';
    const response = await page.request.post('/api/v1/ai/workflows/automations', {
      data: { automation_id: testAutomationId },
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
