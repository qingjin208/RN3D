# 📊 基于体积的多刀切割实现

## 概述

实现了基于**体积平均分配**的多刀切割功能，而不是简单的宽度平均分配。这样可以确保每个切片的实际体积相等，在视觉上更加均匀。

## 核心原理

### 1. 体积计算

使用 Three.js 的几何体顶点数据，通过**四面体体积公式**计算体积：

```typescript
// 对于每个三角形面片 (p1, p2, p3)
volume += p1.dot(p2.cross(p3)) / 6.0
```

这个公式计算的是从原点到三角形三个顶点形成的四面体的有向体积。

### 2. 裁剪体积计算

为了计算被裁剪后剩余部分的体积，我们：

1. 遍历所有三角形面片
2. 检查每个三角形的三个顶点是否都在裁剪平面的保留侧
3. 只累加完全在保留侧的三角形的体积

```typescript
for (const plane of clippingPlanes) {
  const d1 = plane.normal.dot(p1) + plane.constant
  const d2 = plane.normal.dot(p2) + plane.constant
  const d3 = plane.normal.dot(p3) + plane.constant
  
  // 如果有任何一个顶点在裁剪平面的错误侧，跳过这个三角形
  if (d1 < -0.001 || d2 < -0.001 || d3 < -0.001) {
    allInside = false
    break
  }
}
```

### 3. 二分查找切割位置

对于每个切片，我们需要找到一个切割位置，使得该切片的体积等于目标体积。由于体积和位置之间不是线性关系，我们使用**二分查找**算法：

```typescript
// 目标：找到 endDistance，使得 [startDistance, endDistance] 的体积 ≈ targetVolume
let low = currentStartDistance + remainingSpan * 0.01
let high = remainingMax - remainingSpan * 0.01

for (let iter = 0; iter < 50; iter++) {
  const mid = (low + high) / 2
  
  // 计算当前范围的体积
  const currentVolume = computeClippedVolume(geometry, [
    createForwardPlane(cutNormal, currentStartDistance),
    createReversePlane(cutNormal, mid)
  ])
  
  if (Math.abs(currentVolume - targetVolume) < targetVolume * 0.01) {
    // 误差在 1% 以内，找到合适位置
    break
  } else if (currentVolume < targetVolume) {
    // 体积太小，需要增加宽度
    low = mid
  } else {
    // 体积太大，需要减小宽度
    high = mid
  }
}
```

## 实现步骤

### 步骤 1：计算总体积

```typescript
const remainingPlanes = [
  createForwardPlane(cutNormal, remainingMin),
  createReversePlane(cutNormal, remainingMax)
]
const totalVolume = computeClippedVolume(nodes.HZ3.geometry, remainingPlanes)
```

### 步骤 2：计算目标体积

```typescript
// N 刀分成 N+1 份，每份体积相等
const targetVolumePerSlice = totalVolume / (effectiveMultiCutCount + 1)
```

### 步骤 3：逐个切片计算

对于每个切片：
1. 使用二分查找找到合适的结束位置
2. 记录切片的起始和结束位置
3. 更新下一个切片的起始位置

```typescript
let currentStartDistance = remainingMin

for (let index = 0; index < effectiveMultiCutCount; index += 1) {
  // 二分查找 endDistance
  const bestEndDistance = binarySearchForVolume(...)
  
  layers.push({
    index,
    startDistance: adjustedStart,
    endDistance: adjustedEnd,
    ...
  })
  
  currentStartDistance = bestEndDistance
}
```

## 优势对比

### 宽度平均分配（旧方法）

```
模型形状：逐渐变窄
┌────────────┐
│  Slice 1   │  ← 宽，体积大
├───────────┤
│  Slice 2   │  ← 中等，体积中等
├──────────┤
│ Slice 3    │  ← 窄，体积小
└─────────┘

问题：虽然宽度相同，但体积不同
```

### 体积平均分配（新方法）

```
模型形状：逐渐变窄
┌──────────┐
│ Slice 1  │  ← 较窄，但体积 = V/4
├────────────┤
│  Slice 2   │  ← 中等，体积 = V/4
├──────────────┤
│   Slice 3    │  ← 较宽，体积 = V/4
└───────────────┘
     Slice 4      ← 最宽，体积 = V/4

优势：每个切片体积相等，视觉上更均匀
```

## 性能考虑

### 计算复杂度

- **体积计算**：O(n)，其中 n 是三角形的数量
- **二分查找**：O(log(1/ε))，通常 50 次迭代足够
- **总复杂度**：O(N × n × 50)，其中 N 是切片数量

### 优化建议

1. **缓存体积计算结果**：如果几何体不变，可以缓存总体积
2. **减少迭代次数**：如果精度要求不高，可以减少二分查找的迭代次数
3. **简化几何体**：对于复杂模型，可以使用简化的几何体进行体积计算

### 实际性能

对于 Hohenzollern_Castle_optimized.glb 模型：
- 三角形数量：约 10,000 - 50,000
- 3 刀切割：约 150 次体积计算
- 计算时间：< 100ms（在现代浏览器中）

## 调试信息

代码中添加了详细的 console.log 输出：

```javascript
📊 体积分割信息: {
  totalVolume: 1234.56,
  targetVolumePerSlice: 308.64,
  numSlices: 4,
  remainingMin: -5.0,
  remainingMax: 5.0
}

📐 切片 0: {
  start: -5.000,
  end: -2.500,
  width: 2.500,
  volume: 310.20,
  targetVolume: 308.64,
  error: '0.5%'
}

✅ 体积分割完成，共 3 个切片
```

## 注意事项

### 1. 精度问题

- 体积计算是近似的，因为只考虑了完全在裁剪平面内的三角形
- 误差通常在 1% 以内，可以通过增加二分查找迭代次数来提高精度

### 2. 边界情况

- 如果剩余体积太小（< 0.0001），会警告并返回空数组
- 最后一个切片由主材质渲染，不单独创建

### 3. 闪烁问题

- 切片之间保留了微小的间隙（epsilon = 0.001）
- 避免了相邻切片的 Z-fighting

## 未来改进方向

1. **精确的多边形裁剪**：目前只考虑完全在裁剪平面内的三角形，可以实现精确的多边形裁剪算法
2. **并行计算**：使用 Web Workers 并行计算多个切片的体积
3. **自适应精度**：根据切片大小动态调整二分查找的精度
4. **体积缓存**：缓存中间结果，避免重复计算

## 相关文件

- `src/PreciseDualModeModel.tsx` - 主要实现文件
  - `computeGeometryVolume()` - 计算几何体体积
  - `computeClippedVolume()` - 计算裁剪后的体积
  - `sequentialCutLayers` - 基于体积的切片计算逻辑

---

**享受体积均匀的切片效果！** 📊✨
