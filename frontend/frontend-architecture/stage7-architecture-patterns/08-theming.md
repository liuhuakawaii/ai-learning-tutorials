# 08. 主题与换肤系统 —— CSS 变量方案、动态主题、暗色模式、用户自定义主题

> 主题切换不是"换个颜色"——它是设计系统的视觉表达层

## 本课目标

- 理解主题系统的设计层次：设计令牌、主题变量、组件样式
- 掌握 CSS 变量实现动态主题的方案
- 实现暗色模式（Dark Mode）的最佳实践
- 设计用户自定义主题功能
- 处理主题切换时的闪屏问题

## 主题系统的设计层次

```
设计令牌（Design Tokens）
  ↓
主题变量（Theme Variables）
  ↓
组件样式（Component Styles）
  ↓
页面布局（Page Layout）
```

### 设计令牌

设计令牌是设计系统中最基础的视觉表达单位：

```typescript
// 设计令牌不是颜色值，而是有语义的变量
const designTokens = {
  // 颜色
  color: {
    primary: '#1890ff',
    success: '#52c41a',
    warning: '#faad14',
    error: '#ff4d4f',
    text: {
      primary: '#000000d9',
      secondary: '#00000073',
      disabled: '#00000040',
    },
    bg: {
      primary: '#ffffff',
      secondary: '#fafafa',
      tertiary: '#f0f0f0',
    },
  },
  // 间距
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  // 字体
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
      xl: 24,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  // 圆角
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },
  // 阴影
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px rgba(0,0,0,0.1)',
    lg: '0 10px 15px rgba(0,0,0,0.1)',
  },
};
```

### 主题变量

主题变量是设计令牌在不同主题下的具体值：

```typescript
// 浅色主题
const lightTheme = {
  colorPrimary: '#1890ff',
  colorBg: '#ffffff',
  colorText: '#000000d9',
  colorBorder: '#d9d9d9',
  colorBgSecondary: '#fafafa',
};

// 暗色主题
const darkTheme = {
  colorPrimary: '#177ddc',
  colorBg: '#141414',
  colorText: '#ffffffd9',
  colorBorder: '#434343',
  colorBgSecondary: '#1f1f1f',
};
```

## CSS 变量实现动态主题

CSS 变量（Custom Properties）是实现动态主题的最佳方案：

```css
/* 定义主题变量 */
:root,
[data-theme="light"] {
  --color-primary: #1890ff;
  --color-bg: #ffffff;
  --color-bg-secondary: #fafafa;
  --color-text: #000000d9;
  --color-text-secondary: #00000073;
  --color-border: #d9d9d9;
  --color-shadow: rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] {
  --color-primary: #177ddc;
  --color-bg: #141414;
  --color-bg-secondary: #1f1f1f;
  --color-text: #ffffffd9;
  --color-text-secondary: #ffffff73;
  --color-border: #434343;
  --color-shadow: rgba(0, 0, 0, 0.3);
}

/* 使用变量 */
body {
  background-color: var(--color-bg);
  color: var(--color-text);
}

.card {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 8px var(--color-shadow);
}

.button-primary {
  background-color: var(--color-primary);
  color: #ffffff;
}
```

### 切换主题

```typescript
// 切换主题只需要修改 data-theme 属性
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 初始化：从 localStorage 读取
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark';
    if (saved) {
      setTheme(saved);
    } else {
      // 跟随系统
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  return { theme, setTheme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light') };
}
```

## 暗色模式最佳实践

### 跟随系统

```typescript
// 监听系统主题变化
function useSystemTheme() {
  const [theme, setTheme] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return theme;
}
```

### 主题策略

```typescript
// 支持三种模式：浅色、深色、跟随系统
type ThemeMode = 'light' | 'dark' | 'system';

function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('themeMode') as ThemeMode) || 'system';
  });

  const systemTheme = useSystemTheme();

  const effectiveTheme = mode === 'system' ? systemTheme : mode;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    localStorage.setItem('themeMode', mode);
  }, [effectiveTheme, mode]);

  return { mode, setMode, effectiveTheme };
}
```

### 暗色模式的颜色设计

```css
/* 暗色模式不是简单的颜色反转 */
/* 需要重新设计颜色层次 */

/* 浅色模式：用白色背景 + 灰色阴影表示层次 */
[data-theme="light"] {
  --bg-elevated: #ffffff;
  --bg-sunken: #f5f5f5;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 暗色模式：用深色背景 + 亮度差异表示层次 */
[data-theme="dark"] {
  --bg-elevated: #1f1f1f;
  --bg-sunken: #141414;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* 暗色模式下的颜色需要降低饱和度 */
[data-theme="light"] {
  --color-error: #ff4d4f;      /* 高饱和度红色 */
  --color-success: #52c41a;    /* 高饱和度绿色 */
}

[data-theme="dark"] {
  --color-error: #a61d24;      /* 低饱和度红色，避免刺眼 */
  --color-success: #49aa19;    /* 低饱和度绿色 */
}
```

## 用户自定义主题

```typescript
// 用户自定义主题配置
interface CustomTheme {
  primaryColor: string;
  borderRadius: number;
  fontSize: number;
  fontFamily: string;
}

// 生成 CSS 变量
function generateThemeCSS(theme: CustomTheme): string {
  return `
    :root {
      --color-primary: ${theme.primaryColor};
      --color-primary-hover: ${adjustColor(theme.primaryColor, -10)};
      --color-primary-active: ${adjustColor(theme.primaryColor, -20)};
      --border-radius: ${theme.borderRadius}px;
      --font-size-base: ${theme.fontSize}px;
      --font-family: ${theme.fontFamily};
    }
  `;
}

// 应用自定义主题
function applyCustomTheme(theme: CustomTheme) {
  let styleEl = document.getElementById('custom-theme');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-theme';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = generateThemeCSS(theme);
}

// 颜色调整工具
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
```

