import React, { useState } from "react";
import type { DiscoveryQuestion, DiscoveryAnswer } from "@shared/types";

interface QuestionWizardProps {
  question: DiscoveryQuestion;
  currentStep: number;
  totalSteps: number;
  existingAnswer?: DiscoveryAnswer;
  onAnswer: (answer: DiscoveryAnswer) => void;
  onBack: () => void;
}

export function QuestionWizard({
  question,
  currentStep,
  totalSteps,
  existingAnswer,
  onAnswer,
  onBack,
}: QuestionWizardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    existingAnswer?.selectedOption ?? null,
  );
  const [freeText, setFreeText] = useState(existingAnswer?.freeText ?? "");
  const [showFreeText, setShowFreeText] = useState(
    existingAnswer?.freeText ? true : false,
  );

  const handleSelect = (value: string) => {
    setSelectedOption(value);
    setShowFreeText(false);

    // 자동 진행 (선택하면 바로 다음)
    onAnswer({
      questionId: question.id,
      question: question.question,
      selectedOption: value,
      freeText: null,
    });
  };

  const handleFreeTextSubmit = () => {
    if (!freeText.trim()) return;
    onAnswer({
      questionId: question.id,
      question: question.question,
      selectedOption: null,
      freeText: freeText.trim(),
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="w-full mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-secondary">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-xs text-text-muted">
            {Math.round(((currentStep + 1) / totalSteps) * 100)}%
          </span>
        </div>
        <div className="w-full h-1 bg-bg-active rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{
              width: `${((currentStep + 1) / totalSteps) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question */}
      <h2 className="text-lg font-medium text-text-primary mb-6 text-center">
        {question.question}
      </h2>

      {/* Options */}
      <div className="w-full space-y-2 mb-4">
        {question.options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`
              w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left cursor-pointer
              ${
                selectedOption === option.value
                  ? "border-accent bg-accent/10"
                  : "border-border-subtle bg-bg-card hover:border-border-strong hover:bg-bg-hover"
              }
            `}
          >
            <div
              className={`
              w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 transition-colors
              ${
                selectedOption === option.value
                  ? "border-accent bg-accent"
                  : "border-border-strong"
              }
            `}
            />
            <div>
              <div className="text-sm font-medium text-text-primary">
                {option.label}
              </div>
              {option.description && (
                <div className="text-xs text-text-secondary mt-0.5">
                  {option.description}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Free text option */}
      {question.allowFreeText && (
        <div className="w-full">
          {!showFreeText ? (
            <button
              onClick={() => setShowFreeText(true)}
              className="text-xs text-accent hover:text-accent-hover cursor-pointer"
            >
              Or type your own answer...
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFreeTextSubmit()}
                placeholder="Type your answer..."
                className="flex-1 px-3 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                autoFocus
              />
              <button
                onClick={handleFreeTextSubmit}
                disabled={!freeText.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Back button */}
      <button
        onClick={onBack}
        className="mt-8 text-xs text-text-muted hover:text-text-secondary cursor-pointer"
      >
        ← Back
      </button>
    </div>
  );
}
