# Camera 与图片

## 场景引入

你在做一个社区 App，用户需要拍照发帖、从相册选图、裁剪后上传。实际开发中你会遇到：拍照后图片方向不对、选图后文件太大上传超时、裁剪坐标计算错误、Android 和 iOS 的权限弹窗时机不同。这节课我们把拍照→选图→裁剪→上传的完整链路打通。

## 学习目标

- 使用 expo-camera 实现拍照和录像功能
- 处理相册权限和图片选择
- 使用 expo-image-manipulator 裁剪和压缩图片
- 通过 FormData 上传图片到服务器
- 理解图片优化策略和平台差异

---

## 一、expo-camera 拍照

### 1.1 基本配置

```bash
npx expo install expo-camera
```

`app.json` 配置权限：

```json
{
  "expo": {
    "plugins": [["expo-camera", {
      "cameraPermission": "允许访问相机以拍照和录像",
      "microphonePermission": "允许访问麦克风以录制视频"
    }]]
  }
}
```

### 1.2 拍照组件

```typescript
import { useState, useRef } from 'react'
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [photo, setPhoto] = useState<string | null>(null)

  if (!permission) return <View />
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>需要相机权限才能拍照</Text>
        <TouchableOpacity onPress={requestPermission}>
          <Text style={styles.link}>授予权限</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const takePicture = async () => {
    if (!cameraRef.current) return
    const result = await cameraRef.current.takePictureAsync({ quality: 0.8 })
    if (result) setPhoto(result.uri)
  }

  return (
    <CameraView ref={cameraRef} style={styles.camera} facing="back">
      <View style={styles.controls}>
        <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
          <View style={styles.captureInner} />
        </TouchableOpacity>
      </View>
    </CameraView>
  )
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
  controls: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 40 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  link: { color: '#007AFF', marginTop: 8 },
})
```

---

## 二、权限管理

```typescript
import * as ImagePicker from 'expo-image-picker'
import { Linking, Alert, Platform } from 'react-native'

function showPermissionAlert(type: 'camera' | 'photos') {
  Alert.alert(`${type === 'camera' ? '相机' : '相册'}权限被拒绝`, '请在系统设置中开启', [
    { text: '取消', style: 'cancel' },
    { text: '去设置', onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings() },
  ])
}
```

---

## 三、图片选择与裁剪

### 3.1 expo-image-picker 选图

```bash
npx expo install expo-image-picker
```

```typescript
import * as ImagePicker from 'expo-image-picker'

async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  })
  if (result.canceled) return null
  return result.assets[0].uri
}
```

### 3.2 expo-image-manipulator 裁剪与压缩

```bash
npx expo install expo-image-manipulator
```

```typescript
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

async function cropAndCompress(uri: string, cropRegion: {
  originX: number; originY: number; width: number; height: number
}): Promise<string> {
  const result = await manipulateAsync(uri, [
    { crop: cropRegion },
    { resize: { width: 800 } },
  ], { compress: 0.7, format: SaveFormat.JPEG })
  return result.uri
}
```

---

## 四、图片上传

### 4.1 FormData 上传

```typescript
import { Platform } from 'react-native'

async function uploadImage(uri: string, endpoint: string): Promise<{ url: string }> {
  const formData = new FormData()
  const filename = uri.split('/').pop() ?? 'photo.jpg'

  formData.append('image', {
    uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
    name: filename,
    type: 'image/jpeg',
  } as any)

  const response = await fetch(endpoint, { method: 'POST', body: formData })
  if (!response.ok) throw new Error(`上传失败: ${response.status}`)
  return response.json()
}
```

### 4.2 带进度的上传

```typescript
import * as FileSystem from 'expo-file-system'

async function uploadWithProgress(
  uri: string, endpoint: string, onProgress: (pct: number) => void
) {
  const upload = FileSystem.createUploadTask(endpoint, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'image',
  }, (progress) => {
    onProgress(Math.round(progress.totalBytesSent / progress.totalBytesExpectedToSend * 100))
  })
  const result = await upload.uploadAsync()
  return JSON.parse(result.body)
}
```

---

## 五、图片优化策略

```typescript
function getCompressOptions(purpose: 'avatar' | 'post' | 'thumbnail') {
  switch (purpose) {
    case 'avatar':    return { maxWidth: 400,  quality: 0.8 }
    case 'post':      return { maxWidth: 1200, quality: 0.7 }
    case 'thumbnail': return { maxWidth: 200,  quality: 0.5 }
  }
}

async function compressForUpload(uri: string, purpose: 'avatar' | 'post' | 'thumbnail') {
  const opts = getCompressOptions(purpose)
  const result = await manipulateAsync(uri, [{ resize: { width: opts.maxWidth } }], {
    compress: opts.quality, format: SaveFormat.JPEG
  })
  return result.uri
}
```

