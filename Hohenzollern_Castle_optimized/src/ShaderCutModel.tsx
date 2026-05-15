import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF, shaderMaterial } from '@react-three/drei'
import { GLTF } from 'three-stdlib'
import { extend, useFrame } from '@react-three/fiber'

// 自定义着色器材质 - 实现切割截面
const CutCapShaderMaterial = shaderMaterial(
  {
    cutPlaneNormal: new THREE.Vector3(1, 0, 0),
    cutPlaneConstant: 0,
    capColor: new THREE.Color('#ff6b6b'),
    showCap: true,
  },
  // Vertex Shader
  `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  // Fragment Shader
  `
    uniform vec3 cutPlaneNormal;
    uniform float cutPlaneConstant;
    uniform vec3 capColor;
    uniform bool showCap;
    
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    
    void main() {
      // 计算点到裁剪平面的距离
      float distanceToPlane = dot(vWorldPosition, cutPlaneNormal) + cutPlaneConstant;
      
      // 如果在裁剪平面的"错误"一侧，丢弃像素
      if (distanceToPlane > 0.0) {
        discard;
      }
      
      // 如果接近裁剪平面，显示截面颜色
      float threshold = 0.05;
      if (distanceToPlane > -threshold && showCap) {
        // 添加一些光照效果
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diff = max(dot(vNormal, lightDir), 0.0);
        vec3 finalColor = capColor * (0.5 + 0.5 * diff);
        gl_FragColor = vec4(finalColor, 1.0);
      } else {
        discard;
      }
    }
  `
)

extend({ CutCapShaderMaterial })

// 声明 TypeScript 类型
declare global {
  namespace JSX {
    interface IntrinsicElements {
      cutCapShaderMaterial: any
    }
  }
}

type GLTFResult = GLTF & {
  nodes: {
    HZ3: THREE.Mesh
  }
  materials: {
    HZ3_Material_u1_v1: THREE.MeshPhysicalMaterial
  }
}

interface ShaderCutModelProps {
  cutDepth: number
  cutAngle: number
  showCutPlane?: boolean
  capColor?: string
}

export function ShaderCutModel({ 
  cutDepth, 
  cutAngle, 
  showCutPlane = true,
  capColor = '#ff6b6b'
}: ShaderCutModelProps) {
  const { nodes, materials } = useGLTF('/Hohenzollern_Castle_optimized.glb') as GLTFResult

  // 计算裁剪平面参数
  const planeParams = useMemo(() => {
    if (cutDepth <= 0) return null

    const angleRad = (cutAngle * Math.PI) / 180
    const normal = new THREE.Vector3(
      Math.cos(angleRad),
      0,
      Math.sin(angleRad)
    )

    const modelSize = 10
    const constant = (cutDepth / 100) * modelSize - modelSize / 2
    
    return { normal, constant }
  }, [cutDepth, cutAngle])

  // 主材质 - 应用裁剪
  const mainMaterial = useMemo(() => {
    if (!materials.HZ3_Material_u1_v1 || !planeParams) return null

    const material = materials.HZ3_Material_u1_v1.clone()
    material.clippingPlanes = [new THREE.Plane(planeParams.normal, planeParams.constant)]
    material.clipShadows = true
    material.needsUpdate = true
    
    return material
  }, [materials.HZ3_Material_u1_v1, planeParams])

  if (!mainMaterial || !planeParams) return null

  return (
    <group dispose={null}>
      {/* 主模型 */}
      <mesh
        geometry={nodes.HZ3.geometry}
        material={mainMaterial}
        castShadow
        receiveShadow
      />

      {/* 切割截面 - 使用自定义着色器 */}
      {showCutPlane && (
        <mesh geometry={nodes.HZ3.geometry}>
          <cutCapShaderMaterial
            cutPlaneNormal={planeParams.normal}
            cutPlaneConstant={planeParams.constant}
            capColor={capColor}
            showCap={showCutPlane}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

useGLTF.preload('/Hohenzollern_Castle_optimized.glb')
