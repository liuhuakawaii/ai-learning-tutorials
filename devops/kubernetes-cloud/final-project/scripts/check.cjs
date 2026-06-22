const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COURSE_ROOT = path.resolve(PROJECT_ROOT, '..');

const checks = [
  {
    name: 'Stage 1：容器编排基础',
    items: [
      {
        label: 'stage1 README.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage1-container-orchestration', 'README.md')),
      },
      {
        label: '01-从Docker到编排.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage1-container-orchestration', '01-从Docker到编排.md')),
      },
      {
        label: '02-Kubernetes架构.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage1-container-orchestration', '02-Kubernetes架构.md')),
      },
      {
        label: '03-kubectl与集群操作.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage1-container-orchestration', '03-kubectl与集群操作.md')),
      },
      {
        label: '04-Pod深入.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage1-container-orchestration', '04-Pod深入.md')),
      },
      {
        label: '05-资源管理.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage1-container-orchestration', '05-资源管理.md')),
      },
      {
        label: '06-阶段实战-搭建本地集群.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage1-container-orchestration', '06-阶段实战-搭建本地集群.md')),
      },
    ],
  },
  {
    name: 'Stage 2：Kubernetes 核心',
    items: [
      {
        label: 'stage2 README.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage2-kubernetes-core', 'README.md')),
      },
      {
        label: '01-Deployment与ReplicaSet.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage2-kubernetes-core', '01-Deployment与ReplicaSet.md')),
      },
      {
        label: '02-Service与网络.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage2-kubernetes-core', '02-Service与网络.md')),
      },
      {
        label: '03-Ingress控制器.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage2-kubernetes-core', '03-Ingress控制器.md')),
      },
      {
        label: '04-ConfigMap与Secret.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage2-kubernetes-core', '04-ConfigMap与Secret.md')),
      },
      {
        label: '05-PersistentVolume.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage2-kubernetes-core', '05-PersistentVolume.md')),
      },
      {
        label: '06-阶段实战-部署完整应用.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage2-kubernetes-core', '06-阶段实战-部署完整应用.md')),
      },
    ],
  },
  {
    name: 'Stage 3：部署策略',
    items: [
      {
        label: 'stage3 README.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage3-deployment-strategies', 'README.md')),
      },
      {
        label: '01-Helm包管理.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage3-deployment-strategies', '01-Helm包管理.md')),
      },
      {
        label: '02-蓝绿部署.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage3-deployment-strategies', '02-蓝绿部署.md')),
      },
      {
        label: '03-金丝雀发布.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage3-deployment-strategies', '03-金丝雀发布.md')),
      },
      {
        label: '04-GitOps工作流.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage3-deployment-strategies', '04-GitOps工作流.md')),
      },
      {
        label: '05-多环境管理.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage3-deployment-strategies', '05-多环境管理.md')),
      },
      {
        label: '06-阶段实战-完整GitOps流水线.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage3-deployment-strategies', '06-阶段实战-完整GitOps流水线.md')),
      },
    ],
  },
  {
    name: 'Stage 4：可观测性与运维',
    items: [
      {
        label: 'stage4 README.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage4-observability-and-ops', 'README.md')),
      },
      {
        label: '01-Prometheus监控.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage4-observability-and-ops', '01-Prometheus监控.md')),
      },
      {
        label: '02-Grafana可视化.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage4-observability-and-ops', '02-Grafana可视化.md')),
      },
      {
        label: '03-日志体系.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage4-observability-and-ops', '03-日志体系.md')),
      },
      {
        label: '04-故障排查.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage4-observability-and-ops', '04-故障排查.md')),
      },
      {
        label: '05-安全加固.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage4-observability-and-ops', '05-安全加固.md')),
      },
      {
        label: '06-阶段实战-监控告警体系.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage4-observability-and-ops', '06-阶段实战-监控告警体系.md')),
      },
    ],
  },
  {
    name: 'Stage 5：云原生生态',
    items: [
      {
        label: 'stage5 README.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage5-cloud-native-ecosystem', 'README.md')),
      },
      {
        label: '01-Serverless-on-K8s.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage5-cloud-native-ecosystem', '01-Serverless-on-K8s.md')),
      },
      {
        label: '02-Service-Mesh.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage5-cloud-native-ecosystem', '02-Service-Mesh.md')),
      },
      {
        label: '03-K8s上的AI工作负载.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage5-cloud-native-ecosystem', '03-K8s上的AI工作负载.md')),
      },
      {
        label: '04-多集群管理.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage5-cloud-native-ecosystem', '04-多集群管理.md')),
      },
      {
        label: '05-Cost-Optimization.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage5-cloud-native-ecosystem', '05-Cost-Optimization.md')),
      },
      {
        label: '06-阶段实战-云原生AI平台.md 存在',
        check: () => fs.existsSync(path.join(COURSE_ROOT, 'stage5-cloud-native-ecosystem', '06-阶段实战-云原生AI平台.md')),
      },
    ],
  },
  {
    name: '毕业项目',
    items: [
      {
        label: '项目说明.md 存在',
        check: () => fs.existsSync(path.join(PROJECT_ROOT, '项目说明.md')),
      },
      {
        label: 'scripts/check.cjs 存在',
        check: () => fs.existsSync(path.join(PROJECT_ROOT, 'scripts', 'check.cjs')),
      },
      {
        label: 'stage1-report.md 存在',
        check: () => fs.existsSync(path.join(PROJECT_ROOT, 'reports', 'stage1-report.md')),
      },
      {
        label: 'stage2-report.md 存在',
        check: () => fs.existsSync(path.join(PROJECT_ROOT, 'reports', 'stage2-report.md')),
      },
      {
        label: 'stage3-report.md 存在',
        check: () => fs.existsSync(path.join(PROJECT_ROOT, 'reports', 'stage3-report.md')),
      },
      {
        label: 'stage4-report.md 存在',
        check: () => fs.existsSync(path.join(PROJECT_ROOT, 'reports', 'stage4-report.md')),
      },
      {
        label: 'stage5-report.md 存在',
        check: () => fs.existsSync(path.join(PROJECT_ROOT, 'reports', 'stage5-report.md')),
      },
    ],
  },
];

function checkContent(filePath, minLength) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.trim().length >= minLength;
}

function run() {
  console.log('=== 云原生与 Kubernetes 课程验证 ===\n');
  let totalPassed = 0;
  let totalFailed = 0;

  for (const stage of checks) {
    console.log(`## ${stage.name}`);
    let stagePassed = 0;
    for (const item of stage.items) {
      const passed = item.check();
      const icon = passed ? '✅' : '❌';
      console.log(`  ${icon} ${item.label}`);
      if (passed) {
        stagePassed++;
        totalPassed++;
      } else {
        totalFailed++;
      }
    }
    console.log(`  小计：${stagePassed}/${stage.items.length} 通过\n`);
  }

  console.log(`=== 总计：${totalPassed} 通过，${totalFailed} 失败 ===`);
  if (totalFailed > 0) {
    process.exit(1);
  }
}

run();
