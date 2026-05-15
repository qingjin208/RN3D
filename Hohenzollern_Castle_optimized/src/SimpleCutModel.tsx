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

interface SimpleCutModelProps {
  cutDepth: number
  cutAngle: number
}

export function SimpleCutModel({ cutDepth, cutAngle }: SimpleCutModelProps) {
  const { nodes, materials } = useGLTF('/Hohenzollern_Castle_optimized.glb') as GLTFResult

  // 创建裁剪平面
  const clippingPlane = useMemo(() => {
    if (cutDepth <= 0) return null

    const angleRad = (cutAngle * Math.PI) / 180
    const normal = new THREE.Vector3(
      Math.cos(angleRad),
      0,
      Math.sin(angleRad)
    )

    // 简化：直接使用固定值测试
    const constant = (cutDepth / 100) * 10 - 5
    
    console.log('SimpleCut - Plane:', { normal, constant, cutDepth, cutAngle })
    
    return new THREE.Plane(normal, constant)
  }, [cutDepth, cutAngle])

  // 创建带裁剪的材质
  const material = useMemo(() => {
    if (!materials.HZ3_Material_u1_v1) return null

    const mat = materials.HZ3_Material_u1_v1.clone()
    
    if (clippingPlane) {
      mat.clippingPlanes = [clippingPlane]
      mat.clipShadows = true
      mat.side = THREE.DoubleSide // 尝试双面渲染
      mat.needsUpdate = true
      
      console.log('SimpleCut - Material clippingPlanes:', mat.clippingPlanes)
    } else {
      mat.clippingPlanes = []
    }
    
    return mat
  }, [materials.HZ3_Material_u1_v1, clippingPlane])

  if (!material) return null

  return (
    <mesh
      geometry={nodes.HZ3.geometry}
      material={material}
      castShadow
      receiveShadow
    />
  )
}

useGLTF.preload('/Hohenzollern_Castle_optimized.glb')
