# 03 - 树形思维（Tree of Thoughts）

> **课程定位**：Stage 5 高级技巧 · 第 3 课
> **前置要求**：完成 Stage 1-4，理解 Chain-of-Thought 和 Self-Consistency
> **预计时间**：90 分钟

---

## 场景引入

面对一个复杂的逻辑谜题，人类的思考方式不是线性的——我们会先尝试一个方向，发现走不通就回溯，换一个方向继续探索。但标准的 Chain-of-Thought 只能沿着一条直线推理，一旦某一步出错，整个推理链就废了。对于需要规划、搜索和回溯的复杂问题，我们需要一种更接近人类思维方式的推理框架。

---

## 学习目标

1. 理解 Tree of Thoughts (ToT) 的核心思想
2. 掌握思维分解、思维生成、状态评估的方法
3. 实现 BFS 和 DFS 两种搜索策略
4. 构建完整的 ToT 求解器
5. 对比 CoT、Self-Consistency 和 ToT 的效果

---

## 1. 什么是 Tree of Thoughts？

Tree of Thoughts 是一种将推理过程组织成树形结构的方法，允许模型在推理过程中进行探索、评估和回溯。

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    Tree of Thoughts 结构                                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║                           [初始问题]                                        ║
║                              │                                             ║
║              ┌───────────────┼───────────────┐                             ║
║              ▼               ▼               ▼                             ║
║         [思维 1A]       [思维 1B]       [思维 1C]    ← 第1层思维           ║
║            │               │               │                               ║
║         ┌──┴──┐         ┌──┴──┐             │                              ║
║         ▼     ▼         ▼     ▼             ▼                              ║
║      [2A]   [2B]     [2C]   [2D]        [2E]          ← 第2层思维         ║
║         │     │         │                                      │           ║
║         ▼     ▼         ▼                                      ▼           ║
║      [3A]   [3B]     [3C]                                  [3E]            ║
║         │                    评估：2A(0.9) 2B(0.3) 2C(0.8) 2D(0.2)        ║
║         ▼                    剪枝：2B 和 2D 被剪掉                         ║
║    [最终答案]                                                               ║
║                                                                            ║
║   关键特性：                                                                ║
║   - 思维分解：将复杂问题分解为多个推理步骤                                   ║
║   - 思维生成：每个步骤生成多个候选思路                                       ║
║   - 状态评估：评估每个思路的前景                                             ║
║   - 搜索策略：BFS（广度优先）或 DFS（深度优先）                             ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 1.1 CoT vs Self-Consistency vs ToT

| 特性 | CoT | Self-Consistency | ToT |
|------|-----|------------------|-----|
| 推理方式 | 单路径线性 | 多路径并行 | 树形搜索 |
| 回溯能力 | 无 | 无 | 有 |
| 评估机制 | 无 | 投票 | 每步评估 |
| 计算成本 | 低 | 中 | 高 |
| 适用场景 | 简单推理 | 中等推理 | 复杂规划 |

---

## 2. 思维分解

### 2.1 问题分解策略

```python
import openai
import json
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

client = openai.OpenAI()

class SearchStrategy(Enum):
    BFS = "breadth_first"
    DFS = "depth_first"

@dataclass
class Thought:
    """思维节点"""
    content: str
    step: int
    score: float = 0.0
    parent: Optional['Thought'] = None
    children: List['Thought'] = field(default_factory=list)
    is_terminal: bool = False

class ThoughtDecomposer:
    """思维分解器"""

    def __init__(self, model: str = "gpt-4"):
        self.model = model

    def decompose(self, problem: str, num_steps: int = 3) -> List[str]:
        """将问题分解为推理步骤"""
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个问题分解专家。"},
                {"role": "user", "content": f"""
请将以下问题分解为 {num_steps} 个推理步骤：

问题：{problem}

要求：
1. 每个步骤应该是独立的推理单元
2. 步骤之间有逻辑递进关系
3. 最后一步应该得出最终答案

请按以下格式输出：
步骤1: [描述]
步骤2: [描述]
步骤3: [描述]
"""}
            ],
            temperature=0
        )

        content = response.choices[0].message.content
        steps = []
        for line in content.strip().split("\n"):
            if line.startswith("步骤"):
                step_desc = line.split(":", 1)[-1].strip()
                steps.append(step_desc)

        return steps


class ThoughtGenerator:
    """思维生成器"""

    def __init__(self, model: str = "gpt-4", num_thoughts: int = 3):
        self.model = model
        self.num_thoughts = num_thoughts

    def generate(
        self,
        problem: str,
        current_step: str,
        previous_thoughts: List[str] = None
    ) -> List[str]:
        """为当前步骤生成多个候选思维"""
        prev_context = ""
        if previous_thoughts:
            prev_context = "\n之前的推理：" + " -> ".join(previous_thoughts)

        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个创造性思维专家。"},
                {"role": "user", "content": f"""
问题：{problem}
当前步骤：{current_step}
{prev_context}

请为当前步骤生成 {self.num_thoughts} 个不同的思路。

每个思路应该：
1. 尝试不同的解决方向
2. 有明确的推理过程
3. 得出可验证的中间结论

请按以下格式输出：
思路1: [详细推理]
思路2: [详细推理]
思路3: [详细推理]
"""}
            ],
            temperature=0.8
        )

        content = response.choices[0].message.content
        thoughts = []
        for line in content.strip().split("\n"):
            if line.startswith("思路"):
                thought = line.split(":", 1)[-1].strip()
                thoughts.append(thought)

        return thoughts[:self.num_thoughts]
```

