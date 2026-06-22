# 第三课：CDN 与分发

## 场景引入

YouTube 每天有超过 10 亿小时的视频被观看。如果所有视频都从美国加州的源站服务器传输到全球各地，一个印度用户看 1080p 视频可能需要等待数十秒才能开始播放，中途还会频繁卡顿。

解决方案是 **CDN（Content Delivery Network）**——把视频内容缓存到离用户最近的服务器上。当北京用户请求一个视频时，数据从北京的 CDN 节点返回，而不是从美国跨洋传输。延迟从 200ms 降到 20ms，吞吐量提升数十倍。

本课将学习 CDN 的工作原理，以及视频分发场景下的特殊挑战和解决方案。

## 学习目标

完成本课学习后，你将能够：

1. 解释 CDN 的缓存和回源机制
2. 理解视频 CDN 与普通网页 CDN 的区别
3. 实现 Token 防盗链机制
4. 设计多 CDN 故障切换策略
5. 了解 P2P 分发在视频场景中的应用

## CDN 基础

### CDN 的核心架构

CDN 由分布在不同地理位置的**边缘节点（Edge Server）**组成，每个节点缓存源站的内容。

```
用户请求视频
    ↓
DNS 智能解析 → 返回最近的 CDN 边缘节点 IP
    ↓
边缘节点有缓存？ ──是──→ 直接返回（缓存命中）
    │
    否（缓存未命中）
    ↓
边缘节点向源站请求（回源）
    ↓
源站返回内容 → 边缘节点缓存 → 返回给用户
```

### 关键概念

| 概念 | 说明 |
|------|------|
| **缓存命中率** | 直接从边缘节点返回的请求占比，通常目标 > 95% |
| **回源（Origin Pull）** | 边缘节点没有缓存时，向源站请求 |
| **TTL（Time To Live）** | 缓存过期时间，过期后需要重新回源 |
| **带宽** | CDN 通常按带宽或流量计费 |
| **命中/未命中比** | 评估 CDN 效果的核心指标 |

### HTTP 缓存控制

CDN 的缓存行为由 HTTP 头部控制：

```javascript
// Node.js 设置 CDN 友好的缓存头
const http = require('http');

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.endsWith('.m3u8')) {
    // HLS 播放列表：短缓存，频繁更新
    res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'public, max-age=5, s-maxage=5',
      'CDN-Cache-Control': 'max-age=5',
    });
    // 返回最新的 m3u8 内容
  } else if (url.pathname.endsWith('.ts') || url.pathname.endsWith('.m4s')) {
    // 媒体分片：长缓存，内容不变
    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    // 分片内容一旦生成就不会变化，可以缓存 1 年
  }
}).listen(3000);
```

## 视频 CDN 的特殊性

### Byte-Range 请求

视频播放器经常需要从视频的中间位置开始播放（用户拖动进度条），这需要 **Byte-Range 请求**：

```
GET /video/segment_005.ts HTTP/1.1
Range: bytes=1024-2047
```

```
HTTP/1.1 206 Partial Content
Content-Range: bytes 1024-2047/10240
Content-Length: 1024
```

CDN 需要支持 Byte-Range 请求才能实现精确的 seek 操作。分片格式（TS/fMP4）的设计也考虑了这一点——每个分片内部都有独立的同步信息。

```javascript
// 检查 CDN 是否支持 Range 请求
fetch('https://cdn.example.com/video.mp4', {
  method: 'HEAD'
}).then(response => {
  const acceptRanges = response.headers.get('Accept-Ranges');
  console.log('支持 Range:', acceptRanges === 'bytes');
});
```

### 分片缓存策略

视频分片的缓存策略与普通网页资源不同：

```javascript
// 分片缓存策略配置示例（Nginx）
const cacheConfig = {
  // 播放列表：高频更新，短缓存
  '.m3u8': {
    'Cache-Control': 'public, max-age=5',
    // 直播场景可能需要更短的 TTL
  },

  // 媒体分片：内容不变，长缓存
  '.ts': {
    'Cache-Control': 'public, max-age=31536000, immutable',
    // 使用内容哈希作为文件名时可以设 immutable
  },

  // 初始化段：内容不变
  'init.mp4': {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },

  // DRM 许可证：不缓存
  '/license': {
    'Cache-Control': 'private, no-store',
  },
};
```

