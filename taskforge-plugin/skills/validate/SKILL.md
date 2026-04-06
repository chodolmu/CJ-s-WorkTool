---
name: validate
description: 태스크, 스프린트, 마일스톤 단위로 검증을 실행한다. "/validate", "검증", "테스트 돌려", "확인해봐" 등을 말할 때 사용한다. 스프린트나 마일스톤 완료 후 품질 확인에 사용된다.
---

# Validate — 검증 실행

프로젝트의 작업 결과를 검증한다. 3단계 검증 체계를 따른다.

## 3단계 검증

### 1. 태스크 검증 (자동, 매 태스크 완료 시)

태스크의 `validation.auto`에 지정된 항목을 실행:

| 항목 | 동작 |
|------|------|
| build | 프로젝트 빌드 실행 |
| typecheck | TypeScript 타입 체크 (해당 시) |
| lint | 린터 실행 (해당 시) |
| test | 테스트 스위트 실행 (해당 시) |
| run | 실행해서 에러 없는지 확인 |

보통 `/execute`가 자동으로 실행한다.

### 2. 스프린트 검증 (스프린트 완료 후)

스프린트의 `validationStrategy`에 따라 통합 검증:

1. 자동 검증 항목 전체 재실행 (빌드, 타입체크 등)
2. 스프린트에서 구현한 기능들이 실제로 동작하는지 확인
3. Sonnet 모델로 코드 리뷰 실행:
   - 스프린트에서 변경된 파일 전체를 읽고
   - 코드 품질, 일관성, 버그 가능성 평가
4. 결과 리포트 생성

### 3. 마일스톤 검증 (마일스톤 완료 후)

마일스톤의 `validationStrategy`에 따라 전체 QA:

1. 자동 검증 전체 실행
2. Opus 모델로 전체 리뷰:
   - SpecCard의 요구사항 대비 구현 완료 여부
   - 마일스톤 목표 달성 여부
   - 전체적 코드 품질 및 아키텍처 평가
3. 사용자에게 데모 가능한 상태인지 확인 요청

## 검증 결과 저장

`_workspace/validations/{target-type}-{target-id}.json`:

```json
{
  "targetType": "sprint",
  "targetId": "m1-s1",
  "passed": true,
  "results": [
    { "check": "build", "passed": true, "message": "" },
    { "check": "typecheck", "passed": true, "message": "" },
    { "check": "code-review", "passed": true, "message": "코드 품질 양호" }
  ],
  "validatedBy": "auto+sonnet",
  "validatedAt": "2026-04-06T16:00:00Z"
}
```

## 실패 시

- **태스크 검증 실패**: `/retry`로 재시도 안내
- **스프린트 검증 실패**: Opus가 실패 원인 분석 → 수정 태스크 자동 제안 → 사용자 승인 후 실행
- **마일스톤 검증 실패**: Opus가 전체 리뷰 → 수정 스프린트 제안 → 사용자 확인

## 사용법

```
/validate              → 가장 최근 완료된 단위를 자동 감지하여 검증
/validate sprint       → 현재 스프린트 검증
/validate milestone    → 현재 마일스톤 검증
/validate task m1-s1-t3 → 특정 태스크 검증
```
