/**
 * 饼图组件
 * 用于展示各部分占总体的比例关系
 */

import React, { useMemo } from 'react';

export interface PieChartProps {
  /** 数据源 */
  data: { name: string; value: number }[];
  /** 图表标题 */
  title?: string;
  /** 扇区颜色 */
  colors?: string[];
  /** 内环半径（0 为饼图，> 0 为环形图） */
  innerRadius?: number;
  /** 是否显示标签 */
  showLabel?: boolean;
  /** 是否显示百分比 */
  showPercent?: boolean;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 扇区点击事件 */
  onSliceClick?: (data: { name: string; value: number }) => void;
}

/**
 * 饼图/环形图组件
 * 通过 innerRadius 配置可切换饼图和环形图样式
 */
export const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  colors = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96'],
  innerRadius = 0,
  showLabel = true,
  showPercent = true,
  width = 400,
  height = 400,
  onSliceClick,
}) => {
  const { slices, total } = useMemo(() => {
    if (!data || data.length === 0) return { slices: [], total: 0 };

    const t = data.reduce((sum, d) => sum + d.value, 0);
    let startAngle = -Math.PI / 2; // 从顶部开始

    const s = data.map((item, index) => {
      const ratio = item.value / t;
      const angle = ratio * Math.PI * 2;
      const endAngle = startAngle + angle;

      // 计算 SVG 弧线路径
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) / 2 - 40;
      const innerR = innerRadius * radius;

      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);

      const ix1 = cx + innerR * Math.cos(startAngle);
      const iy1 = cy + innerR * Math.sin(startAngle);
      const ix2 = cx + innerR * Math.cos(endAngle);
      const iy2 = cy + innerR * Math.sin(endAngle);

      const largeArc = angle > Math.PI ? 1 : 0;

      const path = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix2} ${iy2}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
        'Z',
      ].join(' ');

      // 标签位置（扇区中间角度）
      const midAngle = startAngle + angle / 2;
      const labelRadius = radius * 0.7;
      const labelX = cx + labelRadius * Math.cos(midAngle);
      const labelY = cy + labelRadius * Math.sin(midAngle);

      const slice = {
        ...item,
        path,
        color: colors[index % colors.length],
        ratio,
        percent: (ratio * 100).toFixed(1),
        labelX,
        labelY,
      };

      startAngle = endAngle;
      return slice;
    });

    return { slices: s, total: t };
  }, [data, width, height, innerRadius, colors]);

  if (!data || data.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
        暂无数据
      </div>
    );
  }

  return (
    <div style={{ width }}>
      {title && (
        <h4 style={{ textAlign: 'center', margin: '0 0 8px', fontSize: 14, color: '#333' }}>
          {title}
        </h4>
      )}
      <svg width={width} height={height}>
        {/* 扇区 */}
        {slices.map((slice, i) => (
          <g key={i}>
            <path
              d={slice.path}
              fill={slice.color}
              stroke="#fff"
              strokeWidth={2}
              style={{ cursor: onSliceClick ? 'pointer' : 'default', transition: 'opacity 0.2s' }}
              onClick={() => onSliceClick?.({ name: slice.name, value: slice.value })}
            />
            {/* 标签 */}
            {showLabel && slice.ratio > 0.05 && (
              <text
                x={slice.labelX}
                y={slice.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fill="#fff"
                fontWeight={600}
              >
                {slice.name}
                {showPercent && `\n${slice.percent}%`}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* 图例 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8 }}>
        {slices.map((slice, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: slice.color,
                display: 'inline-block',
              }}
            />
            {slice.name} ({slice.percent}%)
          </span>
        ))}
      </div>
    </div>
  );
};

export default PieChart;
