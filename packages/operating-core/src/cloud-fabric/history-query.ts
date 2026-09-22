import type { RoutingObservation } from './learning-router';
export type HistoryWindow='TODAY'|'7D'|'30D'|'ALL';
export interface TimestampedObservation extends RoutingObservation{created_at:string}
export function filterHistory<T extends {created_at:string}>(rows:T[],window:HistoryWindow,now=Date.now()):T[]{if(window==='ALL')return[...rows];const days=window==='TODAY'?1:window==='7D'?7:30;const cutoff=now-days*86400000;return rows.filter(r=>Date.parse(r.created_at)>=cutoff)}
