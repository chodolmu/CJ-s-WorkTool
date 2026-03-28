import React, { useState } from "react";
import type { AgentDefinition } from "@shared/types";

interface AgentEditorSimpleProps {
  projectId: string;
  presetId: string;
  onGenerated: (agent: AgentDefinition) => void;
  onSwitchToAdvanced: (agent: AgentDefinition) => void;
  onCancel: () => void;
}

type Phase = "input" | "loading" | "clarify" | "review";

interface ClarifyQuestion {
  question: string;
  options: { label: string; value: string }[];
  allowFreeText: boolean;
}

export function AgentEditorSimple({
  projectId,
  presetId,
  onGenerated,
  onSwitchToAdvanced,
  onCancel,
}: AgentEditorSimpleProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [generatedAgent, setGeneratedAgent] = useState<AgentDefinition | null>(null);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setPhase("loading");

    try {
      const result = await window.harness.agent.generateGuidelines(
        projectId,
        presetId,
        description,
      );

      if (result.needsClarification && result.clarificationQuestions) {
        setQuestions(result.clarificationQuestions);
        setPhase("clarify");
      } else if (result.generatedAgent) {
        setGeneratedAgent(result.generatedAgent);
        setPhase("review");
      }
    } catch {
      // 에러 시 기본 에이전트로 폴백
      setGeneratedAgent({
        id: "custom-agent",
        displayName: "커스텀 에이전트",
        icon: "🤖",
        role: description,
        goal: description,
        constraints: [],
        model: "sonnet",
        trigger: "manual",
        guidelines: [],
        outputFormat: "",
      });
      setPhase("review");
    }
  };

  // Phase: 입력
  if (phase === "input") {
    return (
      <div className="p-5 space-y-4">
        <h3 className="text-sm font-medium text-text-primary">새 에이전트</h3>
        <p className="text-xs text-text-secondary">
          이 에이전트가 할 일을 설명해주세요. AI가 상세 가이드라인을 생성합니다.
        </p>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. 게임 밸런스를 검증하는 역할이야"
          className="w-full h-24 px-3 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
          autoFocus
        />

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer">
            취소
          </button>
          <button
            onClick={handleGenerate}
            disabled={!description.trim()}
            className="px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-button text-xs font-medium cursor-pointer"
          >
            가이드라인 생성 →
          </button>
        </div>
      </div>
    );
  }

  // Phase: 로딩
  if (phase === "loading") {
    return (
      <div className="p-5 flex flex-col items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-text-secondary">AI가 가이드라인을 생성 중...</p>
      </div>
    );
  }

  // Phase: 추가 질문
  if (phase === "clarify") {
    return (
      <div className="p-5 space-y-4">
        <h3 className="text-sm font-medium text-text-primary">몇 가지 더 질문이 있어요</h3>
        {questions.map((q, i) => (
          <div key={i} className="space-y-2">
            <p className="text-xs text-text-secondary">{q.question}</p>
            <div className="space-y-1">
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    // 질문에 답하고 다시 생성
                    setDescription((prev) => `${prev}. ${q.question}: ${opt.label}`);
                    setPhase("input");
                  }}
                  className="w-full text-left px-3 py-2 bg-bg-card border border-border-subtle rounded-lg text-xs text-text-primary hover:border-accent cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Phase: 리뷰
  if (phase === "review" && generatedAgent) {
    return (
      <div className="p-5 space-y-4">
        <h3 className="text-sm font-medium text-text-primary">
          {generatedAgent.icon} {generatedAgent.displayName}
        </h3>

        <div className="space-y-2">
          <Field label="역할" value={generatedAgent.role} />
          <Field label="목표" value={generatedAgent.goal} />
          <Field label="모델" value={generatedAgent.model} />

          <div>
            <span className="text-xs text-text-secondary">가이드라인:</span>
            <ul className="mt-1 space-y-0.5">
              {generatedAgent.guidelines.map((g, i) => (
                <li key={i} className="text-xs text-text-primary pl-2 border-l-2 border-border-subtle">
                  {g}
                </li>
              ))}
            </ul>
          </div>

          {generatedAgent.constraints.length > 0 && (
            <div>
              <span className="text-xs text-text-secondary">제약조건:</span>
              <ul className="mt-1 space-y-0.5">
                {generatedAgent.constraints.map((c, i) => (
                  <li key={i} className="text-xs text-text-primary pl-2 border-l-2 border-status-warning/30">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-xs text-text-muted">
          방향이 맞나요? 승인하거나, 다시 생성하거나, 상세 편집으로 전환할 수 있습니다.
        </p>

        <div className="flex justify-end gap-2">
          <button onClick={() => setPhase("input")} className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer">
            다시 생성
          </button>
          <button
            onClick={() => onSwitchToAdvanced(generatedAgent)}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary border border-border-subtle rounded cursor-pointer"
          >
            상세 편집
          </button>
          <button
            onClick={() => onGenerated(generatedAgent)}
            className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-button text-xs font-medium cursor-pointer"
          >
            저장
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-text-secondary">{label}:</span>
      <span className="text-xs text-text-primary ml-1">{value}</span>
    </div>
  );
}