### 预取和预热

大型视频平台在视频发布前会预先将内容推送到 CDN 节点，避免发布后大量用户同时请求导致回源风暴：

```javascript
// CDN 预热 API 调用示例
async function warmupCDN(videoId, renditions) {
  const urls = renditions.flatMap(r =>
    r.segments.map(seg => `${r.baseUrl}/${seg}`)
  );

  // 调用 CDN 提供商的预热 API
  const response = await fetch('https://api.cdn-provider.com/purge', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CDN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      urls: urls,
      // 指定需要预热的区域
      regions: ['cn-east', 'cn-north', 'cn-south'],
    }),
  });

  return response.json();
}
```

## P2P 分发

### WebRTC P2P 视频分发

在直播场景中，当大量用户同时观看同一个流时，CDN 带宽成本会急剧上升。P2P 分发让观看者之间互相分享已下载的数据，减轻 CDN 压力。

```
传统 CDN 分发：
源站 → CDN → 用户A
源站 → CDN → 用户B
源站 → CDN → 用户C
（CDN 带宽 = 3 份）

P2P 辅助分发：
源站 → CDN → 用户A → 用户B（P2P）
源站 → CDN → 用户C
（CDN 带宽 ≈ 1.5 份）
```

```javascript
// P2P 视频分发简化实现
class P2PVideoLoader {
  constructor(segmentUrl, peerConnection) {
    this.segmentUrl = segmentUrl;
    this.peerConnection = peerConnection;
    this.dataChannel = null;
  }

  setupDataChannel() {
    this.dataChannel = this.peerConnection.createDataChannel('video-segments');

    this.dataChannel.onmessage = (event) => {
      const { segmentId, data } = JSON.parse(event.data);
      console.log(`从 P2P 收到分片 ${segmentId}`);
      this.onSegmentReceived(segmentId, data);
    };

    this.dataChannel.onopen = () => {
      console.log('P2P 数据通道已建立');
    };
  }

  async requestSegment(segmentId) {
    // 先尝试从 P2P 获取
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const received = await this.requestFromPeer(segmentId, 2000);
      if (received) return received;
    }

    // P2P 获取失败，回退到 CDN
    console.log(`分片 ${segmentId} 从 CDN 加载`);
    const response = await fetch(`${this.segmentUrl}/${segmentId}.ts`);
    return response.arrayBuffer();
  }

  requestFromPeer(segmentId, timeout) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeout);

      this.onSegmentReceived = (id, data) => {
        if (id === segmentId) {
          clearTimeout(timer);
          resolve(data);
        }
      };

      this.dataChannel.send(JSON.stringify({ request: segmentId }));
    });
  }
}
```

## 多 CDN 策略

### 故障切换

大型视频平台通常使用多个 CDN 提供商，当一个 CDN 出现故障时自动切换到备用 CDN：

```javascript
class MultiCDNSelector {
  constructor(cdns) {
    // cdns: [{ name: 'aliyun', baseUrl: '...', priority: 1 }, ...]
    this.cdns = cdns.sort((a, b) => a.priority - b.priority);
    this.healthStatus = new Map();
    this.cdns.forEach(cdn => this.healthStatus.set(cdn.name, true));
  }

  async loadSegment(segmentPath) {
    for (const cdn of this.cdns) {
      if (!this.healthStatus.get(cdn.name)) continue;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${cdn.baseUrl}/${segmentPath}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          return await response.arrayBuffer();
        }
      } catch (err) {
        console.warn(`CDN ${cdn.name} 失败:`, err.message);
        this.healthStatus.set(cdn.name, false);

        // 30 秒后重新尝试
        setTimeout(() => {
          this.healthStatus.set(cdn.name, true);
        }, 30000);
      }
    }

    throw new Error('所有 CDN 均不可用');
  }

  getActiveCDNs() {
    return this.cdns.filter(cdn => this.healthStatus.get(cdn.name));
  }
}

// 使用
const multiCDN = new MultiCDNSelector([
  { name: 'aliyun',  baseUrl: 'https://cdn1.example.com', priority: 1 },
  { name: 'tencent', baseUrl: 'https://cdn2.example.com', priority: 2 },
  { name: 'cloudflare', baseUrl: 'https://cdn3.example.com', priority: 3 },
]);

const data = await multiCDN.loadSegment('video/720p/segment_005.ts');
```

