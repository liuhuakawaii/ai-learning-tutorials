const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const HLS_DIR = path.join(__dirname, '../../../uploads/hls');

// 获取 HLS 播放列表
router.get('/hls/:videoId/master.m3u8', (req, res) => {
  const { videoId } = req.params;
  const playlistPath = path.join(HLS_DIR, videoId, 'master.m3u8');

  if (!fs.existsSync(playlistPath)) {
    return res.status(404).json({ error: '视频流不存在' });
  }

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(playlistPath);
});

// 获取 TS 分片
router.get('/hls/:videoId/:segment', (req, res) => {
  const { videoId, segment } = req.params;
  const segmentPath = path.join(HLS_DIR, videoId, segment);

  if (!fs.existsSync(segmentPath)) {
    return res.status(404).json({ error: '分片不存在' });
  }

  res.setHeader('Content-Type', 'video/mp2t');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.sendFile(segmentPath);
});

// 获取视频信息
router.get('/info/:videoId', (req, res) => {
  const { videoId } = req.params;
  const hlsDir = path.join(HLS_DIR, videoId);

  if (!fs.existsSync(hlsDir)) {
    return res.status(404).json({ error: '视频不存在' });
  }

  const files = fs.readdirSync(hlsDir);
  const segments = files.filter(f => f.endsWith('.ts'));
  const playlists = files.filter(f => f.endsWith('.m3u8'));

  res.json({
    videoId,
    segments: segments.length,
    playlists,
    hasHls: playlists.includes('master.m3u8')
  });
});

module.exports = router;
