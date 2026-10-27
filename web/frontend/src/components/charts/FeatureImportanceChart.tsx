import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
  category?: 'basic' | 'content' | 'traffic' | 'host';
  description?: string;
}

const defaultFeatures: FeatureImportanceItem[] = [
  { feature: 'src_bytes', importance: 0.287999, category: 'basic', description: 'Number of bytes from source to destination' },
  { feature: 'service', importance: 0.027485, category: 'basic', description: 'Network service on destination (e.g., http, ftp)' },
  { feature: 'hot', importance: 0.006700, category: 'content', description: 'Number of hot indicators (system file access, etc.)' },
  { feature: 'dst_host_same_src_port_rate', importance: 0.005558, category: 'host', description: '% of connections to same src port on dst host' },
  { feature: 'dst_bytes', importance: 0.003243, category: 'basic', description: 'Number of bytes from destination to source' },
  { feature: 'dst_host_same_srv_rate', importance: 0.002390, category: 'host', description: '% of connections to same service on dst host' },
  { feature: 'dst_host_serror_rate', importance: 0.001982, category: 'host', description: '% of connections with SYN error on dst host' },
  { feature: 'count', importance: 0.001546, category: 'traffic', description: 'Connections to same host as current in past 2s' },
  { feature: 'duration', importance: 0.001132, category: 'basic', description: 'Length of connection in seconds' },
  { feature: 'dst_host_srv_diff_host_rate', importance: 0.000851, category: 'host', description: '% of diff hosts for service on dst host' },
  { feature: 'same_srv_rate', importance: 0.000706, category: 'traffic', description: '% of connections to the same service' },
  { feature: 'dst_host_srv_serror_rate', importance: 0.000704, category: 'host', description: '% of connections to same service with SYN error' },
  { feature: 'dst_host_diff_srv_rate', importance: 0.000567, category: 'host', description: '% of connections to diff services on dst host' },
  { feature: 'dst_host_srv_count', importance: 0.000285, category: 'host', description: 'Connections to same service on dst host in past 2s' },
  { feature: 'protocol_type', importance: 0.000280, category: 'basic', description: 'Transport layer protocol (tcp, udp, icmp)' },
  { feature: 'flag', importance: 0.000141, category: 'basic', description: 'Normal or error connection state flag' },
];

interface FeatureImportanceChartProps {
  data?: FeatureImportanceItem[];
  onSelectFeature?: (feature: FeatureImportanceItem) => void;
  className?: string;
  limit?: number;
}

export function FeatureImportanceChart({
  data = defaultFeatures,
  onSelectFeature,
  className,
  limit = 15,
}: FeatureImportanceChartProps) {
  const chartData = [...data]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit);

  const getBarColor = (index: number) => {
    if (index === 0) return '#06b6d4'; // highest is cyan
    if (index < 3) return '#38bdf8';
    if (index < 7) return '#818cf8';
    return '#8b5cf6'; // purple gradient towards bottom
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 10, right: 30, left: 110, bottom: 5 }}
            onClick={(state) => {
              if (state && state.activePayload && state.activePayload.length) {
                onSelectFeature?.(state.activePayload[0].payload);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} horizontal={false} />
            <XAxis
              type="number"
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => Number(v).toFixed(3)}
            />
            <YAxis
              type="category"
              dataKey="feature"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              fontFamily="monospace"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as FeatureImportanceItem;
                  return (
                    <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3.5 text-xs shadow-xl backdrop-blur-md max-w-xs">
                      <p className="font-mono font-bold text-cyan-300 text-sm mb-1">{item.feature}</p>
                      <div className="flex items-center gap-2 mb-2 font-mono">
                        <span className="text-slate-400">Permutation Score:</span>
                        <span className="text-white font-bold">{item.importance.toFixed(6)}</span>
                      </div>
                      {item.description && (
                        <p className="text-slate-300 text-[11px] leading-relaxed border-t border-white/5 pt-1.5">
                          {item.description}
                        </p>
                      )}
                      {item.category && (
                        <span className="mt-2 inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 border border-purple-500/20">
                          {item.category} feature
                        </span>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="importance"
              radius={[0, 6, 6, 0]}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
