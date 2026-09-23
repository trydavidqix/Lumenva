import { redact } from './redact';

export interface LogEntry {
  message: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  request_id?: string;
  trace_id?: string;
  organization_id?: string;
  [key: string]: any;
}

function formatLogEntry(entry: LogEntry): string {
  // Map our level to GCP severity
  const severityMap: Record<string, string> = {
    debug: 'DEBUG',
    info: 'INFO',
    warn: 'WARNING',
    error: 'ERROR',
  };

  const severity = severityMap[entry.level] || 'DEFAULT';

  // Redact sensitive data from the entire entry
  const redactedEntry = redact(entry);

  const payload = {
    ...redactedEntry,
    severity,
    // Add GCP specific trace field if provided
    ...(entry.trace_id ? { 'logging.googleapis.com/trace': entry.trace_id } : {}),
  };

  // GCP logging agent picks up timestamp automatically, but we can add it
  payload.timestamp = new Date().toISOString();

  return JSON.stringify(payload);
}

export const logger = {
  debug: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = { message, level: 'debug', ...context };
    process.stdout.write(formatLogEntry(entry) + '\n');
  },
  info: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = { message, level: 'info', ...context };
    process.stdout.write(formatLogEntry(entry) + '\n');
  },
  warn: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = { message, level: 'warn', ...context };
    process.stdout.write(formatLogEntry(entry) + '\n');
  },
  error: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = { message, level: 'error', ...context };
    process.stderr.write(formatLogEntry(entry) + '\n');
  },
};
