"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, RoundedBox, Sky } from "@react-three/drei";
import type { Group, Mesh } from "three";
import { CatmullRomCurve3, Vector3 } from "three";
import { formatDate, normalizeOwnerKey, parseDateInput } from "@/lib/format";
import { DisplayText } from "@/components/ui";
import { calendarDaysBetween, STATUS_LABELS } from "@/lib/timeline/schedule";
import {
  addCalendarDays,
  isWorkdayAt,
  type WorkdayLookup,
} from "@/lib/timeline/workdays";
import type { ScheduledBlock } from "@/lib/timeline/types";

interface Props {
  blocks: ScheduledBlock[];
  rangeStart: string;
  rangeEnd: string;
  lookup: WorkdayLookup;
  selectedBlockId: string | null;
  highlightProjectId: string | null;
  onSelectBlock: (block: ScheduledBlock) => void;
}

const DAY_UNIT = 0.42;
const ROAD_WIDTH = 1.35;
const SHOULDER_WIDTH = 0.55;
const MIN_VEHICLE_WIDTH = 0.72;
const VEHICLE_HEIGHT = 0.26;
const VEHICLE_DEPTH = 0.44;

interface RoadDay {
  date: string;
  t: number;
  x: number;
  y: number;
  z: number;
  nonWork: boolean;
  showLabel: boolean;
  hasDelay: boolean;
}

interface RoadBlockLayout {
  block: ScheduledBlock;
  x: number;
  y: number;
  z: number;
  width: number;
  rotationY: number;
  progressRatio: number;
  stack: number;
  isSelected: boolean;
  isHighlighted: boolean;
}

interface RoadLayout {
  totalDays: number;
  totalWidth: number;
  curve: CatmullRomCurve3;
  days: RoadDay[];
  vehicles: RoadBlockLayout[];
  incidents: RoadBlockLayout[];
  priorityTs: number[];
  focus: RoadBlockLayout | null;
}

function disableRaycast() {
  return null;
}

function roadYAtT(t: number): number {
  return t * 1.35 + Math.sin(t * Math.PI * 1.8) * 0.22;
}

function roadZAtT(t: number): number {
  return Math.sin(t * Math.PI * 1.15) * 1.6 - t * 0.35;
}

function buildRoadCurve(totalDays: number, totalWidth: number): CatmullRomCurve3 {
  const segments = Math.max(24, Math.min(80, totalDays * 2));
  const points = Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const x = -totalWidth / 2 + t * totalWidth;
    return new Vector3(x, roadYAtT(t), roadZAtT(t));
  });
  return new CatmullRomCurve3(points);
}

function sampleRoad(curve: CatmullRomCurve3, t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  const point = curve.getPointAt(clamped);
  const tangent = curve.getTangentAt(clamped).normalize();
  const rotationY = Math.atan2(tangent.x, tangent.z);
  return { point, tangent, rotationY };
}

function offsetToT(offset: number, totalDays: number): number {
  if (totalDays <= 1) return 0;
  return Math.min(1, Math.max(0, offset / totalDays));
}

function statusColor(block: ScheduledBlock): string {
  if (block.kind === "incident") return "#7c3aed";
  if (block.status === "in_progress") return "#15803d";
  if (block.isFrozen) return "#64748b";
  if (block.isDelayed) return "#b91c1c";
  if (block.isPriorityInsert) return "#ea580c";
  return "#1d4ed8";
}

function statusGlow(block: ScheduledBlock): string {
  if (block.kind === "incident") return "#ddd6fe";
  if (block.status === "in_progress") return "#bbf7d0";
  if (block.isDelayed) return "#fecaca";
  if (block.isFrozen) return "#e2e8f0";
  if (block.isPriorityInsert) return "#fed7aa";
  return "#bfdbfe";
}

function progressColor(block: ScheduledBlock): string {
  if (block.isFrozen) return "#f8fafc";
  if (block.isDelayed) return "#fecaca";
  return "#fde047";
}

function shortLabel(label: string): string {
  return label.length > 14 ? `${label.slice(0, 12)}…` : label;
}

