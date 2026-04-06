---
name: plan-approve
description: 프로젝트 계획을 최종 승인하고 실행 가능 상태로 전환한다. "/plan:approve", "계획 승인", "이대로 진행", "확정" 등을 말할 때 이 스킬을 사용한다.
---

# Plan Approve — 계획 승인

프로젝트 계획을 최종 승인하고 실행 가능 상태로 전환한다.

## 사전 조건

- `_workspace/project-plan.json`이 존재해야 한다

## 승인 프로세스

1. 현재 계획 요약을 최종 한 번 보여준다:
   - 마일스톤 수, 스프린트 수, 태스크 수
   - 모델 분배 (haiku/sonnet/opus 각 몇 개)
   - 예상 비용 비율
   
2. 사용자에게 최종 확인을 받는다

3. 승인되면:
   - `_workspace/project-plan.json`에 `"status": "approved"`, `"approvedAt"` 추가
   - `_workspace/execution-state.json` 초기화:
     ```json
     {
       "projectId": "...",
       "status": "ready",
       "currentMilestone": null,
       "currentSprint": null, 
       "currentTask": null,
       "completedTasks": [],
       "failedTasks": [],
       "skippedTasks": [],
       "totalCost": 0,
       "startedAt": null
     }
     ```

4. "계획이 승인되었습니다. `/execute`로 첫 태스크를 시작하세요!"라고 안내
