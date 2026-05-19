import type { CSSProperties } from 'react'

export type RN3DMode = 'cutFace' | 'cutBody'
export type FaceNCutsView = 'faceOnly' | 'bodyOnly' | 'both'

export interface RN3DElementProps {
  modelUrl?: string

  mode?: RN3DMode
  cutDepth?: number
  cutAngle?: number
  cutN?: number

  showCuttingSurface?: boolean
  cutFaceMaskColor?: string
  cutBodyMaskColor?: string
  showCutBodyWireframe?: boolean

  faceNCutsView?: FaceNCutsView
  modelOpacityForFaceOrBoth?: number
  overlayOpacityForBodyOrBoth?: number

  cutBodyDepthOpacity?: number
  cutBodyNCutsOpacity?: number

  orientation?: number
  canRotate?: boolean
  canDrag?: boolean
  autoRotate?: boolean

  className?: string
  style?: CSSProperties
}

