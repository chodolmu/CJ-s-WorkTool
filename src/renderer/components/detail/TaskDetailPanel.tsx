import React, { useEffect, useState } from "react";
import { useAppStore } from "../../stores/app-store";
import type {
  Task,
  TaskHandoff,
  ValidationResult,
  TaskLog,
} from "@shared/types";

declare const window: Window & { harness: any };

interface TaskDetail {
  task: Task;
  handoff: TaskHandoff | null;
  validation: ValidationResult | null;
  logs: TaskLog[];
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-600 text-gray-200",
  queued: "bg-yellow-700 text-yellow-100",
  running: "bg-blue-600 text-blue-100",
  completed: "bg-green-700 text-green-100",
  failed: "bg-red-700 text-red-100",
  skipped: "bg-gray-500 text-gray-200",
};

const statusLabels: Record<string, string> = {
  pending: "대기",
  queued: "큐",
  running: "실행중",
  completed: "완료",
  failed: "실패",
  skipped: "건너뜀",
};

const modelColors: Record<string, string> = {
  haiku: "bg-emerald-700 text-emerald-100",
  sonnet: "bg-violet-700 text-violet-100",
  opus: "bg-amber-700 text-amber-100",
};

const difficultyLabels: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

export function TaskDetailPanel() {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  useEffect(() => {
    if (!selectedTaskId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    window.harness.data
      .getTaskDetail(selectedTaskId)
      .then((d: TaskDetail) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [selectedTaskId]);

  if (!selectedTaskId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>태스크를 선택하세요</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>로딩중...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>태스크 정보를 불러올 수 없습니다</p>
      </div>
    );
  }

  const { task, handoff, validation, logs } = detail;

  const handleRetry = () => {
    window.harness.execution.retryTask(task.id);
  };

  const handleSkip = () => {
    window.harness.execution.skipTask(task.id);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-100">{task.name}</h2>
          <span
            className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[task.status] ?? "bg-gray-600 text-gray-200"}`}
          >
            {statusLabels[task.status] ?? task.status}
          </span>
          <span
            className={`px-2 py-0.5 text-xs rounded-full font-medium ${modelColors[task.model] ?? "bg-gray-600 text-gray-200"}`}
          >
            {task.model}
          </span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-700 text-gray-300">
            {difficultyLabels[task.difficulty] ?? task.difficulty}
          </span>
        </div>
        <p className="text-sm text-gray-400">{task.description}</p>
      </div>

      {/* Plan */}
      <section>
        <h3 className="text-sm font-medium text-gray-300 mb-1">실행 계획</h3>
        <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-3 whitespace-pre-wrap overflow-x-auto">
          {task.plan || "(계획 없음)"}
        </pre>
      </section>

      {/* Handoff */}
      {handoff && (
        <section>
          <h3 className="text-sm font-medium text-gray-300 mb-1">핸드오프</h3>
          <div className="bg-gray-900 rounded-lg p-3 space-y-2 text-xs">
            <div>
              <span className="text-gray-500">요약: </span>
              <span className="text-gray-300">{handoff.summary}</span>
            </div>
            {handoff.filesChanged.length > 0 && (
              <div>
                <span className="text-gray-500">변경 파일: </span>
                <span className="text-gray-300">
                  {handoff.filesChanged.join(", ")}
                </span>
              </div>
            )}
            {handoff.designDecisions.length > 0 && (
              <div>
                <span className="text-gray-500">설계 결정: </span>
                <ul className="list-disc list-inside text-gray-300 mt-0.5">
                  {handoff.designDecisions.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {handoff.knownIssues.length > 0 && (
              <div>
                <span className="text-gray-500">알려진 이슈: </span>
                <ul className="list-disc list-inside text-yellow-400 mt-0.5">
                  {handoff.knownIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Validation */}
      {validation && (
        <section>
          <h3 className="text-sm font-medium text-gray-300 mb-1">검증 결과</h3>
          <div className="bg-gray-900 rounded-lg p-3 space-y-1">
            {validation.results.map((check, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={check.passed ? "text-green-400" : "text-red-400"}>
                  {check.passed ? "✓" : "✗"}
                </span>
                <span className="text-gray-400">{check.check}</span>
                {check.message && (
                  <span className="text-gray-500">— {check.message}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Logs (collapsible) */}
      {logs.length > 0 && (
        <section>
          <button
            onClick={() => setLogsOpen(!logsOpen)}
            className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-gray-100 transition-colors cursor-pointer"
          >
            <span className={`transition-transform ${logsOpen ? "rotate-90" : ""}`}>
              ▶
            </span>
            로그 ({logs.length})
          </button>
          {logsOpen && (
            <div className="mt-1 bg-gray-900 rounded-lg p-3 max-h-60 overflow-y-auto space-y-0.5">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-2 text-xs font-mono">
                  <span className="text-gray-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-gray-500 shrink-0 w-16">
                    [{log.eventType}]
                  </span>
                  <span className="text-gray-400">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Action buttons */}
      {(task.status === "failed" || task.status === "pending") && (
        <div className="flex gap-2 pt-2 border-t border-gray-700">
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
          >
            재시도
          </button>
          <button
            onClick={handleSkip}
            className="px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            건너뛰기
          </button>
        </div>
      )}
    </div>
  );
}
