/**
 * WorkflowsClient — Proposal workflow runs UI.
 *
 * States: loading, empty, awaiting approval, completed, rejected, failed, feature disabled.
 */

'use client';

import { Button } from '@/components/ui/button';
import { useProposalWorkflows } from '@/hooks/ai/useProposalWorkflows';
import { AlertCircle, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface WorkflowsClientProps {
  userId: string;
}

export function WorkflowsClient({ userId }: WorkflowsClientProps) {
  const { runs, loading, error, submitDecision, fetchRunDetail } = useProposalWorkflows();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'awaiting' | 'completed' | 'all'>('awaiting');
  const [decidingRunId, setDecidingRunId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editBody, setEditBody] = useState('');

  const filteredRuns = runs.filter((r) => {
    if (activeTab === 'awaiting') return r.status === 'awaiting_approval';
    if (activeTab === 'completed') return ['completed', 'rejected', 'failed'].includes(r.status);
    return true;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      drafting: 'bg-blue-100 text-blue-700',
      awaiting_approval: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      sending: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
      shadow: 'bg-gray-50 text-gray-600',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'rejected':
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'awaiting_approval':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'shadow':
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
      default:
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading workflows...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 font-medium">Error loading workflows</p>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No proposal workflows yet</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('awaiting')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'awaiting'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Awaiting Approval ({runs.filter((r) => r.status === 'awaiting_approval').length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'completed'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Completed ({runs.filter((r) => ['completed', 'rejected', 'failed'].includes(r.status)).length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All ({runs.length})
        </button>
      </div>

      {/* Workflows List */}
      <div className="space-y-3">
        {filteredRuns.map((run) => (
          <div
            key={run.run_id}
            className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => setSelectedRunId(selectedRunId === run.run_id ? null : run.run_id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {getStatusIcon(run.status)}
                <div>
                  <p className="font-medium">Proposal Draft</p>
                  <p className="text-sm text-muted-foreground">Contact: {run.contact_id}</p>
                  <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(run.status)}`}>
                {run.status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Expanded View */}
            {selectedRunId === run.run_id && (
              <div className="mt-4 pt-4 border-t space-y-4">
                {/* Draft */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Proposal Draft</h4>
                  <div className="bg-gray-50 p-3 rounded text-sm text-muted-foreground max-h-64 overflow-auto font-mono whitespace-pre-wrap break-words">
                    {run.draft_payload ? JSON.stringify(run.draft_payload, null, 2) : 'No draft content'}
                  </div>
                </div>

                {/* Decision */}
                {run.decision_payload && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Decision</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm text-muted-foreground max-h-32 overflow-auto font-mono">
                      {JSON.stringify(run.decision_payload, null, 2)}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {run.status === 'awaiting_approval' && decidingRunId !== run.run_id && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setDecidingRunId(run.run_id)}
                      className="flex-1"
                    >
                      Approve & Send
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDecidingRunId(run.run_id)}
                      className="flex-1"
                    >
                      Edit Draft
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDecidingRunId(run.run_id)}
                      className="flex-1"
                    >
                      Reject
                    </Button>
                  </div>
                )}

                {/* Approval Confirm */}
                {decidingRunId === run.run_id && run.status === 'awaiting_approval' && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded">
                      ⚠️ Approving this proposal will send it to the contact immediately via WhatsApp.
                    </div>

                    <div>
                      <label className="text-sm font-medium block mb-2">Reject Reason (if rejecting)</label>
                      <textarea
                        placeholder="Optional: explain why this draft is rejected"
                        className="w-full px-3 py-2 border rounded text-sm"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium block mb-2">Edit Draft (if editing)</label>
                      <textarea
                        placeholder="Updated proposal body"
                        className="w-full px-3 py-2 border rounded text-sm font-mono"
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={5}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await submitDecision(run.run_id, 'approve');
                            setDecidingRunId(null);
                          } catch (err) {
                            console.error('Approve failed:', err);
                          }
                        }}
                        className="flex-1"
                      >
                        Approve & Send
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!editBody.trim()) {
                            alert('Please provide updated proposal text');
                            return;
                          }
                          try {
                            await submitDecision(run.run_id, 'edit', undefined, editBody);
                            setEditBody('');
                            setDecidingRunId(null);
                          } catch (err) {
                            console.error('Edit failed:', err);
                          }
                        }}
                        className="flex-1"
                      >
                        Send Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!rejectReason.trim()) {
                            alert('Please provide a reason for rejection');
                            return;
                          }
                          try {
                            await submitDecision(run.run_id, 'reject', rejectReason);
                            setRejectReason('');
                            setDecidingRunId(null);
                          } catch (err) {
                            console.error('Reject failed:', err);
                          }
                        }}
                        className="flex-1"
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDecidingRunId(null);
                          setRejectReason('');
                          setEditBody('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
