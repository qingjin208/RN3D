# ITL3DElement 组件使用指南

## 📦 组件简介

ITL3DElement 是一个基于 React Three Fiber 的 3D 模型展示和切割组件，支持两种切割模式：
- **cutFace**: 切割面模式，显示切割截面的颜色
- **cutBody**: 切割体模式，显示被切割部分的透明效果

## 📁 文件结构

```
Element/
├── ITL3DElement.tsx      # 主组件
├── types.ts              # TypeScript 类型定义
├── index.ts              # 导出接口
└── README.md             # 本文档
```

## ⚠️ 重要依赖说明

**此组件不能单独使用！** 它依赖于以下文件和依赖：

### 1. 必需的源文件
- `src/PreciseDualModeModel.tsx` - 核心 3D 模型处理组件
- 可能还需要 `src/` 目录下的其他辅助组件

### 2. 必需的 npm 依赖包
确保目标项目中已安装以下依赖：

```json
{
  "dependencies": {
    "@react-three/drei": "^9.x.x",
    "@react-three/fiber": "^8.x.x",
    "react": "^18.x.x",
    "react-dom": "^18.x.x",
    "three": "^0.143.x"
  }
}
```

安装命令：
```bash
npm install @react-three/fiber @react-three/drei three react react-dom
```

### 3. 必需的 3D 模型文件
- 需要一个 `.glb` 格式的 3D 模型文件
- 默认路径: `/Hohenzollern_Castle_optimized.glb`
- 可通过 `modelUrl` 属性自定义路径

## 🚀 使用方法

### 方式一：直接复制文件（推荐用于快速分享）

1. **复制整个 Element 文件夹**到目标项目
2. **复制 src/PreciseDualModeModel.tsx** 到目标项目的 src 目录
3. **确保依赖已安装**（见上方依赖说明）
4. **放置 3D 模型文件**到目标项目的 public 目录

在目标项目中使用：
```tsx
import { ITL3DElement } from './Element/ITL3DElement'

function App() {
  return (
    <div style={{ width: '800px', height: '600px' }}>
      <ITL3DElement
        modelUrl="/your-model.glb"
        mode="cutBody"
        cutDepth={35}
        cutAngle={0}
        canRotate={true}
      />
    </div>
  )
}
```

### 方式二：创建独立组件包（推荐用于正式分享）

创建一个独立的包结构：

```
ITL3DElement-Package/
├── package.json
├── README.md
├── src/
│   ├── components/
│   │   ├── ITL3DElement.tsx
│   │   └── PreciseDualModeModel.tsx
│   ├── types.ts
│   └── index.ts
└── dist/ (构建后)
```

## 📝 Props 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|-----|------|
| `modelUrl` | string | `/Hohenzollern_Castle_optimized.glb` | 3D 模型文件路径 |
| `mode` | `'cutFace' \| 'cutBody'` | `'cutFace'` | 切割模式 |
| `cutDepth` | number | `30` | 切割深度 (0-100) |
| `cutAngle` | number | `0` | 切割角度 (0-360) |
| `cutN` | number | - | 多刀切割数量 |
| `showCuttingSurface` | boolean | - | 是否显示切割面 |
| `cutFaceMaskColor` | string | `'#ff6b6b'` | 切割面颜色 |
| `cutBodyMaskColor` | string | - | 切割体颜色 |
| `showCutBodyWireframe` | boolean | `false` | 是否显示线框 |
| `faceNCutsView` | `'Face' \| 'Body' \| 'FaceAndBody'` | 多刀切割视图模式 |
| `modelOpacityForFaceOrBoth` | number | `0.45` | 模型透明度 |
| `overlayOpacityForBodyOrBoth` | number | `0.82` | 覆盖层透明度 |
| `cutBodyDepthOpacity` | number | `0.5` | 切割体深度透明度 |
| `cutBodyNCutsOpacity` | number | `0.72` | 多刀切割透明度 |
| `orientation` | number | `4` | 相机方向 (1-12, 时钟位置) |
| `canRotate` | boolean | `false` | 是否允许旋转 |
| `canDrag` | boolean | `false` | 是否允许拖拽 |
| `autoRotate` | boolean | `false` | 是否自动旋转 |
| `className` | string | - | CSS 类名 |
| `style` | CSSProperties | - | 内联样式 |

## 💡 使用示例

### 基础用法
```tsx
<ITL3DElement
  modelUrl="/model.glb"
  mode="cutFace"
  cutDepth={50}
/>
```

### 高级用法
```tsx
<ITL3DElement
  modelUrl="/castle.glb"
  mode="cutBody"
  cutDepth={35}
  cutAngle={45}
  cutN={3}
  showCuttingSurface={true}
  cutFaceMaskColor="#ff4d4f"
  cutBodyMaskColor="#ffffff"
  faceNCutsView="FaceAndBody"
  orientation={4}
  canRotate={true}
  canDrag={true}
  autoRotate={false}
/>
```

## 🔧 常见问题

### Q: 为什么组件无法显示？
A: 检查以下几点：
1. 是否安装了所有必需的依赖包
2. 3D 模型文件路径是否正确
3. 是否正确复制了 `PreciseDualModeModel.tsx` 文件

### Q: 如何自定义 3D 模型？
A: 将你的 `.glb` 文件放到目标项目的 `public` 目录，然后通过 `modelUrl` 属性指定路径。

### Q: 可以修改切割效果吗？
A: 可以通过调整 `cutDepth`、`cutAngle`、颜色等参数来自定义切割效果。

## 📄 许可证

本组件仅供学习和交流使用。

## 🤝 技术支持

如有问题，请联系组件提供者。
