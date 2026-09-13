import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HermesLearningPanel } from '@/components/ai/HermesLearningPanel';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HermesLearningPanel', () => {
  it('renders populated governed learning summary without raw evidence payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              candidates: 3,
              experiments: 4,
              outcomes: 7,
              safety_rollbacks: 1,
              recurring_failures: [{ signature: 'tool_timeout', count: 2 }],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    render(<HermesLearningPanel />);
    expect(screen.getByText('Carregando aprendizado…')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Hermes Learning OS')).toBeInTheDocument());
    expect(screen.getByText('tool_timeout')).toBeInTheDocument();
    expect(screen.getByText('READ ONLY')).toBeInTheDocument();
    expect(screen.queryByText(/raw transcript/i)).not.toBeInTheDocument();
  });

  it('renders an empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 })),
    );
    render(<HermesLearningPanel />);
    await waitFor(() =>
      expect(screen.getByText('Ainda não há evidência de aprendizado para esta organização.')).toBeInTheDocument(),
    );
  });

  it('renders an error state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    render(<HermesLearningPanel />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('HTTP 500'));
  });
});
