# TaskForge — Task-Driven Project Manager for Claude Code

비개발자도 Claude Code를 쉽게 사용하여 프로젝트를 완성할 수 있는 플러그인.

## 설치

```bash
claude plugin install github:chodolmu/taskforge
```

또는 로컬 테스트:

```bash
claude --plugin-dir ./taskforge-plugin
```

## 사용법

```
/taskforge:discover    → 프로젝트 정의 (대화형)
/taskforge:plan        → 마일스톤→스프린트→태스크 자동 분할
/taskforge:plan-approve → 계획 승인
/taskforge:execute     → 태스크 하나씩 실행
/taskforge:execute-all → 스프린트 자동 실행
/taskforge:status      → 진행 상황 확인
/taskforge:wrap        → 프로젝트 마무리
```

## 전체 워크플로우

```
/taskforge:discover → /taskforge:plan → /taskforge:plan-approve → /taskforge:execute (반복) → /taskforge:validate → /taskforge:wrap
```

## 핵심 철학

1. **잘게 쪼개기** — 프로젝트를 AI가 한 세션에서 완료할 수 있는 태스크 단위로 분할
2. **깨끗한 컨텍스트** — 매 태스크마다 새 컨텍스트에서 시작, 컨텍스트 오염 방지
3. **Handoff로 연결** — 태스크 간 맥락 전달, 전체 히스토리를 읽지 않아도 됨
4. **사용자는 승인자** — 계획 확인, 중간 점검, 방향 결정만

## 라이선스

MIT
