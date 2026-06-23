# 04. TypeScript 严格模式与类型检查

> strict、noImplicitAny、类型守卫、.d.ts 声明文件——用类型系统防止运行时错误

## 本课目标

- 理解 TypeScript 严格模式各项配置的作用和影响
- 掌握类型守卫的使用场景和实现方式
- 能够编写 .d.ts 声明文件为无类型库添加类型
- 制定渐进式启用严格模式的策略

## 为什么需要严格模式

TypeScript 最大的卖点是类型安全。但如果配置不够严格，这个卖点会大打折扣：

```typescript
// 不开严格模式，这段代码不会报错
function getUserName(user) {
  return user.name;
}

const name = getUserName(null);
console.log(name.toUpperCase()); // 运行时 TypeError: Cannot read property 'toUpperCase' of null
```

开启严格模式后：

```typescript
// strict: true
function getUserName(user: User | null): string {
  if (!user) return 'Unknown';
  return user.name;
}
```

严格模式不是 TypeScript 的"高级功能"，而是它的**核心价值**。不开严格模式的 TypeScript，只是加了类型注解的 JavaScript。

## strict 标志位详解

`strict: true` 实际上是开启了一组严格检查标志：

```json
{
  "compilerOptions": {
    "strict": true,
    // 等价于开启以下所有标志：
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictBindCallApply": true,
    "strictFunctionTypes": true,
    "strictNullChecks": true,
    "strictPropertyInitialization": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true
  }
}
```

逐一解释每个标志的作用：

### noImplicitAny — 禁止隐式 any

```typescript
// noImplicitAny: false（不报错）
function add(a, b) {
  return a + b;
}

// noImplicitAny: true（报错）
// Parameter 'a' implicitly has an 'any' type.
function add(a, b) {
  return a + b;
}

// 修复
function add(a: number, b: number): number {
  return a + b;
}
```

**为什么要开启**：`any` 是类型系统的"后门"。一旦有 `any`，TypeScript 就放弃了对这个值的类型检查。隐式 `any` 意味着开发者可能没有意识到自己绕过了类型检查。

**实际影响**：这是启用严格模式时改动量最大的标志。很多旧代码会因为缺少类型注解而报错。

### strictNullChecks — 严格空值检查

```typescript
// strictNullChecks: false
const element = document.getElementById('app');
element.innerHTML = 'Hello'; // 不报错，即使 getElementById 可能返回 null

// strictNullChecks: true
const element = document.getElementById('app');
element.innerHTML = 'Hello'; // 报错：element 可能是 null

// 修复方案一：类型守卫
if (element) {
  element.innerHTML = 'Hello';
}

// 修复方案二：非空断言（谨慎使用）
element!.innerHTML = 'Hello';

// 修复方案三：空值合并
const el = document.getElementById('app') ?? document.body;
el.innerHTML = 'Hello';
```

**为什么要开启**：空值错误是 JavaScript 中最常见的运行时错误之一。Tony Hoare 称 null 为"十亿美元的错误"。strictNullChecks 让 TypeScript 在编译时就能发现这些潜在错误。

**实际影响**：改动量仅次于 noImplicitAny。所有可能返回 null 或 undefined 的地方都需要处理。

### strictPropertyInitialization — 属性严格初始化

```typescript
// strictPropertyInitialization: true
class User {
  name: string;  // 报错：属性 'name' 没有初始化
  age: number;   // 报错：属性 'age' 没有初始化

  constructor(name: string) {
    this.name = name;
    // age 没有赋值
  }
}

// 修复方案一：在构造函数中初始化所有属性
class User {
  name: string;
  age: number;

  constructor(name: string, age: number = 0) {
    this.name = name;
    this.age = age;
  }
}

// 修复方案二：使用 ! 断言属性会被初始化
class User {
  name: string;
  age!: number; // 告诉 TypeScript：这个属性会在其他地方初始化

  constructor(name: string) {
    this.name = name;
  }

  init(age: number) {
    this.age = age;
  }
}

// 修复方案三：使用可选属性
class User {
  name: string;
  age?: number;
}
```

### strictFunctionTypes — 函数类型严格检查

```typescript
// strictFunctionTypes: false
type Handler = (event: MouseEvent) => void;
const handler: Handler = (event: Event) => {}; // 不报错

// strictFunctionTypes: true
type Handler = (event: MouseEvent) => void;
const handler: Handler = (event: Event) => {}; // 报错

// 原因：函数参数是逆变的
// Handler 期望 MouseEvent，但实际传入的是更宽泛的 Event
// 如果 handler 内部访问 event.clientX，而实际传入的是非鼠标事件，就会出错
```

### strictBindCallApply — 严格 bind/call/apply

```typescript
// strictBindCallApply: false
function add(a: number, b: number): number {
  return a + b;
}
add.call(null, 1, 2, 3); // 不报错，即使参数多了

// strictBindCallApply: true
add.call(null, 1, 2, 3); // 报错：参数过多
add.call(null, '1', 2); // 报错：类型不匹配
```

### noImplicitThis — 禁止隐式 this