### 基于质量的 CDN 选择

不同 CDN 在不同地区的性能不同，可以根据实时质量数据动态选择：

```javascript
class QualityBasedCDNSelector {
  constructor(cdns) {
    this.cdns = cdns;
    this.metrics = new Map();
    cdns.forEach(cdn => {
      this.metrics.set(cdn.name, {
        latency: [],      // 延迟样本
        throughput: [],    // 吞吐量样本
        errorCount: 0,
        successCount: 0,
      });
    });
  }

  recordRequest(cdnName, latencyMs, bytes, success) {
    const metric = this.metrics.get(cdnName);
    if (!metric) return;

    if (success) {
      metric.latency.push(latencyMs);
      metric.throughput.push((bytes * 8) / (latencyMs / 1000));
      metric.successCount++;

      // 只保留最近 20 个样本
      if (metric.latency.length > 20) metric.latency.shift();
      if (metric.throughput.length > 20) metric.throughput.shift();
    } else {
      metric.errorCount++;
    }
  }

  selectCDN() {
    let bestCDN = this.cdns[0];
    let bestScore = -Infinity;

    for (const cdn of this.cdns) {
      const metric = this.metrics.get(cdn.name);

      // 错误率过高，跳过
      const total = metric.successCount + metric.errorCount;
      if (total > 5 && metric.errorCount / total > 0.3) continue;

      // 计算综合分数：高吞吐 + 低延迟 = 高分
      const avgThroughput = metric.throughput.length > 0
        ? metric.throughput.reduce((a, b) => a + b) / metric.throughput.length
        : 0;
      const avgLatency = metric.latency.length > 0
        ? metric.latency.reduce((a, b) => a + b) / metric.latency.length
        : 1000;

      // 权重：吞吐量占 60%，延迟占 40%
      const score = (avgThroughput / 1000000) * 0.6 - (avgLatency / 1000) * 0.4;

      if (score > bestScore) {
        bestScore = score;
        bestCDN = cdn;
      }
    }

    return bestCDN;
  }
}
```

## Token 防盗链

### 原理

视频链接被他人盗用会导致带宽被盗刷。Token 防盗链通过在 URL 中附加签名参数来验证请求的合法性：

```
https://cdn.example.com/video/720p/segment_005.ts?token=abc123&expires=1700000000
```

### 签名 URL 生成

```javascript
const crypto = require('crypto');

class SignedURLGenerator {
  constructor(secretKey, expiresIn = 3600) {
    this.secretKey = secretKey;
    this.expiresIn = expiresIn;
  }

  generateSignedURL(resourcePath, clientIP = null) {
    const expires = Math.floor(Date.now() / 1000) + this.expiresIn;

    // 构建签名字符串
    const signString = [
      resourcePath,
      expires,
      clientIP || '',
    ].join('\n');

    // HMAC-SHA256 签名
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(signString)
      .digest('hex');

    // 构建 URL
    const params = new URLSearchParams({
      expires: expires.toString(),
      sign: signature,
    });

    if (clientIP) {
      params.set('ip', clientIP);
    }

    return `https://cdn.example.com${resourcePath}?${params.toString()}`;
  }

  verifySignedURL(resourcePath, expires, signature, clientIP = null) {
    // 检查过期
    if (Math.floor(Date.now() / 1000) > parseInt(expires)) {
      return { valid: false, reason: 'expired' };
    }

    // 重新计算签名
    const signString = [resourcePath, expires, clientIP || ''].join('\n');
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(signString)
      .digest('hex');

    // 使用恒定时间比较防止时序攻击
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    return { valid: isValid, reason: isValid ? 'ok' : 'invalid_signature' };
  }
}

// 使用
const signer = new SignedURLGenerator('my-secret-key', 7200);

// 生成签名 URL（2 小时有效）
const url = signer.generateSignedURL('/video/720p/segment_005.ts', '192.168.1.100');
console.log(url);
// https://cdn.example.com/video/720p/segment_005.ts?expires=1700007200&sign=abc...&ip=192.168.1.100

