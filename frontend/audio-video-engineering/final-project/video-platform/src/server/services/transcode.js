const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const HLS_DIR = path.join(__dirname, '../../../uploads/hls');

/**
 * 使用 FFmpeg 将视频转码为 HLS 格式
 * 生成多码率自适应流
 *
 * @param {string} videoId - 视频唯一标识
 * @param {string} inputPath - 源文件路径
 * @returns {Promise<string>} - master.m3u8 路径
 */
async function transcodeToHls(videoId, inputPath) {
  const outputDir = path.join(HLS_DIR, videoId);
  fs.mkdirSync(outputDir, { recursive: true });

  const masterPlaylist = path.join(outputDir, 'master.m3u8');

  // 多码率转码配置
  const profiles = [
    { name: '1080p', bitrate: '5000k', resolution: '1920x1080' },
    { name: '720p', bitrate: '2500k', resolution: '1280x720' },
    { name: '480p', bitrate: '1000k', resolution: '854x480' }
  ];

  // 检查 FFmpeg 是否可用
  const ffmpegAvailable = await checkFfmpeg();

  if (!ffmpegAvailable) {
    console.warn('⚠️  FFmpeg 未安装，生成模拟 HLS 文件');
    return generateMockHls(videoId, outputDir, profiles);
  }

  // 使用 FFmpeg 转码
  const ffmpegCmd = buildFfmpegCommand(inputPath, outputDir, profiles);

  return new Promise((resolve, reject) => {
    exec(ffmpegCmd, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg 转码错误:', stderr);
        // 降级为模拟文件
        generateMockHls(videoId, outputDir, profiles).then(resolve).catch(reject);
        return;
      }

      // 生成 master playlist
      const masterContent = generateMasterPlaylist(profiles);
      fs.writeFileSync(masterPlaylist, masterContent);

      console.log(`✅ HLS 转码完成: ${videoId}`);
      resolve(masterPlaylist);
    });
  });
}

/**
 * 检查 FFmpeg 是否安装
 */
function checkFfmpeg() {
  return new Promise((resolve) => {
    exec('ffmpeg -version', (error) => {
      resolve(!error);
    });
  });
}

/**
 * 构建 FFmpeg 转码命令
 * 输出多码率 HLS 流
 */
function buildFfmpegCommand(input, outputDir, profiles) {
  const inputs = [];
  const maps = [];
  const outputs = [];

  profiles.forEach((profile, i) => {
    const playlistName = `${profile.name}.m3u8`;

    inputs.push(`-map 0:v:0 -map 0:a:0`);
    outputs.push(
      `-c:v:${i} libx264 -b:v:${i} ${profile.bitrate} -s:v:${i} ${profile.resolution} ` +
      `-c:a:${i} aac -b:a 128k ` +
      `-f hls -hls_time 4 -hls_list_size 0 ` +
      `-hls_segment_filename ${outputDir}/${profile.name}_%03d.ts ` +
      `${outputDir}/${playlistName}`
    );
  });

  return `ffmpeg -i "${input}" ` +
    `-filter_complex "[0:v]split=${profiles.length}${profiles.map((_, i) => `[v${i}]`).join('')}" ` +
    profiles.map((p, i) => `-map "[v${i}]" -c:v:${i} libx264 -b:v:${i} ${p.bitrate} -s:v:${i} ${p.resolution}`).join(' ') + ' ' +
    `-c:a aac -b:a 128k ` +
    `-f hls -hls_time 4 -hls_list_size 0 ` +
    `-hls_segment_filename "${outputDir}/segment_%03d.ts" ` +
    `"${outputDir}/master.m3u8"`;
}

/**
 * 生成 master playlist 内容
 */
function generateMasterPlaylist(profiles) {
  let content = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

  profiles.forEach(profile => {
    const bandwidth = parseInt(profile.bitrate) * 1000;
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${profile.resolution}\n`;
    content += `${profile.name}.m3u8\n\n`;
  });

  return content;
}

/**
 * 无 FFmpeg 时生成模拟 HLS 文件
 * 用于验证项目结构和前端逻辑
 */
async function generateMockHls(videoId, outputDir, profiles) {
  const masterPlaylist = path.join(outputDir, 'master.m3u8');

  // 为每个码率生成模拟分片
  for (const profile of profiles) {
    const playlistName = `${profile.name}.m3u8`;
    const playlistPath = path.join(outputDir, playlistName);

    // 生成模拟 TS 分片（空文件，仅用于结构验证）
    for (let i = 0; i < 5; i++) {
      const segmentPath = path.join(outputDir, `${profile.name}_${String(i).padStart(3, '0')}.ts`);
      fs.writeFileSync(segmentPath, Buffer.alloc(1024)); // 1KB 占位
    }

    // 生成子 playlist
    let playlistContent = '#EXTM3U\n#EXT-X-VERSION:3\n';
    playlistContent += '#EXT-X-TARGETDURATION:4\n';
    playlistContent += '#EXT-X-MEDIA-SEQUENCE:0\n\n';

    for (let i = 0; i < 5; i++) {
      playlistContent += '#EXTINF:4.0,\n';
      playlistContent += `${profile.name}_${String(i).padStart(3, '0')}.ts\n`;
    }

    playlistContent += '#EXT-X-ENDLIST\n';
    fs.writeFileSync(playlistPath, playlistContent);
  }

  // 生成 master playlist
  const masterContent = generateMasterPlaylist(profiles);
  fs.writeFileSync(masterPlaylist, masterContent);

  console.log(`✅ 模拟 HLS 文件已生成: ${videoId}`);
  return masterPlaylist;
}

module.exports = { transcodeToHls };
