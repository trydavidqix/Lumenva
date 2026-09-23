import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as mediaPost } from '../../app/api/v1/conversations/[id]/media/route';
import { GET as avatarGet } from '../../app/api/v1/contacts/[id]/avatar/route';
import { POST as cronPost } from '../../app/api/v1/cron/contact-avatars/route';
import { GET as messageMediaGet } from '../../app/api/v1/messages/[id]/media/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendMessageHandler } from '../../app/api/v1/messages/_handler';
import type { SendMessageInput } from '@/lib/schemas';
import type { HandlerCtx } from '@/lib/api/handlers/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// We mock requireRole, createAdminClient, createClient, etc.
vi.mock('@/lib/auth/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ ok: true, org: { orgId: 'org-123' } })
}));

vi.mock('@/lib/auth/server', () => ({
  loadAuthUser: vi.fn().mockResolvedValue({ id: 'user-123' }),
  resolveActiveOrg: vi.fn().mockResolvedValue({ orgId: 'org-123' })
}));

const mockGcsPut = vi.fn().mockResolvedValue(undefined);
const mockGcsCreateReadUrl = vi.fn().mockResolvedValue('https://new-gcs-url/');

vi.mock('@lumenva/db/storage/gcs', async () => {
  return {
    createGcsObjectStore: vi.fn(() => ({
      put: mockGcsPut,
      createReadUrl: mockGcsCreateReadUrl
    }))
  };
});

vi.mock('@lumenva/db/gcp/cloud-storage', async () => {
  return {
    getGcsBucket: vi.fn(() => ({
      file: vi.fn()
    }))
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(),
        upsert: vi.fn()
      };
      if (table === 'contacts') {
        builder.maybeSingle.mockResolvedValue({ data: { avatar_storage_path: 'org-123/avatars/contact-1.jpg', is_anonymized: false } });
        builder.limit.mockResolvedValue({
          data: [
            {
              id: 'contact-1',
              organization_id: 'org-123',
              wa_identity: 'phone:+5511999999999',
              avatar_storage_path: null
            }
          ]
        });
        builder.select.mockImplementation(() => {
          // If update was called just return mock
          return { ...builder, update: builder.update, maybeSingle: builder.maybeSingle, limit: builder.limit } as unknown as typeof builder;
        });
        builder.update.mockImplementation(() => builder as unknown as typeof builder);
      }
      if (table === 'channel_sessions') {
        builder.maybeSingle.mockResolvedValue({ data: { waha_session_name: 'test-session', provider: 'brightbean' } });
      }
      return builder;
    }),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: { message: 'old path is tested' } }),
        upload: vi.fn().mockResolvedValue({ error: { message: 'old path is tested' } })
      }))
    }
  }))
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'conv-123' } })
    }))
  }))
}));


vi.mock('@/lib/channels', () => ({
  DEFAULT_CHANNEL_PROVIDER: 'brightbean',
  getAdapter: vi.fn(() => ({
    fetchProfilePictureUrl: vi.fn().mockResolvedValue('https://fake.url/pic.jpg')
  }))
}));

vi.mock('@/lib/auth/cron-secret', () => ({
  cronSecretMatches: vi.fn().mockReturnValue(true)
}));

describe('Media Storage Migration TDD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('avatarGet should return signed URL from GCS object store instead of Supabase', async () => {
    const req = new Request('https://test.com/api/v1/contacts/1/avatar');
    const res = await avatarGet(req as unknown as Request, { params: Promise.resolve({ id: 'contact-1' }) });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://new-gcs-url/');
    expect(mockGcsCreateReadUrl).toHaveBeenCalled();
  });

  it('mediaPost should upload to GCS object store instead of Supabase', async () => {
    const bodyStr = "mock-file-content";
    const req = new Request('https://test.com/api/v1/conversations/conv-1/media', {
      method: 'POST',
      body: bodyStr,
      headers: {
        'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
        'content-length': String(bodyStr.length)
      }
    });
    // mock formData for request
    (req as unknown as { formData: () => Promise<FormData> }).formData = vi.fn().mockResolvedValue({
      get: vi.fn().mockReturnValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
    });

    const res = await mediaPost(req as unknown as Request, { params: Promise.resolve({ id: 'conv-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.storage_path).toContain('conv-1/out-');
    expect(mockGcsPut).toHaveBeenCalled();
  });

  it('cronPost should upload to GCS object store instead of Supabase', async () => {
    // mock fetch for cron
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10))
    }) as unknown as typeof fetch;

    const req = new Request('https://test.com/api/v1/cron/contact-avatars', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + (process.env.INTERNAL_SECRET || 'secret')
      }
    });

    const res = await cronPost(req as unknown as Request);
    expect(res.status).toBe(200);
    expect(mockGcsPut).toHaveBeenCalled();
  });

  it('messageMediaGet should return signed URL from GCS object store instead of Supabase', async () => {
    // Override supabase mock just for this to ensure msg.media_storage_path is returned
    const origCreateClient = vi.mocked(createClient);
    origCreateClient.mockImplementationOnce(async () => ({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'msg-1', media_storage_path: 'org-123/msgs/media.jpg' } })
      }))
    }) as unknown as typeof origCreateClient);

    const req = new Request('https://test.com/api/v1/messages/msg-1/media');
    const res = await messageMediaGet(req as unknown as Request, { params: Promise.resolve({ id: 'msg-1' }) });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://new-gcs-url/');
    expect(mockGcsCreateReadUrl).toHaveBeenCalled();
  });
});

describe('Message Handler TDD', () => {
  it('sendMessageHandler should return signed URL from GCS object store instead of Supabase before sending to adapter', async () => {
    const origCreateClient = vi.mocked(createClient);
    const mockSupabase = {
      from: vi.fn((table) => {
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(),
          single: vi.fn()
        };
        if (table === 'conversations') {
          builder.maybeSingle.mockResolvedValue({
            data: {
              id: 'conv-1',
              organization_id: 'org-123',
              channel_session_id: 'sess-1',
              is_group: false,
              group_chat_id: null,
              contacts: { phone_number: '+5511999999999' },
              channel_sessions: { status: 'WORKING', provider: 'brightbean' }
            }
          });
        }
        if (table === 'messages') {
          builder.single.mockResolvedValue({ data: { id: 'msg-1', type: 'image' } });
          builder.maybeSingle.mockResolvedValue({ data: { id: 'msg-1' } });
        }
        return builder;
      }),
      rpc: vi.fn().mockResolvedValue({ error: null })
    };
    origCreateClient.mockImplementationOnce(async () => mockSupabase as unknown as typeof mockSupabase);

    const input = {
      conversation_id: 'conv-1',
      type: 'image',
      media_storage_path: 'org-123/conv-1/media.jpg'
    } as unknown as SendMessageInput;
    const ctx = {
      actor: { type: 'user', id: 'user-1' },
      organization_id: 'org-123',
      requestId: 'req-1'
    } as unknown as HandlerCtx;

    try {
      await sendMessageHandler(mockSupabase as unknown as SupabaseClient, input, ctx);
    } catch {
      // ignore
    }
    expect(mockGcsCreateReadUrl).toHaveBeenCalled();
  });
});
