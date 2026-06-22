# 第一课：HLS 与 DASH

## 场景引入

你在 Netflix 上看电影，画面从模糊逐渐变清晰，几秒后又突然降了分辨率。你切换到 Wi-Fi，画面立刻恢复高清。这不是魔法，而是**自适应码率切换（ABR）**在起作用。

Netflix 的播放器每几秒检测一次你的网络带宽，动态选择最合适的视频质量。网络好时给你 4K HDR，网络差时降到 720p 保证不卡顿。这套机制的核心就是两个流媒体协议：**HLS** 和 **DASH**。

本课将深入这两个协议的工作原理，理解分片、播放列表、自适应码率切换的完整流程。

## 学习目标

完成本课学习后，你将能够：

1. 解释 HLS 和 DASH 的架构差异与适用场景
2. 理解 M3U8 播放列表和 MPD 清单文件的结构
3. 实现自适应码率切换的核心逻辑
4. 使用 hls.js 在浏览器中播放 HLS 流
5. 设计合理的分片策略和编码参数

## HLS 概述

### 什么是 HLS

**HLS（HTTP Live Streaming）** 是苹果在 2009 年推出的流媒体协议。它的核心思想是将视频切分成一系列小的 TS 文件（通常 2-10 秒），通过 HTTP 协议分发，播放器按顺序下载并播放。

HLS 的工作流程：

```
原始视频 → [编码+切片] → .ts 分片文件 + .m3u8 播放列表
                                    ↓
                            HTTP 服务器 / CDN
                                    ↓
                         播放器请求 m3u8 → 按需下载 ts
```

### M3U8 播放列表结构

HLS 使用 M3U8 文件作为播放列表，本质上是一个文本文件：

```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0

#EXTINF:5.005,
segment_000.ts
#EXTINF:5.005,
segment_001.ts
#EXTINF:5.005,
segment_002.ts
#EXTINF:3.336,
segment_003.ts
#EXTX-ENDLIST
```

各字段含义：

| 标签 | 作用 |
|------|------|
| `#EXTM3U` | 文件头，标识这是 M3U 扩展格式 |
| `#EXT-X-VERSION` | 协议版本 |
| `#EXT-X-TARGETDURATION` | 最大切片时长（秒） |
| `#EXT-X-MEDIA-SEQUENCE` | 第一个切片的序列号 |
| `#EXTINF` | 每个切片的实际时长 |
| `#EXT-X-ENDLIST` | 标识点播结束（直播流没有此标签） |

### 多码率播放列表（Master Playlist）

当需要支持自适应码率时，HLS 使用**主播放列表**指向多个**媒体播放列表**：

```m3u8
#EXTM3U

#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=842x480
480p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/playlist.m3u8
```

播放器先加载主播放列表，根据当前带宽选择合适的媒体播放列表，再下载对应的 TS 分片。

### TS 分片格式

HLS 使用 MPEG-TS（Transport Stream）作为分片格式。TS 格式的特点是每个分片都包含完整的同步信息，可以从任意分片开始播放，非常适合流媒体场景。

```
TS 分片内部结构：
┌──────────────────────────────┐
│ PAT (Program Association)    │  ← 指向 PMT
│ PMT (Program Map)            │  ← 列出音视频 PID
│ PES Packet (Video H.264)     │  ← 视频数据
│ PES Packet (Audio AAC)       │  ← 音频数据
│ ...                          │
│ PCR (Program Clock Reference)│  ← 时钟同步
└──────────────────────────────┘
```

## DASH 概述

### 什么是 DASH

**DASH（Dynamic Adaptive Streaming over HTTP）** 是 MPEG 标准化的自适应流媒体协议（ISO/IEC 23009-1）。与 HLS 类似，DASH 也采用分片 + HTTP 分发的架构，但使用不同的清单格式和分片容器。

DASH 的核心组件：

