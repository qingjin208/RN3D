# ITL3DElement

`ITL3DElement` 将当前项目里的 3D 切割模型封装为可复用 React 组件，渲染能力与 `src/PreciseDualModeModel.tsx` 保持一致。

## Files

- `Element/ITL3DElement.tsx`: 组件实现
- `Element/types.ts`: 参数类型
- `Element/index.ts`: 导出入口

## Usage

```tsx
import React from 'react'
import { ITL3DElement } from './Element'

export default function Demo() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ITL3DElement
        modelUrl="/Hohenzollern_Castle_optimized.glb"
        mode="cutFace"
        cutDepth={30}
        cutAngle={0}
        cutN={3}
        showCuttingSurface={false}
        cutFaceMaskColor="#ff6b6b"
        cutBodyMaskColor="#ffffff"
        faceNCutsView="both"
        modelOpacityForFaceOrBoth={0.45}
        overlayOpacityForBodyOrBoth={0.82}
        canRotate={true}
        canDrag={true}
      />
    </div>
  )
}
```

## Notes

- 不会删除或替换当前 `src` 下的任何文件。
- 组件默认视觉参数对齐当前项目中的 `CutCakeApp`。
- `modelUrl` 已生效，可切换到同结构的 GLB 模型。
- `cutBodyMaskColor` 已生效，会影响 Cut Body 的被切除区域高亮与截面填充颜色。