---

## 3. 状态评估

### 3.1 评估器设计

```python
class ThoughtEvaluator:
    """思维评估器"""

    def __init__(self, model: str = "gpt-4"):
        self.model = model

    def evaluate(
        self,
        problem: str,
        thought: str,
        step: str
    ) -> float:
        """评估思维的前景（0-1 分数）"""
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个推理评估专家。"},
                {"role": "user", "content": f"""
请评估以下推理思路的质量。

问题：{problem}
当前步骤：{step}
推理思路：{thought}

评估标准：
1. 逻辑正确性（0-0.3分）
2. 与问题的相关性（0-0.3分）
3. 前景（能否导向正确答案）（0-0.4分）

请只输出一个 0 到 1 之间的分数，例如：0.75
"""}
            ],
            temperature=0
        )

        try:
            score = float(response.choices[0].message.content.strip())
            return max(0, min(1, score))
        except ValueError:
            return 0.5  # 默认分数

    def evaluate_batch(
        self,
        problem: str,
        thoughts: List[Tuple[str, str]]
    ) -> List[float]:
        """批量评估思维"""
        scores = []
        for thought, step in thoughts:
            score = self.evaluate(problem, thought, step)
            scores.append(score)
        return scores
```

---

## 4. 搜索策略

### 4.1 BFS（广度优先搜索）

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        BFS 搜索策略                                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   第1层:  [1A] [1B] [1C]                                                   ║
║              │    │    │                                                    ║
║              ▼    ▼    ▼    评估：1A=0.8, 1B=0.3, 1C=0.7                   ║
║                            保留 Top-K: 1A, 1C                              ║
║              │         │                                                    ║
║              ▼         ▼                                                    ║
║   第2层: [2A][2B]  [2C][2D]                                                ║
║              │    │    │    评估：2A=0.9, 2B=0.4, 2C=0.6, 2D=0.85         ║
║              ▼    ▼    ▼    保留 Top-K: 2A, 2D                             ║
║              │         │                                                    ║
║              ▼         ▼                                                    ║
║   第3层: [3A]       [3D]     评估：3A=0.95, 3D=0.88                        ║
║              │         │     选择最高: 3A                                   ║
║              ▼         ▼                                                    ║
║           [答案]    [答案]                                                  ║
║                                                                            ║
║   特点：逐层扩展，保留 Top-K 最有前景的节点                                  ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 4.2 DFS（深度优先搜索）

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        DFS 搜索策略                                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   从 [1A] 开始深度探索：                                                    ║
║                                                                            ║
║   [1A] → [2A] → [3A] → 评估: 0.95 ✓ 找到好路径                            ║
║                                                                            ║
║   回溯到 [1A]，探索其他分支：                                               ║
║   [1A] → [2B] → 评估: 0.4 ✗ 剪枝，回溯                                    ║
║                                                                            ║
║   回溯到根，探索 [1B]：                                                     ║
║   [1B] → 评估: 0.3 ✗ 剪枝，回溯                                           ║
║                                                                            ║
║   探索 [1C]：                                                               ║
║   [1C] → [2C] → [3C] → 评估: 0.88                                         ║
║                                                                            ║
║   最终选择: [1A] → [2A] → [3A] (分数 0.95)                                 ║
║                                                                            ║
║   特点：深度优先探索，及时剪枝，适合解空间深的问题                            ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 4.3 完整 ToT 求解器