| 组件 | HLS 对应 | 说明 |
|------|----------|------|
| MPD (Media Presentation Description) | M3U8 | 清单文件，描述所有可用码率和分片 |
| Segment | TS 分片 | 媒体分片，DASH 使用 ISO BMFF (fMP4) |
| Representation | Stream | 单个码率/质量级别的媒体流 |
| AdaptationSet | 一组 Stream | 同一内容的不同编码版本 |

### MPD 文件结构

MPD 使用 XML 格式描述媒体信息：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"
     type="static"
     mediaPresentationDuration="PT634.5S"
     minBufferTime="PT2S">

  <Period start="PT0S">
    <!-- 视频 AdaptationSet -->
    <AdaptationSet mimeType="video/mp4" segmentAlignment="true">
      <Representation id="video-360" bandwidth="800000"
                      width="640" height="360" frameRate="30">
        <BaseURL>360p/</BaseURL>
        <SegmentList timescale="1000" duration="6000">
          <Initialization sourceURL="init.mp4"/>
          <SegmentURL media="seg-000.m4s"/>
          <SegmentURL media="seg-001.m4s"/>
          <SegmentURL media="seg-002.m4s"/>
        </SegmentList>
      </Representation>

      <Representation id="video-720" bandwidth="2800000"
                      width="1280" height="720" frameRate="30">
        <BaseURL>720p/</BaseURL>
        <SegmentList timescale="1000" duration="6000">
          <Initialization sourceURL="init.mp4"/>
          <SegmentURL media="seg-000.m4s"/>
          <SegmentURL media="seg-001.m4s"/>
        </SegmentList>
      </Representation>
    </AdaptationSet>

    <!-- 音频 AdaptationSet -->
    <AdaptationSet mimeType="audio/mp4" lang="zh">
      <Representation id="audio-128" bandwidth="128000"
                      audioSamplingRate="44100">
        <BaseURL>audio/</BaseURL>
        <SegmentList timescale="1000" duration="6000">
          <Initialization sourceURL="init.mp4"/>
          <SegmentURL media="seg-000.m4s"/>
          <SegmentURL media="seg-001.m4s"/>
        </SegmentList>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
```

### ISO BMFF 分片

DASH 使用 **fMP4（fragmented MP4）** 作为分片容器。与普通 MP4 不同，fMP4 由一系列 fragment 组成，每个 fragment 独立可解码。

```
fMP4 分片结构：
┌──────────────────────────────┐
│ moov (ftyp + moov)           │  ← 初始化段（init segment）
│  ├─ mvhd (movie header)      │
│  ├─ trak (video track)       │
│  └─ trak (audio track)       │
└──────────────────────────────┘
┌──────────────────────────────┐
│ moof (movie fragment)        │  ← 媒体段（media segment）
│  ├─ mfhd (sequence number)   │
│  └─ traf (track fragment)    │
│      ├─ tfhd (track header)  │
│      └─ trun (sample table)  │
│ mdat (media data)            │  ← 实际编码数据
└──────────────────────────────┘
```

fMP4 相比 TS 的优势是更好的压缩效率和更自然的音视频复用方式。

## HLS vs DASH 对比

| 特性 | HLS | DASH |
|------|-----|------|
| 发起方 | Apple | MPEG 标准组织 |
| 清单格式 | M3U8（文本） | MPD（XML） |
| 分片格式 | MPEG-TS / fMP4 | ISO BMFF (fMP4) |
| iOS 原生支持 | ✅ 原生 | ❌ 需要库 |
| Android 原生支持 | ✅ 4.0+ | ✅ 5.0+ |
| 浏览器原生支持 | Safari | 无（需要 JS 库） |
| 低延迟扩展 | LL-HLS | LL-DASH |
| DRM | FairPlay | Widevine / PlayReady / FairPlay |

## 自适应码率（ABR）算法

### ABR 的核心问题

播放器需要在每一刻做出决策：**下一个分片请求哪个码率？** 这个决策需要平衡两个目标：

1. **画质最大化**：选择最高的可用码率
2. **流畅性保证**：避免缓冲区欠载导致卡顿

### 基于带宽的 ABR 算法

最简单的策略是根据历史下载速度选择码率：

```javascript
class BandwidthABR {
  constructor(renditions) {
    // renditions: [{ bitrate: 800000, url: '360p/' }, ...]
    this.renditions = renditions.sort((a, b) => a.bitrate - b.bitrate);
    this.bandwidthSamples = [];
    this.maxSamples = 5;
  }

