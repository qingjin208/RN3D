# 🎯 精确切割截面实现

## ✅ 问题解决

### 之前的问题
切割面是一个**巨大的矩形平面**，远远超出模型的实际截面范围，导致视觉效果不佳。

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
使用**模型的几何体本身**作为截面，应用**反向裁剪平面**，只显示实际的截面部分。

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

## 🔧 技术实现

### 核心思路

1. **渲染两次模型**：
   - 第一次：正常渲染，应用裁剪平面（保留未被切掉的部分）
   - 第二次：使用红色材质，应用**反向裁剪平面**（只显示被切掉的截面）

2. **反向裁剪平面**：
   ```typescript
   // 原始裁剪平面：保留左侧，切掉右侧
   const clippingPlane = new THREE.Plane(normal, constant)
   
   // 反向裁剪平面：保留右侧，切掉左侧
   const reverseClippingPlane = new THREE.Plane(
     normal.clone().negate(),    // 法向量取反
     -constant                    // 常数取反
   )
   ```

3. **叠加渲染**：
   - 第一层：原模型 + 裁剪 → 显示剩余部分
   - 第二层：原模型 + 反向裁剪 + 红色材质 → 只显示截面

---

## 📝 代码实现

### 1. 主模型（保留部分）

```typescript
// 主材质 - 应用裁剪
const mainMaterial = useMemo(() => {
  const material = materials.HZ3_Material_u1_v1.clone()
  
  if (clippingPlane) {
    material.clippingPlanes = [clippingPlane]
    material.clipShadows = true
  }
  
  return material
}, [materials.HZ3_Material_u1_v1, clippingPlane])

// 渲染主模型
<mesh
  geometry={nodes.HZ3.geometry}
  material={mainMaterial}
/>
```

### 2. 截面（填充部分）

```typescript
// 创建反向裁剪平面
const reverseClippingPlane = useMemo(() => {
  if (!clippingPlane) return null
  
  return new THREE.Plane(
    clippingPlane.normal.clone().negate(),
    -clippingPlane.constant
  )
}, [clippingPlane])

// 截面材质 - 应用反向裁剪
const capGeometryMaterial = useMemo(() => {
  const material = new THREE.MeshBasicMaterial({
    color: capColor,              // 红色
    side: THREE.DoubleSide,
    transparent: false,           // 完全不透明
    opacity: 1.0,
    clippingPlanes: [reverseClippingPlane],  // ⚠️ 反向裁剪
    clipShadows: true,
  })
  
  return material
}, [reverseClippingPlane, capColor])

// 渲染截面（使用相同的几何体）
<mesh
  geometry={nodes.HZ3.geometry}   // ⚠️ 使用模型几何体
  material={capGeometryMaterial}
  renderOrder={1}                 // 确保在模型之后渲染
/>
```

---

## 🎨 工作原理图解

### 第一步：渲染主模型（裁剪后）

```
原始模型:              应用裁剪后:
┌──────────┐          ┌──────┐
│          │          │      │
│          │    →     │      │  ← 保留这部分
│          │          │      │
└──────────┘          └──────┘
                      ↑ 裁剪平面
```

### 第二步：渲染截面（反向裁剪）

```
原始模型:              应用反向裁剪后:
┌──────────┐          ┌──────┐
│          │          │██████│
│          │    →     │██████│  ← 只显示这部分
│          │          │██████│     （截面）
└──────────┘          └──────┘
                      ↑ 反向裁剪平面
```

### 第三步：叠加效果

```
主模型 + 截面 = 最终效果
┌──────┐
│      │      ← 原模型材质（保留部分）
│      │      
│      │      
└──────┘
↑↑↑↑↑↑  ← 红色实心截面（精确匹配模型轮廓）
```

---

## ✨ 优势对比

### 之前的方案（大矩形平面）

❌ **缺点**:
- 平面远超模型边界
- 从侧面看能看到巨大的红色矩形
- 视觉效果不真实
- 可能遮挡其他物体

```typescript
// ❌ 旧方案
const geometry = new THREE.PlaneGeometry(diagonal * 2, diagonal * 2)
// 结果：一个巨大的矩形
```

### 现在的方案（精确截面）

✅ **优点**:
- 截面完全匹配模型轮廓
- 只在实际切割位置显示
- 视觉效果真实
- 不会超出模型边界

