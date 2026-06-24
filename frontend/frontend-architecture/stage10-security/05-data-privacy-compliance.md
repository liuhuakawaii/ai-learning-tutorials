# 05. 数据隐私与合规

> 数据隐私不是"法律要求"，而是"对用户信任的尊重"

## 本课目标

- 理解 GDPR、CCPA 等隐私法规的核心要求
- 掌握 Cookie 同意管理的实现
- 学会数据最小化和隐私设计
- 了解隐私政策和用户权利

## 从一个真实场景说起

假设你在维护一个面向全球用户的网站，遇到了这些问题：

1. **用户投诉**：用户要求删除他们的数据
2. **法律风险**：收到隐私合规整改通知
3. **Cookie 问题**：用户投诉 Cookie 追踪
4. **数据泄露**：用户数据被泄露，面临法律诉讼

这些问题的根源是**数据隐私合规不足**。

## 隐私法规概览

### GDPR（欧盟通用数据保护条例）

**适用范围**：处理欧盟居民数据的所有组织

**核心原则**：
1. 合法性、公平性和透明性
2. 目的限制
3. 数据最小化
4. 准确性
5. 存储限制
6. 完整性和保密性
7. 问责制

**用户权利**：
- 访问权
- 更正权
- 删除权（被遗忘权）
- 限制处理权
- 数据可携带权
- 反对权

**处罚**：
- 最高 2000 万欧元或全球年营业额的 4%

### CCPA（加州消费者隐私法案）

**适用范围**：处理加州居民数据的营利性企业

**核心权利**：
- 知情权
- 删除权
- 退出权（不出售个人信息）
- 非歧视权

**处罚**：
- 每次违规最高 7500 美元

### 其他法规

| 法规 | 地区 | 特点 |
|------|------|------|
| PIPEDA | 加拿大 | 基于同意 |
| LGPD | 巴西 | 类似 GDPR |
| PDPA | 新加坡 | 基于同意 |
| PIPL | 中国 | 数据本地化 |

## Cookie 同意

### Cookie 类型

```javascript
// 必要 Cookie（不需要同意）
document.cookie = 'session=abc123; path=/; HttpOnly; Secure; SameSite=strict';

// 功能 Cookie（建议同意）
document.cookie = 'theme=dark; path=/; max-age=31536000';

// 分析 Cookie（需要同意）
document.cookie = '_ga=GA1.2....; path=/; max-age=31536000';

// 营销 Cookie（需要同意）
document.cookie = '_fbp=fb.1....; path=/; max-age=31536000';
```

### Cookie 同意管理

```javascript
// Cookie 同意管理器
class CookieConsent {
  constructor() {
    this.consent = this.getConsent();
  }

  getConsent() {
    const stored = localStorage.getItem('cookie-consent');
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false
    };
  }

  setConsent(consent) {
    this.consent = consent;
    localStorage.setItem('cookie-consent', JSON.stringify(consent));
    
    // 根据同意设置 Cookie
    if (consent.analytics) {
      this.setAnalyticsCookies();
    }
    if (consent.marketing) {
      this.setMarketingCookies();
    }
  }

  setAnalyticsCookies() {
    // 设置分析 Cookie
    document.cookie = '_ga=GA1.2....; path=/; max-age=31536000';
  }

  setMarketingCookies() {
    // 设置营销 Cookie
    document.cookie = '_fbp=fb.1....; path=/; max-age=31536000';
  }

  hasConsent(type) {
    return this.consent[type] || false;
  }
}

export default new CookieConsent();
```

### Cookie 同意 UI