  recordDownload(segmentBytes, durationMs) {
    // 计算下载速度（bps）
    const speedBps = (segmentBytes * 8) / (durationMs / 1000);
    this.bandwidthSamples.push(speedBps);
    if (this.bandwidthSamples.length > this.maxSamples) {
      this.bandwidthSamples.shift();
    }
  }

  getEstimatedBandwidth() {
    if (this.bandwidthSamples.length === 0) return 0;
    // 使用加权平均，最近的样本权重更高
    let totalWeight = 0;
    let weightedSum = 0;
    this.bandwidthSamples.forEach((sample, index) => {
      const weight = index + 1;
      weightedSum += sample * weight;
      totalWeight += weight;
    });
    return weightedSum / totalWeight;
  }

  selectRendition() {
    const bandwidth = this.getEstimatedBandwidth();
    // 选择码率不超过估计带宽 70% 的最高质量
    // 留 30% 余量应对波动
    const safeBandwidth = bandwidth * 0.7;

    let selected = this.renditions[0];
    for (const rendition of this.renditions) {
      if (rendition.bitrate <= safeBandwidth) {
        selected = rendition;
      }
    }
    return selected;
  }
}

// 使用示例
const abr = new BandwidthABR([
  { bitrate: 500000,  url: '240p/' },
  { bitrate: 1000000, url: '360p/' },
  { bitrate: 2000000, url: '480p/' },
  { bitrate: 4000000, url: '720p/' },
  { bitrate: 8000000, url: '1080p/' },
]);

// 模拟下载记录
abr.recordDownload(250000, 2000);  // 250KB 花了 2 秒
abr.recordDownload(260000, 1800);  // 260KB 花了 1.8 秒

const rendition = abr.selectRendition();
console.log(`选择码率: ${rendition.bitrate}, 分辨率: ${rendition.url}`);
```

### 基于缓冲区的 ABR 算法

BBA（Buffer-Based Approach）根据当前缓冲区水位选择码率，不依赖带宽估计：

```javascript
class BufferABR {
  constructor(renditions, reservoir = 10, cushion = 30) {
    this.renditions = renditions.sort((a, b) => a.bitrate - b.bitrate);
    this.reservoir = reservoir;  // 缓冲区下限（秒）
    this.cushion = cushion;      // 缓冲区上限（秒）
  }

  selectRendition(bufferLevel) {
    // 缓冲区低于下限，选择最低码率
    if (bufferLevel <= this.reservoir) {
      return this.renditions[0];
    }

    // 缓冲区高于上限，选择最高码率
    if (bufferLevel >= this.cushion) {
      return this.renditions[this.renditions.length - 1];
    }

    // 缓冲区在中间，线性映射到码率索引
    const ratio = (bufferLevel - this.reservoir) / (this.cushion - this.reservoir);
    const index = Math.floor(ratio * this.renditions.length);
    return this.renditions[Math.min(index, this.renditions.length - 1)];
  }
}
```

## 分片策略

### 分片时长选择

分片时长是流媒体系统的关键参数：

| 分片时长 | 优点 | 缺点 | 适用场景 |
|----------|------|------|----------|
| 1-2 秒 | 低延迟，快速码率切换 | 压缩效率低，请求开销大 | 直播 |
| 4-6 秒 | 平衡延迟和效率 | 切换响应稍慢 | 点播（推荐） |
| 10+ 秒 | 压缩效率最高 | 延迟高，切换慢 | 纯点播 |

### 关键帧对齐

自适应码率切换要求不同码率的分片在**关键帧（IDR 帧）**边界对齐，否则切换时会出现花屏或解码错误。

```bash
# FFmpeg 生成关键帧对齐的 HLS 分片
ffmpeg -i input.mp4 \
  -map 0:v -map 0:v -map 0:v \
  -c:v:0 libx264 -b:v:0 800k  -s:v:0 640x360  \
  -c:v:1 libx264 -b:v:1 2000k -s:v:1 1280x720 \
  -c:v:2 libx264 -b:v:2 5000k -s:v:2 1920x1080 \
  -c:a aac -b:a 128k \
  -g 48 -keyint_min 48 -sc_threshold 0 \
  -f hls -hls_time 4 -hls_list_size 0 \
  -hls_segment_type mpegts \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0 v:1 v:2 a:0" \
  output_%v/stream.m3u8
