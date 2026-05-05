# 05. Related Prior Work

## Context

이 저자는 이전에 PowerPoint 자동화 관련 프로젝트를 개발한 경험이 있습니다. 본 문서는 그 작업과 본 프로젝트의 관계를 정리합니다.

## Prior project: pptx_writer

위치: `d:/mcp/pptx_writer/`

### 무엇인가
- **MCP (Model Context Protocol) 서버**
- 입력: Markdown 텍스트
- 출력: PowerPoint (.pptx) 파일
- 사용 시나리오: AI 에이전트(Claude 등)가 사용자 요청을 받아 마크다운으로 변환 후, MCP 도구로 본 서버를 호출하여 .pptx 생성

### 본 프로젝트와의 차이

| 측면 | pptx_writer (기존) | pdf-to-pptx (본 프로젝트) |
|---|---|---|
| 입력 | Markdown | PDF |
| 출력 | PPTX | PPTX |
| 인터페이스 | MCP server (AI 에이전트용) | PyQt6 데스크톱 GUI (사용자용) |
| 사용 환경 | Claude Code 등 AI IDE | 일반 Windows 데스크톱 |
| 핵심 의존성 | python-pptx + mcp[cli] | pdf2slides + python-pptx + PyQt6 |

두 프로젝트는 **출력 포맷(.pptx)만 공유**하며, 입력·인터페이스·사용자가 모두 다릅니다.

## Reusable components

`pptx_writer`의 일부 모듈은 본 프로젝트의 **후처리 단계**에서 재사용 가능합니다:

### `src/pptx_generator.py`
- 클래스: `PPTXGenerator`
- 유용한 헬퍼:
  - `_add_runs_to_paragraph(para, runs, style)` — 색상·굵게·기울임 인라인 스타일 적용
  - `_add_table_shape(slide, block, ...)` — 표 셰이프 생성
  - `_add_image_shape(slide, block, ...)` — 이미지 삽입
- 본 프로젝트 활용: pdf2slides가 .pptx를 생성한 뒤 **푸터(footer) 추가**, **메타데이터 스탬프** 같은 후처리에 사용.

### `src/text_fitting.py`
- 함수: `estimate_block_height(block, styles, content_width_emu)`
- 본 프로젝트 활용: 변환 후 **텍스트 오버플로우 검사** — 어떤 슬라이드의 텍스트가 슬라이드 영역을 넘쳤는지 자동 감지 → 사용자 경고.

## Vendoring strategy

`pptx_writer` 전체를 의존성으로 추가하지 않습니다(이유: `mcp[cli]` 등 본 데스크톱 앱에 불필요한 의존성을 끌고 옴).

대신 필요한 파일만 **vendor 디렉토리에 복사**:

```
src/core/_vendor/pptx_writer/
├── __init__.py
├── NOTICE.md           # "Originally from d:/mcp/pptx_writer/, included under <license>"
├── pptx_generator.py   # 복사본
└── text_fitting.py     # 복사본
```

본 프로젝트의 `src/core/pptx_postprocess.py`가 이 vendor 모듈을 import하여 후처리에 사용합니다.

## Why not extend pptx_writer instead?

다음 이유로 **별도 프로젝트**로 진행:

1. **목적이 다름** — pptx_writer는 AI 에이전트용 서버, 본 프로젝트는 사용자용 데스크톱 앱.
2. **의존성 충돌** — pptx_writer는 `mcp[cli]`에 의존, 본 프로젝트는 PyQt6에 의존. 한 저장소에 묶으면 둘 다 무거워짐.
3. **사용자가 다름** — pptx_writer는 개발자(MCP 환경), 본 프로젝트는 일반 사용자(GUI).
4. **GitHub 공개 전략** — 본 프로젝트는 독립적으로 검색·발견되어야 하는 도구. "pdf-to-editable-powerpoint" 같은 이름으로 별도 저장소가 SEO와 사용자 발견에 유리.

## What changes in pptx_writer?

**기존 pptx_writer는 수정되지 않습니다.** 본 프로젝트는 그 코드를 vendoring(복사)할 뿐이며, pptx_writer 자체의 동작·API에 영향을 주지 않습니다.

만약 vendor된 함수에 버그가 발견되면:
1. 본 프로젝트의 vendor 사본만 수정
2. 추후 의미 있는 개선이라면 원본 pptx_writer에도 백포팅 검토 (별도 PR/커밋)

## Lessons learned from pptx_writer (applied here)

- **Layout-driven slide generation은 어렵다** — 텍스트 오버플로우, 다단 정렬 등은 휴리스틱으로 풀어야 함. 본 프로젝트는 pdf2slides가 이 부분을 처리하므로 그대로 맡김.
- **Block-based representation은 유연하다** — pptx_writer의 `block` 딕셔너리(`{type, runs, level, ...}`) 방식은 다양한 콘텐츠를 표현하기에 좋음. 본 프로젝트의 후처리에서도 동일한 패턴 활용 가능.
- **테스트 픽스처를 일찍 만들어라** — pptx_writer 개발 중 마크다운 픽스처를 늦게 만들어 회귀 검증이 어려웠음. 본 프로젝트는 Phase 1에서 즉시 `tests/fixtures/`를 채울 예정.
