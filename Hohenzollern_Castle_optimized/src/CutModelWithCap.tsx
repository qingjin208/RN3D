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

interface CutModelWithCapProps {
  cutDepth: number
  cutAngle: number
  showCutPlane?: boolean
  capColor?: string
}

export function CutModelWithCap({ 
  cutDepth, 
  cutAngle, 
  showCutPlane = true,
  capColor = '#ff6b6b'
}: CutModelWithCapProps) {
  const { nodes, materials } = useGLTF('/Hohenzollern_Castle_optimized.glb') as GLTFResult

  // 计算裁剪平面
  const clippingPlane = useMemo(() => {
    if (cutDepth <= 0) return null

    const angleRad = (cutAngle * Math.PI) / 180
    const normal = new THREE.Vector3(
      Math.cos(angleRad),
      0,
      Math.sin(angleRad)
    )

    const modelSize = 10
    const constant = (cutDepth / 100) * modelSize - modelSize / 2
    
    return new THREE.Plane(normal, constant)
  }, [cutDepth, cutAngle])

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

  // 切割截面材质 - 使用 Stencil Buffer 技术
  const capMaterial = useMemo(() => {
    if (!clippingPlane) return null

    const material = new THREE.MeshStandardMaterial({
      color: capColor,
      roughness: 0.7,
      metalness: 0.2,
      side: THREE.DoubleSide,
      
      // ⚠️ Stencil Buffer 设置 - 只在裁剪区域渲染
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
      
      // 启用裁剪
      clippingPlanes: [clippingPlane],
      clipShadows: true,
    })

    return material
  }, [clippingPlane, capColor])

  // 创建切割截面的几何体（一个足够大的平面）
  const capGeometry = useMemo(() => {
    if (!clippingPlane || cutDepth <= 0) return null

    const angleRad = (cutAngle * Math.PI) / 180
    const modelSize = 10
    const constant = (cutDepth / 100) * modelSize - modelSize / 2

    // 创建一个覆盖整个模型范围的平面
    const geometry = new THREE.PlaneGeometry(modelSize * 2, modelSize * 2)
    
    // 旋转和平移到裁剪平面的位置
    geometry.rotateY(-angleRad)
    geometry.translate(
      Math.cos(angleRad) * constant,
      0,
      Math.sin(angleRad) * constant
    )

    return geometry
  }, [clippingPlane, cutDepth, cutAngle])

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

      {/* 切割截面 - 填充空心部分 */}
      {capGeometry && capMaterial && showCutPlane && (
        <mesh
          geometry={capGeometry}
          material={capMaterial}
          renderOrder={1}  // 确保在模型之后渲染
        />
      )}

      {/* 可选：显示裁剪平面边界（半透明红色） */}
      {showCutPlane && capGeometry && (
        <mesh geometry={capGeometry}>
          <meshBasicMaterial
            color={capColor}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}

useGLTF.preload('/Hohenzollern_Castle_optimized.glb')