```python
class TreeOfThoughts:
    """Tree of Thoughts 求解器"""

    def __init__(
        self,
        model: str = "gpt-4",
        num_steps: int = 3,
        num_thoughts_per_step: int = 3,
        breadth: int = 2,
        depth: int = 3,
        strategy: SearchStrategy = SearchStrategy.BFS,
        threshold: float = 0.5
    ):
        self.model = model
        self.num_steps = num_steps
        self.num_thoughts_per_step = num_thoughts_per_step
        self.breadth = breadth  # BFS 每层保留的节点数
        self.depth = depth      # DFS 最大深度
        self.strategy = strategy
        self.threshold = threshold

        self.decomposer = ThoughtDecomposer(model)
        self.generator = ThoughtGenerator(model, num_thoughts_per_step)
        self.evaluator = ThoughtEvaluator(model)

    def solve(self, problem: str) -> Dict:
        """求解问题"""
        print(f"\n问题: {problem}")
        print(f"搜索策略: {self.strategy.value}")
        print("-" * 50)

        # 分解问题
        steps = self.decomposer.decompose(problem, self.num_steps)
        print(f"分解为 {len(steps)} 个步骤:")
        for i, step in enumerate(steps):
            print(f"  步骤{i+1}: {step}")

        # 执行搜索
        if self.strategy == SearchStrategy.BFS:
            best_thought, best_score = self._bfs(problem, steps)
        else:
            best_thought, best_score = self._dfs(problem, steps)

        return {
            "problem": problem,
            "steps": steps,
            "best_thought": best_thought,
            "best_score": best_score,
            "strategy": self.strategy.value
        }

    def _bfs(self, problem: str, steps: List[str]) -> Tuple[str, float]:
        """广度优先搜索"""
        # 初始节点
        current_nodes = [Thought(content="开始", step=0, score=1.0)]

        for step_idx, step in enumerate(steps):
            print(f"\n步骤 {step_idx + 1}: {step}")
            next_nodes = []

            # 扩展每个当前节点
            for node in current_nodes:
                # 生成候选思维
                prev_thoughts = self._get_path(node)
                thoughts = self.generator.generate(
                    problem, step, prev_thoughts
                )

                # 评估每个思维
                for thought_content in thoughts:
                    score = self.evaluator.evaluate(
                        problem, thought_content, step
                    )
                    thought = Thought(
                        content=thought_content,
                        step=step_idx + 1,
                        score=score,
                        parent=node
                    )
                    node.children.append(thought)
                    next_nodes.append(thought)
                    print(f"  思维: {thought_content[:50]}... 分数: {score:.2f}")

            # 保留 Top-K 节点
            next_nodes.sort(key=lambda x: x.score, reverse=True)
            current_nodes = next_nodes[:self.breadth]
            print(f"  保留 Top-{self.breadth} 节点")

        # 返回最佳路径
        best_node = max(current_nodes, key=lambda x: x.score)
        best_path = self._get_path(best_node)

        print(f"\n最佳路径: {' -> '.join(best_path)}")
        print(f"最终分数: {best_node.score:.2f}")

        return best_node.content, best_node.score

    def _dfs(
        self,
        problem: str,
        steps: List[str],
        current_node: Thought = None,
        current_depth: int = 0
    ) -> Tuple[str, float]:
        """深度优先搜索"""
        if current_node is None:
            current_node = Thought(content="开始", step=0, score=1.0)

        # 达到最大深度
        if current_depth >= self.depth:
            return current_node.content, current_node.score

        # 获取当前步骤
        step_idx = current_depth
        if step_idx >= len(steps):
            return current_node.content, current_node.score

        step = steps[step_idx]
        print(f"\n深度 {current_depth + 1}, 步骤: {step}")

        # 生成候选思维
        prev_thoughts = self._get_path(current_node)
        thoughts = self.generator.generate(problem, step, prev_thoughts)

        best_thought = None
        best_score = -1

        for thought_content in thoughts:
            score = self.evaluator.evaluate(problem, thought_content, step)
            print(f"  思维: {thought_content[:50]}... 分数: {score:.2f}")

            # 剪枝
            if score < self.threshold:
                print(f"  剪枝: 分数 {score:.2f} < 阈值 {self.threshold}")
                continue

            # 创建子节点
            child = Thought(
                content=thought_content,
                step=step_idx + 1,
                score=score,
                parent=current_node
            )
            current_node.children.append(child)

            # 递归探索
            child_best, child_score = self._dfs(
                problem, steps, child, current_depth + 1
            )

            if child_score > best_score:
                best_score = child_score
                best_thought = child_best

        if best_thought is None:
            return current_node.content, current_node.score

        return best_thought, best_score

    def _get_path(self, node: Thought) -> List[str]:
        """获取从根到当前节点的路径"""
        path = []
        current = node
        while current:
            if current.content != "开始":
                path.append(current.content)
            current = current.parent
        return list(reversed(path))


# 使用示例
if __name__ == "__main__":
    # BFS 求解
    tot_bfs = TreeOfThoughts(
        model="gpt-4",
        num_steps=3,
        num_thoughts_per_step=3,
        breadth=2,
        strategy=SearchStrategy.BFS
    )

    problem = "用 1, 5, 6, 7 四个数字，通过加减乘除得到 24"
    result_bfs = tot_bfs.solve(problem)

    print("\n" + "="*60)

    # DFS 求解
    tot_dfs = TreeOfThoughts(
        model="gpt-4",
        num_steps=3,
        num_thoughts_per_step=3,
        depth=3,
        strategy=SearchStrategy.DFS,
        threshold=0.4
    )

    result_dfs = tot_dfs.solve(problem)
```