```

关键参数说明：

- `-g 48`：GOP 大小为 48 帧（30fps 下为 1.6 秒一个关键帧）
- `-keyint_min 48`：最小关键帧间隔，确保对齐
- `-sc_threshold 0`：禁用场景切换检测，强制按固定间隔插入关键帧
- `-hls_time 4`：每个 TS 分片约 4 秒

## hls.js 实战

### 基本播放

hls.js 是一个纯 JavaScript 的 HLS 播放库，基于 MSE（Media Source Extensions）实现，让不支持原生 HLS 的浏览器也能播放 HLS 流。

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>HLS 播放器</title>
</head>
<body>
  <video id="video" controls width="800"></video>

  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <script>
    const video = document.getElementById('video');
    const hlsUrl = 'https://example.com/live/stream.m3u8';

    if (Hls.isSupported()) {
      const hls = new Hls({
        // ABR 配置
        abrEwmaFastLive: 3,      // 快速 EWMA 半衰期（秒）
        abrEwmaSlowLive: 9,      // 慢速 EWMA 半衰期
        abrEwmaFastVoD: 3,
        abrEwmaSlowVoD: 10,
        startLevel: -1,           // -1 表示自动选择起始质量
        capLevelToPlayerSize: true, // 不超过播放器尺寸的分辨率
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('可用质量级别:', data.levels.length);
        data.levels.forEach((level, index) => {
          console.log(`  Level ${index}: ${level.width}x${level.height} @ ${level.bitrate / 1000}kbps`);
        });
        video.play();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const level = hls.levels[data.level];
        console.log(`切换到: ${level.width}x${level.height}`);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('网络错误，尝试恢复...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('媒体错误，尝试恢复...');
              hls.recoverMediaError();
              break;
            default:
              console.error('不可恢复的错误:', data);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari 原生支持 HLS
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play();
      });
    }
  </script>
</body>
</html>
```

### 手动控制码率

```javascript
// 禁用自动码率切换，手动选择
hls.currentLevel = 2;  // 固定使用 Level 2

// 恢复自动切换
hls.currentLevel = -1;

// 获取当前播放质量
hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
  const level = hls.levels[data.frag.level];
  console.log(`当前分片: ${data.frag.sn}, 质量: ${level.height}p`);
});
```

## 常见误区

### 误区一：所有浏览器都原生支持 HLS

事实是只有 Safari（macOS/iOS）原生支持 HLS。Chrome、Firefox、Edge 需要使用 hls.js 通过 MSE 实现。如果 hls.js 也不可用（如某些老旧浏览器），则完全无法播放。

### 误区二：HLS 延迟一定很高

传统 HLS 确实有 3 个分片时长的延迟（如 3×6=18 秒），但 LL-HLS（低延迟 HLS）通过部分分片（Partial Segments）和预加载提示（Preload Hints）可以将延迟降到 2-4 秒。

### 误区三：分片越短越好

更短的分片确实能降低延迟，但会增加 HTTP 请求次数、降低压缩效率（每个分片需要独立的关键帧），并给服务器带来更大压力。点播场景推荐 4-6 秒。

### 误区四：ABR 算法只看带宽

带宽估计存在滞后性——当网络突然变差时，播放器可能已经请求了高码率分片。优秀的 ABR 算法还会考虑缓冲区水位、分片下载时间的趋势变化。

## 工程建议

