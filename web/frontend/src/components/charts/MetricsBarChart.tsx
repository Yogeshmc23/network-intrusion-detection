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

// Fallback defaults: actual holdout rows from results/metrics.csv
const defaultData: ModelMetricData[] = [
  {
    model: 'DT (All)',
    accuracy: 0.9972,
    precision: 0.9974,
    recall: 0.9966,
    f1: 0.9970,
    rocAuc: 0.9972,
  },
  {
    model: 'NB (All)',
    accuracy: 0.7146,
    precision: 0.9935,
    recall: 0.3904,
    f1: 0.5605,
    rocAuc: 0.9804,
  },
  {
    model: 'SVM (All)',
    accuracy: 0.9895,
    precision: 0.9869,
    recall: 0.9906,
    f1: 0.9887,
    rocAuc: 0.9981,
  },
  {
    model: 'DT (Top-30)',
    accuracy: 0.9895,
    precision: 0.9881,
    recall: 0.9894,
    f1: 0.9887,
    rocAuc: 0.9899,
  },
  {
    model: 'NB (Top-30)',
    accuracy: 0.9430,
    precision: 0.9296,
    recall: 0.9498,
    f1: 0.9396,
    rocAuc: 0.9787,
  },
  {
    model: 'SVM (Top-30)',
    accuracy: 0.9788,
    precision: 0.9891,
    recall: 0.9651,
    f1: 0.9769,
    rocAuc: 0.9963,
  },
];

interface MetricsBarChartProps {
  data?: ModelMetricData[];
  className?: string;
  height?: number;
}

export function MetricsBarChart({
  data = defaultData,
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
            <Bar dataKey="f1" name="F1-Score" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
