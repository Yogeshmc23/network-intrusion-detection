import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn, formatPercent } from '@/lib/utils';

export interface ModelMetricData {
  model: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
}

interface MetricsBarChartProps {
  data: ModelMetricData[];
  className?: string;
  height?: number;
}

export function MetricsBarChart({
  data,
  className,
  height = 300,
}: MetricsBarChartProps) {
  return (
    <div className={cn('w-full', className)}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
            <XAxis dataKey="model" stroke="#64748b" fontSize={11} />
            <YAxis domain={[0, 1.0]} stroke="#64748b" fontSize={11} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs shadow-xl backdrop-blur-md">
                      <p className="font-bold text-white mb-2">{label}</p>
                      <div className="space-y-1 font-mono">
                        {payload.map((item: any) => (
                          <div key={item.name} className="flex items-center justify-between gap-4">
                            <span style={{ color: item.color }}>{item.name}:</span>
                            <span className="text-white font-semibold">
                              {formatPercent(item.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
              iconType="circle"
            />
            <Bar dataKey="accuracy" name="Accuracy" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="precision" name="Precision" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="recall" name="Recall" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="f1" name="F1-Score" fill="#0284c7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
