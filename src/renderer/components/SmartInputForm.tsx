import React, { useState } from "react";
import { motion } from "framer-motion";
import type { SmartInputRequest, SmartQuestion } from "@shared/types";

interface SmartInputFormProps {
  request: SmartInputRequest;
  onSubmit: (answers: Record<string, string>) => void;
  onSkip: () => void;
}

export function SmartInputForm({ request, onSubmit, onSkip }: SmartInputFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const allRequiredAnswered = request.questions
    .filter((q) => q.required)
    .every((q) => answers[q.id]?.trim());

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-3 p-4 rounded-lg border border-accent/20 bg-accent/5"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📝</span>
        <span className="text-sm font-medium text-text-primary">확인이 필요합니다</span>
        <span className="text-[10px] text-text-muted ml-auto">{request.phase} 단계</span>
      </div>

      {request.context && (
        <p className="text-xs text-text-secondary mb-3">{request.context}</p>
      )}

      {/* Questions */}
      <div className="space-y-3">
        {request.questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id] ?? ""}
            onChange={(v) => setAnswer(q.id, v)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={() => onSubmit(answers)}
          disabled={!allRequiredAnswered}
          className="px-4 py-2 bg-accent text-white rounded-md text-xs font-medium hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          확인
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2 bg-bg-card border border-border-subtle text-text-secondary rounded-md text-xs hover:border-border-strong transition-all cursor-pointer"
        >
          건너뛰기
        </button>
        <span className="text-[10px] text-text-muted ml-auto">건너뛰면 AI가 기본값으로 진행</span>
      </div>
    </motion.div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: SmartQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-primary mb-1.5 block">
        {question.question}
        {question.required && <span className="text-status-error ml-0.5">*</span>}
      </label>

      {question.type === "select" && question.options && (
        <div className="flex flex-wrap gap-1.5">
          {question.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer border ${
                value === opt.value
                  ? "bg-accent text-white border-accent"
                  : "bg-bg-card border-border-subtle text-text-primary hover:border-border-strong"
              }`}
              title={opt.description}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {question.type === "multiselect" && question.options && (
        <div className="flex flex-wrap gap-1.5">
          {question.options.map((opt) => {
            const selected = (value || "").split(",").includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => {
                  const current = new Set((value || "").split(",").filter(Boolean));
                  if (selected) current.delete(opt.value);
                  else current.add(opt.value);
                  onChange(Array.from(current).join(","));
                }}
                className={`px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer border ${
                  selected
                    ? "bg-accent/20 text-accent border-accent/40"
                    : "bg-bg-card border-border-subtle text-text-primary hover:border-border-strong"
                }`}
              >
                {selected ? "✓ " : ""}{opt.label}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "confirm" && (
        <div className="flex gap-2">
          <button
            onClick={() => onChange("yes")}
            className={`px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer border ${
              value === "yes" ? "bg-accent text-white border-accent" : "bg-bg-card border-border-subtle text-text-primary hover:border-border-strong"
            }`}
          >
            예
          </button>
          <button
            onClick={() => onChange("no")}
            className={`px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer border ${
              value === "no" ? "bg-status-error/20 text-status-error border-status-error/40" : "bg-bg-card border-border-subtle text-text-primary hover:border-border-strong"
            }`}
          >
            아니요
          </button>
        </div>
      )}

      {question.type === "text" && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.defaultValue || "입력해주세요..."}
          rows={2}
          className="w-full px-3 py-2 text-xs bg-bg-card border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none"
        />
      )}
    </div>
  );
}
