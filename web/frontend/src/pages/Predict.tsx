import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  Upload,
  FileSpreadsheet,
  Download,
  RotateCcw,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  Copy,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { predictApi, PredictionResult, modelsApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiErrors';
import { formatPercent, formatNumber } from '@/lib/utils';

export default function Predict() {
  const { toast } = useToast();
  const metadataQuery = useQuery({ queryKey: ['modelMetadata'], queryFn: modelsApi.getMetadata, staleTime: 300000 });
  const activeThreshold = metadataQuery.data?.threshold;

  const [activeTab, setActiveTab] = useState('single');
  const [submitting, setSubmitting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);

  // Collapsible section toggles
  const [openSections, setOpenSections] = useState({
    basic: true,
    content: true,
    traffic: false,
    host: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<Record<string, any>>({ defaultValues: {} });

  const handleLoadPreset = (type: 'normal' | 'anomaly') => {
    if (isDirty && !window.confirm('Replace the current feature values with this example?')) return;
    const preset = metadataQuery.data?.demo_samples?.[type];
    if (!preset) {
      toast({ title: 'Example record unavailable', description: 'The model artifact did not provide a sample record.', variant: 'destructive' });
      return;
    }
    reset(preset);
    toast({
      title: `${type === 'normal' ? 'Normal' : 'Anomalous'} example loaded`,
      description: 'This is an example input from model metadata, not an observed network event.',
      variant: 'info',
    });
  };

  const onSubmitSingle = async (values: Record<string, any>) => {
    const binaryFeatures = new Set(['land', 'logged_in', 'root_shell', 'su_attempted', 'is_host_login', 'is_guest_login']);
    const invalid = Object.entries(values).find(([key, raw]) => {
      if (['protocol_type', 'service', 'flag'].includes(key)) return !String(raw ?? '').trim();
      if (raw === undefined || raw === null || String(raw).trim() === '') return true;
      const value = Number(raw);
      return !Number.isFinite(value) || value < 0 || (key.endsWith('_rate') && value > 1) || (binaryFeatures.has(key) && value !== 0 && value !== 1);
    });
    if (invalid) {
      toast({ title: 'Check the input values', description: `${invalid[0]} must be numeric and non-negative${invalid[0].endsWith('_rate') ? ', from 0 to 1' : ''}.`, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    setPredictionResult(null);
    try {
      // Cast numeric inputs
      const formatted: Record<string, any> = {};
      Object.entries(values).forEach(([k, v]) => {
        if (['protocol_type', 'service', 'flag'].includes(k)) {
          formatted[k] = String(v);
        } else {
          formatted[k] = Number(v) || 0;
        }
      });

      const res = await predictApi.predictSingle(formatted, activeThreshold);
      setPredictionResult(res);
      toast({
        title: res.is_anomaly ? 'Input classified as anomalous' : 'Input classified as normal',
        description: `${res.model_name || metadataQuery.data?.model_name || 'Deployed model'} • Class confidence: ${formatPercent(res.confidence)}. This is not a live network detection.`,
        variant: res.is_anomaly ? 'destructive' : 'success',
      });
    } catch (err) {
      toast({
        title: 'Prediction unavailable',
        description: getApiErrorMessage(err, 'The server could not classify this record. Your entered values have been kept; try again when the API is available.'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Batch upload state
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<PredictionResult[] | null>(null);
  const [batchUploading, setBatchUploading] = useState(false);

  const setValidatedBatchFile = (file: File) => {
    const supportedType = /\.(csv|json)$/i.test(file.name);
    if (!supportedType || file.size > 10 * 1024 * 1024) {
      setBatchFile(null);
      toast({ title: 'Unsupported upload', description: 'Choose a CSV or JSON file no larger than 10 MB.', variant: 'destructive' });
      return;
    }
    setBatchFile(file);
    setBatchResults(null);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setValidatedBatchFile(e.dataTransfer.files[0]);
    }
  };

  const handleBatchSubmit = async () => {
    if (!batchFile) return;
    setBatchUploading(true);
    setBatchProgress(0);
    setBatchResults(null);

    try {
      const res = await predictApi.predictBatch(batchFile, activeThreshold);
      setBatchProgress(100);
      setBatchResults(res.predictions);
      toast({
        title: 'Batch Analysis Complete',
        description: `Analyzed ${res.predictions.length} packet vectors.`,
        variant: 'success',
      });
    } catch (err) {
      setBatchProgress(0);
      toast({
        title: 'Batch prediction unavailable',
        description: getApiErrorMessage(err, 'The CSV could not be processed by the server. Check the file and API connection, then retry.'),
        variant: 'destructive',
      });
    } finally {
      setBatchUploading(false);
    }
  };

  const handleExportBatchCSV = () => {
    if (!batchResults) return;
    const headers = ['ID', 'Prediction', 'Score', 'Is Anomaly', 'Model'];
    const rows = batchResults.map((r) => [r.id ?? '', r.prediction, r.anomaly_score ?? '', r.is_anomaly ? 'YES' : 'NO', r.model_name ?? '']);
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csvContent = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ids_predictions_export_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyResult = async () => {
    if (!predictionResult) return;
    const report = [`Result: ${predictionResult.prediction}`, `Anomaly score: ${predictionResult.anomaly_score ?? 'not returned'}`, `Class confidence: ${formatPercent(predictionResult.confidence)} (not calibrated)`, `Threshold: ${predictionResult.threshold}`, `Model: ${predictionResult.model_name ?? metadataQuery.data?.model_name ?? 'Deployed model'}`, `Timestamp: ${predictionResult.timestamp ?? 'not returned'}`].join('\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable');
      await navigator.clipboard.writeText(report);
      toast({ title: 'Result copied', description: 'Prediction summary copied to clipboard.', variant: 'success' });
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard access was denied. You can select the result text and copy it manually.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-cyan-400" />
            Connection classification
          </h2>
          <p className="text-xs text-slate-400">
            Submit NSL-KDD features for an inference from the currently deployed model
          </p>
        </div>

        {/* Tab Switcher */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList>
            <TabsTrigger value="single" className="text-xs px-4">
              Single Vector Scan
            </TabsTrigger>
            <TabsTrigger value="batch" className="text-xs px-4">
              Batch CSV Upload
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* SINGLE RECORD TAB */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form column (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base text-white">
                    41-Feature Connection Vector
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    NSL-KDD standardized network protocol attributes
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadPreset('normal')}
                    className="text-xs text-cyan-300 border-cyan-500/30 hover:bg-cyan-950/40"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-cyan-400" />
                    Normal example
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadPreset('anomaly')}
                    className="text-xs text-red-300 border-red-500/30 hover:bg-red-950/40"
                  >
                    <AlertCircle className="h-3.5 w-3.5 mr-1 text-red-400" />
                    Anomalous example
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLoadPreset('normal')}
                    title="Reload model example record"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit(onSubmitSingle)} className="space-y-4">
                  {/* Section 1: Basic Features */}
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                    <button
                      type="button"
                      onClick={() => toggleSection('basic')}
                      className="flex items-center justify-between w-full text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2"
                    >
                      <span>1. Basic Network Connection Features (9)</span>
                      {openSections.basic ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {openSections.basic && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 animate-in fade-in-50 duration-200">
                        <div>
                          <label htmlFor="feature-duration" className="text-[11px] font-medium text-slate-300">Duration (sec)</label>
                          <Input id="feature-duration" type="number" {...register('duration')} />
                        </div>
                        <div>
                          <label htmlFor="feature-protocol_type" className="text-[11px] font-medium text-slate-300">Protocol Type</label>
                          <Select id="feature-protocol_type" {...register('protocol_type')}>
                            {(metadataQuery.data?.categorical_options?.protocol_type ?? ['tcp', 'udp', 'icmp']).map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
                          </Select>
                        </div>
                        <div>
                          <label htmlFor="feature-service" className="text-[11px] font-medium text-slate-300">Service</label>
                          <Select id="feature-service" {...register('service')}>
                            {(metadataQuery.data?.categorical_options?.service ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
                          </Select>
                        </div>
                        <div>
                          <label htmlFor="feature-flag" className="text-[11px] font-medium text-slate-300">Flag (Status)</label>
                          <Select id="feature-flag" {...register('flag')}>
                            {(metadataQuery.data?.categorical_options?.flag ?? []).map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
                          </Select>
                        </div>
                        <div>
                          <label htmlFor="feature-src_bytes" className="text-[11px] font-medium text-slate-300">Src Bytes (Bytes Sent)</label>
                          <Input id="feature-src_bytes" type="number" {...register('src_bytes')} />
                        </div>
                        <div>
                          <label htmlFor="feature-dst_bytes" className="text-[11px] font-medium text-slate-300">Dst Bytes (Bytes Recv)</label>
                          <Input id="feature-dst_bytes" type="number" {...register('dst_bytes')} />
                        </div>
                        <div>
                          <label htmlFor="feature-land" className="text-[11px] font-medium text-slate-300">Land (Same Src/Dst IP)</label>
                          <Select id="feature-land" {...register('land')}>
                            <option value={0}>0 (No)</option>
                            <option value={1}>1 (Yes - Land Attack)</option>
                          </Select>
                        </div>
                        <div>
                          <label htmlFor="feature-wrong_fragment" className="text-[11px] font-medium text-slate-300">Wrong Fragment</label>
                          <Input id="feature-wrong_fragment" type="number" {...register('wrong_fragment')} />
                        </div>
                        <div>
                          <label htmlFor="feature-urgent" className="text-[11px] font-medium text-slate-300">Urgent Packets</label>
                          <Input id="feature-urgent" type="number" {...register('urgent')} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Content Features */}
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                    <button
                      type="button"
                      onClick={() => toggleSection('content')}
                      className="flex items-center justify-between w-full text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2"
                    >
                      <span>2. Content & Payload Indicators (13)</span>
                      {openSections.content ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {openSections.content && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 animate-in fade-in-50 duration-200">
                        <div>
                          <label htmlFor="feature-hot" className="text-[11px] font-medium text-slate-300">Hot Indicators</label>
                          <Input id="feature-hot" type="number" {...register('hot')} />
                        </div>
                        <div>
                          <label htmlFor="feature-num_failed_logins" className="text-[11px] font-medium text-slate-300">Failed Logins</label>
                          <Input id="feature-num_failed_logins" type="number" {...register('num_failed_logins')} />
                        </div>
                        <div>
                          <label htmlFor="feature-logged_in" className="text-[11px] font-medium text-slate-300">Logged In Status</label>
                          <Select id="feature-logged_in" {...register('logged_in')}>
                            <option value={1}>1 (Authenticated)</option>
                            <option value={0}>0 (Not Logged In)</option>
                          </Select>
                        </div>
                        <div>
                          <label htmlFor="feature-num_compromised" className="text-[11px] font-medium text-slate-300">Num Compromised</label>
                          <Input id="feature-num_compromised" type="number" {...register('num_compromised')} />
                        </div>
                        <div>
                          <label htmlFor="feature-root_shell" className="text-[11px] font-medium text-slate-300">Root Shell Acquired</label>
                          <Select id="feature-root_shell" {...register('root_shell')}>
                            <option value={0}>0 (No)</option>
                            <option value={1}>1 (Yes)</option>
                          </Select>
                        </div>
                        <div>
                          <label htmlFor="feature-su_attempted" className="text-[11px] font-medium text-slate-300">su Attempted</label>
                          <Input id="feature-su_attempted" type="number" {...register('su_attempted')} />
                        </div>
                        <div><label htmlFor="feature-num_root" className="text-[11px] font-medium text-slate-300">Number of root accesses</label><Input id="feature-num_root" type="number" min="0" {...register('num_root')} /></div>
                        <div><label htmlFor="feature-num_file_creations" className="text-[11px] font-medium text-slate-300">File creations</label><Input id="feature-num_file_creations" type="number" min="0" {...register('num_file_creations')} /></div>
                        <div><label htmlFor="feature-num_shells" className="text-[11px] font-medium text-slate-300">Shells opened</label><Input id="feature-num_shells" type="number" min="0" {...register('num_shells')} /></div>
                        <div><label htmlFor="feature-num_access_files" className="text-[11px] font-medium text-slate-300">Access files</label><Input id="feature-num_access_files" type="number" min="0" {...register('num_access_files')} /></div>
                        <div><label htmlFor="feature-num_outbound_cmds" className="text-[11px] font-medium text-slate-300">Outbound commands</label><Input id="feature-num_outbound_cmds" type="number" min="0" {...register('num_outbound_cmds')} /></div>
                        <div><label htmlFor="feature-is_host_login" className="text-[11px] font-medium text-slate-300">Host login</label><Select id="feature-is_host_login" {...register('is_host_login')}><option value="0">No</option><option value="1">Yes</option></Select></div>
                        <div><label htmlFor="feature-is_guest_login" className="text-[11px] font-medium text-slate-300">Guest login</label><Select id="feature-is_guest_login" {...register('is_guest_login')}><option value="0">No</option><option value="1">Yes</option></Select></div>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Time-based Traffic Features */}
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                    <button
                      type="button"
                      onClick={() => toggleSection('traffic')}
                      className="flex items-center justify-between w-full text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2"
                    >
                      <span>3. Time-based Traffic Features (9)</span>
                      {openSections.traffic ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {openSections.traffic && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 animate-in fade-in-50 duration-200">
                        <div>
                          <label htmlFor="feature-count" className="text-[11px] font-medium text-slate-300">Count (Host connections past 2s)</label>
                          <Input id="feature-count" type="number" {...register('count')} />
                        </div>
                        <div>
                          <label htmlFor="feature-srv_count" className="text-[11px] font-medium text-slate-300">Srv Count (Same service)</label>
                          <Input id="feature-srv_count" type="number" {...register('srv_count')} />
                        </div>
                        <div>
                          <label htmlFor="feature-serror_rate" className="text-[11px] font-medium text-slate-300">SYN Error Rate (0.0 - 1.0)</label>
                          <Input id="feature-serror_rate" type="number" step="0.01" {...register('serror_rate')} />
                        </div>
                        <div>
                          <label htmlFor="feature-same_srv_rate" className="text-[11px] font-medium text-slate-300">Same Srv Rate</label>
                          <Input id="feature-same_srv_rate" type="number" step="0.01" {...register('same_srv_rate')} />
                        </div>
                        <div>
                          <label htmlFor="feature-diff_srv_rate" className="text-[11px] font-medium text-slate-300">Diff Srv Rate</label>
                          <Input id="feature-diff_srv_rate" type="number" step="0.01" {...register('diff_srv_rate')} />
                        </div>
                        <div>
                          <label htmlFor="feature-srv_diff_host_rate" className="text-[11px] font-medium text-slate-300">Srv Diff Host Rate</label>
                          <Input id="feature-srv_diff_host_rate" type="number" step="0.01" min="0" max="1" {...register('srv_diff_host_rate')} />
                        </div>
                        <div><label htmlFor="feature-srv_serror_rate" className="text-[11px] font-medium text-slate-300">Same-service SYN error rate</label><Input id="feature-srv_serror_rate" type="number" step="0.01" min="0" max="1" {...register('srv_serror_rate')} /></div>
                        <div><label htmlFor="feature-rerror_rate" className="text-[11px] font-medium text-slate-300">Rejected connection rate</label><Input id="feature-rerror_rate" type="number" step="0.01" min="0" max="1" {...register('rerror_rate')} /></div>
                        <div><label htmlFor="feature-srv_rerror_rate" className="text-[11px] font-medium text-slate-300">Same-service rejected rate</label><Input id="feature-srv_rerror_rate" type="number" step="0.01" min="0" max="1" {...register('srv_rerror_rate')} /></div>
                      </div>
                    )}
                  </div>

                  {/* Section 4: Host-based Traffic Features */}
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                    <button
                      type="button"
                      onClick={() => toggleSection('host')}
                      className="flex items-center justify-between w-full text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2"
                    >
                      <span>4. Host-based Window Features (10)</span>
                      {openSections.host ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {openSections.host && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 animate-in fade-in-50 duration-200">
                        <div>
                          <label htmlFor="feature-dst_host_count" className="text-[11px] font-medium text-slate-300">Dst Host Count</label>
                          <Input id="feature-dst_host_count" type="number" {...register('dst_host_count')} />
                        </div>
                        <div>
                          <label htmlFor="feature-dst_host_srv_count" className="text-[11px] font-medium text-slate-300">Dst Host Srv Count</label>
                          <Input id="feature-dst_host_srv_count" type="number" {...register('dst_host_srv_count')} />
                        </div>
                        <div>
                          <label htmlFor="feature-dst_host_same_srv_rate" className="text-[11px] font-medium text-slate-300">Dst Host Same Srv Rate</label>
                          <Input id="feature-dst_host_same_srv_rate" type="number" step="0.01" {...register('dst_host_same_srv_rate')} />
                        </div>
                        <div>
                          <label htmlFor="feature-dst_host_same_src_port_rate" className="text-[11px] font-medium text-slate-300">Dst Host Same Src Port Rate</label>
                          <Input id="feature-dst_host_same_src_port_rate" type="number" step="0.01" {...register('dst_host_same_src_port_rate')} />
                        </div>
                        <div>
                          <label htmlFor="feature-dst_host_serror_rate" className="text-[11px] font-medium text-slate-300">Dst Host Serror Rate</label>
                          <Input id="feature-dst_host_serror_rate" type="number" step="0.01" {...register('dst_host_serror_rate')} />
                        </div>
                        <div>
                          <label htmlFor="feature-dst_host_srv_serror_rate" className="text-[11px] font-medium text-slate-300">Dst Host Srv Serror Rate</label>
                          <Input id="feature-dst_host_srv_serror_rate" type="number" step="0.01" min="0" max="1" {...register('dst_host_srv_serror_rate')} />
                        </div>
                        <div><label htmlFor="feature-dst_host_diff_srv_rate" className="text-[11px] font-medium text-slate-300">Destination host different-service rate</label><Input id="feature-dst_host_diff_srv_rate" type="number" step="0.01" min="0" max="1" {...register('dst_host_diff_srv_rate')} /></div>
                        <div><label htmlFor="feature-dst_host_srv_diff_host_rate" className="text-[11px] font-medium text-slate-300">Destination host service/different host rate</label><Input id="feature-dst_host_srv_diff_host_rate" type="number" step="0.01" min="0" max="1" {...register('dst_host_srv_diff_host_rate')} /></div>
                        <div><label htmlFor="feature-dst_host_rerror_rate" className="text-[11px] font-medium text-slate-300">Destination host rejection rate</label><Input id="feature-dst_host_rerror_rate" type="number" step="0.01" min="0" max="1" {...register('dst_host_rerror_rate')} /></div>
                        <div><label htmlFor="feature-dst_host_srv_rerror_rate" className="text-[11px] font-medium text-slate-300">Destination host service rejection rate</label><Input id="feature-dst_host_srv_rerror_rate" type="number" step="0.01" min="0" max="1" {...register('dst_host_srv_rerror_rate')} /></div>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="default"
                      size="lg"
                      className="w-full font-bold text-sm tracking-wide"
                      isLoading={submitting}
                    >
                      <Zap className="mr-2 h-4 w-4 fill-current" />
Run model inference
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Result Card (1 col) */}
          <div className="space-y-4">
            <Card
              className="sticky top-28"
              glow={predictionResult ? (predictionResult.is_anomaly ? 'danger' : 'safe') : 'none'}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">
                  Classification Telemetry
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Server response from the deployed model artifact
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {predictionResult ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-5"
                  >
                    {/* Large Status Display */}
                    <div
                      className={`p-6 rounded-2xl border text-center transition-all ${
                        predictionResult.is_anomaly
                          ? 'border-red-500/40 bg-red-950/30 shadow-[0_0_30px_rgba(239,68,68,0.25)]'
                          : 'border-cyan-500/40 bg-cyan-950/30 shadow-[0_0_30px_rgba(6,182,212,0.2)]'
                      }`}
                    >
                      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900/80 border border-white/10">
                        {predictionResult.is_anomaly ? (
                          <ShieldAlert className="h-9 w-9 text-red-400 animate-pulse" />
                        ) : (
                          <ShieldCheck className="h-9 w-9 text-cyan-400" />
                        )}
                      </div>

                      <h3
                        className={`text-2xl font-black tracking-wider uppercase font-mono ${
                          predictionResult.is_anomaly ? 'text-red-400' : 'text-cyan-400'
                        }`}
                      >
                        {predictionResult.is_anomaly ? 'ANOMALY CLASSIFICATION' : 'NORMAL CLASSIFICATION'}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1">
                        {predictionResult.is_anomaly
                          ? 'The model classified this input as anomalous; that is not confirmation of an attack.'
                          : 'The model classified this input as normal; that does not guarantee the traffic is safe.'}
                      </p>
                    </div>

                    {/* Confidence Gauge */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Class confidence (not calibrated risk)</span>
                        <span className="font-mono font-bold text-white">
                          {formatPercent(predictionResult.confidence)}
                        </span>
                      </div>
                      <Progress
                        value={predictionResult.confidence * 100}
                        variant={predictionResult.is_anomaly ? 'danger' : 'safe'}
                      />
                    </div>

                    {/* Metric Rows */}
                    <div className="space-y-2 pt-2 border-t border-white/5 text-xs font-mono">
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Class Label:</span>
                        <Badge variant={predictionResult.is_anomaly ? 'danger' : 'safe'}>
                          {predictionResult.prediction}
                        </Badge>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Anomaly Score:</span>
                        <span className="text-slate-200">
                          {predictionResult.anomaly_score == null ? 'Not returned' : predictionResult.anomaly_score.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Decision Threshold:</span>
                        <span className="text-cyan-400 font-semibold">
                          τ = {predictionResult.threshold.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Classifier:</span>
                        <span className="text-cyan-300 font-sans">
                          {metadataQuery.data?.model_name ?? 'Deployed model'}
                        </span>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={handleCopyResult} className="w-full"><Copy size={14} className="mr-2" />Copy result summary</Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl text-slate-400 space-y-3">
                    <Sparkles className="h-8 w-8 text-slate-500 mx-auto" />
                    <p className="text-xs leading-relaxed">
                      Configure feature inputs or select a preset, then press{' '}
                      <span className="text-cyan-400 font-semibold">Run model inference</span>.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* BATCH UPLOAD TAB */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-white">
                Batch Dataset Ingestion & Evaluation
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Upload CSV or JSON records for batch model inference
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-2xl p-8 text-center transition-colors bg-slate-950/40 cursor-pointer"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 border border-white/10 text-cyan-400">
                  <Upload className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">
                  Drag and drop a file or click to browse
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  CSV with NSL-KDD column headers or a JSON array of feature records. Maximum file size: 10 MB.
                </p>

                <input
                  type="file"
                  id="csv-upload"
                  accept=".csv,.json,application/json,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setBatchFile(e.target.files[0]);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('csv-upload')?.click()}
                  className="text-xs"
                >
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                  Select File
                </Button>

                {batchFile && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-xs font-mono text-cyan-300">
                    <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
                    {batchFile.name} ({(batchFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {/* Upload & Progress */}
              {batchFile && (
                <div className="space-y-4">
                  {batchUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>Predicting network records...</span>
                      <span className="font-mono">{batchUploading ? 'Waiting for server response' : `${batchProgress}%`}</span>
                    </div>
                    <Progress value={batchProgress} indeterminate={batchUploading} aria-label={batchUploading ? 'Batch prediction in progress' : `Batch prediction ${batchProgress}%`} />
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <Button
                      onClick={handleBatchSubmit}
                      isLoading={batchUploading}
                      className="font-semibold text-xs"
                    >
                      <Zap className="mr-1.5 h-3.5 w-3.5" />
                      Run Batch Inference
                    </Button>
                  </div>
                </div>
              )}

              {/* Batch Results Table */}
              {batchResults && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">Batch Prediction Output</h4>
                      <p className="text-xs text-slate-400">
                        {batchResults.length} records processed •{' '}
                        <span className="text-red-400 font-semibold font-mono">
                          {batchResults.filter((r) => r.is_anomaly).length} anomalies identified
                        </span>
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportBatchCSV}
                      className="text-xs text-cyan-400 border-cyan-500/30 hover:bg-cyan-950/40"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download Predictions CSV
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Verdict</TableHead>
                        <TableHead>Anomaly score</TableHead>
                        <TableHead>Threshold</TableHead>
                        <TableHead>Model</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchResults.slice(0, 10).map((r, i) => (
                        <TableRow key={r.id || i}>
                          <TableCell className="font-mono text-slate-400 text-xs">{i + 1}</TableCell>
                          <TableCell><Badge variant={r.is_anomaly ? 'danger' : 'safe'} dot>{r.prediction.toUpperCase()}</Badge></TableCell>
                          <TableCell className="font-mono text-white">{r.anomaly_score == null ? 'Not returned' : r.anomaly_score.toFixed(4)}</TableCell>
                          <TableCell className="font-mono text-slate-400 text-xs">τ = {r.threshold.toFixed(4)}</TableCell>
                          <TableCell>{r.model_name ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
