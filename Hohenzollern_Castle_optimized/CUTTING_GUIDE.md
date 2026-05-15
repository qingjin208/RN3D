# 🍰 3D 模型切割功能实现说明

## 功能概述

本功能实现了类似"切蛋糕"的3D交互效果，允许用户通过控制面板从指定角度移除模型的指定深度部分。

## 核心原理

使用 **Three.js 的 Clipping Planes（裁剪平面）**技术：
- 在渲染时动态计算裁剪平面
- 通过着色器实时裁剪模型几何体
- 可视化显示切割面和剩余部分

## 文件结构

```
src/
├── CutCakeModel.tsx          # 基础切割模型组件
├── AdvancedCutModel.tsx      # 高级切割模型组件（带动画）
├── CutCakeApp.tsx            # 完整应用（含控制面板）
└── App.tsx                   # 主应用入口
```

## 使用方法

### 1. 基础使用

```tsx
import { CutCakeModel } from './CutCakeModel'

function MyScene() {
  return (
    <Canvas gl={{ localClippingEnabled: true }}>
      <CutCakeModel 
        cutDepth={50}      // 切割深度 0-100%
        cutAngle={45}      // 切割角度 0-360°
        showCutPlane={true} // 显示切割面
      />
    </Canvas>
  )
}
```

### 2. 高级使用（带动画）

```tsx
import { AdvancedCutModel } from './AdvancedCutModel'

function MyScene() {
  const [depth, setDepth] = useState(30)
  
  return (
    <Canvas gl={{ localClippingEnabled: true }}>
      <AdvancedCutModel 
        cutDepth={depth}
        cutAngle={90}
        cutColor="#ff6b6b"   // 切割面颜色
        animateCut={true}     // 开启动画
      />
    </Canvas>
  )
}
```

### 3. 运行项目

```bash
npm start
```

访问 http://localhost:3000 查看效果

## 关键配置

### ⚠️ 重要：启用裁剪功能

在 `<Canvas>` 中必须设置：

```tsx
<Canvas gl={{ localClippingEnabled: true }}>
  {/* ... */}
</Canvas>
```

否则裁剪平面不会生效！

## 参数说明

### CutCakeModel 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cutDepth` | number | 0 | 切割深度 (0-100%) |
| `cutAngle` | number | 0 | 切割角度 (0-360°) |
| `showCutPlane` | boolean | true | 是否显示切割面 |

### AdvancedCutModel 额外参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cutColor` | string | '#ff6b6b' | 切割面颜色 |
| `animateCut` | boolean | false | 是否开启动画过渡 |

## 技术细节

### 裁剪平面计算

```typescript
// 1. 根据角度计算法向量
const normal = new THREE.Vector3(
  Math.cos(angleRad),
  0,
  Math.sin(angleRad)
)

// 2. 根据深度计算平面位置
const constant = (cutDepth / 100) * modelSize - modelSize / 2

// 3. 创建裁剪平面
const plane = new THREE.Plane(normal, constant)
```

### 性能优化

1. **使用 useMemo** 缓存计算结果
2. **克隆材质** 避免影响其他实例
3. **条件渲染** 只在需要时显示切割面

## 扩展功能

### 多平面切割

可以添加多个裁剪平面实现更复杂的切割：

```tsx
const clippingPlanes = [
  new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
  new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
]
```

### CSG 布尔运算（真实切割）

如果需要真实修改几何体（而非视觉裁剪），可以使用 Three-CSG：

```bash
npm install three-csg-ts
```

```tsx
import { CSG } from 'three-csg-ts'

// 执行布尔减法
const result = CSG.subtract(modelMesh, cutterMesh)
```

⚠️ 注意：CSG 运算性能较差，不适合实时交互

### 导出切割后的模型

```tsx
import { GLTFExporter } from 'three-stdlib'

const exporter = new GLTFExporter()
exporter.parse(
  mesh,
  (gltf) => {
    const blob = new Blob([gltf], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    // 下载文件
  },
  { binary: true }
)
```

## 移动端适配

在 React + Ionic 中使用：

1. 确保模型文件大小合适（建议 < 20MB）
2. 降低渲染质量：
```tsx
<Canvas dpr={[1, 1.5]} shadows={false}>
```
3. 简化切割面几何体
4. 禁用动画以提升性能

## 常见问题

### Q: 切割后模型没有变化？
A: 检查是否在 Canvas 中设置了 `localClippingEnabled: true`

### Q: 切割面位置不准确？
A: 调整 `modelSize` 参数以匹配你的模型实际大小

### Q: 性能很差？
A: 
- 降低模型复杂度
- 减少切割面数量
- 关闭阴影和抗锯齿

### Q: 如何从不同方向切割？
A: 修改法向量的 Y 分量可以实现垂直切割：
```tsx
const normal = new THREE.Vector3(
  Math.cos(angleRad),
  0.5,  // 添加垂直分量
  Math.sin(angleRad)
)
```

## 参考资源

- [Three.js Clipping Planes 文档](https://threejs.org/docs/#api/en/materials/Material.clippingPlanes)
- [React Three Fiber 官方文档](https://docs.pmnd.rs/react-three-fiber)
- [Three-CSG 库](https://github.com/manthrax/THREE-CSGMesh)

## 许可证

MIT
