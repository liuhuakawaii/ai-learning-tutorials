/**
 * 柱状图组件
 * 用于对比不同类别的数据大小
 */

import React, { useMemo } from 'react';

export interface BarChartProps {
  /** 数据源 */
  data: Record<string, any>[];
  /** 分类字段（X 轴） */
  xField: string;
  /** 数值字段（Y 轴，支持多组） */
  yFields: string[];
  /** 图表标题 */
  title?: string;
  /** 柱子颜色 */
  colors?: string[];
  /** 是否堆叠 */
  stacked?: boolean;
  /** 柱子圆角 */
  borderRadius?: number;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 柱子点击事件 */
  onBarClick?: (data: any) => void;
}

/**
 * 柱状图组件
 * 支持分组柱状图和堆叠柱状图两种模式
 */
export const BarChart: React.FC<BarChartProps> = ({
  data,
  xField,
  yFields,
  title,
  colors = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f'],
  stacked = false,
  borderRadius = 4,
  width = 600,
  height = 300,
  onBarClick,
}) => {
  const { maxY, barWidth } = useMemo(() => {
    if (!data || data.length === 0) return { maxY: 100, barWidth: 40 };

    let max = 0;
    data.forEach((item) => {
      if (stacked) {
        const total = yFields.reduce((sum, field) => sum + (Number(item[field]) || 0), 0);
        max = Math.max(max, total);
      } else {
        yFields.forEach((field) => {
          max = Math.max(max, Number(item[field]) || 0);
        });
      }
    });

    const padding = 40;
    const chartWidth = width - padding * 2;
    const groupWidth = chartWidth / data.length;
    const barW = stacked
      ? groupWidth * 0.6
      : (groupWidth * 0.6) / yFields.length;

    return { maxY: max * 1.1, barWidth: barW };
  }, [data, yFields, width, stacked]);

  const mapY = (value: number) => {
    const padding = 40;
    const chartHeight = height - padding * 2;
    return padding + chartHeight - (value / maxY) * chartHeight;
  };

  if (!data || data.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
        暂无数据
      </div>
    );
  }

  const padding = 40;
  const chartWidth = width - padding * 2;
  const groupWidth = chartWidth / data.length;

  return (
    <div style={{ width }}>
      {title && (
        <h4 style={{ textAlign: 'center', margin: '0 0 8px', fontSize: 14, color: '#333' }}>
          {title}
        </h4>
      )}
      <svg width={width} height={height}>
        {/* 网格线 */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding + (height - 80) * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#f0f0f0"
              strokeDasharray="4,4"
            />
          );
        })}

        {/* 柱子 */}
        {data.map((item, i) => {
          const groupX = padding + i * groupWidth + groupWidth * 0.2;

          if (stacked) {
            // 堆叠模式
            let stackY = mapY(0);
            return (
              <g key={i}>
                {yFields.map((field, fi) => {
                  const value = Number(item[field]) || 0;
                  const barHeight = (value / maxY) * (height - 80);
                  const y = stackY - barHeight;
                  stackY = y;

                  return (
                    <rect
                      key={field}
                      x={groupX}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill={colors[fi % colors.length]}
                      rx={fi === yFields.length - 1 ? borderRadius : 0}
                      style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                      onClick={() => onBarClick?.(item)}
                    />
                  );
                })}
              </g>
            );
          }

          // 分组模式
          return (
            <g key={i}>
              {yFields.map((field, fi) => {
                const value = Number(item[field]) || 0;
                const barHeight = (value / maxY) * (height - 80);
                const x = groupX + fi * barWidth;

                return (
                  <rect
                    key={field}
                    x={x}
                    y={mapY(value)}
                    width={barWidth - 2}
                    height={barHeight}
                    fill={colors[fi % colors.length]}
                    rx={borderRadius}
                    style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                    onClick={() => onBarClick?.(item)}
                  />
                );
              })}
            </g>
          );
        })}

        {/* X 轴标签 */}
        {data.map((item, i) => {
          const x = padding + i * groupWidth + groupWidth / 2;
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
    </div>
  );
};

export default BarChart;