// 验证签名
const result = signer.verifySignedURL(
  '/video/720p/segment_005.ts',
  '1700007200',
  'abc...',
  '192.168.1.100'
);
console.log(result);  // { valid: true, reason: 'ok' }
```

## 常见误区

### 误区一：CDN 能解决所有延迟问题

CDN 解决的是**网络传输延迟**，但视频播放延迟还包括：解码延迟（设备性能）、首帧延迟（需要下载初始化数据）、协议延迟（HLS 分片时长）。这些是 CDN 无法优化的。

### 误区二：所有内容都应该长缓存

播放列表（m3u8/mpd）需要频繁更新（直播场景每几秒更新一次），必须设置短 TTL。只有内容不会变化的分片文件才适合长缓存。

### 误区三：CDN 节点越多越好

节点数量多不代表质量好。关键指标是**命中率**和**回源质量**。100 个配置不当的节点不如 10 个高命中率的节点。

### 误区四：防盗链只需要检查 Referer

Referer 头可以被伪造，不是可靠的防盗链手段。应该使用基于密钥签名的 Token 防盗链，配合过期时间。

## 工程建议

1. **分片文件设 `immutable`**：内容不变的分片使用 `Cache-Control: public, max-age=31536000, immutable`，避免条件请求开销
2. **Gzip 压缩文本资源**：M3U8 和 MPD 是文本格式，开启 Gzip 可减少 60-80% 的传输大小
3. **监控回源带宽比**：回源带宽占总带宽的比例应低于 5%，否则说明缓存策略有问题
4. **使用 CDN 的 Range 缓存**：确保 CDN 支持并正确缓存 Byte-Range 请求
5. **多 CDN 切换要平滑**：不要在切换时中断播放，应该在当前分片加载完成后再切换
6. **定期清理过期内容**：避免 CDN 节点存储空间被占满，设置合理的过期策略

## 小结

本课学习了 CDN 视频分发的核心知识：

- **CDN 架构**：边缘节点缓存 + 回源机制，将内容推送到离用户最近的地方
- **视频 CDN 特殊性**：Byte-Range 请求、分片缓存策略、预热机制
- **P2P 分发**：利用 WebRTC 在观看者之间共享数据，降低 CDN 成本
- **多 CDN 策略**：故障切换和基于质量的动态选择，提升可用性
- **防盗链**：HMAC 签名 URL 保护视频资源不被盗用

下一课将学习直播推流技术，从 RTMP 协议到 FFmpeg 转码的完整流程。

## 练习

### 练习一：实现签名 URL 生成器

编写一个 `SignedURLGenerator` 类，支持生成带过期时间和 HMAC 签名的 URL，并能验证签名的合法性。

### 练习二：设计多 CDN 故障切换

实现一个 `MultiCDNLoader`，按优先级依次尝试多个 CDN，当某个 CDN 连续失败 3 次后自动降级到下一个 CDN，并在 30 秒后重新尝试。

---

## 参考答案

### 练习一

**思路**：使用 HMAC-SHA256 对资源路径、过期时间、客户端 IP 进行签名，将签名附加到 URL 参数中。验证时重新计算签名并比较。

**答案**：

```javascript
const crypto = require('crypto');

class SignedURLGenerator {
  constructor(options = {}) {
    this.secretKey = options.secretKey || 'default-secret';
    this.defaultExpiresIn = options.expiresIn || 3600;
    this.baseUrl = options.baseUrl || 'https://cdn.example.com';
  }

  sign(path, options = {}) {
    const expiresIn = options.expiresIn || this.defaultExpiresIn;
    const clientIP = options.clientIP || '';
    const expires = Math.floor(Date.now() / 1000) + expiresIn;

    const stringToSign = `${path}\n${expires}\n${clientIP}`;
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(stringToSign)
      .digest('base64url');

    const url = new URL(path, this.baseUrl);
    url.searchParams.set('expires', expires.toString());
    url.searchParams.set('sign', signature);
    if (clientIP) url.searchParams.set('ip', clientIP);

    return url.toString();
  }

