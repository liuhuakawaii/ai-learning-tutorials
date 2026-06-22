# Chrome 应用商店

## 场景引入

你开发了一个优秀的扩展，想让全世界的用户用上它。Chrome 应用商店（Chrome Web Store）是最主要的分发渠道——全球超过 30 亿 Chrome 用户都在这里搜索和安装扩展。

但上架并不是"上传就完事"。你需要准备图标、截图、描述，理解审核规则，优化搜索排名（ASO）。很多开发者因为不了解规则而导致扩展被拒或下架。

本课将讲解 Chrome 应用商店的上架流程、ASO 优化和审核注意事项。

## 学习目标

- 掌握 Chrome 应用商店的上架流程
- 了解 ASO（应用商店优化）策略
- 理解审核规则和常见拒绝原因
- 学会管理扩展版本和更新

## 上架流程

### 注册开发者账号

1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. 使用 Google 账号登录
3. 支付一次性注册费 $5（约 35 元人民币）
4. 同意开发者协议

> **注意**：一个 Google 账号只能注册一个开发者账号。如果你有多个扩展要发布，它们都会在同一个 Dashboard 中管理。注册费是一次性的，不需要每年续费。

### 准备素材

**必需素材：**

| 素材 | 尺寸 | 说明 |
|------|------|------|
| 图标 | 128×128px | 扩展图标，显示在商店中 |
| 截图 | 1280×800px 或 640×400px | 至少 1 张，最多 5 张 |
| 宣传图 | 1400×560px | 可选，显示在扩展详情页顶部 |
| 小图 | 440×280px | 可选，显示在搜索结果中 |

**文案：**

- 扩展名称：最多 45 个字符
- 简短描述：最多 132 个字符
- 详细描述：最多 16,000 个字符
- 类别：选择最相关的类别
- 语言：选择支持的语言

**素材设计要点：**

1. **图标设计**：图标在不同尺寸下都要清晰可辨。建议先设计矢量版本，再导出为 PNG。避免使用过多细节，在 16px 小尺寸下也要能识别。
2. **截图制作**：截图不是简单的功能截图，而是"销售页面"。每张截图应该讲一个故事，配上文字说明用户能获得什么价值。
3. **宣传图**：这是扩展详情页最醒目的视觉元素。建议包含扩展名称、核心功能图标和一句话价值主张。

### 打包扩展

```bash
# 手动打包
cd my-extension
zip -r ../my-extension.zip . -x "*.git*" "node_modules/*" "src/*"

# 使用 WXT
npm run build
npm run zip
```

**打包注意事项：**

- 确保 `.git`、`node_modules`、源码目录等不需要的文件被排除
- 检查 `manifest.json` 中的版本号是否正确
- 确认所有图标文件都包含在打包文件中
- 如果使用构建工具，确保 `dist` 目录下的文件是最新构建结果

### 上传和提交

1. 登录 Developer Dashboard
2. 点击"New Item"
3. 上传 zip 文件
4. 填写商品信息（名称、描述、截图等）
5. 设置可见性（公开/不公开/付费）
6. 提交审核

## ASO 优化

ASO（App Store Optimization）是提高扩展在商店中搜索排名的技术。好的 ASO 策略可以让扩展在不花钱的情况下获得大量自然流量。

### 关键词研究

关键词研究是 ASO 的基础。你需要找到用户实际搜索的词，而不是你自己认为的词。

**关键词来源：**

1. **竞品分析**：查看同类扩展的标题和描述中使用了哪些关键词
2. **Google 搜索建议**：在 Google 搜索框中输入你的核心词，查看自动补全建议
3. **Chrome 商店搜索建议**：在 Chrome 商店搜索框中输入关键词，观察下拉建议
4. **用户评论**：从竞品的用户评论中提取用户使用的词汇
5. **Google Trends**：比较不同关键词的搜索趋势

