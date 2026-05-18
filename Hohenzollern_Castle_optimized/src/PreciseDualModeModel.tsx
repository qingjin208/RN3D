import React, { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { GLTF } from 'three-stdlib'

// ⚠️ 关键：计算几何体体积的函数
function computeGeometryVolume(geometry: THREE.BufferGeometry): number {
  const position = geometry.attributes.position
  if (!position) return 0

  let volume = 0
  const p1 = new THREE.Vector3()
  const p2 = new THREE.Vector3()
  const p3 = new THREE.Vector3()

  // 遍历所有三角形面片
  for (let i = 0; i < position.count; i += 3) {
    p1.fromBufferAttribute(position, i)
    p2.fromBufferAttribute(position, i + 1)
    p3.fromBufferAttribute(position, i + 2)

    // 使用叉乘计算四面体体积（相对于原点）
    volume += p1.dot(p2.cross(p3)) / 6.0
  }

  return Math.abs(volume)
}

// ⚠️ 关键：预计算沿法线方向的体积分布（高性能 + 准确）
// 原理：将模型沿法线方向分成 N 层，预计算每层的体积，构建累积分布表
function buildVolumeDistribution(
  geometry: THREE.BufferGeometry,
  normal: THREE.Vector3,
  layers: number = 100  // 分层数量，越多越精确
): { positions: number[]; cumulativeVolumes: number[]; totalVolume: number } {
  const position = geometry.attributes.position
  if (!position) return { positions: [], cumulativeVolumes: [], totalVolume: 0 }

  // 计算包围盒
  geometry.computeBoundingBox()
  if (!geometry.boundingBox) return { positions: [], cumulativeVolumes: [], totalVolume: 0 }
  
  const box = geometry.boundingBox
  
  // 计算模型在法线方向的投影范围
  let minDist = Infinity
  let maxDist = -Infinity
  
  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ]
  
  corners.forEach(corner => {
    const dist = corner.dot(normal)
    minDist = Math.min(minDist, dist)
    maxDist = Math.max(maxDist, dist)
  })
  
  const span = maxDist - minDist
  if (span <= 0.0001) return { positions: [], cumulativeVolumes: [], totalVolume: 0 }
  
  // 为每个三角形预计算其在法线方向的投影范围
  const triangles: { dist: number[]; volume: number }[] = []
  
  for (let i = 0; i < position.count; i += 3) {
    const p1 = new THREE.Vector3().fromBufferAttribute(position, i)
    const p2 = new THREE.Vector3().fromBufferAttribute(position, i + 1)
    const p3 = new THREE.Vector3().fromBufferAttribute(position, i + 2)
    
    // 计算三角形在法线方向的投影距离
    const d1 = p1.dot(normal)
    const d2 = p2.dot(normal)
    const d3 = p3.dot(normal)
    
    // 计算三角形的有向体积（相对于原点）
    const vol = Math.abs(p1.dot(p2.cross(p3)) / 6.0)
    
    triangles.push({
      dist: [d1, d2, d3],
      volume: vol
    })
  }
  
  // 构建累积体积分布
  const positions: number[] = []
  const cumulativeVolumes: number[] = []
  let cumVolume = 0
  
  for (let i = 0; i <= layers; i++) {
    const t = i / layers
    const currentDist = minDist + t * span
    
    // 计算从 minDist 到 currentDist 之间的体积
    let layerVolume = 0
    
    for (const tri of triangles) {
      const [d1, d2, d3] = tri.dist
      
      // 检查三角形是否与当前层相交
      const minTriDist = Math.min(d1, d2, d3)
      const maxTriDist = Math.max(d1, d2, d3)
      
      if (maxTriDist <= minDist || minTriDist >= currentDist) {
        // 三角形完全在当前层之外
        continue
      }
      
      if (minTriDist >= minDist && maxTriDist <= currentDist) {
        // 三角形完全在当前层内
        layerVolume += tri.volume
      } else {
        // 三角形部分在当前层内，按比例估算
        // 简化：使用线性插值估算重叠比例
        const overlapStart = Math.max(minTriDist, minDist)
        const overlapEnd = Math.min(maxTriDist, currentDist)
        const overlapRatio = (overlapEnd - overlapStart) / (maxTriDist - minTriDist)
        layerVolume += tri.volume * overlapRatio
      }
    }
    
    cumVolume += layerVolume
    positions.push(currentDist)
    cumulativeVolumes.push(cumVolume)
  }
  
  return {
    positions,
    cumulativeVolumes,
    totalVolume: cumVolume
  }
}

