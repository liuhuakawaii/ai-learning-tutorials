# 随机与噪声

## 这节课解决什么问题

`Math.random()` 生成的数字彼此独立，没有连续性。把它们画出来是电视雪花——每像素和邻居毫无关系。但自然界的"随机"（云、地形、木纹）都有个特征：相邻位置的值接近，整体又有变化。Perlin 噪声就是为模拟这种效果发明的。

## 两种随机的直觉

```
纯随机：  0.82  0.13  0.97  0.04  0.55  ← 每个数和前一个无关
噪声随机：0.52  0.54  0.58  0.63  0.59  ← 相邻数之间平滑过渡
```

纯随机适合模拟骰子；噪声随机适合模拟风吹草地、云层起伏。

## 从零实现一个简化版 Perlin 噪声

不引入库，用最直观的方式理解噪声生成。核心思路：在整数坐标上放随机梯度向量，中间的值用插值平滑。

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="600" height="400"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// 一维噪声：在整数点上放随机值，中间做余弦插值
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fade(t) {
  return t * t * (3 - 2 * t); // 平滑曲线，比线性插值更自然
}

// 用 hash 代替随机数表，保证同一个坐标永远返回同一个值
function hash(x) {
  let n = Math.sin(x * 127.1) * 43758.5453;
  return n - Math.floor(n);
}

function noise1D(x) {
  const xi = Math.floor(x);
  const xf = x - xi;
  const u = fade(xf);
  return lerp(hash(xi), hash(xi + 1), u);
}

// 二维噪声：四个角的梯度，双线性插值
function noise2D(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);

  const aa = hash(xi + yi * 57);
  const ab = hash(xi + (yi + 1) * 57);
  const ba = hash(xi + 1 + yi * 57);
  const bb = hash(xi + 1 + (yi + 1) * 57);

  return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
}

// 分形噪声：叠加多个频率（octaves），模拟自然界的细节层次
function fbm(x, y, octaves = 4) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

// ---- 画出来 ----

// 左半：一维噪声折线图
ctx.strokeStyle = '#4ecdc4';
ctx.lineWidth = 2;
ctx.beginPath();
for (let px = 0; px < W / 2; px++) {
  const x = px / 50;
  const y = noise1D(x) * 200 + 100;
  px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
}
ctx.stroke();

// 右半：二维分形噪声灰度图
const imgData = ctx.createImageData(W / 2, H);
for (let py = 0; py < H; py++) {
  for (let px = 0; px < W / 2; px++) {
    const v = fbm(px / 80, py / 80, 5);
    const c = Math.floor(v * 255);
    const i = (py * (W / 2) + px) * 4;
    imgData.data[i] = c;
    imgData.data[i + 1] = c;
    imgData.data[i + 2] = c;
    imgData.data[i + 3] = 255;
  }
}
ctx.putImageData(imgData, W / 2, 0);

// 分隔线
ctx.strokeStyle = '#fff';
ctx.setLineDash([4, 4]);
ctx.beginPath();
ctx.moveTo(W / 2, 0);
ctx.lineTo(W / 2, H);
ctx.stroke();
</script>
</body>
</html>
```

## 参数实验

把上面的代码复制到浏览器后，试着改这几个地方：

1. 把 `noise2D` 里的 `57` 换成其他质数——图案会变，但质量差不多
2. 把 `fbm` 的 `octaves` 从 4 改成 1——只剩最粗的波浪，没有细节
3. 把 `amplitude *= 0.5` 改成 `*= 0.8`——高频细节更明显，看起来更"脏"
4. 把频率 `frequency *= 2` 改成 `*= 3`——细节层次跳跃更大

这些参数就是你以后调噪声效果的旋钮。

## 常见误解

**"Perlin 噪声是随机的"**——它其实完全确定。同一个坐标永远返回同一个值。随机性来自你选的坐标，不是算法本身。这意味着你可以用噪声生成地形，然后下次用同样的种子回到同一个地方。

**"Simplex 噪声比 Perlin 好"**——Simplex 在高维（3D+）时计算效率更高，视觉质量相似。对 2D 生成艺术来说，差别不大。

**"叠加越多层越好"**——超过 5-6 层后，人眼已经分辨不出额外细节，只是白白增加计算量。

## 本课产出

左侧是一维噪声曲线（平滑过渡），右侧是二维分形噪声灰度图（云雾状纹理）。两者都用纯数学计算，没有调用任何噪声库。
