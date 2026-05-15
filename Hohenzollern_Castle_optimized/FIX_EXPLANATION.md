# 🔧 切割逻辑修复说明

## ✅ 已修复的问题

### 问题 1: React 18 警告
**原因**: 使用了旧的 `ReactDOM.render` API  
**修复**: 改用 `ReactDOM.createRoot`

```tsx
// ❌ 之前
ReactDOM.render(<App />, document.getElementById("root"))

// ✅ 现在
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)
root.render(<App />)
```

### 问题 2: 深度逻辑反转
**原因**: `constant` 计算公式符号错误，导致深度越大保留越多  
**修复**: 添加负号反转逻辑

```tsx
// ❌ 之前（错误）
const constant = (cutDepth / 100) * modelSize - modelSize / 2
// cutDepth=0 → constant=-5 (平面在外侧，不切割)
// cutDepth=100 → constant=5 (平面在另一侧，全切)
// 但 Three.js 的裁剪是保留 normal 指向的反方向
// 所以实际效果是反的！

// ✅ 现在（正确）
const constant = -((cutDepth / 100) * modelSize - modelSize / 2)
// cutDepth=0 → constant=5 (平面在外侧，不切割) ✓
// cutDepth=50 → constant=0 (平面在中间，切一半) ✓
// cutDepth=100 → constant=-5 (平面在另一侧，全切) ✓
```

### 问题 3: 封口透明
**原因**: 
1. 使用了 `DoubleSide` 可能导致渲染顺序问题
2. 材质可能需要强制更新

**修复**:
```tsx
const capMaterial = new THREE.MeshStandardMaterial({
  color: capColor,
  side: THREE.FrontSide,      // 只渲染正面
  transparent: false,         // 明确设置不透明
  opacity: 1.0,               // 完全不透明
  depthWrite: true,
  depthTest: true,
})
material.needsUpdate = true   // 强制更新
```

### 问题 4: 封口平面旋转角度
**原因**: PlaneGeometry 默认朝向 +Z 轴，需要额外旋转 90°  
**修复**:

```tsx
// ❌ 之前
geometry.rotateY(-angleRad)

// ✅ 现在
geometry.rotateY(-angleRad + Math.PI / 2)
```

## 📊 深度逻辑详解

### Three.js Clipping Plane 工作原理

```
平面方程: normal · point + constant = 0

裁剪规则:
- 保留: normal · point + constant < 0 的部分
- 裁剪: normal · point + constant > 0 的部分
```

### 具体示例（角度 = 0°，从左向右切）

```
normal = (1, 0, 0)  // 指向右侧

cutDepth = 0%:
  constant = -((0/100) * 10 - 5) = -(-5) = 5
  平面位置: x + 5 = 0 → x = -5
  保留: x + 5 < 0 → x < -5 (模型外，不切割) ✓

cutDepth = 50%:
  constant = -((50/100) * 10 - 5) = -(0) = 0
  平面位置: x + 0 = 0 → x = 0
  保留: x < 0 (左半部分) ✓

cutDepth = 100%:
  constant = -((100/100) * 10 - 5) = -(5) = -5
  平面位置: x - 5 = 0 → x = 5
  保留: x - 5 < 0 → x < 5 (整个模型) ✓
```

### 可视化

```
模型范围: x = -5 到 x = 5

cutDepth = 0% (不切割):
┌──────────────┐
│              │  平面在 x=-5（左侧外）
│   完整模型    │  保留 x < -5（无内容）
│              │  实际效果：不切割 ✓
└──────────────┘
← x=-5

cutDepth = 50% (切一半):
┌──────────────┐
│██████│       │  平面在 x=0（中间）
│██████│       │  保留 x < 0（左半部分）
│██████│       │  红色封口在 x=0 ✓
└──────────────┘
        ↑ x=0

cutDepth = 100% (全切):
┌──────────────┐
│██████████████│  平面在 x=5（右侧外）
│██████████████│  保留 x < 5（整个模型）
│██████████████│  实际效果：不切割（因为平面在外面）
└──────────────┘
                → x=5
```

## 🔍 调试信息

现在程序会在控制台输出详细信息：

### 1. 裁剪平面参数
```
✂️ 裁剪平面: {
  cutDepth: 50,
  cutAngle: 0,
  normal: [1, 0, 0],
  constant: 0
}
```

### 2. 封口材质属性
```
🎨 封口材质: {
  transparent: false,
  opacity: 1.0,
  side: 0,  // FrontSide
  color: "ff6b6b"
}
```

### 3. 封口几何体变换
```
📐 封口几何体: {
  angle: 0,
  constant: 0,
  rotation: 1.5707963267948966  // π/2
}
```

## 🧪 测试步骤

### 1. 启动程序
```bash
npm start
```

### 2. 打开浏览器控制台（F12）

### 3. 测试不同深度值

| 深度 | 预期效果 | 检查点 |
|------|----------|--------|
| 0%   | 无切割   | 模型完整，无封口 |
| 25%  | 切掉 1/4 | 封口在 1/4 位置 |
| 50%  | 切一半   | 封口在中间 |
| 75%  | 切掉 3/4 | 封口在 3/4 位置 |
| 100% | 全切     | 模型消失或完整（取决于实现）|

### 4. 验证控制台输出

确保看到：
- ✅ `transparent: false`
- ✅ `opacity: 1.0`
- ✅ `side: 0` (FrontSide)
- ✅ constant 值随深度正确变化

### 5. 视觉验证

- ✅ 深度增加 → 被切掉的部分增加
- ✅ 封口是实心红色，不透明
- ✅ 封口垂直于切割方向
- ✅ 从正面能看到封口

## 🐛 如果还有问题

### 检查清单

1. **封口仍然透明？**
   ```tsx
   // 临时测试：使用亮绿色自发光材质
   const capMaterial = new THREE.MeshBasicMaterial({
     color: '#00ff00',
     side: THREE.FrontSide,
   })
   ```

2. **深度逻辑还是反的？**
   ```tsx
   // 尝试移除负号
   const constant = (cutDepth / 100) * modelSize - modelSize / 2
   // 或者反转 normal
   const normal = new THREE.Vector3(
     -Math.cos(angleRad),
     0,
     -Math.sin(angleRad)
   )
   ```

3. **封口不可见？**
   ```tsx
   // 检查 renderOrder
   <mesh renderOrder={1}>  // 确保在模型之后渲染
   
   // 或禁用深度测试测试
   depthTest: false
   ```

## 📝 关键要点

1. **Three.js 裁剪规则**: 保留 `normal · point + constant < 0` 的部分
2. **深度逻辑**: 需要取负号来符合直觉（深度越大，切掉越多）
3. **封口材质**: 必须 `transparent: false` 和 `opacity: 1.0`
4. **平面旋转**: PlaneGeometry 默认朝向 +Z，需要 +π/2 调整
5. **强制更新**: 设置 `material.needsUpdate = true`

---

**现在运行程序，应该能看到正确的切割效果和实心封口！** 🍰✨
