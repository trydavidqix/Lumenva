export interface IngestionDocument {
  text: string;
  metadata: {
    organizationId: string;
    sourceId: string;
    sourceVersion: string;
    title: string;
  };
}

export interface IngestionNode {
  text: string;
  position: number;
  metadata: Record<string, string | number | boolean | null>;
}

export interface KnowledgeIngestionPort {
  normalize(document: IngestionDocument): Promise<IngestionNode[]>;
}