```javascript
// 关键词研究记录模板
const keywordResearch = {
  // 核心关键词：与扩展功能直接相关
  primary: ['AI 摘要', '网页翻译', '阅读助手'],

  // 长尾关键词：更具体、竞争更小
  longTail: ['网页一键摘要工具', '浏览器划词翻译插件', 'AI 阅读笔记扩展'],

  // 竞品关键词：竞品名称或相关品牌
  competitor: ['有道词典', '沙拉查词', '沉浸式翻译'],

  // 场景关键词：用户使用场景
  scenario: ['论文阅读', '外文新闻', '学术研究'],

  // 记录每个关键词的搜索量和竞争度
  analysis: [
    { keyword: 'AI 摘要', volume: 'high', competition: 'medium' },
    { keyword: '网页翻译', volume: 'very high', competition: 'high' },
    { keyword: '浏览器划词翻译', volume: 'medium', competition: 'low' },
  ]
};
```

### 关键词优化

```markdown
# 标题中包含核心关键词
名称：AI 阅读助手 - 智能摘要与翻译工具

# 详细描述中自然融入关键词
这是一款强大的 AI 阅读助手扩展，支持智能摘要、划词翻译、
阅读笔记等功能。使用先进的 AI 技术，帮助你高效阅读网页内容。
```

**关键词布局原则：**

- **标题**：包含 1-2 个核心关键词，放在标题前半部分
- **简短描述**：包含核心关键词和差异化卖点
- **详细描述**：前 200 字重复核心关键词，全文自然分布 3-5 次
- **类别**：选择与关键词最匹配的类别

> **注意**：不要堆砌关键词。Chrome 商店的搜索算法会惩罚关键词堆砌行为。关键词应该自然地融入描述中，保持可读性。

### 描述优化

```markdown
## 好的描述结构

### 第一段：核心价值（前 132 个字符最重要）
一键摘要、智能翻译、阅读笔记——AI 阅读助手让网页阅读效率提升 10 倍。

### 第二段：主要功能
✦ 智能摘要：一键生成文章摘要，支持多种风格
✦ 划词翻译：选中文字即刻翻译，支持 50+ 语言
✦ 阅读笔记：随时记录想法，自动关联页面

### 第三段：使用场景
适合学生、研究者、内容创作者和任何需要高效阅读的人。

### 第四段：更新日志
v2.0 更新：
- 新增 AI 写作助手
- 支持 PDF 翻译
- 性能优化 50%
```

**描述写作技巧：**

1. **开头即卖点**：用户可能只看前两行就决定是否安装，把最吸引人的价值放在最前面
2. **使用符号和格式**：✦、✓、→ 等符号让描述更易读
3. **具体数字**：说"支持 50+ 语言"比"支持多种语言"更有说服力
4. **解决疑虑**：主动说明隐私保护、数据存储等用户关心的问题
5. **行动号召**：在描述结尾引导用户安装

### 截图优化

1. **第一张截图最重要**：展示核心功能
2. **添加说明文字**：在截图上标注功能点
3. **展示真实场景**：使用真实网页而非空白页面
4. **保持一致性**：所有截图使用相同的风格

**截图进阶技巧：**

- 使用带阴影的设备框让截图更专业
- 在截图中添加箭头和标注，引导用户视线
- 展示"使用前 vs 使用后"的对比效果
- 如果扩展有多种主题，展示暗色模式截图
- 考虑制作简短的 GIF 动图展示操作流程

### 评分和评论

积极的评分和评论对排名至关重要：

1. **在合适时机请求评价**：用户使用扩展一段时间后
2. **提供反馈渠道**：让用户在差评前联系你
3. **回复评论**：积极回复用户评论

```javascript
// 在合适时机请求评价
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    const { installDate, hasRated } = await chrome.storage.local.get([
      'installDate', 'hasRated'
    ]);

    if (!hasRated && installDate) {
      const daysSinceInstall = (Date.now() - installDate) / (1000 * 60 * 60 * 24);
      if (daysSinceInstall > 7) {
        showRatingPrompt();
      }
    }
  }
});
```