```typescript
// noImplicitThis: false
function logName() {
  console.log(this.name); // 不报错，但 this 的类型是 any
}

// noImplicitThis: true
function logName() {
  console.log(this.name); // 报错：'this' implicitly has type 'any'
}

// 修复
function logName(this: { name: string }) {
  console.log(this.name);
}
```

### useUnknownInCatchVariables — catch 变量使用 unknown

```typescript
// useUnknownInCatchVariables: false
try {
  throw new Error('oops');
} catch (err) {
  console.log(err.message); // err 类型是 any
}

// useUnknownInCatchVariables: true
try {
  throw new Error('oops');
} catch (err) {
  console.log(err.message); // 报错：err 是 unknown 类型
  
  // 修复
  if (err instanceof Error) {
    console.log(err.message);
  }
}
```

## 类型守卫

类型守卫（Type Guard）是在运行时缩小类型范围的技术。在 strictNullChecks 和联合类型的情况下，类型守卫是日常开发中最常用的模式。

### typeof 守卫

```typescript
function format(value: string | number): string {
  if (typeof value === 'string') {
    return value.toUpperCase(); // value: string
  }
  return value.toFixed(2); // value: number
}
```

### instanceof 守卫

```typescript
function handleError(error: Error | string): void {
  if (error instanceof Error) {
    console.error(error.message); // error: Error
  } else {
    console.error(error); // error: string
  }
}
```

### in 守卫

```typescript
interface Bird {
  fly(): void;
  layEggs(): void;
}

interface Fish {
  swim(): void;
  layEggs(): void;
}

function move(animal: Bird | Fish) {
  if ('fly' in animal) {
    animal.fly(); // animal: Bird
  } else {
    animal.swim(); // animal: Fish
  }
}
```

### 自定义类型守卫

当内置守卫不够用时，可以写自定义类型守卫：

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

// 类型谓词：返回值是 value is User
function isValidUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    typeof (value as User).id === 'number' &&
    typeof (value as User).name === 'string'
  );
}

function processInput(input: unknown) {
  if (isValidUser(input)) {
    console.log(input.name); // input: User
  }
}
```

### 可辨识联合（Discriminated Unions）

这是 TypeScript 中最强大的类型守卫模式：

```typescript
interface Circle {
  kind: 'circle';
  radius: number;
}

interface Rectangle {
  kind: 'rectangle';
  width: number;
  height: number;
}

interface Triangle {
  kind: 'triangle';
  base: number;
  height: number;
}

type Shape = Circle | Rectangle | Triangle;

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rectangle':
      return shape.width * shape.height;
    case 'triangle':
      return (shape.base * shape.height) / 2;
  }
}
```

`kind` 字段就是"可辨识"字段。TypeScript 可以根据它的值推断出完整的类型。

### never 类型做穷尽检查

```typescript
function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rectangle':
      return shape.width * shape.height;
    case 'triangle':
      return (shape.base * shape.height) / 2;
    default:
      // 如果新增了一种 Shape 但没有处理，这里会报错
      const _exhaustive: never = shape;
      return _exhaustive;
  }
}
```

当给 Shape 联合类型添加新成员时，如果 switch 没有处理新成员，TypeScript 会在 default 分支报错，提醒你补充处理逻辑。

## .d.ts 声明文件

### 什么时候需要声明文件

1. 使用没有类型的第三方库
2. 为项目的全局变量声明类型
3. 为 CSS Module、图片等非 JS 资源声明类型
4. 扩展已有库的类型

### 为无类型库添加类型

```typescript
// types/some-lib.d.ts
declare module 'some-lib' {
  export function doSomething(input: string): number;
  export interface Options {
    verbose?: boolean;
    timeout?: number;
  }
  export default function init(options: Options): void;
}
```

### 全局变量声明

```typescript
// types/global.d.ts
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

interface Window {
  analytics: {
    track: (event: string, data?: Record<string, unknown>) => void;
  };
}
```

### CSS Module 声明

```typescript
// types/css.d.ts
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}
```

### 图片等资源声明

```typescript
// types/assets.d.ts
declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.svg?react' {
  import { ComponentType, SVGProps } from 'react';
  const ReactComponent: ComponentType<SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}
```

### 扩展已有库的类型

```typescript
// types/express.d.ts
import 'express';

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      role: 'admin' | 'user';
    };
  }
}
```

## 渐进式启用严格模式

已有项目一步到位开启 `strict: true` 会产生大量错误。渐进式策略：

### 第一步：开启 noImplicitAny

```json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": true
  }
}
```

修复隐式 any 是最基础的改进。优先修复业务代码，第三方库的类型问题可以用 `// @ts-ignore` 暂时跳过。

### 第二步：开启 strictNullChecks

这是改动量最大的一步。可以用 TypeScript 的 `--strictNullChecks` 标志配合 `// @ts-expect-error` 逐步修复：

