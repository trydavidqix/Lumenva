import type { SqlExecutor } from './postgres-persistence';
import type { HistoryWindow } from './history-query';
function interval(window:HistoryWindow):string|undefined{return window==='TODAY'?'1 day':window==='7D'?'7 days':window==='30D'?'30 days':undefined}
export class PostgresHistoryReader{constructor(private readonly db:SqlExecutor){}
async executions(window:HistoryWindow){const i=interval(window);const sql=i?'select payload from maestri_executions where created_at >= now() - $1::interval order by created_at desc':'select payload from maestri_executions order by created_at desc';return (await this.db.query<{payload:unknown}>(sql,i?[i]:[])).rows.map(r=>r.payload)}
async traces(window:HistoryWindow){const i=interval(window);const sql=i?'select payload from maestri_routing_traces where created_at >= now() - $1::interval order by created_at desc':'select payload from maestri_routing_traces order by created_at desc';return (await this.db.query<{payload:unknown}>(sql,i?[i]:[])).rows.map(r=>r.payload)}
}
