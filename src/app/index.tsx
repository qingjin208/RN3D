import { OrbitControls, useAnimations, useGLTF } from '@react-three/drei/native';
import { Canvas, useThree } from '@react-three/fiber/native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box3, Group, Material, Mesh, Object3D, Texture, Vector3 } from 'three';
import { MTLLoader, OBJLoader } from 'three-stdlib';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MODEL_OPTIONS } from '../constants/model-options';

// --- Disposal helper ---------------------------------------------------------
// Recursively frees GPU memory (geometry buffers, material uniforms, texture
// VRAM) for an entire Object3D subtree. Call this whenever a loaded model is
// no longer needed so the GPU allocations are returned to the OS.
function disposeObject3D(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat: Material) => {
      if (!mat) return;
      Object.values(mat as unknown as Record<string, unknown>).forEach((value) => {
        if (value instanceof Texture) value.dispose();
      });
      mat.dispose();
    });
  });
}

// --- GLB model component -----------------------------------------------------

function GlbModel({
  modelUri,
  onLoaded,
}: {
  modelUri: string;
  onLoaded: () => void;
}) {
  const gltf = useGLTF(modelUri);
  const scene = gltf.scene;
  const groupRef = useRef<Object3D>(null);
  const { actions } = useAnimations(gltf.animations, groupRef);
  const { invalidate } = useThree();

  useEffect(() => {
    const actionList = Object.values(actions || {});
    actionList.forEach((action) => action?.reset().fadeIn(0.2).play());
    onLoaded();
    invalidate();
    return () => {
      actionList.forEach((action) => action?.stop());
    };
  }, [actions, onLoaded, invalidate]);

  // When this component unmounts (model switch), free GPU resources and remove
  // the URL from drei's loader cache so the stale entry doesn't linger.
  useEffect(() => {
    return () => {
      useGLTF.clear(modelUri);
      disposeObject3D(scene);
    };
  }, [scene, modelUri]);

  const { scale, position } = useMemo(() => {
    const bounds = new Box3().setFromObject(scene);
    const size = new Vector3();
    bounds.getSize(size);
    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    const normalizedScale = 2.5 / maxSize;
    const center = new Vector3();
    bounds.getCenter(center);

    return {
      scale: normalizedScale,
      position: [
        -center.x * normalizedScale,
        -center.y * normalizedScale,
        -center.z * normalizedScale,
      ] as [number, number, number],
    };
  }, [scene]);

  return (
    <group ref={groupRef} scale={scale} position={position}>
      <primitive object={scene as Group} />
    </group>
  );
}

// --- OBJ model component -----------------------------------------------------

function ObjModel({
  modelUri,
  mtlUri,
  onLoaded,
  onError,
  onProgress,
}: {
  modelUri: string;
  mtlUri: string | null;
  onLoaded: () => void;
  onError: (message: string) => void;
  onProgress: (pct: number) => void;
}) {
  const [object, setObject] = useState<Group | null>(null);
  const { invalidate } = useThree();

  useEffect(() => {
    let active = true;

    async function loadObj() {
      // Defer heavy parsing until pending UI interactions (e.g. dropdown close
      // animation) have finished. This prevents the JS thread from being
      // locked while React is still committing layout work.
      await new Promise<void>((resolve) =>
        InteractionManager.runAfterInteractions(() => resolve())
      );

      try {
        onProgress(5);
        let materials: unknown;
        if (mtlUri) {
          const mtlLoader = new MTLLoader();
          mtlLoader.setResourcePath(uriJoin(mtlUri, ''));
          materials = await mtlLoader.loadAsync(mtlUri);
          onProgress(20);
        }

        const objLoader = new OBJLoader();
        if (materials) {
          objLoader.setMaterials(materials as never);
        }

        const object3D = await objLoader.loadAsync(modelUri, (event) => {
          if (event.lengthComputable) {
            const pct = 20 + Math.round((event.loaded / event.total) * 75);
            onProgress(Math.min(pct, 95));
          }
        });

        object3D.traverse((node) => {
          const mesh = node as { isMesh?: boolean; geometry?: unknown };
          if (!mesh.isMesh || !mesh.geometry) return;
          const geometry = mesh.geometry as { attributes?: Record<string, unknown> };
          if (!geometry.attributes?.normal) {
            const cast = mesh.geometry as { computeVertexNormals?: () => void };
            cast.computeVertexNormals?.();
          }
        });

        if (!active) return;
        setObject(object3D as Group);
        onLoaded();
        onProgress(100);
        invalidate();
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : String(error);
        onError(message);
      }
    }

    setObject(null);
    loadObj();

    return () => {
      active = false;
    };
  }, [modelUri, mtlUri, onLoaded, onError, onProgress, invalidate]);

  // Dispose previous object GPU resources when object changes or unmounts.
  useEffect(() => {
    return () => {
      if (object) disposeObject3D(object);
    };
  }, [object]);

  const { scale, position } = useMemo(() => {
    if (!object) {
      return { scale: 1, position: [0, 0, 0] as [number, number, number] };
    }

    const bounds = new Box3().setFromObject(object);
    const size = new Vector3();
    bounds.getSize(size);
    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    const normalizedScale = 2.5 / maxSize;
    const center = new Vector3();
    bounds.getCenter(center);

    return {
      scale: normalizedScale,
      position: [
        -center.x * normalizedScale,
        -center.y * normalizedScale,
        -center.z * normalizedScale,
      ] as [number, number, number],
    };
  }, [object]);

  if (!object) return null;

  return (
    <group scale={scale} position={position}>
      <primitive object={object} />
    </group>
  );
}

