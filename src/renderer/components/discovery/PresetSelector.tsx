import React from "react";
import type { Preset } from "@shared/types";

interface PresetSelectorProps {
  presets: Preset[];
  onSelect: (preset: Preset) => void;
}

const presetIcons: Record<string, string> = {
  game: "🎮",
  webapp: "🌐",
  mobile: "📱",
};

export function PresetSelector({ presets, onSelect }: PresetSelectorProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-2xl font-bold text-text-primary mb-2">
        New Project
      </h1>
      <p className="text-text-secondary mb-8 text-sm">
        What kind of project are you building?
      </p>

      <div className="flex gap-4">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className="flex flex-col items-center gap-3 p-6 w-40 bg-bg-card border border-border-subtle rounded-card hover:border-accent hover:bg-bg-hover transition-all cursor-pointer"
          >
            <span className="text-4xl">
              {presetIcons[preset.id] ?? "⚙️"}
            </span>
            <span className="text-sm font-medium text-text-primary">
              {preset.name}
            </span>
            <span className="text-xs text-text-secondary text-center">
              {preset.description}
            </span>
          </button>
        ))}

        {/* Custom preset placeholder */}
        <button className="flex flex-col items-center gap-3 p-6 w-40 bg-bg-card border border-border-subtle border-dashed rounded-card hover:border-accent hover:bg-bg-hover transition-all cursor-pointer opacity-50">
          <span className="text-4xl">➕</span>
          <span className="text-sm font-medium text-text-primary">Custom</span>
          <span className="text-xs text-text-secondary text-center">
            Coming soon
          </span>
        </button>
      </div>
    </div>
  );
}
