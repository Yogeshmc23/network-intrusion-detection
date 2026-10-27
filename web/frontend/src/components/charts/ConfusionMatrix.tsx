import React from 'react';
import { cn, formatNumber, formatPercent } from '@/lib/utils';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface ConfusionMatrixProps {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
  modelName?: string;
  datasetName?: string;
  className?: string;
}

export function ConfusionMatrix({
  tn,
  fp,
  fn,
  tp,
  modelName,
  datasetName,
  className,
}: ConfusionMatrixProps) {
  const total = tn + fp + fn + tp;
  const tnRate = total > 0 ? tn / (tn + fp) : 0;
  const tpRate = total > 0 ? tp / (tp + fn) : 0;
  const fpRate = total > 0 ? fp / (tn + fp) : 0;
  const fnRate = total > 0 ? fn / (tp + fn) : 0;

  return (
    <div className={cn('flex flex-col space-y-4', className)}>
      {(modelName || datasetName) && (
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-2">
          {modelName && <span className="font-semibold text-slate-200">{modelName}</span>}
          {datasetName && (
            <span className="font-mono px-2 py-0.5 rounded bg-slate-800/80 text-cyan-400">
              {datasetName}
            </span>
          )}
        </div>
      )}

      {/* Matrix Grid */}
      <div className="grid grid-cols-2 gap-3 text-center">
        {/* True Negative (Safe / Correct Normal) */}
        <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-md flex flex-col justify-between items-center group hover:border-cyan-400/50 transition-all">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> True Negative (TN)
            </span>
            <span className="text-[11px] font-mono text-cyan-300">
              {formatPercent(tnRate)}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white my-1 group-hover:scale-105 transition-transform">
            {formatNumber(tn)}
          </div>
          <span className="text-[10px] text-slate-400">Normal correctly allowed</span>
        </div>

        {/* False Positive (False Alarm) */}
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-md flex flex-col justify-between items-center group hover:border-amber-400/50 transition-all">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> False Positive (FP)
            </span>
            <span className="text-[11px] font-mono text-amber-300">
              {formatPercent(fpRate)}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300 my-1 group-hover:scale-105 transition-transform">
            {formatNumber(fp)}
          </div>
          <span className="text-[10px] text-slate-400">Normal flagged as threat</span>
        </div>

        {/* False Negative (Critical Missed Intrusion) */}
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/30 backdrop-blur-md flex flex-col justify-between items-center group hover:border-red-400/60 transition-all">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-red-400" /> False Negative (FN)
            </span>
            <span className="text-[11px] font-mono text-red-300">
              {formatPercent(fnRate)}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-red-400 my-1 group-hover:scale-105 transition-transform">
            {formatNumber(fn)}
          </div>
          <span className="text-[10px] text-slate-400">Breach missed (Critical)</span>
        </div>

        {/* True Positive (Caught Threat) */}
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-md flex flex-col justify-between items-center group hover:border-emerald-400/50 transition-all">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> True Positive (TP)
            </span>
            <span className="text-[11px] font-mono text-emerald-300">
              {formatPercent(tpRate)}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white my-1 group-hover:scale-105 transition-transform">
            {formatNumber(tp)}
          </div>
          <span className="text-[10px] text-slate-400">Attack neutralized</span>
        </div>
      </div>

      {/* Summary Rates */}
      <div className="flex items-center justify-around py-2 px-3 rounded-lg bg-slate-900/60 border border-white/5 text-xs text-slate-400 font-mono">
        <div>
          <span>Accuracy: </span>
          <span className="text-white font-semibold">
            {formatPercent((tp + tn) / total)}
          </span>
        </div>
        <div className="h-3 w-px bg-slate-800" />
        <div>
          <span>Recall: </span>
          <span className="text-cyan-400 font-semibold">{formatPercent(tpRate)}</span>
        </div>
        <div className="h-3 w-px bg-slate-800" />
        <div>
          <span>FPR: </span>
          <span className="text-amber-400 font-semibold">{formatPercent(fpRate)}</span>
        </div>
      </div>
    </div>
  );
}