```javascript
// 智能评价请求系统
class RatingManager {
  constructor() {
    this.STORAGE_KEY = 'ratingState';
    this.MIN_USAGE_DAYS = 7;        // 至少使用 7 天
    this.MIN_USAGE_COUNT = 20;      // 至少使用 20 次功能
    this.SHOW_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 天内不重复询问
  }

  async shouldShowRatingPrompt() {
    const state = await this.getState();

    // 用户已经评分过，不再显示
    if (state.hasRated) return false;

    // 用户明确拒绝过，在间隔期内不再显示
    if (state.lastDismissed) {
      const timeSinceDismiss = Date.now() - state.lastDismissed;
      if (timeSinceDismiss < this.SHOW_INTERVAL) return false;
    }

    // 检查使用天数
    const daysSinceInstall = (Date.now() - state.installDate) / (1000 * 60 * 60 * 24);
    if (daysSinceInstall < this.MIN_USAGE_DAYS) return false;

    // 检查使用次数
    if (state.usageCount < this.MIN_USAGE_COUNT) return false;

    return true;
  }

  async recordUsage() {
    const state = await this.getState();
    state.usageCount = (state.usageCount || 0) + 1;
    await this.saveState(state);
  }

  async markRated() {
    const state = await this.getState();
    state.hasRated = true;
    await this.saveState(state);
  }

  async markDismissed() {
    const state = await this.getState();
    state.lastDismissed = Date.now();
    await this.saveState(state);
  }

  async getState() {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || {
      installDate: Date.now(),
      usageCount: 0,
      hasRated: false,
      lastDismissed: null
    };
  }

  async saveState(state) {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: state });
  }
}
```

## 上架前检查清单

在点击"提交审核"之前，使用以下清单逐项检查，确保扩展满足所有要求。很多审核拒绝都是因为忽略了基本检查项。

### 基础配置

- [ ] `manifest.json` 中的 `name`、`description`、`version` 字段已填写
- [ ] 版本号使用语义化格式（如 `1.0.0`）
- [ ] 扩展图标已包含 16px、48px、128px 三种尺寸
- [ ] `permissions` 只包含实际使用的权限
- [ ] `host_permissions` 范围尽可能小（避免 `<all_urls>`）

### 隐私与安全

- [ ] 已编写隐私政策并托管在可访问的 URL
- [ ] `privacy_policy_url` 已在 Developer Dashboard 中填写
- [ ] 所有数据收集行为已在隐私政策中声明
- [ ] 不包含未声明的数据收集或追踪代码
- [ ] 使用 HTTPS 进行所有网络请求
- [ ] 敏感数据（如 API Key）已加密存储

### 功能完整性

- [ ] 扩展的核心功能可以正常使用
- [ ] 没有明显的 Bug 或崩溃
- [ ] 错误场景有友好的提示信息
- [ ] 首次使用有引导说明
- [ ] 设置页面功能正常

### 商店素材

- [ ] 128×128px 图标清晰且有辨识度
- [ ] 至少准备 1 张高质量截图（建议 5 张）
- [ ] 截图展示了扩展的核心功能
- [ ] 简短描述不超过 132 个字符
- [ ] 详细描述完整、准确、无拼写错误
- [ ] 宣传图（1400×560px）已准备（推荐）

### 合规检查

- [ ] 不包含商标侵权内容
- [ ] 不包含色情、暴力、仇恨内容
- [ ] 功能描述与实际功能一致
- [ ] 未夸大功能或虚假宣传
- [ ] 遵守 Chrome 应用商店开发者协议

### 权限说明

- [ ] 每个权限都有明确的使用理由
- [ ] 在描述中解释了为什么需要这些权限
- [ ] 考虑使用可选权限（`optional_permissions`）替代必需权限

```json
// 权限说明参考模板（写在详细描述中）
{
  "permissions说明": {
    "activeTab": "获取当前标签页信息，用于在用户点击扩展图标时读取页面内容",
    "storage": "存储用户设置和阅读记录，数据仅保存在本地",
    "notifications": "在摘要生成完成时通知用户"
  }
}
```

## 隐私政策编写指南

Chrome 应用商店要求所有扩展提供隐私政策，即使你不收集任何用户数据。隐私政策是建立用户信任的重要工具。

### 隐私政策必须包含的内容

1. **开发者信息**：公司名称或个人姓名、联系方式
2. **数据收集说明**：收集哪些数据、为什么收集
3. **数据使用说明**：如何使用收集的数据
4. **数据共享说明**：是否与第三方共享数据
5. **数据存储说明**：数据存储在哪里、保留多久
6. **用户权利**：用户如何查看、修改、删除自己的数据
7. **隐私政策更新**：如何通知用户隐私政策的变更

### 隐私政策模板

