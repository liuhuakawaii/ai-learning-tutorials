/**
 * 仪表盘组件
 * 用于展示单一指标的完成度或达标情况
 */

import React, { useMemo } from 'react';

export interface GaugeChartProps {
  /** 当前值 */
  value: number;
  /** 最大值 */
  max?: number;
  /** 最小值 */
  min?: number;
  /** 图表标题 */
  title?: string;
  /** 颜色区间 */
  colorStops?: { threshold: number; color: string }[];
  /** 单位 */
  unit?: string;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
}

/**
 * 仪表盘组件
 * 用弧形进度展示指标值，支持多段颜色区间
 */
export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  max = 100,
  min = 0,
  title,
  colorStops = [
    { threshold: 0.3, color: '#ff4d4f' },
    { threshold: 0.7, color: '#faad14' },
    { threshold: 1, color: '#52c41a' },
  ],
  unit = '%',
  width = 300,
  height = 200,
}) => {
  const { ratio, displayValue, color, pathD } = useMemo(() => {
    const range = max - min;
    const clampedValue = Math.max(min, Math.min(max, value));
    const r = (clampedValue - min) / range;

    // 根据颜色区间确定当前颜色
    let c = colorStops[0]?.color || '#1890ff';
    for (const stop of colorStops) {
      if (r <= stop.threshold) {
        c = stop.color;
        break;
      }
    }

    // 计算弧线路径
    const cx = width / 2;
    const cy = height * 0.75;
    const radius = Math.min(width / 2 - 20, height * 0.6);

    // 弧线从 -210° 到 30°（总共 240°）
    const startAngle = (-210 * Math.PI) / 180;
    const endAngle = (30 * Math.PI) / 180;
    const currentAngle = startAngle + r * (endAngle - startAngle);

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(currentAngle);
    const y2 = cy + radius * Math.sin(currentAngle);
    const x3 = cx + radius * Math.cos(endAngle);
    const y3 = cy + radius * Math.sin(endAngle);

    const largeArc = currentAngle - startAngle > Math.PI ? 1 : 0;
    const bgLargeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    const bgPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${bgLargeArc} 1 ${x3} ${y3}`;
    const progressPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

    return {
      ratio: r,
      displayValue: clampedValue,
      color: c,
      pathD: { bg: bgPath, progress: progressPath, cx, cy, x2, y2, radius },
    };
  }, [value, max, min, width, height, colorStops]);

  return (
    <div style={{ width }}>
      {title && (
        <h4 style={{ textAlign: 'center', margin: '0 0 4px', fontSize: 14, color: '#333' }}>
          {title}
        </h4>
      )}
      <svg width={width} height={height}>
        {/* 背景弧线 */}
        <path
          d={pathD.bg}
          fill="none"
          stroke="#f0f0f0"
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* 进度弧线 */}
        <path
          d={pathD.progress}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* 中心数值 */}
        <text
          x={pathD.cx}
          y={pathD.cy - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={32}
          fontWeight={700}
          fill={color}
        >
          {displayValue}
        </text>
        {/* 单位 */}
        <text
          x={pathD.cx}
          y={pathD.cy + 20}
          textAnchor="middle"
          fontSize={14}
          fill="#999"
        >
          {unit}
        </text>
      </svg>
    </div>
  );
};

export default GaugeChart;
