# 04. 测试自动化

> 测试自动化不是"运行测试命令"，而是"建立代码质量的信心体系"

## 本课目标

- 掌握测试自动化的完整流程
- 学会配置多种测试框架的 CI 集成
- 理解测试覆盖率和质量门禁
- 实现测试结果的可视化和通知

## 从一个真实场景说起

假设你在这样的团队工作：

1. **测试靠手动**：每次提交都要手动运行测试，经常忘记
2. **覆盖率不清楚**：不知道测试覆盖了多少代码
3. **失败难定位**：测试失败了，不知道是哪个提交引入的
4. **反馈不及时**：代码有问题，直到部署后才发现

测试自动化就是解决这些问题的方案。

## 测试框架 CI 集成

### Jest

```yaml
jobs:
  jest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Jest
        run: |
          npm run test -- --coverage --ci --reporters=default --reporters=jest-junit
        env:
          JEST_JUNIT_OUTPUT_DIR: ./reports/junit

      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: jest-results
          path: reports/junit/

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: jest
```

### Vitest

```yaml
jobs:
  vitest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Vitest
        run: |
          npm run test -- --coverage --reporter=junit --outputFile=reports/junit/results.xml

      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: vitest-results
          path: reports/junit/

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: vitest
```

### Playwright

```yaml
jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run Playwright Tests
        run: npx playwright test

      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload Test Trace
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-trace
          path: test-results/
          retention-days: 7
```

### Cypress

```yaml
jobs:
  cypress:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Cypress Tests
        uses: cypress-io/github-action@v5
        with:
          build: npm run build
          start: npm run start
          wait-on: 'http://localhost:3000'

      - name: Upload Screenshots
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: cypress-screenshots
          path: cypress/screenshots/

      - name: Upload Videos
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: cypress-videos
          path: cypress/videos/
```

## 测试覆盖率

### 配置覆盖率收集

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests with Coverage
        run: npm run test -- --coverage

      - name: Upload Coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
          fail_ci_if_error: true
```

### 覆盖率报告

```yaml
jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Generate Coverage Report
        run: npm run test -- --coverage

      - name: Generate Coverage Comment
        uses: MishaKav/jest-coverage-comment@main
        with:
          coverage-summary-path: coverage/coverage-summary.json
          coverage-title: Jest Coverage
```

### 覆盖率门禁

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests with Coverage
        run: npm run test -- --coverage

      - name: Check Coverage Threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Coverage: $COVERAGE%"
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage is below 80% threshold"
            exit 1
          fi
```

## 测试结果可视化