// ⚠️ 关键：使用预计算的体积分布快速查找切割位置
function findCutPositionByVolume(
  distribution: { positions: number[]; cumulativeVolumes: number[]; totalVolume: number },
  targetVolume: number,
  startDist: number,
  startVolume: number
): number {
  const { positions, cumulativeVolumes } = distribution
  
  // 二分查找找到目标体积对应的位置
  let low = 0
  let high = positions.length - 1
  
  // 找到 startDist 对应的索引
  let startIndex = 0
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] >= startDist) {
      startIndex = i
      break
    }
  }
  
  const targetCumVolume = startVolume + targetVolume
  
  // 在 startIndex 之后二分查找
  low = startIndex
  high = positions.length - 1
  
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2)
    if (cumulativeVolumes[mid] < targetCumVolume) {
      low = mid
    } else {
      high = mid
    }
  }
  
  // 线性插值得到精确位置
  const v1 = cumulativeVolumes[low]
  const v2 = cumulativeVolumes[high]
  const p1 = positions[low]
  const p2 = positions[high]
  
  if (v2 === v1) return p1
  
  const t = (targetCumVolume - v1) / (v2 - v1)
  return p1 + t * (p2 - p1)
}

const MULTI_CUT_COLORS = [
  '#e63946',
  '#118ab2',
  '#ffd166',
  '#06d6a0',
  '#8338ec',
  '#fb8500',
  '#3a86ff',
  '#ef476f',
  '#8ac926',
  '#ff006e',
  '#ffbe0b',
  '#2ec4b6',
]

function getProjectionRange(box: THREE.Box3, normal: THREE.Vector3) {
  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ]

  let min = Infinity
  let max = -Infinity

  corners.forEach((corner) => {
    const dist = corner.dot(normal)
    min = Math.min(min, dist)
    max = Math.max(max, dist)
  })

  return { min, max }
}

function createForwardPlane(normal: THREE.Vector3, distance: number) {
  return new THREE.Plane(normal.clone(), -distance)
}

function createReversePlane(normal: THREE.Vector3, distance: number) {
  return new THREE.Plane(normal.clone().negate(), distance)
}

type SequentialCutLayer = {
  index: number
  startDistance: number
  endDistance: number
  color: string
  clippingPlanes: THREE.Plane[]
}

type GLTFResult = GLTF & {
  nodes: {
    HZ3: THREE.Mesh
  }
  materials: {
    HZ3_Material_u1_v1: THREE.MeshPhysicalMaterial
  }
}

interface PreciseDualModeModelProps {
  cutDepth: number
  cutAngle: number
  showCutPlane?: boolean
  mode: 'cutBody' | 'cutFace'
  capColor?: string
  showCutBodyWireframe?: boolean
  multiCutCount?: number
}

