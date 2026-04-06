---
name: handoff
description: 현재 태스크의 작업 이력을 handoff 문서로 생성한다. "/handoff", "핸드오프", "인수인계" 등을 말할 때 사용한다. 보통 /execute가 자동으로 호출하지만, 수동으로도 사용 가능하다.
---

# Handoff — 작업 이력 생성

태스크 완료 후 작업 내용을 구조화된 handoff 문서로 남긴다.
후속 태스크 담당자(AI)가 전체 히스토리를 읽지 않고도 필요한 맥락을 파악할 수 있게 하는 것이 목적이다.

## 왜 중요한가

매 태스크마다 새로운 컨텍스트에서 시작하기 때문에, 이전 태스크의 결과를 전달하는 유일한 수단이 handoff다.
좋은 handoff = 후속 태스크의 성공률이 올라간다.

## Handoff 내용

다음 정보를 수집하여 기록한다:

1. **summary**: 무엇을 했는지 1-3문장
2. **filesChanged**: 변경/생성한 파일 목록 (git diff에서 추출)
3. **designDecisions**: 설계 결정 사항 (후속 태스크에 영향주는 것만)
   - 예: "SQLite 대신 JSON 파일 저장으로 변경", "Canvas 대신 DOM 렌더링 선택"
4. **knownIssues**: 알려진 문제점이나 TODO
5. **nextTaskNotes**: 다음 태스크 담당자에게 전할 말

## 저장 형식

`_workspace/handoffs/{task-id}.json`:

```json
{
  "taskId": "m1-s1-t1",
  "taskName": "HTML 뼈대 만들기",
  "completedAt": "2026-04-06T15:30:00Z",
  "summary": "index.html 생성. Canvas 엘리먼트와 기본 스타일 포함.",
  "filesChanged": ["src/index.html", "src/styles.css"],
  "designDecisions": [
    "Canvas 크기 800x200 고정 (크롬 공룡게임 원본 비율)"
  ],
  "knownIssues": [],
  "nextTaskNotes": "Canvas context는 아직 없음. 게임 루프에서 getContext('2d') 필요."
}
```

## 자동 vs 수동

- **자동**: `/execute` 완료 시 자동 호출. 실행한 모델이 직접 handoff를 생성.
- **수동**: 사용자가 직접 작업한 후 `/handoff`를 호출하면, 현재 git diff를 분석하여 handoff를 생성.

## 주의사항

- designDecisions에는 후속 태스크에 영향을 주는 것만 기록한다. "변수명을 camelCase로 했다" 같은 건 넣지 않는다.
- summary는 간결하게. 코드 전체를 설명하지 않는다.
