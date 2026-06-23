# CI 监控

> CI 跑得慢了？缓存命中率低了？失败率高了？没有度量就没有优化。这一课讲怎么监控 CI 的健康状况。

## 需要关注的指标

### 构建时长

最重要的指标。构建时间直接影响开发效率。

```
指标：workflow_run_duration_seconds
维度：workflow_name, branch, conclusion
```

### 失败率

```
指标：workflow_run_conclusion
值：success, failure, cancelled
维度：workflow_name, branch
```

失败率突然升高可能意味着：代码质量下降、CI 配置问题、外部依赖故障。

### 缓存命中率

```
指标：cache_hit_ratio
维度：cache_key_prefix
```

缓存命中率低意味着缓存策略需要调整。

### 排队时间

```
指标：job_queue_duration_seconds
维度：runner_label
```

自托管 Runner 的排队时间过长说明 Runner 数量不够。

## 使用 GitHub API 收集数据

### 获取 workflow run 数据

```bash
# 最近 30 天的 workflow runs
gh api repos/owner/repo/actions/workflows/WORKFLOW_ID/runs \
  --paginate \
  --jq '.workflow_runs[] | {
    id: .id,
    name: .name,
    conclusion: .conclusion,
    created_at: .created_at,
    run_started_at: .run_started_at,
    updated_at: .updated_at,
    head_branch: .head_branch
  }'
```

### 计算构建时长

```bash
gh api repos/owner/repo/actions/workflows/WORKFLOW_ID/runs \
  --jq '.workflow_runs[] | {
    conclusion: .conclusion,
    duration: ((.updated_at | fromdateiso8601) - (.run_started_at | fromdateiso8601)),
    branch: .head_branch
  }'
```

### 在 Workflow 中记录指标

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Record start time
        id: start
        run: echo "time=$(date +%s)" >> "$GITHUB_OUTPUT"

      - run: npm ci && npm run build

      - name: Record metrics
        if: always()
        run: |
          START=${{ steps.start.outputs.time }}
          END=$(date +%s)
          DURATION=$((END - START))
          echo "Build duration: ${DURATION}s"
          # 发送到监控系统
          curl -X POST "https://metrics.example.com/ingest" \
            -d "workflow_build_duration_seconds{repo=\"${{ github.repository }}\"} $DURATION"
```

## 构建时长趋势

### 用 GitHub Script 生成报告

```yaml
- name: Generate build report
  uses: actions/github-script@v7
  with:
    script: |
      const runs = await github.rest.actions.listWorkflowRuns({
        owner: context.repo.owner,
        repo: context.repo.repo,
        workflow_id: 'ci.yml',
        per_page: 30
      });
      
      const durations = runs.data.workflow_runs.map(run => {
        const start = new Date(run.run_started_at);
        const end = new Date(run.updated_at);
        return {
          date: start.toISOString().split('T')[0],
          duration: (end - start) / 1000,
          conclusion: run.conclusion
        };
      });
      
      const avgDuration = durations.reduce((sum, d) => sum + d.duration, 0) / durations.length;
      console.log(`Average build duration (last 30 runs): ${avgDuration.toFixed(0)}s`);
      
      const successRate = durations.filter(d => d.conclusion === 'success').length / durations.length * 100;
      console.log(`Success rate: ${successRate.toFixed(1)}%`);
```

### 用 Prometheus + Grafana

如果需要长期监控，把指标推送到 Prometheus：

```yaml
- name: Push metrics
  run: |
    cat <<EOF | curl -s --data-binary @- http://prometheus-pushgateway:9091/metrics/job/github_actions
    ci_build_duration_seconds{repo="${{ github.repository }}",workflow="${{ github.workflow }}",branch="${{ github.ref_name }}"} $DURATION
    ci_build_conclusion{repo="${{ github.repository }}",workflow="${{ github.workflow }}",conclusion="${{ job.status }}"} 1
    EOF
```

## 失败分析

### 失败分类

```yaml
- name: Categorize failure
  if: failure()
  run: |
    # 检查失败类型
    if grep -q "npm ERR!" $RUNNER_TEMP/build.log; then
      echo "category=dependency" >> "$GITHUB_OUTPUT"
    elif grep -q "Test failed" $RUNNER_TEMP/build.log; then
      echo "category=test" >> "$GITHUB_OUTPUT"
    elif grep -q "Lint failed" $RUNNER_TEMP/build.log; then
      echo "category=lint" >> "$GITHUB_OUTPUT"
    else
      echo "category=unknown" >> "$GITHUB_OUTPUT"
    fi
```

### 失败通知

```yaml
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      const { owner, repo } = context.repo;
      const runId = context.runId;
      const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
      
      await github.rest.issues.create({
        owner,
        repo,
        title: `CI Failed: ${context.workflow} on ${context.ref}`,
        body: `CI run failed.\n\nWorkflow: ${context.workflow}\nBranch: ${context.ref}\nRun: ${runUrl}`,
        labels: ['ci-failure']
      });