```json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### 第三步：开启 strict

当 noImplicitAny 和 strictNullChecks 都稳定后，直接开启 `strict: true`：

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### tsconfig 中的相关配置

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

- `noUnusedLocals`：禁止未使用的局部变量
- `noUnusedParameters`：禁止未使用的函数参数
- `noFallthroughCasesInSwitch`：禁止 switch 的 fallthrough
- `forceConsistentCasingInFileNames`：强制文件名大小写一致
- `skipLibCheck`：跳过 .d.ts 文件的类型检查（提升编译速度）
- `isolatedModules`：确保每个文件可以独立编译（Babel/esbuild 兼容性）

## 常见误区

### 误区一：any 能解决所有类型问题

**错误理解**：类型报错太多，加个 `any` 就不报错了

**正确理解**：`any` 不是解决方案，是逃避。它让 TypeScript 放弃对这个值的检查，等于在类型系统上打了一个洞。真正的问题被掩盖了，只是推迟到运行时爆发。

### 误区二：类型守卫太啰嗦

**错误理解**：每次都要写 if 判断，代码变得很长

**正确理解**：类型守卫是 TypeScript 中"防御性编程"的核心。这些判断不是冗余代码，而是让程序在运行时也能正确处理意外情况。JavaScript 中不写这些判断，程序照样会出错——只是错误发生在运行时，而不是编译时。

### 误区三：@ts-ignore 是正常的

**错误理解**：`@ts-ignore` 只是告诉 TypeScript 忽略这条错误，没什么大不了

**正确理解**：`@ts-ignore` 是在类型系统上打洞。如果必须使用，应该加注释说明原因，并用 `@ts-expect-error` 替代（它会在错误消失时报错，防止忽略注释变成永久的）。

```typescript
// 不推荐
// @ts-ignore
const value = someUntypedFunction();

// 推荐
// @ts-expect-error: someUntypedFunction 的类型定义缺少 overload
const value = someUntypedFunction();
```

### 误区四：strictNullChecks 太麻烦了

**错误理解**：到处都要加 null 检查，代码变得很难读

**正确理解**：strictNullChecks 暴露的是真实存在的空值风险。在不开启 strictNullChecks 的情况下，这些风险同样存在，只是你不知道它们在哪里。开启后，TypeScript 帮你找到了所有需要处理空值的地方。

## 本课小结

1. **strict 的组成**：noImplicitAny、strictNullChecks、strictFunctionTypes 等 8 个标志
2. **noImplicitAny**：最基础的严格检查，禁止隐式 any
3. **strictNullChecks**：最重要的严格检查，防止空值错误
4. **类型守卫**：typeof、instanceof、in、自定义类型谓词、可辨识联合
5. **声明文件**：为无类型库、全局变量、非 JS 资源添加类型
6. **渐进策略**：noImplicitAny → strictNullChecks → strict

## 练习

### 练习一：修复隐式 any

以下代码有隐式 any 类型，修复它们：

```typescript
function processUser(user) {
  const name = user.name;
  const age = user.age;
  return `${name} is ${age} years old`;
}

const items = [1, 2, 3];
items.forEach(item => {
  console.log(item * 2);
});
```

### 练习二：实现类型守卫

为以下函数添加类型守卫，确保在访问属性前类型是安全的：

```typescript
interface Admin {
  role: 'admin';
  permissions: string[];
}

interface Guest {
  role: 'guest';
  sessionId: string;
}

type User = Admin | Guest;

function getPermissions(user: User): string[] {
  // 实现类型守卫
}
```

### 练习三：编写声明文件

为一个没有类型的 npm 包 `color-thief` 编写声明文件，它导出以下功能：

```javascript
// color-thief 的用法
import ColorThief from 'color-thief';
const thief = new ColorThief();
const palette = await thief.getPalette(img, 5); // 返回 RGB 数组
const dominant = await thief.getColor(img); // 返回单个 RGB 数组
```

## 参考答案

### 练习一

```typescript
interface User {
  name: string;
  age: number;
}

function processUser(user: User): string {
  const name = user.name;
  const age = user.age;
  return `${name} is ${age} years old`;
}

const items: number[] = [1, 2, 3];
items.forEach((item: number) => {
  console.log(item * 2);
});
```

### 练习二

```typescript
function getPermissions(user: User): string[] {
  if (user.role === 'admin') {
    return user.permissions; // user: Admin
  }
  return []; // user: Guest，没有 permissions
}
```

也可以用自定义类型守卫：

```typescript
function isAdmin(user: User): user is Admin {
  return user.role === 'admin';
}

function getPermissions(user: User): string[] {
  if (isAdmin(user)) {
    return user.permissions;
  }
  return [];
}
```

### 练习三

```typescript
// types/color-thief.d.ts
declare module 'color-thief' {
  type RGB = [number, number, number];

  export default class ColorThief {
    getColor(
      image: HTMLImageElement | string,
      quality?: number,
    ): Promise<RGB>;

    getPalette(
      image: HTMLImageElement | string,
      colorCount?: number,
      quality?: number,
    ): Promise<RGB[]>;
  }
}
```

## 下一步

完成本课后，继续学习 [05. 代码审查流程与自动化](./05-code-review.md)。
