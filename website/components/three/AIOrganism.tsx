"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  PointsMaterial,
} from "three";

type AIOrganismProps = {
  particleCount: number;
};

function seededValue(index: number, offset: number) {
  const value = Math.sin(index * 12.9898 + offset * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function createParticleData(particleCount: number) {
  const connectionCount = Math.floor(particleCount / 2);
  const basePositions = new Float32Array(particleCount * 3);
  const phases = new Float32Array(particleCount);
  const pointPositions = new Float32Array(particleCount * 3);
  const linePositions = new Float32Array(connectionCount * 6);

  for (let index = 0; index < particleCount; index += 1) {
    const angle = seededValue(index, 1) * Math.PI * 2;
    const radius = 0.8 + seededValue(index, 2) * 2.1;
    const positionIndex = index * 3;

    basePositions[positionIndex] = Math.cos(angle) * radius;
    basePositions[positionIndex + 1] = Math.sin(angle) * radius * 0.72;
    basePositions[positionIndex + 2] =
      (seededValue(index, 3) - 0.5) * 0.35;
    phases[index] = seededValue(index, 4) * Math.PI * 2;
  }

  pointPositions.set(basePositions);

  return {
    basePositions,
    phases,
    pointPositions,
    linePositions,
  };
}

export function AIOrganism({ particleCount }: AIOrganismProps) {
  const groupRef = useRef<Group>(null);
  const pointGeometryRef = useRef<BufferGeometry>(null);
  const lineGeometryRef = useRef<BufferGeometry>(null);
  const pointAttributeRef = useRef<BufferAttribute>(null);
  const lineAttributeRef = useRef<BufferAttribute>(null);
  const pointMaterialRef = useRef<PointsMaterial>(null);
  const lineMaterialRef = useRef<LineBasicMaterial>(null);
  const connectionCount = Math.floor(particleCount / 2);
  const particleData = useMemo(
    () => createParticleData(particleCount),
    [particleCount],
  );

  useEffect(() => {
    const pointMaterial = pointMaterialRef.current;
    const lineMaterial = lineMaterialRef.current;
    if (!pointMaterial || !lineMaterial) return;

    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent")
      .trim();

    if (accentColor) {
      pointMaterial.color.set(accentColor);
      lineMaterial.color.set(accentColor);
      pointMaterial.opacity = 0.42;
      lineMaterial.opacity = 0.12;
      pointMaterial.needsUpdate = true;
      lineMaterial.needsUpdate = true;
    }
  }, []);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const pointAttribute = pointAttributeRef.current;
    const lineAttribute = lineAttributeRef.current;
    if (!group || !pointAttribute || !lineAttribute) return;

    group.rotation.z += delta * 0.025;

    const elapsedTime = clock.elapsedTime;
    const pointPositions = pointAttribute.array;
    const linePositions = lineAttribute.array;

    for (let index = 0; index < particleCount; index += 1) {
      const positionIndex = index * 3;
      const phase = particleData.phases[index] ?? 0;

      pointPositions[positionIndex] =
        (particleData.basePositions[positionIndex] ?? 0) +
        Math.sin(elapsedTime * 0.32 + phase) * 0.045;
      pointPositions[positionIndex + 1] =
        (particleData.basePositions[positionIndex + 1] ?? 0) +
        Math.cos(elapsedTime * 0.27 + phase) * 0.04;
      pointPositions[positionIndex + 2] =
        particleData.basePositions[positionIndex + 2] ?? 0;
    }

    for (let index = 0; index < connectionCount; index += 1) {
      const source = index * 2;
      const target = (source * 7 + 11) % particleCount;
      const sourcePosition = source * 3;
      const targetPosition = target * 3;
      const linePosition = index * 6;

      linePositions[linePosition] = pointPositions[sourcePosition] ?? 0;
      linePositions[linePosition + 1] = pointPositions[sourcePosition + 1] ?? 0;
      linePositions[linePosition + 2] = pointPositions[sourcePosition + 2] ?? 0;
      linePositions[linePosition + 3] = pointPositions[targetPosition] ?? 0;
      linePositions[linePosition + 4] = pointPositions[targetPosition + 1] ?? 0;
      linePositions[linePosition + 5] = pointPositions[targetPosition + 2] ?? 0;
    }

    pointAttribute.needsUpdate = true;
    lineAttribute.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry ref={pointGeometryRef}>
          <bufferAttribute
            ref={pointAttributeRef}
            attach="attributes-position"
            args={[particleData.pointPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={pointMaterialRef}
          depthWrite={false}
          opacity={0}
          size={0.055}
          sizeAttenuation
          transparent
        />
      </points>
      <lineSegments>
        <bufferGeometry ref={lineGeometryRef}>
          <bufferAttribute
            ref={lineAttributeRef}
            attach="attributes-position"
            args={[particleData.linePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={lineMaterialRef}
          depthWrite={false}
          opacity={0}
          transparent
        />
      </lineSegments>
    </group>
  );
}