```

## 缓存命中率监控

```yaml
- uses: actions/cache@v4
  id: cache
  with:
    path: ~/.npm
    key: npm-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}

- name: Log cache status
  run: |
    if [ "${{ steps.cache.outputs.cache-hit }}" = "true" ]; then
      echo "cache_hit=1" >> "$GITHUB_ENV"
    else
      echo "cache_hit=0" >> "$GITHUB_ENV"
    fi

- name: Push cache metrics
  if: always()
  run: |
    curl -X POST "http://prometheus-pushgateway:9091/metrics/job/github_actions" \
      --data-binary "ci_cache_hit{repo=\"${{ github.repository }}\",cache=\"npm\"} ${{ env.cache_hit }}"
```

## Runner 监控（自托管）

### Runner 健康检查

```yaml
- name: Runner health check
  if: always()
  run: |
    echo "=== Disk ==="
    df -h /
    echo "=== Memory ==="
    free -h
    echo "=== CPU ==="
    nproc
    echo "=== Docker ==="
    docker system df 2>/dev/null || echo "Docker not available"
```

### 资源使用告警

```yaml
- name: Check resources
  run: |
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 80 ]; then
      echo "::warning::Disk usage is ${DISK_USAGE}%"
    fi
    
    MEM_AVAILABLE=$(free -m | awk '/^Mem:/{print $7}')
    if [ "$MEM_AVAILABLE" -lt 1024 ]; then
      echo "::warning::Available memory is ${MEM_AVAILABLE}MB"
    fi
```

## 练习

### 练习一：构建时长报告

写一个 workflow，每天运行一次，生成过去 7 天的 CI 构建报告，包含：
1. 每天的平均构建时长
2. 成功率
3. 最慢的 3 次构建
4. 失败次数最多的分支

报告以 Issue 形式发布到仓库。

---

## 参考答案

```yaml
name: CI Report

on:
  schedule:
    - cron: '0 9 * * 1'  # 每周一早上 9 点
  workflow_dispatch:

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate report
        uses: actions/github-script@v7
        id: report
        with:
          script: |
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            
            // 获取所有 workflow runs
            let allRuns = [];
            for await (const response of github.paginate.iterator(
              github.rest.actions.listWorkflowRunsForRepo,
              {
                owner: context.repo.owner,
                repo: context.repo.repo,
                created: `>=${sevenDaysAgo}`,
                per_page: 100
              }
            )) {
              allRuns.push(...response.data);
            }
            
            // 计算指标
            const runs = allRuns.map(run => ({
              date: run.run_started_at?.split('T')[0],
              duration: run.run_started_at && run.updated_at
                ? (new Date(run.updated_at) - new Date(run.run_started_at)) / 1000
                : 0,
              conclusion: run.conclusion,
              branch: run.head_branch,
              name: run.name
            }));
            
            // 每天平均构建时长
            const byDate = {};
            runs.forEach(r => {
              if (!byDate[r.date]) byDate[r.date] = [];
              byDate[r.date].push(r);
            });
            
            let report = '## CI Report (Last 7 Days)\n\n';
            report += '### Daily Summary\n\n';
            report += '| Date | Runs | Success Rate | Avg Duration |\n';
            report += '|------|------|--------------|--------------|\n';
            
            Object.entries(byDate).sort().forEach(([date, dayRuns]) => {
              const success = dayRuns.filter(r => r.conclusion === 'success').length;
              const avgDuration = dayRuns.reduce((s, r) => s + r.duration, 0) / dayRuns.length;
              const successRate = (success / dayRuns.length * 100).toFixed(0);
              report += `| ${date} | ${dayRuns.length} | ${successRate}% | ${avgDuration.toFixed(0)}s |\n`;
            });
            
            // 最慢的 3 次
            const slowest = [...runs].sort((a, b) => b.duration - a.duration).slice(0, 3);
            report += '\n### Slowest Runs\n\n';
            slowest.forEach(r => {
              report += `- ${r.name} on ${r.branch}: ${r.duration.toFixed(0)}s (${r.conclusion})\n`;
            });
            
            // 失败最多的分支
            const failures = runs.filter(r => r.conclusion === 'failure');
            const byBranch = {};
            failures.forEach(r => {
              byBranch[r.branch] = (byBranch[r.branch] || 0) + 1;
            });
            report += '\n### Failure by Branch\n\n';
            Object.entries(byBranch)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .forEach(([branch, count]) => {
                report += `- ${branch}: ${count} failures\n`;
              });
            
            return report;

      - name: Create issue
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `CI Report - ${new Date().toISOString().split('T')[0]}`,
              body: `${{ steps.report.outputs.result }}`,
              labels: ['ci-report']
            });
```
