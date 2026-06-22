const fs = require('fs');
const path = require('path');

/**
 * 确保目录存在，不存在则递归创建
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 获取文件大小的人类可读格式
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

/**
 * 生成唯一文件名
 */
function generateUniqueName(originalName) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${base}_${timestamp}_${random}${ext}`;
}

/**
 * 安全删除文件
 */
function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.warn(`删除文件失败: ${filePath}`, err.message);
  }
  return false;
}

module.exports = { ensureDir, formatFileSize, generateUniqueName, safeUnlink };
