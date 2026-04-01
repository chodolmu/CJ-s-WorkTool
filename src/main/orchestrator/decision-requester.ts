import { EventEmitter } from "events";

/**
 * Decision Requester
 *
 * 에이전트가 작업 중 사용자의 판단이 필요한 상황을 감지하고
 * 파이프라인을 일시정지한 후 사용자에게 질문
 *
 * 감지 패턴:
 *   1. AI 출력에 명시적 질문이 포함된 경우 ("should I", "어떤 걸", "which")
 *   2. 여러 선택지가 나열된 경우 ("Option A: ... Option B: ...")
 *   3. 불확실성 표현 ("I'm not sure", "확실하지 않", "could go either way")
 *   4. 리스크 경고 ("breaking change", "위험", "주의")
 */
export class DecisionRequester extends EventEmitter {
  private pendingDecision: PendingDecision | null = null;
  private decisionResolve: ((answer: string) => void) | null = null;

  /**
   * AI 출력을 분석하여 사용자 결정이 필요한지 판단
   * 필요하면 true 반환 + 질문 이벤트 발생
   */
  checkAndRequest(
    agentId: string,
    output: string,
    context: string,
  ): boolean {
    const detected = this.detectDecisionNeeded(output);
    if (!detected) return false;

    this.pendingDecision = {
      id: `decision-${Date.now()}`,
      agentId,
      question: detected.question,
      options: detected.options,
      context: context.slice(0, 300),
      severity: detected.severity,
    };

    this.emit("decision-needed", this.pendingDecision);
    return true;
  }

  /**
   * 파이프라인을 멈추고 사용자 응답 대기
   */
  async waitForDecision(): Promise<string> {
    if (!this.pendingDecision) return "";

    return new Promise((resolve) => {
      this.decisionResolve = resolve;
    });
  }

  /**
   * 사용자가 결정을 내림
   */
  respondToDecision(answer: string): void {
    if (this.decisionResolve) {
      this.decisionResolve(answer);
      this.decisionResolve = null;
      this.pendingDecision = null;
    }
  }

  /**
   * AI 출력에서 결정 필요 여부 감지
   */
  private detectDecisionNeeded(output: string): DetectedDecision | null {
    const text = output.toLowerCase();

    // 1. 명시적 질문 패턴 (한국어 + 영어)
    const questionPatterns = [
      /(?:should (?:I|we)|어떤 (?:걸|방식|방법|것)|어떻게|뭘 선택|which (?:one|approach|option)|do you (?:want|prefer))\s*(.{5,100})\??/i,
      /(?:선택해|결정해|알려줘|확인해|진행할까|let me know|please (?:decide|choose|confirm))\s*(.{3,100})/i,
      /(?:괜찮을까|맞을까|할까요|될까요|좋을까|어떨까)\s*\??/i,
    ];

    for (const pattern of questionPatterns) {
      const match = output.match(pattern);
      if (match) {
        return {
          question: match[0].trim(),
          options: this.extractOptions(output),
          severity: "normal",
        };
      }
    }

    // 2. 선택지 나열 패턴 (구분자 유연화)
    const optionPattern = /(?:option [a-c]|방법 [1-3]|approach [1-3]|안 [1-3]|방식 [1-3])[\s:은는이가]/gi;
    const optionMatches = output.match(optionPattern);
    if (optionMatches && optionMatches.length >= 2) {
      return {
        question: "여러 선택지가 있습니다. 어떤 방향으로 진행할까요?",
        options: this.extractOptions(output),
        severity: "normal",
      };
    }

    // 3. 불확실성 패턴 (? 없이도 감지)
    const uncertaintyPatterns = [
      /(?:not sure|확실하지 않|확실하지않|불확실|unclear|애매|either way|판단이 필요|depends on|확인이 필요|검토가 필요)/i,
    ];
    for (const pattern of uncertaintyPatterns) {
      if (pattern.test(text)) {
        const questionLine = output.split("\n").find((l) => l.includes("?"));
        return {
          question: questionLine?.trim() ?? "확실하지 않은 부분이 있습니다. 확인이 필요합니다.",
          options: this.extractOptions(output),
          severity: "normal",
        };
      }
    }

    // 4. 리스크/경고 패턴 (심각도 높음 — ? 없이도 감지)
    const riskPatterns = [
      /(?:breaking change|호환성|기존.*깨|destructive|데이터.*손실|삭제.*위험|주의.*필요)/i,
    ];
    for (const pattern of riskPatterns) {
      if (pattern.test(text)) {
        const questionLine = output.split("\n").find((l) => l.includes("?"));
        return {
          question: questionLine?.trim() ?? "주의가 필요한 변경사항이 있습니다.",
          options: this.extractOptions(output),
          severity: "high",
        };
      }
    }

    return null;
  }

  /**
   * AI 출력에서 선택지 추출
   */
  private extractOptions(output: string): string[] {
    const options: string[] = [];

    // "1. xxx" 또는 "- xxx" 또는 "Option A: xxx" 패턴
    const lines = output.split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*(?:\d+[\.\)]\s*|[-*]\s*|(?:Option|방법|안)\s*[A-C1-3][\s:]+)(.{5,100})/);
      if (match) {
        options.push(match[1].trim());
      }
    }

    // 선택지가 없으면 기본 옵션
    if (options.length === 0) {
      return ["AI가 알아서 결정", "직접 지시하기"];
    }

    return options.slice(0, 5); // 최대 5개
  }
}

export interface PendingDecision {
  id: string;
  agentId: string;
  question: string;
  options: string[];
  context: string;
  severity: "normal" | "high";
}

interface DetectedDecision {
  question: string;
  options: string[];
  severity: "normal" | "high";
}
