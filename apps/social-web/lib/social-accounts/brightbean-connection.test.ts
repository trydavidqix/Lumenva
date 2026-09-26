import { describe, expect, it } from 'vitest'

import { buildBrightBeanConnectionUrl } from './brightbean-connection'

describe('buildBrightBeanConnectionUrl', () => {
  it('builds the BrightBean workspace connection page from a configured base URL', () => {
    expect(
      buildBrightBeanConnectionUrl({
        baseUrl: 'https://social.example.com/',
        workspaceId: '831e88b5-087e-4fd3-a7d3-a17510fb5f12',
      }),
    ).toBe('https://social.example.com/social-accounts/831e88b5-087e-4fd3-a7d3-a17510fb5f12/connect/')
  })

  it('preserves a configured base path', () => {
    expect(
      buildBrightBeanConnectionUrl({
        baseUrl: 'https://social.example.com/studio/',
        workspaceId: '831e88b5-087e-4fd3-a7d3-a17510fb5f12',
      }),
    ).toBe('https://social.example.com/studio/social-accounts/831e88b5-087e-4fd3-a7d3-a17510fb5f12/connect/')
  })

  it('drops configured query strings and fragments from the handoff URL', () => {
    expect(
      buildBrightBeanConnectionUrl({
        baseUrl: 'https://social.example.com/studio/?debug=true#section',
        workspaceId: '831e88b5-087e-4fd3-a7d3-a17510fb5f12',
      }),
    ).toBe('https://social.example.com/studio/social-accounts/831e88b5-087e-4fd3-a7d3-a17510fb5f12/connect/')
  })

  it('rejects non-http protocols', () => {
    expect(() =>
      buildBrightBeanConnectionUrl({
        baseUrl: 'javascript:alert(1)',
        workspaceId: '831e88b5-087e-4fd3-a7d3-a17510fb5f12',
      }),
    ).toThrow('BrightBean base URL must use http or https')
  })

  it('rejects base URLs containing embedded credentials', () => {
    expect(() =>
      buildBrightBeanConnectionUrl({
        baseUrl: 'https://user:secret@social.example.com',
        workspaceId: '831e88b5-087e-4fd3-a7d3-a17510fb5f12',
      }),
    ).toThrow('BrightBean base URL cannot contain credentials')
  })

  it('rejects an empty BrightBean workspace id', () => {
    expect(() =>
      buildBrightBeanConnectionUrl({
        baseUrl: 'https://social.example.com',
        workspaceId: '   ',
      }),
    ).toThrow('BrightBean workspace id is required')
  })

  it('rejects a non-UUID workspace id including path traversal attempts', () => {
    expect(() =>
      buildBrightBeanConnectionUrl({
        baseUrl: 'https://social.example.com',
        workspaceId: '../admin',
      }),
    ).toThrow('BrightBean workspace id must be a UUID')
  })
})
