import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cpu,
  Trophy,
  CheckCircle2,
  TrendingUp,
  ArrowUpDown,
  Filter,
  Layers,
  Sparkles,
  BarChart3,
  Shield,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ROCCurve } from '@/components/charts/ROCCurve';
import { ConfusionMatrix } from '@/components/charts/ConfusionMatrix';
import { modelsApi, ModelMetricItem } from '@/lib/api';
import { formatPercent, formatMetric, formatNumber } from '@/lib/utils';
import { useModelStore } from '@/stores/modelStore';

// Static fallback: actual results/metrics.csv rows from the retrained
// Decision Tree / Naive Bayes / SVM (RBF) study (used only if the API is offline).
const studyModelsData: ModelMetricItem[] = [
  {
    dataset: 'paper-like holdout',
    model: 'Decision Tree',
    family: 'ids_results model',
    feature_set: 'All features',
    threshold_mode: 'default',
    threshold_note: 'probability threshold 0.5',
    threshold: 0.500000,
    tn: 2684,
    fp: 6,
    fn: 8,
    tp: 2341,
    accuracy: 0.997222,
    precision: 0.997444,
    recall: 0.996594,
    f1: 0.997019,
    f2: 0.996764,
    roc_auc: 0.997182,
    fit_seconds: 0.319114,
    inference_seconds: 0.045479,
    cv_seconds: 2.473230,
    cv_accuracy_mean: 0.996775,
    cv_accuracy_std: 0.000901,
    cv_precision_mean: 0.996808,
    cv_precision_std: 0.001501,
    cv_recall_mean: 0.996274,
    cv_recall_std: 0.001542,
    cv_f1_mean: 0.996540,
    cv_f1_std: 0.000967,
    cv_roc_auc_mean: 0.996743,
    cv_roc_auc_std: 0.000910,
  },
  {
    dataset: 'paper-like holdout',
    model: 'SVM (RBF)',
    family: 'ids_results model',
    feature_set: 'All features',
    threshold_mode: 'default',
    threshold_note: 'decision-function boundary 0.0',
    threshold: 0.000000,
    tn: 2659,
    fp: 31,
    fn: 22,
    tp: 2327,
    accuracy: 0.989482,
    precision: 0.986853,
    recall: 0.990634,
    f1: 0.988740,
    f2: 0.989876,
    roc_auc: 0.998067,
    fit_seconds: 1.955465,
    inference_seconds: 0.593614,
    cv_seconds: 6.892727,
    cv_accuracy_mean: 0.986851,
    cv_accuracy_std: 0.004162,
    cv_precision_mean: 0.986469,
    cv_precision_std: 0.002701,
    cv_recall_mean: 0.985310,
    cv_recall_std: 0.008235,
    cv_f1_mean: 0.985872,
    cv_f1_std: 0.004540,
    cv_roc_auc_mean: 0.998193,
    cv_roc_auc_std: 0.000708,
  },
  {
    dataset: 'paper-like holdout',
    model: 'Decision Tree',
    family: 'ids_results model',
    feature_set: 'Top-30 correlated features',
    threshold_mode: 'default',
    threshold_note: 'probability threshold 0.5',
    threshold: 0.500000,
    tn: 2662,
    fp: 28,
    fn: 25,
    tp: 2324,
    accuracy: 0.989482,
    precision: 0.988095,
    recall: 0.989357,
    f1: 0.988726,
    f2: 0.989105,
    roc_auc: 0.989867,
    fit_seconds: 0.247270,
    inference_seconds: 0.043176,
    cv_seconds: 1.122925,
    cv_accuracy_mean: 0.988488,
    cv_accuracy_std: 0.001381,
    cv_precision_mean: 0.986822,
    cv_precision_std: 0.001089,
    cv_recall_mean: 0.988503,
    cv_recall_std: 0.002091,
    cv_f1_mean: 0.987661,
    cv_f1_std: 0.001488,
    cv_roc_auc_mean: 0.988796,
    cv_roc_auc_std: 0.001251,
  },
  {
    dataset: 'paper-like holdout',
    model: 'SVM (RBF)',
    family: 'ids_results model',
    feature_set: 'Top-30 correlated features',
    threshold_mode: 'default',
    threshold_note: 'decision-function boundary 0.0',
    threshold: 0.000000,
    tn: 2665,
    fp: 25,
    fn: 82,
    tp: 2267,
    accuracy: 0.978766,
    precision: 0.989092,
    recall: 0.965092,
    f1: 0.976945,
    f2: 0.969798,
    roc_auc: 0.996302,
    fit_seconds: 1.083172,
    inference_seconds: 0.395527,
    cv_seconds: 4.177051,
    cv_accuracy_mean: 0.979060,
    cv_accuracy_std: 0.003455,
    cv_precision_mean: 0.987620,
    cv_precision_std: 0.002892,
    cv_recall_mean: 0.967212,
    cv_recall_std: 0.007259,
    cv_f1_mean: 0.977293,
    cv_f1_std: 0.003815,
    cv_roc_auc_mean: 0.997356,
    cv_roc_auc_std: 0.000633,
  },
  {
    dataset: 'paper-like holdout',
    model: 'Naive Bayes',
    family: 'ids_results model',
    feature_set: 'Top-30 correlated features',
    threshold_mode: 'default',
    threshold_note: 'probability threshold 0.5',
    threshold: 0.500000,
    tn: 2521,
    fp: 169,
    fn: 118,
    tp: 2231,
    accuracy: 0.943044,
    precision: 0.929583,
    recall: 0.949766,
    f1: 0.939566,
    f2: 0.945660,
    roc_auc: 0.978684,
    fit_seconds: 0.204259,
    inference_seconds: 0.044488,
    cv_seconds: 1.061505,
    cv_accuracy_mean: 0.941795,
    cv_accuracy_std: 0.005925,
    cv_precision_mean: 0.923425,
    cv_precision_std: 0.013046,
    cv_recall_mean: 0.954545,
    cv_recall_std: 0.005820,
    cv_f1_mean: 0.938650,
    cv_f1_std: 0.005796,
    cv_roc_auc_mean: 0.976870,
    cv_roc_auc_std: 0.002802,
  },
  {
    dataset: 'paper-like holdout',
    model: 'Naive Bayes',
    family: 'ids_results model',
    feature_set: 'All features',
    threshold_mode: 'default',
    threshold_note: 'probability threshold 0.5',
    threshold: 0.500000,
    tn: 2684,
    fp: 6,
    fn: 1432,
    tp: 917,
    accuracy: 0.714626,
    precision: 0.993499,
    recall: 0.390379,
    f1: 0.560513,
    f2: 0.444326,
    roc_auc: 0.980405,
    fit_seconds: 0.191043,
    inference_seconds: 0.051037,
    cv_seconds: 1.018285,
    cv_accuracy_mean: 0.715675,
    cv_accuracy_std: 0.008755,
    cv_precision_mean: 0.997277,
    cv_precision_std: 0.001482,
    cv_recall_mean: 0.391100,
    cv_recall_std: 0.018743,
    cv_f1_mean: 0.561596,
    cv_f1_std: 0.019595,
    cv_roc_auc_mean: 0.981446,
    cv_roc_auc_std: 0.002541,
  },
  {
    dataset: 'official KDDTest+ external',
    model: 'Naive Bayes',
    family: 'ids_results model',
    feature_set: 'Top-30 correlated features',
    threshold_mode: 'default',
    threshold_note: 'probability threshold 0.5',
    threshold: 0.500000,
    tn: 9002,
    fp: 709,
    fn: 3796,
    tp: 9037,
    accuracy: 0.800169,
    precision: 0.927252,
    recall: 0.704200,
    f1: 0.800478,
    f2: 0.739792,
    roc_auc: 0.927766,
    fit_seconds: 0.204259,
    cv_seconds: 1.061505,
    cv_accuracy_mean: 0.941795,
    cv_accuracy_std: 0.005925,
    cv_precision_mean: 0.923425,
    cv_precision_std: 0.013046,
    cv_recall_mean: 0.954545,
    cv_recall_std: 0.005820,
    cv_f1_mean: 0.938650,
    cv_f1_std: 0.005796,
    cv_roc_auc_mean: 0.976870,
    cv_roc_auc_std: 0.002802,
  },
  {
    dataset: 'official KDDTest+ external',
    model: 'Decision Tree',
    family: 'ids_results model',
    feature_set: 'Top-30 correlated features',
    threshold_mode: 'default',
    threshold_note: 'probability threshold 0.5',
    threshold: 0.500000,
    tn: 9359,
    fp: 352,
    fn: 4184,
    tp: 8649,
    accuracy: 0.798793,
    precision: 0.960893,
    recall: 0.673966,
    f1: 0.792251,
    f2: 0.716772,
    roc_auc: 0.819248,
    fit_seconds: 0.247270,
    cv_seconds: 1.122925,
    cv_accuracy_mean: 0.988488,
    cv_accuracy_std: 0.001381,
    cv_precision_mean: 0.986822,
    cv_precision_std: 0.001089,
    cv_recall_mean: 0.988503,
    cv_recall_std: 0.002091,
    cv_f1_mean: 0.987661,
    cv_f1_std: 0.001488,
    cv_roc_auc_mean: 0.988796,
    cv_roc_auc_std: 0.001251,
  },
  {
    dataset: 'official KDDTest+ external',
    model: 'Decision Tree',
    family: 'ids_results model',
    feature_set: 'All features',
    threshold_mode: 'default',
    threshold_note: 'probability threshold 0.5',
    threshold: 0.500000,
    tn: 8952,
    fp: 759,
    fn: 3974,
    tp: 8859,
    accuracy: 0.790055,
    precision: 0.921085,
    recall: 0.690330,
    f1: 0.789185,
    f2: 0.726743,
    roc_auc: 0.806085,
    fit_seconds: 0.319114,
    cv_seconds: 2.473230,
    cv_accuracy_mean: 0.996775,
    cv_accuracy_std: 0.000901,
    cv_precision_mean: 0.996808,
    cv_precision_std: 0.001501,
    cv_recall_mean: 0.996274,
    cv_recall_std: 0.001542,
    cv_f1_mean: 0.996540,
    cv_f1_std: 0.000967,
    cv_roc_auc_mean: 0.996743,
    cv_roc_auc_std: 0.000910,
  },
  {
    dataset: 'official KDDTest+ external',
    model: 'SVM (RBF)',
    family: 'ids_results model',
    feature_set: 'All features',
    threshold_mode: 'default',
    threshold_note: 'decision-function boundary 0.0',
    threshold: 0.000000,
    tn: 8982,
    fp: 729,
    fn: 4133,
    tp: 8700,
    accuracy: 0.784333,
    precision: 0.922685,
    recall: 0.677940,
    f1: 0.781601,
    f2: 0.715920,
    roc_auc: 0.902568,
    fit_seconds: 1.955465,
    cv_seconds: 6.892727,
    cv_accuracy_mean: 0.986851,
    cv_accuracy_std: 0.004162,
    cv_precision_mean: 0.986469,
    cv_precision_std: 0.002701,
    cv_recall_mean: 0.985310,
    cv_recall_std: 0.008235,
    cv_f1_mean: 0.985872,
    cv_f1_std: 0.004540,
    cv_roc_auc_mean: 0.998193,
    cv_roc_auc_std: 0.000708,
  },
  {
    dataset: 'official KDDTest+ external',
    model: 'SVM (RBF)',
    family: 'ids_results model',
    feature_set: 'Top-30 correlated features',
    threshold_mode: 'default',
    threshold_note: 'decision-function boundary 0.0',
    threshold: 0.000000,
    tn: 9017,
    fp: 694,
    fn: 4728,
    tp: 8105,
    accuracy: 0.759493,
    precision: 0.921127,
    recall: 0.631575,
    f1: 0.749353,
    f2: 0.673945,
    roc_auc: 0.853953,
    fit_seconds: 1.083172,
    cv_seconds: 4.177051,
    cv_accuracy_mean: 0.979060,
    cv_accuracy_std: 0.003455,
    cv_precision_mean: 0.987620,
    cv_precision_std: 0.002892,
    cv_recall_mean: 0.967212,
    cv_recall_std: 0.007259,
    cv_f1_mean: 0.977293,
    cv_f1_std: 0.003815,
    cv_roc_auc_mean: 0.997356,
    cv_roc_auc_std: 0.000633,
  },
  {
    dataset: 'official KDDTest+ external',
    model: 'Naive Bayes',
    family: 'ids_results model',
    feature_set: 'All features',
    threshold_mode: 'default',
    threshold_note: 'probability threshold 0.5',
    threshold: 0.500000,
    tn: 9649,
    fp: 62,
    fn: 10907,
    tp: 1926,
    accuracy: 0.513440,
    precision: 0.968813,
    recall: 0.150082,
    f1: 0.259901,
    f2: 0.180608,
    roc_auc: 0.841980,
    fit_seconds: 0.191043,
    cv_seconds: 1.018285,
    cv_accuracy_mean: 0.715675,
    cv_accuracy_std: 0.008755,
    cv_precision_mean: 0.997277,
    cv_precision_std: 0.001482,
    cv_recall_mean: 0.391100,
    cv_recall_std: 0.018743,
    cv_f1_mean: 0.561596,
    cv_f1_std: 0.019595,
    cv_roc_auc_mean: 0.981446,
    cv_roc_auc_std: 0.002541,
  },
];