```jsx
// Cookie 同意横幅
import React, { useState, useEffect } from 'react';
import cookieConsent from './cookie-consent';

function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false
  });

  useEffect(() => {
    // 检查是否已设置同意
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const consent = {
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true
    };
    cookieConsent.setConsent(consent);
    setVisible(false);
  };

  const handleRejectAll = () => {
    const consent = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false
    };
    cookieConsent.setConsent(consent);
    setVisible(false);
  };

  const handleSavePreferences = () => {
    cookieConsent.setConsent(preferences);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner">
      <h3>Cookie 设置</h3>
      <p>我们使用 Cookie 来改善您的体验。</p>
      
      <div className="cookie-options">
        <label>
          <input
            type="checkbox"
            checked={preferences.necessary}
            disabled
          />
          必要 Cookie
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={preferences.functional}
            onChange={(e) => setPreferences({
              ...preferences,
              functional: e.target.checked
            })}
          />
          功能 Cookie
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={preferences.analytics}
            onChange={(e) => setPreferences({
              ...preferences,
              analytics: e.target.checked
            })}
          />
          分析 Cookie
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={preferences.marketing}
            onChange={(e) => setPreferences({
              ...preferences,
              marketing: e.target.checked
            })}
          />
          营销 Cookie
        </label>
      </div>
      
      <div className="cookie-actions">
        <button onClick={handleAcceptAll}>全部接受</button>
        <button onClick={handleRejectAll}>全部拒绝</button>
        <button onClick={handleSavePreferences}>保存设置</button>
      </div>
    </div>
  );
}

export default CookieBanner;
```

## 数据最小化

### 1. 只收集必要数据

```javascript
// 不推荐：收集过多数据
const userData = {
  name: req.body.name,
  email: req.body.email,
  phone: req.body.phone,
  address: req.body.address,
  birthday: req.body.birthday,
  gender: req.body.gender,
  // ... 更多不必要的字段
};

// 推荐：只收集必要数据
const userData = {
  name: req.body.name,
  email: req.body.email
};
```

### 2. 匿名化数据

```javascript
// 匿名化用户数据
function anonymizeData(data) {
  return {
    ...data,
    email: maskEmail(data.email),
    ip: maskIP(data.ip)
  };
}

function maskEmail(email) {
  const [name, domain] = email.split('@');
  return `${name.charAt(0)}***@${domain}`;
}

function maskIP(ip) {
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.***.***`;
}
```

### 3. 数据保留策略

```javascript
// 数据保留策略
const retentionPolicies = {
  analytics: {
    retention: 365 * 2, // 2 年
    anonymize: true
  },
  user_data: {
    retention: 365 * 5, // 5 年
    anonymize: false
  },
  logs: {
    retention: 90, // 90 天
    anonymize: true
  }
};

// 自动清理过期数据
function cleanExpiredData() {
  const now = Date.now();
  
  Object.entries(retentionPolicies).forEach(([type, policy]) => {
    const cutoff = now - policy.retention * 24 * 60 * 60 * 1000;
    
    if (policy.anonymize) {
      anonymizeOldData(type, cutoff);
    } else {
      deleteOldData(type, cutoff);
    }
  });
}
```

## 隐私设计

### 1. 默认隐私

```javascript
// 默认隐私设置
const defaultPrivacySettings = {
  profileVisible: false,
  showEmail: false,
  showPhone: false,
  allowTracking: false,
  allowAnalytics: false
};
```

### 2. 隐私友好的分析

```javascript
// 不使用第三方追踪的分析
class PrivacyFriendlyAnalytics {
  constructor() {
    this.events = [];
  }

  track(event, data) {
    // 不发送用户标识符
    this.events.push({
      event,
      data: this.anonymize(data),
      timestamp: Date.now()
    });
  }

  anonymize(data) {
    const anonymized = { ...data };
    delete anonymized.userId;
    delete anonymized.email;
    delete anonymized.ip;
    return anonymized;
  }

  send() {
    // 批量发送，减少请求
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.events)
    });
    
    this.events = [];
  }
}
```

### 3. 隐私友好的 Cookie

```javascript
// 设置隐私友好的 Cookie
function setPrivacyFriendlyCookie(name, value) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=strict; Secure`;
  
  // 不使用第三方 Cookie
  // 不设置跨站 Cookie
  // 不使用 Cookie 进行追踪
}
```

## 用户权利实现

### 1. 数据访问请求

