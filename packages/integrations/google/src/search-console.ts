export interface SearchConsoleConfig {
  siteUrl: string;
  credentialsJson: string;
}

export interface SearchConsoleQuery {
  startDate: string;
  endDate: string;
  dimensions: string[];
}

export async function querySearchConsole(config: SearchConsoleConfig, query: SearchConsoleQuery) {
  // Stub for GSC query
  throw new Error("Not implemented");
}
