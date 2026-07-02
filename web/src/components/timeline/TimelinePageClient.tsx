"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { normalizeOwnerKey } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { TimelineToolbar } from "@/components/timeline/TimelineToolbar";
import { TimelineGantt } from "@/components/timeline/TimelineGantt";
import { TimelineDetailDrawer } from "@/components/timeline/TimelineDetailDrawer";
import { TimelineRiskFooter } from "@/components/timeline/TimelineRiskFooter";
import {
  FreezeModal,
  IncidentModal,
  MarkInProgressModal,
  PriorityInsertModal,
  RestartModal,
} from "@/components/timeline/TimelineModals";
import {
  computeAllSchedules,
  createWorkdayLookup,
  getConfigurableWeeks,
  getDateRange,
  getOwnerQueueProjects,
  getOwnerWeeklyConfig,
  getRelatedOrderItems,
  initOrderStates,
  isActiveQueueHead,
  projectToTimelineBase,
  resetToInitialPending,
  roundTimelineTenth,
  RISK_TYPE_LABELS,
  searchOrder,
  summarizeMember,
  unmarkInProgressKeepProcessedTime,
} from "@/lib/timeline/schedule";
import { appendLog, loadTimelineState, saveTimelineState } from "@/lib/timeline/storage";
import {
  getZoomPreset,
  loadZoomLevel,
  saveZoomLevel,
  type TimelineZoomLevel,
} from "@/lib/timeline/zoom";
import { ALL_OWNERS_WORKDAY_KEY } from "@/lib/auth/constants";
import {
  addCalendarDays,
  DEFAULT_WORKDAY_CONFIG,
  type MemberWorkdayConfig,
  type WorkdayLookup,
} from "@/lib/timeline/workdays";
import type {
  ScheduledBlock,
  TimelineOrderState,
  TimelinePersistedState,
  TimelineProjectBase,
} from "@/lib/timeline/types";

type ModalType = "priority" | "freeze" | "restart" | "incident" | "markInProgress" | null;
type ReorderAction = "up" | "down" | "top" | "bottom";

function sortOwnerQueueStates(states: TimelineOrderState[]): TimelineOrderState[] {
  return [...states].sort((a, b) => {
    const af = a.status === "frozen" ? 1 : 0;
    const bf = b.status === "frozen" ? 1 : 0;
    if (af !== bf) return af - bf;
    return a.queueIndex - b.queueIndex;
  });
}

function reindexOwnerQueue(
  orderStates: TimelineOrderState[],
  owner: string,
  orderedProjectIds: string[]
): TimelineOrderState[] {
  const indexMap = new Map(orderedProjectIds.map((id, i) => [id, i * 10]));
  return orderStates.map((s) =>
    s.owner === owner && indexMap.has(s.projectId)
      ? { ...s, queueIndex: indexMap.get(s.projectId)! }
      : s
  );
}

