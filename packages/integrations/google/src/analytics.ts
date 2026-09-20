export interface GA4Config {
  propertyId: string;
  credentialsJson: string;
}

export interface AnalyticsReportRequest {
  dateRanges: { startDate: string; endDate: string }[];
  metrics: { name: string }[];
  dimensions: { name: string }[];
}

export async function runGA4Report(config: GA4Config, request: AnalyticsReportRequest) {
  // Stub for GA4 runReport
  throw new Error("Not implemented");
}
