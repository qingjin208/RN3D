import React, { Suspense, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { PreciseDualModeModel } from './PreciseDualModeModel'

export default function CutCakeApp() {
  const ref = useRef<OrbitControlsType>(null!)
  
  // 切割参数状态
  const [cutDepth, setCutDepth] = useState<number>(30)  // 切割深度 0-100%
  const [cutAngle, setCutAngle] = useState<number>(0)   // 切割角度 0-360度
  const [showCutPlane, setShowCutPlane] = useState<boolean>(true)
  const [mode, setMode] = useState<'cutBody' | 'cutFace'>('cutFace')  // 默认切割面模式
  const [showCutBodyWireframe, setShowCutBodyWireframe] = useState<boolean>(false)
  const [pendingCutCount, setPendingCutCount] = useState<number>(3)
  const [appliedCutCount, setAppliedCutCount] = useState<number>(0)

  const clampedPendingCutCount = Math.max(0, Math.floor(Number.isFinite(pendingCutCount) ? pendingCutCount : 0))

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
            localClippingEnabled: true,  // ⚠️ 重要：启用本地裁剪
            stencil: true  // ⚠️ 关键：启用 Stencil Buffer
          }}
        >
          <color attach="background" args={['#101010']} />
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <PreciseDualModeModel 
              cutDepth={cutDepth}
              cutAngle={cutAngle}
              showCutPlane={showCutPlane}
              mode={mode}
              capColor="#ff6b6b"
              showCutBodyWireframe={showCutBodyWireframe}
              multiCutCount={appliedCutCount}
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
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}> Silo Consumption</h3>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 切割深度输入 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '14px', color: '#aaa' }}>
              Cut Depth: {cutDepth}%
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
              Cut Angle: {cutAngle}°
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
              <label style={{ fontSize: '12px', color: '#aaa' }}>Depth (%)</label>
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
              <label style={{ fontSize: '12px', color: '#aaa' }}>Angle (°)</label>
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

          {/* 模式切换按钮 */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', color: '#aaa' }}>Mode:</label>
            <button
              onClick={() => setMode('cutFace')}
              style={{
                padding: '8px 16px',
                background: mode === 'cutFace' ? '#4CAF50' : '#2a2a2a',
                border: mode === 'cutFace' ? '2px solid #4CAF50' : '1px solid #444',
                borderRadius: '6px',
                color: mode === 'cutFace' ? 'white' : '#aaa',
                fontSize: '13px',
                fontWeight: mode === 'cutFace' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Cut Face
            </button>
            <button
              onClick={() => setMode('cutBody')}
              style={{
                padding: '8px 16px',
                background: mode === 'cutBody' ? '#FF9800' : '#2a2a2a',
                border: mode === 'cutBody' ? '2px solid #FF9800' : '1px solid #444',
                borderRadius: '6px',
                color: mode === 'cutBody' ? 'white' : '#aaa',
                fontSize: '13px',
                fontWeight: mode === 'cutBody' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Cut Body
            </button>
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
              Show the cutting surface
            </label>
          </div>

          {/* Cut Body 线框开关（仅 Cut Body 模式显示） */}
          {mode === 'cutBody' && (
            <button
              onClick={() => setShowCutBodyWireframe((prev) => !prev)}
              style={{
                padding: '8px 16px',
                background: showCutBodyWireframe ? '#5C6BC0' : '#2a2a2a',
                border: showCutBodyWireframe ? '2px solid #7986CB' : '1px solid #444',
                borderRadius: '6px',
                color: showCutBodyWireframe ? 'white' : '#aaa',
                fontSize: '13px',
                fontWeight: showCutBodyWireframe ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Toggle white wireframe overlay in Cut Body mode"
            >
              {showCutBodyWireframe ? 'Hide Cut Body Wireframe' : 'Show Cut Body Wireframe'}
            </button>
          )}

          {/* 多刀切割控制 */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '12px', color: '#aaa' }}>Cuts (N)</label>
              <input
                type="number"
                min="0"
                value={pendingCutCount}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setPendingCutCount(Math.max(0, Number.isFinite(value) ? value : 0))
                }}
                style={{
                  width: '90px',
                  padding: '8px',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '14px'
                }}
              />
            </div>

            <button
              onClick={() => setAppliedCutCount(clampedPendingCutCount)}
              style={{
                padding: '8px 14px',
                background: appliedCutCount > 0 ? '#00796b' : '#2a2a2a',
                border: appliedCutCount > 0 ? '2px solid #26a69a' : '1px solid #444',
                borderRadius: '6px',
                color: appliedCutCount > 0 ? 'white' : '#aaa',
                fontSize: '13px',
                cursor: 'pointer'
              }}
              title="Apply N sequential cuts on the remaining body"
            >
              Apply N Cuts
            </button>

            {appliedCutCount > 0 && (
              <button
                onClick={() => setAppliedCutCount(0)}
                style={{
                  padding: '8px 14px',
                  background: '#f44336',
                  border: '2px solid #f44336',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#d32f2f'
                  e.currentTarget.style.borderColor = '#d32f2f'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#f44336'
                  e.currentTarget.style.borderColor = '#f44336'
                }}
                title="Cancel multi-cut and return to single cut mode"
              >
                ✕ Cancel N Cuts
              </button>
            )}
          </div>

          {/* 重置按钮 */}
          <button
            onClick={() => {
              setCutDepth(0)
              setCutAngle(0)
              setShowCutPlane(true)
              setShowCutBodyWireframe(false)
              setPendingCutCount(3)
              setAppliedCutCount(0)
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
            Reset
          </button>
        </div>

        {/* 提示信息 */}
        <div style={{ marginTop: '15px', fontSize: '12px', color: '#888' }}>
          💡 Hint: 
          • Cut Face: Shows only the cross-section (precise boundary matching model)
          • Cut Body: Shows the removed part as a red solid
          • Apply N Cuts: Splits the removed range into N sequential cuts; each cut only acts on the remaining body
          • Cancel N Cuts: Remove all applied cuts and return to single cut mode
          • The region between two neighboring knives is rendered with a different color in Cut Body mode
          • Drag sliders or enter values to adjust cutting position and angle
          • Mouse: rotate, zoom, and pan to view the model
        </div>
      </div>
    </div>
  )
}
