import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, ArrowUpRight, Database, ShieldAlert, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PredictionPieChart } from '@/components/charts/PredictionPieChart';
import { MetricsBarChart } from '@/components/charts/MetricsBarChart';
import { historyApi, modelsApi, ModelMetricItem } from '@/lib/api';
import { formatNumber, formatPercent } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const stats = useQuery({ queryKey: ['historyStats'], queryFn: historyApi.getStats, staleTime: 10000 });
  const recent = useQuery({ queryKey: ['recentHistory'], queryFn: () => historyApi.getHistory({ limit: 5 }), staleTime: 10000 });
  const metrics = useQuery({ queryKey: ['modelMetrics'], queryFn: async () => (await modelsApi.getMetrics()).models, staleTime: 60000 });
  const metadata = useQuery({ queryKey: ['modelMetadata'], queryFn: modelsApi.getMetadata, staleTime: 300000 });
  const account = stats.data;
  const benchmarkRows = (metrics.data ?? []).filter((item: ModelMetricItem) => item.dataset.toLowerCase().includes('holdout'));
  const benchmark = benchmarkRows.find((item) => item.model === metadata.data?.model_name && (item.feature_set ?? 'All features') === (metadata.data?.feature_set ?? 'All features'));
  const lastUpdated = metadata.data?.artifact_updated_at;
  const chartData = benchmarkRows.map((item) => ({ model: `${item.model} · ${item.feature_set === 'All features' ? 'All' : 'Top 30'}`, accuracy: item.accuracy, precision: item.precision, recall: item.recall, f1: item.f1, rocAuc: item.roc_auc }));
  const recentRecords = recent.data?.predictions ?? [];

  return <div className="space-y-5">
    <section className="dashboard-intro">
      <div><p className="eyebrow">CYBERSHIELD IDS / OVERVIEW</p><h2>Threat operations</h2><p>Account inference activity and offline model evaluation, kept distinct.</p></div>
      <div className="dashboard-actions"><Button onClick={() => navigate('/predict')}><ShieldAlert size={16} className="mr-2" />New prediction</Button><Button variant="outline" onClick={() => navigate('/live')}><Activity size={16} className="mr-2" />Live source status</Button></div>
    </section>

    <div className="dashboard-metrics">
      <Card><CardHeader className="metric-card-heading"><CardTitle>Saved predictions</CardTitle><Database size={17} /></CardHeader><CardContent><strong className="metric-value">{stats.isLoading ? '—' : account ? formatNumber(account.total) : 'Unavailable'}</strong><p>Records stored for your account</p></CardContent></Card>
      <Card><CardHeader className="metric-card-heading"><CardTitle>Flagged anomalous</CardTitle><ShieldAlert size={17} /></CardHeader><CardContent><strong className="metric-value">{stats.isLoading ? '—' : account ? formatNumber(account.anomalyCount) : 'Unavailable'}</strong><p>{account && account.total ? `${formatPercent(account.anomalyCount / account.total, 1)} of saved predictions` : 'No saved predictions yet'}</p></CardContent></Card>
      <Card><CardHeader className="metric-card-heading"><CardTitle>Holdout accuracy</CardTitle><TrendingUp size={17} /></CardHeader><CardContent><strong className="metric-value">{metrics.isLoading ? '—' : benchmark ? formatPercent(benchmark.accuracy, 2) : '—'}</strong><p>{benchmark ? `${benchmark.model} · stratified holdout` : 'No benchmark result available'}</p></CardContent></Card>
      <Card><CardHeader className="metric-card-heading"><CardTitle>Holdout recall</CardTitle><Activity size={17} /></CardHeader><CardContent><strong className="metric-value">{metrics.isLoading ? '—' : benchmark ? formatPercent(benchmark.recall, 2) : '—'}</strong><p>Evaluation result; not a live detection rate</p></CardContent></Card>
    </div>

    {(stats.isError || recent.isError || metrics.isError || metadata.isError) && <div role="status" className="error-panel">Some dashboard data could not be reached. Values are not replaced with sample or benchmark guesses; retry when the API is available.</div>}

    <div className="dashboard-panels">
      <Card><CardHeader className="section-card-heading"><div><CardTitle>Model evaluation</CardTitle><CardDescription>Actual API-reported stratified holdout results</CardDescription></div><Button variant="ghost" size="sm" onClick={() => navigate('/models')}>Details <ArrowUpRight size={14} className="ml-1" /></Button></CardHeader><CardContent>{metrics.isLoading ? <div className="skeleton-chart" aria-label="Loading benchmark data" /> : chartData.length ? <MetricsBarChart data={chartData} height={265} /> : <p className="empty-state">Evaluation metrics are not available from the ML service.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Your saved result split</CardTitle><CardDescription>Aggregated from successful account history records only</CardDescription></CardHeader><CardContent>{stats.isLoading ? <div className="skeleton-chart" /> : account?.total ? <PredictionPieChart normalCount={account.normalCount} anomalyCount={account.anomalyCount} size={190} /> : <p className="empty-state">No account predictions to chart yet.</p>}</CardContent></Card>
    </div>

    <Card><CardHeader className="section-card-heading"><div><CardTitle>Recent predictions</CardTitle><CardDescription>Most recently stored records, not incoming network packets</CardDescription></div><Button variant="outline" size="sm" onClick={() => navigate('/history')}>Full history <ArrowRight size={14} className="ml-1" /></Button></CardHeader><CardContent>{recent.isLoading ? <p className="empty-state">Loading saved records…</p> : recent.isError ? <p role="alert" className="error-panel">Could not load saved prediction history.</p> : !recentRecords.length ? <div className="empty-state">No predictions saved for this account.<br /><Button className="mt-3" variant="outline" size="sm" onClick={() => navigate('/predict')}>Create a prediction</Button></div> : <div className="table-scroll"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Protocol</TableHead><TableHead>Service</TableHead><TableHead>Bytes (source / destination)</TableHead><TableHead>Result</TableHead><TableHead>Class confidence</TableHead></TableRow></TableHeader><TableBody>{recentRecords.map((item) => <TableRow key={item.id ?? item._id}><TableCell>{item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}</TableCell><TableCell>{item.features.protocol_type ?? '—'}</TableCell><TableCell>{item.features.service ?? '—'}</TableCell><TableCell>{formatNumber(Number(item.features.src_bytes ?? 0))} / {formatNumber(Number(item.features.dst_bytes ?? 0))}</TableCell><TableCell><Badge variant={item.is_anomaly ? 'danger' : 'safe'}>{item.prediction}</Badge></TableCell><TableCell>{formatPercent(item.confidence)}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>

    <p className="data-freshness">{metadata.isLoading ? 'Checking model artifact timestamp…' : lastUpdated ? `Model artifact last modified ${new Date(lastUpdated).toLocaleString()}` : 'Model artifact update time is not available.'}</p>
  </div>;
}
