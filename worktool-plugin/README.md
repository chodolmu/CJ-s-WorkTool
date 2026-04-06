# WorkTool — Task-Driven Project Manager for Claude Code

비개발자도 Claude Code를 쉽게 사용하여 프로젝트를 완성할 수 있는 플러그인.

## 설치

```bash
claude plugin install github:chodolmu/worktool-plugin
```

또는 로컬 테스트:

```bash
claude --plugin-dir ./worktool-plugin
```

## 사용법

```
/worktool:discover    → 프로젝트 정의 (대화형)
/worktool:plan        → 마일스톤→스프린트→태스크 자동 분할
/worktool:plan-approve → 계획 승인
/worktool:execute     → 태스크 하나씩 실행
/worktool:execute-all → 스프린트 자동 실행
/worktool:status      → 진행 상황 확인
/worktool:wrap        → 프로젝트 마무리
```

## 핵심 철학

1. **잘게 쪼개기** — 프로젝트를 AI가 한 세션에서 완료할 수 있는 태스크 단위로 분할
2. **깨끗한 컨텍스트** — 매 태스크마다 새 컨텍스트에서 시작, 컨텍스트 오염 방지
3. **Handoff로 연결** — 태스크 간 맥락 전달, 전체 히스토리를 읽지 않아도 됨
4. **사용자는 승인자** — 계획 확인, 중간 점검, 방향 결정만

## 전체 워크플로우

```
/discover → /plan → /plan-approve → /execute (반복) → /validate → /wrap
```

## 라이선스

MIT