export default function ModelComparison() {
  const { selectedModel, setSelectedModel } = useModelStore();
  const [datasetFilter, setDatasetFilter] = useState<'holdout' | 'all'>('holdout');
  const [sortField, setSortField] = useState<keyof ModelMetricItem>('accuracy');
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch model metrics from backend API
  const { data: metricsData } = useQuery({
    queryKey: ['modelMetrics'],
    queryFn: async () => {
      try {
        const res = await modelsApi.getMetrics();
        return res.models && res.models.length ? res.models : studyModelsData;
      } catch (e) {
        return studyModelsData;
      }
    },
    staleTime: 60000,
  });

  const allModels = metricsData || studyModelsData;

  // Filter based on dataset
  const filteredModels = allModels.filter((m) => {
    if (datasetFilter === 'holdout') {
      return m.dataset.toLowerCase().includes('holdout');
    }
    return true;
  });

  // Benchmark reference: deployed model (Decision Tree, all features, holdout).
  // Cells strictly above these values are highlighted.
  const rfBenchmark = {
    accuracy: 0.997222,
    recall: 0.996594,
    f1: 0.997019,
    precision: 0.997444,
  };

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
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-purple-950/20 to-slate-900 p-6 md:p-8 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="purple">
                <Trophy className="h-3.5 w-3.5 mr-1 text-amber-400" />
                Benchmark Validated
              </Badge>
              <Badge variant="safe">Deployed: Decision Tree (All features)</Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Decision Tree vs Naive Bayes vs SVM (RBF)
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              The three models from ids_results.py, each run with all encoded features and with the
              top-30 correlated features (stratified 80/20 holdout; official KDDTest+ scores are far
              lower). Highlighted metrics strictly surpass the deployed Decision Tree benchmark.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-xs font-mono">
              <span className="text-slate-400 block text-[10px]">Deployed Model Benchmark (DT, All features):</span>
              <span className="text-cyan-400 font-bold">Acc: 99.72% • Recall: 99.66%</span>
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
              Click any column header to sort. Each model appears twice per dataset (all features / top-30 correlated). Badges denote the deployed model.
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
                  <span className="flex items-center gap-1 text-purple-400">
                    F1-Score <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('roc_auc')}>
                  <span className="flex items-center gap-1">
                    ROC-AUC <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead>TN / FP / FN / TP</TableHead>
                <TableHead className="text-right">Deploy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedModels.map((m) => {
                const beatsAccuracy = m.accuracy > rfBenchmark.accuracy;
                const beatsRecall = m.recall > rfBenchmark.recall;
                const beatsF1 = m.f1 > rfBenchmark.f1;
                const isSelected = selectedModel === m.model;

                return (
                  <TableRow key={`${m.dataset}-${m.model}-${m.feature_set ?? ''}-${m.threshold_mode}`} isSelected={isSelected}>
                    <TableCell className="font-semibold text-white">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5">
                          {m.model}
                          {isSelected && (m.feature_set ?? 'All features') === 'All features' && (
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
                          beatsAccuracy ? 'text-emerald-400 font-extrabold' : 'text-slate-200'
                        }`}
                      >
                        {formatPercent(m.accuracy)}
                        {beatsAccuracy && (
                          <span className="ml-1 text-[10px] text-emerald-400">★</span>
                        )}
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
                          beatsRecall ? 'text-emerald-400 font-extrabold' : 'text-slate-200'
                        }`}
                      >
                        {formatPercent(m.recall)}
                        {beatsRecall && (
                          <span className="ml-1 text-[10px] text-emerald-400">★</span>
                        )}
                      </span>
                    </TableCell>

                    {/* F1 Cell */}
                    <TableCell>
                      <span
                        className={`font-bold font-mono ${
                          beatsF1 ? 'text-purple-300 font-extrabold' : 'text-slate-200'
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
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() => setSelectedModel(m.model)}
                        className="text-xs h-7 px-2.5"
                      >
                        {isSelected ? 'Active' : 'Select'}
                      </Button>
                    </TableCell>
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
            <ROCCurve />
          </CardContent>
        </Card>

        {/* 5-Fold Cross Validation Uncertainty Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-white">
              Cross-Validation Stability (Mean ± Std Dev)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Stratified 3-Fold Cross-Validation accuracy & recall variance across folds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 font-mono text-xs">
              {sortedModels.slice(0, 5).map((m) => (
                <div key={`cv-${m.model}-${m.feature_set ?? ''}`} className="space-y-1.5 p-2.5 rounded-lg bg-slate-950/40 border border-white/5">
                  <div className="flex justify-between items-center text-slate-300 font-sans">
                    <span className="font-semibold">{m.model}</span>
                    <span className="text-cyan-400 text-xs font-mono">
                      μ = {formatPercent(m.cv_accuracy_mean || m.accuracy)} ± {((m.cv_accuracy_std || 0.0006) * 100).toFixed(3)}%
                    </span>
                  </div>
                  <div className="relative h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top 3 Models */}
            <ConfusionMatrix
              tn={2684}
              fp={6}
              fn={8}
              tp={2341}
              modelName="Decision Tree [All features] (deployed)"
              datasetName="Holdout (5,039 records)"
            />
            <ConfusionMatrix
              tn={2659}
              fp={31}
              fn={22}
              tp={2327}
              modelName="SVM (RBF) [All features]"
              datasetName="Holdout (5,039 records)"
            />
            <ConfusionMatrix
              tn={2521}
              fp={169}
              fn={118}
              tp={2231}
              modelName="Naive Bayes [Top-30 features]"
              datasetName="Holdout (5,039 records)"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
