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

interface AdvancedCutModelProps {
  cutDepth: number
  cutAngle: number
  showCutPlane?: boolean
  cutColor?: string        // 切割面颜色
  animateCut?: boolean     // 是否开启动画
}

export function AdvancedCutModel({ 
  cutDepth, 
  cutAngle, 
  showCutPlane = true,
  cutColor = '#ff6b6b',
  animateCut = false
}: AdvancedCutModelProps) {
  const { nodes, materials } = useGLTF('/Hohenzollern_Castle_optimized.glb') as GLTFResult
  const meshRef = useRef<THREE.Mesh>(null)
  
  // 动画状态
  const [displayedDepth, setDisplayedDepth] = useState(cutDepth)

  // 动画效果
  useEffect(() => {
    if (!animateCut) {
      setDisplayedDepth(cutDepth)
      return
    }

    let animationId: number
    const animate = () => {
      setDisplayedDepth(prev => {
        const diff = cutDepth - prev
        if (Math.abs(diff) < 0.5) return cutDepth
        return prev + diff * 0.1
      })
      animationId = requestAnimationFrame(animate)
    }
    
    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [cutDepth, animateCut])

  // 计算裁剪平面
  const clippingPlanes = useMemo(() => {
    if (displayedDepth <= 0) return []

    const angleRad = (cutAngle * Math.PI) / 180
    const normal = new THREE.Vector3(
      Math.cos(angleRad),
      0,
      Math.sin(angleRad)
    )

    const modelSize = 10
    const constant = (displayedDepth / 100) * modelSize - modelSize / 2
    const plane = new THREE.Plane(normal, constant)
    
    return [plane]
  }, [displayedDepth, cutAngle])

  // 创建带截面的材质
  const customMaterial = useMemo(() => {
    const baseMaterial = materials.HZ3_Material_u1_v1.clone()
    
    // 启用裁剪
    baseMaterial.clippingPlanes = clippingPlanes
    baseMaterial.clipShadows = true  // 在阴影中也应用裁剪
    
    return baseMaterial
  }, [materials.HZ3_Material_u1_v1, clippingPlanes])

  // 切割面可视化
  const cutPlaneGeometry = useMemo(() => {
    if (displayedDepth <= 0 || !showCutPlane) return null

    const angleRad = (cutAngle * Math.PI) / 180
    const modelSize = 10
    const constant = (displayedDepth / 100) * modelSize - modelSize / 2
    
    const geometry = new THREE.PlaneGeometry(modelSize * 2, modelSize * 2)
    geometry.rotateY(-angleRad)
    geometry.translate(
      Math.cos(angleRad) * constant,
      0,
      Math.sin(angleRad) * constant
    )

    return geometry
  }, [displayedDepth, cutAngle, showCutPlane])

  const cutPlaneMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: cutColor,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [cutColor])

  return (
    <group dispose={null}>
      {/* 主模型 */}
      <mesh
        ref={meshRef}
        geometry={nodes.HZ3.geometry}
        material={customMaterial}
        castShadow
        receiveShadow
      />

      {/* 切割面可视化 */}
      {showCutPlane && cutPlaneGeometry && (
        <mesh geometry={cutPlaneGeometry} material={cutPlaneMaterial} />
      )}

      {/* 切割边缘高亮（可选） */}
      {displayedDepth > 0 && (
        <mesh
          geometry={nodes.HZ3.geometry}
          material={new THREE.MeshBasicMaterial({
            color: cutColor,
            wireframe: true,
            transparent: true,
            opacity: 0.1,
          })}
        />
      )}
    </group>
  )
}

useGLTF.preload('/Hohenzollern_Castle_optimized.glb')
