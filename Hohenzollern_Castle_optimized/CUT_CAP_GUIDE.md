# 🍰 切割截面（Cut Cap）实现方案对比

## 问题描述

当使用裁剪平面切割3D模型时，被切掉的部分会显示为**空心**，用户可以看到模型内部。我们需要在切割处显示一个**实心的截面**（cut cap），就像真正切开蛋糕一样。

---

## 三种实现方案

### 方案 1: 简单平面填充 ⭐⭐⭐

**原理：** 在裁剪平面位置放置一个实心平面

**优点：**
- ✅ 实现简单
- ✅ 性能好
- ✅ 易于理解和维护

**缺点：**
- ⚠️ 截面是平的，不会跟随模型轮廓
- ⚠️ 可能穿透模型其他部分

**适用场景：** 快速原型、简单模型

**代码示例：** [CutModelWithCap.tsx](file:///C:/Users/Neil.Zhen/Desktop/DJI3D/RN3D/Hohenzollern_Castle_optimized/src/CutModelWithCap.tsx)

```tsx
// 创建切割截面几何体
const capGeometry = new THREE.PlaneGeometry(modelSize * 2, modelSize * 2)
capGeometry.rotateY(-angleRad)
capGeometry.translate(x, y, z)

// 渲染截面
<mesh geometry={capGeometry} material={capMaterial} />
```

---

### 方案 2: Stencil Buffer 技术 ⭐⭐⭐⭐

**原理：** 使用模板缓冲区确保截面只在模型内部渲染

**优点：**
- ✅ 截面精确填充切割区域
- ✅ 性能良好
- ✅ 不需要自定义着色器

**缺点：**
- ⚠️ 配置较复杂
- ⚠️ 需要理解 Stencil Buffer

**适用场景：** 大多数应用场景

**关键代码：**
```tsx
const capMaterial = new THREE.MeshStandardMaterial({
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilZPass: THREE.ReplaceStencilOp,
  clippingPlanes: [clippingPlane],
})
```

---

### 方案 3: Custom Shader（推荐）⭐⭐⭐⭐⭐

**原理：** 使用自定义片段着色器，在接近裁剪平面时显示截面颜色

**优点：**
- ✅ **完美贴合模型轮廓**
- ✅ 可以添加光照效果
- ✅ 最真实的视觉效果
- ✅ 灵活可控

**缺点：**
- ⚠️ 需要编写 GLSL 着色器代码
- ⚠️ 学习曲线较陡

**适用场景：** 高质量视觉效果、专业应用

**代码示例：** [ShaderCutModel.tsx](file:///C:/Users/Neil.Zhen/Desktop/DJI3D/RN3D/Hohenzollern_Castle_optimized/src/ShaderCutModel.tsx)

**核心着色器逻辑：**
```glsl
// Fragment Shader
void main() {
  // 计算点到裁剪平面的距离
  float distanceToPlane = dot(vWorldPosition, cutPlaneNormal) + cutPlaneConstant;
  
  // 如果在错误的一侧，丢弃
  if (distanceToPlane > 0.0) discard;
  
  // 如果接近平面，显示截面颜色
  float threshold = 0.05;
  if (distanceToPlane > -threshold) {
    vec3 finalColor = capColor * lighting;
    gl_FragColor = vec4(finalColor, 1.0);
  } else {
    discard;
  }
}
```

---

## 视觉效果对比

### ❌ 没有 Cut Cap（空心）
```
    ┌─────────┐
    │         │
    │    ╱    │  ← 可以看到内部
    │  ╱      │
    └─╱───────┘
```

### ✅ 有 Cut Cap（实心）
```
    ┌─────────┐
    │█████████│  ← 红色实心截面
    │█████████│
    │█████████│
    └─────────┘
```

---

## 使用方法

### 使用方案 1（简单平面）

```tsx
import { CutModelWithCap } from './CutModelWithCap'

<CutModelWithCap 
  cutDepth={50}
  cutAngle={45}
  showCutPlane={true}
  capColor="#ff6b6b"  // 截面颜色
/>
```

### 使用方案 3（Custom Shader - 推荐）

```tsx
import { ShaderCutModel } from './ShaderCutModel'

<ShaderCutModel 
  cutDepth={50}
  cutAngle={45}
  showCutPlane={true}
  capColor="#ff6b6b"
/>
```

---

## 完整示例

更新 `CutCakeApp.tsx` 使用带截面的模型：

```tsx
import { CutModelWithCap } from './CutModelWithCap'

function App() {
  const [cutDepth, setCutDepth] = useState(50)
  const [cutAngle, setCutAngle] = useState(0)
  
  return (
    <Canvas gl={{ localClippingEnabled: true }}>
      <CutModelWithCap 
        cutDepth={cutDepth}
        cutAngle={cutAngle}
        showCutPlane={true}
        capColor="#ff6b6b"
      />
    </Canvas>
  )
}
```

---

## 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cutDepth` | number | 0 | 切割深度 (0-100%) |
| `cutAngle` | number | 0 | 切割角度 (0-360°) |
| `showCutPlane` | boolean | true | 是否显示截面 |
| `capColor` | string | '#ff6b6b' | 截面颜色 |

---

## 常见问题

### Q: 截面颜色不明显？
A: 调整 `capColor` 为更鲜艳的颜色，或增加光照强度

### Q: 截面有锯齿？
A: 启用抗锯齿：
```tsx
<Canvas gl={{ antialias: true }}>
```

### Q: 性能问题？
A: 
- 方案 1 最快
- 方案 3 稍慢但效果最好
- 移动端建议使用方案 1 或 2

### Q: 如何让截面有纹理？
A: 在 Custom Shader 中添加纹理采样：
```glsl
uniform sampler2D capTexture;
vec4 texColor = texture2D(capTexture, vUv);
gl_FragColor = texColor * lighting;
```

---

## 进阶：多平面切割

可以同时从多个方向切割，每个切割面都显示截面：

```tsx
const clippingPlanes = [
  new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),   // X 方向
  new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),   // Y 方向
]

// 为每个平面创建一个 cap
{clippingPlanes.map((plane, i) => (
  <CapMesh key={i} plane={plane} color={colors[i]} />
))}
```

---

## 性能优化建议

1. **降低截面几何体复杂度**
   ```tsx
   // 不要使用模型的完整几何体
   const simpleCap = new THREE.PlaneGeometry(10, 10)
   ```

2. **条件渲染**
   ```tsx
   {showCutPlane && <CapMesh />}
   ```

3. **移动端优化**
   ```tsx
   <Canvas 
     dpr={[1, 1.5]}
     shadows={false}
     gl={{ localClippingEnabled: true }}
   >
   ```

---

## 总结

| 方案 | 效果 | 性能 | 难度 | 推荐度 |
|------|------|------|------|--------|
| 简单平面 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| Stencil Buffer | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Custom Shader | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**推荐：** 
- 快速原型 → 方案 1
- 生产环境 → 方案 2
- 高质量需求 → 方案 3

---

## 参考资源

- [Three.js Clipping Planes](https://threejs.org/docs/#api/en/materials/Material.clippingPlanes)
- [Stencil Buffer Tutorial](https://threejs.org/examples/?q=stencil#webgl_clipping_stencil)
- [Custom Shaders in R3F](https://docs.pmnd.rs/react-three-fiber/tutorials/custom-shaders)
