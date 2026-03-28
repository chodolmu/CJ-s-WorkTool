import type { MemoryManager } from "../memory/memory-manager";
import type { CLIBridge } from "../agent-runner/cli-bridge";

/**
 * 반복 작업 자동 스킬 감지기 (베타 역할)
 *
 * Generator가 만든 코드 패턴을 분석하고,
 * 반복되는 패턴을 발견하면 자동으로 스킬/템플릿으로 추출
 *
 * 감지 방식:
 *   1. 파일명 패턴: 같은 패턴의 파일이 3개 이상 생성되면 감지
 *      예: LoginPage.tsx, SignupPage.tsx, ProfilePage.tsx → "Page 컴포넌트" 스킬
 *   2. 코드 구조 패턴: 비슷한 import/export/구조가 반복되면 감지
 *   3. Agent run 기록 분석: 비슷한 task description이 반복되면 감지
 */
export class SkillDetector {
  constructor(
    private memoryManager: MemoryManager,
    private cliBridge: CLIBridge,
  ) {}

  /**
   * Generator 실행 후 스킬 감지 실행
   * filesChanged를 분석하여 패턴 감지
   */
  async detectAfterRun(
    projectId: string,
    filesChanged: string[],
    changeSummary: string,
  ): Promise<DetectedSkill[]> {
    const detected: DetectedSkill[] = [];

    // 1. 파일명 패턴 감지
    const filePatterns = this.detectFilePatterns(projectId, filesChanged);
    detected.push(...filePatterns);

    // 2. 반복 작업 패턴 감지 (agent_runs 기록 기반)
    const taskPatterns = this.detectTaskPatterns(projectId, changeSummary);
    detected.push(...taskPatterns);

    // 이미 등록된 스킬과 중복 제거
    const existingSkills = this.memoryManager.getSkills(projectId);
    const existingNames = new Set(existingSkills.map((s) => s.name));

    const newSkills = detected.filter((s) => !existingNames.has(s.name));

    // 자동 저장
    for (const skill of newSkills) {
      this.memoryManager.addSkill(
        projectId,
        skill.name,
        skill.description,
        skill.pattern,
        skill.template,
      );
    }

    return newSkills;
  }

  /**
   * 파일명 패턴 감지
   * 같은 접미사/디렉토리 패턴의 파일이 누적되면 스킬로 추출
   */
  private detectFilePatterns(projectId: string, newFiles: string[]): DetectedSkill[] {
    const detected: DetectedSkill[] = [];

    // 기존 agent_runs에서 filesChanged 수집 (최대 20개 run)
    // 현재 DB에서 직접 가져올 수 없으므로 newFiles 기반으로만 분석
    // TODO: agent_runs에서 files_changed_json 집계

    // 파일 확장자 + 디렉토리 패턴
    const patterns = new Map<string, string[]>();
    for (const file of newFiles) {
      const parts = file.split("/");
      const name = parts[parts.length - 1];

      // Page 패턴: *Page.tsx
      if (name.match(/\w+Page\.tsx$/)) {
        const key = "page-component";
        if (!patterns.has(key)) patterns.set(key, []);
        patterns.get(key)!.push(file);
      }

      // Component 패턴: components/*/*.tsx
      if (file.includes("components/") && name.endsWith(".tsx")) {
        const key = "component";
        if (!patterns.has(key)) patterns.set(key, []);
        patterns.get(key)!.push(file);
      }

      // API route 패턴
      if (file.includes("api/") || file.includes("routes/")) {
        const key = "api-route";
        if (!patterns.has(key)) patterns.set(key, []);
        patterns.get(key)!.push(file);
      }

      // Hook 패턴
      if (name.match(/^use\w+\.ts$/)) {
        const key = "custom-hook";
        if (!patterns.has(key)) patterns.set(key, []);
        patterns.get(key)!.push(file);
      }
    }

    // 3개 이상 반복되면 스킬로
    for (const [key, files] of patterns) {
      if (files.length >= 2) {
        const templates: Record<string, { name: string; desc: string; tpl: string }> = {
          "page-component": {
            name: "Page Component",
            desc: "새 페이지 컴포넌트 생성 패턴",
            tpl: "Create a new page component following the same structure as existing pages: ${files.join(', ')}",
          },
          "component": {
            name: "UI Component",
            desc: "재사용 가능한 UI 컴포넌트 생성 패턴",
            tpl: "Create a reusable component following project conventions",
          },
          "api-route": {
            name: "API Route",
            desc: "API 라우트 생성 패턴",
            tpl: "Create a new API route following the established pattern",
          },
          "custom-hook": {
            name: "Custom Hook",
            desc: "React 커스텀 훅 생성 패턴",
            tpl: "Create a new custom hook following the use* naming convention",
          },
        };

        const info = templates[key];
        if (info) {
          detected.push({
            name: info.name,
            description: info.desc,
            pattern: `${key}: ${files.join(", ")}`,
            template: info.tpl,
          });
        }
      }
    }

    return detected;
  }

  /**
   * 작업 설명 패턴 감지
   * 비슷한 changeSummary가 반복되면 스킬로 추출
   */
  private detectTaskPatterns(projectId: string, currentSummary: string): DetectedSkill[] {
    const detected: DetectedSkill[] = [];

    // 반복 키워드 감지
    const keywords = [
      { pattern: /(?:CRUD|create.*read.*update.*delete)/i, name: "CRUD Operations", desc: "데이터 CRUD 작업 패턴" },
      { pattern: /(?:form|폼|입력|validation)/i, name: "Form + Validation", desc: "폼 입력 + 유효성 검증 패턴" },
      { pattern: /(?:list|목록|테이블|table|pagination)/i, name: "Data List/Table", desc: "데이터 목록/테이블 표시 패턴" },
      { pattern: /(?:modal|dialog|팝업|overlay)/i, name: "Modal/Dialog", desc: "모달/다이얼로그 UI 패턴" },
      { pattern: /(?:auth|login|로그인|인증)/i, name: "Auth Flow", desc: "인증/로그인 플로우 패턴" },
    ];

    for (const kw of keywords) {
      if (kw.pattern.test(currentSummary)) {
        detected.push({
          name: kw.name,
          description: kw.desc,
          pattern: kw.pattern.source,
          template: `Repeat the ${kw.name} pattern used in this project`,
        });
      }
    }

    return detected;
  }
}

interface DetectedSkill {
  name: string;
  description: string;
  pattern: string;
  template: string;
}
