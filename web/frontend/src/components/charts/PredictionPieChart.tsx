import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { cn, formatNumber, formatPercent } from '@/lib/utils';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface PredictionPieChartProps {
  normalCount: number;
  anomalyCount: number;
  className?: string;
  size?: number;
}

export function PredictionPieChart({
  normalCount = 13449,
  anomalyCount = 11743,
  className,
  size = 220,
}: PredictionPieChartProps) {
  const total = normalCount + anomalyCount;
  const anomalyRate = total > 0 ? anomalyCount / total : 0;
  const normalRate = total > 0 ? normalCount / total : 0;

  const data = [
    { name: 'Normal Traffic', value: normalCount, color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },
    { name: 'Intrusions (Anomaly)', value: anomalyCount, color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
  ];

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const entry = payload[0];
                  const percent = total > 0 ? Number(entry.value) / total : 0;
                  return (
                    <div className="rounded-xl border border-white/10 bg-slate-900/95 p-2.5 text-xs shadow-xl backdrop-blur-md">
                      <p className="font-semibold" style={{ color: entry.payload.color }}>
                        {entry.name}
                      </p>
                      <p className="font-mono text-white text-sm font-bold mt-1">
                        {formatNumber(Number(entry.value))} ({formatPercent(percent)})
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="88%"
              paddingAngle={4}
              dataKey="value"
              stroke="#0f172a"
              strokeWidth={3}
            >
              {data.map((entry, index) => (
                <Cell key={`pie-cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center overlay label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Anomaly Rate
          </span>
          <span className="text-xl font-bold font-mono text-white">
            {formatPercent(anomalyRate, 1)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {formatNumber(total)} total
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-6 text-xs w-full">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
          <span className="text-slate-300 font-medium">Normal:</span>
          <span className="font-mono text-cyan-300 font-semibold">{formatNumber(normalCount)}</span>
          <span className="text-slate-500 font-mono text-[11px]">({formatPercent(normalRate, 1)})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
          <span className="text-slate-300 font-medium">Threats:</span>
          <span className="font-mono text-red-300 font-semibold">{formatNumber(anomalyCount)}</span>
          <span className="text-slate-500 font-mono text-[11px]">({formatPercent(anomalyRate, 1)})</span>
        </div>
      </div>
    </div>
  );
}