---

## 5. ToT 的实际应用

### 5.1 创意写作

```python
class CreativeWritingToT:
    """创意写作 ToT"""

    def __init__(self, model: str = "gpt-4"):
        self.tot = TreeOfThoughts(
            model=model,
            num_steps=4,
            num_thoughts_per_step=3,
            breadth=2,
            strategy=SearchStrategy.BFS
        )

    def write_story(self, prompt: str) -> str:
        """使用 ToT 生成故事"""
        problem = f"根据以下提示创作一个引人入胜的故事：{prompt}"
        result = self.tot.solve(problem)

        # 使用最佳思路生成完整故事
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "你是一个优秀的故事作家。"},
                {"role": "user", "content": f"""
故事提示：{prompt}

最佳创作思路：{result['best_thought']}

请基于以上思路，创作一个完整的故事（500字左右）。
"""}
            ],
            temperature=0.8
        )

        return response.choices[0].message.content


# 使用示例
writer = CreativeWritingToT()
story = writer.write_story("一个程序员发现自己写的代码有了意识")
print(story)
```

### 5.2 代码问题求解

```python
class CodingToT:
    """编程问题 ToT"""

    def __init__(self, model: str = "gpt-4"):
        self.tot = TreeOfThoughts(
            model=model,
            num_steps=3,
            num_thoughts_per_step=3,
            breadth=2,
            strategy=SearchStrategy.BFS
        )

    def solve_problem(self, problem_description: str) -> str:
        """使用 ToT 解决编程问题"""
        problem = f"解决以下编程问题：{problem_description}"
        result = self.tot.solve(problem)

        # 使用最佳思路生成代码
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "你是一个高级程序员。"},
                {"role": "user", "content": f"""
问题描述：{problem_description}

最佳解题思路：{result['best_thought']}

请基于以上思路，编写完整的 Python 代码解决方案。
要求：
1. 包含详细的注释
2. 处理边界情况
3. 提供测试用例
"""}
            ],
            temperature=0
        )

        return response.choices[0].message.content


# 使用示例
coder = CodingToT()
solution = coder.solve_problem("""
实现一个函数，找到二叉树中两个节点的最近公共祖先（LCA）。
""")
print(solution)
```

---

## 6. 常见误区

| 错误 | 正确做法 |
|------|----------|
| 思维分解太粗 | 将问题分解为 3-5 个清晰的步骤 |
| 每步只生成 1 个思维 | 生成 3-5 个候选思维增加多样性 |
| 评估标准不明确 | 定义清晰的评估维度和权重 |
| BFS 宽度太大 | 每层保留 2-3 个最有前景的节点 |
| DFS 没有剪枝 | 设置阈值及时剪掉低分路径 |
| 忽略回溯 | DFS 必须支持回溯到父节点 |

---

## 7. 工程建议