// --- Model router ------------------------------------------------------------

function ModelNode({
  modelUri,
  mtlUri,
  onLoaded,
  onError,
  onProgress,
}: {
  modelUri: string;
  mtlUri: string | null;
  onLoaded: () => void;
  onError: (message: string) => void;
  onProgress: (pct: number) => void;
}) {
  const ext = getFileExt(modelUri);

  if (ext === 'glb') {
    // key forces a full remount when the URI changes, triggering disposal of
    // the previous GLB before the new one is loaded.
    return <GlbModel key={modelUri} modelUri={modelUri} onLoaded={onLoaded} />;
  }

  if (ext === 'obj') {
    return (
      <ObjModel
        key={modelUri}
        modelUri={modelUri}
        mtlUri={mtlUri}
        onLoaded={onLoaded}
        onError={onError}
        onProgress={onProgress}
      />
    );
  }

  onError(`Unsupported model format: .${ext || 'unknown'}. Expected .obj or .glb`);
  return null;
}

// --- Canvas viewer -----------------------------------------------------------

// Cap device pixel ratio at 2x. Phones with 3x or 3.5x DPR would otherwise
// multiply GPU fill rate and VRAM usage with no visible benefit.
const DEVICE_DPR = Math.min(PixelRatio.get(), 2);

function NativeModelViewer({
  modelUri,
  mtlUri,
  onLoaded,
  onError,
  onProgress,
}: {
  modelUri: string;
  mtlUri: string | null;
  onLoaded: () => void;
  onError: (message: string) => void;
  onProgress: (pct: number) => void;
}) {
  return (
    <View style={styles.viewer}>
      <Canvas
        camera={{ position: [0, 1.5, 5], fov: 45 }}
        style={styles.canvas}
        frameloop="demand"
        gl={{
          powerPreference: 'high-performance',
          antialias: DEVICE_DPR < 2,
        }}>
        <color attach="background" args={['#1f2024']} />
        <ambientLight intensity={1.2} />
        <hemisphereLight intensity={0.5} groundColor="#1d1d1d" />
        <directionalLight position={[5, 10, 5]} intensity={1.2} />
        <Suspense fallback={null}>
          <ModelNode
            modelUri={modelUri}
            mtlUri={mtlUri}
            onLoaded={onLoaded}
            onError={onError}
            onProgress={onProgress}
          />
        </Suspense>
        <OrbitControls
          enablePan
          enableRotate
          enableZoom
          minDistance={1.5}
          maxDistance={20}
          target={[0, 0, 0]}
        />
      </Canvas>
    </View>
  );
}

// --- Helpers -----------------------------------------------------------------

function getFileExt(uri: string) {
  const cleanUri = uri.split('?')[0].split('#')[0];
  const parts = cleanUri.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1]?.toLowerCase() ?? '';
}

function uriJoin(baseUri: string, nextName: string) {
  const normalized = baseUri.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  if (index < 0) return nextName;
  return `${normalized.slice(0, index + 1)}${nextName}`;
}

async function getModelFileSize(uri: string | null) {
  if (!uri) return null;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === 'number' ? info.size : null;
}

// --- Home screen -------------------------------------------------------------

