# 🎯 切割面封口效果说明

## 问题描述

当你从 A 方向向 B 方向切割模型时，切割处应该显示一个**垂直于切割方向的实心平面**作为封口，就像真正切开蛋糕后看到的截面一样。

## 视觉效果对比

### ❌ 没有封口（空心）
```
切割前:              切割后（错误）:
┌──────────┐        ┌──────────┐
│          │        │          │
│  完整模型 │   →    │    ╱     │  ← 可以看到内部，是空心的
│          │        │  ╱       │
│          │        │╱         │
└──────────┘        └──────────┘
```

### ✅ 有封口（实心）
```
切割前:              切割后（正确）:
┌──────────┐        ┌──────────┐
│          │        │██████████│  ← 红色实心封口
│  完整模型 │   →    │██████████│     垂直于切割方向
│          │        │██████████│
│          │        │          │
└──────────┘        └──────────┘
                    ↑
                封口平面
```

## 实现原理

### 1. 主模型裁剪
使用 Three.js 的 Clipping Planes 裁剪掉模型的一部分：

```tsx
const material = originalMaterial.clone()
material.clippingPlanes = [clippingPlane]
material.clipShadows = true
```

### 2. 添加封口平面
在裁剪平面的位置放置一个**不透明的实心平面**：

```tsx
// 创建封口几何体
const capGeometry = new THREE.PlaneGeometry(size, size)
capGeometry.rotateY(-angleRad)  // 旋转到切割角度
capGeometry.translate(x, y, z)  // 移动到切割位置

// 使用不透明材质
const capMaterial = new THREE.MeshStandardMaterial({
  color: '#ff6b6b',      // 红色
  transparent: false,    // 不透明
  side: THREE.DoubleSide // 双面渲染
})

// 渲染封口
<mesh geometry={capGeometry} material={capMaterial} />
```

## 关键配置

### ✅ 正确的封口材质设置

```tsx
const capMaterial = new THREE.MeshStandardMaterial({
  color: capColor,
  roughness: 0.6,        // 适度粗糙
  metalness: 0.1,        // 少量金属感
  side: THREE.DoubleSide,// 双面渲染（重要！）
  transparent: false,    // 不透明（重要！）
  depthWrite: true,      // 写入深度缓冲（重要！）
})
```

### ❌ 错误的设置会导致透明或不可见

```tsx
// 错误示例 1: 透明材质
transparent: true,   // ❌ 会变成半透明
opacity: 0.3,        // ❌ 看不清

// 错误示例 2: 单面渲染
side: THREE.FrontSide // ❌ 从背面看不到

// 错误示例 3: 不写入深度
depthWrite: false    // ❌ 可能被其他物体遮挡
```

## 当前实现

文件：[CutModelWithCap.tsx](file:///C:/Users/Neil.Zhen/Desktop/DJI3D/RN3D/Hohenzollern_Castle_optimized/src/CutModelWithCap.tsx)

### 工作流程

1. **计算裁剪平面**
   ```tsx
   const clippingPlane = new THREE.Plane(normal, constant)
   ```

2. **应用裁剪到主模型**
   ```tsx
   mainMaterial.clippingPlanes = [clippingPlane]
   ```

3. **创建封口平面**
   ```tsx
   const capGeometry = new THREE.PlaneGeometry(modelSize * 2, modelSize * 2)
   // 旋转和平移到裁剪位置
   ```

4. **渲染两层**
   - 第一层：被裁剪的主模型
   - 第二层：封口平面（renderOrder=1，确保在上面）

## 测试方法

### 1. 启动程序
```bash
npm start
```

### 2. 调整参数
- 切割深度：设置为 50%
- 切割角度：设置为 0°

### 3. 验证效果

你应该看到：
- ✅ 模型被从中间切开
- ✅ 切割处有一个**红色的实心平面**
- ✅ 这个平面**垂直于切割方向**
- ✅ 旋转模型时，封口始终可见
- ✅ 不是透明的，不是空心的

### 4. 旋转查看

用鼠标旋转模型，从不同角度观察：
- 正面看：应该看到红色封口
- 侧面看：封口应该是薄薄的一层
- 背面看：封口仍然可见（因为使用了 DoubleSide）

## 常见问题

### Q1: 封口是透明的？
**原因**: 材质设置了 `transparent: true`  
**解决**: 确保 `transparent: false`

### Q2: 从某些角度看封口消失了？
**原因**: 只渲染了单面  
**解决**: 使用 `side: THREE.DoubleSide`

### Q3: 封口颜色太暗？
**原因**: 光照不足  
**解决**: 增加光源强度或调整材质颜色

### Q4: 封口和模型之间有缝隙？
**原因**: 平面位置计算不准确  
**解决**: 检查 `constant` 值的计算

### Q5: 封口穿透了模型其他部分？
**原因**: 平面太大  
**解决**: 减小平面尺寸或使用 Stencil Buffer

## 进阶优化

### 方案 1: 添加边缘高亮

```tsx
// 在封口平面周围添加边框
<mesh geometry={capGeometry}>
  <meshBasicMaterial 
    color="#ffffff"
    wireframe={true}
    transparent={true}
    opacity={0.3}
  />
</mesh>
```

### 方案 2: 动态颜色

根据切割深度改变封口颜色：

```tsx
const getColorByDepth = (depth: number) => {
  if (depth < 30) return '#00ff00'  // 绿色 - 浅切
  if (depth < 70) return '#ffff00'  // 黄色 - 中等
  return '#ff0000'                  // 红色 - 深切
}
```

### 方案 3: 添加纹理

```tsx
const capMaterial = new THREE.MeshStandardMaterial({
  map: textureLoader.load('/cap-texture.jpg'),
  color: capColor,
})
```

## 性能考虑

### 移动端优化

```tsx
// 降低封口平面的分辨率
const capGeometry = new THREE.PlaneGeometry(
  modelSize * 1.5,  // 减小尺寸
  modelSize * 1.5,
  1, 1              // 减少分段数
)

// 简化材质
const capMaterial = new THREE.MeshBasicMaterial({
  color: capColor,
  side: THREE.DoubleSide,
})
```

## 总结

✅ **封口平面的关键要素：**
1. 不透明材质 (`transparent: false`)
2. 双面渲染 (`side: THREE.DoubleSide`)
3. 正确的深度写入 (`depthWrite: true`)
4. 准确的位置和角度
5. 足够的尺寸覆盖切割区域

✅ **视觉效果：**
- 像真正的蛋糕切口
- 实心的，不是空心
- 垂直于切割方向
- 从任何角度都可见

---

**现在运行程序，你应该能看到完美的切割封口效果！** 🍰✨
