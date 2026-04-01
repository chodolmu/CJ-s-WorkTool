/**
 * WorkTool E2E 감사 스크립트
 *
 * 사용법: EXE 실행 → Ctrl+Shift+I → Console 탭 → 이 코드 전체 붙여넣기 → Enter
 * 결과를 복사해서 공유해주세요.
 */
(async function WorkToolAudit() {
  const h = window.harness;
  const results = [];
  let projectId = null;

  function log(test, pass, detail) {
    const icon = pass ? "✅" : "❌";
    results.push({ test, pass, detail });
    console.log(`${icon} ${test}: ${detail}`);
  }

  // ── 0. harness 존재 확인 ──
  if (!h) {
    console.error("❌ window.harness가 없습니다. Electron 앱에서 실행해주세요.");
    return;
  }
  log("harness 존재", true, "window.harness OK");

  // ── 1. Claude Code 설치 확인 ──
  try {
    const claude = await h.system.checkClaudeCode();
    log("Claude CLI", claude?.installed, `installed=${claude?.installed}, version=${claude?.version ?? "?"}`);
  } catch (e) {
    log("Claude CLI", false, e.message);
  }

  // ── 2. 프리셋 로드 ──
  try {
    const presets = await h.preset.list();
    const ids = presets.map(p => p.id);
    log("프리셋 로드", presets.length > 0, `${presets.length}개: ${ids.join(", ")}`);
  } catch (e) {
    log("프리셋 로드", false, e.message);
  }

  // ── 3. 프로젝트 생성 ──
  try {
    const specCard = {
      projectType: "2D 플랫포머 게임",
      coreDecisions: [{ key: "engine", label: "엔진", value: "Phaser", source: "user" }],
      expansions: [{ id: "multiplayer", label: "멀티플레이", enabled: false, suggestedBy: "ai" }],
      techStack: ["JavaScript", "Phaser 3"],
      rawAnswers: [],
      directorHints: {
        domainContext: "마리오 스타일 2D 플랫포머",
        reviewFocus: ["점프 물리", "레벨 디자인"],
        techConstraints: ["웹 브라우저 호환"],
        suggestedPhases: ["plan", "design", "generate", "evaluate"],
      },
    };
    const agents = [
      { id: "director", displayName: "Director", icon: "🎬", role: "총괄", goal: "방향수립", constraints: [], model: "sonnet", trigger: "manual", guidelines: [], outputFormat: "" },
      { id: "planner", displayName: "Planner", icon: "🔧", role: "기획", goal: "기능분해", constraints: [], model: "sonnet", trigger: "manual", guidelines: [], outputFormat: "" },
      { id: "generator", displayName: "Generator", icon: "💻", role: "개발", goal: "코드구현", constraints: [], model: "sonnet", trigger: "after_planner", guidelines: [], outputFormat: "" },
      { id: "evaluator", displayName: "Evaluator", icon: "🔍", role: "검증", goal: "품질검증", constraints: [], model: "sonnet", trigger: "after_generator", guidelines: [], outputFormat: "" },
      { id: "balance-tester", displayName: "Balance Tester", icon: "⚖️", role: "밸런스", goal: "밸런스검증", constraints: [], model: "sonnet", trigger: "after_generator", guidelines: [], outputFormat: "" },
    ];
    const project = await h.discovery.complete("Audit Test Game", "game", specCard, ".", agents);
    projectId = project?.id;
    log("프로젝트 생성", !!projectId, `id=${projectId}`);
  } catch (e) {
    log("프로젝트 생성", false, e.message);
  }

  if (!projectId) {
    console.log("\n⛔ 프로젝트 생성 실패 — 이후 테스트 중단");
    printSummary();
    return;
  }

  // ── 4. 프로젝트 로드 ──
  try {
    const loaded = await h.project.load(projectId);
    const hasSpec = !!loaded?.specCard;
    const hasAgents = Array.isArray(loaded?.selectedAgents) && loaded.selectedAgents.length > 0;
    const agentIds = loaded?.selectedAgents?.map(a => a.id) ?? [];
    log("프로젝트 로드", hasSpec && hasAgents, `specCard=${hasSpec}, agents=${agentIds.length}개: ${agentIds.join(",")}`);

    // trigger 필드 확인
    const withTrigger = loaded?.selectedAgents?.filter(a => a.trigger) ?? [];
    log("에이전트 trigger", withTrigger.length === agentIds.length, `trigger 있음: ${withTrigger.length}/${agentIds.length}`);

    // directorHints 확인
    const hints = loaded?.specCard?.directorHints;
    log("directorHints", !!hints, hints ? `domain=${hints.domainContext}, phases=${hints.suggestedPhases?.join("→")}` : "없음");
  } catch (e) {
    log("프로젝트 로드", false, e.message);
  }

  // ── 5. Plan 확인 ──
  try {
    const plan = await h.plan.get(projectId);
    log("Plan 문서", !!plan, plan ? `features=${plan.features?.length ?? 0}, agents=${plan.agentTeam?.length ?? 0}` : "없음 (정상 — 파이프라인 실행 전)");
  } catch (e) {
    log("Plan 문서", false, e.message);
  }

  // ── 6. 채팅 테스트 (CLI 호출) ──
  try {
    console.log("⏳ 채팅 테스트 중... (최대 60초)");
    const chatResult = await h.chat.send(projectId, "이 게임의 레벨 디자인 전략에 대해 어떻게 생각해?", ".");
    const content = chatResult?.content ?? "";
    const isReal = content.length > 20 && !content.includes("Done (direct mode)") && !content.includes("오류");
    log("채팅 응답", isReal, `길이=${content.length}, 앞부분="${content.slice(0, 80)}..."`);
  } catch (e) {
    log("채팅 응답", false, e.message);
  }

  // ── 7. 채팅 액션 테스트 (에이전트 추가 요청) ──
  try {
    console.log("⏳ 에이전트 추가 채팅 테스트 중... (최대 60초)");
    const actionResult = await h.chat.send(projectId, "레벨 디자인 전문 에이전트를 팀에 추가해줘. 레벨 구성, 난이도 곡선, 시크릿 영역 배치를 담당하게.", ".");
    const content = actionResult?.content ?? "";
    log("에이전트 추가 채팅", content.length > 20, `응답 길이=${content.length}`);

    // 추가된 에이전트 확인
    await new Promise(r => setTimeout(r, 1000)); // UI 업데이트 대기
    const reloaded = await h.project.load(projectId);
    const hasLevelDesigner = reloaded?.selectedAgents?.some(a => a.id.includes("level") || a.displayName.includes("레벨"));
    log("에이전트 실제 추가", !!hasLevelDesigner, `selectedAgents: ${reloaded?.selectedAgents?.map(a=>a.id).join(",") ?? "없음"}`);
  } catch (e) {
    log("에이전트 추가", false, e.message);
  }

  // ── 8. 채팅 이력 ──
  try {
    const history = await h.chat.history(projectId);
    log("채팅 이력", history?.length >= 2, `${history?.length ?? 0}개 메시지`);
  } catch (e) {
    log("채팅 이력", false, e.message);
  }

  // ── 9. 일정 ──
  try {
    const schedule = await h.schedule.list(projectId);
    log("일정 조회", Array.isArray(schedule), `${schedule?.length ?? 0}개 항목`);
  } catch (e) {
    log("일정 조회", false, e.message);
  }

  // ── 10. Git 상태 ──
  try {
    const git = await h.git.status(".");
    log("Git 상태", git !== undefined, JSON.stringify(git).slice(0, 100));
  } catch (e) {
    log("Git 상태", false, e.message);
  }

  // ── 정리: 테스트 프로젝트 삭제 ──
  try {
    await h.project.delete(projectId);
    log("테스트 정리", true, "프로젝트 삭제 완료");
  } catch (e) {
    log("테스트 정리", false, e.message);
  }

  // ── 결과 출력 ──
  printSummary();

  function printSummary() {
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;

    console.log("\n" + "=".repeat(60));
    console.log(`📊 WorkTool 감사 결과: ${passed} 통과 / ${failed} 실패 (총 ${results.length})`);
    console.log("=".repeat(60));

    if (failed > 0) {
      console.log("\n❌ 실패 항목:");
      results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.test}: ${r.detail}`));
    }

    console.log("\n📋 전체 결과 (이 텍스트를 복사해서 공유해주세요):");
    console.log(JSON.stringify(results, null, 2));
  }
})();
