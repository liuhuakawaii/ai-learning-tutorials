# 阶段实战：签到 App

## 场景引入

经过前面五节课，你已掌握定位、地图、生物识别和本地存储。现在把这些能力组合起来，做一个完整的考勤签到 App：地图显示签到范围（公司周围 200 米），进入范围后用 Face ID 验证身份，验证通过后记录签到信息到 SQLite。签到历史按日期分组展示。

## 学习目标

- 综合运用 expo-location、react-native-maps、expo-local-authentication、expo-sqlite
- 实现地理围栏检测与签到状态联动
- 设计签到记录的数据模型和存储方案
- 构建签到历史列表界面
- 处理边界情况和错误恢复

---

## 一、配置常量

```typescript
export const CHECK_IN_CONFIG = {
  office: { latitude: 39.9042, longitude: 116.4074, name: '公司总部' },
  fenceRadius: 200, lateThreshold: 9,
}
```

---

## 二、数据库层

```typescript
// lib/database.ts
import * as SQLite from 'expo-sqlite'

let db: SQLite.SQLiteDatabase | null = null

export async function initDatabase() {
  if (db) return db
  db = await SQLite.openDatabaseAsync('checkin.db')
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS check_in_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL, check_in_time INTEGER NOT NULL,
      latitude REAL NOT NULL, longitude REAL NOT NULL,
      location_name TEXT, type TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'success'
    );`)
  return db
}

export interface CheckInRecord {
  id?: number; user_id: string; check_in_time: number
  latitude: number; longitude: number; location_name?: string
  type: 'normal' | 'late' | 'early_leave' | 'overtime'; status: 'success' | 'failed'
}

export async function insertCheckIn(record: CheckInRecord) {
  const database = await initDatabase()
  const result = await database.runAsync(
    `INSERT INTO check_in_records (user_id, check_in_time, latitude, longitude, location_name, type, status) VALUES (?,?,?,?,?,?,?)`,
    [record.user_id, record.check_in_time, record.latitude, record.longitude, record.location_name ?? null, record.type, record.status])
  return result.lastInsertRowId
}

export async function getTodayCheckIns(userId: string): Promise<CheckInRecord[]> {
  const database = await initDatabase()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  return database.getAllAsync<CheckInRecord>(
    'SELECT * FROM check_in_records WHERE user_id = ? AND check_in_time >= ? ORDER BY check_in_time DESC',
    [userId, todayStart.getTime()])
}

export async function getCheckInHistory(userId: string, page = 1, pageSize = 20) {
  const database = await initDatabase()
  const offset = (page - 1) * pageSize
  const count = await database.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) as total FROM check_in_records WHERE user_id = ?', [userId])
  const records = await database.getAllAsync<CheckInRecord>(
    'SELECT * FROM check_in_records WHERE user_id = ? ORDER BY check_in_time DESC LIMIT ? OFFSET ?',
    [userId, pageSize, offset])
  return { records, total: count?.total ?? 0 }
}
```

---

## 三、定位、围栏与认证

```typescript
// lib/location.ts — 同时包含定位、围栏检测和生物识别
import * as Location from 'expo-location'
import * as LocalAuthentication from 'expo-local-authentication'
import { CHECK_IN_CONFIG } from '../constants/config'

export interface UserLocation { latitude: number; longitude: number; accuracy: number; timestamp: number }

export async function getCurrentLocation(): Promise<UserLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return null
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy, timestamp: loc.timestamp }
}

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function checkFenceStatus(loc: UserLocation) {
  const distance = calcDistance(loc.latitude, loc.longitude, CHECK_IN_CONFIG.office.latitude, CHECK_IN_CONFIG.office.longitude)
  return { isInside: distance <= CHECK_IN_CONFIG.fenceRadius, distance }
}

export function getCheckInType() { return new Date().getHours() >= CHECK_IN_CONFIG.lateThreshold ? 'late' as const : 'normal' as const }

export async function authenticateForCheckIn() {
  if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync()))
    return { success: true, method: 'password' as const }
  const r = await LocalAuthentication.authenticateAsync({ prompt: '验证身份完成签到' })
  return r.success ? { success: true, method: 'biometric' as const } : { success: false, method: 'biometric' as const, error: '验证失败' }
}
```

---

## 四、签到业务逻辑

```typescript
// lib/check-in.ts
import { getCurrentLocation, checkFenceStatus, getCheckInType, authenticateForCheckIn } from './location'
import { insertCheckIn, getTodayCheckIns } from './database'
import { CHECK_IN_CONFIG } from '../constants/config'

