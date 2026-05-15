import React, { useState, useRef, useMemo } from 'react'
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

interface CutCakeModelProps {
  cutDepth: number        // 切割深度 (0-100)
  cutAngle: number        // 切割角度 (0-360度)
  showCutPlane?: boolean  // 是否显示切割面
}

export function CutCakeModel({ 
  cutDepth, 
  cutAngle, 
  showCutPlane = true 
}: CutCakeModelProps) {
  const { nodes, materials } = useGLTF('/Hohenzollern_Castle_optimized.glb') as GLTFResult
  const meshRef = useRef<THREE.Mesh>(null)

  // 根据角度和深度计算切割平面
  const clippingPlanes = useMemo(() => {
    if (cutDepth <= 0) return []

    // 将角度转换为弧度
    const angleRad = (cutAngle * Math.PI) / 180
    
    // 计算切割平面的法向量
    const normal = new THREE.Vector3(
      Math.cos(angleRad),
      0,
      Math.sin(angleRad)
    )

    // 计算切割平面的常数项（基于深度）
    // 假设模型范围是 -5 到 5，深度百分比映射到这个范围
    const modelSize = 10 // 模型的总大小
    const constant = (cutDepth / 100) * modelSize - modelSize / 2

    // 创建裁剪平面
    const plane = new THREE.Plane(normal, constant)
    
    return [plane]
  }, [cutDepth, cutAngle])

  // 克隆材质并应用裁剪平面
  const clippedMaterial = useMemo(() => {
    if (!materials.HZ3_Material_u1_v1) return null
    
    const material = materials.HZ3_Material_u1_v1.clone()
    material.clippingPlanes = clippingPlanes
    material.clipShadows = true
    material.needsUpdate = true
    
    // ⚠️ 关键：启用裁剪封面（显示切割截面）
    material.clippingPlanes = clippingPlanes
    material.clipShadows = true
    
    console.log('🔪 切割参数:', {
      cutDepth,
      cutAngle,
      clippingPlanesCount: clippingPlanes.length,
      hasPlane: clippingPlanes.length > 0
    })
    
    if (clippingPlanes.length > 0) {
      const plane = clippingPlanes[0]
      console.log('✂️ 裁剪平面:', {
        normal: plane.normal,
        constant: plane.constant
      })
    }
    
    return material
  }, [materials.HZ3_Material_u1_v1, clippingPlanes, cutDepth, cutAngle])

  // 切割面的材质（用于可视化切割截面）
  const cutCapMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#ff6b6b',           // 切割面颜色（红色）
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,     // 双面渲染
      transparent: false,         // 不透明，实心显示
    })
  }, [])

  // 计算切割面的几何体（用于可视化）
  const cutPlaneGeometry = useMemo(() => {
    if (cutDepth <= 0 || !showCutPlane) return null

    const angleRad = (cutAngle * Math.PI) / 180
    const modelSize = 10
    const constant = (cutDepth / 100) * modelSize - modelSize / 2
    
    // 创建一个足够大的平面来覆盖模型
    const geometry = new THREE.PlaneGeometry(modelSize * 2, modelSize * 2)
    
    // 旋转和平移平面到正确位置
    geometry.rotateY(-angleRad)
    geometry.translate(
      Math.cos(angleRad) * constant,
      0,
      Math.sin(angleRad) * constant
    )

    return geometry
  }, [cutDepth, cutAngle, showCutPlane])

  return (
    <group dispose={null}>
      {/* 主模型 - 应用裁剪 */}
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
        <mesh geometry={cutPlaneGeometry} material={cutCapMaterial} />
      )}
    </group>
  )
}

// 预加载模型
useGLTF.preload('/Hohenzollern_Castle_optimized.glb')
