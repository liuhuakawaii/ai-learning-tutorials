'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Send, Database, BarChart3, FileText, Loader2, Sparkles,
  Table2, TrendingUp, PieChart as PieIcon, Activity, ChevronDown, ChevronUp,
} from 'lucide-react';

interface AnalysisResult {
  query: string;
  sql: string;
  query_result: string;
  analysis: string;
  visualization: string;
  report: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  result?: AnalysisResult;
  timestamp: Date;
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

function parseQueryResult(jsonStr: string) {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return [];
  }
}

function parseVisualization(vizStr: string) {
  try {
    return JSON.parse(vizStr);
  } catch {
    return null;
  }
}

function DataChart({ data, vizConfig }: { data: any[]; vizConfig: any }) {
  if (!data || data.length === 0 || !vizConfig) return null;

  const chartType = vizConfig.chart_type || 'bar';
  const title = vizConfig.title || '数据可视化';
  const keys = Object.keys(data[0]);
  const labelKey = keys[0];
  const valueKeys = keys.slice(1).filter((k: string) => typeof data[0][k] === 'number');

  if (valueKeys.length === 0) return null;

  const chartData = data.slice(0, 20);

  if (chartType === 'pie') {
    return (
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey={valueKeys[0]}
              nameKey={labelKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {chartData.map((_: any, index: number) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'scatter') {
    return (
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={valueKeys[0]} name={valueKeys[0]} />
            <YAxis dataKey={valueKeys[1] || valueKeys[0]} name={valueKeys[1] || valueKeys[0]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={chartData} fill="#0ea5e9" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'line') {
    return (
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={labelKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {valueKeys.map((key, idx) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={labelKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {valueKeys.map((key, idx) => (
            <Bar key={key} dataKey={key} fill={COLORS[idx % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DataTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);
  const [showAll, setShowAll] = useState(false);
  const displayData = showAll ? data : data.slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">查询结果</span>
        </div>
        <span className="text-xs text-gray-500">{data.length} 条记录</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((col) => (
                <th key={col} className="px-4 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, idx) => (
              <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                    {typeof row[col] === 'number' ? row[col].toLocaleString() : String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 10 && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAll ? '收起' : `展开全部 ${data.length} 条`}
          </button>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ result }: { result: AnalysisResult }) {
  const [expanded, setExpanded] = useState(true);
  const data = parseQueryResult(result.query_result);
  const vizConfig = parseVisualization(result.visualization);

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl p-4 border border-primary-100">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-primary-600" />
          <span className="text-sm font-medium text-primary-700">SQL 查询</span>
        </div>
        <pre className="bg-white rounded-lg p-3 text-sm font-mono text-gray-800 overflow-x-auto border border-primary-100">
          {result.sql}
        </pre>
      </div>

      {data.length > 0 && <DataTable data={data} />}

      {data.length > 0 && vizConfig && <DataChart data={data} vizConfig={vizConfig} />}

      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-gray-700">数据分析</span>
        </div>
        <div className="prose prose-sm max-w-none text-gray-600">
          <ReactMarkdown>{result.analysis}</ReactMarkdown>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-gray-700">分析报告</span>
        </div>
        <div className="prose prose-sm max-w-none text-gray-600">
          <ReactMarkdown>{result.report}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.type === 'user') {
    return (
      <div className="flex justify-end animate-fadeIn">
        <div className="max-w-[80%] bg-primary-600 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-sm">
          <p className="text-sm">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'system') {
    return (
      <div className="flex justify-center animate-fadeIn">
        <div className="bg-gray-100 text-gray-500 rounded-full px-4 py-1 text-xs">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fadeIn">
      <div className="max-w-[90%] space-y-3">
        {message.result ? (
          <AnalysisCard result={message.result} />
        ) : (
          <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
            <div className="prose prose-sm max-w-none text-gray-600">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const EXAMPLE_QUERIES = [
  '各部门的预算和人数是多少？',
  '哪个地区的销售额最高？',
  '最近半年的销售趋势如何？',
  '员工绩效评分分布情况',
  '各产品的销售对比',
  '哪些项目还在进行中？',
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: '你好！我是 AI 数据分析助手。你可以用自然语言向我提问，我会帮你查询数据、分析趋势、生成可视化图表和分析报告。\n\n试试问我这些问题：',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (query?: string) => {
    const question = query || input.trim();
    if (!question || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      });

      if (!response.ok) throw new Error('请求失败');

      const result: AnalysisResult = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '分析完成',
        result,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '抱歉，处理请求时出现错误，请稍后重试。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50">
      <header className="glass sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-200">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">AI 数据分析平台</h1>
              <p className="text-xs text-gray-500">多 Agent 驱动 · 智能分析 · 可视化报告</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              系统就绪
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="chat-container space-y-4 pb-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {messages.length === 1 && (
            <div className="grid grid-cols-2 gap-2 mt-4 animate-fadeIn">
              {EXAMPLE_QUERIES.map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(query)}
                  className="text-left p-3 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all duration-200 group"
                >
                  <span className="text-sm text-gray-600 group-hover:text-primary-700">{query}</span>
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 animate-fadeIn">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Agent 正在分析</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="sticky bottom-0 pt-4 pb-6 bg-gradient-to-t from-white via-white to-transparent">
          <div className="glass rounded-2xl shadow-lg border border-gray-200 p-2">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="用自然语言提问，例如：各部门的预算和人数是多少？"
                className="flex-1 resize-none rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-transparent min-h-[44px] max-h-[120px]"
                rows={1}
              />
              <button
                onClick={() => handleSubmit()}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary-200"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