1. **苹果生态用 HLS**：iOS 和 Safari 对 HLS 有原生优化，包括硬件解码和电池效率，优先使用 HLS
2. **非苹果生态用 DASH 或 HLS+hls.js**：现代浏览器通过 hls.js 播放 HLS 效果良好，也可以同时提供 DASH 流
3. **分片时长 4-6 秒**：对点播场景，这是延迟和效率的最佳平衡点
4. **关键帧对齐必须保证**：不同码率的编码必须使用相同的 GOP 结构，否则 ABR 切换会花屏
5. **使用 CMAF 格式**：Common Media Application Format 允许同时用于 HLS 和 DASH，减少存储成本
6. **CDN 缓存分片而非清单**：M3U8/MPD 设置短缓存（如 5 秒），TS/M4S 分片设置长缓存（如 1 年）

## 小结

本课学习了 HLS 和 DASH 两种主流流媒体协议的核心原理：

- **HLS** 使用 M3U8 + TS 分片，苹果生态原生支持
- **DASH** 使用 MPD + fMP4 分片，是国际标准
- **ABR 算法** 根据带宽和缓冲区动态选择码率，平衡画质和流畅性
- **分片策略** 需要在延迟、效率和请求开销之间权衡
- **关键帧对齐** 是 ABR 切换正确的前提条件

下一课我们将学习如何从零开发一个自定义视频播放器，深入理解 HTML5 Video 的事件模型和 MSE 工作原理。

## 练习

### 练习一：使用 FFmpeg 生成多码率 HLS 流

使用 FFmpeg 将一个视频文件转码为 360p、720p、1080p 三个码率的 HLS 流，要求关键帧对齐，分片时长 4 秒。

### 练习二：实现基于带宽的 ABR 算法

编写一个 `ABRController` 类，能够记录分片下载速度，使用加权移动平均估计带宽，并选择合适的码率。

### 练习三：使用 hls.js 播放 HLS 流

创建一个 HTML 页面，使用 hls.js 加载练习一生成的 HLS 流，在页面上显示当前播放质量和缓冲区长度。

---

## 参考答案

### 练习一

**思路**：使用 FFmpeg 的多输出功能，为每个码率生成独立的编码流，通过 `-g` 和 `-keyint_min` 确保关键帧对齐。

**答案**：

```bash
#!/bin/bash
# generate-hls.sh - 生成多码率 HLS 流

INPUT="input.mp4"
OUTPUT_DIR="hls_output"
mkdir -p $OUTPUT_DIR

ffmpeg -i $INPUT \
  -map 0:v -map 0:v -map 0:v -map 0:a \
  -c:v:0 libx264 -b:v:0 800k  -s:v:0 640x360  -preset fast \
  -c:v:1 libx264 -b:v:1 2500k -s:v:1 1280x720 -preset fast \
  -c:v:2 libx264 -b:v:2 5000k -s:v:2 1920x1080 -preset fast \
  -c:a aac -b:a 128k -ar 44100 \
  -g 120 -keyint_min 120 -sc_threshold 0 \
  -f hls -hls_time 4 -hls_list_size 0 \
  -hls_flags independent_segments \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,agroup:audio v:1,agroup:audio v:2,agroup:audio a:0,agroup:audio" \
  ${OUTPUT_DIR}/stream_%v/playlist.m3u8
```

**要点**：
- `-g 120` 在 30fps 下对应 4 秒一个关键帧，与 `-hls_time 4` 对齐
- `-sc_threshold 0` 禁用场景切换，确保所有码率的关键帧位置完全一致
- `-hls_flags independent_segments` 确保每个分片以关键帧开头

### 练习二

**思路**：使用指数加权移动平均（EWMA）估计带宽，根据安全带宽阈值选择码率。

**答案**：

