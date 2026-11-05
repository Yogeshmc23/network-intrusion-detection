import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Copy, Download } from 'lucide-react';
import { historyApi, modelsApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumber, formatPercent } from '@/lib/utils';

async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is not available in this browser.');
  await navigator.clipboard.writeText(text);
}

export function HistoryPage() {
  const { toast } = useToast();
  const query = useQuery({ queryKey: ['history', 1], queryFn: () => historyApi.getHistory({ limit: 25, page: 1 }) });
  const exportCsv = async () => {
    try { const blob = await historyApi.exportCsv(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'cybershield-prediction-history.csv'; a.click(); URL.revokeObjectURL(url); }
    catch { toast({ title: 'Export unavailable', description: 'History could not be exported. Check the API connection and try again.', variant: 'destructive' }); }
  };
  return <div className="space-y-5"><div className="page-intro"><p className="eyebrow">ACCOUNT RECORDS</p><h2>Prediction history</h2><p>Only successful predictions saved by the backend appear here.</p></div><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Recent saved inferences</CardTitle><CardDescription>{query.data ? `${query.data.total.toLocaleString()} records` : 'Loading account records'}</CardDescription></div><Button variant="outline" onClick={exportCsv} disabled={!query.data?.total}><Download size={15} className="mr-2" />Export CSV</Button></CardHeader><CardContent>{query.isLoading ? <p className="py-8 text-center text-slate-400">Loading saved records…</p> : query.isError ? <div role="alert" className="error-panel">Could not load prediction history. Check your API and database connection.</div> : !query.data?.predictions.length ? <p className="empty-state">No saved predictions yet. Submit a record from the Prediction page.</p> : <div className="table-scroll"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Result</TableHead><TableHead>Class confidence</TableHead><TableHead>Model</TableHead><TableHead>Identifier</TableHead></TableRow></TableHeader><TableBody>{query.data.predictions.map((item) => <TableRow key={item.id ?? item._id}><TableCell>{item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}</TableCell><TableCell><Badge variant={item.is_anomaly ? 'danger' : 'safe'}>{item.prediction}</Badge></TableCell><TableCell>{formatPercent(item.confidence)}</TableCell><TableCell>{item.model_name ?? '—'}</TableCell><TableCell><button className="copy-inline" type="button" onClick={async () => { try { await copyText(item.id ?? item._id); toast({ title: 'Copied', description: 'Prediction identifier copied.', variant: 'success' }); } catch { toast({ title: 'Copy failed', description: 'Select and copy the identifier manually.', variant: 'destructive' }); } }}><Copy size={13} />{(item.id ?? item._id).slice(0, 12)}…</button></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card></div>;
}

export function LiveMonitorPage() {
  return <div className="space-y-5">
    <div className="page-intro"><p className="eyebrow">LIVE SOURCE STATUS</p><h2>Live monitor</h2><p>CyberShield does not currently have a network capture or event source configured.</p></div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Activity size={18} />Monitoring unavailable</CardTitle><CardDescription>No incoming packets are being observed or classified.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <p className="error-panel" role="status">The former demo stream generated synthetic traffic records. It is disabled so generated examples cannot be mistaken for real detections.</p>
        <p className="text-sm text-slate-400">You can still submit a record or CSV from Prediction for an actual model inference. To enable live monitoring, connect a trusted packet-capture or event-ingestion source to the backend.</p>
      </CardContent>
    </Card>
  </div>;
}

export function FeaturesPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['featureImportance'], queryFn: modelsApi.getFeatureImportance, staleTime: 300000 });
  const rows = data?.sorted ?? [];
  return <div className="space-y-5"><div className="page-intro"><p className="eyebrow">MODEL EXPLANATION</p><h2>Feature importance</h2><p>Permutation importance reports mean decrease in holdout F1; it is not a causal explanation.</p></div><Card><CardHeader><CardTitle>{data?.model_name ?? 'Active model'} · ranked inputs</CardTitle><CardDescription>{data?.total_features_evaluated ? `${data.total_features_evaluated} input features evaluated` : 'Values are provided by the ML-service artifact.'}</CardDescription></CardHeader><CardContent>{isLoading ? <p className="py-8 text-center text-slate-400">Loading model feature rankings…</p> : isError ? <p role="alert" className="error-panel">Feature ranking is unavailable from the ML service.</p> : !rows.length ? <p className="empty-state">No feature ranking is present in the model artifacts.</p> : <div className="feature-ranking">{rows.map((row: any, index: number) => <div key={row.feature} className="feature-row"><div><strong>{row.feature}</strong><span>{row.description ?? 'NSL-KDD input feature'}</span></div><code>{Number(row.importance).toFixed(6)}</code><span className="feature-track"><i style={{ width: `${Math.max(1, Math.min(100, Number(row.importance) / Math.max(...rows.map((r: any) => Number(r.importance)), 0.000001) * 100))}%` }} /></span><small>#{row.rank ?? index + 1}</small></div>)}</div>}</CardContent></Card></div>;
}