  verify(urlString) {
    const url = new URL(urlString);
    const path = url.pathname;
    const expires = url.searchParams.get('expires');
    const signature = url.searchParams.get('sign');
    const clientIP = url.searchParams.get('ip') || '';

    if (!expires || !signature) {
      return { valid: false, reason: 'missing_parameters' };
    }

    if (Math.floor(Date.now() / 1000) > parseInt(expires)) {
      return { valid: false, reason: 'expired' };
    }

    const expectedSign = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${path}\n${expires}\n${clientIP}`)
      .digest('base64url');

    if (signature !== expectedSign) {
      return { valid: false, reason: 'invalid_signature' };
    }

    return { valid: true, reason: 'ok' };
  }
}

// 测试
const signer = new SignedURLGenerator({
  secretKey: 'my-super-secret-key-2024',
  expiresIn: 7200,
  baseUrl: 'https://cdn.example.com',
});

const signedUrl = signer.sign('/video/720p/seg_005.ts', { clientIP: '10.0.0.1' });
console.log('签名 URL:', signedUrl);

const result = signer.verify(signedUrl);
console.log('验证结果:', result);  // { valid: true, reason: 'ok' }
```

**要点**：
- `base64url` 编码避免 `+`、`/`、`=` 等在 URL 中需要转义的字符
- 将客户端 IP 纳入签名可以防止 URL 被其他 IP 使用
- 过期时间使用 Unix 时间戳，便于 CDN 边缘节点直接判断

### 练习二

**思路**：维护每个 CDN 的失败计数器和降级状态，使用指数退避策略重新尝试已降级的 CDN。

**答案**：

```javascript
class MultiCDNLoader {
  constructor(cdns) {
    // cdns: [{ name, baseUrl, priority }]
    this.cdns = cdns.sort((a, b) => a.priority - b.priority);
    this.state = {};

    this.cdns.forEach(cdn => {
      this.state[cdn.name] = {
        failCount: 0,
        disabled: false,
        retryAfter: 0,
        maxFails: 3,
        cooldownMs: 30000,
      };
    });
  }

  getAvailableCDNs() {
    const now = Date.now();
    return this.cdns.filter(cdn => {
      const state = this.state[cdn.name];
      if (state.disabled && now < state.retryAfter) return false;
      if (state.disabled && now >= state.retryAfter) {
        state.disabled = false;
        state.failCount = 0;
      }
      return true;
    });
  }

  recordSuccess(cdnName) {
    this.state[cdnName].failCount = 0;
    this.state[cdnName].disabled = false;
  }

  recordFailure(cdnName) {
    const state = this.state[cdnName];
    state.failCount++;

    if (state.failCount >= state.maxFails) {
      state.disabled = true;
      state.retryAfter = Date.now() + state.cooldownMs;
      console.warn(`CDN ${cdnName} 已降级，${state.cooldownMs / 1000}s 后重试`);
    }
  }

  async load(resourcePath, timeoutMs = 5000) {
    const availableCDNs = this.getAvailableCDNs();

    if (availableCDNs.length === 0) {
      throw new Error('所有 CDN 均不可用');
    }

    for (const cdn of availableCDNs) {
      const url = `${cdn.baseUrl}${resourcePath}`;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        this.recordSuccess(cdn.name);
        const data = await response.arrayBuffer();

        console.log(`[CDN] ${cdn.name} 加载成功: ${resourcePath}`);
        return { data, cdn: cdn.name };
      } catch (err) {
        console.warn(`[CDN] ${cdn.name} 加载失败: ${err.message}`);
        this.recordFailure(cdn.name);
      }
    }

    throw new Error('所有可用 CDN 均加载失败');
  }

  getStatus() {
    return this.cdns.map(cdn => ({
      name: cdn.name,
      ...this.state[cdn.name],
      available: !this.state[cdn.name].disabled ||
                 Date.now() >= this.state[cdn.name].retryAfter,
    }));
  }
}

// 测试
const loader = new MultiCDNLoader([
  { name: 'Aliyun',  baseUrl: 'https://cdn1.example.com', priority: 1 },
  { name: 'Tencent', baseUrl: 'https://cdn2.example.com', priority: 2 },
  { name: 'AWS',     baseUrl: 'https://cdn3.example.com', priority: 3 },
]);

try {
  const result = await loader.load('/video/720p/segment_005.ts');
  console.log(`加载成功，使用 CDN: ${result.cdn}`);
} catch (err) {
  console.error('加载失败:', err.message);
}

console.log('CDN 状态:', loader.getStatus());
```

**要点**：
- `failCount` 连续失败计数，单次成功后重置
- `cooldownMs` 降级冷却时间，避免频繁尝试已故障的 CDN
- `getAvailableCDNs` 动态过滤可用 CDN，冷却到期后自动恢复
- 按 `priority` 排序确保优先使用高质量 CDN
