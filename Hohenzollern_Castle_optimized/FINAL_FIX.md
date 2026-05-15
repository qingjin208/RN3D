# 🔧 深度100%完全切割修复说明

## ✅ 核心问题修复

### 问题 1: 深度100%时模型没有完全消失
**原因**: 
1. 裁剪平面的法向量方向错误
2. constant 计算符号错误

**Three.js Clipping Plane 规则**:
```
平面方程: normal · point + constant = 0

裁剪行为:
- 保留: normal · point + constant < 0 的部分（normal 指向的反方向）
- 裁剪: normal · point + constant > 0 的部分（normal 指向的方向）
```

### 修复方案

#### 1. 法向量取反 - 指向要保留的部分

```tsx
// ❌ 之前（错误）
const normal = new THREE.Vector3(
  Math.cos(angleRad),   // 指向切割方向
  0,
  Math.sin(angleRad)
)
// 结果：保留的是切割方向的反方向，逻辑混乱

// ✅ 现在（正确）
const normal = new THREE.Vector3(
  -Math.cos(angleRad),  // 指向保留侧（与切割方向相反）
  0,
  -Math.sin(angleRad)
)
// 结果：保留 normal 指向的反方向 = 切割方向的同侧 ✓
```

#### 2. 移除 constant 的负号

```tsx
// ❌ 之前（错误）
const constant = -((cutDepth / 100) * modelSize - modelSize / 2)

// ✅ 现在（正确）
const constant = (cutDepth / 100) * modelSize - modelSize / 2
```

### 数学验证

假设模型范围 x = -5 到 x = 5，角度 = 0°（从左向右切）

```
normal = (-1, 0, 0)  // 指向左侧（保留侧）

cutDepth = 0%:
  constant = (0/100) * 10 - 5 = -5
  平面方程: -x - 5 = 0 → x = -5
  保留: -x - 5 < 0 → -x < 5 → x > -5
  结果: 保留 x > -5（整个模型）✓

cutDepth = 50%:
  constant = (50/100) * 10 - 5 = 0
  平面方程: -x + 0 = 0 → x = 0
  保留: -x < 0 → x > 0
  结果: 保留 x > 0（右半部分）✓
  切掉: x < 0（左半部分）✓

cutDepth = 100%:
  constant = (100/100) * 10 - 5 = 5
  平面方程: -x + 5 = 0 → x = 5
  保留: -x + 5 < 0 → -x < -5 → x > 5
  结果: 保留 x > 5（模型外，无内容）✓
  切掉: x < 5（整个模型）✓
```

### 可视化

```
角度 = 0°（从左向右切）

cutDepth = 0%:
← normal=(-1,0,0)
┌──────────────┐
│              │  平面在 x=-5
│   完整模型    │  保留 x > -5（全部）✓
│              │  
└──────────────┘
← x=-5          → x=5

cutDepth = 50%:
← normal=(-1,0,0)
┌──────────────┐
│       ██████ │  平面在 x=0
│       ██████ │  保留 x > 0（右半）✓
│       ██████ │  切掉左半 ✓
└──────────────┘
← x=-5    ↑ x=0 → x=5
         封口

cutDepth = 100%:
← normal=(-1,0,0)
┌──────────────┐
│              │  平面在 x=5
│   (空)       │  保留 x > 5（无）✓
│              │  切掉全部 ✓
└──────────────┘
← x=-5                → x=5
```

---

### 问题 2: 封口仍然透明

**原因**: 
1. `MeshStandardMaterial` 受光照影响，可能在某些角度变暗或透明
2. 材质可能需要更严格的设置

**修复方案**:

```tsx
// ❌ 之前（可能透明）
const material = new THREE.MeshStandardMaterial({
  color: capColor,
  roughness: 0.5,
  metalness: 0.0,
  side: THREE.FrontSide,
  transparent: false,
  opacity: 1.0,
})

// ✅ 现在（强制不透明）
const material = new THREE.MeshBasicMaterial({
  color: capColor,
  side: THREE.DoubleSide,     // 双面渲染
  transparent: false,         // 绝对不透明
  opacity: 1.0,               // 完全不透明
  depthWrite: true,           // 写入深度
  depthTest: true,            // 深度测试
  fog: false,                 // 不受雾效影响
})
material.needsUpdate = true   // 强制更新
```

**关键改进**:
1. **使用 MeshBasicMaterial** - 不受光照影响，颜色始终一致
2. **DoubleSide** - 从任何角度都能看到
3. **明确的透明设置** - `transparent: false` + `opacity: 1.0`
4. **强制更新** - `needsUpdate = true`

---

### 问题 3: 封口平面旋转对齐

**原因**: 简单的 `rotateY` 无法正确处理任意角度的旋转

**修复方案**: 使用 Quaternion 进行精确旋转