export function TimelinePageClient({ serverToday }: { serverToday: string }) {
  const searchParams = useSearchParams();
  const { user, isAdmin, canManageOwner, setMembersFromOwners } = useAuth();
  const [projects, setProjects] = useState<TimelineProjectBase[]>([]);
  const [persisted, setPersisted] = useState<TimelinePersistedState>(() => loadTimelineState());
  const [loaded, setLoaded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ScheduledBlock | null>(null);
  const [highlightProjectId, setHighlightProjectId] = useState<string | null>(null);
  const [scrollToOwner, setScrollToOwner] = useState<string | null>(null);
  const [scrollToProjectId, setScrollToProjectId] = useState<string | null>(null);
  const [adminFocusedOwner, setAdminFocusedOwner] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHitProjectIds, setSearchHitProjectIds] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyDelayed, setOnlyDelayed] = useState(false);
  const onlyPriority = false;
  const onlyFrozen = false;
  const onlyIncident = false;
  const [modal, setModal] = useState<ModalType>(null);
  const [toast, setToast] = useState("");
  const [zoomLevel, setZoomLevel] = useState<TimelineZoomLevel>(() => loadZoomLevel());
  const [overviewWorkdayOwner, setOverviewWorkdayOwner] = useState("");
  const [flowRunVersion, setFlowRunVersion] = useState(0);

  const zoomPreset = useMemo(() => getZoomPreset(zoomLevel), [zoomLevel]);

  const handleZoomChange = useCallback((level: TimelineZoomLevel) => {
    setZoomLevel(level);
    saveZoomLevel(level);
  }, []);

  const handleFocusOwner = useCallback((owner: string | null) => {
    setAdminFocusedOwner(owner);
    setScrollToProjectId(null);
    setScrollToOwner(owner);
  }, []);

  useEffect(() => {
    fetch("/api/projects?designStatus=incomplete")
      .then((r) => r.json())
      .then((data) => {
        const bases = (data as Parameters<typeof projectToTimelineBase>[0][]).map(projectToTimelineBase);
        setProjects(bases);
        setMembersFromOwners(bases.map((p) => p.owner));
        setPersisted((prev) => {
          const projectByUuid = new Map(
            bases.filter((p) => p.uuid).map((p) => [p.uuid.toLowerCase(), p.id])
          );
          const projectIdMap = new Map<string, string>();
          for (const state of prev.orderStates) {
            if (!state.projectUuid) continue;
            const nextId = projectByUuid.get(state.projectUuid.toLowerCase());
            if (nextId && nextId !== state.projectId) {
              projectIdMap.set(state.projectId, nextId);
            }
          }
          return {
            ...prev,
            orderStates: initOrderStates(bases, prev.orderStates),
            incidents: prev.incidents.map((incident) => ({
              ...incident,
              affectedOrderIds: incident.affectedOrderIds.map((id) => projectIdMap.get(id) ?? id),
            })),
          };
        });
        setLoaded(true);
      });
  }, [setMembersFromOwners]);

  useEffect(() => {
    if (!loaded) return;
    saveTimelineState(persisted);
  }, [persisted, loaded]);

  const focusedOwner = user?.role === "member" ? user.name : adminFocusedOwner;
  const showOwnerSwitcher = isAdmin;

  const timelineToday = serverToday;
  const schedules = useMemo(
    () => computeAllSchedules(projects, persisted, timelineToday),
    [projects, persisted, timelineToday]
  );

  const allOwnersFromData = useMemo(
    () => [...new Set(projects.map((p) => normalizeOwnerKey(p.owner)))].sort(),
    [projects]
  );

  const workdayLookups = useMemo(() => {
    const map = new Map<string, WorkdayLookup>();
    const weekly = persisted.memberWeeklyWorkdayConfig ?? {};
    const legacy = persisted.memberWorkdayConfig ?? {};
    for (const owner of allOwnersFromData) {
      map.set(owner, createWorkdayLookup(owner, weekly, legacy));
    }
    return map;
  }, [allOwnersFromData, persisted.memberWeeklyWorkdayConfig, persisted.memberWorkdayConfig]);

  const filteredOwners = useMemo(() => {
    let owners = allOwnersFromData;

    if (user?.role === "member") {
      owners = owners.filter((o) => o === user.name);
    }

    if (departmentFilter === "管理部") {
      owners = owners.filter(() => false);
    }

    if (ownerFilter) {
      owners = owners.filter((o) => o === ownerFilter);
    }

    if (focusedOwner) {
      owners = owners.filter((o) => o === focusedOwner);
    }

    return owners;
  }, [allOwnersFromData, user, departmentFilter, ownerFilter, focusedOwner]);

  const overviewOwnerOptions = useMemo(() => {
    let owners = allOwnersFromData;
    if (user?.role === "member") owners = owners.filter((o) => o === user.name);
    return owners;
  }, [allOwnersFromData, user]);

  const overviewWorkdayOwnerSelectOptions = useMemo(() => {
    return [ALL_OWNERS_WORKDAY_KEY, ...overviewOwnerOptions];
  }, [overviewOwnerOptions]);

  const configurableOverviewOwners = useMemo(
    () => overviewOwnerOptions.filter((o) => canManageOwner(o)),
    [overviewOwnerOptions, canManageOwner]
  );

  const effectiveOverviewWorkdayOwner = overviewWorkdayOwnerSelectOptions.includes(
    overviewWorkdayOwner
  )
    ? overviewWorkdayOwner
    : overviewWorkdayOwnerSelectOptions[0] ?? ALL_OWNERS_WORKDAY_KEY;

  const chartRangeStart = useMemo(() => addCalendarDays(serverToday, -5), [serverToday]);
  const dateRange = useMemo(
    () => getDateRange(schedules, chartRangeStart),
    [schedules, chartRangeStart]
  );

  const memberSummaries = useMemo(
    () =>
      allOwnersFromData.map((owner) =>
        summarizeMember(owner, projects, schedules.get(owner) ?? [])
      ),
    [schedules, projects, allOwnersFromData]
  );

  const searchHitProjectIdSet = useMemo(
    () => new Set(searchHitProjectIds),
    [searchHitProjectIds]
  );

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInput(value);
    if (!value.trim()) {
      setSearchQuery("");
      setSearchHitProjectIds([]);
    }
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const q = searchInput.trim();
    setSearchQuery(q);
    setSearchOpen(true);
    if (!q) {
      setSearchHitProjectIds([]);
      return;
    }
    const results = searchOrder(q, projects, schedules, persisted.orderStates, {
      ownerFilter: ownerFilter || undefined,
      departmentFilter: departmentFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    setSearchHitProjectIds(results.map((r) => r.projectId));
  }, [
    searchInput,
    projects,
    schedules,
    persisted.orderStates,
    ownerFilter,
    departmentFilter,
    dateFrom,
    dateTo,
  ]);
  const searchResults = useMemo(
    () =>
      searchQuery
        ? searchOrder(searchQuery, projects, schedules, persisted.orderStates, {
            ownerFilter: ownerFilter || undefined,
            departmentFilter: departmentFilter || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          })
        : [],
    [
      searchQuery,
      projects,
      schedules,
      persisted.orderStates,
      ownerFilter,
      departmentFilter,
      dateFrom,
      dateTo,
    ]
  );

  // 仅点击具体人员时进入展开视图；全部概览（含仅一名负责人）始终走紧凑概览 + 工具栏周末配置
  const expandedView = focusedOwner !== null;

  const workdayOwner =
    focusedOwner ?? (user?.role === "member" ? user.name : null);
  const canEditWorkday = workdayOwner ? canManageOwner(workdayOwner) : false;
  const weeklyWeeks = useMemo(() => {
    if (!workdayOwner) return [];
    const weekly = persisted.memberWeeklyWorkdayConfig ?? {};
    const legacy = persisted.memberWorkdayConfig ?? {};
    return getConfigurableWeeks(timelineToday, 3).map(({ weekStart, label }) => ({
      weekStart,
      label,
      config: getOwnerWeeklyConfig(workdayOwner, weekStart, weekly, legacy),
    }));
  }, [
    workdayOwner,
    timelineToday,
    persisted.memberWeeklyWorkdayConfig,
    persisted.memberWorkdayConfig,
  ]);

  const overviewWeeklyWeeks = useMemo(() => {
    const weekly = persisted.memberWeeklyWorkdayConfig ?? {};
    const legacy = persisted.memberWorkdayConfig ?? {};
    const weekDefs = getConfigurableWeeks(timelineToday, 3);

    if (!effectiveOverviewWorkdayOwner) {
      return weekDefs.map(({ weekStart, label }) => ({
        weekStart,
        label,
        config: DEFAULT_WORKDAY_CONFIG,
      }));
    }

    if (effectiveOverviewWorkdayOwner === ALL_OWNERS_WORKDAY_KEY) {
      const owners = overviewOwnerOptions;
      if (owners.length === 0) {
        return weekDefs.map(({ weekStart, label }) => ({
          weekStart,
          label,
          config: DEFAULT_WORKDAY_CONFIG,
        }));
      }
      return weekDefs.map(({ weekStart, label }) => {
        const configs = owners.map((o) => getOwnerWeeklyConfig(o, weekStart, weekly, legacy));
        const satValues = configs.map((c) => c.saturdayWork);
        const sunValues = configs.map((c) => c.sundayWork);
        const allSat = satValues.every((v) => v);
        const noneSat = satValues.every((v) => !v);
        const allSun = sunValues.every((v) => v);
        const noneSun = sunValues.every((v) => !v);
        return {
          weekStart,
          label,
          config: {
            saturdayWork: allSat,
            sundayWork: allSun,
          },
          saturdayMixed: !allSat && !noneSat,
          sundayMixed: !allSun && !noneSun,
        };
      });
    }

    return weekDefs.map(({ weekStart, label }) => ({
      weekStart,
      label,
      config: getOwnerWeeklyConfig(
        effectiveOverviewWorkdayOwner,
        weekStart,
        weekly,
        legacy
      ),
    }));
  }, [
    effectiveOverviewWorkdayOwner,
    overviewOwnerOptions,
    timelineToday,
    persisted.memberWeeklyWorkdayConfig,
    persisted.memberWorkdayConfig,
  ]);

  const riskSummary = useMemo(() => {
    const messages: string[] = [];
    let count = 0;
    for (const owner of filteredOwners) {
      for (const b of schedules.get(owner) ?? []) {
        for (const r of b.risks) {
          count += 1;
          messages.push(`${b.owner} · ${b.label}: ${RISK_TYPE_LABELS[r]}`);
        }
      }
    }
    for (const m of memberSummaries) {
      if (filteredOwners.includes(m.owner) && m.loadStatus === "critical") {
        count += 1;
        messages.push(`${m.owner}: 人员负载过高`);
      }
    }
    return { count, messages: [...new Set(messages)] };
  }, [schedules, memberSummaries, filteredOwners]);

  const selectedProject = selectedBlock?.projectId
    ? projectById.get(selectedBlock.projectId) ?? null
    : null;

  const selectedOrderState = selectedBlock?.projectId
    ? persisted.orderStates.find((s) => s.projectId === selectedBlock.projectId) ?? null
    : null;

  const relatedItems = useMemo(() => {
    if (!selectedProject?.contractNo) return [];
    return getRelatedOrderItems(
      selectedProject.contractNo,
      projects,
      schedules,
      persisted.orderStates,
      selectedProject.id
    );
  }, [selectedProject, projects, schedules, persisted.orderStates]);

  const canEdit = selectedBlock ? canManageOwner(selectedBlock.owner) : false;

  const queuePosition = useMemo(() => {
    if (!selectedBlock?.projectId || selectedBlock.kind !== "order") return null;
    const ownerStates = persisted.orderStates
      .filter((s) => s.owner === selectedBlock.owner && s.status !== "complete")
      .sort((a, b) => {
        const af = a.status === "frozen" ? 1 : 0;
        const bf = b.status === "frozen" ? 1 : 0;
        if (af !== bf) return af - bf;
        return a.queueIndex - b.queueIndex;
      });
    const idx = ownerStates.findIndex((s) => s.projectId === selectedBlock.projectId);
    return idx >= 0 ? { index: idx, total: ownerStates.length } : null;
  }, [selectedBlock, persisted.orderStates]);

  const isSelectedQueueHead = useMemo(() => {
    if (!selectedProject) return false;
    return isActiveQueueHead(selectedProject.id, selectedProject.owner, persisted.orderStates);
  }, [selectedProject, persisted.orderStates]);

  /** 时间流完整队列顺序（活跃项在前，冻结项在末尾） */
  const priorityQueueProjects = useMemo(() => {
    if (!selectedBlock) return [];
    return getOwnerQueueProjects(selectedBlock.owner, projects, persisted.orderStates);
  }, [selectedBlock, projects, persisted.orderStates]);

  /** 可发起插单的订单（排除已冻结） */
  const priorityInsertableProjects = useMemo(() => {
    const frozenIds = new Set(
      persisted.orderStates
        .filter((s) => s.status === "frozen")
        .map((s) => s.projectId)
    );
    return priorityQueueProjects.filter((p) => !frozenIds.has(p.id));
  }, [priorityQueueProjects, persisted.orderStates]);

  const updatePersisted = useCallback(
    (
      updater: (prev: TimelinePersistedState) => TimelinePersistedState,
      log?: Omit<
        TimelinePersistedState["operationLogs"][number],
        "id" | "timestamp" | "operator" | "operatorRole"
      >
    ) => {
      setPersisted((prev) => {
        let next = updater(prev);
        if (log && user && user.role !== "guest") {
          next = appendLog(next, {
            ...log,
            operator: user.name,
            operatorRole: user.role,
          });
        }
        return next;
      });
    },
    [user]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const handleExportOrderSequence = useCallback(
    async (ownerKey: string) => {
      const exportOwners =
        ownerKey === ALL_OWNERS_WORKDAY_KEY
          ? overviewOwnerOptions
          : overviewOwnerOptions.filter((owner) => owner === ownerKey);

      const rows: (string | number | null)[][] = [];
      let sequence = 1;
      const formatExportDate = (value: string | null) => (value ? value.replaceAll("-", "/") : "");

      for (const owner of exportOwners) {
        const blocks = schedules.get(owner) ?? [];
        for (const block of blocks) {
          if (block.kind !== "order" || !block.projectId) continue;
          const project = projectById.get(block.projectId);
          if (!project) continue;
          rows.push([
            sequence,
            project.type,
            project.contractNo,
            project.projectName,
            project.model,
            project.quantity,
            project.commonRemark,
            project.extraRemark,
            formatExportDate(project.dueDate),
            formatExportDate(block.startDate),
            formatExportDate(block.endDate),
          ]);
          sequence += 1;
        }
      }

      if (rows.length === 0) {
        showToast("没有可导出的订单");
        return;
      }

      const headers = [
        "顺序",
        "处理类型",
        "合同号",
        "项目名称",
        "型号",
        "数量",
        "常用备注",
        "额外备注",
        "交期",
        "预计开始",
        "预计完成",
      ];
      const escapeHtml = (value: string | number | null) =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      const estimateTextWidth = (value: string | number | null) => {
        const text = String(value ?? "");
        let width = 0;
        for (const char of text) {
          width += /[\u4e00-\u9fff\uff00-\uffef]/.test(char) ? 15 : 8;
        }
        return width;
      };
      const colWidths = headers.map((header, colIndex) => {
        if (header === "项目名称") return 230;
        if (header === "交期" || header === "预计开始" || header === "预计完成") return 88;
        let maxTextWidth = estimateTextWidth(header);
        for (const row of rows) {
          maxTextWidth = Math.max(maxTextWidth, estimateTextWidth(row[colIndex]));
        }
        return Math.ceil(maxTextWidth + 24);
      });
      const colgroup = colWidths.map((width) => `<col style="width:${width}px">`).join("");
      const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
      const bodyHtml = rows
        .map(
          (row) =>
            `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`
        )
        .join("");
      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
table {
  border-collapse: collapse;
  table-layout: fixed;
  font-family: "Microsoft YaHei", Arial, sans-serif;
  font-size: 11pt;
}
th, td {
  border: 1px solid #b7c9e2;
  padding: 4px 8px;
  text-align: center;
  vertical-align: middle;
  white-space: normal;
  word-break: break-all;
  line-height: 18px;
}
th {
  height: 30px;
  background: #dbeafe;
  color: #1f2937;
  font-weight: 700;
}
td {
  height: 44px;
  mso-height-source: userset;
}
</style>
</head>
<body>
<table>
<colgroup>${colgroup}</colgroup>
<thead><tr>${headerHtml}</tr></thead>
<tbody>${bodyHtml}</tbody>
</table>
</body>
</html>`;
      const ownerLabel = ownerKey === ALL_OWNERS_WORKDAY_KEY ? "全部人员" : ownerKey || "缺失";
      const safeOwnerLabel = ownerLabel.replace(/[\\/:*?"<>|]/g, "_");
      const blob = new Blob(["\ufeff", html], {
        type: "application/vnd.ms-excel;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `订单顺序_${safeOwnerLabel}_${timelineToday}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`已导出 ${rows.length} 条订单`);
    },
    [overviewOwnerOptions, projectById, schedules, showToast, timelineToday]
  );

  const restartFlowRun = useCallback(() => {
    setFlowRunVersion((v) => v + 1);
  }, []);

  const openBlock = (block: ScheduledBlock) => {
    setSelectedBlock(block);
    setHighlightProjectId(block.projectId ?? null);
    setDrawerOpen(true);
  };

  const findBlockByProjectId = useCallback(
    (projectId: string, preferredOwner?: string) => {
      if (preferredOwner) {
        const preferred = schedules.get(preferredOwner)?.find((b) => b.projectId === projectId);
        if (preferred) return { block: preferred, owner: preferredOwner };
      }
      for (const [owner, blocks] of schedules) {
        const block = blocks.find((b) => b.projectId === projectId);
        if (block) return { block, owner };
      }
      return null;
    },
    [schedules]
  );

  const handleSearchSelect = useCallback(
    (projectId: string, owner?: string) => {
      const found = findBlockByProjectId(projectId, owner);
      if (!found) return;
      if (showOwnerSwitcher) setAdminFocusedOwner(found.owner);
      setHighlightProjectId(projectId);
      setScrollToOwner(found.owner);
      setScrollToProjectId(projectId);
      openBlock(found.block);
    },
    [findBlockByProjectId, showOwnerSwitcher]
  );

  useEffect(() => {
    if (!loaded) return;
    const openId = searchParams.get("open");
    if (!openId) return;
    const owner = searchParams.get("owner") ?? undefined;
    const timer = window.setTimeout(() => {
      handleSearchSelect(openId, owner);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loaded, searchParams, handleSearchSelect]);

  const applyOwnerWeekConfig = (
    owner: string,
    weekStart: string,
    patch: Partial<MemberWorkdayConfig>
  ) => {
    if (!canManageOwner(owner)) return;
    const weekly = persisted.memberWeeklyWorkdayConfig ?? {};
    const legacy = persisted.memberWorkdayConfig ?? {};
    const current = getOwnerWeeklyConfig(owner, weekStart, weekly, legacy);
    const next = { ...current, ...patch };
    updatePersisted(
      (prev) => ({
        ...prev,
        memberWeeklyWorkdayConfig: {
          ...(prev.memberWeeklyWorkdayConfig ?? {}),
          [owner]: {
            ...(prev.memberWeeklyWorkdayConfig?.[owner] ?? {}),
            [weekStart]: next,
          },
        },
      }),
      {
        action: "admin_intervention",
        before: `${owner}@${weekStart}`,
        after: JSON.stringify(next),
        reason: "更新按周周末工作规则",
        affectedCount: 1,
      }
    );
    showToast("本周工作日规则已更新，时间流已重新计算");
  };

  const handleWeekConfigChange = (
    weekStart: string,
    patch: Partial<MemberWorkdayConfig>
  ) => {
    if (!workdayOwner) return;
    applyOwnerWeekConfig(workdayOwner, weekStart, patch);
  };

  const handleOverviewWeekConfigChange = (
    weekStart: string,
    patch: Partial<MemberWorkdayConfig>
  ) => {
    if (effectiveOverviewWorkdayOwner === ALL_OWNERS_WORKDAY_KEY) {
      if (configurableOverviewOwners.length === 0) return;
      const weekly = persisted.memberWeeklyWorkdayConfig ?? {};
      const legacy = persisted.memberWorkdayConfig ?? {};
      updatePersisted((prev) => {
        let nextWeekly = { ...(prev.memberWeeklyWorkdayConfig ?? {}) };
        for (const owner of configurableOverviewOwners) {
          if (!canManageOwner(owner)) continue;
          const current = getOwnerWeeklyConfig(owner, weekStart, weekly, legacy);
          const next = { ...current, ...patch };
          nextWeekly = {
            ...nextWeekly,
            [owner]: {
              ...(nextWeekly[owner] ?? {}),
              [weekStart]: next,
            },
          };
        }
        return { ...prev, memberWeeklyWorkdayConfig: nextWeekly };
      }, {
        action: "admin_intervention",
        before: `batch@${weekStart}`,
        after: JSON.stringify(patch),
        reason: "批量更新按周周末工作规则",
        affectedCount: configurableOverviewOwners.length,
      });
      showToast("已批量更新全部可配置人员的工作日规则，时间流已重新计算");
      return;
    }
    if (!effectiveOverviewWorkdayOwner) return;
    applyOwnerWeekConfig(effectiveOverviewWorkdayOwner, weekStart, patch);
  };

  const reorderOwnerQueue = (
    owner: string,
    projectId: string,
    action: ReorderAction
  ) => {
    if (!canManageOwner(owner)) return;
    updatePersisted(
      (prev) => {
        const states = sortOwnerQueueStates(
          prev.orderStates.filter((s) => s.owner === owner && s.status !== "complete")
        );
        const activeStates = states.filter((s) => s.status !== "frozen");
        const frozenIds = states
          .filter((s) => s.status === "frozen")
          .map((s) => s.projectId);
        const idx = activeStates.findIndex((s) => s.projectId === projectId);
        if (idx < 0) return prev;

        const newActiveOrder = activeStates.map((s) => s.projectId);
        if (action === "up" && idx > 0) {
          [newActiveOrder[idx - 1], newActiveOrder[idx]] = [
            newActiveOrder[idx],
            newActiveOrder[idx - 1],
          ];
        } else if (action === "down" && idx < newActiveOrder.length - 1) {
          [newActiveOrder[idx + 1], newActiveOrder[idx]] = [
            newActiveOrder[idx],
            newActiveOrder[idx + 1],
          ];
        } else if (action === "top" && idx > 0) {
          const [item] = newActiveOrder.splice(idx, 1);
          newActiveOrder.unshift(item);
        } else if (action === "bottom" && idx < newActiveOrder.length - 1) {
          const [item] = newActiveOrder.splice(idx, 1);
          newActiveOrder.push(item);
        } else {
          return prev;
        }

        const headProjectId = newActiveOrder[0] ?? null;
        const reordered = reindexOwnerQueue(prev.orderStates, owner, [
          ...newActiveOrder,
          ...frozenIds,
        ]);

        return {
          ...prev,
          orderStates: reordered.map((s) =>
            s.owner === owner && s.status === "in_progress" && s.projectId !== headProjectId
              ? unmarkInProgressKeepProcessedTime(s)
              : s
          ),
        };
      },
      {
        action: "reorder",
        before: projectId,
        after: action,
        reason: `调整顺序: ${action}`,
        affectedCount: 1,
      }
    );
    restartFlowRun();
    showToast("顺序已调整，时间流已重新计算");
  };

  const handlePriorityInsert = (data: {
    projectId: string;
    insertBeforeProjectId: string;
    reason: string;
    freezeCurrent: boolean;
    processedTime: number;
  }) => {
    const owner = projects.find((p) => p.id === data.projectId)?.owner;
    if (!owner) return;

    updatePersisted(
      (prev) => {
        const states = sortOwnerQueueStates(
          prev.orderStates.filter((s) => s.owner === owner && s.status !== "complete")
        );
        const insertBeforeIndex = states.findIndex(
          (s) => s.projectId === data.insertBeforeProjectId
        );
        const insertAt = insertBeforeIndex >= 0 ? insertBeforeIndex : 0;
        const insertAtHead = insertAt === 0;
        const newOrder = states.map((s) => s.projectId).filter((id) => id !== data.projectId);
        const targetIndex = newOrder.indexOf(data.insertBeforeProjectId);
        newOrder.splice(targetIndex >= 0 ? targetIndex : 0, 0, data.projectId);
        let orderStates = prev.orderStates.map((s) => {
          if (
            insertAtHead &&
            s.owner === owner &&
            s.status === "in_progress" &&
            s.projectId !== data.projectId
          ) {
            return resetToInitialPending(s);
          }
          if (s.projectId === data.projectId) {
            return {
              ...s,
              status: insertAtHead ? ("in_progress" as const) : s.status,
              isPriorityInsert: true,
              priorityReason: data.reason,
              processedTime: insertAtHead ? 0 : s.processedTime,
              restartExtra: insertAtHead ? 0 : s.restartExtra,
              workStartDate: insertAtHead ? timelineToday : s.workStartDate,
              frozenAt: insertAtHead ? null : s.frozenAt,
              freezeReason: insertAtHead ? "" : s.freezeReason,
              freezeNote: insertAtHead ? "" : s.freezeNote,
              freezeByPriority: insertAtHead ? false : s.freezeByPriority,
              freezeByIncident: insertAtHead ? false : s.freezeByIncident,
              lastProgressUpdate: insertAtHead ? new Date().toISOString() : s.lastProgressUpdate,
            };
          }
          return s;
        });

        if (data.freezeCurrent && !insertAtHead) {
          const inProgress = orderStates.find(
            (s) => s.owner === owner && s.status === "in_progress"
          );
          if (inProgress) {
            orderStates = orderStates.map((s) =>
              s.projectId === inProgress.projectId
                ? {
                    ...s,
                    status: "frozen" as const,
                    processedTime: roundTimelineTenth(data.processedTime),
                    restartExtra: 0,
                    frozenAt: new Date().toISOString().slice(0, 10),
                    freezeByPriority: true,
                    freezeReason: "插单导致冻结",
                    workStartDate: null,
                  }
                : s
            );
          }
        }

        return {
          ...prev,
          orderStates: reindexOwnerQueue(orderStates, owner, newOrder),
          memberWorkStarts: insertAtHead
            ? {
                ...prev.memberWorkStarts,
                [owner]: timelineToday,
              }
            : prev.memberWorkStarts,
        };
      },
      {
        action: "priority_insert",
        before: "",
        after: data.projectId,
        reason: data.reason,
        affectedCount: 3,
      }
    );
    restartFlowRun();
    setModal(null);
    showToast("插单成功，时间流已重新计算");
  };

  const handleFreeze = (data: {
    reason: string;
    processedTime: number;
    byPriority: boolean;
    byIncident: boolean;
    note: string;
  }) => {
    if (!selectedProject || selectedOrderState?.status !== "in_progress") {
      showToast("仅正在处理中的订单可冻结");
      return;
    }
    updatePersisted(
      (prev) => {
        const ownerStates = prev.orderStates.filter(
          (s) => s.owner === selectedProject.owner && s.status !== "complete"
        );
        const maxIndex = ownerStates.reduce((m, s) => Math.max(m, s.queueIndex), 0);
        return {
          ...prev,
          orderStates: prev.orderStates.map((s) =>
            s.projectId === selectedProject.id
              ? {
                  ...s,
                  status: "frozen" as const,
                  queueIndex: maxIndex + 10,
                  processedTime: roundTimelineTenth(
                    Math.max(0, Math.min(selectedProject.estimatedDays, data.processedTime))
                  ),
                  restartExtra: 0,
                  frozenAt: new Date().toISOString().slice(0, 10),
                  freezeReason: data.reason,
                  freezeByPriority: data.byPriority,
                  freezeByIncident: data.byIncident,
                  freezeNote: data.note,
                  workStartDate: null,
                }
              : s
          ),
        };
      },
      {
        action: "freeze",
        before: selectedProject.contractNo,
        after: `k=${roundTimelineTenth(data.processedTime)}`,
        reason: data.reason,
        affectedCount: 1,
      }
    );
    setModal(null);
    showToast("订单已冻结");
  };

  const handleUnfreeze = () => {
    if (!selectedProject) return;
    updatePersisted(
      (prev) => ({
        ...prev,
        orderStates: prev.orderStates.map((s) =>
          s.projectId === selectedProject.id ? resetToInitialPending(s) : s
        ),
      }),
      {
        action: "unfreeze",
        before: selectedProject.contractNo,
        after: "pending",
        reason: "反冻结，恢复未处理",
        affectedCount: 1,
      }
    );
    showToast("订单已反冻结，恢复为未处理");
  };

  const handleRestart = (data: { restartExtra: number; note: string }) => {
    if (!selectedProject) return;
    updatePersisted(
      (prev) => ({
        ...prev,
        orderStates: prev.orderStates.map((s) =>
          s.projectId === selectedProject.id
            ? {
                ...s,
                status: "pending",
                restartExtra: data.restartExtra,
                restartNote: data.note,
                lastProgressUpdate: new Date().toISOString(),
              }
            : s
        ),
      }),
      {
        action: "restart",
        before: selectedProject.contractNo,
        after: `q=${data.restartExtra}`,
        reason: data.note,
        affectedCount: 1,
      }
    );
    setModal(null);
    showToast("订单已再次启动");
  };

  const handleIncident = (data: {
    name: string;
    startDate: string;
    durationDays: number;
    affectedOrderIds: string[];
    description: string;
    insertBeforeQueueIndex: number;
  }) => {
    if (!selectedBlock) return;
    const incident = {
      id: `inc-${Date.now()}`,
      name: data.name,
      owner: selectedBlock.owner,
      startDate: data.startDate || timelineToday,
      durationDays: data.durationDays,
      affectedOrderIds: data.affectedOrderIds,
      description: data.description,
      insertBeforeQueueIndex: data.insertBeforeQueueIndex,
      createdAt: new Date().toISOString(),
      createdBy: user?.name ?? "未知",
    };

    updatePersisted(
      (prev) => ({
        ...prev,
        incidents: [...prev.incidents, incident],
      }),
      {
        action: "create_incident",
        before: "",
        after: data.name,
        reason: data.description,
        affectedCount: data.affectedOrderIds.length,
      }
    );
    setModal(null);
    showToast(`突发事件「${data.name}」已创建，后续订单将顺延`);
  };

  const handleDeleteIncident = () => {
    if (!selectedBlock || selectedBlock.kind !== "incident") return;
    if (!canManageOwner(selectedBlock.owner)) return;
    const incidentId = selectedBlock.incidentId ?? selectedBlock.id;
    const incidentName = selectedBlock.label;
    if (!window.confirm(`确定删除突发事件「${incidentName}」吗？删除后相关订单排程会重新计算。`)) {
      return;
    }

    updatePersisted(
      (prev) => ({
        ...prev,
        incidents: prev.incidents.filter((incident) => incident.id !== incidentId),
      }),
      {
        action: "delete_incident",
        before: incidentName,
        after: "",
        reason: "删除突发事件",
        affectedCount: 1,
      }
    );
    setSelectedBlock(null);
    setDrawerOpen(false);
    showToast(`突发事件「${incidentName}」已删除`);
  };

  const handleSetInProgress = (startDate: string, processedTime: number) => {
    if (!selectedProject || !canManageOwner(selectedProject.owner)) return;
    const normalizedStartDate = startDate < timelineToday ? timelineToday : startDate;
    const k = roundTimelineTenth(
      Math.max(0, Math.min(selectedProject.estimatedDays, processedTime))
    );
    updatePersisted(
      (prev) => {
        const owner = selectedProject.owner;
        const states = sortOwnerQueueStates(
          prev.orderStates.filter((s) => s.owner === owner && s.status !== "complete")
        );
        const newOrder = [
          selectedProject.id,
          ...states.map((s) => s.projectId).filter((id) => id !== selectedProject.id),
        ];
        const orderStates = prev.orderStates.map((s) => {
          if (
            s.owner === owner &&
            s.status === "in_progress" &&
            s.projectId !== selectedProject.id
          ) {
            return resetToInitialPending(s);
          }
          if (s.projectId === selectedProject.id) {
            return {
              ...s,
              status: "in_progress" as const,
              workStartDate: normalizedStartDate,
              processedTime: k,
              restartExtra: 0,
              frozenAt: null,
              freezeReason: "",
              freezeNote: "",
              freezeByPriority: false,
              freezeByIncident: false,
              lastProgressUpdate: new Date().toISOString(),
            };
          }
          return s;
        });
        return {
          ...prev,
          orderStates: reindexOwnerQueue(orderStates, owner, newOrder),
          memberWorkStarts: {
            ...prev.memberWorkStarts,
            [owner]: normalizedStartDate,
          },
        };
      },
      {
        action: "set_work_start",
        before: selectedProject.contractNo,
        after: `${normalizedStartDate}, k=${k}`,
        reason: "标记当前处理订单",
        affectedCount: 1,
      }
    );
    restartFlowRun();
    showToast("已标记为正在处理");
  };

  const handleUnmarkInProgress = () => {
    if (!selectedProject || selectedOrderState?.status !== "in_progress") return;
    updatePersisted(
      (prev) => ({
        ...prev,
        orderStates: prev.orderStates.map((s) =>
          s.projectId === selectedProject.id ? resetToInitialPending(s) : s
        ),
      }),
      {
        action: "unmark_progress",
        before: selectedProject.contractNo,
        after: "pending",
        reason: "反标记处理，恢复未处理",
        affectedCount: 1,
      }
    );
    showToast("已反标记，订单恢复为未处理");
  };

  const handleUpdateProcessedTime = (processedTime: number) => {
    if (!selectedProject || selectedOrderState?.status !== "in_progress") return;
    const k = roundTimelineTenth(
      Math.max(0, Math.min(selectedProject.estimatedDays, processedTime))
    );
    updatePersisted(
      (prev) => ({
        ...prev,
        orderStates: prev.orderStates.map((s) =>
          s.projectId === selectedProject.id
            ? { ...s, processedTime: k, lastProgressUpdate: new Date().toISOString() }
            : s
        ),
      }),
      {
        action: "admin_intervention",
        before: selectedProject.contractNo,
        after: `k=${k}`,
        reason: "更新已处理时间",
        affectedCount: 1,
      }
    );
    showToast("已处理时间已更新");
  };

  if (!loaded) {
    return <EmptyState message="加载订单数据..." />;
  }

  if (projects.length === 0) {
    return (
      <EmptyState message="暂无未完成订单，请先在明细中导入或维护项目数据。" />
    );
  }

  const showWeeklyInGantt =
    expandedView && workdayOwner && weeklyWeeks.length > 0;

  const canEditOverviewWorkday =
    effectiveOverviewWorkdayOwner === ALL_OWNERS_WORKDAY_KEY
      ? configurableOverviewOwners.length > 0
      : effectiveOverviewWorkdayOwner
        ? canManageOwner(effectiveOverviewWorkdayOwner)
        : false;

  return (
    <div className="flex h-[calc(100vh-88px)] min-h-[600px] flex-col gap-2">
      <div className="shrink-0">
        <TimelineToolbar
          searchInput={searchInput}
          onSearchInputChange={handleSearchInputChange}
          onSearchSubmit={handleSearchSubmit}
          searchResults={searchResults}
          searchOpen={searchOpen}
          onSearchClose={() => setSearchOpen(false)}
          onSearchSelect={handleSearchSelect}
          ownerFilter={ownerFilter}
          onOwnerFilterChange={setOwnerFilter}
          departmentFilter={departmentFilter}
          onDepartmentFilterChange={setDepartmentFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onlyDelayed={onlyDelayed}
          onToggleDelayed={() => setOnlyDelayed((v) => !v)}
          owners={allOwnersFromData}
          members={memberSummaries.filter((m) =>
            user?.role === "member" ? m.owner === user.name : true
          )}
          focusedOwner={focusedOwner}
          onFocusOwner={handleFocusOwner}
          showOwnerSwitcher={showOwnerSwitcher}
          zoomLevel={zoomLevel}
          onZoomLevelChange={handleZoomChange}
        />
      </div>

      <div className="min-h-0 flex-1">
        <TimelineGantt
          owners={filteredOwners}
          schedules={schedules}
          workdayLookups={workdayLookups}
          rangeStart={dateRange.start}
          rangeEnd={dateRange.end}
          daysPerRow={zoomPreset.daysPerRow}
          overviewDayWidth={zoomPreset.overviewDayWidth}
          expanded={expandedView}
          selectedBlockId={selectedBlock?.id ?? null}
          highlightProjectId={highlightProjectId}
          searchHitProjectIds={searchHitProjectIdSet}
          onSelectBlock={openBlock}
          onFocusOwner={handleFocusOwner}
          scrollToOwner={scrollToOwner}
          scrollToProjectId={scrollToProjectId}
          flowRunVersion={flowRunVersion}
          filters={{
            onlyDelayed,
            onlyPriority,
            onlyFrozen,
            onlyIncident,
            statusFilter,
            dateFrom,
            dateTo,
          }}
          weeklyWeeks={showWeeklyInGantt ? weeklyWeeks : undefined}
          canEditWorkday={canEditWorkday}
          onWeekConfigChange={handleWeekConfigChange}
          overviewWorkdayOwners={overviewWorkdayOwnerSelectOptions}
          overviewWorkdayOwner={effectiveOverviewWorkdayOwner}
          onOverviewWorkdayOwnerChange={setOverviewWorkdayOwner}
          overviewWeeklyWeeks={!expandedView ? overviewWeeklyWeeks : undefined}
          canEditOverviewWorkday={canEditOverviewWorkday}
          onOverviewWeekConfigChange={handleOverviewWeekConfigChange}
          exportOwnerOptions={overviewOwnerOptions}
          onExportOrderSequence={handleExportOrderSequence}
        />
      </div>

      <TimelineRiskFooter count={riskSummary.count} messages={riskSummary.messages} />

      <TimelineDetailDrawer
        open={drawerOpen}
        block={selectedBlock}
        project={selectedProject}
        orderState={selectedOrderState}
        relatedItems={relatedItems}
        logs={persisted.operationLogs}
        canEdit={canEdit}
        isAdmin={isAdmin}
        onClose={() => setDrawerOpen(false)}
        onMoveUp={() =>
          selectedBlock?.projectId &&
          reorderOwnerQueue(selectedBlock.owner, selectedBlock.projectId, "up")
        }
        onMoveDown={() =>
          selectedBlock?.projectId &&
          reorderOwnerQueue(selectedBlock.owner, selectedBlock.projectId, "down")
        }
        onMoveTop={() =>
          selectedBlock?.projectId &&
          reorderOwnerQueue(selectedBlock.owner, selectedBlock.projectId, "top")
        }
        onMoveBottom={() =>
          selectedBlock?.projectId &&
          reorderOwnerQueue(selectedBlock.owner, selectedBlock.projectId, "bottom")
        }
        onUnmarkInProgress={handleUnmarkInProgress}
        onUpdateProcessedTime={handleUpdateProcessedTime}
        onOpenMarkInProgress={() => setModal("markInProgress")}
        onOpenPriorityInsert={() => {
          if (isSelectedQueueHead) {
            showToast("已在队首，无法插单");
            return;
          }
          if (selectedOrderState?.status === "frozen") {
            showToast("已冻结订单不可插单");
            return;
          }
          setModal("priority");
        }}
        isQueueHead={isSelectedQueueHead}
        onOpenFreeze={() => {
          if (selectedOrderState?.status !== "in_progress") {
            showToast("仅正在处理中的订单可冻结");
            return;
          }
          setModal("freeze");
        }}
        onUnfreeze={handleUnfreeze}
        onOpenRestart={() => setModal("restart")}
        onOpenIncident={() => setModal("incident")}
        onDeleteIncident={handleDeleteIncident}
        onUpdateEstimate={async (days) => {
          if (!selectedProject || !canEdit) return;
          try {
            const res = await fetch(`/api/projects/${selectedProject.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ estimatedComplexity: days }),
            });
            const data = (await res.json()) as Parameters<typeof projectToTimelineBase>[0] & {
              error?: string;
            };
            if (!res.ok) {
              showToast(data.error || "预计保存失败");
              return;
            }
            const base = projectToTimelineBase(data);
            setProjects((prev) =>
              prev.map((p) => (p.id === selectedProject.id ? base : p))
            );
            updatePersisted(
              (prev) => prev,
              {
                action: "update_estimate",
                before: String(selectedProject.estimatedDays),
                after: String(days),
                reason: "管理员修改预计（已写入数据库）",
                affectedCount: 1,
              }
            );
            showToast("预计时间已保存到数据库");
          } catch {
            showToast("预计保存失败，请稍后重试");
          }
        }}
        onSelectRelated={(projectId, owner) => {
          handleSearchSelect(projectId, owner);
        }}
        queuePosition={queuePosition}
      />

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      {modal === "priority" && selectedBlock && selectedProject ? (
        <PriorityInsertModal
          owner={selectedBlock.owner}
          defaultProjectId={selectedProject.id}
          queueProjects={priorityQueueProjects}
          insertOrderProjects={priorityInsertableProjects}
          isQueueHead={isSelectedQueueHead}
          onConfirm={handlePriorityInsert}
          onClose={() => setModal(null)}
        />
      ) : null}

      {modal === "markInProgress" && selectedProject ? (
        <MarkInProgressModal
          project={selectedProject}
          serverToday={timelineToday}
          onConfirm={(data) => {
            handleSetInProgress(data.startDate, data.processedTime);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      ) : null}

      {modal === "freeze" && selectedProject && selectedOrderState ? (
        <FreezeModal
          project={selectedProject}
          orderProcessedTime={selectedOrderState.processedTime}
          onConfirm={handleFreeze}
          onClose={() => setModal(null)}
        />
      ) : null}

      {modal === "restart" && selectedProject && selectedOrderState ? (
        <RestartModal
          project={selectedProject}
          processedTime={selectedOrderState.processedTime}
          onConfirm={handleRestart}
          onClose={() => setModal(null)}
        />
      ) : null}

      {modal === "incident" && selectedBlock ? (
        <IncidentModal
          owner={selectedBlock.owner}
          projects={projects}
          onConfirm={handleIncident}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}
