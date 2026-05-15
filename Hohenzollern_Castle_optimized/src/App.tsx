import React, { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import CutCakeApp from './CutCakeApp'

export default function App() {
  return <CutCakeApp />
}