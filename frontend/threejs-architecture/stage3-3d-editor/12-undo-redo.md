# 撤销/重做——Command 模式、操作历史、序列化

## Ctrl+Z 背后的问题

用户移动了一个物体，按 Ctrl+Z 要撤销。听起来简单，但需要回答几个问题：

1. "移动"这个操作需要记住什么？
2. 怎么恢复到移动之前的状态？
3. 撤销之后再 Ctrl+Y 重做，怎么做？
4. 如果撤销到一半，用户做了新操作，重做历史怎么处理？

## Command 模式

撤销/重做的标准方案是 Command 模式。每个用户操作封装成一个 Command 对象：

```ts
interface Command {
    type: string;
    execute(): void;
    undo(): void;
    serialize(): object; // 用于持久化
}
```

关键设计：每个 Command 知道怎么执行自己，也知道怎么撤销自己。

## 具体 Command 实现

### 移动 Command

```ts
class MoveCommand implements Command {
    type = 'move';

    constructor(
        private object: THREE.Object3D,
        private oldPosition: THREE.Vector3,
        private newPosition: THREE.Vector3
    ) {}

    execute() {
        this.object.position.copy(this.newPosition);
    }

    undo() {
        this.object.position.copy(this.oldPosition);
    }

    serialize() {
        return {
            type: 'move',
            objectId: this.object.uuid,
            old: { x: this.oldPosition.x, y: this.oldPosition.y, z: this.oldPosition.z },
            new: { x: this.newPosition.x, y: this.newPosition.y, z: this.newPosition.z }
        };
    }
}
```

注意：**创建时就记录 oldPosition**。不是执行时记录——执行前物体已经在旧位置了。

### 创建/删除 Command

```ts
class CreateCommand implements Command {
    type = 'create';

    constructor(
        private scene: THREE.Scene,
        private object: THREE.Object3D
    ) {}

    execute() {
        this.scene.add(this.object);
    }

    undo() {
        this.scene.remove(this.object);
    }

    serialize() {
        return {
            type: 'create',
            objectData: serializeObject(this.object)
        };
    }
}

class DeleteCommand implements Command {
    type = 'delete';

    constructor(
        private scene: THREE.Scene,
        private object: THREE.Object3D,
        private parent?: THREE.Object3D
    ) {}

    execute() {
        this.parent = this.object.parent as THREE.Object3D;
        this.scene.remove(this.object);
    }

    undo() {
        (this.parent || this.scene).add(this.object);
    }
}
```

## 历史管理器

CommandHistory 管理一个栈：

```ts
class CommandHistory {
    private undoStack: Command[] = [];
    private redoStack: Command[] = [];
    private maxSize: number;

    constructor(maxSize = 100) {
        this.maxSize = maxSize;
    }

    execute(command: Command) {
        command.execute();
        this.undoStack.push(command);
        this.redoStack = []; // 新操作清空重做栈

        // 限制历史长度
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
    }

    undo(): boolean {
        if (this.undoStack.length === 0) return false;
        const command = this.undoStack.pop()!;
        command.undo();
        this.redoStack.push(command);
        return true;
    }

    redo(): boolean {
        if (this.redoStack.length === 0) return false;
        const command = this.redoStack.pop()!;
        command.execute();
        this.undoStack.push(command);
        return true;
    }

    canUndo(): boolean { return this.undoStack.length > 0; }
    canRedo(): boolean { return this.redoStack.length > 0; }
}
```

## 新操作清空重做栈

这是一个重要的 UX 决策。用户撤销了 3 步，然后做了新操作，重做栈被清空——之前撤销的 3 步不能再重做了。

这是线性历史模型的行为。有些编辑器（如 VS Code）允许分支历史，但复杂度高得多。

## 批量操作

拖拽移动时，鼠标每移动一像素都产生一个 MoveCommand 会撑爆历史栈。需要合并：