1. 优先使用 BFS 处理宽而浅的问题，DFS 更适合解空间深且需要回溯的场景
2. 评估器的质量直接决定 ToT 的效果，建议用历史正确答案校准评估标准
3. 设置合理的剪枝阈值，避免在低前景路径上浪费计算资源
4. 对于实时应用，限制每步生成的候选思维数量（2-3个）和搜索深度（3-4层）

---

## 8. 本节小结

Tree of Thoughts 是处理复杂推理任务的强大框架：

1. **思维分解**：将复杂问题分解为可管理的推理步骤
2. **思维生成**：每个步骤生成多个候选思路
3. **状态评估**：量化评估每个思路的前景
4. **搜索策略**：BFS 适合宽而浅的问题，DFS 适合深而窄的问题
5. **剪枝优化**：及时剪掉低前景路径，提高效率

---

## 练习

### 练习 1：基础 ToT
实现一个 ToT 求解器，使用 BFS 策略解决"24 点游戏"问题。

### 练习 2：BFS vs DFS 对比
对同一组问题，分别使用 BFS 和 DFS 策略，对比求解质量和效率。

### 练习 3：创意写作 ToT
实现一个创意写作 ToT，生成多个故事开头，评估选择最佳的一个继续发展。

---

## 参考答案

### 练习 1

**思路**：24 点游戏是 ToT 的经典应用场景。将问题分解为"选择两个数字 → 选择运算符 → 计算结果 → 用结果替换原数字"的循环步骤，每一步生成多个候选操作（不同数字对和不同运算符的组合），评估每个候选操作是否能导向 24，使用 BFS 逐层扩展并保留最有前景的节点。

**答案**：

```python
import openai
import json
from typing import List, Dict, Tuple
from dataclasses import dataclass, field
from itertools import combinations, permutations

client = openai.OpenAI()

@dataclass
class Thought:
    content: str
    step: int
    score: float = 0.0
    parent: 'Thought' = None
    children: List['Thought'] = field(default_factory=list)

class TwentyFourGameToT:
    """使用 ToT 求解 24 点游戏"""

    def __init__(self, model: str = "gpt-4", breadth: int = 3):
        self.model = model
        self.breadth = breadth

    def solve(self, numbers: List[int]) -> Dict:
        """求解 24 点"""
        print(f"求解: {numbers} -> 24")

        current_nodes = [Thought(content=str(numbers), step=0, score=1.0)]

        for step in range(3):  # 最多 3 步（4 个数需要 3 次运算）
            next_nodes = []

            for node in current_nodes:
                nums = self._parse_numbers(node.content)
                if len(nums) <= 1:
                    continue

                candidates = self._generate_candidates(nums)

                for candidate in candidates:
                    score = self._evaluate(candidate, numbers)
                    child = Thought(
                        content=candidate["expression"],
                        step=step + 1,
                        score=score,
                        parent=node
                    )
                    node.children.append(child)
                    next_nodes.append(child)

                    if score >= 0.99:
                        print(f"  找到解法: {candidate['expression']}")
                        return {
                            "solution": candidate["expression"],
                            "steps": self._get_path(child),
                            "score": score
                        }

            if not next_nodes:
                break

            next_nodes.sort(key=lambda x: x.score, reverse=True)
            current_nodes = next_nodes[:self.breadth]
            print(f"  第 {step+1} 层: 保留 {len(current_nodes)} 个节点")

        best = max(current_nodes, key=lambda x: x.score) if current_nodes else None
        return {
            "solution": best.content if best else "无解",
            "steps": self._get_path(best) if best else [],
            "score": best.score if best else 0
        }

    def _parse_numbers(self, content: str) -> List[int]:
        """从表达式中提取当前可用的数字"""
        import re
        numbers = re.findall(r'\d+', content)
        return [int(n) for n in numbers]

    def _generate_candidates(self, nums: List[int]) -> List[Dict]:
        """生成所有可能的操作"""
        candidates = []
        for (i, a), (j, b) in combinations(enumerate(nums), 2):
            remaining = [nums[k] for k in range(len(nums)) if k != i and k != j]
            for op in ["+", "-", "*", "/"]:
                if op == "/" and b == 0:
                    continue
                try:
                    if op == "+":
                        result = a + b
                    elif op == "-":
                        result = a - b
                    elif op == "*":
                        result = a * b
                    else:
                        result = a / b

                    new_nums = remaining + [result]
                    expression = f"({a} {op} {b} = {result}), 剩余: {new_nums}"
                    candidates.append({
                        "expression": expression,
                        "result_num": result,
                        "remaining": new_nums
                    })
                except ZeroDivisionError:
                    continue
        return candidates

    def _evaluate(self, candidate: Dict, original: List[int]) -> float:
        """评估候选操作的前景"""
        remaining = candidate["remaining"]

        if len(remaining) == 1 and abs(remaining[0] - 24) < 0.001:
            return 1.0

        if len(remaining) == 1 and abs(remaining[0] - 24) > 10:
            return 0.1

        # 使用 LLM 评估
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "评估以下 24 点操作的前景，输出 0-1 分数。只输出数字。"},
                {"role": "user", "content": f"原始数字: {original}\n当前操作: {candidate['expression']}\n分数:"}
            ],
            temperature=0
        )
        try:
            return float(response.choices[0].message.content.strip())
        except:
            return 0.5

    def _get_path(self, node: Thought) -> List[str]:
        """获取路径"""
        path = []
        current = node
        while current:
            path.append(current.content)
            current = current.parent
        return list(reversed(path))


if __name__ == "__main__":
    game = TwentyFourGameToT(model="gpt-4", breadth=3)
    result = game.solve([1, 5, 6, 7])
    print(f"\n解法: {result['solution']}")
    print(f"分数: {result['score']}")
    print(f"步骤: {result['steps']}")
```

