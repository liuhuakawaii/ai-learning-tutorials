# 蓝牙与 NFC

## 场景引入

你接到一个智能门锁 App 的需求：用户靠近门锁时通过蓝牙自动连接，App 发送加密指令开锁；同时支持 NFC 刷卡开门。移动端蓝牙开发远比 Web 复杂——BLE 有扫描、连接、发现服务、读写特征值一整套流程，每一步都可能失败；NFC 在 Android 上需要处理 Intent，在 iOS 上仅支持特定标签格式。这节课我们从 BLE 原理到实际场景，把蓝牙和 NFC 的核心链路跑通。

## 学习目标

- 理解低功耗蓝牙 BLE 的核心概念（GATT、Service、Characteristic）
- 使用 react-native-ble-plx 实现设备扫描、连接和数据读写
- 了解 NFC 标签类型和读写方式
- 掌握蓝牙和 NFC 的权限配置与平台差异
- 将蓝牙能力应用到智能门锁等实际场景

---

## 一、BLE 核心概念

BLE 使用 GATT 协议通信：

| 概念 | 说明 | 类比 |
|------|------|------|
| Central | 发起连接的设备（手机） | 客户端 |
| Peripheral | 被连接的设备（传感器） | 服务器 |
| Service | 功能集合 | API 模块 |
| Characteristic | 具体数据点 | API 端点 |
| UUID | 服务和特征的唯一标识 | URL 路径 |

| 读写模式 | 说明 | 适用场景 |
|---------|------|---------|
| Read | 主动读取 | 获取传感器当前值 |
| Write | 写入数据 | 发送控制指令 |
| Notify | 设备主动推送 | 实时数据流（心率） |
| Indicate | 带确认的推送 | 关键数据（报警） |

---

## 二、react-native-ble-plx 实战

### 2.1 安装配置

```bash
npx expo install react-native-ble-plx
```

需要开发构建（不支持 Expo Go）。`app.json` 配置：

```json
{ "expo": { "plugins": [["react-native-ble-plx", {
  "isBackgroundEnabled": true,
  "bluetoothAlwaysPermission": "用于连接蓝牙门锁设备"
}]] } }
```

### 2.2 蓝牙管理与扫描

```typescript
import { BleManager, Device, State } from 'react-native-ble-plx'

const manager = new BleManager()

function waitForBluetooth(): Promise<boolean> {
  return new Promise((resolve) => {
    const sub = manager.onStateChange((state) => {
      if (state === State.PoweredOn) { sub.remove(); resolve(true) }
      else if (state === State.PoweredOff) resolve(false)
    }, true)
  })
}

function scanDevices(timeout: number, onDevice: (d: { id: string; name: string; rssi: number }) => void): Promise<void> {
  return new Promise((resolve) => {
    const discovered = new Set<string>()
    const timer = setTimeout(() => { manager.stopDeviceScan(); resolve() }, timeout)

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) { clearTimeout(timer); manager.stopDeviceScan(); resolve(); return }
      if (device?.name && !discovered.has(device.id)) {
        discovered.add(device.id)
        onDevice({ id: device.id, name: device.name, rssi: device.rssi ?? -100 })
      }
    })
  })
}
```

### 2.3 连接与数据读写

```typescript
async function connectAndDiscover(deviceId: string): Promise<Device> {
  const device = await manager.connectToDevice(deviceId, { timeout: 10000 })
  await device.discoverAllServicesAndCharacteristics()
  return device
}

async function readValue(device: Device, serviceUUID: string, charUUID: string) {
  const char = await device.readCharacteristicForService(serviceUUID, charUUID)
  return char.value  // Base64 编码
}

async function writeValue(device: Device, serviceUUID: string, charUUID: string, data: string) {
  await device.writeCharacteristicWithResponseForService(serviceUUID, charUUID, data)
}

function monitorValue(device: Device, serviceUUID: string, charUUID: string, onData: (v: string) => void) {
  const sub = device.monitorCharacteristicForService(serviceUUID, charUUID, (err, char) => {
    if (!err && char?.value) onData(char.value)
  })
  return { remove: () => sub.remove() }
}
```

