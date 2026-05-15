# 🎯 精确切割截面 - Stencil Buffer 技术

## ✅ 问题解决

### 之前的问题
切割面是一个**大矩形平面**，超出了模型的实际边界：

```
之前的效果:
┌─────────────────────┐
│                     │
│    ┌──────┐         │  ← 红色矩形太大
│    │██████│█████████│     超出模型边界
│    │模型  │         │
│    └──────┘         │
│                     │
└─────────────────────┘
```

### 现在的解决方案
使用 **Stencil Buffer（模板缓冲）** 技术，让切割面**精确匹配模型的轮廓**：

```
现在的效果:
┌─────────────────────┐
│                     │
│    ┌──────┐         │
│    │██████│         │  ← 红色区域精确匹配
│    │模型  │         │     模型截面形状
│    └──────┘         │
│                     │
└─────────────────────┘
```

---

## 🔧 技术原理：Stencil Buffer

### 什么是 Stencil Buffer？

Stencil Buffer 是 GPU 的一个特殊缓冲区，用于控制哪些像素可以被渲染。可以把它想象成一个"模板"或"模具"。

### 工作流程（两步渲染）

#### 第一步：创建模板（写入 Stencil）

```typescript
// 渲染模型几何体，但不显示颜色
// 只在 stencil buffer 中标记值为 1
const stencilMaterial = new THREE.MeshBasicMaterial({
  colorWrite: false,  // 不写入颜色（不可见）
  depthWrite: false,
  stencilWrite: true, // 写入 stencil
  stencilRef: 1,      // 标记为 1
  clippingPlanes: [reversePlane],  // 只标记被切掉的部分
})

<mesh geometry={modelGeometry} material={stencilMaterial} />
```

**效果**：在 stencil buffer 中，被切掉的部分被标记为 1，其他地方为 0。

```
Stencil Buffer:
┌─────────────────────┐
│ 0 0 0 0 0 0 0 0 0  │
│ 0 0 1 1 1 1 0 0 0  │  ← 模型截面区域 = 1
│ 0 0 1 1 1 1 0 0 0  │
│ 0 0 1 1 1 1 0 0 0  │
│ 0 0 0 0 0 0 0 0 0  │
└─────────────────────┘
```

#### 第二步：在模板区域内渲染（读取 Stencil）

```typescript
// 渲染一个大红色平面，但只在 stencil = 1 的区域显示
const capPlaneMaterial = new THREE.MeshBasicMaterial({
  color: '#ff6b6b',
  stencilWrite: false,   // 不写入 stencil
  stencilRef: 1,         // 参考值 = 1
  stencilFunc: THREE.EqualStencilFunc,  // 只在 stencil == 1 时渲染
})

<mesh geometry={largePlane} material={capPlaneMaterial} />
```

**效果**：红色平面只在 stencil = 1 的区域（模型截面）可见，超出的部分被裁剪掉。

```
最终渲染:
┌─────────────────────┐
│                     │
│    ┌──────┐         │
│    │██████│         │  ← 只在 stencil=1 的区域显示
│    │模型  │         │
│    └──────┘         │
│                     │
└─────────────────────┘
```

---

## 📝 代码实现详解

### 1. Stencil 材质（第一步）

```typescript
const stencilMaterial = useMemo(() => {
  if (!clippingPlane || mode !== 'cutFace') return null

  // 反向裁剪平面（只保留被切掉的部分）
  const reversePlane = new THREE.Plane(
    clippingPlane.normal.clone().negate(),
    -clippingPlane.constant
  )

  const material = new THREE.MeshBasicMaterial({
    colorWrite: false,  // ⚠️ 关键：不写入颜色
    
    // Stencil 设置
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.AlwaysStencilFunc,  // 总是通过
    stencilFail: THREE.ReplaceStencilOp,   // 失败时替换
    stencilZFail: THREE.ReplaceStencilOp,  // 深度失败时替换
    stencilZPass: THREE.ReplaceStencilOp,  // 深度通过时替换
    
    clippingPlanes: [reversePlane],  // 只标记被切掉的部分
    side: THREE.DoubleSide,
  })
  
  return material
}, [clippingPlane, mode])
```

**关键点**：
- `colorWrite: false` - 这个材质不会在屏幕上显示任何颜色
- `stencilWrite: true` - 但会写入 stencil buffer
- `stencilRef: 1` - 标记的值为 1
- `clippingPlanes: [reversePlane]` - 只标记被切掉的部分

### 2. 截面平面材质（第二步）

```typescript
const capPlaneMaterial = useMemo(() => {
  if (!clippingPlane || mode !== 'cutFace') return null

  const material = new THREE.MeshBasicMaterial({
    color: capColor,
    side: THREE.DoubleSide,
    transparent: false,
    opacity: 1.0,
    
    // Stencil 测试设置
    stencilWrite: false,  // ⚠️ 关键：不写入 stencil
    stencilRef: 1,        // 参考值 = 1
    stencilFunc: THREE.EqualStencilFunc,  // ⚠️ 关键：只在 stencil == 1 时渲染
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  })
  
  return material
}, [clippingPlane, capColor, mode])
```

