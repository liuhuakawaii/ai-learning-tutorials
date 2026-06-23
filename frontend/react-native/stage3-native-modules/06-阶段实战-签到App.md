# 阶段实战：签到 App

## 做什么

构建地理签到 App：GPS 定位 + 地图展示 + 生物识别验证 + 签到记录。综合运用原生模块（定位、地图、生物识别）。

## 功能清单

1. GPS 定位获取当前位置
2. 地图展示签到点
3. 生物识别验证（指纹/Face ID）
4. 签到记录列表
5. 签到范围检查（距离目标点 100 米内）

## 技术栈

- expo-location（GPS）
- react-native-maps（地图）
- expo-local-authentication（生物识别）
- AsyncStorage（签到记录持久化）

## 配置

```bash
npx expo install expo-location react-native-maps expo-local-authentication
```

## GPS 定位

```typescript
// hooks/useLocation.ts
import { useState, useEffect } from 'react'
import * as Location from 'expo-location'

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setError('需要定位权限')
        setLoading(false)
        return
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setLocation(loc)
      setLoading(false)
    })()
  }, [])

  return { location, error, loading }
}
```

## 地图组件

```tsx
// components/MapView.tsx
import MapView, { Marker } from 'react-native-maps'

export function CheckInMap({ location, checkInPoints }) {
  if (!location) return null

  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation
    >
      {checkInPoints.map(point => (
        <Marker
          key={point.id}
          coordinate={{ latitude: point.lat, longitude: point.lng }}
          title={point.name}
          description={`距离: ${point.distance}m`}
          pinColor={point.checkedIn ? '#22c55e' : '#3b82f6'}
        />
      ))}
    </MapView>
  )
}
```

## 生物识别

```typescript
// utils/biometric.ts
import * as LocalAuthentication from 'expo-local-authentication'

export async function authenticate(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  if (!hasHardware) return true // 没有生物识别硬件，跳过

  const isEnrolled = await LocalAuthentication.isEnrolledAsync()
  if (!isEnrolled) return true

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: '验证身份以签到',
    cancelLabel: '取消',
  })

  return result.success
}
```

## 距离计算

```typescript
// utils/distance.ts
export function getDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000 // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
```

## 签到逻辑

```typescript
// stores/checkin.ts
export const useCheckInStore = create()(persist(
  (set, get) => ({
    records: [],
    checkIn: async (pointId: string, location: LocationObject) => {
      // 1. 验证距离
      const point = CHECK_IN_POINTS.find(p => p.id === pointId)
      const distance = getDistance(
        location.coords.latitude, location.coords.longitude,
        point.lat, point.lng
      )
      if (distance > 100) return { error: `距离签到点 ${Math.round(distance)} 米，需要在 100 米内` }

      // 2. 生物识别
      const authenticated = await authenticate()
      if (!authenticated) return { error: '身份验证失败' }

      // 3. 记录签到
      set((s) => ({
        records: [...s.records, {
          id: Date.now().toString(),
          pointId,
          pointName: point.name,
          timestamp: new Date().toISOString(),
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        }],
      }))

      return { success: true }
    },
  }),
  { name: 'checkin-records', storage: createJSONStorage(() => AsyncStorage) }
))
```

## 练习

### 练习一：完整签到 App

实现全部功能：地图 + 定位 + 生物识别 + 签到 + 记录列表。

### 练习二：签到历史

签到记录页面，按日期分组，支持查看签到位置的地图标注。

### 练习三：考勤统计

添加统计页面：本周签到天数、迟到次数、最早签到时间。

---

## 参考答案

### 练习一

按本课代码结构：定位 Hook → 地图组件 → 生物识别 → 距离计算 → 签到逻辑 → 记录列表。

### 练习二

```tsx
const records = useCheckInStore(s => s.records)
const grouped = records.reduce((acc, r) => {
  const date = r.timestamp.slice(0, 10)
  acc[date] = acc[date] || []
  acc[date].push(r)
  return acc
}, {})

<SectionList
  sections={Object.entries(grouped).map(([date, items]) => ({ title: date, data: items }))}
  renderItem={({ item }) => <CheckInRecord record={item} />}
  renderSectionHeader={({ section }) => <Text>{section.title}</Text>}
/>
```

### 练习三

```typescript
const thisWeek = records.filter(r => {
  const date = new Date(r.timestamp)
  const now = new Date()
  const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
  return date >= weekStart
})
const days = new Set(thisWeek.map(r => r.timestamp.slice(0, 10))).size
```