### 预设主题

```typescript
// 预设主题方案
const presetThemes: Record<string, CustomTheme> = {
  default: {
    primaryColor: '#1890ff',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
  },
  purple: {
    primaryColor: '#722ed1',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: '"Helvetica Neue", Helvetica, Arial',
  },
  green: {
    primaryColor: '#52c41a',
    borderRadius: 4,
    fontSize: 15,
    fontFamily: '"PingFang SC", "Microsoft YaHei"',
  },
};

// 主题选择器组件
function ThemePicker() {
  const [customTheme, setCustomTheme] = useState<CustomTheme>(presetThemes.default);

  useEffect(() => {
    applyCustomTheme(customTheme);
    localStorage.setItem('customTheme', JSON.stringify(customTheme));
  }, [customTheme]);

  return (
    <div>
      <h3>预设主题</h3>
      {Object.entries(presetThemes).map(([name, theme]) => (
        <button key={name} onClick={() => setCustomTheme(theme)}>
          {name}
        </button>
      ))}

      <h3>自定义主题</h3>
      <label>
        主题色
        <input
          type="color"
          value={customTheme.primaryColor}
          onChange={(e) => setCustomTheme({ ...customTheme, primaryColor: e.target.value })}
        />
      </label>
      <label>
        圆角
        <input
          type="range"
          min="0"
          max="16"
          value={customTheme.borderRadius}
          onChange={(e) => setCustomTheme({ ...customTheme, borderRadius: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}
```

## 主题切换闪屏问题

```typescript
// 问题：页面加载时先显示默认主题，然后切换到用户选择的主题
// 用户会看到一瞬间的"闪白"或"闪黑"

// 解决方案：在 <head> 中插入脚本，尽早应用主题
// index.html
<script>
  // 这个脚本在 CSS 加载之前执行
  (function() {
    var theme = localStorage.getItem('themeMode') || 'system';
    var effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  })();
</script>
```

```typescript
// React 中使用 useEffect 太晚了（在渲染后执行）
// 需要在渲染前就设置好主题
function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  const saved = localStorage.getItem('themeMode');
  if (saved === 'light' || saved === 'dark') return saved;
  if (saved === 'system' || !saved) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

// 在应用初始化时就设置
const initialTheme = getInitialTheme();
document.documentElement.setAttribute('data-theme', initialTheme);
```

## 练习

### 练习一：设计主题系统

为一个组件库设计主题系统，需要支持：
1. 浅色和暗色模式
2. 自定义主题色
3. 自定义圆角和间距
4. 主题切换不闪屏

### 练习二：实现暗色模式

将以下 CSS 改写为支持暗色模式的版本：

```css
.page {
  background: #ffffff;
  color: #333333;
}

.card {
  background: #f5f5f5;
  border: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.button-primary {
  background: #1890ff;
  color: #ffffff;
}

.text-secondary {
  color: #666666;
}

.divider {
  border-color: #e8e8e8;
}
```

---

## 参考答案

### 练习一

```css
/* 设计令牌 */
:root {
  /* 颜色 */
  --color-primary: #1890ff;
  --color-primary-hover: #40a9ff;
  --color-primary-active: #096dd9;

  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* 圆角 */
  --border-radius-sm: 4px;
  --border-radius-md: 6px;
  --border-radius-lg: 8px;

  /* 字体 */
  --font-size-sm: 12px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
}

/* 主题模式 */
[data-theme="light"] {
  --color-bg: #ffffff;
  --color-bg-secondary: #fafafa;
  --color-text: #000000d9;
  --color-text-secondary: #00000073;
  --color-border: #d9d9d9;
}

[data-theme="dark"] {
  --color-bg: #141414;
  --color-bg-secondary: #1f1f1f;
  --color-text: #ffffffd9;
  --color-text-secondary: #ffffff73;
  --color-border: #434343;
}

/* 自定义主题覆盖 */
[data-theme-color="purple"] {
  --color-primary: #722ed1;
  --color-primary-hover: #9254de;
  --color-primary-active: #531dab;
}

[data-theme-color="green"] {
  --color-primary: #52c41a;
  --color-primary-hover: #73d13d;
  --color-primary-active: #389e0d;
}
```

### 练习二

```css
/* 支持暗色模式的版本 */
:root,
[data-theme="light"] {
  --page-bg: #ffffff;
  --page-text: #333333;
  --card-bg: #f5f5f5;
  --card-border: #e8e8e8;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  --button-primary-bg: #1890ff;
  --button-primary-text: #ffffff;
  --text-secondary: #666666;
  --divider-color: #e8e8e8;
}

[data-theme="dark"] {
  --page-bg: #141414;
  --page-text: #ffffffd9;
  --card-bg: #1f1f1f;
  --card-border: #434343;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  --button-primary-bg: #177ddc;
  --button-primary-text: #ffffff;
  --text-secondary: #ffffff73;
  --divider-color: #434343;
}

.page {
  background: var(--page-bg);
  color: var(--page-text);
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
}

.button-primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.text-secondary {
  color: var(--text-secondary);
}

.divider {
  border-color: var(--divider-color);
}
```

## 下一步

完成本课后，继续学习 [09. 架构演进策略](./09-architecture-evolution.md)。
