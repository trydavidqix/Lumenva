export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube'

export type SocialAccountStatus = 'active' | 'disabled'

export type SocialAccount = {
  provider: string
  providerAccountId: string
  externalAccountId: string | null
  platform: SocialPlatform
  displayName: string | null
  status: SocialAccountStatus
}

export type StoredSocialAccount = SocialAccount & {
  id: string
  workspaceId: string
}
