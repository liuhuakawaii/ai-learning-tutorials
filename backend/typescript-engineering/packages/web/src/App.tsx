import { useState, useCallback, useEffect } from 'react';
import type { User, Tool, ApiResponse, PaginatedResponse } from '@ts-tool-platform/shared-types';
import { UserStatus, UserRole } from '@ts-tool-platform/shared-types';

/** 工具卡片组件属性 */
interface ToolCardProps {
  tool: Tool;
  onSelect: (tool: Tool) => void;
}

/** 工具卡片 — 展示单个工具的摘要信息 */
function ToolCard({ tool, onSelect }: ToolCardProps) {
  return (
    <div
      style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, cursor: 'pointer' }}
      onClick={() => onSelect(tool)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(tool)}
    >
      <h3 style={{ margin: '0 0 8px' }}>{tool.name}</h3>
      <p style={{ margin: 0, color: '#64748b' }}>{tool.description}</p>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>v{tool.version}</span>
    </div>
  );
}

/** 用户头像组件属性 */
interface UserAvatarProps {
  user: Pick<User, 'name' | 'role'>;
  size?: number;
}

/** 用户头像 — 显示用户名首字母 */
function UserAvatar({ user, size = 40 }: UserAvatarProps) {
  const initial = user.name.charAt(0).toUpperCase();
  const bgColor = user.role === UserRole.Admin ? '#ef4444' : user.role === UserRole.Editor ? '#3b82f6' : '#6b7280';
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: bgColor,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: size * 0.4,
      }}
      title={`${user.name} (${user.role})`}
    >
      {initial}
    </div>
  );
}

/** 应用主组件 */
export default function App() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  /** 加载工具列表 */
  const loadTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 实际项目中应调用 API，这里使用模拟数据
      const mockTools: Tool[] = [
        {
          id: '1',
          name: 'JSON 格式化',
          slug: 'json-formatter',
          description: '格式化和校验 JSON 数据',
          category: '开发工具',
          authorId: 'user-1',
          isPublic: true,
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Base64 编解码',
          slug: 'base64',
          description: 'Base64 编码和解码工具',
          category: '编码工具',
          authorId: 'user-1',
          isPublic: true,
          version: '1.2.0',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      setTools(mockTools);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold' }}>TS 工具平台</h1>
        <UserAvatar user={{ name: '管理员', role: UserRole.Admin }} />
      </header>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>工具列表</h2>
        {loading && <p>加载中...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onSelect={setSelectedTool} />
          ))}
        </div>
      </section>

      {selectedTool && (
        <section style={{ marginTop: 32, padding: 16, backgroundColor: '#f8fafc', borderRadius: 8 }}>
          <h3>{selectedTool.name}</h3>
          <p>{selectedTool.description}</p>
          <p>分类：{selectedTool.category}</p>
          <p>版本：{selectedTool.version}</p>
          <button onClick={() => setSelectedTool(null)}>关闭</button>
        </section>
      )}
    </div>
  );
}