```markdown
# [扩展名称] 隐私政策

最后更新日期：[日期]

## 开发者信息

开发者：[你的名称或公司名]
联系邮箱：[your-email@example.com]
网站：[你的网站 URL]

## 数据收集

本扩展收集以下类型的数据：

### 1. 用户主动提供的数据
- [设置偏好]：用户在扩展设置页面中配置的选项
- [笔记内容]：用户在使用阅读笔记功能时创建的内容
- 存储方式：使用 Chrome 本地存储 API，数据仅保存在用户设备上

### 2. 自动收集的数据
- [使用统计]：扩展功能的使用次数（不包含具体页面内容）
- [错误日志]：扩展运行时的错误信息（不包含个人信息）
- 收集目的：用于改进扩展功能和稳定性

### 3. 本扩展不收集的数据
- 不收集浏览历史
- 不收集个人信息（姓名、邮箱、电话等）
- 不收集登录凭证或支付信息

## 数据使用

收集的数据仅用于：
- 提供和改进扩展功能
- 分析使用模式以优化用户体验
- 修复 Bug 和提升稳定性

## 数据共享

我们不会将您的数据出售或分享给任何第三方，除非：
- 法律要求
- 保护我们的合法权益

## 数据安全

我们采取合理的技术措施保护您的数据安全：
- 所有网络请求使用 HTTPS 加密传输
- API Key 等敏感信息使用加密存储
- 数据仅存储在用户本地设备上

## 用户权利

您有权：
- 查看扩展存储的所有数据（通过扩展设置页面）
- 删除扩展存储的所有数据（通过扩展设置页面或卸载扩展）
- 选择不参与数据收集（通过设置页面关闭统计功能）

## 儿童隐私

本扩展不面向 13 岁以下儿童，也不会有意收集儿童的个人信息。

## 隐私政策更新

我们可能会不时更新本隐私政策。更新后的隐私政策将在扩展页面和扩展内公布。建议您定期查看本隐私政策的变更。

## 联系我们

如果您对本隐私政策有任何疑问，请通过以下方式联系我们：
- 邮箱：[your-email@example.com]
- GitHub Issues：[你的项目 Issues 页面]
```

### 隐私政策托管

隐私政策需要托管在一个可公开访问的 URL 上。推荐的免费托管方式：

1. **GitHub Pages**：将隐私政策放在项目的 `docs/privacy-policy.md` 中，启用 GitHub Pages
2. **扩展官网**：如果有官网，放在 `/privacy-policy` 路径下
3. **Google Sites**：使用 Google Sites 创建简单页面

```bash
# 使用 GitHub Pages 托管隐私政策
# 1. 在项目根目录创建 privacy-policy.md
# 2. 在 GitHub 仓库设置中启用 GitHub Pages
# 3. 访问 https://username.github.io/repo-name/privacy-policy.html
```

## 审核规则

### 常见拒绝原因

1. **权限过度申请**
   - 申请了不需要的权限
   - 没有解释为什么需要某个权限

2. **功能描述不准确**
   - 描述与实际功能不符
   - 夸大功能或虚假宣传

3. **安全问题**
   - 包含恶意代码
   - 收集用户数据未声明
   - 未遵守隐私政策

4. **商标侵权**
   - 使用了其他品牌的名称或图标
   - 模仿其他知名扩展的界面

5. **内容违规**
   - 包含色情、暴力、仇恨内容
   - 推广非法活动

6. **代码注入**
   - 使用 `eval()` 执行远程代码
   - 从远程服务器加载并执行脚本
   - 动态执行用户提供的代码

```javascript
// ❌ 错误做法：会导致审核拒绝
eval(await fetch('https://example.com/script.js').then(r => r.text()));

// ❌ 错误做法：动态执行远程代码
const script = document.createElement('script');
script.src = 'https://example.com/analytics.js';
document.head.appendChild(script);

// ✅ 正确做法：使用本地打包的脚本
import './analytics.js';
```

### 审核时间

- 新扩展：通常 1-3 个工作日
- 更新：通常 1 小时 - 1 个工作日
- 复杂扩展：可能需要更长时间

### 加速审核

- 确保权限申请合理且有说明
- 提供清晰的隐私政策
- 保持描述与功能一致
- 避免使用敏感关键词
- 第一次提交时就做好充分准备，避免被拒后重新提交

## 版本管理

### 版本号规范

```json
{
  "version": "2.1.0",
  "version_name": "2.1.0 (稳定版)"
}
```

