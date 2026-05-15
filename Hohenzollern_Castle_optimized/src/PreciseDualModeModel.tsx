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

interface PreciseDualModeModelProps {
  cutDepth: number
  cutAngle: number
  showCutPlane?: boolean
  mode: 'cutBody' | 'cutFace'
  capColor?: string
}

export function PreciseDualModeModel({ 
  cutDepth, 
  cutAngle, 
  showCutPlane = true,
  mode = 'cutFace',
  capColor = '#ff6b6b'
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

  // 裁剪平面计算
  const clippingPlane = useMemo(() => {
    if (cutDepth < 0 || cutDepth > 100 || !modelBounds) return null
    
    // 深度为 0 时不切割，返回 null
    if (cutDepth === 0) return null
    
    // ⚠️ 关键：深度为 100 时，将平面移到模型之外，确保完全不显示
    if (cutDepth === 100) {
      const angleRad = (cutAngle * Math.PI) / 180
      const normal = new THREE.Vector3(
        Math.cos(angleRad),
        0,
        Math.sin(angleRad)
      )
      
      const box = modelBounds.box
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
      
      let maxDist = -Infinity
      corners.forEach(corner => {
        const dist = corner.dot(normal)
        maxDist = Math.max(maxDist, dist)
      })
      
      // 将平面移到模型外面一点点，确保完全裁剪
      const planeDist = maxDist + 0.01
      const constant = -planeDist
      
      console.log('✂️ 裁剪平面 (100%):', { 
        mode,
        cutDepth,
        normal: normal.toArray(), 
        constant,
        description: '完全切掉'
      })
      
      return new THREE.Plane(normal, constant)
    }

    const angleRad = (cutAngle * Math.PI) / 180
    
    const normal = new THREE.Vector3(
      Math.cos(angleRad),
      0,
      Math.sin(angleRad)
    )

    const box = modelBounds.box
    
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
      planeDist,
      minDist,
      maxDist,
      description: cutDepth === 0 ? '不切割' : cutDepth === 100 ? '全切' : `切掉${cutDepth}%`
    })
    
    return new THREE.Plane(normal, constant)
  }, [cutDepth, cutAngle, modelBounds])

  // 主材质 - 始终应用裁剪
  const mainMaterial = useMemo(() => {
    if (!materials.HZ3_Material_u1_v1) return null

    const material = materials.HZ3_Material_u1_v1.clone()
    
    // ⚠️ 关键：深度 100% 时也要应用裁剪（完全切掉）
    if (clippingPlane && cutDepth > 0) {
      material.clippingPlanes = [clippingPlane]
      material.clipShadows = true
      material.needsUpdate = true
    }
    
    return material
  }, [materials.HZ3_Material_u1_v1, clippingPlane, cutDepth])

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
    material.opacity = 0.9
    material.clippingPlanes = [reversePlane]
    material.clipShadows = true

    // 轻微冷色发光，保留原本纹理与颜色层次
    material.emissive = new THREE.Color('#6fb7ff')
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

    const sectionColor = materials.HZ3_Material_u1_v1.color.clone().lerp(new THREE.Color('#ffffff'), 0.25)

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

      {/* 模式1: Cut Body - 显示被切掉的部分 + 截面填充 */}
      {mode === 'cutBody' && cutBodyMaterial && cutBodyCapMaterial && showCutSection && (
        <>
          {/* 被切掉的部分（原材质 + 轻微高亮） */}
          <mesh
            geometry={nodes.HZ3.geometry}
            material={cutBodyMaterial}
            renderOrder={1}
          />
          
          {/* 线框叠加 - 增强形状识别 */}
          <mesh
            geometry={nodes.HZ3.geometry}
            renderOrder={2}
          >
            <meshBasicMaterial
              color="#ffffff"
              wireframe={true}
              transparent={true}
              opacity={0.3}
              clippingPlanes={[new THREE.Plane(
                clippingPlane!.normal.clone().negate(),
                -clippingPlane!.constant
              )]}
            />
          </mesh>
          
          {/* 截面填充（原色提亮） */}
          <mesh
            geometry={nodes.HZ3.geometry}
            material={cutBodyCapMaterial}
            renderOrder={3}
          />
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