```tsx
// ❌ 之前（简单旋转，可能不准确）
geometry.rotateY(-angleRad + Math.PI / 2)

// ✅ 现在（精确旋转）
const normal = new THREE.Vector3(
  -Math.cos(angleRad),
  0,
  -Math.sin(angleRad)
)

// 计算从 +Z 轴到 normal 的旋转
const quaternion = new THREE.Quaternion()
quaternion.setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),  // 原始法向量
  normal                        // 目标法向量
)

geometry.applyQuaternion(quaternion)

// 平移到正确位置
const position = normal.clone().multiplyScalar(-constant)
geometry.translate(position.x, position.y, position.z)
```

---

## 🧪 完整测试流程

### 1. 启动程序
```bash
npm start
```

### 2. 打开浏览器控制台（F12）

### 3. 测试深度值

#### 测试用例 1: 深度 0%
- **设置**: 深度 = 0%, 角度 = 0°
- **预期**: 
  - ✅ 模型完整显示
  - ✅ 无封口平面
  - ✅ 控制台: `description: "不切割"`

#### 测试用例 2: 深度 50%
- **设置**: 深度 = 50%, 角度 = 0°
- **预期**:
  - ✅ 模型被切掉一半
  - ✅ 红色封口在中间
  - ✅ 封口完全不透明
  - ✅ 控制台: `constant: 0`, `description: "切掉50%"`

#### 测试用例 3: 深度 100% ⭐ 关键测试
- **设置**: 深度 = 100%, 角度 = 0°
- **预期**:
  - ✅ **模型完全消失**（没有任何部分显示）
  - ✅ 无封口（因为没有剩余部分）
  - ✅ 控制台: `constant: 5`, `description: "全切"`

#### 测试用例 4: 不同角度
- **设置**: 深度 = 50%, 角度 = 90°
- **预期**:
  - ✅ 从前方切掉一半
  - ✅ 封口垂直于前方

### 4. 验证控制台输出

应该看到类似：

```
✂️ 裁剪平面: {
  cutDepth: 100,
  cutAngle: 0,
  normal: [-1, 0, 0],
  constant: 5,
  description: "全切"
}

🎨 封口材质（不透明）: {
  type: "MeshBasicMaterial",
  transparent: false,
  opacity: 1.0,
  side: "DoubleSide",
  color: "#ff6b6b",
  depthWrite: true,
  depthTest: true
}

📐 封口几何体: {
  angle: 0,
  constant: 5,
  normal: [-1, 0, 0],
  position: [5, 0, 0]
}
```

### 5. 视觉验证清单

- [ ] 深度 0% → 模型完整
- [ ] 深度 25% → 切掉 1/4
- [ ] 深度 50% → 切掉一半
- [ ] 深度 75% → 切掉 3/4
- [ ] **深度 100% → 模型完全消失** ⭐
- [ ] 封口是实心红色，完全不透明
- [ ] 从任何角度都能看到封口
- [ ] 调整参数时实时更新

---

## 🐛 如果还有问题

### 问题 A: 深度 100% 时模型还在

**检查**:
1. 控制台输出的 `constant` 值是否为 5
2. `normal` 是否为 `[-1, 0, 0]`（角度=0°时）

**调试**:
```tsx
// 临时测试：手动设置极端值
const clippingPlane = new THREE.Plane(
  new THREE.Vector3(-1, 0, 0),
  10  // 很大的值，确保平面在模型外
)
```

### 问题 B: 封口仍然透明

**检查**:
1. 控制台是否显示 `type: "MeshBasicMaterial"`
2. `transparent` 是否为 `false`
3. `opacity` 是否为 `1.0`

**调试**:
```tsx
// 临时测试：使用亮绿色
const material = new THREE.MeshBasicMaterial({
  color: '#00ff00',  // 亮绿色，更容易看到
  side: THREE.DoubleSide,
})
```

### 问题 C: 封口位置不对

**检查**:
1. 控制台输出的 `position` 是否正确
2. 封口是否在切割面上

**调试**:
```tsx
// 添加辅助线框查看位置
<mesh geometry={capGeometry}>
  <meshBasicMaterial 
    color="#ffffff" 
    wireframe={true}
  />
</mesh>
```

---

## 📊 关键指标总结

| 参数 | 深度 0% | 深度 50% | 深度 100% |
|------|---------|----------|-----------|
| constant | -5 | 0 | 5 |
| 保留部分 | 全部 | 右半 | 无 |
| 模型显示 | 100% | 50% | 0% ⭐ |
| 封口位置 | 无 | 中间 | 无 |

---

## ✨ 成功标志

如果你看到以下效果，说明修复成功：

```
✅ 深度 0%: 完整模型
✅ 深度 50%: 一半模型 + 红色实心封口
✅ 深度 100%: 什么都没有（模型完全消失）⭐
✅ 封口完全不透明，看不到内部
✅ 从任何角度旋转，封口都可见
✅ 控制台输出正确的参数
```

---

**现在运行程序，深度 100% 时模型应该完全消失，封口应该是实心不透明的！** 🍰✨
