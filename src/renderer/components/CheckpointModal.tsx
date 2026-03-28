import React from "react";
import { motion } from "framer-motion";

interface CheckpointModalProps {
  checkpoint: {
    id: string;
    type: string;
    data: {
      message?: string;
      features?: { name: string; description: string }[];
      featureName?: string;
      featureIndex?: number;
      totalFeatures?: number;
    };
  };
  onRespond: (action: "approve" | "cancel") => void;
}

export function CheckpointModal({ checkpoint, onRespond }: CheckpointModalProps) {
  const { type, data } = checkpoint;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onRespond("cancel")}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-bg-card border border-border-subtle rounded-card card-shadow overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3 bg-accent/5 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">
              {type === "planner_complete" && "📋"}
              {type === "feature_complete" && "✅"}
              {type === "feature_failed" && "❌"}
              {type === "pipeline_complete" && "🎉"}
            </span>
            <span className="text-sm font-medium text-text-primary">
              {type === "planner_complete" && "기획 완료"}
              {type === "feature_complete" && "기능 완료"}
              {type === "feature_failed" && "기능 실패"}
              {type === "pipeline_complete" && "모두 완료!"}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-sm text-text-primary mb-4">
            {data.message}
          </p>

          {/* Feature list (planner complete) */}
          {data.features && (
            <div className="max-h-60 overflow-y-auto space-y-1.5 mb-4">
              {data.features.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2 p-2.5 bg-bg-hover rounded-md border border-border-subtle"
                >
                  <span className="text-xs text-text-muted mt-0.5 w-5 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <div>
                    <div className="text-sm text-text-primary font-medium">
                      {f.name}
                    </div>
                    {f.description && (
                      <div className="text-xs text-text-secondary mt-0.5">
                        {f.description}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Progress indicator */}
          {data.featureIndex != null && data.totalFeatures != null && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>{data.featureName}</span>
                <span>{data.featureIndex}/{data.totalFeatures}</span>
              </div>
              <div className="w-full h-1.5 bg-bg-active rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(data.featureIndex / data.totalFeatures) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full bg-accent rounded-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border-subtle">
          <button
            onClick={() => onRespond("cancel")}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer rounded-button hover:bg-bg-hover"
          >
            취소
          </button>
          <button
            onClick={() => onRespond("approve")}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-button text-sm font-medium transition-all cursor-pointer active:scale-[0.98]"
          >
            {type === "planner_complete" ? "빌드 시작" :
             type === "feature_complete" ? "계속" :
             type === "feature_failed" ? "건너뛰기" :
             "완료"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