使用语义化版本号：
- 主版本号：重大功能变更或不兼容更新
- 次版本号：新功能添加
- 修订号：Bug 修复

### 灰度发布

Chrome 应用商店支持灰度发布，让部分用户先体验新版本：

1. 在 Developer Dashboard 中选择"Staged Rollout"
2. 设置百分比（如 10%）
3. 观察用户反馈和错误率
4. 逐步增加百分比

```javascript
// 灰度发布监控：记录版本相关的错误
class VersionMonitor {
  constructor() {
    this.version = chrome.runtime.getManifest().version;
    this.errorBuffer = [];
  }

  captureError(error) {
    this.errorBuffer.push({
      version: this.version,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    });

    // 错误超过阈值时上报
    if (this.errorBuffer.length >= 10) {
      this.reportErrors();
    }
  }

  async reportErrors() {
    const errors = [...this.errorBuffer];
    this.errorBuffer = [];

    try {
      await fetch('https://your-api.com/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: this.version, errors })
      });
    } catch (e) {
      // 上报失败，放回缓冲区
      this.errorBuffer.push(...errors);
    }
  }
}
```

### 自动更新

Chrome 会自动更新用户已安装的扩展。更新频率通常为几小时到一天。

```javascript
// 监听更新事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;

    console.log(`从 ${previousVersion} 更新到 ${currentVersion}`);

    // 执行数据迁移
    migrateData(previousVersion, currentVersion);
  }
});
```

```javascript
// 数据迁移示例：处理不同版本的存储格式变化
async function migrateData(fromVersion, toVersion) {
  const [major, minor] = fromVersion.split('.').map(Number);

  // 从 1.x 升级到 2.x：存储格式变化
  if (major < 2) {
    const oldData = await chrome.storage.local.get('settings');
    const newSettings = {
      theme: oldData.settings?.theme || 'light',
      language: oldData.settings?.lang || 'zh-CN',
      // 新增字段使用默认值
      enableNotifications: true,
      storageVersion: 2
    };
    await chrome.storage.local.set({ settings: newSettings });
    console.log('从 v1.x 迁移到 v2.x 完成');
  }

  // 从 2.0 升级到 2.1：新增功能配置
  if (major === 2 && minor < 1) {
    const { settings } = await chrome.storage.local.get('settings');
    if (!settings.aiModel) {
      settings.aiModel = 'default';
      settings.storageVersion = 2.1;
      await chrome.storage.local.set({ settings });
    }
    console.log('从 v2.0 迁移到 v2.1 完成');
  }
}
```

## 分析数据

Chrome Web Store 提供基本的分析数据：

- **安装量**：总安装和活跃用户数
- **评分**：用户评分和评论
- **流量来源**：搜索、直接访问、推荐等
- **用户留存**：用户保留率

**如何利用分析数据：**

1. **关注卸载率**：如果卸载率突然上升，可能是新版本引入了问题
2. **分析流量来源**：如果搜索流量占比低，说明 ASO 优化不足
3. **监控评分变化**：评分下降时及时查看评论，找出问题
4. **对比竞品数据**：了解同类扩展的数据表现，设定合理目标

## 常见误区

### 误区一：忽略描述优化

很多开发者只写几行描述就提交了。详细的描述不仅帮助用户理解功能，也影响搜索排名。

### 误区二：申请过多权限

权限越多，用户越不信任，审核也越严格。只申请真正需要的权限。

### 误区三：不回复用户评论

负面评论不回复会影响评分和下载量。积极回复可以挽回用户信任。

### 误区四：频繁发布小更新

频繁更新可能让用户厌烦。合理规划更新频率，重要更新才发布新版本。

### 误区五：忽视可选权限

很多开发者把所有权限都设为必需，这会增加用户的安装顾虑。对于非核心功能的权限，应该使用 `optional_permissions`，让用户按需授权。

```json
// ❌ 不推荐：所有权限都是必需的
{
  "permissions": ["activeTab", "storage", "tabs", "downloads", "notifications"]
}

// ✅ 推荐：核心权限必需，其他可选
{
  "permissions": ["activeTab", "storage"],
  "optional_permissions": ["tabs", "downloads", "notifications"]
}
```

