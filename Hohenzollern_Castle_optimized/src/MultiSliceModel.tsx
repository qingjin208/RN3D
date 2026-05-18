import React, { useMemo } from 'react'
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

interface SliceInfo {
  index: number
  clippingPlane: THREE.Plane
  offset: number
}

interface MultiSliceModelProps {
  numCuts: number          // 切割数量 n
  cutAngle: number         // 切割角度 0-360度
  sliceSpacing: number     // 切片间距
  showCutFaces?: boolean   // 是否显示切割面
  capColor?: string        // 切割面颜色
}

export function MultiSliceModel({ 
  numCuts, 
  cutAngle, 
  sliceSpacing = 0,
  showCutFaces = true,
  capColor = '#ff6b6b'
}: MultiSliceModelProps) {
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

  // 计算所有切割平面和切片信息
  const slicesInfo = useMemo(() => {
    if (!modelBounds || numCuts <= 0) return []

    const angleRad = (cutAngle * Math.PI) / 180
    const normal = new THREE.Vector3(
      Math.cos(angleRad),
      0,
      Math.sin(angleRad)
    )

    const box = modelBounds.box
    
    // 计算模型在切割方向上的范围
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
    const totalSpacing = numCuts * sliceSpacing
    const availableRange = range - totalSpacing
    
    if (availableRange <= 0) {
      console.warn('⚠️ 间距太大，无法容纳所有切片')
      return []
    }

    // 计算每个切片的起始和结束位置
    const slices: SliceInfo[] = []
    const segmentSize = availableRange / (numCuts + 1)
    
    for (let i = 0; i <= numCuts; i++) {
      // 第 i 个切片的起始位置（左侧边界）
      const startPos = minDist + i * segmentSize + i * sliceSpacing
      
      // 第 i 个切片的结束位置（右侧边界，即下一个切割平面）
      const endPos = i < numCuts 
        ? minDist + (i + 1) * segmentSize + i * sliceSpacing
        : maxDist

      // 创建两个裁剪平面来定义这个切片
      const leftPlane = new THREE.Plane(normal.clone(), -startPos)
      const rightPlane = new THREE.Plane(normal.clone().negate(), endPos)

      slices.push({
        index: i,
        clippingPlane: leftPlane,
        offset: startPos
      })
    }

    console.log('📐 多刀切割信息:', {
      numCuts,
      numSlices: slices.length,
      angle: cutAngle,
      sliceSpacing,
      range,
      segmentSize,
      totalSpacing
    })

    return slices
  }, [numCuts, cutAngle, sliceSpacing, modelBounds])

  // 为每个切片创建材质
  const sliceMaterials = useMemo(() => {
    if (!materials.HZ3_Material_u1_v1 || slicesInfo.length === 0) return []

    return slicesInfo.map((slice, idx) => {
      const material = materials.HZ3_Material_u1_v1.clone()
      
      // 每个切片需要两个裁剪平面：左边界和右边界
      const nextSlice = slicesInfo[idx + 1]
      
      if (nextSlice) {
        // 中间切片：左右都有边界
        const rightPlane = new THREE.Plane(
          slice.clippingPlane.normal.clone().negate(),
          -nextSlice.offset
        )
        material.clippingPlanes = [slice.clippingPlane, rightPlane]
      } else {
        // 最后一个切片：只有左边界
        material.clippingPlanes = [slice.clippingPlane]
      }
      
      material.clipShadows = true
      material.needsUpdate = true
      
      return material
    })
  }, [materials.HZ3_Material_u1_v1, slicesInfo])

  // 为每个切割面创建 Cut Face 模式的几何体和材质
  const cutFaceGeometries = useMemo(() => {
    if (!showCutFaces || slicesInfo.length === 0 || !modelBounds) return []

    return slicesInfo.slice(0, -1).map((slice, idx) => {
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
        slice.clippingPlane.normal
      )
      geometry.applyQuaternion(quaternion)

      const position = slice.clippingPlane.normal.clone().multiplyScalar(-slice.clippingPlane.constant)
      geometry.translate(position.x, position.y, position.z)

      return geometry
    })
  }, [showCutFaces, slicesInfo, modelBounds])

  // 创建 Cut Face 模式的 stencil 材质
  const cutFaceMaterials = useMemo(() => {
    if (!showCutFaces || slicesInfo.length === 0) return []

    return slicesInfo.slice(0, -1).map(() => {
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
    })
  }, [showCutFaces, capColor, slicesInfo])

  // Stencil back materials for precise boundary
  const stencilBackMaterials = useMemo(() => {
    if (!showCutFaces || slicesInfo.length === 0) return []

    return slicesInfo.slice(0, -1).map((slice) => {
      const material = new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        clippingPlanes: [slice.clippingPlane],
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
    })
  }, [showCutFaces, slicesInfo])

  // Stencil front materials for precise boundary
  const stencilFrontMaterials = useMemo(() => {
    if (!showCutFaces || slicesInfo.length === 0) return []

    return slicesInfo.slice(0, -1).map((slice) => {
      const material = new THREE.MeshBasicMaterial({
        side: THREE.FrontSide,
        clippingPlanes: [slice.clippingPlane],
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
    })
  }, [showCutFaces, slicesInfo])

  if (slicesInfo.length === 0 || sliceMaterials.length === 0) return null

  return (
    <group dispose={null}>
      {/* 渲染所有切片 */}
      {slicesInfo.map((slice, idx) => (
        <mesh
          key={`slice-${idx}`}
          geometry={nodes.HZ3.geometry}
          material={sliceMaterials[idx]}
          castShadow
          receiveShadow
        />
      ))}

      {/* 渲染所有切割面（Cut Face 模式） */}
      {showCutFaces && cutFaceGeometries.map((geometry, idx) => (
        <React.Fragment key={`cutface-${idx}`}>
          {/* Stencil back pass */}
          <mesh
            geometry={nodes.HZ3.geometry}
            material={stencilBackMaterials[idx]}
            renderOrder={1}
          />

          {/* Stencil front pass */}
          <mesh
            geometry={nodes.HZ3.geometry}
            material={stencilFrontMaterials[idx]}
            renderOrder={2}
          />

          {/* Cap surface */}
          <mesh
            geometry={geometry}
            material={cutFaceMaterials[idx]}
            renderOrder={3}
            onAfterRender={(renderer: THREE.WebGLRenderer) => {
              renderer.clearStencil()
            }}
          />
        </React.Fragment>
      ))}
    </group>
  )
}

useGLTF.preload('/Hohenzollern_Castle_optimized.glb')
