export type CuratedContentSource = {
  key: string;
  name: string;
  provider: "rsshub";
  sourceType: "news";
  configuration: {
    route: string;
    sourceUrl: string;
  };
};

const SOURCE_CATALOG: readonly CuratedContentSource[] = [
  {
    key: "github-openai-agents-python-releases",
    name: "OpenAI Agents SDK releases",
    provider: "rsshub",
    sourceType: "news",
    configuration: {
      route: "/github/openai/openai-agents-python/releases",
      sourceUrl: "https://github.com/openai/openai-agents-python/releases",
    },
  },
  {
    key: "github-anthropics-claude-code-releases",
    name: "Claude Code releases",
    provider: "rsshub",
    sourceType: "news",
    configuration: {
      route: "/github/anthropics/claude-code/releases",
      sourceUrl: "https://github.com/anthropics/claude-code/releases",
    },
  },
  {
    key: "github-modelcontextprotocol-servers-releases",
    name: "Model Context Protocol servers releases",
    provider: "rsshub",
    sourceType: "news",
    configuration: {
      route: "/github/modelcontextprotocol/servers/releases",
      sourceUrl: "https://github.com/modelcontextprotocol/servers/releases",
    },
  },
  {
    key: "github-langchain-ai-langchain-releases",
    name: "LangChain releases",
    provider: "rsshub",
    sourceType: "news",
    configuration: {
      route: "/github/langchain-ai/langchain/releases",
      sourceUrl: "https://github.com/langchain-ai/langchain/releases",
    },
  },
  {
    key: "github-vercel-ai-releases",
    name: "Vercel AI SDK releases",
    provider: "rsshub",
    sourceType: "news",
    configuration: {
      route: "/github/vercel/ai/releases",
      sourceUrl: "https://github.com/vercel/ai/releases",
    },
  },
];

function copySource(source: CuratedContentSource): CuratedContentSource {
  return { ...source, configuration: { ...source.configuration } };
}

/** Returns only static, reviewed sources; browser supplied URLs are never accepted here. */
export function listSourceCatalog(): CuratedContentSource[] {
  return SOURCE_CATALOG.map(copySource);
}

export function getSourceCatalogEntry(key: string): CuratedContentSource | null {
  const source = SOURCE_CATALOG.find((entry) => entry.key === key);
  return source ? copySource(source) : null;
}