```javascript
// 运行时请求可选权限
async function requestDownloadPermission() {
  try {
    const granted = await chrome.permissions.request({
      permissions: ['downloads']
    });
    if (granted) {
      // 权限已授予，可以使用下载功能
      return true;
    } else {
      // 用户拒绝了权限请求
      showPermissionDeniedMessage();
      return false;
    }
  } catch (error) {
    console.error('权限请求失败:', error);
    return false;
  }
}
```

## 工程建议

1. **素材准备充分**：高质量的图标、截图和描述是成功的基础
2. **权限最小化**：只申请必要权限，在描述中解释原因
3. **隐私政策必备**：即使不收集数据也要提供隐私政策
4. **版本规划清晰**：使用语义化版本号，规划更新节奏
5. **用户反馈及时**：回复评论，处理问题，持续改进
6. **监控错误率**：使用错误监控工具，及时发现和修复问题
7. **准备回滚方案**：如果新版本出现严重问题，能够快速回滚

## 小结

Chrome 应用商店是扩展分发的主要渠道。通过合理的 ASO 优化、遵守审核规则、管理好版本更新，可以让你的扩展获得更多用户。

## 练习

### 练习一：素材准备

为你的扩展准备完整的上架素材：图标、截图、描述。

### 练习二：描述优化

撰写一份符合 ASO 优化原则的扩展描述。

### 练习三：审核检查

使用审核清单检查你的扩展是否满足上架要求。

---

## 参考答案

### 练习一

**思路**：素材准备需要从用户视角出发，思考用户在商店页面看到什么会愿意安装。图标要简洁有辨识度，截图要讲故事而非单纯展示界面，描述要突出价值而非功能列表。

**答案**：

素材清单：

```
1. 图标（128×128px）
   - 设计简洁明了
   - 与扩展功能相关
   - 在小尺寸下清晰可辨
   - 建议使用矢量设计工具（如 Figma）制作
   - 导出 16px、48px、128px 三种尺寸

2. 截图（1280×800px × 5张）
   - 第1张：核心功能展示（最重要的卖点）
   - 第2张：设置界面（展示可定制性）
   - 第3张：实际使用场景（真实网页中的效果）
   - 第4张：高级功能（吸引进阶用户）
   - 第5张：用户评价或数据统计（社会证明）

3. 宣传图（1400×560px）
   - 展示扩展名称和核心价值
   - 使用品牌色调
   - 包含 2-3 个核心功能图标
   - 添加简短的行动号召文案

4. 小图（440×280px）
   - 用于搜索结果列表
   - 比宣传图更简洁，突出核心价值
```

**要点**：
- 截图不是"功能说明书"，而是"销售页面"
- 第一张截图决定了用户是否继续往下看
- 所有素材保持统一的视觉风格

### 练习二

**思路**：好的描述应该让用户在 30 秒内理解扩展能为他们做什么，并产生安装欲望。结构上应该先讲价值、再讲功能、最后解决疑虑。

**答案**：

```
AI 阅读助手 - 智能摘要与翻译工具

一键摘要、智能翻译、阅读笔记——让网页阅读效率提升 10 倍。

【核心功能】
✦ AI 摘要：一键生成文章摘要，支持简洁/详细/要点三种风格
✦ 划词翻译：选中文字即刻翻译，支持 50+ 语言互译
✦ 阅读笔记：随时记录想法，自动关联页面 URL
✦ 阅读模式：干净的阅读视图，保护眼睛
✦ 阅读统计：追踪阅读时间和文章数量

【适合人群】
- 学生和研究者：快速理解长篇论文和报告
- 内容创作者：高效收集和整理素材
- 职场人士：快速获取行业资讯核心信息

【隐私保护】
- 所有数据存储在本地
- API Key 加密存储
- 不收集任何个人信息

【更新日志】
v2.0：新增 AI 写作助手、PDF 翻译支持
v1.5：性能优化 50%、新增暗色主题
```

**要点**：
- 前 132 个字符是简短描述的内容，必须包含核心价值
- 使用符号（✦、✓）提升可读性
- 主动说明隐私保护，消除用户顾虑
- 包含具体数字（50+ 语言、10 倍效率）增加说服力

### 练习三

**思路**：审核检查不是提交前的临时抱佛脚，而应该贯穿整个开发过程。建议在开发初期就建立检查清单，每完成一个阶段就检查一次。

