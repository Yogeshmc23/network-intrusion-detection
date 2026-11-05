import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Layers } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ConfusionMatrix } from '@/components/charts/ConfusionMatrix';
import { modelsApi, ModelMetricItem } from '@/lib/api';
import { formatPercent, formatMetric } from '@/lib/utils';

export default function ModelComparison() {
  const metadataQuery = useQuery({ queryKey: ['modelMetadata'], queryFn: modelsApi.getMetadata, staleTime: 300000 });
  const deployedModel = metadataQuery.data?.model_name ?? 'Deployed model';
  const [datasetFilter, setDatasetFilter] = useState<'holdout' | 'all'>('holdout');
  const [sortField, setSortField] = useState<keyof ModelMetricItem>('accuracy');
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch model metrics from backend API
  const { data: metricsData, isLoading, isError, error } = useQuery({
    queryKey: ['modelMetrics'],
    queryFn: async () => (await modelsApi.getMetrics()).models,
    staleTime: 60000,
  });

  const allModels = metricsData ?? [];

  // Filter based on dataset
  const filteredModels = allModels.filter((m) => {
    if (datasetFilter === 'holdout') {
      return m.dataset.toLowerCase().includes('holdout');
    }
    return true;
  });

  // Compare only against the active artifact's corresponding holdout record.

  // Sort
  const sortedModels = [...filteredModels].sort((a, b) => {
    const valA = Number(a[sortField] ?? 0);
    const valB = Number(b[sortField] ?? 0);
    return sortAsc ? valA - valB : valB - valA;
  });

  const handleSort = (field: keyof ModelMetricItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-6 md:p-8 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="safe">Evaluation artifacts</Badge>
              <Badge variant="outline">Serving: {deployedModel}</Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Decision Tree vs Naive Bayes vs SVM (RBF)
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Model results are shown as reported by the ML-service evaluation artifacts. Holdout and
              official KDDTest+ measurements are kept separate; strong holdout performance does not
              establish detection of new attack types.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className="p-3 rounded-lg bg-slate-900/90 border border-white/10 text-xs">
              <span className="text-slate-400 block text-[10px]">Artifact</span>
              <span className="font-semibold text-slate-200">{metadataQuery.data?.artifact ?? 'Timestamp unavailable'}</span>
              <span className="mt-1 block text-slate-400">{metadataQuery.data?.artifact_updated_at ? `Updated ${new Date(metadataQuery.data.artifact_updated_at).toLocaleString()}` : 'Modified time unavailable'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Sortable Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              Comprehensive Model Evaluation Matrix
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Click any column header to sort. Rows are the actual API-returned evaluation records. The serving model name is shown above; other candidates are not dynamically selectable.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={datasetFilter === 'holdout' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatasetFilter('holdout')}
              className="text-xs h-8"
            >
              Holdout Dataset
            </Button>
            <Button
              variant={datasetFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatasetFilter('all')}
              className="text-xs h-8"
            >
              All Datasets (incl. KDDTest+)
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('model')}>
                  <span className="flex items-center gap-1">
                    Model Architecture <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead>Family</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('accuracy')}>
                  <span className="flex items-center gap-1 text-cyan-400">
                    Accuracy <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('precision')}>
                  <span className="flex items-center gap-1">
                    Precision <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('recall')}>
                  <span className="flex items-center gap-1 text-emerald-400">
                    Recall <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('f1')}>
                  <span className="flex items-center gap-1 text-cyan-400">
                    F1-Score <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('roc_auc')}>
                  <span className="flex items-center gap-1">
                    ROC-AUC <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead>TN / FP / FN / TP</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="py-8 text-center text-slate-400">Loading evaluation records…</TableCell></TableRow>}
              {isError && <TableRow><TableCell colSpan={9} role="alert" className="py-8 text-center text-red-400">Could not load benchmark metrics from the API.</TableCell></TableRow>}
              {!isLoading && !isError && sortedModels.length === 0 && <TableRow><TableCell colSpan={9} className="py-8 text-center text-slate-400">No evaluation records are available from the ML service.</TableCell></TableRow>}
              {sortedModels.map((m) => {
                const isSelected = m.model === deployedModel && (m.feature_set ?? 'All features') === (metadataQuery.data?.feature_set ?? 'All features');

                return (
                  <TableRow key={`${m.dataset}-${m.model}-${m.feature_set ?? ''}-${m.threshold_mode}`} isSelected={isSelected}>
                    <TableCell className="font-semibold text-white">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5">
                          {m.model}
                          {isSelected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                              Selected
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {m.dataset}{m.feature_set ? ` · ${m.feature_set}` : ''}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {m.family}
                      </span>
                    </TableCell>

                    {/* Accuracy Cell */}
                    <TableCell>
                      <span
                        className={`font-bold font-mono ${
                          'text-slate-200'
                        }`}
                      >
                        {formatPercent(m.accuracy)}
                      </span>
                    </TableCell>

                    {/* Precision Cell */}
                    <TableCell className="font-mono text-slate-200">
                      {formatPercent(m.precision)}
                    </TableCell>

                    {/* Recall Cell */}
                    <TableCell>
                      <span
                        className={`font-bold font-mono ${
                          'text-slate-200'
                        }`}
                      >
                        {formatPercent(m.recall)}
                      </span>
                    </TableCell>

                    {/* F1 Cell */}
                    <TableCell>
                      <span
                        className={`font-bold font-mono ${
                          'text-slate-200'
                        }`}
                      >
                        {formatPercent(m.f1)}
                      </span>
                    </TableCell>

                    {/* ROC AUC Cell */}
                    <TableCell className="font-mono text-slate-300">
                      {formatMetric(m.roc_auc)}
                    </TableCell>

                    {/* Confusion Counts */}
                    <TableCell className="font-mono text-[11px] text-slate-400">
                      <span className="text-cyan-400">{m.tn}</span> /{' '}
                      <span className="text-amber-400">{m.fp}</span> /{' '}
                      <span className="text-red-400">{m.fn}</span> /{' '}
                      <span className="text-emerald-400">{m.tp}</span>
                    </TableCell>

                    {/* Action */}
                    <TableCell>{isSelected ? <Badge variant="safe">Serving artifact</Badge> : <span className="text-xs text-slate-400">Evaluation only</span>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ROC Curves & Cross-Validation Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ROC Curves */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-white">
              ROC Curves (Receiver Operating Characteristic)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Interactive TPR vs FPR overlay (holdout). Dashed horizontal line marks 99.5% recall for reference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">The available API provides aggregate ROC-AUC metrics, not ROC curve coordinates. Curves are not reconstructed or approximated here. See each model’s ROC-AUC in the evaluation table.</p>
          </CardContent>
        </Card>

        {/* 5-Fold Cross Validation Uncertainty Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-white">
              Cross-Validation Stability (Mean ± Std Dev)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Cross-validation values reported by the benchmark API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 font-mono text-xs">
              {sortedModels.slice(0, 5).map((m) => (
                <div key={`cv-${m.model}-${m.feature_set ?? ''}`} className="space-y-1.5 p-2.5 rounded-lg bg-slate-950/40 border border-white/5">
                  <div className="flex justify-between items-center text-slate-300 font-sans">
                    <span className="font-semibold">{m.model}</span>
                    <span className="text-cyan-400 text-xs font-mono">
                      μ = {m.cv_accuracy_mean == null ? 'Not reported' : `${formatPercent(m.cv_accuracy_mean)} ± ${(m.cv_accuracy_std == null ? 0 : m.cv_accuracy_std * 100).toFixed(3)}%`}
                    </span>
                  </div>
                  <div className="relative h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${(m.cv_accuracy_mean || m.accuracy) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confusion Matrix Grid: Small Heatmap Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-white">
            Holdout Confusion Matrix Heatmaps
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            True Negatives (TN), False Alarms (FP), Missed Attacks (FN), and Neutralized Intrusions (TP)
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? <p className="text-sm text-slate-400">Loading benchmark records…</p> : isError ? <p role="alert" className="text-sm text-red-400">{error instanceof Error ? error.message : 'Could not load model evaluation results.'}</p> : <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{sortedModels.filter((m) => m.dataset.toLowerCase().includes('holdout')).slice(0, 3).map((m) => <ConfusionMatrix key={`${m.model}-${m.feature_set}`} tn={m.tn} fp={m.fp} fn={m.fn} tp={m.tp} modelName={`${m.model} · ${m.feature_set ?? 'All features'}`} datasetName={m.dataset} />)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
