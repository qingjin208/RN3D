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

interface PreciseCutModelProps {
  cutDepth: number
  cutAngle: number
  showCutPlane?: boolean
  capColor?: string
}

export function PreciseCutModel({ 
  cutDepth, 
  cutAngle, 
  showCutPlane = true,
  capColor = '#ff6b6b'
}: PreciseCutModelProps) {
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
      cutDepth, 
      cutAngle,
      normal: normal.toArray(), 
      constant,
      planeDist,
      minDist,
      maxDist,
      range,
      description: cutDepth === 0 ? '不切割' : cutDepth === 100 ? '全切' : `切掉${cutDepth}%`
    })
    
    return new THREE.Plane(normal, constant)
  }, [cutDepth, cutAngle, modelBounds])

  // 主材质 - 应用裁剪
  const mainMaterial = useMemo(() => {
    if (!materials.HZ3_Material_u1_v1) return null

    const material = materials.HZ3_Material_u1_v1.clone()
    
    if (clippingPlane) {
      material.clippingPlanes = [clippingPlane]
      material.clipShadows = true
      material.needsUpdate = true
    }
    
    return material
  }, [materials.HZ3_Material_u1_v1, clippingPlane])

  // ⚠️ 关键改进：使用模型几何体的克隆，应用反向裁剪
  const capMaterial = useMemo(() => {
    if (!clippingPlane) return null

    // 使用 MeshBasicMaterial 确保完全不透明
    const material = new THREE.MeshBasicMaterial({
      color: capColor,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      fog: false,
    })
    
    material.needsUpdate = true

    console.log('🎨 封口材质（精确截面）:', {
      type: material.type,
      transparent: material.transparent,
      opacity: material.opacity,
      side: material.side === THREE.DoubleSide ? 'DoubleSide' : 'FrontSide',
      color: '#' + material.color.getHexString()
    })

    return material
  }, [clippingPlane, capColor])

  // ⚠️ 关键改进：创建反向裁剪平面（保留被切掉的部分）
  const reverseClippingPlane = useMemo(() => {
    if (!clippingPlane) return null
    
    // 反转法向量，保留另一侧
    return new THREE.Plane(
      clippingPlane.normal.clone().negate(),
      -clippingPlane.constant
    )
  }, [clippingPlane])

  // 截面材质 - 应用反向裁剪
  const capGeometryMaterial = useMemo(() => {
    if (!reverseClippingPlane) return null

    const material = new THREE.MeshBasicMaterial({
      color: capColor,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      fog: false,
      clippingPlanes: [reverseClippingPlane],  // 反向裁剪
      clipShadows: true,
    })
    
    material.needsUpdate = true

    return material
  }, [reverseClippingPlane, capColor])



  if (!mainMaterial) return null

  return (
    <group dispose={null}>
      {/* 主模型 - 被裁剪的部分 */}
      <mesh
        geometry={nodes.HZ3.geometry}
        material={mainMaterial}
        castShadow
        receiveShadow
      />

      {/* ⚠️ 切割截面 - 使用模型几何体 + 反向裁剪，只显示截面 */}
      {capGeometryMaterial && showCutPlane && (
        <mesh
          geometry={nodes.HZ3.geometry}
          material={capGeometryMaterial}
          renderOrder={1}  // 确保在模型之后渲染
        />
      )}
    </group>
  )
}

useGLTF.preload('/Hohenzollern_Castle_optimized.glb')