export function PreciseDualModeModel({ 
  cutDepth, 
  cutAngle, 
  showCutPlane = true,
  mode = 'cutFace',
  capColor = '#ff6b6b',
  showCutBodyWireframe = false,
  multiCutCount = 0
}: PreciseDualModeModelProps) {
  const { nodes, materials } = useGLTF('/Hohenzollern_Castle_optimized.glb') as GLTFResult

  // 计算模型的包围盒
  const modelBounds = useMemo(() => {
    if (!nodes.HZ3.geometry) return null
    
    const geometry = nodes.HZ3.geometry
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    
    if (!box) return null
    
    return { box }
  }, [nodes.HZ3.geometry])

  const cutNormal = useMemo(() => {
    const angleRad = (cutAngle * Math.PI) / 180
    return new THREE.Vector3(
      Math.cos(angleRad),
      0,
      Math.sin(angleRad)
    ).normalize()
  }, [cutAngle])

  const projectionRange = useMemo(() => {
    if (!modelBounds) return null
    return getProjectionRange(modelBounds.box, cutNormal)
  }, [modelBounds, cutNormal])

  const effectiveMultiCutCount = Math.max(
    0,
    Math.floor(Number.isFinite(multiCutCount) ? multiCutCount : 0)
  )

  // 裁剪平面计算
  const clippingPlane = useMemo(() => {
    if (cutDepth < 0 || cutDepth > 100 || !projectionRange) return null
    
    // 深度为 0 时不切割，返回 null
    if (cutDepth === 0) return null
    
    // ⚠️ 关键：深度为 100 时，将平面移到模型之外，确保完全不显示
    if (cutDepth === 100) {
      const planeDist = projectionRange.max + 0.01
      const constant = -planeDist
      
      console.log('✂️ 裁剪平面 (100%):', { 
        mode,
        cutDepth,
        normal: cutNormal.toArray(), 
        constant,
        description: '完全切掉'
      })
      
      return new THREE.Plane(cutNormal.clone(), constant)
    }

    const range = projectionRange.max - projectionRange.min
    const planeDist = projectionRange.min + (range * cutDepth / 100)
    const constant = -planeDist
    
    console.log('✂️ 裁剪平面:', { 
      mode,
      cutDepth, 
      cutAngle,
      normal: cutNormal.toArray(), 
      constant,
      planeDist,
      minDist: projectionRange.min,
      maxDist: projectionRange.max,
      description: cutDepth === 0 ? '不切割' : cutDepth === 100 ? '全切' : `切掉${cutDepth}%`
    })
    
    return new THREE.Plane(cutNormal.clone(), constant)
  }, [cutDepth, cutAngle, projectionRange, cutNormal, mode])

  // ⚠️ 关键：预计算体积分布（只计算一次）
  const volumeDistribution = useMemo(() => {
    if (!nodes.HZ3.geometry) return null
    return buildVolumeDistribution(nodes.HZ3.geometry, cutNormal, 100)
  }, [nodes.HZ3.geometry, cutNormal])

  const sequentialCutLayers = useMemo(() => {
    if (
      mode !== 'cutBody' ||
      !projectionRange ||
      cutDepth >= 100 ||
      effectiveMultiCutCount <= 0 ||
      !volumeDistribution
    ) {
      return [] as SequentialCutLayer[]
    }

    const { positions, cumulativeVolumes, totalVolume } = volumeDistribution

    // clippingPlane 保留 dot(normal,p) >= planeDist（高值侧 = 剩余体）
    const remainingMin = cutDepth === 0
      ? projectionRange.min
      : (clippingPlane ? -clippingPlane.constant : projectionRange.min)
    const remainingMax = projectionRange.max
    const remainingSpan = remainingMax - remainingMin

    if (remainingSpan <= 0.0001) return [] as SequentialCutLayer[]

    // 找到 remainingMin 对应的累积体积
    let startVolume = 0
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] >= remainingMin) {
        startVolume = i > 0 ? cumulativeVolumes[i - 1] : 0
        break
      }
    }

    // 计算剩余部分的总体积
    let endVolume = totalVolume
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] >= remainingMax) {
        endVolume = cumulativeVolumes[i]
        break
      }
    }

    const actualTotalVolume = endVolume - startVolume
    
    if (actualTotalVolume <= 0.0001) {
      console.warn('⚠️ 剩余体积太小，无法分割')
      return [] as SequentialCutLayer[]
    }

    // 目标：每份切片的体积相等
    const targetVolumePerSlice = actualTotalVolume / (effectiveMultiCutCount + 1)
    
    console.log('📊 体积分割信息:', {
      totalVolume: actualTotalVolume.toFixed(2),
      targetVolumePerSlice: targetVolumePerSlice.toFixed(2),
      numSlices: effectiveMultiCutCount + 1,
      remainingMin,
      remainingMax
    })

    const layers: SequentialCutLayer[] = []
    let currentStartDistance = remainingMin
    let currentVolume = startVolume

    // 对于每个切片，使用预计算的体积分布快速查找位置
    for (let index = 0; index < effectiveMultiCutCount; index += 1) {
      // 使用预计算的分布表快速找到目标位置
      const targetCumVolume = currentVolume + targetVolumePerSlice
      const bestEndDistance = findCutPositionByVolume(
        volumeDistribution,
        targetVolumePerSlice,
        currentStartDistance,
        currentVolume
      )
      
      // 添加微小间隙避免闪烁
      const epsilon = Math.min(remainingSpan * 0.001, 1e-4)
      const adjustedStart = index === 0 ? currentStartDistance + epsilon : currentStartDistance
      const adjustedEnd = bestEndDistance - epsilon

      // 估算实际体积（从分布表中查找）
      let endVol = 0
      for (let i = 0; i < positions.length; i++) {
        if (positions[i] >= bestEndDistance) {
          endVol = cumulativeVolumes[i]
          break
        }
      }
      const actualVolume = endVol - currentVolume

      console.log(`  📐 切片 ${index}:`, {
        start: currentStartDistance.toFixed(3),
        end: bestEndDistance.toFixed(3),
        width: (bestEndDistance - currentStartDistance).toFixed(3),
        volume: actualVolume.toFixed(2),
        targetVolume: targetVolumePerSlice.toFixed(2),
        error: ((actualVolume - targetVolumePerSlice) / targetVolumePerSlice * 100).toFixed(1) + '%'
      })

      layers.push({
        index,
        startDistance: adjustedStart,
        endDistance: adjustedEnd,
        color: MULTI_CUT_COLORS[index % MULTI_CUT_COLORS.length],
        clippingPlanes: [
          createForwardPlane(cutNormal, adjustedStart),
          createReversePlane(cutNormal, adjustedEnd),
        ],
      })

      // 更新下一个切片的起始位置和体积
      currentStartDistance = bestEndDistance
      currentVolume = endVol
    }

    console.log('✅ 体积分割完成，共', layers.length, '个切片')

    return layers
  }, [mode, projectionRange, clippingPlane, cutDepth, effectiveMultiCutCount, cutNormal, volumeDistribution])

  const isMultiCutActive = mode === 'cutBody' && sequentialCutLayers.length > 0 && cutDepth < 100

  // 主材质 - 始终应用裁剪
  const mainMaterial = useMemo(() => {
    if (!materials.HZ3_Material_u1_v1) return null

    const material = materials.HZ3_Material_u1_v1.clone()

    // Slightly push the tail start inward to avoid coplanar overlap with the last colored slice.
    const tailBoundaryDistance = isMultiCutActive
      ? (() => {
          const lastLayer = sequentialCutLayers[sequentialCutLayers.length - 1]
          const lastLayerSpan = Math.max(lastLayer.endDistance - lastLayer.startDistance, 0)
          const tailBoundaryBias = Math.max(lastLayerSpan * 0.001, 1e-7)
          return lastLayer.endDistance + tailBoundaryBias
        })()
      : null

    const activePlane = isMultiCutActive
      ? createForwardPlane(cutNormal, tailBoundaryDistance!)
      : clippingPlane

    if (activePlane) {
      material.clippingPlanes = [activePlane]
      material.clipShadows = true
      material.needsUpdate = true
    }
    
    return material
  }, [materials.HZ3_Material_u1_v1, clippingPlane, isMultiCutActive, cutNormal, sequentialCutLayers])

  const showCutSection = showCutPlane && cutDepth > 0 && cutDepth < 100

  // Cut Face 模式：创建与裁剪面重合的大平面，最终由 stencil 裁成精确轮廓
  const capGeometry = useMemo(() => {
    if (!clippingPlane || mode !== 'cutFace' || !modelBounds) return null

    const box = modelBounds.box
    const diagonal = Math.sqrt(
      Math.pow(box.max.x - box.min.x, 2) +
      Math.pow(box.max.y - box.min.y, 2) +
      Math.pow(box.max.z - box.min.z, 2)
    )

    const geometry = new THREE.PlaneGeometry(diagonal * 2, diagonal * 2, 1, 1)

    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      clippingPlane.normal
    )
    geometry.applyQuaternion(quaternion)

    const position = clippingPlane.normal.clone().multiplyScalar(-clippingPlane.constant)
    geometry.translate(position.x, position.y, position.z)

    return geometry
  }, [clippingPlane, mode, modelBounds])

  const capMaterial = useMemo(() => {
    if (!clippingPlane || mode !== 'cutFace') return null

    const material = new THREE.MeshBasicMaterial({
      color: capColor,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      fog: false,
      stencilWrite: true,
      stencilRef: 0,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp,
      stencilZFail: THREE.ReplaceStencilOp,
      stencilZPass: THREE.ReplaceStencilOp,
    })

    material.needsUpdate = true
    return material
  }, [clippingPlane, capColor, mode])

  // 用前/后面双通道写 stencil，得到切割截面的精确掩码
  const stencilBackMaterial = useMemo(() => {
    if (!clippingPlane || mode !== 'cutFace') return null

    const material = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      clippingPlanes: [clippingPlane],
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      stencilWrite: true,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.IncrementWrapStencilOp,
    })

    material.needsUpdate = true
    return material
  }, [clippingPlane, mode])

  const stencilFrontMaterial = useMemo(() => {
    if (!clippingPlane || mode !== 'cutFace') return null

    const material = new THREE.MeshBasicMaterial({
      side: THREE.FrontSide,
      clippingPlanes: [clippingPlane],
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      stencilWrite: true,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.DecrementWrapStencilOp,
    })

    material.needsUpdate = true
    return material
  }, [clippingPlane, mode])



  // Cut Body 模式：保留原材质颜色，仅叠加轻微高亮特效
  const cutBodyMaterial = useMemo(() => {
    if (!clippingPlane || mode !== 'cutBody') return null

    const reversePlane = new THREE.Plane(
      clippingPlane.normal.clone().negate(),
      -clippingPlane.constant
    )

    const material = materials.HZ3_Material_u1_v1.clone()
    material.side = THREE.DoubleSide
    material.transparent = true
    material.opacity = 0.5 //Cut Body被切割区域颜色透明度（越大透明度越高）
    material.clippingPlanes = [reversePlane]
    material.clipShadows = true

    // 轻微冷色发光，保留原本纹理与颜色层次
    material.emissive = new THREE.Color('#6fb7ff')//Cut Body被切割区域颜色
    material.emissiveIntensity = 0.12
    material.clearcoat = 0.5
    material.clearcoatRoughness = 0.35

    material.needsUpdate = true

    console.log('🔵 切割体材质:', {
      type: material.type,
      color: '#' + material.color.getHexString(),
      opacity: material.opacity,
      transparent: material.transparent,
      clippingPlanes: 'reverse',
      note: '保留原材质并叠加轻微高亮'
    })

    return material
  }, [clippingPlane, mode, materials.HZ3_Material_u1_v1])

  // Cut Body 截面填充：使用原材质颜色的提亮版，避免纯红色块
  const cutBodyCapMaterial = useMemo(() => {
    if (!clippingPlane || mode !== 'cutBody') return null

    // 创建反向裁剪平面（只保留截面部分）
    const reversePlane = new THREE.Plane(
      clippingPlane.normal.clone().negate(),
      -clippingPlane.constant
    )

    const sectionColor = materials.HZ3_Material_u1_v1.color.clone().lerp(new THREE.Color('#ffffff'), 1)

    const material = new THREE.MeshStandardMaterial({
      color: sectionColor,
      emissive: sectionColor.clone(),
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1.0,
      roughness: 0.35,
      metalness: 0.15,
      depthWrite: true,
      depthTest: true,
      fog: false,
      clippingPlanes: [reversePlane],
      clipShadows: true,
    })
    
    material.needsUpdate = true

    console.log('🟡 切割体截面材质:', {
      type: material.type,
      color: '#' + material.color.getHexString(),
      clippingPlanes: 'reverse (single plane)',
      side: 'DoubleSide',
      note: '原色提亮的截面填充'
    })

    return material
  }, [clippingPlane, mode, materials.HZ3_Material_u1_v1])

  const sequentialCutMaterials = useMemo(() => {
    if (mode !== 'cutBody' || sequentialCutLayers.length === 0) return [] as THREE.MeshPhysicalMaterial[]

    return sequentialCutLayers.map((layer) => {
      const material = materials.HZ3_Material_u1_v1.clone()
      const layerColor = new THREE.Color(layer.color)

      material.color = layerColor.clone()
      material.emissive = layerColor.clone()
      material.emissiveIntensity = 0.28
      material.side = THREE.DoubleSide
      material.transparent = true
      material.opacity = 0.72
      material.clearcoat = 0.5
      material.clearcoatRoughness = 0.35
      material.clippingPlanes = layer.clippingPlanes
      // Three.js clipping with this plane pair uses clipIntersection=false to keep slab interval.
      material.clipIntersection = false
      material.clipShadows = true
      // depthWrite = false 消除 Z-fighting（同几何体多层叠加时无需写深度）
      material.depthWrite = false
      material.needsUpdate = true

      return material
    })
  }, [mode, sequentialCutLayers, materials.HZ3_Material_u1_v1])

  if (!mainMaterial) return null

  return (
    <group dispose={null}>
      {/* 主模型 */}
      <mesh
        geometry={nodes.HZ3.geometry}
        material={mainMaterial}
        castShadow
        receiveShadow
      />

      {/* 原始 Cut Body：蓝色透明层 + 白色截面填充，统一受 showCutSection 控制 */}
      {mode === 'cutBody' && cutBodyMaterial && cutBodyCapMaterial && showCutSection && (
        <>
          <mesh
            geometry={nodes.HZ3.geometry}
            material={cutBodyMaterial}
            renderOrder={1}
          />

          {showCutBodyWireframe && (
            <mesh
              geometry={nodes.HZ3.geometry}
              renderOrder={2}
            >
              <meshBasicMaterial
                color="#ffffff"
                wireframe={true}
                transparent={true}
                opacity={0.5}
                clippingPlanes={[new THREE.Plane(
                  clippingPlane!.normal.clone().negate(),
                  -clippingPlane!.constant
                )]}
              />
            </mesh>
          )}

          <mesh
            geometry={nodes.HZ3.geometry}
            material={cutBodyCapMaterial}
            renderOrder={showCutBodyWireframe ? 3 : 2}
          />
        </>
      )}

      {/* 在 Cut Body 剩余部分（或完整模型）上继续切 N 刀 */}
      {isMultiCutActive && (
        <>
          {sequentialCutLayers.map((layer, index) => (
            <mesh
              key={`sequential-cut-${layer.index}`}
              geometry={nodes.HZ3.geometry}
              material={sequentialCutMaterials[index]}
              renderOrder={10 + index * 2}
            />
          ))}

          {showCutBodyWireframe && sequentialCutLayers.map((layer) => (
            <mesh
              key={`sequential-cut-wireframe-${layer.index}`}
              geometry={nodes.HZ3.geometry}
              renderOrder={11 + layer.index * 2}
            >
              <meshBasicMaterial
                color={layer.color}
                wireframe={true}
                transparent={true}
                opacity={0.32}
                clippingPlanes={layer.clippingPlanes}
                clipIntersection={false}
              />
            </mesh>
          ))}

        </>
      )}

      {/* 模式2: Cut Face - stencil 精确匹配截面边界 */}
      {mode === 'cutFace' && stencilBackMaterial && showCutSection && (
        <mesh
          geometry={nodes.HZ3.geometry}
          material={stencilBackMaterial}
          renderOrder={1}
        />
      )}

      {mode === 'cutFace' && stencilFrontMaterial && showCutSection && (
        <mesh
          geometry={nodes.HZ3.geometry}
          material={stencilFrontMaterial}
          renderOrder={2}
        />
      )}

      {mode === 'cutFace' && capGeometry && capMaterial && clippingPlane && showCutSection && (
        <mesh
          geometry={capGeometry}
          material={capMaterial}
          renderOrder={3}
          onAfterRender={(renderer: THREE.WebGLRenderer) => {
            renderer.clearStencil()
          }}
        />
      )}
    </group>
  )
}

useGLTF.preload('/Hohenzollern_Castle_optimized.glb')