---

## 常见误区

1. **拍照后图片方向不对**：iOS 的 EXIF 旋转信息会导致显示方向错误，用 `expo-image-manipulator` 处理会自动修正。
2. **不压缩直接上传原图**：手机拍照动辄 5-10MB，必须压缩。头像 200KB 以内，帖子图 500KB 以内。
3. **在组件渲染时请求权限**：权限应在用户触发操作时发起，不是页面加载时。
4. **忽略 Android 的 file:// URI 限制**：Android 7+ 不允许 file:// 跨应用传递，需用缓存路径。
5. **不清理临时文件**：裁剪和压缩会生成临时文件，长期不清理会占满存储。

---

## 工程建议

1. **选图质量按场景区分**：头像 0.7 + 400px，帖子 0.8 + 1200px，缩略图 0.5 + 200px。
2. **上传失败支持重试**：实现 3 次重试 + 指数退避。
3. **用 `expo-file-system` 的上传 API**：比 fetch + FormData 多了进度回调。
4. **图片缓存用 MD5 哈希命名**：避免冲突且不重复下载。

---

## 小结

- expo-camera 提供开箱即用的拍照录像能力，注意权限申请时机
- expo-image-picker 的 `allowsEditing` 实现简单裁剪，复杂裁剪用 expo-image-manipulator
- 上传前必须压缩，根据用途选择不同压缩策略
- FormData 上传需处理 iOS/Android 的 URI 差异

---

## 练习

### 练习一：图片选择与预览

实现图片选择组件，支持从相册选择或拍照，显示预览图和压缩后文件大小，用户可重新选择或确认上传。

### 练习二：多图上传

实现最多选择 9 张图片的组件，支持预览、删除，上传时显示每张图片的进度。

---

## 参考答案

### 练习一

**思路**：封装组件，底部弹出选择来源，选择后压缩并显示预览。

**答案**：

```typescript
import { useState } from 'react'
import { View, Image, TouchableOpacity, Text, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

export function ImagePickerWithPreview() {
  const [image, setImage] = useState<{ uri: string; size: number } | null>(null)

  const pickAndCompress = async (source: 'camera' | 'library') => {
    const launcher = source === 'camera'
      ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync
    const result = await launcher({ allowsEditing: true, aspect: [4, 3], quality: 1 })
    if (result.canceled) return

    const compressed = await manipulateAsync(
      result.assets[0].uri, [{ resize: { width: 1000 } }],
      { compress: 0.7, format: SaveFormat.JPEG }
    )
    setImage({ uri: compressed.uri, size: compressed.height * compressed.width * 0.3 })
  }

  return (
    <View style={{ padding: 16 }}>
      {image ? (
        <View>
          <Image source={{ uri: image.uri }} style={{ width: '100%', height: 200, borderRadius: 8 }} />
          <Text style={{ color: '#666', marginTop: 8 }}>
            压缩后: ~{(image.size / 1024).toFixed(0)}KB
          </Text>
          <TouchableOpacity onPress={() => setImage(null)}>
            <Text style={{ color: '#FF3B30', marginTop: 8 }}>重新选择</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={() => pickAndCompress('camera')}>
            <Text style={{ color: '#007AFF' }}>拍照</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => pickAndCompress('library')}>
            <Text style={{ color: '#007AFF' }}>从相册选择</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}
```

**要点**：`quality: 1` 获取原图，再用 manipulateAsync 精确控制压缩。

### 练习二

**思路**：用数组管理图片列表，每张独立管理上传状态和进度。使用 `FileSystem.createUploadTask` 带进度回调，串行上传避免服务器拒绝。

**答案要点**：
- `allowsMultipleSelection: true` + `selectionLimit: 9 - images.length` 控制多选上限
- 每张图片压缩后用 `manipulateAsync` 生成 1000px 宽的版本
- 上传用 `FileSystem.createUploadTask` 的 `MULTIPART` 模式，进度回调更新 `progress` 状态
- 串行 `for` 循环执行上传，`updated[i] = { ...updated[i], status: 'uploading' }` 触发重渲染
- 删除按钮用 `setImages(prev => prev.filter(img => img.id !== id))` 移除图片
