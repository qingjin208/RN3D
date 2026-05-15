import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { GLTF } from 'three-stdlib'

type GLTFResult = GLTF & {
  nodes: {
    HZ3: THREE.Mesh
  }
  materials: {
    HZ3_Material_u1_v1: THREE.MeshPhysicalMaterial
  }
}

interface DualModeCutModelProps {
  cutDepth: number
  cutAngle: number
  showCutPlane?: boolean
  mode: 'cutBody' | 'cutFace'  // 切割体模式 或 切割面模式
  capColor?: string
}

export function DualModeCutModel({ 
  cutDepth, 
  cutAngle, 
  showCutPlane = true,
  mode = 'cutFace',
  capColor = '#ff6b6b'
}: DualModeCutModelProps) {
  const { nodes, materials } = useGLTF('/Hohenzollern_Castle_optimized.glb') as GLTFResult

  // 计算模型的包围盒
  const modelBounds = useMemo(() => {
    if (!nodes.HZ3.geometry) return null
    
    const geometry = nodes.HZ3.geometry
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    
    if (!box) return null
    
    const size = new THREE.Vector3()
    box.getSize(size)
    
    const center = new THREE.Vector3()
    box.getCenter(center)
    
    console.log('📦 模型包围盒:', {
      min: box.min.toArray(),
      max: box.max.toArray(),
      size: size.toArray(),
      center: center.toArray()
    })
    
    return { box, size, center }
  }, [nodes.HZ3.geometry])

  // 裁剪平面计算 - 深度0=不切割，深度100=全切
  const clippingPlane = useMemo(() => {
    if (cutDepth <= 0 || !modelBounds) return null

    const angleRad = (cutAngle * Math.PI) / 180
    
    // 法向量指向要切除的方向
    const normal = new THREE.Vector3(
      Math.cos(angleRad),
      0,
      Math.sin(angleRad)
    )

    // 根据模型实际包围盒计算平面位置
    const box = modelBounds.box
    
    // 计算模型在切割方向上的投影范围
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
    
    let minDist = Infinity
    let maxDist = -Infinity
    
    corners.forEach(corner => {
      const dist = corner.dot(normal)
      minDist = Math.min(minDist, dist)
      maxDist = Math.max(maxDist, dist)
    })
    
    const range = maxDist - minDist
    const planeDist = minDist + (range * cutDepth / 100)
    const constant = -planeDist
    
    console.log('✂️ 裁剪平面:', { 
      mode,
      cutDepth, 
      cutAngle,
      normal: normal.toArray(), 
      constant,
      description: cutDepth === 0 ? '不切割' : cutDepth === 100 ? '全切' : `切掉${cutDepth}%`
    })
    
    return new THREE.Plane(normal, constant)
  }, [cutDepth, cutAngle, modelBounds, mode])

  // 主材质 - 始终应用裁剪（保留未被切掉的部分）
  const mainMaterial = useMemo(() => {
    if (!materials.HZ3_Material_u1_v1) return null

    const material = materials.HZ3_Material_u1_v1.clone()
    
    if (clippingPlane && cutDepth > 0 && cutDepth < 100) {
      material.clippingPlanes = [clippingPlane]
      material.clipShadows = true
      material.needsUpdate = true
    }
    
    return material
  }, [materials.HZ3_Material_u1_v1, clippingPlane, cutDepth])

  // ⚠️ 关键：创建精确的切割截面几何体
  const capGeometry = useMemo(() => {
    if (!clippingPlane || cutDepth <= 0 || cutDepth >= 100 || !modelBounds) return null

    const box = modelBounds.box
    
    // 使用模型的对角线长度，确保平面完全覆盖截面
    const diagonal = Math.sqrt(
      Math.pow(box.max.x - box.min.x, 2) + 
      Math.pow(box.max.y - box.min.y, 2) + 
      Math.pow(box.max.z - box.min.z, 2)
    )
    
    // 创建足够大的平面（对角线的2倍）
    const geometry = new THREE.PlaneGeometry(diagonal * 2, diagonal * 2, 1, 1)
    
    // 将平面旋转到裁剪平面的方向
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),  // 原始法向量 (+Z)
      clippingPlane.normal         // 目标法向量
    )
    
    geometry.applyQuaternion(quaternion)
    
    // 将平面移动到裁剪平面的位置
    const position = clippingPlane.normal.clone().multiplyScalar(-clippingPlane.constant)
    geometry.translate(position.x, position.y, position.z)
    
    console.log('📐 封口几何体:', { 
      angle: cutAngle, 
      constant: clippingPlane.constant,
      normal: clippingPlane.normal.toArray(),
      position: position.toArray(),
      diagonal: diagonal,
      planeSize: diagonal * 2
    })

    return geometry
  }, [clippingPlane, cutDepth, cutAngle, modelBounds])

  // 切割面材质 - 完全不透明
  const capMaterial = useMemo(() => {
    if (!clippingPlane) return null

    const material = new THREE.MeshBasicMaterial({
      color: capColor,
      side: THREE.DoubleSide,     // 双面渲染
      transparent: false,         // 绝对不透明
      opacity: 1.0,               // 完全不透明
      depthWrite: true,           // 写入深度缓冲
      depthTest: true,            // 启用深度测试
      fog: false,                 // 不受雾效影响
    })
    
    material.needsUpdate = true

    console.log('🎨 封口材质（不透明）:', {
      type: material.type,
      transparent: material.transparent,
      opacity: material.opacity,
      side: material.side === THREE.DoubleSide ? 'DoubleSide' : 'FrontSide',
      color: '#' + material.color.getHexString(),
      depthWrite: material.depthWrite,
      depthTest: material.depthTest
    })

    return material
  }, [clippingPlane, capColor])

  // 模式1: 切割体材质 - 显示被切掉的部分（反向裁剪）
  const cutBodyMaterial = useMemo(() => {
    if (!clippingPlane || mode !== 'cutBody') return null

    // 创建反向裁剪平面（保留被切掉的部分）
    const reversePlane = new THREE.Plane(
      clippingPlane.normal.clone().negate(),
      -clippingPlane.constant
    )

    const material = new THREE.MeshBasicMaterial({
      color: capColor,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      fog: false,
      clippingPlanes: [reversePlane],  // 反向裁剪
      clipShadows: true,
    })
    
    material.needsUpdate = true

    console.log('🔴 切割体材质:', {
      type: material.type,
      color: '#' + material.color.getHexString(),
      clippingPlanes: 'reverse'
    })

    return material
  }, [clippingPlane, capColor, mode])

  if (!mainMaterial) return null

  return (
    <group dispose={null}>
      {/* 主模型 - 始终应用裁剪 */}
      <mesh
        geometry={nodes.HZ3.geometry}
        material={mainMaterial}
        castShadow
        receiveShadow
      />

      {/* 模式1: Cut Body - 显示被切掉的部分（红色实体） */}
      {mode === 'cutBody' && cutBodyMaterial && showCutPlane && cutDepth > 0 && cutDepth < 100 && (
        <mesh
          geometry={nodes.HZ3.geometry}
          material={cutBodyMaterial}
          renderOrder={1}
        />
      )}

      {/* 模式2: Cut Face - 显示精确的切割截面（平面填充） */}
      {mode === 'cutFace' && capGeometry && capMaterial && showCutPlane && cutDepth > 0 && cutDepth < 100 && (
        <mesh
          geometry={capGeometry}
          material={capMaterial}
          renderOrder={2}
        />
      )}
    </group>
  )
}

useGLTF.preload('/Hohenzollern_Castle_optimized.glb')