**关键点**：
- `stencilFunc: THREE.EqualStencilFunc` - 只在 stencil buffer 的值等于 1 时才渲染
- 这样，即使平面很大，也只会显示在模型截面的区域内

### 3. 渲染顺序

```tsx
{/* 第一步：写入 stencil */}
<mesh
  geometry={nodes.HZ3.geometry}
  material={stencilMaterial}
  renderOrder={1}  // 先渲染
/>

{/* 第二步：在 stencil 区域内渲染平面 */}
<mesh
  geometry={largePlaneGeometry}
  material={capPlaneMaterial}
  renderOrder={2}  // 后渲染
/>
```

---

## 🎨 视觉效果对比

### 不使用 Stencil（之前）

```
大红矩形平面:
┌─────────────────────────┐
│                         │
│    ┌──────┐             │
│    │模型  │█████████████│  ← 超出很多
│    └──────┘             │
│                         │
└─────────────────────────┘
```

### 使用 Stencil（现在）

```
精确截面:
┌─────────────────────────┐
│                         │
│    ┌──────┐             │
│    │██████│             │  ← 精确匹配
│    │模型  │             │
│    └──────┘             │
│                         │
└─────────────────────────┘
```

---

## 🧪 测试验证

### 测试步骤

1. **启动程序**
   ```bash
   npm start
   ```

2. **设置参数**
   - 模式：Cut Face
   - 深度：50%
   - 角度：0°

3. **观察效果**
   - ✅ 红色截面应该精确匹配模型轮廓
   - ✅ 不应该有超出的红色区域
   - ✅ 从任何角度旋转，截面边界都贴合模型

4. **切换角度测试**
   - 角度 0°、90°、180°、270°
   - 每个角度的截面都应该精确匹配

5. **查看控制台**
   ```
   🎨 精确截面材质: {
     type: "MeshBasicMaterial",
     color: "#ff6b6b",
     stencilFunc: "Equal (only where stencil=1)",
     note: "精确匹配模型边界"
   }
   ```

---

## 💡 为什么需要 Stencil Buffer？

### 问题：如何只显示模型截面？

**方案 1：计算真实截面几何体** ❌
- 需要计算模型与平面的交线
- 需要构建新的多边形
- 非常复杂，性能差

**方案 2：使用大平面 + 手动裁剪** ❌
- 无法精确匹配复杂形状
- 会有超出的部分

**方案 3：Stencil Buffer** ✅
- 简单高效
- 自动适配任何模型形状
- 性能优秀
- 精确匹配

---

## 🔍 Stencil Buffer 工作原理图解

```
Step 1: 渲染模型到 Stencil
┌─────────────────┐
│ Stencil Buffer  │
│                 │
│  0 0 0 0 0 0    │
│  0 1 1 1 0 0    │  ← 模型区域标记为 1
│  0 1 1 1 0 0    │
│  0 1 1 1 0 0    │
│  0 0 0 0 0 0    │
└─────────────────┘
(屏幕上看不到任何东西)

Step 2: 渲染平面，应用 Stencil 测试
┌─────────────────┐
│ Color Buffer    │
│                 │
│                 │
│    ███          │  ← 只在 stencil=1 的地方显示
│    ███          │
│    ███          │
│                 │
└─────────────────┘
(红色平面只在 stencil=1 的区域可见)
```

---

## ⚙️ Stencil 参数说明

### stencilFunc（测试函数）

| 值 | 说明 |
|----|------|
| `AlwaysStencilFunc` | 总是通过（用于写入） |
| `EqualStencilFunc` | 只在 stencil == ref 时通过 |
| `NotEqualStencilFunc` | 只在 stencil != ref 时通过 |
| `LessStencilFunc` | 只在 stencil < ref 时通过 |
| `GreaterStencilFunc` | 只在 stencil > ref 时通过 |

### stencilOp（操作）

| 值 | 说明 |
|----|------|
| `KeepStencilOp` | 保持原值 |
| `ReplaceStencilOp` | 替换为 ref 值 |
| `IncrStencilOp` | 增加 1 |
| `DecrStencilOp` | 减少 1 |
| `InvertStencilOp` | 取反 |

---

## 🎯 关键要点总结

1. **两步渲染**：
   - 第一步：写入 stencil（不可见）
   - 第二步：在 stencil 区域内渲染（可见）

2. **Stencil 测试**：
   - `EqualStencilFunc` 确保只在模型截面区域显示

3. **renderOrder**：
   - 必须先渲染 stencil，再渲染平面

4. **优势**：
   - ✅ 精确匹配任何模型形状
   - ✅ 自动适配复杂几何体
   - ✅ 性能优秀
   - ✅ 实现简单

---

## ✨ 成功标志

如果你看到以下效果，说明 Stencil Buffer 工作正常：

```
✅ 红色截面精确匹配模型轮廓
✅ 没有超出的红色区域
✅ 截面边界与模型边缘完全贴合
✅ 从任何角度观察都正确
✅ 切换角度后依然精确
```

---

**现在运行程序，切割面应该精确匹配模型的边界，不再是大矩形了！** 🍰✨

```bash
npm start
```