function blockDetails(block: ScheduledBlock): string[] {
  return [
    block.label,
    block.subLabel,
    block.typeLabel,
    `预计 ${block.estimatedDays} 工作日`,
    `${formatDate(block.startDate)} → ${formatDate(block.endDate)}`,
    `状态：${STATUS_LABELS[block.status]}`,
    block.kind === "order" ? `k=${block.processedTime}` : "",
  ].filter(Boolean);
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function assignOverlapStack(
  items: { start: number; end: number; key: string }[]
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const stackEnds: number[] = [];
  const map = new Map<string, number>();

  for (const item of sorted) {
    let stack = stackEnds.findIndex((end) => end <= item.start);
    if (stack < 0) {
      stack = stackEnds.length;
      stackEnds.push(item.end);
    } else {
      stackEnds[stack] = item.end;
    }
    map.set(item.key, Math.min(stack, 2));
  }
  return map;
}

function buildRoadLayout({
  blocks,
  rangeStart,
  rangeEnd,
  lookup,
  selectedBlockId,
  highlightProjectId,
}: Props): RoadLayout {
  const totalDays = Math.max(1, calendarDaysBetween(rangeStart, rangeEnd) + 1);
  const totalWidth = Math.max(10, totalDays * DAY_UNIT);
  const curve = buildRoadCurve(totalDays, totalWidth);
  const orders = blocks.filter((block) => block.kind === "order");
  const incidents = blocks.filter((block) => block.kind === "incident");

  const delayedRanges = orders
    .filter((block) => block.isDelayed)
    .map((block) => ({
      start: Math.max(0, calendarDaysBetween(rangeStart, block.startDate)),
      end: Math.max(0, calendarDaysBetween(rangeStart, block.endDate)),
    }));

  const days: RoadDay[] = Array.from({ length: totalDays }, (_, i) => {
    const date = addCalendarDays(rangeStart, i);
    const parsed = parseDateInput(date)!;
    const t = offsetToT(i + 0.5, totalDays);
    const { point } = sampleRoad(curve, t);
    const hasDelay = delayedRanges.some((range) => i >= range.start && i <= range.end);
    return {
      date,
      t,
      x: point.x,
      y: point.y,
      z: point.z,
      nonWork: !isWorkdayAt(parsed, lookup),
      showLabel: i === 0 || i % 7 === 0,
      hasDelay,
    };
  });

  const orderSpans = orders.map((block) => {
    const startOffset = Math.max(0, calendarDaysBetween(rangeStart, block.startDate));
    const endOffset = Math.max(
      startOffset + 1,
      calendarDaysBetween(rangeStart, block.endDate) + 1
    );
    return {
      block,
      startOffset,
      endOffset,
      daySpan: Math.max(1, endOffset - startOffset),
      centerOffset: startOffset + Math.max(1, endOffset - startOffset) / 2,
    };
  });

  const stackMap = assignOverlapStack(
    orderSpans
      .filter(({ block }) => !block.isFrozen)
      .map(({ block, startOffset, endOffset }) => ({
        key: block.id,
        start: startOffset,
        end: endOffset,
      }))
  );

  const vehicleLayouts: RoadBlockLayout[] = orderSpans.map(
    ({ block, startOffset, endOffset, daySpan }) => {
      const startT = offsetToT(startOffset, totalDays);
      const endT = offsetToT(endOffset, totalDays);
      const centerT = (startT + endT) / 2;
      const { point, rotationY } = sampleRoad(curve, centerT);
      const stack = block.isFrozen ? 0 : (stackMap.get(block.id) ?? 0);
      const lateral = block.isFrozen ? ROAD_WIDTH / 2 + SHOULDER_WIDTH / 2 : stack * 0.18;
      const progressRatio =
        block.estimatedDays > 0
          ? Math.min(1, Math.max(0, block.processedTime / block.estimatedDays))
          : 0;

      return {
        block,
        x: point.x,
        y: point.y + 0.18 + stack * 0.06,
        z: point.z + (block.isFrozen ? lateral : stack * 0.12),
        width: Math.max(MIN_VEHICLE_WIDTH, daySpan * DAY_UNIT * 0.92),
        rotationY,
        progressRatio,
        stack,
        isSelected: selectedBlockId === block.id,
        isHighlighted: highlightProjectId === block.projectId,
      };
    }
  );

  const incidentLayouts: RoadBlockLayout[] = incidents.map((block) => {
    const startOffset = Math.max(0, calendarDaysBetween(rangeStart, block.startDate));
    const endOffset = Math.max(
      startOffset + 1,
      calendarDaysBetween(rangeStart, block.endDate) + 1
    );
    const daySpan = Math.max(1, endOffset - startOffset);
    const centerT = offsetToT(startOffset + daySpan / 2, totalDays);
    const { point, rotationY } = sampleRoad(curve, centerT);
    return {
      block,
      x: point.x,
      y: point.y + 0.12,
      z: point.z,
      width: Math.max(MIN_VEHICLE_WIDTH, daySpan * DAY_UNIT),
      rotationY,
      progressRatio: 0,
      stack: 0,
      isSelected: selectedBlockId === block.id,
      isHighlighted: highlightProjectId === block.projectId,
    };
  });

  const priorityTs = vehicleLayouts
    .filter((layout) => layout.block.isPriorityInsert)
    .map((layout) => {
      const startOffset = Math.max(0, calendarDaysBetween(rangeStart, layout.block.startDate));
      return offsetToT(startOffset, totalDays);
    });

  const focus =
    vehicleLayouts.find((layout) => layout.isSelected || layout.isHighlighted) ??
    incidentLayouts.find((layout) => layout.isSelected || layout.isHighlighted) ??
    null;

  return {
    totalDays,
    totalWidth,
    curve,
    days,
    vehicles: vehicleLayouts,
    incidents: incidentLayouts,
    priorityTs,
    focus,
  };
}

function RoadRibbon({ layout }: { layout: RoadLayout }) {
  const samples = 120;
  const halfW = ROAD_WIDTH / 2;

  return (
    <group>
      {Array.from({ length: samples }, (_, i) => {
        const t = i / (samples - 1);
        const nextT = Math.min(1, (i + 1) / (samples - 1));
        const current = sampleRoad(layout.curve, t);
        const next = sampleRoad(layout.curve, nextT);
        const mid = current.point.clone().add(next.point).multiplyScalar(0.5);
        const length = current.point.distanceTo(next.point) + 0.02;
        const dayIndex = Math.floor(t * layout.totalDays);
        const day = layout.days[Math.min(dayIndex, layout.days.length - 1)];
        const color = day?.hasDelay ? "#7f1d1d" : day?.nonWork ? "#57534e" : "#334155";

        return (
          <mesh
            key={i}
            position={[mid.x, mid.y + 0.02, mid.z]}
            rotation={[0, current.rotationY, 0]}
            receiveShadow
            raycast={disableRaycast}
          >
            <boxGeometry args={[length, 0.08, ROAD_WIDTH]} />
            <meshStandardMaterial color={color} roughness={0.88} metalness={0.04} />
          </mesh>
        );
      })}

      {Array.from({ length: samples }, (_, i) => {
        if (i % 2 !== 0) return null;
        const t = i / (samples - 1);
        const { point, rotationY } = sampleRoad(layout.curve, t);
        return (
          <mesh
            key={`dash-${i}`}
            position={[point.x, point.y + 0.09, point.z]}
            rotation={[0, rotationY, 0]}
            raycast={disableRaycast}
          >
            <boxGeometry args={[0.28, 0.012, 0.05]} />
            <meshBasicMaterial color="#f8fafc" transparent opacity={0.72} />
          </mesh>
        );
      })}

      {Array.from({ length: samples }, (_, i) => {
        const t = i / (samples - 1);
        const { point, rotationY } = sampleRoad(layout.curve, t);
        return (
          <group key={`shoulder-${i}`} position={[point.x, point.y + 0.01, point.z]} rotation={[0, rotationY, 0]}>
            <mesh position={[0, 0, halfW + SHOULDER_WIDTH / 2]} raycast={disableRaycast}>
              <boxGeometry args={[0.34, 0.05, SHOULDER_WIDTH]} />
              <meshStandardMaterial color="#78716c" roughness={0.95} />
            </mesh>
            <mesh position={[0, 0, -(halfW + SHOULDER_WIDTH / 2)]} raycast={disableRaycast}>
              <boxGeometry args={[0.34, 0.05, SHOULDER_WIDTH]} />
              <meshStandardMaterial color="#78716c" roughness={0.95} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function ZebraCrossing({ t, layout, color = "#f8fafc" }: { t: number; layout: RoadLayout; color?: string }) {
  const { point, rotationY } = sampleRoad(layout.curve, t);
  return (
    <group position={[point.x, point.y + 0.11, point.z]} rotation={[0, rotationY, 0]}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[(i - 2.5) * 0.09, 0, 0]} raycast={disableRaycast}>
          <boxGeometry args={[0.045, 0.014, ROAD_WIDTH + 0.08]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function RoadMarkers({ layout }: { layout: RoadLayout }) {
  const start = sampleRoad(layout.curve, 0).point;
  return (
    <group>
      <ZebraCrossing t={0} layout={layout} />
      {layout.priorityTs.map((t, i) => (
        <ZebraCrossing key={`${t}-${i}`} t={t} layout={layout} color="#facc15" />
      ))}
      <Html transform distanceFactor={10} position={[start.x, start.y + 0.55, start.z - 0.35]}>
        <span className="whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-sky-800 shadow">
          起点
        </span>
      </Html>
      {layout.days.map((day) =>
        day.showLabel ? (
          <Html
            key={day.date}
            transform
            distanceFactor={11}
            position={[day.x, day.y + 0.38, day.z - 0.55]}
          >
            <span className="whitespace-nowrap rounded bg-white/80 px-1 py-0.5 text-[9px] text-slate-500 shadow-sm">
              {day.date.slice(5)}
            </span>
          </Html>
        ) : null
      )}
    </group>
  );
}

function StreetLight({ day }: { day: RoadDay }) {
  const lampColor = day.hasDelay ? "#ef4444" : day.nonWork ? "#fbbf24" : "#fef9c3";
  return (
    <group position={[day.x, day.y, day.z + ROAD_WIDTH / 2 + 0.42]}>
      <mesh position={[0, 0.42, 0]} raycast={disableRaycast}>
        <cylinderGeometry args={[0.015, 0.018, 0.82, 8]} />
        <meshStandardMaterial color="#64748b" roughness={0.55} />
      </mesh>
      <mesh position={[0.06, 0.84, 0]} raycast={disableRaycast}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial
          color={lampColor}
          emissive={lampColor}
          emissiveIntensity={day.hasDelay ? 0.85 : 0.35}
        />
      </mesh>
    </group>
  );
}

function StreetLights({ layout }: { layout: RoadLayout }) {
  return (
    <group>
      {layout.days.map((day, i) =>
        i === 0 || i % 8 === 0 || day.hasDelay ? <StreetLight key={day.date} day={day} /> : null
      )}
    </group>
  );
}

function Hillside({ layout }: { layout: RoadLayout }) {
  const hills = Math.max(8, Math.ceil(layout.totalWidth / 2.2));
  return (
    <group>
      {Array.from({ length: hills }, (_, i) => {
        const t = i / Math.max(1, hills - 1);
        const { point } = sampleRoad(layout.curve, t);
        const scale = 1.2 + (i % 3) * 0.35;
        return (
          <mesh
            key={i}
            position={[point.x - 1.8, point.y - 0.35, point.z - 2.8]}
            rotation={[0, 0.2 + i * 0.08, 0]}
            raycast={disableRaycast}
          >
            <coneGeometry args={[scale, scale * 0.75, 5]} />
            <meshStandardMaterial color={i % 2 ? "#3f6212" : "#4d7c0f"} roughness={1} />
          </mesh>
        );
      })}
      {Array.from({ length: hills }, (_, i) => {
        const t = i / Math.max(1, hills - 1);
        const { point } = sampleRoad(layout.curve, t);
        const scale = 1 + (i % 2) * 0.4;
        return (
          <mesh
            key={`r-${i}`}
            position={[point.x + 2.1, point.y - 0.42, point.z - 2.4]}
            rotation={[0, -0.15 - i * 0.06, 0]}
            raycast={disableRaycast}
          >
            <coneGeometry args={[scale, scale * 0.68, 5]} />
            <meshStandardMaterial color={i % 2 ? "#365314" : "#3f6212"} roughness={1} />
          </mesh>
        );
      })}
      <mesh position={[0, -0.55, -1.2]} raycast={disableRaycast}>
        <boxGeometry args={[layout.totalWidth + 8, 0.2, 12]} />
        <meshStandardMaterial color="#14532d" roughness={1} />
      </mesh>
    </group>
  );
}

function TrafficCone({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.09, 0]} raycast={disableRaycast}>
        <coneGeometry args={[0.06, 0.18, 10]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

function TaskVehicle({
  layout,
  hoveredId,
  setHoveredId,
  onSelectBlock,
  reducedMotion,
}: {
  layout: RoadBlockLayout;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  onSelectBlock: (block: ScheduledBlock) => void;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const sweepRef = useRef<Mesh>(null);
  const { block, width } = layout;
  const hovered = hoveredId === block.id;
  const raised = layout.isSelected || layout.isHighlighted || hovered;
  const progressWidth = Math.max(0.05, width * layout.progressRatio);
  const vehicleColor = statusColor(block);
  const glowColor = statusGlow(block);
  const showLabel = raised || hovered || block.status === "in_progress";

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const baseY = layout.y + (raised ? 0.1 : 0);
    if (reducedMotion) {
      groupRef.current.position.y = baseY;
      return;
    }
    const activeLift =
      block.status === "in_progress" ? Math.sin(clock.elapsedTime * 2.4) * 0.035 : 0;
    groupRef.current.position.y = baseY + activeLift;
    if (sweepRef.current && block.status === "in_progress") {
      const sweepT = (clock.elapsedTime * 0.42) % 1;
      sweepRef.current.position.x = -width / 2 + width * sweepT;
    }
  });

  const bind = {
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelectBlock(block);
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHoveredId(block.id);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      setHoveredId(null);
      document.body.style.cursor = "";
    },
  };

  return (
    <group
      ref={groupRef}
      position={[layout.x, layout.y + (raised ? 0.1 : 0), layout.z]}
      rotation={[0, layout.rotationY, 0]}
    >
      <mesh position={[0, 0.1, 0]} {...bind}>
        <boxGeometry args={[width + 0.24, VEHICLE_HEIGHT + 0.28, VEHICLE_DEPTH + 0.28]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {raised ? (
        <RoundedBox
          args={[width + 0.14, VEHICLE_HEIGHT + 0.1, VEHICLE_DEPTH + 0.12]}
          radius={0.06}
          smoothness={4}
          position={[0, 0.02, 0]}
          raycast={disableRaycast}
        >
          <meshBasicMaterial color={glowColor} transparent opacity={0.35} />
        </RoundedBox>
      ) : null}

      <RoundedBox
        args={[width, VEHICLE_HEIGHT, VEHICLE_DEPTH]}
        radius={0.06}
        smoothness={6}
        castShadow
        receiveShadow
        {...bind}
      >
        <meshStandardMaterial
          color={vehicleColor}
          roughness={0.34}
          metalness={0.1}
          emissive={raised || block.status === "in_progress" ? glowColor : "#000000"}
          emissiveIntensity={raised ? 0.28 : block.status === "in_progress" ? 0.12 : 0}
        />
      </RoundedBox>

      <RoundedBox
        args={[Math.min(0.42, width * 0.28), 0.14, VEHICLE_DEPTH * 0.78]}
        radius={0.04}
        smoothness={4}
        position={[width * 0.18, VEHICLE_HEIGHT / 2 + 0.06, 0]}
        raycast={disableRaycast}
      >
        <meshStandardMaterial color="#e0f2fe" roughness={0.2} />
      </RoundedBox>

      {[-0.28, 0.28].map((z) => (
        <mesh key={z} position={[-width * 0.28, -0.02, z]} rotation={[Math.PI / 2, 0, 0]} raycast={disableRaycast}>
          <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
      ))}
      {[-0.28, 0.28].map((z) => (
        <mesh key={`r-${z}`} position={[width * 0.28, -0.02, z]} rotation={[Math.PI / 2, 0, 0]} raycast={disableRaycast}>
          <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
      ))}

      {layout.progressRatio > 0 ? (
        <RoundedBox
          args={[progressWidth, 0.045, VEHICLE_DEPTH + 0.04]}
          radius={0.03}
          smoothness={3}
          position={[-width / 2 + progressWidth / 2, VEHICLE_HEIGHT / 2 + 0.04, 0]}
          raycast={disableRaycast}
        >
          <meshStandardMaterial
            color={progressColor(block)}
            emissive={progressColor(block)}
            emissiveIntensity={0.28}
          />
        </RoundedBox>
      ) : null}

      {block.status === "in_progress" && !reducedMotion ? (
        <mesh ref={sweepRef} position={[-width / 2, VEHICLE_HEIGHT / 2 + 0.06, 0]} raycast={disableRaycast}>
          <boxGeometry args={[0.06, 0.014, VEHICLE_DEPTH + 0.12]} />
          <meshBasicMaterial color="#fef08a" transparent opacity={0.75} />
        </mesh>
      ) : null}

      {block.isFrozen ? (
        <>
          <TrafficCone x={-width / 2 - 0.08} y={0} z={-0.22} />
          <TrafficCone x={width / 2 + 0.08} y={0} z={0.22} />
        </>
      ) : null}

      {showLabel ? (
        <Html transform distanceFactor={9} position={[0, VEHICLE_HEIGHT / 2 + 0.18, 0]} className="pointer-events-auto">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectBlock(block);
            }}
            onMouseEnter={() => setHoveredId(block.id)}
            onMouseLeave={() => setHoveredId(null)}
            className="max-w-[7rem] truncate rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow ring-1 ring-white/15"
          >
            {shortLabel(block.label)}
          </button>
        </Html>
      ) : null}

      {hovered ? (
        <Html position={[0, VEHICLE_HEIGHT + 0.48, 0]} distanceFactor={7} center>
          <div className="w-56 rounded-lg border border-slate-200 bg-white/95 p-2 text-xs text-slate-700 shadow-xl backdrop-blur">
            {blockDetails(block).map((line, i) => (
              <div key={`${block.id}-${i}`} className={i === 0 ? "font-semibold text-slate-950" : ""}>
                {line}
              </div>
            ))}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function IncidentRoadwork({
  layout,
  hoveredId,
  setHoveredId,
  onSelectBlock,
}: {
  layout: RoadBlockLayout;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  onSelectBlock: (block: ScheduledBlock) => void;
}) {
  const hovered = hoveredId === layout.block.id;
  const bind = {
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelectBlock(layout.block);
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHoveredId(layout.block.id);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      setHoveredId(null);
      document.body.style.cursor = "";
    },
  };

  return (
    <group
      position={[layout.x, layout.y, layout.z]}
      rotation={[0, layout.rotationY, 0]}
    >
      <RoundedBox args={[layout.width, 0.1, 0.52]} radius={0.03} smoothness={3} castShadow {...bind}>
        <meshStandardMaterial color="#6d28d9" emissive="#c4b5fd" emissiveIntensity={0.16} />
      </RoundedBox>
      {[-0.3, 0, 0.3].map((offset) => (
        <TrafficCone key={offset} x={offset * layout.width} y={0.04} z={0.34} />
      ))}
      <Html position={[0, 0.38, 0]} distanceFactor={8} center>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelectBlock(layout.block);
          }}
          className="rounded bg-purple-700 px-2 py-0.5 text-[10px] font-semibold text-white shadow"
        >
          施工 · {shortLabel(layout.block.label)}
        </button>
      </Html>
      {hovered ? (
        <Html position={[0, 0.72, 0]} distanceFactor={7} center>
          <div className="w-56 rounded-lg border border-slate-200 bg-white/95 p-2 text-xs text-slate-700 shadow-xl backdrop-blur">
            {blockDetails(layout.block).map((line, i) => (
              <div key={`${layout.block.id}-${i}`} className={i === 0 ? "font-semibold text-slate-950" : ""}>
                {line}
              </div>
            ))}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function CameraRig({
  autoRoam,
  reducedMotion,
  layout,
}: {
  autoRoam: boolean;
  reducedMotion: boolean;
  layout: RoadLayout;
}) {
  const { camera } = useThree();
  const target = useRef(new Vector3(0, 0.4, 0));
  const lookTarget = useRef(new Vector3(0, 0.4, 0));

  useFrame(({ clock }) => {
    if (autoRoam && !reducedMotion) {
      const t = (clock.elapsedTime * 0.028) % 1;
      const { point } = sampleRoad(layout.curve, t);
      target.current.set(point.x + 2.4, point.y + 2.8, point.z + 3.6);
      lookTarget.current.set(point.x, point.y + 0.35, point.z);
      camera.position.lerp(target.current, 0.04);
      camera.lookAt(lookTarget.current);
      return;
    }

    if (layout.focus) {
      target.current.set(
        layout.focus.x + 2.2,
        layout.focus.y + 2.1,
        layout.focus.z + 2.8
      );
      lookTarget.current.set(layout.focus.x, layout.focus.y, layout.focus.z);
      camera.position.lerp(target.current, 0.05);
      camera.lookAt(lookTarget.current);
    }
  });

  return null;
}

function TimelineScene({
  autoRoam,
  reducedMotion,
  ...props
}: Props & {
  autoRoam: boolean;
  reducedMotion: boolean;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const {
    blocks,
    rangeStart,
    rangeEnd,
    lookup,
    selectedBlockId,
    highlightProjectId,
    onSelectBlock,
  } = props;
  const layout = useMemo(
    () =>
      buildRoadLayout({
        blocks,
        rangeStart,
        rangeEnd,
        lookup,
        selectedBlockId,
        highlightProjectId,
        onSelectBlock,
      }),
    [blocks, rangeStart, rangeEnd, lookup, selectedBlockId, highlightProjectId, onSelectBlock]
  );

  return (
    <>
      <fog attach="fog" args={["#dbeafe", 8, 28]} />
      <Sky sunPosition={[80, 24, 40]} turbidity={6} rayleigh={0.55} mieCoefficient={0.004} />
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[6, 10, 4]}
        intensity={1.05}
        shadow-mapSize={[1024, 1024]}
      />
      <Hillside layout={layout} />
      <RoadRibbon layout={layout} />
      <RoadMarkers layout={layout} />
      <StreetLights layout={layout} />
      <ContactShadows
        position={[0, -0.48, 0]}
        opacity={0.32}
        scale={layout.totalWidth + 6}
        blur={2.2}
        far={4}
      />
      {layout.incidents.map((incident) => (
        <IncidentRoadwork
          key={incident.block.id}
          layout={incident}
          hoveredId={hoveredId}
          setHoveredId={setHoveredId}
          onSelectBlock={props.onSelectBlock}
        />
      ))}
      {layout.vehicles.map((vehicle) => (
        <TaskVehicle
          key={vehicle.block.id}
          layout={vehicle}
          hoveredId={hoveredId}
          setHoveredId={setHoveredId}
          onSelectBlock={props.onSelectBlock}
          reducedMotion={reducedMotion}
        />
      ))}
      <CameraRig autoRoam={autoRoam} reducedMotion={reducedMotion} layout={layout} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        minDistance={4.5}
        maxDistance={24}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 0.45, 0]}
      />
    </>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function Timeline3DView(props: Props) {
  const [autoRoam, setAutoRoam] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const orderBlocks = props.blocks.filter((block) => block.kind === "order");
  const incidentBlocks = props.blocks.filter((block) => block.kind === "incident");
  const owner = normalizeOwnerKey(orderBlocks[0]?.owner ?? props.blocks[0]?.owner ?? "");

  if (props.blocks.length === 0 || orderBlocks.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        当前没有可用于 3D 展示的订单块
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[380px] overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-sky-100 to-emerald-50 sm:min-h-[560px]">
      <Canvas
        shadows
        camera={{ position: [4.8, 4.2, 6.8], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            当前浏览器无法加载 3D 画布
          </div>
        }
      >
        <Suspense
          fallback={
            <Html center>
              <div className="rounded bg-white/90 px-3 py-2 text-xs text-slate-600 shadow">
                加载 3D 时间流...
              </div>
            </Html>
          }
        >
          <TimelineScene {...props} autoRoam={autoRoam} reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-lg border border-white/60 bg-white/85 px-3 py-2 text-[11px] text-slate-600 shadow-sm backdrop-blur">
        <div className="font-semibold text-slate-800">
          <DisplayText value={owner} /> · 山坡公路排程 · {orderBlocks.length} 单
          {incidentBlocks.length > 0 ? ` · ${incidentBlocks.length} 施工` : ""}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
          <LegendItem color="#1d4ed8" label="未处理" />
          <LegendItem color="#15803d" label="处理中" />
          <LegendItem color="#64748b" label="路肩冻结" />
          <LegendItem color="#ea580c" label="插单" />
          <LegendItem color="#b91c1c" label="延期" />
          <LegendItem color="#7c3aed" label="施工" />
        </div>
        <div className="mt-1 text-slate-400">
          沿公路浏览排程 · 点击车辆查看详情
          {reducedMotion ? " · 已减弱动态" : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setAutoRoam((v) => !v)}
        disabled={reducedMotion}
        className="absolute right-3 top-3 rounded-lg border border-white/70 bg-white/90 px-3 py-1.5 text-xs text-slate-700 shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {reducedMotion ? "已减弱动态" : autoRoam ? "停止巡检" : "沿路巡检"}
      </button>
    </div>
  );
}
