"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, RoundedBox } from "@react-three/drei";
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

const DAY_UNIT = 0.32;
const LANE_UNIT = 0.82;
const BAR_HEIGHT = 0.28;
const BAR_DEPTH = 0.46;
const MIN_BAR_WIDTH = 0.56;

function disableRaycast() {
  return null;
}

function statusColor(block: ScheduledBlock): string {
  if (block.kind === "incident") return "#8b5cf6";
  if (block.status === "in_progress") return "#16a34a";
  if (block.isFrozen) return "#64748b";
  if (block.isDelayed) return "#dc2626";
  return "#2563eb";
}

function statusGlow(block: ScheduledBlock): string {
  if (block.status === "in_progress") return "#bbf7d0";
  if (block.isDelayed) return "#fecaca";
  if (block.isFrozen) return "#e2e8f0";
  return "#bfdbfe";
}

function progressColor(block: ScheduledBlock): string {
  if (block.isFrozen) return "#f8fafc";
  return "#fef08a";
}

function shortLabel(label: string): string {
  return label.length > 12 ? `${label.slice(0, 10)}…` : label;
}

function blockDetails(block: ScheduledBlock): string[] {
  return [
    block.label,
    block.subLabel,
    block.typeLabel,
    `预计 ${block.estimatedDays} 工作日`,
    `${formatDate(block.startDate)} → ${formatDate(block.endDate)}`,
    `状态：${STATUS_LABELS[block.status]}`,
    `k=${block.processedTime}`,
  ].filter(Boolean);
}

function TimelineBlock({
  block,
  index,
  rangeStart,
  totalWidth,
  laneDepth,
  selectedBlockId,
  highlightProjectId,
  hoveredId,
  setHoveredId,
  onSelectBlock,
}: {
  block: ScheduledBlock;
  index: number;
  rangeStart: string;
  totalWidth: number;
  laneDepth: number;
  selectedBlockId: string | null;
  highlightProjectId: string | null;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  onSelectBlock: (block: ScheduledBlock) => void;
}) {
  const startOffset = Math.max(0, calendarDaysBetween(rangeStart, block.startDate));
  const endOffset = Math.max(
    startOffset + 1,
    calendarDaysBetween(rangeStart, block.endDate) + 1
  );
  const daySpan = Math.max(1, endOffset - startOffset);
  const width = Math.max(MIN_BAR_WIDTH, daySpan * DAY_UNIT - 0.04);
  const progressRatio =
    block.kind === "order" && block.estimatedDays > 0
      ? Math.min(1, Math.max(0, block.processedTime / block.estimatedDays))
      : 0;
  const progressWidth = Math.max(0.04, width * progressRatio);
  const x = (startOffset + daySpan / 2) * DAY_UNIT - totalWidth / 2;
  const z = index * LANE_UNIT - laneDepth / 2;
  const selected = selectedBlockId === block.id;
  const highlighted = highlightProjectId === block.projectId;
  const hovered = hoveredId === block.id;
  const y = selected || hovered ? 0.28 : 0.16;

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelectBlock(block);
  };
  const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHoveredId(block.id);
    document.body.style.cursor = "pointer";
  };
  const onPointerOut = () => {
    setHoveredId(null);
    document.body.style.cursor = "";
  };

  return (
    <group position={[x, y, z]}>
      <mesh
        position={[0, 0.06, 0]}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <boxGeometry args={[width + 0.24, BAR_HEIGHT + 0.24, BAR_DEPTH + 0.26]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(selected || highlighted || hovered) ? (
        <RoundedBox
          args={[width + 0.16, BAR_HEIGHT + 0.12, BAR_DEPTH + 0.14]}
          radius={0.08}
          smoothness={5}
          position={[0, -0.01, 0]}
          raycast={disableRaycast}
        >
          <meshBasicMaterial color={statusGlow(block)} transparent opacity={0.42} />
        </RoundedBox>
      ) : null}
      <RoundedBox
        args={[width, BAR_HEIGHT, BAR_DEPTH]}
        radius={0.07}
        smoothness={6}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <meshStandardMaterial
          color={statusColor(block)}
          roughness={0.38}
          metalness={0.08}
          emissive={hovered || selected ? statusGlow(block) : "#000000"}
          emissiveIntensity={hovered || selected ? 0.28 : 0}
        />
      </RoundedBox>
      {progressRatio > 0 ? (
        <RoundedBox
          args={[progressWidth, 0.055, BAR_DEPTH + 0.05]}
          radius={0.035}
          smoothness={4}
          position={[-width / 2 + progressWidth / 2, BAR_HEIGHT / 2 + 0.045, 0]}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        >
          <meshStandardMaterial
            color={progressColor(block)}
            roughness={0.24}
            emissive={progressColor(block)}
            emissiveIntensity={0.35}
          />
        </RoundedBox>
      ) : null}
      <Html
        transform
        distanceFactor={8}
        position={[0, BAR_HEIGHT / 2 + 0.16, 0]}
        className="pointer-events-auto"
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelectBlock(block);
          }}
          onMouseEnter={() => setHoveredId(block.id)}
          onMouseLeave={() => setHoveredId(null)}
          className="rounded bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm ring-1 ring-white/20"
        >
          {shortLabel(block.label)}
        </button>
      </Html>
      {hovered ? (
        <Html position={[0, BAR_HEIGHT + 0.42, 0]} distanceFactor={7} center>
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

function DateCorridor({
  rangeStart,
  totalDays,
  totalWidth,
  laneDepth,
  lookup,
}: {
  rangeStart: string;
  totalDays: number;
  totalWidth: number;
  laneDepth: number;
  lookup: WorkdayLookup;
}) {
  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => {
      const date = addCalendarDays(rangeStart, i);
      const parsed = parseDateInput(date)!;
      return {
        date,
        x: i * DAY_UNIT - totalWidth / 2,
        nonWork: !isWorkdayAt(parsed, lookup),
        showLabel: i === 0 || i % 7 === 0,
      };
    });
  }, [lookup, rangeStart, totalDays, totalWidth]);

  return (
    <group position={[0, -0.05, 0]}>
      {days.map((day, i) => (
        <group key={day.date} position={[day.x, 0, 0]}>
          {day.nonWork ? (
            <mesh position={[DAY_UNIT / 2, -0.01, 0]} raycast={disableRaycast}>
              <boxGeometry args={[DAY_UNIT, 0.018, laneDepth + 0.8]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.12} />
            </mesh>
          ) : null}
          <mesh position={[0, 0, 0]} raycast={disableRaycast}>
            <boxGeometry args={[0.01, 0.025, laneDepth + 0.8]} />
            <meshBasicMaterial color={i === 0 ? "#0ea5e9" : "#cbd5e1"} transparent opacity={i === 0 ? 0.9 : 0.42} />
          </mesh>
          {day.showLabel ? (
            <Html
              transform
              distanceFactor={10}
              position={[0, 0.08, -laneDepth / 2 - 0.5]}
              raycast={disableRaycast}
            >
              <span className="whitespace-nowrap rounded bg-white/85 px-1 py-0.5 text-[10px] text-slate-500 shadow-sm">
                {day.date.slice(5)}
              </span>
            </Html>
          ) : null}
        </group>
      ))}
      <mesh position={[0, -0.025, -laneDepth / 2 - 0.18]} raycast={disableRaycast}>
        <boxGeometry args={[totalWidth + 0.4, 0.035, 0.035]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.55} />
      </mesh>
      <Html transform distanceFactor={9} position={[-totalWidth / 2, 0.22, -laneDepth / 2 - 0.48]}>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 shadow-sm">
          今天 / 起点 {rangeStart}
        </span>
      </Html>
    </group>
  );
}

