import React, { useState, useRef, useMemo, useEffect } from 'react'
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

interface DebugCutModelProps {
  cutDepth: number
  cutAngle: number
  showCutPlane?: boolean
}

export function DebugCutModel({ 
  cutDepth, 
  cutAngle, 
  showCutPlane = true 
}: DebugCutModelProps) {
  const { nodes, materials } = useGLTF('/Hohenzollern_Castle_optimized.glb') as GLTFResult
  const meshRef = useRef<THREE.Mesh>(null)

  // 计算模型的包围盒以确定实际尺寸
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
    
    console.log('📦 模型信息:', {
      size: size.toArray(),
      center: center.toArray(),
      min: box.min.toArray(),
      max: box.max.toArray()
    })
    
    return { size, center, box }
  }, [nodes.HZ3.geometry])

  // 根据角度和深度计算切割平面
  const clippingPlanes = useMemo(() => {
    if (cutDepth <= 0 || !modelBounds) {
      console.log('⚠️ 不创建裁剪平面:', { cutDepth, hasBounds: !!modelBounds })
      return []
    }

    // 将角度转换为弧度
    const angleRad = (cutAngle * Math.PI) / 180
    
    // 计算切割平面的法向量
    const normal = new THREE.Vector3(
      Math.cos(angleRad),
      0,
      Math.sin(angleRad)
    )

    // 使用模型的实际尺寸来计算
    const modelSize = modelBounds.size.x // 使用 X 方向的尺寸
    const constant = (cutDepth / 100) * modelSize - modelSize / 2

    const plane = new THREE.Plane(normal, constant)
    
    console.log('✂️ 裁剪平面参数:', {
      angle: cutAngle,
      depth: cutDepth,
      modelSize,
      constant,
      normal: normal.toArray()
    })
    
    return [plane]
  }, [cutDepth, cutAngle, modelBounds])

  // 克隆材质并应用裁剪平面
  const clippedMaterial = useMemo(() => {
    if (!materials.HZ3_Material_u1_v1) return null
    
    const material = materials.HZ3_Material_u1_v1.clone()
    material.clippingPlanes = clippingPlanes
    material.clipShadows = true
    material.needsUpdate = true
    
    console.log('🎨 材质更新:', {
      clippingPlanesCount: clippingPlanes.length,
      materialType: material.type
    })
    
    return material
  }, [materials.HZ3_Material_u1_v1, clippingPlanes])

  // 切割面可视化
  const cutPlaneGeometry = useMemo(() => {
    if (cutDepth <= 0 || !showCutPlane || !modelBounds) return null

    const angleRad = (cutAngle * Math.PI) / 180
    const modelSize = modelBounds.size.x
    const constant = (cutDepth / 100) * modelSize - modelSize / 2
    
    // 创建一个足够大的平面
    const geometry = new THREE.PlaneGeometry(modelSize * 3, modelSize * 3)
    geometry.rotateY(-angleRad)
    geometry.translate(
      Math.cos(angleRad) * constant,
      0,
      Math.sin(angleRad) * constant
    )

    return geometry
  }, [cutDepth, cutAngle, showCutPlane, modelBounds])

  const cutPlaneMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#ff6b6b',
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [])

  return (
    <group dispose={null}>
      {/* 主模型 */}
      {clippedMaterial && (
        <mesh
          ref={meshRef}
          geometry={nodes.HZ3.geometry}
          material={clippedMaterial}
          castShadow
          receiveShadow
        />
      )}

      {/* 切割面可视化 */}
      {showCutPlane && cutPlaneGeometry && (
        <mesh geometry={cutPlaneGeometry} material={cutPlaneMaterial} />
      )}

      {/* 显示模型包围盒（调试用） */}
      {modelBounds && (
        <lineSegments>
          <edgesGeometry attach="geometry" args={[nodes.HZ3.geometry]} />
          <lineBasicMaterial attach="material" color="#00ff00" opacity={0.3} transparent />
        </lineSegments>
      )}
    </group>
  )
}

useGLTF.preload('/Hohenzollern_Castle_optimized.glb')
