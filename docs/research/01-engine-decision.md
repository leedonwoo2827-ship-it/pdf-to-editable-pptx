# 01. Engine Decision: Why pdf2slides

## Context

PDF → 편집가능한 PowerPoint(.pptx) 변환을 구현하는 방법은 크게 세 가지:

1. **Use existing battle-tested library** — `pdf2slides` 같은 검증된 오픈소스 사용
2. **Build from scratch** — `pdfplumber` + `python-pptx`로 직접 구현
3. **Wrap external tool** — LibreOffice headless, 또는 상용 API(ConvertAPI 등)

본 프로젝트는 (1)을 선택했습니다.

## Decision

**[ha0ranyu/pdf2slides](https://github.com/ha0ranyu/pdf2slides)를 변환 엔진으로 채택.**

```python
# 프로젝트가 의존하는 핵심 API (3 lines)
from pdf2slides import Converter
converter = Converter(enable_ocr=True, lang='korean')
converter.convert(input_pdf_path, output_pptx_path)
```

## Rationale

### 충실도 (Fidelity)
- pdf2slides는 PDF의 **텍스트 좌표·폰트·크기·색상**을 픽셀 단위로 추출하여 python-pptx의 텍스트박스에 1:1 매핑.
- 표(table) 자동 감지, 이미지 추출(원본 해상도 유지), 다단(multi-column) 레이아웃 처리가 이미 구현됨.
- 직접 구현 시 위 모든 엣지케이스를 처음부터 풀어야 함 → 수 주 이상 소요, 결과 품질도 불확실.

### OCR 통합
- 스캔 PDF를 위해 PaddleOCR이 라이브러리 내부에 통합되어 있음 (`enable_ocr=True`).
- 한국어 모델(`lang='korean'`)이 영문도 함께 인식하므로 한·영 혼합 문서에 적합.
- 별도 OCR 파이프라인 구축이 불필요.

### 라이선스 & 비용
- GPL-3.0 (오픈소스 호환).
- **API 키 불필요**, 모든 처리가 로컬에서 수행됨.
- 사용료 0원, 인터넷 연결 불필요(첫 OCR 모델 다운로드 제외).

### 유지보수 & 검증
- 다국어 PDF (영어, 중국어, 한국어, 프랑스어 등)에 대해 검증된 출력.
- 다수 사용자가 PyPI를 통해 사용 중 → 실전 버그가 이미 다수 수정됨.

## Options considered

### Option A: pdf2slides (선택)
- ✅ 1:1 충실도, OCR 내장, 로컬, 무료
- ⚠️ GPL-3.0 (배포 시 본 프로젝트도 GPL이어야 함)
- ⚠️ 콜백/취소 API 없음 → UI에서 합성 진행률 사용 필요

### Option B: pdfplumber + python-pptx 직접 구현
- ✅ 완전한 통제권, 라이선스 자유
- ❌ 모든 엣지케이스를 직접 구현 (폰트 매칭, 표 감지, 이미지 DPI, OCR 통합)
- ❌ 초기 출력 품질이 pdf2slides보다 낮을 가능성 매우 높음
- ❌ 개발 기간 2~4배 증가

### Option C: LibreOffice headless wrapping
- ✅ 즉시 동작 가능
- ❌ LibreOffice 설치 의존
- ❌ 출력 품질이 일정하지 않음 (LibreOffice의 PDF→PPTX 변환은 이미지화 경향)
- ❌ 사용자 PC에 무거운 외부 프로그램 강제

### Option D: ConvertAPI / Adobe API 등 클라우드
- ✅ 가장 높은 변환 품질
- ❌ **유료 API 키 필수**
- ❌ PDF 내용이 외부 서버로 전송됨 (프라이버시 문제)
- ❌ 인터넷 연결 필수

## Tradeoffs accepted

1. **GPL-3.0 전염성**: 본 프로젝트도 GPL-3.0으로 배포해야 함. 상용 폐쇄소스 배포는 불가능. → 오픈소스 공개가 원래 목표이므로 수용.

2. **Progress callback 부재**: `Converter.convert()`는 동기 함수, 진행률 콜백 없음. → PyMuPDF로 페이지 수 카운트 + 시간 기반 합성 진행률로 대응 (`src/core/progress.py`).

3. **Mid-conversion cancel 불가**: 변환 중간에 강제 종료 불가. → UI에서 "Cancelling…" 상태로 정직하게 표시, 현재 호출 종료 후 취소 처리.

4. **단일 언어 OCR 모델**: PaddleOCR은 인스턴스당 하나의 언어. → 한국어 모델이 영문도 인식하므로 실용적으로 문제 없음. 사용자에게 "Auto/Korean/English" 3-옵션으로 노출.

## Verification

채택 결정 검증을 위해 다음을 확인:

- [x] PyPI에 `pdf2slides` 패키지 존재 (`pip install pdf2slides`)
- [x] 라이선스 GPL-3.0 명시
- [x] README에서 "3 lines of code"로 변환 가능함을 명시
- [x] PaddleOCR 통합 명시
- [x] 한국어(`lang='korean'`) 지원 명시
- [x] API 키 의존성 없음 확인
