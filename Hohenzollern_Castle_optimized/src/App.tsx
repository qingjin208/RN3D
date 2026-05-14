import React, { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { Instances, Model } from './Model'

export default function App() {
  const ref = useRef<OrbitControlsType>(null!)
  return (
    <Canvas 
      shadows 
      dpr={[1, 2]} 
      camera={{ fov: 50 }}
      style={{ width: '100vw', height: '100vh' }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#101010']} />
      <Suspense fallback={<div style={{ color: 'white', textAlign: 'center', paddingTop: '50vh' }}>加载中...</div>}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <Instances>
          <Model />
        </Instances>
      </Suspense>
      <OrbitControls ref={ref} autoRotate />
    </Canvas>
  )
}