```javascript
// 用户数据导出
app.get('/api/user/data-export', async (req, res) => {
  const userId = req.session.userId;
  
  // 收集用户数据
  const userData = await User.findById(userId);
  const userPosts = await Post.find({ userId });
  const userComments = await Comment.find({ userId });
  
  // 创建导出文件
  const exportData = {
    profile: userData,
    posts: userPosts,
    comments: userComments,
    exportDate: new Date().toISOString()
  };
  
  // 返回 JSON 文件
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}.json"`);
  res.json(exportData);
});
```

### 2. 删除请求

```javascript
// 用户数据删除
app.delete('/api/user/data', async (req, res) => {
  const userId = req.session.userId;
  
  // 删除用户数据
  await User.findByIdAndDelete(userId);
  await Post.deleteMany({ userId });
  await Comment.deleteMany({ userId });
  
  // 清除 Cookie
  res.clearCookie('session');
  
  // 记录删除操作（用于审计）
  await AuditLog.create({
    action: 'USER_DATA_DELETED',
    userId,
    timestamp: new Date()
  });
  
  res.json({ success: true });
});
```

### 3. 同意管理

```javascript
// 同意记录
const consentSchema = new mongoose.Schema({
  userId: String,
  consentType: String,
  granted: Boolean,
  timestamp: Date,
  ipAddress: String,
  userAgent: String
});

// 记录同意
app.post('/api/user/consent', async (req, res) => {
  const { consentType, granted } = req.body;
  const userId = req.session.userId;
  
  await Consent.create({
    userId,
    consentType,
    granted,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.json({ success: true });
});

// 获取同意记录
app.get('/api/user/consent', async (req, res) => {
  const userId = req.session.userId;
  const consents = await Consent.find({ userId });
  res.json(consents);
});
```

## 隐私政策

### 隐私政策模板

```markdown
# 隐私政策

## 我们收集什么信息？

我们收集以下信息：
- 您提供的信息（注册、购买等）
- 自动收集的信息（IP、浏览器、设备等）
- Cookie 和类似技术

## 我们如何使用您的信息？

- 提供服务
- 改进服务
- 与您沟通
- 遵守法律

## 我们如何保护您的信息？

- 加密传输
- 访问控制
- 安全审计
- 员工培训

## 您的权利？

- 访问您的数据
- 更正您的数据
- 删除您的数据
- 退出追踪

## Cookie 使用？

我们使用以下类型的 Cookie：
- 必要 Cookie
- 功能 Cookie
- 分析 Cookie
- 营销 Cookie

## 联系我们？

如有疑问，请联系我们：
- 邮箱：privacy@example.com
- 地址：...
```

## React 隐私组件

### 隐私设置页面

```jsx
// PrivacySettings.jsx
import React, { useState, useEffect } from 'react';
import cookieConsent from './cookie-consent';

function PrivacySettings() {
  const [settings, setSettings] = useState({
    profileVisible: false,
    showEmail: false,
    allowTracking: false,
    allowAnalytics: false
  });

  useEffect(() => {
    // 加载用户隐私设置
    fetch('/api/user/privacy')
      .then(res => res.json())
      .then(data => setSettings(data));
  }, []);

  const handleSave = async () => {
    await fetch('/api/user/privacy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    
    alert('设置已保存');
  };

  return (
    <div className="privacy-settings">
      <h2>隐私设置</h2>
      
      <div className="setting-group">
        <h3>个人资料</h3>
        <label>
          <input
            type="checkbox"
            checked={settings.profileVisible}
            onChange={(e) => setSettings({
              ...settings,
              profileVisible: e.target.checked
            })}
          />
          公开个人资料
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={settings.showEmail}
            onChange={(e) => setSettings({
              ...settings,
              showEmail: e.target.checked
            })}
          />
          显示邮箱地址
        </label>
      </div>
      
      <div className="setting-group">
        <h3>追踪和分析</h3>
        <label>
          <input
            type="checkbox"
            checked={settings.allowTracking}
            onChange={(e) => setSettings({
              ...settings,
              allowTracking: e.target.checked
            })}
          />
          允许追踪
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={settings.allowAnalytics}
            onChange={(e) => setSettings({
              ...settings,
              allowAnalytics: e.target.checked
            })}
          />
          允许分析
        </label>
      </div>
      
      <button onClick={handleSave}>保存设置</button>
    </div>
  );
}

export default PrivacySettings;
```

## 本课小结

本课我们学习了数据隐私与合规：

1. **隐私法规**：GDPR、CCPA 等法规的核心要求
2. **Cookie 同意**：Cookie 类型、同意管理、同意 UI
3. **数据最小化**：只收集必要数据、匿名化、数据保留
4. **隐私设计**：默认隐私、隐私友好的分析和 Cookie
5. **用户权利**：数据访问、删除、同意管理
6. **隐私政策**：模板和实现

## 练习

### 练习一：实现 Cookie 同意

为你的项目实现 Cookie 同意管理：
- Cookie 同意横幅
- Cookie 偏好设置
- 同意记录

### 练习二：实现数据导出

为你的项目实现用户数据导出功能：
- 收集用户数据
- 生成导出文件
- 提供下载

## 参考答案

### 练习一

```jsx
// CookieConsent.jsx
import React, { useState, useEffect } from 'react';

function CookieConsent() {
  const [show, setShow] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShow(true);
    }
  }, []);

  const saveConsent = () => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
    setShow(false);
    
    // 根据同意设置 Cookie
    if (preferences.analytics) {
      // 启用分析
    }
    if (preferences.marketing) {
      // 启用营销
    }
  };

  if (!show) return null;

  return (
    <div className="cookie-consent">
      <h3>Cookie 设置</h3>
      <p>我们使用 Cookie 来改善您的体验。</p>
      
      <div className="preferences">
        <label>
          <input
            type="checkbox"
            checked={preferences.necessary}
            disabled
          />
          必要 Cookie
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={preferences.functional}
            onChange={(e) => setPreferences({
              ...preferences,
              functional: e.target.checked
            })}
          />
          功能 Cookie
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={preferences.analytics}
            onChange={(e) => setPreferences({
              ...preferences,
              analytics: e.target.checked
            })}
          />
          分析 Cookie
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={preferences.marketing}
            onChange={(e) => setPreferences({
              ...preferences,
              marketing: e.target.checked
            })}
          />
          营销 Cookie
        </label>
      </div>
      
      <div className="actions">
        <button onClick={() => {
          setPreferences({
            necessary: true,
            functional: true,
            analytics: true,
            marketing: true
          });
          saveConsent();
        }}>全部接受</button>
        
        <button onClick={() => {
          setPreferences({
            necessary: true,
            functional: false,
            analytics: false,
            marketing: false
          });
          saveConsent();
        }}>全部拒绝</button>
        
        <button onClick={saveConsent}>保存设置</button>
      </div>
    </div>
  );
}