export default function HomeScreen() {
  const [selectedModelId, setSelectedModelId] = useState<string>(MODEL_OPTIONS[0]?.id ?? '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [modelSizeBytes, setModelSizeBytes] = useState<number | null>(null);

  const selectedOption =
    MODEL_OPTIONS.find((o) => o.id === selectedModelId) ?? MODEL_OPTIONS[0] ?? null;

  // Lazy asset resolution: load only the selected model, not all models at
  // startup. This is the primary fix for large-model OOM crashes.
  const [sourceModelUri, setSourceModelUri] = useState<string | null>(null);
  const [sourceMtlUri, setSourceMtlUri] = useState<string | null>(null);
  const [assetLoading, setAssetLoading] = useState(true);

  useEffect(() => {
    if (!selectedOption) return;
    let active = true;

    setSourceModelUri(null);
    setSourceMtlUri(null);
    setAssetLoading(true);
    setModelLoaded(false);
    setModelError(null);
    setLoadProgress(0);

    async function resolveAsset() {
      try {
        const modelAsset = Asset.fromModule(selectedOption.modelModule);
        await modelAsset.downloadAsync();
        if (!active) return;
        setSourceModelUri(modelAsset.localUri ?? modelAsset.uri ?? null);

        if (selectedOption.mtlModule) {
          const mtlAsset = Asset.fromModule(selectedOption.mtlModule);
          await mtlAsset.downloadAsync();
          if (!active) return;
          setSourceMtlUri(mtlAsset.localUri ?? mtlAsset.uri ?? null);
        } else {
          setSourceMtlUri(null);
        }
      } catch (err) {
        if (!active) return;
        setModelError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setAssetLoading(false);
      }
    }

    resolveAsset();
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOption?.id]);

  const selectedExt = sourceModelUri ? getFileExt(sourceModelUri) : '';

  useEffect(() => {
    let active = true;
    async function updateSize() {
      const size = await getModelFileSize(sourceModelUri);
      if (!active) return;
      setModelSizeBytes(size);
    }
    updateSize();
    return () => {
      active = false;
    };
  }, [sourceModelUri]);

  const handleProgress = useCallback((pct: number) => setLoadProgress(pct), []);
  const handleLoaded = useCallback(() => setModelLoaded(true), []);
  const handleError = useCallback((message: string) => setModelError(message), []);

  if (Platform.OS === 'web') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="title">3D Viewer</ThemedText>
          <ThemedText type="small" style={styles.tipText}>
            This page is configured for Expo React Native runtime. Open on iOS/Android to interact
            with local OBJ or GLB models.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Local OBJ/GLB Viewer
        </ThemedText>
        <ThemedText type="small" style={styles.tipText}>
          One finger drag to rotate, two fingers to zoom and pan. OBJ and GLB render directly.
        </ThemedText>

        {modelSizeBytes !== null && modelSizeBytes > 40 * 1024 * 1024 && (
          <View style={styles.warningBox}>
            <ThemedText type="smallBold">Large model warning</ThemedText>
            <ThemedText type="small">
              {selectedOption?.label} is about {(modelSizeBytes / 1024 / 1024).toFixed(2)} MB.
              This may exceed mobile memory on some devices and cause the app to exit.
            </ThemedText>
          </View>
        )}

        <View style={styles.selectorWrap}>
          <ThemedText type="small">Model</ThemedText>
          <Pressable
            onPress={() => setIsDropdownOpen((prev) => !prev)}
            style={styles.selectorButton}>
            <ThemedText type="smallBold" style={{ color: 'blue' }}>
              {selectedOption?.label ?? 'Select a model'}
            </ThemedText>
          </Pressable>

          {isDropdownOpen && (
            <View style={styles.dropdownList}>
              {MODEL_OPTIONS.map((option) => {
                const isActive = option.id === selectedOption?.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setSelectedModelId(option.id);
                      setIsDropdownOpen(false);
                    }}
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}>
                    <ThemedText type="small" style={{ color: 'white' }}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {assetLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" />
            <ThemedText type="small">Preparing local model asset...</ThemedText>
          </View>
        )}

        {!!sourceModelUri && !modelLoaded && !modelError && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" />
            <ThemedText type="small">
              {selectedExt === 'obj' ? 'Loading OBJ model...' : 'Loading GLB model...'}
            </ThemedText>
          </View>
        )}

        {!!modelError && (
          <View style={styles.loadingWrap}>
            <ThemedText type="small">Model load failed: {modelError}</ThemedText>
          </View>
        )}

        {!!sourceModelUri && !modelError && (
          <>
            {!modelLoaded && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" />
                <ThemedText type="small">
                  {loadProgress > 0 ? `Loading... ${loadProgress}%` : 'Rendering model...'}
                </ThemedText>
                {loadProgress > 0 && (
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${loadProgress}%` as unknown as number },
                      ]}
                    />
                  </View>
                )}
              </View>
            )}
            <NativeModelViewer
              modelUri={sourceModelUri}
              mtlUri={sourceMtlUri}
              onLoaded={handleLoaded}
              onError={handleError}
              onProgress={handleProgress}
            />
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  selectorWrap: {
    gap: 6,
    zIndex: 20,
  },
  warningBox: {
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 179, 71, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 179, 71, 0.45)',
  },
  selectorButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dropdownList: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: '#1f2024',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  tipText: {
    textAlign: 'center',
  },
  viewer: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 320,
  },
  canvas: {
    flex: 1,
  },
  loadingWrap: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    top: 110,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 14,
  },
  progressBarBg: {
    width: '70%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#4a9eff',
  },
});