### 测试报告

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests
        run: npm run test -- --reporters=default --reporters=junit

      - name: Test Report
        uses: dorny/test-reporter@v1
        if: always()
        with:
          name: Jest Results
          path: reports/junit/*.xml
          reporter: jest-junit
```

### 覆盖率报告

```yaml
jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests
        run: npm run test -- --coverage

      - name: Coverage Report
        uses: romeovs/lcov-reporter-action@v0.3.4
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          lcov-file: ./coverage/lcov.info
```

### 覆盖率徽章

```yaml
jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests
        run: npm run test -- --coverage

      - name: Update Coverage Badge
        uses: tj-actions/coverage-badge-py@v2
        with:
          output: coverage-badge.svg
```

## 测试通知

### Slack 通知

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests
        id: test
        run: |
          npm run test || echo "test_failed=true" >> $GITHUB_OUTPUT

      - name: Notify Slack
        if: steps.test.outputs.test_failed == 'true'
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          fields: repo,message,commit,author,action,eventName,ref,workflow
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 邮件通知

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests
        run: npm run test

      - name: Send Email
        if: failure()
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: smtp.gmail.com
          server_port: 587
          username: ${{ secrets.EMAIL_USERNAME }}
          password: ${{ secrets.EMAIL_PASSWORD }}
          subject: Test Failed - ${{ github.repository }}
          to: team@example.com
          from: ci@example.com
          body: |
            Test failed in ${{ github.repository }}
            Commit: ${{ github.sha }}
            Author: ${{ github.actor }}
            <a href="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}">View Run</a>
```

### GitHub 状态检查

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests
        run: npm run test

      - name: Update Status
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.repos.createCommitStatus({
              owner: context.repo.owner,
              repo: context.repo.repo,
              sha: context.sha,
              state: context.payload.workflow_run.conclusion,
              description: 'Tests completed',
              context: 'CI/CD - Tests',
              target_url: `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`
            })
```

## 测试并行化

### Jest 并行

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests (Shard ${{ matrix.shard }}/4)
        run: |
          npm run test -- --shard=${{ matrix.shard }}/4

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.shard }}
          path: reports/
```

### Vitest 并行

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests (Shard ${{ matrix.shard }}/4)
        run: |
          npm run test -- --shard=${{ matrix.shard }}/4
```

### 合并结果

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests
        run: npm run test -- --shard=${{ matrix.shard }}/4

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: results-${{ matrix.shard }}
          path: reports/

  merge-results:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Download All Results
        uses: actions/download-artifact@v3
        with:
          path: results/

      - name: Merge Results
        run: |
          # 合并所有分片的结果
          npx merge-reports results/
```

## 测试质量门禁

### 基础门禁

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests
        run: npm run test

      - name: Check Test Results
        if: failure()
        run: |
          echo "Tests failed! Please fix the issues before merging."
          exit 1
```

### 覆盖率门禁

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests
        run: npm run test -- --coverage

      - name: Check Coverage
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Coverage: $COVERAGE%"
          
          # 设置阈值
          THRESHOLD=80
          
          if (( $(echo "$COVERAGE < $THRESHOLD" | bc -l) )); then
            echo "Coverage $COVERAGE% is below threshold $THRESHOLD%"
            exit 1
          fi
          
          echo "Coverage check passed!"
```

### 综合门禁

```yaml
jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run All Checks
        run: |
          # 运行所有检查
          npm run lint || exit 1
          npm run type-check || exit 1
          npm run test -- --coverage || exit 1
          
          # 检查覆盖率
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage check failed!"
            exit 1
          fi
          
          echo "All quality checks passed!"
```

## 本课小结

本课我们学习了测试自动化：

1. **测试框架 CI 集成**：Jest、Vitest、Playwright、Cypress
2. **测试覆盖率**：收集、上传、门禁
3. **测试结果可视化**：测试报告、覆盖率报告
4. **测试通知**：Slack、邮件、GitHub 状态
5. **测试并行化**：分片测试、结果合并
6. **测试质量门禁**：基础门禁、覆盖率门禁

## 练习

### 练习一：配置 Jest CI

为你的项目配置 Jest 的 CI 集成：
- 运行测试
- 收集覆盖率
- 上传结果

### 练习二：设置覆盖率门禁

为你的项目设置覆盖率门禁：
- 设置覆盖率阈值
- 检查覆盖率是否达标
- 生成覆盖率报告

## 参考答案

### 练习一

```yaml
name: Jest CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Jest Tests
        run: |
          npm run test -- --coverage --ci --reporters=default --reporters=junit
        env:
          JEST_JUNIT_OUTPUT_DIR: ./reports/junit

      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: jest-results
          path: reports/junit/

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: jest
          fail_ci_if_error: true
```

### 练习二

```yaml
name: Coverage Gate

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run Tests with Coverage
        run: npm run test -- --coverage

      - name: Check Coverage Threshold
        run: |
          # 读取覆盖率
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Current coverage: $COVERAGE%"
          
          # 设置阈值
          THRESHOLD=80
          
          # 检查是否达标
          if (( $(echo "$COVERAGE < $THRESHOLD" | bc -l) )); then
            echo "❌ Coverage $COVERAGE% is below threshold $THRESHOLD%"
            exit 1
          fi
          
          echo "✅ Coverage check passed!"
          
      - name: Generate Coverage Report
        if: always()
        run: |
          npm run test -- --coverage
          
      - name: Upload Coverage Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: coverage-report
          path: coverage/
```

## 下一步

完成本课后，继续学习 [05. 部署策略](./05-deployment-strategies.md)。