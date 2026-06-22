const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { transcodeToHls } = require('../services/transcode');

const router = express.Router();

// 确保上传目录存在
const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
const HLS_DIR = path.join(__dirname, '../../../uploads/hls');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(HLS_DIR, { recursive: true });

// Multer 配置：分片上传支持
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const chunkDir = path.join(UPLOAD_DIR, 'chunks', req.body.uploadId || 'temp');
    fs.mkdirSync(chunkDir, { recursive: true });
    cb(null, chunkDir);
  },
  filename: (req, file, cb) => {
    cb(null, `chunk_${req.body.chunkIndex || 0}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB/chunk

// 单文件上传（简化版）
router.post('/single', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未选择文件' });
  }

  const videoId = uuidv4();
  const ext = path.extname(req.file.originalname);
  const finalPath = path.join(UPLOAD_DIR, `${videoId}${ext}`);

  fs.renameSync(req.file.path, finalPath);

  res.json({
    videoId,
    filename: req.file.originalname,
    size: req.file.size,
    path: `/uploads/${videoId}${ext}`
  });
});

// 分片上传初始化
router.post('/chunk/init', (req, res) => {
  const uploadId = uuidv4();
  const chunkDir = path.join(UPLOAD_DIR, 'chunks', uploadId);
  fs.mkdirSync(chunkDir, { recursive: true });

  res.json({ uploadId });
});

// 上传单个分片
router.post('/chunk', upload.single('chunk'), (req, res) => {
  const { uploadId, chunkIndex, totalChunks } = req.body;

  if (!uploadId || chunkIndex === undefined) {
    return res.status(400).json({ error: '缺少 uploadId 或 chunkIndex' });
  }

  res.json({
    uploadId,
    chunkIndex: parseInt(chunkIndex),
    received: true
  });
});

// 合并分片
router.post('/chunk/merge', async (req, res) => {
  const { uploadId, filename, totalChunks } = req.body;

  if (!uploadId || !filename || !totalChunks) {
    return res.status(400).json({ error: '参数不完整' });
  }

  const videoId = uuidv4();
  const ext = path.extname(filename);
  const finalPath = path.join(UPLOAD_DIR, `${videoId}${ext}`);
  const chunkDir = path.join(UPLOAD_DIR, 'chunks', uploadId);

  try {
    const writeStream = fs.createWriteStream(finalPath);

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i}`);
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`分片 ${i} 缺失`);
      }
      const data = fs.readFileSync(chunkPath);
      writeStream.write(data);
    }

    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // 触发 HLS 转码
    transcodeToHls(videoId, finalPath).catch(err => {
      console.error('HLS 转码失败:', err.message);
    });

    // 清理分片
    fs.rmSync(chunkDir, { recursive: true, force: true });

    res.json({
      videoId,
      filename,
      path: `/uploads/${videoId}${ext}`,
      hlsPath: `/uploads/hls/${videoId}/master.m3u8`
    });
  } catch (err) {
    res.status(500).json({ error: '合并失败: ' + err.message });
  }
});

// 获取视频列表
router.get('/list', (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.mp4', '.webm', '.ogg', '.mkv'].includes(ext);
  });

  const videos = files.map(f => {
    const stat = fs.statSync(path.join(UPLOAD_DIR, f));
    const videoId = path.basename(f, path.extname(f));
    return {
      videoId,
      filename: f,
      size: stat.size,
      uploadTime: stat.mtime,
      path: `/uploads/${f}`,
      hlsPath: `/uploads/hls/${videoId}/master.m3u8`
    };
  });

  res.json({ videos });
});

module.exports = router;
