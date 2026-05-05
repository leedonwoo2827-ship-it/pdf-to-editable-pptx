# Research & Decision Records

이 폴더는 PDF-to-Editable-PowerPoint 프로젝트의 **설계 결정 근거**를 보관합니다. GitHub에서 본 저장소를 처음 보는 사람이 "왜 이 라이브러리를 골랐는가? 왜 이런 구조인가?"를 즉시 이해할 수 있도록 작성되었습니다.

> 조사 시점: **2026-05-05**

## Index

| # | Document | 요약 |
|---|---|---|
| 01 | [Engine Decision](01-engine-decision.md) | 변환 엔진으로 `pdf2slides`를 채택한 이유 |
| 02 | [Libraries Reviewed](02-libraries-reviewed.md) | 검토한 7개 GitHub 저장소 비교표 |
| 03 | [No API Keys](03-no-api-keys.md) | 100% 로컬 실행 / 외부 API 미사용 정책 |
| 04 | [License Strategy](04-license-strategy.md) | GPL-3.0 의존성과 배포 전략 |
| 05 | [Related Prior Work](05-related-prior-work.md) | 기존 자체 프로젝트(`pptx_writer`)와의 관계 |

## How decisions were made

각 문서는 다음 형식을 따릅니다:
- **Context**: 어떤 결정이 필요했는가
- **Options considered**: 어떤 대안들을 비교했는가
- **Decision**: 무엇을 선택했는가
- **Rationale**: 선택의 근거
- **Tradeoffs**: 알려진 단점과 이를 받아들인 이유

조사가 진행되어 결정이 변경되면 해당 문서를 업데이트하고 변경 이유를 하단에 덧붙입니다(deletion 대신 amendment).