function FlowGuides({ laneDepth }: { laneDepth: number }) {
  const count = Math.max(2, Math.floor(laneDepth / 1.6));
  return (
    <group position={[0, 0.04, -laneDepth / 2 + 0.4]}>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[0, 0, i * 1.6]}>
          <mesh raycast={disableRaycast}>
            <boxGeometry args={[0.05, 0.025, 0.7]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]} raycast={disableRaycast}>
            <coneGeometry args={[0.12, 0.28, 3]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TimelineScene({
  autoRoam,
  ...props
}: Props & {
  autoRoam: boolean;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const totalDays = Math.max(1, calendarDaysBetween(props.rangeStart, props.rangeEnd) + 1);
  const totalWidth = Math.max(8, totalDays * DAY_UNIT);
  const visibleBlocks = props.blocks.filter((block) => block.kind === "order");
  const laneDepth = Math.max(4.5, visibleBlocks.length * LANE_UNIT);

  return (
    <>
      <color attach="background" args={["#f8fafc"]} />
      <ambientLight intensity={0.82} />
      <directionalLight position={[4, 7, 5]} intensity={1.1} castShadow />
      <pointLight position={[-5, 3, -4]} intensity={0.35} />
      <DateCorridor
        rangeStart={props.rangeStart}
        totalDays={totalDays}
        totalWidth={totalWidth}
        laneDepth={laneDepth}
        lookup={props.lookup}
      />
      <FlowGuides laneDepth={laneDepth} />
      {visibleBlocks.map((block, index) => (
        <TimelineBlock
          key={block.id}
          block={block}
          index={index}
          rangeStart={props.rangeStart}
          totalWidth={totalWidth}
          laneDepth={laneDepth}
          selectedBlockId={props.selectedBlockId}
          highlightProjectId={props.highlightProjectId}
          hoveredId={hoveredId}
          setHoveredId={setHoveredId}
          onSelectBlock={props.onSelectBlock}
        />
      ))}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRoam}
        autoRotateSpeed={0.18}
        enablePan
        enableZoom
        minDistance={5.5}
        maxDistance={24}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2.25}
        target={[0, 0.05, 0]}
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
  const visibleBlocks = props.blocks.filter((block) => block.kind === "order");
  const owner = normalizeOwnerKey(
    visibleBlocks[0]?.owner ?? props.blocks[0]?.owner ?? ""
  );

  if (visibleBlocks.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        当前没有可用于 3D 展示的订单块
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[380px] overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 sm:min-h-[560px]">
      <Canvas
        shadows
        camera={{ position: [5.2, 4.8, 7.2], fov: 46 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true }}
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
          <TimelineScene {...props} autoRoam={autoRoam} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-600 shadow-sm backdrop-blur">
        <div className="font-semibold text-slate-800">
          <DisplayText value={owner} /> · 3D 排程跑道 · {visibleBlocks.length} 单
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
          <LegendItem color="#2563eb" label="未处理" />
          <LegendItem color="#16a34a" label="处理中" />
          <LegendItem color="#64748b" label="冻结" />
          <LegendItem color="#f97316" label="插单" />
          <LegendItem color="#dc2626" label="延期" />
        </div>
        <div className="mt-1 text-slate-400">拖拽旋转 · 滚轮缩放 · 点击订单块打开详情</div>
      </div>
      <button
        type="button"
        onClick={() => setAutoRoam((v) => !v)}
        className="absolute right-3 top-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-700 shadow-sm backdrop-blur transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        {autoRoam ? "关闭自动漫游" : "自动漫游"}
      </button>
    </div>
  );
}
