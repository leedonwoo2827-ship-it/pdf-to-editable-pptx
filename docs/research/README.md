# Research & Decision Records

이 폴더는 **PDF → Editable PowerPoint** 프로젝트의 설계 결정 근거를 보관합니다.
"왜 LaMa인가? 왜 PaddleOCR인가? 왜 100% 로컬인가? 라이선스는 어떻게 정리되는가?"
저장소를 처음 보는 사람이 즉시 따라잡을 수 있게 정리되어 있습니다.

> 최종 갱신: **2026-05-06** — LaMa 기반 로컬 파이프라인으로 정리.

## Index

| # | Document | 요약 |
|---|---|---|
| 01 | [Engine Decision](01-engine-decision.md) | **LaMa**(텍스트 영역 인페인팅) + PaddleOCR + python-pptx 스택을 선택한 이유 |
| 02 | [Libraries Reviewed](02-libraries-reviewed.md) | 인페인팅 / OCR / PDF 렌더링 후보를 비교한 표 |
| 03 | [No API Keys](03-no-api-keys.md) | 100% 로컬 실행 / 외부 API 미사용 정책 (모델 첫 다운로드만 인터넷 필요) |
| 04 | [License Strategy](04-license-strategy.md) | MIT 본 프로젝트, copyleft 의존성 0, LaMa 가중치 회색 지대 분석 |
| 05 | [LaMa Integration Choice](05-lama-integration-choice.md) | `simple_lama_inpainting` 래퍼 vs `advimman/lama` 직접 사용 비교 — 왜 래퍼가 적합한가 |

## How decisions were made

각 문서는 다음 형식을 따릅니다:

- **Context** — 어떤 결정이 필요했는가
- **Options considered** — 어떤 대안들을 비교했는가
- **Decision** — 무엇을 선택했는가
- **Rationale** — 선택의 근거
- **Tradeoffs** — 알려진 단점과 이를 받아들인 이유

조사가 진행되어 결정이 변경되면 해당 문서를 업데이트하고 변경 이유를
하단에 덧붙입니다(deletion 대신 amendment).

## Architecture at a glance

```
PDF
 │
 ▼
pdfplumber  ──► page → PIL.Image (DPI 200 권장)
 │
 ▼
PaddleOCR (`lang='korean'`)  ──► [(bbox, text, score), …]
 │
 ▼
mask 생성 (cv2.fillPoly + dilate)
 │
 ▼
SimpleLama (PyTorch)  ──► 텍스트 지운 깨끗한 배경 이미지
 │
 ▼
python-pptx  ──► 16:9 슬라이드 = 배경 이미지 + 편집 가능한 텍스트박스
```

세부 구현은 [src/core/pipeline.py](../../src/core/pipeline.py)와 같은 폴더의 분할 모듈들,
HTTP 라우팅은 [src/api/routes.py](../../src/api/routes.py),
브라우저 UI는 [static/](../../static/) 참고.
