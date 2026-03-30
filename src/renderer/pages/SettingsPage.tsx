import React, { useState, useEffect } from "react";
import { useAppStore } from "../stores/app-store";
import { toast } from "../components/Toast";

interface Settings {
  workingDir: string;
  defaultModel: "sonnet" | "opus" | "haiku";
  maxRetries: number;
  autoApprove: boolean;
  gitAutoCommit: boolean;
  gitBranchPerFeature: boolean;
}

const STORAGE_KEY = "worktool-settings";

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { workingDir: "", defaultModel: "sonnet", maxRetries: 10, autoApprove: false, gitAutoCommit: false, gitBranchPerFeature: false };
}

function saveSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const { claudeInstalled } = useAppStore();

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div className="space-y-6 max-w-lg animate-fade-in">
      <div>
        <h1 className="text-lg font-medium text-text-primary">설정</h1>
        <p className="text-xs text-text-muted mt-0.5">WorkTool 환경 설정</p>
      </div>

      {/* Working directory */}
      <SettingSection
        label="기본 작업 폴더"
        description="에이전트가 생성한 프로젝트가 저장되는 위치"
      >
        <div className="flex gap-2">
          <input
            value={settings.workingDir}
            onChange={(e) => update("workingDir", e.target.value)}
            placeholder="C:/Projects"
            className="flex-1 px-3 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
          />
          <button
            onClick={() => {
              // input 필드에 포커스 (직접 경로 입력)
              const input = document.querySelector<HTMLInputElement>('input[placeholder="C:/Projects"]');
              input?.focus();
              input?.select();
            }}
            className="px-3 py-2 bg-bg-card border border-border-subtle rounded-lg text-xs text-text-secondary hover:border-border-strong hover:bg-bg-hover cursor-pointer transition-all"
          >
            찾아보기
          </button>
        </div>
      </SettingSection>

      {/* Claude Code check */}
      <SettingSection
        label="Claude Code 상태"
        description="파이프라인 실행에 필요합니다"
      >
        <div className="p-3 bg-bg-card border border-border-subtle rounded-lg">
          <ClaudeCodeCheck initialInstalled={claudeInstalled} />
        </div>
      </SettingSection>

      {/* Agent defaults */}
      <SettingSection
        label="기본 에이전트 모델"
        description="새 에이전트 생성 시 사용되는 모델"
      >
        <div className="flex gap-2">
          {(["sonnet", "opus", "haiku"] as const).map((m) => (
            <button
              key={m}
              onClick={() => update("defaultModel", m)}
              className={`px-4 py-2 rounded-lg text-xs font-medium cursor-pointer border transition-all ${
                settings.defaultModel === m
                  ? "border-accent bg-accent/10 text-accent"
                  : "bg-bg-card border-border-subtle text-text-secondary hover:border-border-strong hover:bg-bg-hover"
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </SettingSection>

      {/* Max retries */}
      <SettingSection
        label="Evaluator 최대 재시도"
        description="Evaluator가 반려한 후 Generator가 재시도하는 횟수"
      >
        <div className="flex gap-2">
          {[3, 5, 10, 20].map((n) => (
            <button
              key={n}
              onClick={() => update("maxRetries", n)}
              className={`px-4 py-2 rounded-lg text-xs font-medium cursor-pointer border transition-all ${
                settings.maxRetries === n
                  ? "border-accent bg-accent/10 text-accent"
                  : "bg-bg-card border-border-subtle text-text-secondary hover:border-border-strong hover:bg-bg-hover"
              }`}
            >
              {n}회
            </button>
          ))}
        </div>
      </SettingSection>

      {/* Auto approve */}
      <SettingSection
        label="자동 진행 모드"
        description="체크포인트에서 자동으로 승인하여 중단 없이 파이프라인 실행"
      >
        <ToggleRow
          label="체크포인트 자동 승인"
          description="매 기능 완료 후 확인 없이 다음으로 자동 진행합니다"
          checked={settings.autoApprove}
          onChange={(v) => update("autoApprove", v)}
        />
      </SettingSection>

      {/* Keyboard shortcuts */}
      <SettingSection label="키보드 단축키" description="빠른 동작">
        <div className="space-y-1.5 text-xs">
          <ShortcutRow keys={["Ctrl", "N"]} action="새 프로젝트" />
          <ShortcutRow keys={["Ctrl", "1-7"]} action="페이지 이동" />
          <ShortcutRow keys={["Esc"]} action="패널 닫기 / 취소" />
          <ShortcutRow keys={["Enter"]} action="채팅 메시지 전송" />
          <ShortcutRow keys={["Shift", "Enter"]} action="채팅 줄바꿈" />
        </div>
      </SettingSection>

      {/* Advanced settings toggle */}
      <AdvancedSettings settings={settings} update={update} />

      {/* E2E 감사 */}
      <AuditSection />
    </div>
  );
}

function SettingSection({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary mb-1 block">{label}</label>
      {description && <p className="text-[11px] text-text-muted mb-2.5">{description}</p>}
      {children}
    </div>
  );
}

function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-text-secondary">{action}</span>
      <div className="flex gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="px-1.5 py-0.5 bg-bg-active border border-border-subtle rounded text-[10px] font-mono text-text-primary min-w-[22px] text-center"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function ClaudeCodeCheck({ initialInstalled }: { initialInstalled: boolean | null }) {
  const [status, setStatus] = useState<{ installed: boolean; version: string | null; message?: string } | null>(
    initialInstalled !== null ? { installed: initialInstalled, version: null } : null,
  );
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const result = await window.harness.system.checkClaudeCode();
      setStatus(result);
      if (result.installed) {
        toast("success", "Claude Code 발견", `버전: ${result.version}`);
      } else {
        toast("warning", "Claude Code 미발견", result.message);
      }
    } catch {
      setStatus({ installed: false, version: null, message: "확인 실패" });
    }
    setChecking(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        {status === null ? (
          <div className="w-2 h-2 rounded-full bg-status-neutral" />
        ) : status.installed ? (
          <div className="w-2 h-2 rounded-full bg-status-success" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-status-error" />
        )}
        <span className="text-xs text-text-primary">
          {status === null
            ? "아직 확인 안 됨"
            : status.installed
              ? `설치됨${status.version ? ` (${status.version})` : ""}`
              : "미설치"}
        </span>
        <button
          onClick={check}
          disabled={checking}
          className={`px-2.5 py-1 text-xs rounded-badge cursor-pointer transition-all ${
            checking
              ? "text-text-muted"
              : "text-accent hover:bg-accent/10"
          }`}
        >
          {checking ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-1.5 border-accent border-t-transparent rounded-full animate-spin" />
              확인중
            </span>
          ) : (
            "확인"
          )}
        </button>
      </div>
      {status && !status.installed && (
        <p className="text-xs text-status-error">
          {status.message ?? "Claude Code를 설치하세요: https://docs.anthropic.com/en/docs/claude-code"}
        </p>
      )}
    </div>
  );
}

function AdvancedSettings({ settings, update }: {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border-subtle pt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary cursor-pointer transition-colors"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        <span>고급 설정</span>
      </button>

      {open && (
        <div className="mt-4 space-y-5 pl-4 border-l-2 border-border-subtle animate-fade-in">
          {/* Git integration */}
          <SettingSection
            label="Git 연동"
            description="생성된 코드의 버전 관리 (git 설치 필요)"
          >
            <div className="space-y-3">
              <ToggleRow
                label="기능 완료 후 자동 커밋"
                description="Generator가 기능을 완료하면 자동으로 커밋합니다"
                checked={settings.gitAutoCommit}
                onChange={(v) => update("gitAutoCommit", v)}
              />
              <ToggleRow
                label="기능별 브랜치"
                description="각 기능마다 별도의 git 브랜치를 생성합니다"
                checked={settings.gitBranchPerFeature}
                onChange={(v) => update("gitBranchPerFeature", v)}
              />
            </div>
          </SettingSection>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="pt-0.5">
        <div
          onClick={() => onChange(!checked)}
          className={`w-8 h-[18px] rounded-full transition-colors relative cursor-pointer ${
            checked ? "bg-accent" : "bg-bg-active border border-border-strong"
          }`}
        >
          <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
            checked ? "translate-x-[16px]" : "translate-x-[2px]"
          }`} />
        </div>
      </div>
      <div>
        <div className="text-xs text-text-primary font-medium">{label}</div>
        <div className="text-[11px] text-text-muted">{description}</div>
      </div>
    </label>
  );
}

function AuditSection() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ test: string; pass: boolean; detail: string }[] | null>(null);

  const runAudit = async () => {
    if (!window.harness?.system?.runAudit) {
      toast("error", "감사 불가", "harness.system.runAudit이 없습니다.");
      return;
    }
    setRunning(true);
    setResults(null);
    try {
      const r = await window.harness.system.runAudit();
      setResults(r);
      const passed = r.filter((x: any) => x.pass).length;
      const failed = r.filter((x: any) => !x.pass).length;
      toast(failed === 0 ? "success" : "warning", "감사 완료", `${passed} 통과 / ${failed} 실패`);
    } catch (e: any) {
      toast("error", "감사 오류", e.message);
    } finally {
      setRunning(false);
    }
  };

  const passed = results?.filter(r => r.pass).length ?? 0;
  const failed = results?.filter(r => !r.pass).length ?? 0;

  return (
    <div className="border-t border-border-subtle pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-text-secondary">E2E 시스템 감사</div>
          <div className="text-[11px] text-text-muted">DB, CLI, 프리셋, 채팅 등 전체 기능 테스트</div>
        </div>
        <button
          onClick={runAudit}
          disabled={running}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer transition-all"
        >
          {running ? "테스트 중..." : "감사 실행"}
        </button>
      </div>

      {results && (
        <div className="space-y-1.5">
          <div className="text-xs text-text-secondary">
            {passed} 통과 / {failed} 실패 (총 {results.length})
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1 bg-bg-base rounded-lg p-2">
            {results.map((r, i) => (
              <div key={i} className={`text-[11px] flex gap-2 py-0.5 ${r.pass ? "text-status-success" : "text-status-error"}`}>
                <span className="shrink-0">{r.pass ? "\u2705" : "\u274C"}</span>
                <span className="font-medium shrink-0">{r.test}</span>
                <span className="text-text-muted truncate">{r.detail}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(results, null, 2));
              toast("success", "복사됨", "결과 JSON이 클립보드에 복사되었습니다.");
            }}
            className="text-[11px] text-accent hover:text-accent-hover cursor-pointer"
          >
            결과 JSON 복사 (공유용)
          </button>
        </div>
      )}
    </div>
  );
}
