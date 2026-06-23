# HLS 与 DASH：为什么视频不会一次加载完

## 现象

你打开一个 2 小时的电影，Network 面板显示视频不是一次下载完的——而是每隔几秒下载一小段。如果你跳到电影中间，它会从中间开始下载，不会从头下载。

这就是自适应流媒体协议的工作方式。HLS 和 DASH 是两种主流协议。

## 传统下载 vs 流媒体

```
传统方式：
  用户点击播放 → 下载整个文件 → 开始播放
  问题：2 小时电影 4GB，等下载完才能看

渐进式下载：
  用户点击播放 → 边下载边播放
  问题：不能快进到未下载的部分，不能根据网速调整画质

自适应流媒体（HLS/DASH）：
  视频被切成几百个小片段（segment）
  播放器根据当前网速选择合适画质的片段
  快进时只下载对应位置的片段
  → 解决了上面所有问题
```

## HLS 工作原理

HLS（HTTP Live Streaming）是 Apple 推出的协议，基于 HTTP。

```
原始视频
    │
    ▼
编码器生成多个画质版本
    │
    ▼
每个版本切片为 2-10 秒的 .ts 文件
    │
    ▼
生成 .m3u8 索引文件（播放列表）
    │
    ▼
播放器读取索引，按需下载片段
```

### 主播放列表（Master Playlist）

```m3u8
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/playlist.m3u8
```

### 媒体播放列表（Media Playlist）

```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXTINF:6.000,
segment_000.ts
#EXTINF:6.000,
segment_001.ts
#EXTINF:4.000,
segment_002.ts
#EXT-X-ENDLIST
```

## DASH 工作原理

DASH（Dynamic Adaptive Streaming over HTTP）是国际标准，原理类似但格式不同。

```xml
<!-- MPD 文件（类似 HLS 的 m3u8） -->
<MPD>
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation bandwidth="800000" width="640" height="360">
        <BaseURL>360p/</BaseURL>
        <SegmentTemplate media="seg_$Number$.m4s" />
      </Representation>
      <Representation bandwidth="5000000" width="1920" height="1080">
        <BaseURL>1080p/</BaseURL>
        <SegmentTemplate media="seg_$Number$.m4s" />
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
```

## HLS vs DASH

```
                    HLS                 DASH
开发者              Apple               国际标准组织
容器格式            TS / fMP4           MP4 (fMP4)
索引文件            .m3u8               .mpd
浏览器原生支持      Safari              无（需要 JS 库）
兼容性              iOS 最好            全平台（需要 hls.js / dash.js）
低延迟              LHLS / LL-HLS      DASH-LL
DRM                FairPlay             Widevine / PlayReady
```

## 在浏览器中播放

```javascript
// 使用 hls.js 播放 HLS 流
import Hls from 'hls.js'

function playHLS(videoElement, url) {
  if (Hls.isSupported()) {
    const hls = new Hls({
      maxBufferLength: 30,        // 最大缓冲 30 秒
      maxMaxBufferLength: 60,     // 绝对上限 60 秒
      startLevel: -1,             // 自动选择起始画质
    })
    hls.loadSource(url)
    hls.attachMedia(videoElement)

    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      console.log('可用画质:', data.levels.map(l =>
        `${l.width}x${l.height} (${(l.bitrate / 1000000).toFixed(1)}Mbps)`
      ))
    })

    // 监听画质切换
    hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      console.log(`切换到画质 ${data.level}`)
    })

  } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari 原生支持 HLS
    videoElement.src = url
  }
}
```

## 自适应码率算法

播放器根据网速动态选择画质：

```javascript
class AdaptiveBitrate {
  private currentLevel = 0
  private bandwidthEstimate = 0

  // 根据下载速度估算带宽
  onSegmentDownloaded(bytes, durationMs) {
    const bandwidth = (bytes * 8) / (durationMs / 1000) // bps
    // 指数移动平均
    this.bandwidthEstimate = this.bandwidthEstimate * 0.7 + bandwidth * 0.3
  }

  // 选择最佳画质
  selectLevel(levels) {
    // 选择带宽需求不超过估算带宽 70% 的最高画质
    const safeBandwidth = this.bandwidthEstimate * 0.7
    for (let i = levels.length - 1; i >= 0; i--) {
      if (levels[i].bandwidth <= safeBandwidth) return i
    }
    return 0 // 最低画质
  }
}
```

## 你可能踩的坑

**坑一：CORS 配置错误**

HLS/DASH 片段通过 HTTP 下载，如果视频服务器没配 CORS，浏览器会拒绝请求。

**坑二：片段时长不一致**

最后一个片段通常比其他片段短。播放器需要处理这个边界情况。

**坑三：hls.js 在 Safari 上不需要**

Safari 原生支持 HLS，用 hls.js 反而可能引入问题。先检测 `canPlayType`。

## 练习

### 练习一：画质切换 UI

在视频播放器上添加画质选择按钮（360p/720p/1080p/自动），点击后切换到对应画质。

### 练习二：带宽监控

实现一个带宽监控面板，实时显示当前下载速度、缓冲区长度、当前画质级别。

---

## 参考答案

### 练习一

```javascript
function addQualitySelector(hls, videoElement) {
  const selector = document.createElement('select')
  selector.innerHTML = '<option value="-1">自动</option>'

  hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
    data.levels.forEach((level, i) => {
      const option = document.createElement('option')
      option.value = i
      option.textContent = `${level.height}p (${(level.bitrate / 1000000).toFixed(1)}Mbps)`
      selector.appendChild(option)
    })
  })

  selector.addEventListener('change', () => {
    hls.currentLevel = parseInt(selector.value)
  })

  document.querySelector('.controls').appendChild(selector)
}
```

### 练习二

```javascript
function createBandwidthMonitor(hls) {
  const panel = document.createElement('div')
  panel.className = 'bandwidth-monitor'

  setInterval(() => {
    const level = hls.levels[hls.currentLevel]
    const buffer = hls.bufferController?.bufferLen ?? 0

    panel.innerHTML = `
      <div>画质: ${level ? `${level.height}p` : 'N/A'}</div>
      <div>带宽: ${(hls.bandwidthEstimate / 1000000).toFixed(2)} Mbps</div>
      <div>缓冲: ${buffer.toFixed(1)}s</div>
    `
  }, 1000)

  document.body.appendChild(panel)
}
```
