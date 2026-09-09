/**
 * /app/ai/workflows — Proposal workflow runs management page.
 *
 * Lists awaiting/completed workflow runs, displays proposal drafts, and handles
 * manager approval/edit/reject decisions.
 */

import { requireAuth } from '@/lib/auth/server';
import { WorkflowsClient } from './_client';

export const metadata = {
  title: 'Proposal Workflows — Lumenva',
  description: 'Manage AI-generated proposal approvals',
};

export default async function WorkflowsPage() {
  const user = await requireAuth();

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Proposal Workflows</h1>
        <p className="text-muted-foreground mt-2">
          Manage AI-generated proposal drafts and approval requests.
        </p>
      </div>

      <WorkflowsClient userId={user.id} />
    </div>
  );
}