**要点**：
- 24 点游戏的状态空间有限（最多 4! × 4³ = 1536 种），BFS 完全可行
- 评估函数可以用 LLM，也可以用启发式（距离 24 的远近），后者更快且无 API 成本
- 剪枝策略：如果剩余数字中最大值乘以所有其他数仍小于 24，或最小值除以所有其他数仍大于 24，可以直接剪枝

---

### 练习 2

**思路**：BFS 和 DFS 的对比需要在同一组问题上运行，记录两个维度：求解质量（最终得分）和效率（LLM 调用次数、耗时）。BFS 逐层扩展保留 Top-K，适合宽而浅的解空间；DFS 深度优先并及时剪枝，适合深而窄的场景。通过统计 LLM 调用次数来衡量实际成本。

**答案**：

```python
import openai
import time
from typing import List, Dict, Tuple
from dataclasses import dataclass, field

client = openai.OpenAI()

@dataclass
class Thought:
    content: str
    step: int
    score: float = 0.0
    parent: 'Thought' = None

class ToTComparer:
    """BFS vs DFS 对比器"""

    def __init__(self, model: str = "gpt-4"):
        self.model = model
        self.call_count = 0

    def _call_llm(self, prompt: str, temperature: float = 0) -> str:
        """调用 LLM 并计数"""
        self.call_count += 1
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是推理专家。"},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature
        )
        return response.choices[0].message.content

    def _evaluate_thought(self, problem: str, thought: str, step: str) -> float:
        """评估思路质量"""
        response = self._call_llm(
            f"问题：{problem}\n步骤：{step}\n思路：{thought}\n\n请输出 0-1 分数：",
            temperature=0
        )
        try:
            return float(response.strip())
        except:
            return 0.5

    def _generate_thoughts(self, problem: str, step: str, context: str, num: int = 3) -> List[str]:
        """生成候选思路"""
        response = self._call_llm(
            f"问题：{problem}\n步骤：{step}\n上下文：{context}\n\n请生成 {num} 个不同思路，用 '思路X:' 开头。",
            temperature=0.8
        )
        thoughts = []
        for line in response.split("\n"):
            if line.startswith("思路"):
                thoughts.append(line.split(":", 1)[-1].strip())
        return thoughts[:num]

    def _decompose(self, problem: str, num_steps: int = 3) -> List[str]:
        """分解问题"""
        response = self._call_llm(
            f"将以下问题分解为 {num_steps} 个步骤：\n{problem}\n\n用 '步骤X:' 开头输出。",
            temperature=0
        )
        steps = []
        for line in response.split("\n"):
            if line.startswith("步骤"):
                steps.append(line.split(":", 1)[-1].strip())
        return steps

    def solve_bfs(self, problem: str, breadth: int = 2, num_steps: int = 3) -> Dict:
        """BFS 求解"""
        self.call_count = 0
        start_time = time.time()
        steps = self._decompose(problem, num_steps)

        current_nodes = [Thought(content="开始", step=0, score=1.0)]

        for step_idx, step in enumerate(steps):
            next_nodes = []
            for node in current_nodes:
                thoughts = self._generate_thoughts(problem, step, node.content)
                for t in thoughts:
                    score = self._evaluate_thought(problem, t, step)
                    child = Thought(content=t, step=step_idx + 1, score=score, parent=node)
                    next_nodes.append(child)

            next_nodes.sort(key=lambda x: x.score, reverse=True)
            current_nodes = next_nodes[:breadth]

        best = max(current_nodes, key=lambda x: x.score) if current_nodes else None
        elapsed = time.time() - start_time

        return {
            "answer": best.content if best else "",
            "score": best.score if best else 0,
            "llm_calls": self.call_count,
            "time": elapsed,
            "strategy": "BFS"
        }

    def solve_dfs(self, problem: str, depth: int = 3, threshold: float = 0.4) -> Dict:
        """DFS 求解"""
        self.call_count = 0
        start_time = time.time()
        steps = self._decompose(problem, depth)

        root = Thought(content="开始", step=0, score=1.0)
        best_thought, best_score = self._dfs_recurse(problem, steps, root, 0, depth, threshold)
        elapsed = time.time() - start_time

        return {
            "answer": best_thought or "",
            "score": best_score,
            "llm_calls": self.call_count,
            "time": elapsed,
            "strategy": "DFS"
        }

    def _dfs_recurse(self, problem, steps, node, current_depth, max_depth, threshold) -> Tuple[str, float]:
        """DFS 递归"""
        if current_depth >= max_depth or current_depth >= len(steps):
            return node.content, node.score

        step = steps[current_depth]
        thoughts = self._generate_thoughts(problem, step, node.content)

        best_thought, best_score = node.content, node.score

        for t in thoughts:
            score = self._evaluate_thought(problem, t, step)
            if score < threshold:
                continue

            child = Thought(content=t, step=current_depth + 1, score=score, parent=node)
            child_best, child_score = self._dfs_recurse(problem, steps, child, current_depth + 1, max_depth, threshold)

            if child_score > best_score:
                best_score = child_score
                best_thought = child_best

        return best_thought, best_score

    def compare(self, problems: List[str]) -> Dict:
        """对比 BFS 和 DFS"""
        results = {"bfs": [], "dfs": []}

        for problem in problems:
            print(f"\n问题: {problem}")

            bfs_result = self.solve_bfs(problem, breadth=2, num_steps=3)
            print(f"  BFS: 分数={bfs_result['score']:.2f}, 调用={bfs_result['llm_calls']}, 耗时={bfs_result['time']:.1f}s")
            results["bfs"].append(bfs_result)

            dfs_result = self.solve_dfs(problem, depth=3, threshold=0.4)
            print(f"  DFS: 分数={dfs_result['score']:.2f}, 调用={dfs_result['llm_calls']}, 耗时={dfs_result['time']:.1f}s")
            results["dfs"].append(dfs_result)

        # 汇总
        for strategy in ["bfs", "dfs"]:
            avg_score = sum(r["score"] for r in results[strategy]) / len(results[strategy])
            avg_calls = sum(r["llm_calls"] for r in results[strategy]) / len(results[strategy])
            print(f"\n{strategy.upper()} 平均: 分数={avg_score:.2f}, 调用={avg_calls:.0f}")

        return results


if __name__ == "__main__":
    comparer = ToTComparer(model="gpt-4")
    problems = [
        "用 1, 5, 6, 7 四个数字，通过加减乘除得到 24",
        "一个农夫需要把狼、羊和白菜运过河，每次只能带一样，怎么运？",
        "有 8 个球，其中一个比其他重，用天平最少称几次能找到？",
    ]
    comparer.compare(problems)
```

