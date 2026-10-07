import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CharacterCustomization, CharacterPose } from '../../types/character';
import { buildCharacter3D, type CharacterModelInstance } from './three/characterBuilder3d';
import { applyStudioLighting } from './three/studio';

export interface CharacterCanvas3DProps {
  customization: CharacterCustomization;
  pose?: CharacterPose;
  cameraView?: 'full' | 'portrait' | 'torso';
  autoRotate?: boolean;
  className?: string;
  showPedestal?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

const CAMERA_PRESETS: Record<'full' | 'portrait' | 'torso', { pos: [number, number, number]; target: [number, number, number] }> = {
  full: { pos: [0, 0.95, 3.0], target: [0, 0.8, 0] },
  torso: { pos: [0, 1.22, 1.75], target: [0, 1.12, 0] },
  portrait: { pos: [0, 1.43, 0.62], target: [0, 1.395, 0] },
};

export const CharacterCanvas3D: React.FC<CharacterCanvas3DProps> = ({
  customization,
  pose = 'idle',
  cameraView = 'full',
  autoRotate = false,
  className = '',
  showPedestal = true,
  interactive = true,
  onClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<CharacterModelInstance | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const poseRef = useRef<CharacterPose>(pose);
  const interactiveRef = useRef<boolean>(interactive);

  // The scene is built once on mount from these values; later changes are
  // applied by the dedicated sync effects below instead of rebuilding WebGL.
  const mountPropsRef = useRef({ customization, cameraView, autoRotate, showPedestal });

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  const targetCamPos = useRef(new THREE.Vector3(...CAMERA_PRESETS[cameraView].pos));
  const targetCamLook = useRef(new THREE.Vector3(...CAMERA_PRESETS[cameraView].target));

  // Setup Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 400;

    // 1. Scene
    const scene = new THREE.Scene();

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    cameraRef.current = camera;
    const mountProps = mountPropsRef.current;
    const initialPreset = CAMERA_PRESETS[mountProps.cameraView] || CAMERA_PRESETS.full;
    camera.position.set(...initialPreset.pos);
    targetCamPos.current.set(...initialPreset.pos);
    targetCamLook.current.set(...initialPreset.target);

    // 3. Renderer with antialiasing and tone mapping
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 4. Studio lighting rig (key, fill, two rims, dim environment).
    const studio = applyStudioLighting(scene, renderer);

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.target.set(...initialPreset.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enabled = interactiveRef.current;
    controls.autoRotate = mountProps.autoRotate;
    controls.autoRotateSpeed = 1.8;
    // Close enough for the face close-up preset.
    controls.minDistance = 0.45;
    controls.maxDistance = 5.0;
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = Math.PI / 1.8;

    // 6. Build Character Instance
    const charInstance = buildCharacter3D(mountProps.customization, { showPedestal: mountProps.showPedestal, showShadow: true });
    characterRef.current = charInstance;
    scene.add(charInstance.root);

    // Visibility / Intersection observation to pause loop when off-screen
    let isIntersecting = true;
    const io = new IntersectionObserver(([entry]) => {
      isIntersecting = entry.isIntersecting;
    });
    io.observe(container);

    let lastTime = performance.now();
    const onVisibilityChange = () => {
      if (document.hidden) {
        lastTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Animation Render Loop
    let animId = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!isIntersecting || document.hidden) {
        lastTime = performance.now();
        return;
      }

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Smooth camera preset transitions (~0.4s lerp)
      if (
        camera.position.distanceToSquared(targetCamPos.current) > 0.00005 ||
        controls.target.distanceToSquared(targetCamLook.current) > 0.00005
      ) {
        const lerpFactor = 1 - Math.exp(-8 * dt);
        camera.position.lerp(targetCamPos.current, lerpFactor);
        controls.target.lerp(targetCamLook.current, lerpFactor);
      }

      controls.update();
      charInstance.update(dt, poseRef.current);
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resizeObserver.disconnect();
      controls.dispose();
      charInstance.dispose();
      studio.dispose();
      renderer.dispose();
      container.replaceChildren();
      characterRef.current = null;
      controlsRef.current = null;
    };
  }, []); // Run once on mount; props update via separate effects

  // Synchronize dynamic character customizations
  useEffect(() => {
    if (characterRef.current) {
      characterRef.current.updateCustomization(customization);
    }
  }, [customization]);

  // Synchronize camera view preset
  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraView] || CAMERA_PRESETS.full;
    targetCamPos.current.set(...preset.pos);
    targetCamLook.current.set(...preset.target);
  }, [cameraView]);

  // Synchronize controls enabled
  useEffect(() => {
    interactiveRef.current = interactive;
    if (controlsRef.current) {
      controlsRef.current.enabled = interactive;
    }
  }, [interactive]);

  // Synchronize auto rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative w-full h-full min-h-[300px] overflow-hidden select-none ${className}`}
    />
  );
};