### 2.4 Base64 编解码

```typescript
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function parseTemperature(base64: string): number {
  const bytes = base64ToBytes(base64)
  return (bytes[0] | (bytes[1] << 8)) / 100
}
```

---

## 三、NFC 标签读写

| NFC 类型 | 容量 | 常见用途 |
|---------|------|---------|
| Type 2 | 48B-2KB | 门禁卡、公交卡 |
| Type 4 | 32KB | 支付、身份识别 |

```typescript
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager'

async function readNdefTag(): Promise<string | null> {
  await NfcManager.requestTechnology(NfcTech.Ndef)
  const tag = await NfcManager.getTag()
  NfcManager.cancelTechnologyRequest()

  if (!tag?.ndefMessage?.length) return null
  const record = tag.ndefMessage[0]
  return record.type[0] === 0x54 ? Ndef.text.decodePayload(record.payload) : null
}

async function writeNdefText(text: string): Promise<boolean> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef)
    const bytes = Ndef.encodeMessage([Ndef.textRecord(text)])
    if (!bytes) return false
    await NfcManager.ndefHandler.writeNdefMessage(bytes)
    return true
  } catch { return false }
  finally { NfcManager.cancelTechnologyRequest() }
}
```

---

## 四、实际场景：智能门锁

```typescript
const LOCK_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb'
const LOCK_CMD = '0000fff1-0000-1000-8000-00805f9b34fb'
const LOCK_STATUS = '0000fff2-0000-1000-8000-00805f9b34fb'

class SmartLock {
  constructor(private device: Device) {}

  async unlock(): Promise<boolean> {
    await this.device.writeCharacteristicWithResponseForService(
      LOCK_SERVICE, LOCK_CMD, bytesToBase64(new Uint8Array([0x01]))
    )
    const status = await this.readStatus()
    return !status.isLocked
  }

  async readStatus() {
    const char = await this.device.readCharacteristicForService(LOCK_SERVICE, LOCK_STATUS)
    const bytes = base64ToBytes(char.value ?? '')
    return { isLocked: bytes[0] === 0x01, battery: bytes[1] }
  }

  onStatusChange(cb: (s: { isLocked: boolean; battery: number }) => void) {
    const sub = this.device.monitorCharacteristicForService(LOCK_SERVICE, LOCK_STATUS, (err, char) => {
      if (!err && char?.value) {
        const bytes = base64ToBytes(char.value)
        cb({ isLocked: bytes[0] === 0x01, battery: bytes[1] })
      }
    })
    return { remove: () => sub.remove() }
  }
}
```

使用示例：

```typescript
export function LockControlScreen() {
  const [lock, setLock] = useState<SmartLock | null>(null)
  const [state, setState] = useState<{ isLocked: boolean; battery: number } | null>(null)

  const connect = async () => {
    const btReady = await waitForBluetooth()
    if (!btReady) { Alert.alert('提示', '请开启蓝牙'); return }

    await scanDevices(8000, async (device) => {
      if (device.name?.includes('SmartLock')) {
        manager.stopDeviceScan()
        const connected = await connectAndDiscover(device.id)
        const lockInstance = new SmartLock(connected)
        setLock(lockInstance)
        setState(await lockInstance.readStatus())
        lockInstance.onStatusChange(setState)
      }
    })
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {lock ? (
        <>
          <Text style={{ fontSize: 48 }}>{state?.isLocked ? '🔒' : '🔓'}</Text>
          <Text>电量: {state?.battery ?? '--'}%</Text>
          <TouchableOpacity onPress={() => state?.isLocked ? lock.unlock() : lock.readStatus()}>
            <Text style={{ color: '#007AFF', fontSize: 18 }}>{state?.isLocked ? '开锁' : '关锁'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity onPress={connect}>
          <Text style={{ color: '#007AFF', fontSize: 18 }}>搜索门锁</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
```

---

## 常见误区

