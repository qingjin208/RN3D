import { RN3DElement } from '../../Element/RN3DElement'
import './App.css'

function App() {
  return (
    <main className="page">
      <h1 className="title">RN3D Element Demo</h1>
      <div className="frame">
        <RN3DElement
          modelUrl="/Hohenzollern_Castle_optimized.glb"
          mode="cutBody"
          cutDepth={35}
          cutAngle={0}
          cutN={3}
          showCuttingSurface={true}
          cutFaceMaskColor="#ff4d4f"
          cutBodyMaskColor="#ffffff"
          showCutBodyWireframe={false}
          faceNCutsView="both"
          modelOpacityForFaceOrBoth={0.65}
          overlayOpacityForBodyOrBoth={0.65}
          cutBodyDepthOpacity={0.7}
          cutBodyNCutsOpacity={0.65}
          orientation={4}
          canRotate={true}
          canDrag={true}
          autoRotate={false}
        />
      </div>
    </main>
  )
}

export default App
