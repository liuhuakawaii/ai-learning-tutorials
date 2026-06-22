/**
 * 折线图组件
 * 用于展示数据随时间变化的趋势
 */

import React, { useMemo } from 'react';

export interface LineChartProps {
  /** 数据源 */
  data: Record<string, any>[];
  /** X 轴字段名 */
  xField: string;
  /** Y 轴字段名（支持多条线） */
  yFields: string[];
  /** 图表标题 */
  title?: string;
  /** 线条颜色 */
  colors?: string[];
  /** 是否显示网格 */
  showGrid?: boolean;
  /** 是否平滑曲线 */
  smooth?: boolean;
  /** 是否显示数据点 */
  showDots?: boolean;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 点击事件 */
  onPointClick?: (data: any) => void;
}

/**
 * 折线图组件
 * 支持多条折线、平滑曲线、数据点显示等配置
 *
 * @example
 * ```tsx
 * <LineChart
 *   data={[{ month: '1月', sales: 100, profit: 30 }]}
 *   xField="month"
 *   yFields={['sales', 'profit']}
 *   title="月度趋势"
 * />
 * ```
 */
export const LineChart: React.FC<LineChartProps> = ({
  data,
  xField,
  yFields,
  title,
  colors = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f'],
  showGrid = true,
  smooth = true,
  showDots = true,
  width = 600,
  height = 300,
  onPointClick,
}) => {
  /** 计算数据范围用于坐标轴 */
  const { minY, maxY, points } = useMemo(() => {
    if (!data || data.length === 0) {
      return { minY: 0, maxY: 100, points: [] };
    }

    let min = Infinity;
    let max = -Infinity;
    const allPoints: { x: number; y: number; values: Record<string, number> }[] = [];

    data.forEach((item, index) => {
      const x = index;
      const values: Record<string, number> = {};
      yFields.forEach((field) => {
        const val = Number(item[field]) || 0;
        values[field] = val;
        min = Math.min(min, val);
        max = Math.max(max, val);
      });
      allPoints.push({ x, y: 0, values });
    });

    // 留 10% 的上下边距
    const range = max - min || 1;
    return {
      minY: min - range * 0.1,
      maxY: max + range * 0.1,
      points: allPoints,
    };
  }, [data, yFields]);

  /** 将数据值映射到 SVG 坐标 */
  const mapToSVG = (value: number, index: number) => {
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const x = padding + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - ((value - minY) / (maxY - minY)) * chartHeight;
    return { x, y };
  };

  if (!data || data.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
        暂无数据
      </div>
    );
  }

  return (
    <div style={{ width, position: 'relative' }}>
      {title && (
        <h4 style={{ textAlign: 'center', margin: '0 0 8px', fontSize: 14, color: '#333' }}>
          {title}
        </h4>
      )}
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {/* 网格线 */}
        {showGrid &&
          [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = 40 + (height - 80) * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={40}
                y1={y}
                x2={width - 40}
                y2={y}
                stroke="#f0f0f0"
                strokeDasharray="4,4"
              />
            );
          })}

        {/* 折线 */}
        {yFields.map((field, fieldIndex) => {
          const linePoints = data.map((_, i) => {
            const val = Number(data[i][field]) || 0;
            return mapToSVG(val, i);
          });

          const pathD = linePoints
            .map((p, i) => {
              if (i === 0) return `M ${p.x} ${p.y}`;
              if (smooth) {
                const prev = linePoints[i - 1];
                const cpx = (prev.x + p.x) / 2;
                return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
              }
              return `L ${p.x} ${p.y}`;
            })
            .join(' ');

          return (
            <g key={field}>
              <path
                d={pathD}
                fill="none"
                stroke={colors[fieldIndex % colors.length]}
                strokeWidth={2}
              />
              {/* 数据点 */}
              {showDots &&
                linePoints.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill={colors[fieldIndex % colors.length]}
                    stroke="#fff"
                    strokeWidth={1}
                    style={{ cursor: onPointClick ? 'pointer' : 'default' }}
                    onClick={() => onPointClick?.(data[i])}
                  />
                ))}
            </g>
          );
        })}

        {/* X 轴标签 */}
        {data.map((item, i) => {
          const { x } = mapToSVG(0, i);
          return (
            <text
              key={i}
              x={x}
              y={height - 10}
              textAnchor="middle"
              fontSize={11}
              fill="#999"
            >
              {item[xField]}
            </text>
          );
        })}
      </svg>

      {/* 图例 */}
      {yFields.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
          {yFields.map((field, i) => (
            <span key={field} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <span
                style={{
                  width: 12,
                  height: 3,
                  background: colors[i % colors.length],
                  borderRadius: 1,
                  display: 'inline-block',
                }}
              />
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default LineChart;
