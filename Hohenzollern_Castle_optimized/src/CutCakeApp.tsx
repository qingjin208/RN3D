import React, { Suspense, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { PreciseCutModel } from './PreciseCutModel'

export default function CutCakeApp() {
  const ref = useRef<OrbitControlsType>(null!)
  
  // 切割参数状态
  const [cutDepth, setCutDepth] = useState<number>(30)  // 切割深度 0-100%
  const [cutAngle, setCutAngle] = useState<number>(0)   // 切割角度 0-360度
  const [showCutPlane, setShowCutPlane] = useState<boolean>(true)

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 3D 画布 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas 
          shadows 
          dpr={[1, 2]} 
          camera={{ fov: 50, position: [0, 5, 10] }}
          gl={{ 
            antialias: true,
            localClippingEnabled: true  // ⚠️ 重要：启用本地裁剪
          }}
        >
          <color attach="background" args={['#101010']} />
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <PreciseCutModel 
              cutDepth={cutDepth}
              cutAngle={cutAngle}
              showCutPlane={showCutPlane}
              capColor="#ff6b6b"
            />
          </Suspense>
          <OrbitControls ref={ref} autoRotate={false} />
        </Canvas>
      </div>

      {/* 控制面板 */}
      <div style={{
        padding: '20px',
        background: '#1a1a1a',
        color: 'white',
        borderTop: '2px solid #333'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}> Silo消耗</h3>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 切割深度输入 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '14px', color: '#aaa' }}>
              切割深度: {cutDepth}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={cutDepth}
              onChange={(e) => setCutDepth(Number(e.target.value))}
              style={{ width: '200px', cursor: 'pointer' }}
            />
          </div>

          {/* 切割角度输入 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '14px', color: '#aaa' }}>
              切割角度: {cutAngle}°
            </label>
            <input
              type="range"
              min="0"
              max="360"
              value={cutAngle}
              onChange={(e) => setCutAngle(Number(e.target.value))}
              style={{ width: '200px', cursor: 'pointer' }}
            />
          </div>

          {/* 数字输入框 */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '12px', color: '#aaa' }}>深度 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={cutDepth}
                onChange={(e) => setCutDepth(Math.min(100, Math.max(0, Number(e.target.value))))}
                style={{
                  width: '80px',
                  padding: '8px',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '12px', color: '#aaa' }}>角度 (°)</label>
              <input
                type="number"
                min="0"
                max="360"
                value={cutAngle}
                onChange={(e) => setCutAngle(Math.min(360, Math.max(0, Number(e.target.value))))}
                style={{
                  width: '80px',
                  padding: '8px',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* 显示切割面开关 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="showPlane"
              checked={showCutPlane}
              onChange={(e) => setShowCutPlane(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="showPlane" style={{ fontSize: '14px', cursor: 'pointer' }}>
              显示切割面
            </label>
          </div>

          {/* 重置按钮 */}
          <button
            onClick={() => {
              setCutDepth(0)
              setCutAngle(0)
              setShowCutPlane(true)
            }}
            style={{
              padding: '10px 20px',
              background: '#ff6b6b',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#ff5252'}
            onMouseOut={(e) => e.currentTarget.style.background = '#ff6b6b'}
          >
            重置
          </button>
        </div>

        {/* 提示信息 */}
        <div style={{ marginTop: '15px', fontSize: '12px', color: '#888' }}>
          💡 提示：拖动滑块或直接输入数值来调整切割位置和角度。鼠标可以旋转和缩放查看模型。
        </div>
      </div>
    </div>
  )
}
