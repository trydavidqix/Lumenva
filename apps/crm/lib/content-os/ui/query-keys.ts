export const contentOsQueryKeys = {
  all: ["content-os"] as const,
  opportunities: () => ["content-os", "opportunities"] as const,
  sources: () => ["content-os", "sources"] as const,
  scripts: (filters?: Record<string, string | undefined>) => ["content-os", "scripts", filters ?? {}] as const,
  hooks: (filters?: Record<string, string | undefined>) => ["content-os", "hooks", filters ?? {}] as const,
  creators: (filters?: Record<string, string | undefined>) => ["content-os", "creators", filters ?? {}] as const,
  media: (filters?: Record<string, string | undefined>) => ["content-os", "media", filters ?? {}] as const,
  publications: (from?: string, to?: string) => ["content-os", "publications", { from, to }] as const,
} as const;