1. **在 Expo Go 中测试蓝牙**：react-native-ble-plx 不支持 Expo Go，必须用开发构建。
2. **忽略蓝牙状态检查**：必须在扫描前检查 `State.PoweredOn`。
3. **扫描不设超时**：持续扫描消耗电量，必须设超时。
4. **连接后不发现服务**：必须调用 `discoverAllServicesAndCharacteristics` 才能读写。
5. **NFC 只考虑 Android**：iOS 仅支持读取 NDEF 标签，不支持 HCE 模拟。

---

## 工程建议

1. **扫描结果去重并按信号强度排序**，优先连接信号好的设备。
2. **连接后保持心跳**，定期读取状态检测连接断开。
3. **BLE 操作串行执行**，同时读写会导致命令冲突。
4. **Android 12+ 需要 `BLUETOOTH_SCAN` 和 `BLUETOOTH_CONNECT` 运行时权限**。

---

## 小结

- BLE 通过 GATT 协议通信，核心流程是扫描→连接→发现服务→读写特征值
- react-native-ble-plx 需要开发构建环境，不支持 Expo Go
- NFC 标签类型不同，读写前需确认标签类型和容量
- 智能门锁场景需处理连接管理、指令协议和状态同步
- iOS 和 Android 的蓝牙和 NFC 能力差异较大，需分别适配

---

## 练习

### 练习一：BLE 温度传感器

扫描附近温度传感器，连接后订阅温度 Notify，实时显示温度。Service UUID: `0000181a-0000-1000-8000-00805f9b34fb`，Characteristic UUID: `00002a6e-0000-1000-8000-00805f9b34fb`。

### 练习二：NFC 标签管理

实现 NFC 标签管理工具：读取标签内容、写入自定义文本、显示标签 UID 和容量。

---

## 参考答案

### 练习一

**思路**：扫描指定 Service UUID 的设备，连接后订阅 Notify 解析温度值。

**答案**：

```typescript
import { useState, useEffect } from 'react'
import { View, Text } from 'react-native'

const TEMP_SERVICE = '0000181a-0000-1000-8000-00805f9b34fb'
const TEMP_CHAR = '00002a6e-0000-1000-8000-00805f9b34fb'

export function TemperatureMonitor() {
  const [temp, setTemp] = useState<number | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let device: Device | null = null
    let sub: { remove: () => void } | null = null

    const connect = async () => {
      const state = await manager.state()
      if (state !== State.PoweredOn) return

      manager.startDeviceScan([TEMP_SERVICE], null, async (err, found) => {
        if (err || !found) return
        manager.stopDeviceScan()
        device = await manager.connectToDevice(found.id)
        await device.discoverAllServicesAndCharacteristics()
        setConnected(true)

        sub = monitorValue(device, TEMP_SERVICE, TEMP_CHAR, (value) => {
          setTemp(parseTemperature(value))
        })
      })
    }

    connect()
    return () => { sub?.remove(); device?.cancelConnection(); manager.stopDeviceScan() }
  }, [])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 64, fontWeight: 'bold' }}>
        {temp !== null ? `${temp.toFixed(1)}°C` : '--'}
      </Text>
      <Text style={{ color: '#999' }}>{connected ? '已连接' : '搜索中...'}</Text>
    </View>
  )
}
```

**要点**：`startDeviceScan` 传入 Service UUID 过滤设备。温度是 16 位小端序有符号整数除以 100。

### 练习二

**思路**：读取标签 UID 和 NDEF 消息，写入时用 `Ndef.encodeMessage([Ndef.textRecord(text)])` 编码。UID 是字节数组需转十六进制。写入前必须 `requestTechnology(NfcTech.Ndef)`，写入后 `cancelTechnologyRequest()` 释放。

**答案要点**：
- 读取：`NfcManager.getTag()` 获取标签对象，`tag.ndefMessage[0]` 解析第一条记录
- 文本记录判断：`record.type[0] === 0x54`，用 `Ndef.text.decodePayload` 解码
- 写入：`Ndef.encodeMessage` 编码 → `ndefHandler.writeNdefMessage` 写入
- 标签名写入超时需 2-3 秒，写入期间不要移开标签
- 不是所有 NFC 标签都支持写入，需用 `isWritable` 检查