export default CookieConsent;
```

### 练习二

```javascript
// data-export.js
const archiver = require('archiver');
const json2csv = require('json2csv').parse;

async function exportUserData(userId) {
  // 收集用户数据
  const user = await User.findById(userId);
  const posts = await Post.find({ userId });
  const comments = await Comment.find({ userId });
  
  // 创建 ZIP 文件
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  // 添加用户资料
  archive.append(JSON.stringify(user, null, 2), { name: 'profile.json' });
  
  // 添加文章
  archive.append(JSON.stringify(posts, null, 2), { name: 'posts.json' });
  
  // 添加评论
  archive.append(JSON.stringify(comments, null, 2), { name: 'comments.json' });
  
  // 添加导出说明
  archive.append(`
# 数据导出说明

导出时间：${new Date().toISOString()}
用户 ID：${userId}

## 文件说明

- profile.json：用户资料
- posts.json：用户发布的文章
- comments.json：用户发表的评论

## 联系我们

如有疑问，请联系 privacy@example.com
`, { name: 'README.md' });
  
  archive.finalize();
  
  return archive;
}

// API 端点
app.get('/api/user/export', async (req, res) => {
  const userId = req.session.userId;
  const archive = await exportUserData(userId);
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}.zip"`);
  
  archive.pipe(res);
});
```

## 下一步

完成本课后，继续学习 [06. 阶段项目：安全审计与加固](./06-stage-project.md)。