export async function performCheckIn(userId: string) {
  const location = await getCurrentLocation()
  if (!location) return { success: false, message: '无法获取位置，请检查定位权限' }

  const fence = checkFenceStatus(location)
  if (!fence.isInside) return { success: false, message: `不在签到范围内（距公司 ${Math.round(fence.distance)} 米）` }
  if (location.accuracy > 50) return { success: false, message: '定位精度不足，请稍后重试' }

  const auth = await authenticateForCheckIn()
  if (!auth.success) return { success: false, message: auth.error ?? '身份验证失败' }

  const today = await getTodayCheckIns(userId)
  if (today.some(r => Date.now() - r.check_in_time < 60000)) return { success: false, message: '请勿重复签到（1 分钟内）' }

  const type = getCheckInType()
  const id = await insertCheckIn({
    user_id: userId, check_in_time: Date.now(), latitude: location.latitude, longitude: location.longitude,
    location_name: CHECK_IN_CONFIG.office.name, type, status: 'success',
  })

  return { success: true, message: type === 'late' ? '签到成功（迟到）' : '签到成功',
    record: { id, user_id: userId, check_in_time: Date.now(), latitude: location.latitude,
      longitude: location.longitude, type, status: 'success' as const } }
}
```

---

## 五、签到主页

```typescript
// app/(tabs)/index.tsx
import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import MapView, { Circle, Marker } from 'react-native-maps'
import * as Location from 'expo-location'
import { CHECK_IN_CONFIG } from '../../constants/config'
import { checkFenceStatus, UserLocation } from '../../lib/location'
import { performCheckIn } from '../../lib/check-in'
import { getTodayCheckIns, CheckInRecord } from '../../lib/database'

export default function CheckInScreen() {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [fence, setFence] = useState<{ isInside: boolean; distance: number } | null>(null)
  const [records, setRecords] = useState<CheckInRecord[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    const u = { latitude: loc.coords.latitude, longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy, timestamp: loc.timestamp }
    setLocation(u); setFence(checkFenceStatus(u))
  }, [])

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { Alert.alert('提示', '需要定位权限'); return }
      await refresh(); setRecords(await getTodayCheckIns('user_001'))
    })()
    const timer = setInterval(refresh, 10000)
    return () => clearInterval(timer)
  }, [refresh])

  const handleCheckIn = async () => {
    setLoading(true)
    try {
      const r = await performCheckIn('user_001')
      Alert.alert(r.success ? '成功' : '失败', r.message)
      if (r.success && r.record) setRecords(prev => [r.record!, ...prev])
    } finally { setLoading(false) }
  }

  return (
    <View style={{ flex: 1 }}>
      {location && (
        <MapView style={{ flex: 1 }} initialRegion={{ ...CHECK_IN_CONFIG.office, latitudeDelta: 0.005, longitudeDelta: 0.005 }}>
          <Circle center={CHECK_IN_CONFIG.office} radius={CHECK_IN_CONFIG.fenceRadius}
            fillColor={fence?.isInside ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)'}
            strokeColor={fence?.isInside ? '#34C759' : '#FF3B30'} strokeWidth={2} />
          <Marker coordinate={location} title="我的位置" pinColor="#007AFF" />
          <Marker coordinate={CHECK_IN_CONFIG.office} title={CHECK_IN_CONFIG.office.name} pinColor="#FF9500" />
        </MapView>
      )}
      <View style={styles.panel}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 8, backgroundColor: fence?.isInside ? '#34C759' : '#FF3B30' }} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '500' }}>
            {fence?.isInside ? '在签到范围内' : `距公司 ${Math.round(fence?.distance ?? 0)} 米`}
          </Text>
        </View>
        <TouchableOpacity style={{ height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
          backgroundColor: fence?.isInside && !loading ? '#007AFF' : '#C7C7CC' }}
          onPress={handleCheckIn} disabled={!fence?.isInside || loading}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{loading ? '签到中...' : '签到'}</Text>
        </TouchableOpacity>
        {records.length > 0 && (() => {
          const d = new Date(records[0].check_in_time)
          const t = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
          return <Text style={{ textAlign: 'center', color: '#999', marginTop: 12 }}>今日已签到 {records.length} 次 · 最近 {t}</Text>
        })()}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 8 },
})
```

---

## 六、签到历史

```typescript
// app/(tabs)/history.tsx
import { useState, useEffect } from 'react'
import { View, Text, SectionList } from 'react-native'
import { getCheckInHistory, CheckInRecord } from '../../lib/database'

function groupByDate(records: CheckInRecord[]) {
  const groups = new Map<string, CheckInRecord[]>()
  records.forEach(r => {
    const d = new Date(r.check_in_time)
    const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  })
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }))
}

