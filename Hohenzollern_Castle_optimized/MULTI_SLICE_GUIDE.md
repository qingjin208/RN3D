# 🍞 多刀切割功能（Multi-Slice Toast Mode）

## 功能概述

实现了类似吐司面包的多刀切割功能，可以将3D模型按照用户指定的切割数量 n，自动计算并渲染成 n+1 个切片，每个切片之间可以调整间距。

## 主要特性

### 1. 多刀切割模式
- **输入框**：用户可以输入切割数量 n（1-10刀）
- **自动计算**：系统根据 n 刀自动将模型分成 n+1 个切片
- **垂直截面**：所有切割面都是垂直的，与 Cut Face 模式保持一致

### 2. 间距调整
- **加减按钮**：点击 + / - 按钮调整切片间距（步长 0.1）
- **数字输入**：直接输入间距值（范围 0-5）
- **滑块控制**：使用滑块快速调整间距
- **实时预览**：调整间距后，切片会像吐司面包一样分开

### 3. 切割面效果
- **精确边界**：使用 Stencil Buffer 技术确保切割面边界与模型轮廓完全匹配
- **实心填充**：切割面使用不透明的实心材质，不会显示空心
- **颜色统一**：默认使用红色 (#ff6b6b) 作为切割面颜色

## 使用方法

### 切换到多刀切割模式
1. 点击控制面板顶部的 **"Multi-Slice (Toast)"** 按钮
2. 界面会切换到多刀切割模式的控制选项

### 设置切割数量
1. 使用滑块调整切割数量（1-10刀）
2. 或在数字输入框中直接输入数值
3. 模型会自动被分割成 n+1 个切片

### 调整切片间距
1. 点击 **+** 按钮增加间距
2. 点击 **-** 按钮减少间距
3. 或在数字输入框中输入具体数值
4. 观察切片像吐司面包一样分离

### 其他控制
- **Cut Angle**：调整切割角度（0-360度）
- **Show Cut Faces**：显示/隐藏切割面
- **Reset**：重置所有参数到默认值

## 技术实现

### MultiSliceModel 组件
- **位置**：`src/MultiSliceModel.tsx`
- **核心逻辑**：
  1. 计算模型在切割方向上的包围盒范围
  2. 根据 n 刀和间距计算每个切片的位置
  3. 为每个切片创建独立的裁剪平面
  4. 使用 Stencil Buffer 渲染精确的切割面

### 切割算法
```typescript
// 计算每个切片的起始和结束位置
const segmentSize = availableRange / (numCuts + 1)
const totalSpacing = numCuts * sliceSpacing

for (let i = 0; i <= numCuts; i++) {
  const startPos = minDist + i * segmentSize + i * sliceSpacing
  const endPos = i < numCuts 
    ? minDist + (i + 1) * segmentSize + i * sliceSpacing
    : maxDist
  
  // 创建左右两个裁剪平面定义切片
}
```

### 渲染流程
1. **渲染所有切片**：每个切片使用独立的裁剪平面
2. **渲染切割面**：使用 Stencil Buffer 技术确保边界精确
   - Stencil Back Pass：写入背面模板
   - Stencil Front Pass：写入正面模板
   - Cap Surface：渲染最终的切割面

## 视觉效果

### 无间距（spacing = 0）
```
┌─────────┐
│ Slice 0 │
├─────────┤ ← 切割面 1
│ Slice 1 │
├─────────┤ ← 切割面 2
│ Slice 2 │
└─────────┘
```

### 有间距（spacing > 0）
```
┌─────────┐
│ Slice 0 │
└─────────┘
    ↓ 间距
┌─────────┐
│ Slice 1 │
└─────────┘
    ↓ 间距
┌─────────┐
│ Slice 2 │
└─────────┘
```

## 注意事项

1. **性能考虑**：
   - 建议切割数量不超过 10 刀
   - 间距过大可能导致切片超出可视范围

2. **边界情况**：
   - 当间距太大时，系统会警告无法容纳所有切片
   - 切割数量为 0 时不显示任何内容

3. **兼容性**：
   - 需要启用 Stencil Buffer（已在 Canvas 中配置）
   - 需要启用 localClippingEnabled（已在 Canvas 中配置）

## 示例场景

### 场景 1：3刀切割（4个切片）
- Number of Cuts: 3
- Slice Spacing: 0
- 效果：模型被均匀分成4份，紧密排列

### 场景 2：5刀切割 + 间距
- Number of Cuts: 5
- Slice Spacing: 0.5
- 效果：模型被分成6份，每份之间有0.5单位的间距

### 场景 3：不同角度切割
- Number of Cuts: 3
- Cut Angle: 90°
- Slice Spacing: 1.0
- 效果：从前方切割，切片明显分离

## 故障排除

### 问题1：切片不显示
- 检查是否启用了 Multi-Slice 模式
- 确认 numCuts > 0
- 检查浏览器控制台是否有错误

### 问题2：切割面边界不精确
- 确认 Canvas 已启用 `stencil: true`
- 确认 `showCutFaces` 为 true

### 问题3：间距调整后切片重叠
- 减小间距值
- 或减少切割数量

## 相关文件

- `src/MultiSliceModel.tsx` - 多刀切割组件
- `src/CutCakeApp.tsx` - 主应用（包含UI控制）
- `src/PreciseDualModeModel.tsx` - 单刀切割组件（参考）

---

**享受你的吐司面包切割体验！** 🍞✨
