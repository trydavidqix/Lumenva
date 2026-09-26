import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

export interface KnowledgeContext {
  source: string;
  content: string;
}

export class KnowledgeLoader {
  /**
   * @param baseDir The root directory of the knowledge core (defaults to 'docs')
   */
  constructor(private readonly baseDir: string = 'docs') {}

  /**
   * Retrieves all markdown knowledge from a specific file or directory
   * @param topicPath Path relative to baseDir (e.g., 'business-rules' or 'business-rules/rule.md')
   */
  async loadTopicContext(topicPath: string): Promise<KnowledgeContext[]> {
    const fullPath = join(this.baseDir, topicPath);
    return this.readDocsRecursive(fullPath, topicPath);
  }

  private async readDocsRecursive(currentPath: string, relativePath: string): Promise<KnowledgeContext[]> {
    const contexts: KnowledgeContext[] = [];

    try {
      const stats = await stat(currentPath);

      if (stats.isFile() && extname(currentPath) === '.md') {
        const content = await readFile(currentPath, 'utf-8');
        contexts.push({ source: relativePath, content });
      } else if (stats.isDirectory()) {
        const entries = await readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const nextPath = join(currentPath, entry.name);
          const nextRelative = join(relativePath, entry.name);
          const subContexts = await this.readDocsRecursive(nextPath, nextRelative);
          contexts.push(...subContexts);
        }
      }
    } catch (error) {
      console.warn(`[KnowledgeLoader] Failed to read knowledge from ${currentPath}:`, error);
    }

    return contexts;
  }

  /**
   * Formats the loaded knowledge contexts into a string suitable for LLM prompts
   */
  formatForPrompt(contexts: KnowledgeContext[]): string {
    if (!contexts.length) {
      return '';
    }

    let formatted = '=== COMPANY KNOWLEDGE CONTEXT ===\n\n';
    for (const ctx of contexts) {
      formatted += `--- Source: ${ctx.source} ---\n`;
      formatted += `${ctx.content.trim()}\n\n`;
    }
    formatted += '===================================\n';
    
    return formatted;
  }
}