const typeMap: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: '#34C759' }, late: { label: '迟到', color: '#FF9500' },
  early_leave: { label: '早退', color: '#FF9500' }, overtime: { label: '加班', color: '#007AFF' },
}

export default function HistoryScreen() {
  const [sections, setSections] = useState<{ title: string; data: CheckInRecord[] }[]>([])
  const [page, setPage] = useState(1)

  const loadMore = async () => {
    const { records } = await getCheckInHistory('user_001', page)
    setSections(prev => {
      const merged = new Map(prev.map(s => [s.title, s.data]))
      groupByDate(records).forEach(s => { const ex = merged.get(s.title) ?? []; merged.set(s.title, [...ex, ...s.data]) })
      return Array.from(merged.entries()).map(([title, data]) => ({ title, data }))
    })
    setPage(p => p + 1)
  }

  useEffect(() => { loadMore() }, [])

  return (
    <SectionList sections={sections} keyExtractor={i => i.id?.toString() ?? ''}
      onEndReached={loadMore} onEndReachedThreshold={0.5}
      renderSectionHeader={({ section }) => (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#f5f5f5' }}>
          <Text style={{ fontWeight: '600' }}>{section.title}</Text>
          <Text style={{ color: '#999', fontSize: 12 }}>{section.data.length} 次</Text>
        </View>
      )}
      renderItem={({ item }) => {
        const t = new Date(item.check_in_time), info = typeMap[item.type] ?? { label: '?', color: '#999' }
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 12, marginBottom: 1, borderRadius: 8 }}>
            <Text style={{ width: 60, fontSize: 18, fontWeight: '600' }}>
              {t.getHours().toString().padStart(2, '0')}:{t.getMinutes().toString().padStart(2, '0')}
            </Text>
            <View style={{ flex: 1 }}>
              <Text>{item.location_name ?? '未知'}</Text>
              <Text style={{ fontSize: 11, color: '#999' }}>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</Text>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: info.color + '20' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: info.color }}>{info.label}</Text>
            </View>
          </View>
        )
      }}
      ListEmptyComponent={<View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: '#999' }}>暂无签到记录</Text></View>}
    />
  )
}
```

---

## 常见误区

1. **不处理定位精度**：室内精度 > 100 米，必须设精度阈值（本例 50 米）。
2. **签到时间用客户端时间**：客户端时间可被篡改，生产环境应以服务端为准。
3. **围栏半径太小**：200 米在高楼区可能因 GPS 漂移误判，建议 300-500 米。
4. **SQLite 不做数据迁移**：schema 变更时需要版本迁移，否则升级 App 会崩溃。

---

## 工程建议

1. **定位精度动态调整**：首次用 High，后续用 Balanced 节省电量。
2. **用 `watchPositionAsync` 持续监听**，动态更新围栏状态。
3. **SQLite 写操作串行化**，避免并发锁死。
4. **离线签到支持**：无网络时记录本地，有网络后同步服务端。

---

## 小结

- 签到 App 综合了定位、地图、生物识别和本地存储四大原生能力
- 地理围栏用距离计算判断范围，需处理精度和边界情况
- SQLite 提供结构化本地存储，适合签到记录的增删改查
- 完整签到系统还需服务端同步、数据加密和管理员后台

---

## 练习

### 练习一：签到统计页面

显示当月出勤天数、迟到次数、缺勤天数。用柱状图展示每天签到时间分布。

### 练习二：Wi-Fi 签到增强

在 GPS 围栏基础上增加 Wi-Fi 检测：连接公司 Wi-Fi 时视为有效签到。两个条件满足其一即可。

---

## 参考答案

### 练习一

**思路**：查询当月记录按日期分组，用 `Set` 统计出勤天数，柱状图用 `View` 高度映射签到时间。

**要点**：
- `getCheckInHistory(userId, 1, 100)` 获取当月记录，按 `getMonth()` 过滤
- `new Set(records.map(r => new Date(r.check_in_time).getDate()))` 统计出勤天数
- 工作日计算：遍历当月每天，排除周末（`getDay() === 0 || 6`）
- 柱状图高度：`Math.max(4, (hour - 8) * 20)`，8:00 基准线，迟到用橙色

### 练习二

**思路**：使用 `react-native-wifi-reborn` 获取 SSID，GPS 围栏和 Wi-Fi 是"或"关系。

**要点**：
- `WifiManager.getCurrentWifiSSID()` 获取 SSID，Android 需精确位置权限
- 签到逻辑：`if (!fence?.isInside && !wifi.isCompany)` 两个条件都不满足才拒绝
- 记录中 `location_name` 注明来源（`'公司 Wi-Fi'` 或 GPS），便于审核