**答案**：

审核检查清单：

```
□ 基础配置
  - [ ] manifest.json 字段完整（name、description、version）
  - [ ] 图标包含 16px、48px、128px 三种尺寸
  - [ ] 版本号使用语义化格式

□ 权限
  - [ ] 只申请必要权限
  - [ ] 描述中解释了每个权限的用途
  - [ ] 非核心功能使用可选权限

□ 描述
  - [ ] 名称包含核心关键词
  - [ ] 简短描述（132字符）有吸引力
  - [ ] 详细描述完整且准确
  - [ ] 包含使用场景说明

□ 素材
  - [ ] 128px 图标清晰
  - [ ] 至少 1 张截图（建议 5 张）
  - [ ] 截图展示了核心功能
  - [ ] 截图添加了说明文字

□ 隐私
  - [ ] 提供隐私政策 URL
  - [ ] 说明数据收集和使用方式
  - [ ] privacy_policy_url 已在 Dashboard 填写

□ 安全
  - [ ] 无恶意代码
  - [ ] 不收集敏感信息
  - [ ] 使用 HTTPS
  - [ ] 不使用 eval() 或远程代码执行

□ 内容
  - [ ] 无违规内容
  - [ ] 无商标侵权
  - [ ] 功能与描述一致
  - [ ] 未夸大功能或虚假宣传

□ 测试
  - [ ] 核心功能正常运行
  - [ ] 错误场景有友好提示
  - [ ] 在不同 Chrome 版本上测试过
  - [ ] 首次使用有引导说明
```

**要点**：
- 权限和隐私是审核最容易被拒的两个环节
- 描述与功能不一致是常见拒绝原因，务必保持一致
- 建议在开发过程中持续维护这个清单，而非提交前才检查

---

## 常见问题

### Q1：审核被拒后怎么办？

**A**：审核被拒后，Chrome 商店会发送邮件说明拒绝原因。你需要：

1. **仔细阅读拒绝原因**：邮件中会明确指出被拒的具体原因
2. **逐项修复问题**：根据拒绝原因逐一修复
3. **重新提交审核**：修复后重新打包上传
4. **在描述中说明修改**：如果是权限相关的拒绝，在提交时的备注中说明你做了哪些修改

常见拒绝原因的修复时间：
- 权限问题：修改 `manifest.json`，移除不必要的权限
- 描述问题：修改商店描述，使其与功能一致
- 隐私问题：编写隐私政策并填写 URL
- 代码问题：修改代码，移除 `eval()` 或远程代码执行

### Q2：如何提高扩展的搜索排名？

**A**：搜索排名受多个因素影响，按重要性排序：

1. **关键词匹配度**：标题和描述中的关键词与用户搜索词的匹配程度
2. **用户评分**：平均评分和评分数量
3. **安装量**：总安装量和近期安装趋势
4. **用户留存**：用户安装后的使用频率
5. **更新频率**：定期更新的扩展会获得轻微的排名提升

优化建议：
- 在标题中放置最重要的 1-2 个关键词
- 鼓励满意的用户留下评分
- 持续更新扩展，修复问题并添加新功能
- 关注用户评论中的反馈，及时改进

### Q3：扩展被下架了怎么办？

**A**：扩展被下架通常是因为违反了开发者协议或收到用户投诉。处理步骤：

1. **查看下架通知**：Google 会发送邮件说明下架原因
2. **评估问题严重性**：
   - 如果是描述或权限问题：修改后可以重新上架
   - 如果是恶意行为：可能无法恢复，账号也可能被封禁
3. **修复问题并申诉**：在 Developer Dashboard 中提交申诉，说明你做了哪些修改
4. **预防措施**：建立代码审查流程，确保更新不会引入违规内容

### Q4：是否需要为每个国家/地区单独设置商店页面？

**A**：不需要。Chrome 应用商店支持多语言，你可以为同一扩展添加多种语言的描述。操作步骤：

1. 在 Developer Dashboard 中选择"Languages"选项
2. 添加你想支持的语言
3. 为每种语言填写对应的名称、描述和截图
4. Chrome 会根据用户的语言偏好自动显示对应版本

建议至少支持英语和中文，这能覆盖最大范围的用户群体。如果扩展面向全球市场，英语是必须的。