**要点**：
- 对比时必须用相同的问题集，且问题难度应覆盖简单到复杂
- BFS 的 LLM 调用次数 = 层数 × 每层候选数 ×（生成 + 评估），通常比 DFS 更多
- DFS 在评估分数阈值设置合理时，通过剪枝可以大幅减少无效探索

---

### 练习 3

**思路**：创意写作 ToT 的关键是将"写一个好故事"分解为可评估的步骤：先生成多个故事开头，评估每个开头的吸引力（悬念、新颖性、情感共鸣），选择最佳开头后继续发展情节。每一步都用 LLM 评估候选方案，保留最有潜力的方向。

**答案**：

```python
import openai
from typing import List, Dict

client = openai.OpenAI()

class CreativeWritingToT:
    """创意写作 ToT"""

    def __init__(self, model: str = "gpt-4", num_openings: int = 4, breadth: int = 2):
        self.model = model
        self.num_openings = num_openings
        self.breadth = breadth

    def generate_openings(self, prompt: str) -> List[str]:
        """生成多个故事开头"""
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个才华横溢的故事作家。"},
                {"role": "user", "content": f"""
根据以下提示，生成 {self.num_openings} 个不同的故事开头（每个 50-80 字）。

提示：{prompt}

要求：
1. 每个开头风格和角度不同
2. 要有悬念或冲突
3. 用"开头X:" 标记

请开始创作："""}
            ],
            temperature=0.9
        )

        openings = []
        for line in response.choices[0].message.content.split("\n"):
            if line.startswith("开头"):
                openings.append(line.split(":", 1)[-1].strip())
        return openings[:self.num_openings]

    def evaluate_opening(self, prompt: str, opening: str) -> float:
        """评估故事开头的质量"""
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是文学评论家。"},
                {"role": "user", "content": f"""
请评估以下故事开头的质量。

主题提示：{prompt}
故事开头：{opening}

评估维度（各占 0.25 分）：
1. 悬念感：是否让人想继续读？
2. 新颖性：角度是否独特？
3. 情感共鸣：是否能引起读者情感反应？
4. 语言质量：文字是否优美准确？

请只输出 0-1 的总分："""}
            ],
            temperature=0
        )
        try:
            return float(response.choices[0].message.content.strip())
        except:
            return 0.5

    def develop_story(self, prompt: str, opening: str, num_paragraphs: int = 3) -> str:
        """基于最佳开头发展故事"""
        story = opening

        for i in range(num_paragraphs):
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个才华横溢的故事作家。"},
                    {"role": "user", "content": f"""
主题提示：{prompt}

已写内容：
{story}

请继续写下一个段落（100-150字），保持风格一致，推进情节发展。
直接输出段落内容，不要加标记。"""}
                ],
                temperature=0.8
            )
            story += "\n\n" + response.choices[0].message.content.strip()

        return story

    def write(self, prompt: str) -> Dict:
        """完整的 ToT 创意写作流程"""
        print(f"主题: {prompt}")

        # 第一步：生成多个开头
        openings = self.generate_openings(prompt)
        print(f"\n生成了 {len(openings)} 个开头")

        # 第二步：评估每个开头
        scored_openings = []
        for i, opening in enumerate(openings):
            score = self.evaluate_opening(prompt, opening)
            scored_openings.append((opening, score))
            print(f"  开头 {i+1} (分数 {score:.2f}): {opening[:40]}...")

        # 第三步：选择最佳开头
        scored_openings.sort(key=lambda x: x[1], reverse=True)
        best_openings = scored_openings[:self.breadth]

        print(f"\n选择了 Top-{self.breadth} 开头继续发展")

        # 第四步：发展完整故事
        stories = []
        for opening, score in best_openings:
            story = self.develop_story(prompt, opening)
            stories.append({"opening": opening, "score": score, "full_story": story})

        # 选择最终故事
        best_story = max(stories, key=lambda x: x["score"])

        return {
            "prompt": prompt,
            "all_openings": scored_openings,
            "selected_openings": best_openings,
            "final_story": best_story["full_story"],
            "final_score": best_story["score"]
        }


if __name__ == "__main__":
    writer = CreativeWritingToT(model="gpt-4", num_openings=4, breadth=2)
    result = writer.write("一个程序员发现自己写的代码有了意识")

    print("\n" + "=" * 50)
    print("最终故事：")
    print(result["final_story"])
    print(f"\n质量评分: {result['final_score']:.2f}")
```

**要点**：
- 创意任务的温度应设较高（0.8-1.0），增加输出的多样性和创造力
- 评估维度应具体化——"好不好"太模糊，拆分为悬念感、新颖性、情感共鸣等维度更有效
- 故事发展阶段可以使用 BFS（同时发展多个版本）或 DFS（深入发展一个版本），根据需求选择

---

> **下一课**：[04 - ReAct 推理与行动](./04-ReAct推理与行动.md)
