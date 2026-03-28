import type { MemoryManager } from "./memory-manager";

/**
 * 에이전트 학습 관리자
 *
 * Evaluator가 반려할 때마다 그 피드백 패턴을 기록하고,
 * 다음 Generator 호출 시 축적된 교훈을 프롬프트에 주입
 *
 * 학습 흐름:
 *   Evaluator fail → extractLessons() → 패턴 저장
 *   Generator 호출 전 → getLessonsForPrompt() → 프롬프트에 주입
 */
export class LearningManager {
  constructor(private memoryManager: MemoryManager) {}

  /**
   * Evaluator 피드백에서 교훈 추출 및 저장
   */
  extractAndSave(
    projectId: string,
    evaluatorOutput: string,
    featureName: string,
  ): void {
    const lessons = this.extractLessons(evaluatorOutput);

    for (const lesson of lessons) {
      // 중복 확인 (비슷한 패턴이 이미 있으면 스킵)
      const existing = this.memoryManager.getLearnings(projectId, "evaluator");
      const isDuplicate = existing.some(
        (e) => e.pattern === lesson.pattern || e.lesson === lesson.lesson,
      );
      if (isDuplicate) continue;

      this.memoryManager.addLearning(
        projectId,
        "evaluator",
        lesson.pattern,
        lesson.lesson,
        `Feature: ${featureName}`,
      );
    }
  }

  /**
   * Generator 프롬프트에 주입할 교훈 목록 생성
   */
  getLessonsForPrompt(projectId: string, maxLessons: number = 10): string {
    const learnings = this.memoryManager.getLearnings(projectId);

    if (learnings.length === 0) return "";

    // 최근 N개 교훈만
    const recent = learnings.slice(0, maxLessons);

    const lines = [
      "## Lessons Learned (from previous evaluations)",
      "The following issues were found in previous work. DO NOT repeat these mistakes:",
      "",
    ];

    for (const learning of recent) {
      lines.push(`- **${learning.pattern}**: ${learning.lesson}`);
    }

    return lines.join("\n");
  }

  /**
   * Evaluator 출력에서 구조화된 교훈 추출
   */
  private extractLessons(output: string): { pattern: string; lesson: string }[] {
    const lessons: { pattern: string; lesson: string }[] = [];

    // JSON findings 추출 시도
    try {
      const findingsMatch = output.match(/"findings"\s*:\s*\[[\s\S]*?\]/);
      if (findingsMatch) {
        const findings = JSON.parse(`{${findingsMatch[0]}}`).findings;
        for (const f of findings) {
          if (f.severity === "error" || f.severity === "warning") {
            lessons.push({
              pattern: this.categorize(f.message),
              lesson: f.message,
            });
          }
        }
        return lessons;
      }
    } catch { /* not JSON, try text patterns */ }

    // 텍스트 패턴 매칭
    const patterns = [
      { regex: /(?:error|bug|issue|problem|fail)[\s:]+(.+)/gi, category: "Bug" },
      { regex: /(?:missing|forgot|없|누락)[\s:]+(.+)/gi, category: "Missing" },
      { regex: /(?:should|must|need|필요|해야)[\s:]+(.+)/gi, category: "Requirement" },
      { regex: /(?:instead of|대신|바꿔야)[\s:]+(.+)/gi, category: "Wrong Approach" },
    ];

    for (const { regex, category } of patterns) {
      let match;
      while ((match = regex.exec(output)) !== null) {
        const lesson = match[1].trim().slice(0, 200);
        if (lesson.length > 10) {
          lessons.push({ pattern: category, lesson });
        }
      }
    }

    // 아무것도 추출 못하면 전체를 하나의 교훈으로
    if (lessons.length === 0 && output.includes("fail")) {
      const summary = output
        .split("\n")
        .filter((l) => l.trim().length > 20)
        .slice(0, 3)
        .join("; ")
        .slice(0, 300);

      if (summary) {
        lessons.push({ pattern: "General", lesson: summary });
      }
    }

    return lessons;
  }

  private categorize(message: string): string {
    const msg = message.toLowerCase();
    if (msg.includes("type") || msg.includes("타입")) return "Type Error";
    if (msg.includes("import") || msg.includes("require")) return "Import Error";
    if (msg.includes("style") || msg.includes("css") || msg.includes("ui")) return "UI Issue";
    if (msg.includes("test") || msg.includes("테스트")) return "Test Failure";
    if (msg.includes("logic") || msg.includes("로직")) return "Logic Error";
    if (msg.includes("performance") || msg.includes("성능")) return "Performance";
    return "General";
  }
}
