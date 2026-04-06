# TaskForge — 태스크 드리븐 프로젝트 매니저

비개발자도 Claude Code를 쉽게 사용하여 프로젝트를 완성할 수 있게 하는 플러그인.
핵심 철학: **잘게 쪼개서, 명확하게, 깨끗한 컨텍스트에서.**

## 워크플로우

```
/taskforge:discover → /taskforge:plan → /taskforge:plan-approve → /taskforge:execute (반복) → /taskforge:validate → /taskforge:wrap
```

### 프로젝트 시작
- `/taskforge:discover` — 대화로 프로젝트 정의, SpecCard 생성
- `/taskforge:plan` — 마일스톤/스프린트/태스크로 자동 분할
- `/taskforge:plan-edit` — 계획 수정
- `/taskforge:plan-approve` — 계획 승인

### 실행
- `/taskforge:execute` — 다음 태스크 1개 실행
- `/taskforge:execute-all` — 스프린트 끝까지 자동 실행
- `/taskforge:handoff` — 작업 이력 생성
- `/taskforge:validate` — 검증 실행

### 모니터링
- `/taskforge:status` — 진행 상황 트리 표시
- `/taskforge:cost` — 모델별 비용 요약

### 적응
- `/taskforge:refresh` — 스프린트 완료 후 계획 갱신
- `/taskforge:pivot` — 방향 전환, 계획 재설계
- `/taskforge:retry` — 실패 태스크 재시도
- `/taskforge:skip` — 태스크 건너뛰기

### 전환
- `/taskforge:resume` — 새 세션에서 이어받기
- `/taskforge:wrap` — 프로젝트 마무리

## 산출물 (_workspace/)

```
_workspace/
├── spec-card.json          — 프로젝트 정의
├── project-plan.json       — 작업 계획 트리
├── execution-state.json    — 실행 상태
├── handoffs/               — 태스크별 handoff
├── validations/            — 검증 결과
└── project-report.md       — 완료 보고서
```
