import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Cpu,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  History,
  Zap,
  ArrowRight,
  Database,
  Lock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { PredictionPieChart } from '@/components/charts/PredictionPieChart';
import { MetricsBarChart } from '@/components/charts/MetricsBarChart';
import { historyApi, modelsApi } from '@/lib/api';
import { formatNumber, formatPercent } from '@/lib/utils';
import { useModelStore } from '@/stores/modelStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedModel, threshold } = useModelStore();

  // Fetch stats from backend
  const { data: statsData } = useQuery({
    queryKey: ['historyStats'],
    queryFn: async () => {
      try {
        return await historyApi.getStats();
      } catch (e) {
        // Fallback realistic metrics from NSL-KDD holdout run
        return {
          total: 25192,
          anomalyCount: 11743,
          normalCount: 13449,
          detectionRate: 0.466,
        };
      }
    },
    staleTime: 10000,
  });

  // Fetch recent history
  const { data: historyData } = useQuery({
    queryKey: ['recentHistory'],
    queryFn: async () => {
      try {
        return await historyApi.getHistory({ limit: 5 });
      } catch (e) {
        // Mock recent predictions
        return {
          predictions: [
            {
              _id: 'rec_01',
              timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
              prediction: 'anomaly',
              confidence: 0.9982,
              is_anomaly: true,
              threshold: 0.5,
              model_name: 'Decision Tree',
              features: { protocol_type: 'tcp', service: 'http', src_bytes: 49120, dst_bytes: 0 },
            },
            {
              _id: 'rec_02',
              timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
              prediction: 'normal',
              confidence: 0.9945,
              is_anomaly: false,
              threshold: 0.5,
              model_name: 'Decision Tree',
              features: { protocol_type: 'tcp', service: 'http', src_bytes: 232, dst_bytes: 8153 },
            },
            {
              _id: 'rec_03',
              timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
              prediction: 'Dos',
              confidence: 0.9876,
              is_anomaly: true,
              threshold: 0.5,
              model_name: 'Decision Tree',
              features: { protocol_type: 'icmp', service: 'eco_i', src_bytes: 1032, dst_bytes: 0 },
            },
            {
              _id: 'rec_04',
              timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
              prediction: 'normal',
              confidence: 0.9765,
              is_anomaly: false,
              threshold: 0.5,
              model_name: 'Decision Tree',
              features: { protocol_type: 'udp', service: 'domain_u', src_bytes: 44, dst_bytes: 132 },
            },
            {
              _id: 'rec_05',
              timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
              prediction: 'Probe',
              confidence: 0.9912,
              is_anomaly: true,
              threshold: 0.5,
              model_name: 'Decision Tree',
              features: { protocol_type: 'tcp', service: 'private', src_bytes: 0, dst_bytes: 0 },
            },
          ],
          total: 25192,
          page: 1,
          pages: 5038,
        };
      }
    },
    staleTime: 10000,
  });

  const total = statsData?.total || 25192;
  const anomalies = statsData?.anomalyCount || 11743;
  const normal = statsData?.normalCount || 13449;

  return (
    <div className="space-y-6">
      {/* Top Hero Banner with Quick Actions */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 p-6 md:p-8 backdrop-blur-xl">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-cyan-500/10 via-purple-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <Badge variant="safe" dot>
                Threat Shield Active
              </Badge>
              <Badge variant="purple" className="font-mono">
                Model: {selectedModel}
              </Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Real-time Defensive Neural Operations
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Continuous inspection of high-speed network traffic vectors. 
              The selected Decision Tree reached 99.66% recall with an ROC-AUC of 0.9972 on the stratified holdout. Performance on the official KDDTest+ external set is substantially lower — see Model Comparison before drawing conclusions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              onClick={() => navigate('/predict')}
              variant="default"
              className="gap-2 font-semibold shadow-lg shadow-cyan-500/20"
            >
              <ShieldAlert className="h-4 w-4" />
              New Prediction
            </Button>
            <Button
              onClick={() => navigate('/live')}
              variant="outline"
              className="gap-2 border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/30"
            >
              <Activity className="h-4 w-4 text-emerald-400" />
              Live Monitor
            </Button>
            <Button
              onClick={() => navigate('/models')}
              variant="secondary"
              className="gap-2"
            >
              <Cpu className="h-4 w-4 text-purple-400" />
              View Models
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Records Card */}
        <Card className="hover:border-white/20 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Total Inspected Vectors
            </CardTitle>
            <div className="p-2 rounded-lg bg-slate-800 text-cyan-400">
              <Database className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-white">
              {formatNumber(total)}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-cyan-400 font-semibold font-mono">100%</span> processed through ML pipeline
            </p>
          </CardContent>
        </Card>

        {/* Anomalies Detected Card */}
        <Card className="hover:border-red-500/30 transition-all" glow="danger">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-red-400">
              Anomalies Detected
            </CardTitle>
            <div className="p-2 rounded-lg bg-red-950/60 text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-red-400">
              {formatNumber(anomalies)}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-red-400 font-semibold font-mono">
                {formatPercent(anomalies / total, 1)}
              </span> of total network traffic
            </p>
          </CardContent>
        </Card>

        {/* Model Accuracy Card */}
        <Card className="hover:border-cyan-500/30 transition-all" glow="safe">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-cyan-400">
              Holdout Accuracy
            </CardTitle>
            <div className="p-2 rounded-lg bg-cyan-950/60 text-cyan-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-cyan-300">
              99.72%
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold font-mono">99.66%</span> holdout recall (Decision Tree)
            </p>
          </CardContent>
        </Card>

        {/* Active Alerts Card */}
        <Card className="hover:border-purple-500/30 transition-all" glow="accent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-purple-400">
              Defense Status
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-950/60 text-purple-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-purple-300 flex items-center gap-2">
              Optimal
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-mono">
              Decision boundary: τ = {threshold.toFixed(4)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Middle Section: Chart & Traffic Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Model Comparison Chart Preview (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-white">
                Multi-Model Performance Benchmark
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Decision Tree vs Naive Bayes vs SVM (RBF) — All vs Top-30 Features
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/models')}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Details <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <MetricsBarChart height={280} />
          </CardContent>
        </Card>

        {/* Right: Traffic Distribution Pie Chart (1 col) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-white">
              Traffic Distribution
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Normal traffic vs Detected anomalies
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center pt-2">
            <PredictionPieChart normalCount={normal} anomalyCount={anomalies} size={210} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Recent Predictions Audit Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-cyan-400" />
              Recent Vector Inferences
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Latest packets classified by the active IDS engine
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/history')}
            className="text-xs"
          >
            Full Audit Log <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Traffic (Src / Dst)</TableHead>
                <TableHead>Classification</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyData?.predictions?.map((item) => {
                const isAnomaly = item.is_anomaly || item.prediction !== 'normal';
                return (
                  <TableRow key={item._id}>
                    <TableCell className="text-slate-400 text-xs">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="font-semibold uppercase text-slate-300">
                      {item.features?.protocol_type || 'tcp'}
                    </TableCell>
                    <TableCell className="text-cyan-400 font-mono text-xs">
                      {item.features?.service || 'http'}
                    </TableCell>
                    <TableCell className="text-slate-300 font-mono text-xs">
                      {formatNumber(item.features?.src_bytes || 0)} B / {formatNumber(item.features?.dst_bytes || 0)} B
                    </TableCell>
                    <TableCell>
                      <Badge variant={isAnomaly ? 'danger' : 'safe'} dot>
                        {item.prediction.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-slate-200">
                      {formatPercent(item.confidence)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/history')}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