```ts
class MoveCommand implements Command {
    // ... 同上

    // 合并：如果连续移动同一个物体，更新终点
    merge(other: Command): boolean {
        if (other.type === 'move' &&
            (other as MoveCommand).object === this.object) {
            this.newPosition = (other as MoveCommand).newPosition;
            return true;
        }
        return false;
    }
}

// 使用时
class CommandHistory {
    execute(command: Command) {
        // 尝试和上一个命令合并
        const last = this.undoStack[this.undoStack.length - 1];
        if (last && last.merge(command)) {
            // 合并成功，不推入新命令
            last.execute(); // 用新参数重新执行
            return;
        }

        command.execute();
        this.undoStack.push(command);
        this.redoStack = [];
    }
}
```

拖拽开始时创建 MoveCommand，拖拽过程中合并，拖拽结束时命令定型。

## 命令的序列化

如果要支持"撤销历史持久化"（关闭浏览器后恢复），Command 需要能序列化。

难点在于：序列化 THREE.Object3D 不是简单的事——几何体、材质、纹理都需要处理。

```ts
function serializeObject(object: THREE.Object3D): any {
    return {
        uuid: object.uuid,
        type: object.type,
        name: object.name,
        position: object.position.toArray(),
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: object.scale.toArray(),
        geometry: object.geometry?.uuid,
        material: object.material?.uuid,
        // 子对象递归
        children: object.children.map(c => serializeObject(c))
    };
}
```

## 键盘快捷键绑定

```ts
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            history.undo();
        } else if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
            event.preventDefault();
            history.redo();
        }
    }
});
```

## 从撤销系统看设计模式

Command 模式的核心价值是**把操作变成数据**。操作不再是"调用一个函数"，而是"创建一个对象"。这个对象可以：

- 被存储（历史栈）
- 被序列化（持久化）
- 被合并（批量操作）
- 被排队（宏命令）

这种思路在很多场景有用：事务系统、事件溯源、操作日志。

## 练习

### 练习一：实现颜色修改 Command

创建一个 ColorCommand，支持修改物体颜色的撤销/重做。要求记录 oldColor 和 newColor。

### 练习二：实现 Group 操作 Command

实现一个宏命令（MacroCommand），把多个 Command 组合成一个：

```ts
class MacroCommand implements Command {
    private commands: Command[] = [];
    add(cmd: Command) { this.commands.push(cmd); }
    execute() { this.commands.forEach(c => c.execute()); }
    undo() { [...this.commands].reverse().forEach(c => c.undo()); }
}
```

用它实现"把 5 个物体移到同一位置"的批量操作。

### 练习三：历史栈限制实验

设置 maxSize = 10，连续执行 20 个操作，然后尝试撤销。验证：

1. 能撤销多少步？
2. 第 11 个操作执行时，第一个操作是否被丢弃？
3. 如果中途做了 redo，再做新操作，redo 栈是否清空？

---

## 参考答案

### 练习一

```ts
class ColorCommand implements Command {
    type = 'color';
    constructor(
        private object: THREE.Mesh,
        private oldColor: THREE.Color,
        private newColor: THREE.Color
    ) {}
    execute() { this.object.material.color.copy(this.newColor); }
    undo() { this.object.material.color.copy(this.oldColor); }
    serialize() {
        return {
            type: 'color',
            objectId: this.object.uuid,
            old: this.oldColor.getHex(),
            new: this.newColor.getHex()
        };
    }
}
```

### 练习二

```ts
function moveGroupTo(objects: THREE.Object3D[], target: THREE.Vector3) {
    const macro = new MacroCommand();
    for (const obj of objects) {
        macro.add(new MoveCommand(obj, obj.position.clone(), target.clone()));
    }
    history.execute(macro);
}
```

注意：MacroCommand 的 undo 会按逆序撤销每个子命令，保证状态正确恢复。

### 练习三

1. 最多撤销 10 步（maxSize 限制）
2. 是的，第 1 个操作被 shift() 丢弃
3. 是的，新操作清空 redo 栈
