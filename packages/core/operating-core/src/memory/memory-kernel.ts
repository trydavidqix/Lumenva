/**
 * Memory Kernel Core Structures
 */

// Strongly typed namespaces
export type TenantOrgNamespace = `tenant:${string}`;
export type ContactNamespace = `${TenantOrgNamespace}:contact:${string}`;
export type AgentNamespace = `${TenantOrgNamespace}:agent:${string}`;
export type SessionNamespace = `${TenantOrgNamespace}:session:${string}`;
export type ProjectNamespace = `${TenantOrgNamespace}:project:${string}`;

export type MemoryNamespace = 
  | TenantOrgNamespace
  | ContactNamespace
  | AgentNamespace
  | SessionNamespace
  | ProjectNamespace;

export interface BaseMemoryEntry {
  id: string;
  namespace: MemoryNamespace;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyMemory extends BaseMemoryEntry {
  namespace: TenantOrgNamespace;
}

export interface CustomerMemory extends BaseMemoryEntry {
  namespace: ContactNamespace;
}

export interface AgentMemory extends BaseMemoryEntry {
  namespace: AgentNamespace;
}

export interface SessionMemory extends BaseMemoryEntry {
  namespace: SessionNamespace;
}

export interface ProjectMemory extends BaseMemoryEntry {
  namespace: ProjectNamespace;
}

export interface MemoryKernelStore {
  addMemory(entry: Omit<BaseMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<BaseMemoryEntry>;
  getMemory(id: string): Promise<BaseMemoryEntry | null>;
  searchMemories(namespace: MemoryNamespace, query: string, limit?: number): Promise<BaseMemoryEntry[]>;
  updateMemory(id: string, content: string, metadata?: Record<string, unknown>): Promise<BaseMemoryEntry>;
  deleteMemory(id: string): Promise<boolean>;
}