```javascript
class ABRController {
  constructor(renditions) {
    this.renditions = renditions
      .map(r => ({ ...r }))
      .sort((a, b) => a.bitrate - b.bitrate);
    this.ewmaBandwidth = 0;
    this.alpha = 0.3;  // EWMA 平滑因子
    this.safetyFactor = 0.7;
  }

  recordSegmentDownload(bytes, durationMs) {
    const instantBps = (bytes * 8) / (durationMs / 1000);
    if (this.ewmaBandwidth === 0) {
      this.ewmaBandwidth = instantBps;
    } else {
      this.ewmaBandwidth = this.alpha * instantBps + (1 - this.alpha) * this.ewmaBandwidth;
    }
    console.log(`下载完成: ${(bytes / 1024).toFixed(0)}KB, ` +
                `耗时 ${(durationMs / 1000).toFixed(1)}s, ` +
                `估计带宽: ${(this.ewmaBandwidth / 1000000).toFixed(2)}Mbps`);
  }

  selectRendition() {
    if (this.ewmaBandwidth === 0) {
      return this.renditions[0];
    }

    const safeBandwidth = this.ewmaBandwidth * this.safetyFactor;
    let selected = this.renditions[0];

    for (const rendition of this.renditions) {
      if (rendition.bitrate <= safeBandwidth) {
        selected = rendition;
      } else {
        break;
      }
    }

    return selected;
  }

  getEstimatedBandwidth() {
    return this.ewmaBandwidth;
  }
}

// 测试
const abr = new ABRController([
  { bitrate: 500000,  label: '360p' },
  { bitrate: 1500000, label: '480p' },
  { bitrate: 3000000, label: '720p' },
  { bitrate: 6000000, label: '1080p' },
]);

// 模拟下载
abr.recordSegmentDownload(187500, 3000);  // 720p 分片：187.5KB / 3秒 = 500kbps
abr.recordSegmentDownload(187500, 2500);  // 带宽提升
abr.recordSegmentDownload(187500, 2000);  // 继续提升

const rendition = abr.selectRendition();
console.log(`选择: ${rendition.label} (${rendition.bitrate / 1000}kbps)`);
```

**要点**：
- EWMA 对近期样本赋予更高权重，能快速响应带宽变化
- `safetyFactor = 0.7` 留 30% 余量，避免请求了高码率但来不及下载
- 第一次下载前没有数据，返回最低码率确保起播速度

### 练习三

**思路**：使用 hls.js 加载 HLS 流，监听 `LEVEL_SWITCHED` 和 `FRAG_BUFFERED` 事件获取质量信息，通过 `video.buffered` 获取缓冲区长度。

**答案**：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>HLS 质量监控播放器</title>
  <style>
    #stats {
      margin-top: 10px;
      padding: 10px;
      background: #1a1a1a;
      color: #0f0;
      font-family: monospace;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <video id="video" controls width="800"></video>
  <div id="stats">等待加载...</div>

  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <script>
    const video = document.getElementById('video');
    const stats = document.getElementById('stats');
    const hlsUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

    let currentQuality = 'N/A';
    let currentBitrate = 0;

    if (Hls.isSupported()) {
      const hls = new Hls({ startLevel: -1 });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const level = hls.levels[data.level];
        currentQuality = `${level.width}x${level.height}`;
        currentBitrate = level.bitrate;
      });

      setInterval(() => {
        let buffered = 0;
        const currentTime = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= currentTime &&
              video.buffered.end(i) > currentTime) {
            buffered = video.buffered.end(i) - currentTime;
            break;
          }
        }

        stats.textContent =
          `质量: ${currentQuality} | ` +
          `码率: ${(currentBitrate / 1000).toFixed(0)}kbps | ` +
          `缓冲区: ${buffered.toFixed(1)}s | ` +
          `带宽: ${(hls.bandwidthEstimate / 1000000).toFixed(2)}Mbps`;
      }, 500);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.play();
    }
  </script>
</body>
</html>
```

**要点**：
- `hls.bandwidthEstimate` 是 hls.js 内部的 EWMA 带宽估计值
- 遍历 `video.buffered` 时需要找到包含 `currentTime` 的区间
- 使用 `setInterval` 定时刷新统计信息，500ms 间隔足够流畅