```typescript
// ✅ 新方案
<mesh
  geometry={nodes.HZ3.geometry}  // 使用模型几何体
  material={capMaterial}          // 红色材质
/>
// 结果：精确的截面形状
```

---

## 🧪 测试验证

### 测试步骤

1. **启动程序**
   ```bash
   npm start
   ```

2. **设置切割参数**
   - 深度: 50%
   - 角度: 0°

3. **旋转模型观察**
   - ✅ 从正面看：红色截面应该精确匹配模型轮廓
   - ✅ 从侧面看：不应该看到超出的红色矩形
   - ✅ 从顶部看：截面应该填满整个切割面
   - ✅ 旋转任意角度：截面始终贴合模型

4. **调整深度**
   - 深度 25%: 截面应该在 1/4 位置，形状匹配
   - 深度 50%: 截面应该在中间，形状匹配
   - 深度 75%: 截面应该在 3/4 位置，形状匹配

---

## 📊 控制台输出

运行后，控制台会显示：

```
📦 模型包围盒: { ... }

✂️ 裁剪平面: {
  cutDepth: 50,
  cutAngle: 0,
  normal: [1, 0, 0],
  constant: 0,
  description: "切掉50%"
}

🎨 封口材质（精确截面）: {
  type: "MeshBasicMaterial",
  transparent: false,
  opacity: 1.0,
  side: "DoubleSide",
  color: "#ff6b6b"
}
```

---

## 🎯 关键要点

### 1. 为什么使用反向裁剪？

```
原始裁剪: normal 指向右 → 保留左侧
反向裁剪: normal 指向左 → 保留右侧

两者结合 = 完整模型
但分别渲染不同部分
```

### 2. 为什么不直接计算截面几何体？

计算真实的截面几何体非常复杂：
- ❌ 需要计算模型与平面的交线
- ❌ 需要构建新的多边形
- ❌ 需要处理复杂的拓扑结构

使用反向裁剪的优势：
- ✅ 简单高效
- ✅ 自动适配任何模型
- ✅ 精确匹配轮廓
- ✅ 性能良好

### 3. renderOrder 的作用

```typescript
renderOrder={1}  // 截面在模型之后渲染
```

确保截面覆盖在模型边缘，避免 z-fighting（深度冲突）。

---

## 🔍 常见问题

### Q1: 截面有闪烁或抖动？

**解决**: 调整 renderOrder
```typescript
renderOrder={2}  // 尝试更大的值
```

### Q2: 截面颜色太暗？

**解决**: 使用 MeshBasicMaterial（不受光照影响）
```typescript
const material = new THREE.MeshBasicMaterial({
  color: capColor,
  // ...
})
```

### Q3: 从某些角度看截面消失了？

**解决**: 确保使用 DoubleSide
```typescript
side: THREE.DoubleSide
```

### Q4: 截面和模型之间有缝隙？

**解决**: 这是正常的，因为两个网格在同一位置。可以通过微调减少：
```typescript
// 不需要调整，renderOrder 已经处理了渲染顺序
```

---

## 💡 进阶优化

### 1. 自定义截面颜色

```typescript
<PreciseCutModel capColor="#00ff00" />  // 绿色
<PreciseCutModel capColor="#0000ff" />  // 蓝色
```

### 2. 添加截面边框

```typescript
// 在截面之上再渲染一个线框
<mesh geometry={nodes.HZ3.geometry}>
  <meshBasicMaterial 
    color="#ffffff"
    wireframe={true}
    transparent={true}
    opacity={0.3}
  />
</mesh>
```

### 3. 渐变截面颜色

可以使用自定义 Shader 实现渐变效果：

```glsl
// Fragment Shader
varying vec3 vPosition;
uniform vec3 color1;
uniform vec3 color2;

void main() {
  float t = (vPosition.y - minY) / (maxY - minY);
  gl_FragColor = vec4(mix(color1, color2, t), 1.0);
}
```

---

## ✅ 成功标志

如果你看到以下效果，说明实现成功：

```
✅ 截面精确匹配模型轮廓
✅ 没有超出的巨大矩形
✅ 从任何角度都看不到多余的红色区域
✅ 截面完全不透明，看不到内部
✅ 旋转模型时，截面始终贴合
✅ 调整深度时，截面平滑移动
```

---

**现在运行程序，切割面应该是精确的模型截面，而不是巨大的矩形！** 🍰✨

```bash
npm start
```
