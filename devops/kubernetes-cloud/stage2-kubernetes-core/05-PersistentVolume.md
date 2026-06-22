# PersistentVolume

## 场景引入

你用 Deployment 部署了一个 PostgreSQL 数据库。某天 Node 硬件故障，Pod 被调度到另一台 Node 上——但数据全丢了。这是因为容器的文件系统是临时的，容器销毁时数据就没了。

K8s 的持久化存储体系（PV/PVC/StorageClass）解决了这个问题。它把存储的生命周期和 Pod 的生命周期解耦：Pod 可以销毁重建，但数据持久保存在独立的存储卷中。

## 学习目标

1. 理解 PV 和 PVC 的绑定机制
2. 掌握静态供给和动态供给的区别
3. 了解 StorageClass 的作用
4. 掌握 StatefulSet 的使用场景
5. 学会为有状态应用配置持久化存储

## PV 与 PVC 模型

K8s 的存储模型分为两层：

- **PersistentVolume（PV）**：集群中的存储资源，由管理员创建或通过 StorageClass 动态创建
- **PersistentVolumeClaim（PVC）**：用户对存储的请求，声明需要多大、什么类型的存储

```
管理员/StorageClass          用户
      │                      │
      ▼                      ▼
┌──────────┐          ┌──────────┐
│ PV       │ ◄────── │ PVC      │
│ 10Gi SSD │  绑定    │ 需要10Gi │
└──────────┘          └──────────┘
```

### 创建 PV（静态供给）

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: local-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce        # 单节点读写
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /data/pv1
    type: DirectoryOrCreate
```

### 创建 PVC

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### 在 Pod 中使用 PVC

```yaml
spec:
  containers:
    - name: db
      image: postgres:15
      volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: my-pvc
```

## PV 生命周期

```
Available → Bound → Released → (Deleted / Retained)
```

**Available**：PV 已创建，尚未绑定到 PVC。

**Bound**：PV 已绑定到 PVC，分配给 Pod 使用。

**Released**：PVC 被删除，但 PV 尚未回收。

**回收策略**：
- **Retain**：PV 保留数据，需要管理员手动清理
- **Delete**：PV 和底层存储一起删除
- **Recycle**（已废弃）：清空数据后变为 Available

## Access Modes

| 模式 | 简写 | 说明 |
|------|------|------|
| ReadWriteOnce | RWO | 单节点读写 |
| ReadOnlyMany | ROX | 多节点只读 |
| ReadWriteMany | RWX | 多节点读写 |
| ReadWriteOncePod | RWOP | 单 Pod 读写（K8s 1.27+） |

不同的存储后端支持不同的 Access Mode：
- 本地存储：RWO
- NFS：RWO, ROX, RWX
- AWS EBS：RWO
- AWS EFS：RWO, ROX, RWX
- Ceph RBD：RWO, ROX

## StorageClass（动态供给）

手动创建 PV 太繁琐。StorageClass 定义了存储的"模板"，当 PVC 请求存储时自动创建 PV。

### 创建 StorageClass

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/no-provisioner  # 本地存储
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
```

云厂商的 StorageClass 示例：

```yaml
# AWS EBS
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
```

### 使用 StorageClass

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: fast-pvc
spec:
  storageClassName: fast-ssd    # 指定 StorageClass
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
```

### 默认 StorageClass

```bash
# 查看 StorageClass
kubectl get storageclass

# 设置默认 StorageClass
kubectl patch storageclass standard -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

## StatefulSet

Deployment 创建的 Pod 名称是随机的（web-api-7d4f8b9-xz2k），存储也是临时的。对于有状态应用（数据库、消息队列），你需要：

1. Pod 名称稳定（mysql-0, mysql-1, mysql-2）
2. 每个 Pod 有独立的持久化存储
3. Pod 按顺序创建和销毁

StatefulSet 就是为这种场景设计的。

### StatefulSet 示例

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          ports:
            - containerPort: 3306
          env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secret
                  key: password
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: standard
        resources:
          requests:
            storage: 10Gi
```

### StatefulSet 的特点

```bash
# Pod 名称是有序的
kubectl get pods -l app=mysql
# mysql-0
# mysql-1
# mysql-2

# 每个 Pod 有独立的 PVC
kubectl get pvc
# data-mysql-0    Bound    pvc-xxx    10Gi
# data-mysql-1    Bound    pvc-yyy    10Gi
# data-mysql-2    Bound    pvc-zzz    10Gi
```

StatefulSet 的行为规则：
- **创建顺序**：Pod 按 0, 1, 2 顺序创建，前一个 Ready 后才创建下一个
- **删除顺序**：Pod 按 2, 1, 0 逆序删除
- **Pod 名称稳定**：重建后名称不变，PVC 自动重新绑定
- **Headless Service**：每个 Pod 有稳定的 DNS 名称

### StatefulSet 的 Headless Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql
spec:
  clusterIP: None    # Headless
  selector:
    app: mysql
  ports:
    - port: 3306
```

