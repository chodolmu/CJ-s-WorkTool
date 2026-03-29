import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ScheduleItem, FeatureStatus } from "@shared/types";

type ScheduleView = "calendar" | "gantt";

const STATUS_COLORS: Record<FeatureStatus, string> = {
  pending: "bg-gray-500/20 border-gray-500/40 text-gray-400",
  in_progress: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  evaluating: "bg-yellow-500/20 border-yellow-500/40 text-yellow-400",
  completed: "bg-green-500/20 border-green-500/40 text-green-400",
  failed: "bg-red-500/20 border-red-500/40 text-red-400",
};

const STATUS_BAR_COLORS: Record<FeatureStatus, string> = {
  pending: "bg-gray-500/60",
  in_progress: "bg-blue-500/80",
  evaluating: "bg-yellow-500/80",
  completed: "bg-green-500/80",
  failed: "bg-red-500/60",
};

const STATUS_LABELS: Record<FeatureStatus, string> = {
  pending: "대기",
  in_progress: "진행중",
  evaluating: "검증중",
  completed: "완료",
  failed: "실패",
};

function parseDate(s: string): Date {
  return new Date(s);
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// ─── 캘린더 뷰 ───────────────────────────────

function CalendarView({ items }: { items: ScheduleItem[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  // 날짜별 아이템 매핑
  const itemsByDay = useMemo(() => {
    const map: Record<number, ScheduleItem[]> = {};
    for (const item of items) {
      const start = parseDate(item.estimatedStart);
      const end = parseDate(item.estimatedEnd);

      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(year, month, d);
        if (dayDate >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
            dayDate <= new Date(end.getFullYear(), end.getMonth(), end.getDate())) {
          if (!map[d]) map[d] = [];
          map[d].push(item);
        }
      }
    }
    return map;
  }, [items, year, month, daysInMonth]);

  const today = new Date();

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-bg-hover text-text-muted cursor-pointer">◀</button>
          <h2 className="text-base font-semibold text-text-primary min-w-[120px] text-center">
            {year}년 {month + 1}월
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-bg-hover text-text-muted cursor-pointer">▶</button>
        </div>
        <button onClick={goToday} className="px-3 py-1 text-xs rounded bg-accent/15 text-accent hover:bg-accent/25 cursor-pointer">
          오늘
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-border-subtle">
        {dayNames.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-medium py-1.5 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-text-muted"}`}>
            {d}
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-hidden">
        {/* 빈 셀 (월 시작 전) */}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`empty-${i}`} className="border-b border-r border-border-subtle/50 bg-bg-base/50" />
        ))}

        {/* 날짜 셀 */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayDate = new Date(year, month, day);
          const isToday = isSameDay(dayDate, today);
          const dayItems = itemsByDay[day] || [];
          const dayOfWeek = dayDate.getDay();

          return (
            <div
              key={day}
              className={`border-b border-r border-border-subtle/50 p-1 overflow-hidden flex flex-col ${
                isToday ? "bg-accent/5" : ""
              }`}
            >
              <span className={`text-[10px] font-medium mb-0.5 ${
                isToday ? "bg-accent text-white rounded-full w-5 h-5 flex items-center justify-center" :
                dayOfWeek === 0 ? "text-red-400" :
                dayOfWeek === 6 ? "text-blue-400" :
                "text-text-secondary"
              }`}>
                {day}
              </span>
              <div className="flex flex-col gap-px overflow-hidden flex-1">
                {dayItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className={`text-[8px] leading-tight px-1 py-px rounded truncate border ${STATUS_COLORS[item.status]}`}
                    title={`${item.projectName} — ${item.featureName} (${STATUS_LABELS[item.status]})`}
                  >
                    {item.featureName}
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <span className="text-[8px] text-text-muted">+{dayItems.length - 3}개</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 간트 차트 뷰 ──────────────────────────────

function GanttView({ items }: { items: ScheduleItem[] }) {
  const [selectedProject, setSelectedProject] = useState<string>("all");

  // 프로젝트 목록
  const projects = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => map.set(item.projectId, item.projectName));
    return Array.from(map.entries());
  }, [items]);

  const filtered = selectedProject === "all" ? items : items.filter((i) => i.projectId === selectedProject);

  // 타임라인 범위 계산
  const { startDate, endDate, totalDays } = useMemo(() => {
    if (filtered.length === 0) {
      const now = new Date();
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        totalDays: getDaysInMonth(now.getFullYear(), now.getMonth()),
      };
    }

    let minDate = new Date(filtered[0].estimatedStart);
    let maxDate = new Date(filtered[0].estimatedEnd);

    for (const item of filtered) {
      const s = new Date(item.estimatedStart);
      const e = new Date(item.estimatedEnd);
      if (s < minDate) minDate = s;
      if (e > maxDate) maxDate = e;
    }

    // 양쪽에 1일 패딩
    const start = new Date(minDate);
    start.setDate(start.getDate() - 1);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 1);

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { startDate: start, endDate: end, totalDays: Math.max(days, 7) };
  }, [filtered]);

  // 날짜 헤더 생성
  const dateHeaders = useMemo(() => {
    const headers: { date: Date; label: string; isToday: boolean; isWeekend: boolean }[] = [];
    const today = new Date();
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      headers.push({
        date: d,
        label: formatDate(d),
        isToday: isSameDay(d, today),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      });
    }
    return headers;
  }, [startDate, totalDays]);

  const dayWidth = Math.max(40, Math.min(80, 800 / totalDays));

  function getBarStyle(item: ScheduleItem) {
    const itemStart = new Date(item.estimatedStart);
    const itemEnd = new Date(item.estimatedEnd);
    const startOffset = Math.max(0, (itemStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, (itemEnd.getTime() - itemStart.getTime()) / (1000 * 60 * 60 * 24) + 1);
    return {
      left: `${startOffset * dayWidth}px`,
      width: `${duration * dayWidth}px`,
    };
  }

  function getActualBarStyle(item: ScheduleItem) {
    if (!item.actualStart) return null;
    const aStart = new Date(item.actualStart);
    const aEnd = item.actualEnd ? new Date(item.actualEnd) : new Date();
    const startOffset = Math.max(0, (aStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.max(0.5, (aEnd.getTime() - aStart.getTime()) / (1000 * 60 * 60 * 24) + 1);
    return {
      left: `${startOffset * dayWidth}px`,
      width: `${duration * dayWidth}px`,
    };
  }

  return (
    <div className="flex flex-col h-full">
      {/* 필터 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <span className="text-xs text-text-muted">프로젝트:</span>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="text-xs bg-bg-card border border-border-subtle rounded px-2 py-1 text-text-primary"
        >
          <option value="all">전체 ({items.length})</option>
          {projects.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        {/* 범례 */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-blue-500/60" />
            <span className="text-[10px] text-text-muted">예정</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-green-500/80 border border-green-400/50 border-dashed" />
            <span className="text-[10px] text-text-muted">실제</span>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-text-muted">
          <p className="text-sm">일정이 없습니다</p>
          <p className="text-xs mt-1">프로젝트에서 Pipeline을 실행하면 PM이 자동으로 일정을 생성합니다</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="flex">
            {/* 좌측 피처 라벨 */}
            <div className="sticky left-0 z-10 bg-bg-base border-r border-border-subtle shrink-0" style={{ width: "200px" }}>
              {/* 빈 헤더 */}
              <div className="h-[48px] border-b border-border-subtle flex items-end px-3 pb-1">
                <span className="text-[10px] text-text-muted font-medium">기능</span>
              </div>
              {/* 피처 행 */}
              {filtered.map((item) => (
                <div key={item.id} className="h-[44px] flex items-center px-3 border-b border-border-subtle/50 gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_BAR_COLORS[item.status]}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-text-primary truncate">{item.featureName}</p>
                    <p className="text-[9px] text-text-muted truncate">{item.projectName}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 우측 타임라인 */}
            <div className="flex-1 min-w-0">
              {/* 날짜 헤더 */}
              <div className="flex h-[48px] border-b border-border-subtle">
                {dateHeaders.map((h, i) => (
                  <div
                    key={i}
                    className={`shrink-0 flex flex-col items-center justify-end pb-1 border-r border-border-subtle/30 ${
                      h.isToday ? "bg-accent/10" : h.isWeekend ? "bg-bg-base/80" : ""
                    }`}
                    style={{ width: `${dayWidth}px` }}
                  >
                    <span className={`text-[9px] ${h.isToday ? "text-accent font-bold" : "text-text-muted"}`}>
                      {h.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* 바 행 */}
              {filtered.map((item) => {
                const barStyle = getBarStyle(item);
                const actualStyle = getActualBarStyle(item);

                return (
                  <div
                    key={item.id}
                    className="h-[44px] relative border-b border-border-subtle/50"
                    style={{ width: `${totalDays * dayWidth}px` }}
                  >
                    {/* 그리드 라인 */}
                    {dateHeaders.map((h, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 border-r border-border-subtle/20 ${
                          h.isToday ? "bg-accent/5" : h.isWeekend ? "bg-bg-base/30" : ""
                        }`}
                        style={{ left: `${i * dayWidth}px`, width: `${dayWidth}px` }}
                      />
                    ))}

                    {/* 예정 바 */}
                    <div
                      className={`absolute top-[8px] h-[12px] rounded-sm ${STATUS_BAR_COLORS[item.status]} opacity-60`}
                      style={barStyle}
                      title={`예정: ${item.estimatedStart.slice(0, 10)} ~ ${item.estimatedEnd.slice(0, 10)}`}
                    />

                    {/* 실제 진행 바 */}
                    {actualStyle && (
                      <div
                        className="absolute top-[24px] h-[12px] rounded-sm bg-green-500/80 border border-green-400/50 border-dashed"
                        style={actualStyle}
                        title={`실제: ${item.actualStart!.slice(0, 10)} ~ ${item.actualEnd?.slice(0, 10) ?? "진행중"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 SchedulePage ──────────────────────────

export function SchedulePage() {
  const [view, setView] = useState<ScheduleView>("calendar");
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();

    // 일정 변경 이벤트 리스닝
    if (window.harness) {
      const cleanup = window.harness.on("schedule:updated", () => {
        loadSchedule();
      });
      return cleanup;
    }
  }, []);

  async function loadSchedule() {
    setLoading(true);
    try {
      if (window.harness) {
        const data = await (window.harness as any).schedule.list();
        setItems(data);
      }
    } catch {
      // 첫 로드 실패 시 빈 배열 유지
    } finally {
      setLoading(false);
    }
  }

  // 상태별 통계
  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.status === "completed").length;
    const inProgress = items.filter((i) => i.status === "in_progress" || i.status === "evaluating").length;
    const overdue = items.filter((i) => {
      if (i.status === "completed") return false;
      return new Date(i.estimatedEnd) < new Date();
    }).length;
    return { total, completed, inProgress, overdue };
  }, [items]);

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in">
      {/* 페이지 헤더 */}
      <div className="px-6 pt-5 pb-3 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">일정</h1>
            <p className="text-xs text-text-secondary mt-0.5">
              전체 프로젝트 작업 일정 · {stats.total}개 작업
              {stats.overdue > 0 && <span className="text-red-400 ml-2">⚠ {stats.overdue}개 지연</span>}
            </p>
          </div>

          {/* 통계 뱃지 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="text-[10px] text-green-400">완료 {stats.completed}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <span className="text-[10px] text-blue-400">진행 {stats.inProgress}</span>
            </div>
          </div>
        </div>

        {/* 뷰 전환 탭 */}
        <div className="flex mt-3 bg-bg-card border border-border-subtle rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setView("calendar")}
            className={`px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
              view === "calendar" ? "bg-accent/15 text-accent font-medium" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            📅 캘린더
          </button>
          <button
            onClick={() => setView("gantt")}
            className={`px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
              view === "gantt" ? "bg-accent/15 text-accent font-medium" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            📊 간트 차트
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-text-muted text-sm">일정 로딩중...</div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {view === "calendar" ? (
                <CalendarView items={items} />
              ) : (
                <GanttView items={items} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
