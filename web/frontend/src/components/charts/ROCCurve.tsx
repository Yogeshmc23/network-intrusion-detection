import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

// Holdout ROC points computed from the retrained fit-subset models
// (same split as results/metrics.csv; TPR interpolated on an FPR grid).
const basePoints = [
  { fpr: 0.0, dt_all: 0.0, svm_all: 0.0, dt_top30: 0.0, nb_top30: 0.0, chance: 0.0 },
  { fpr: 0.001, dt_all: 0.4468, svm_all: 0.579, dt_top30: 0.0986, nb_top30: 0.0441, chance: 0.001 },
  { fpr: 0.002, dt_all: 0.8936, svm_all: 0.9306, dt_top30: 0.1971, nb_top30: 0.0882, chance: 0.002 },
  { fpr: 0.005, dt_all: 0.9966, svm_all: 0.957, dt_top30: 0.4928, nb_top30: 0.2206, chance: 0.005 },
  { fpr: 0.01, dt_all: 0.9966, svm_all: 0.9885, dt_top30: 0.9857, nb_top30: 0.4412, chance: 0.01 },
  { fpr: 0.02, dt_all: 0.9967, svm_all: 0.994, dt_top30: 0.9899, nb_top30: 0.8824, chance: 0.02 },
  { fpr: 0.05, dt_all: 0.9968, svm_all: 0.997, dt_top30: 0.9902, nb_top30: 0.9476, chance: 0.05 },
  { fpr: 0.1, dt_all: 0.9969, svm_all: 0.9979, dt_top30: 0.9907, nb_top30: 0.9596, chance: 0.1 },
  { fpr: 0.2, dt_all: 0.9973, svm_all: 0.9983, dt_top30: 0.9917, nb_top30: 0.9693, chance: 0.2 },
  { fpr: 0.5, dt_all: 0.9983, svm_all: 0.9996, dt_top30: 0.9948, nb_top30: 0.9991, chance: 0.5 },
  { fpr: 1.0, dt_all: 1.0, svm_all: 1.0, dt_top30: 1.0, nb_top30: 1.0, chance: 1.0 },
];

export function ROCCurve({ className }: { className?: string }) {
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    dt_all: true,
    svm_all: true,
    dt_top30: true,
    nb_top30: true,
  });

  const toggleModel = (key: string) => {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const models = [
    { key: 'dt_all', name: 'Decision Tree [All features] (AUC: 0.9972)', color: '#06b6d4' },
    { key: 'svm_all', name: 'SVM (RBF) [All features] (AUC: 0.9981)', color: '#10b981' },
    { key: 'dt_top30', name: 'Decision Tree [Top-30] (AUC: 0.9899)', color: '#a855f7' },
    { key: 'nb_top30', name: 'Naive Bayes [Top-30] (AUC: 0.9787)', color: '#f59e0b' },
  ];

  return (
    <div className={cn('flex flex-col space-y-4', className)}>
      {/* Model toggle filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 mr-1">Toggle Models:</span>
        {models.map((m) => {
          const isActive = visibleLines[m.key];
          return (
            <button
              key={m.key}
              onClick={() => toggleModel(m.key)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5',
                isActive
                  ? 'bg-slate-800 text-slate-100 font-medium'
                  : 'bg-slate-900/40 text-slate-500 border-slate-800 line-through opacity-60'
              )}
              style={{
                borderColor: isActive ? m.color : undefined,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              {m.name.split(' (')[0]}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={basePoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis
              dataKey="fpr"
              domain={[0, 1]}
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => Number(v).toFixed(2)}
              label={{ value: 'False Positive Rate (FPR)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              domain={[0, 1.05]}
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => Number(v).toFixed(2)}
              label={{ value: 'True Positive Rate (TPR)', angle: -90, position: 'insideLeft', offset: 25, fill: '#64748b', fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs shadow-xl backdrop-blur-md">
                      <p className="font-mono text-cyan-300 font-semibold mb-2">
                        FPR: {Number(label).toFixed(4)}
                      </p>
                      <div className="space-y-1">
                        {payload.map((entry: any) => (
                          <div key={entry.name} className="flex items-center justify-between gap-4 font-mono">
                            <span style={{ color: entry.color }}>{entry.name}:</span>
                            <span className="text-white font-bold">{Number(entry.value).toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* 99.5% recall horizontal reference line */}
            <ReferenceLine
              y={0.995}
              stroke="#06b6d4"
              strokeDasharray="4 4"
              label={{
                value: 'Recall 99.5% (reference)',
                position: 'insideBottomRight',
                fill: '#06b6d4',
                fontSize: 10,
              }}
            />

            {/* Diagonal reference line */}
            <Line
              type="linear"
              dataKey="chance"
              name="Random Chance"
              stroke="#475569"
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
            />

            {visibleLines.dt_all && (
              <Line
                type="monotone"
                dataKey="dt_all"
                name="Decision Tree [All features]"
                stroke="#06b6d4"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#06b6d4' }}
              />
            )}
            {visibleLines.svm_all && (
              <Line
                type="monotone"
                dataKey="svm_all"
                name="SVM (RBF) [All features]"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            )}
            {visibleLines.dt_top30 && (
              <Line
                type="monotone"
                dataKey="dt_top30"
                name="Decision Tree [Top-30]"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
            )}
            {visibleLines.nb_top30 && (
              <Line
                type="monotone"
                dataKey="nb_top30"
                name="Naive Bayes [Top-30]"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