```bash
# 每个 Pod 有稳定的 DNS 名称
# mysql-0.mysql.default.svc.cluster.local
# mysql-1.mysql.default.svc.cluster.local
# mysql-2.mysql.default.svc.cluster.local
```

## 本地开发用 hostPath

在 Kind/Minikube 本地开发环境中，可以使用 hostPath 作为简单的持久化方案：

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: local-pv
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: /tmp/data
```

注意：hostPath 仅适合本地开发，不适合生产环境。Node 故障时 hostPath 数据会丢失。

## 常见误区

**误区一："hostPath 可以用于生产"**

hostPath 没有副本、没有备份、Node 故障数据丢失。生产环境必须用网络存储（NFS、Ceph、云存储）。

**误区二："PVC 绑定失败是因为 PV 不够大"**

PVC 绑定失败的常见原因：Access Mode 不匹配、StorageClass 不匹配、没有 Available 的 PV、Label 不匹配。

**误区三："StatefulSet 的 Pod 删除后数据会丢失"**

StatefulSet 的 PVC 是独立于 Pod 的。Pod 删除后 PVC 仍然存在，重建的 Pod 会重新绑定到同一个 PVC。

## 工程建议

1. **有状态应用用 StatefulSet**：数据库、消息队列、Elasticsearch 等
2. **使用 StorageClass 动态供给**：避免手动创建 PV
3. **设置 volumeBindingMode: WaitForFirstConsumer**：确保 PV 在 Pod 调度的 Node 上创建
4. **生产环境用网络存储**：NFS、Ceph、云厂商的块存储或文件存储
5. **备份策略**：定期备份 PV 数据，特别是数据库

## 小结

- PV 是存储资源，PVC 是存储请求，两者绑定后 Pod 可以使用
- StorageClass 实现动态 PV 供给，避免手动创建
- Access Mode 决定存储的读写和共享能力
- StatefulSet 为有状态应用提供稳定的 Pod 名称和独立存储
- hostPath 仅适合本地开发，生产环境用网络存储

## 练习

### 练习一：PV/PVC 实践

在本地集群上完成：
1. 创建一个 hostPath PV（5Gi）
2. 创建一个 PVC 绑定到该 PV
3. 创建一个 Pod 使用该 PVC 写入数据
4. 删除 Pod，创建新 Pod 使用同一 PVC，验证数据仍在

### 练习二：StatefulSet 部署

使用 StatefulSet 部署一个 3 副本的 Redis 集群：
1. 创建 Headless Service
2. 创建 StatefulSet 使用 volumeClaimTemplates
3. 验证 Pod 名称和 PVC 的对应关系

---

## 参考答案

### 练习一

**答案**：

```bash
# 1. 创建 PV
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: test-pv
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: /tmp/test-data
    type: DirectoryOrCreate
EOF

# 2. 创建 PVC
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
EOF

# 3. 创建 Pod 写入数据
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: writer
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'echo "Hello PV" > /data/test.txt; sleep 3600']
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: test-pvc
EOF

# 4. 验证数据
kubectl exec writer -- cat /data/test.txt
# 输出: Hello PV

# 5. 删除 Pod
kubectl delete pod writer

# 6. 创建新 Pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: reader
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'cat /data/test.txt; sleep 3600']
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: test-pvc
EOF

# 7. 验证数据仍在
kubectl logs reader
# 输出: Hello PV

# 清理
kubectl delete pod reader
kubectl delete pvc test-pvc
kubectl delete pv test-pv
```

### 练习二

**答案**：

```yaml
# 1. Headless Service
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  clusterIP: None
  selector:
    app: redis
  ports:
    - port: 6379
---
# 2. StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: redis
  replicas: 3
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7
          ports:
            - containerPort: 6379
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        resources:
          requests:
            storage: 1Gi
```

```bash
# 验证
kubectl get pods -l app=redis
# redis-0
# redis-1
# redis-2

kubectl get pvc
# data-redis-0    Bound    ...
# data-redis-1    Bound    ...
# data-redis-2    Bound    ...

# DNS 验证
kubectl exec redis-0 -- nslookup redis
# 返回 redis-0, redis-1, redis-2 的 IP
```

**要点**：
- StatefulSet 的 Pod 名称是稳定的（redis-0, redis-1, redis-2）
- 每个 Pod 自动获得独立的 PVC（data-redis-0, data-redis-1, data-redis-2）
- Headless Service 提供稳定的 DNS 入口
