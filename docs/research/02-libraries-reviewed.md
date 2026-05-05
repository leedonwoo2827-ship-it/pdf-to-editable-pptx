# 02. Libraries Reviewed

PDF → PowerPoint 변환을 위해 검토한 모든 솔루션 비교. 조사일: **2026-05-05**.

## Comparison Table

| # | 저장소 | 변환 방식 | 편집 가능 | API 키 필요 | 유지보수 | 결정 |
|---|---|:---:|:---:|:---:|:---:|:---:|
| 1 | [ha0ranyu/pdf2slides](https://github.com/ha0ranyu/pdf2slides) | 텍스트 좌표 추출 + python-pptx | ✅ | ❌ | 🟢 | **채택** |
| 2 | [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master) | LLM 에이전트 기반 생성 | ✅ | ✅ Claude/GPT | 🟢 | 제외 |
| 3 | [parthgupta1208/PDF2PPTGenerator](https://github.com/parthgupta1208/PDF2PPTGenerator) | GPT-3.5 요약 | ✅ | ✅ OpenAI | 🟡 | 제외 |
| 4 | [TomAnthony/pdf-to-powerpoint](https://github.com/TomAnthony/pdf-to-powerpoint) | 페이지→이미지 임베드 | ❌ | ❌ | 🟡 | 제외 |
| 5 | [kevinmcguinness/pdf2pptx](https://github.com/kevinmcguinness/pdf2pptx) | 페이지→PNG 슬라이드 | ❌ | ❌ | 🟡 | 제외 |
| 6 | [jirilukavsky/pdf2pptx](https://github.com/jirilukavsky/pdf2pptx) | 페이지→이미지 | ❌ | ❌ | 🟡 | 제외 |
| 7 | [ConvertAPI](https://www.convertapi.com/pdf-to-pptx) | 클라우드 API | ✅ | ✅ 유료 | 🟢 | 제외 |

---

## Detail

### 1. ha0ranyu/pdf2slides ✅ 채택
- **언어**: Python 100%
- **라이선스**: GPL-3.0
- **의존성**: numpy, paddleocr, paddlepaddle, pillow, PyMuPDF, python-pptx, scikit-learn
- **특징**: PDF 텍스트를 좌표·폰트와 함께 추출 → python-pptx 텍스트박스로 재작성. 스캔 PDF는 PaddleOCR(다국어, 한국어 포함). API 3줄로 변환 가능.
- **선택 이유**: 우리 요구사항(편집 가능 + 로컬 + 한국어 OCR + API 키 없음)을 모두 만족하는 유일한 후보.

### 2. hugohe3/ppt-master ❌ 제외
- **특징**: PDF/DOCX/MD를 입력으로 받아 진짜 DrawingML 셰이프 PPTX 생성. UI는 없고 Claude Code/Cursor 등 AI IDE의 "skill"로 작동.
- **제외 이유**: 변환 자체가 LLM 에이전트(Claude/GPT)에 의존 → 본질적으로 **API 키와 토큰 비용 필요**. "API 키 불필요" 요구사항과 정면 충돌.

### 3. parthgupta1208/PDF2PPTGenerator ❌ 제외
- **특징**: Tkinter GUI 보유. 각 페이지를 Spacy로 요약 → GPT-3.5로 토픽명 생성 → Google Image Search API로 관련 이미지 추가.
- **제외 이유**:
  1. GPT-3.5 OpenAI API 키 필수
  2. **요약 변환**이라 원본과 다른 결과(1:1 충실도 요구사항 위반)
  3. Google Image API 키도 별도 필요
- **참고로 살릴 점**: Tkinter GUI 패턴은 간단한 reference로 참고 가능했으나, PyQt6 채택으로 별도 활용 안함.

### 4. TomAnthony/pdf-to-powerpoint ❌ 제외
- **특징**: 각 PDF 페이지를 PNG로 렌더 후 슬라이드에 이미지로 삽입. "no font problems!"가 셀링 포인트(이미지라 폰트 이슈 없음).
- **제외 이유**: 결과 PPTX의 각 슬라이드가 단일 이미지 → **PowerPoint에서 텍스트 편집 불가능**. 사용자의 핵심 요구사항(편집 가능) 위반.

### 5. kevinmcguinness/pdf2pptx ❌ 제외
- **특징**: 4번과 동일한 이미지 기반 변환. CLI 유틸리티.
- **제외 이유**: 이미지 슬라이드 = 편집 불가.

### 6. jirilukavsky/pdf2pptx ❌ 제외
- **특징**: 4·5번과 동일.
- **제외 이유**: 이미지 슬라이드 = 편집 불가.

### 7. ConvertAPI / Adobe / Smallpdf 등 클라우드 ❌ 제외
- **특징**: 변환 품질이 가장 높음. 일부 서비스는 폰트·레이아웃까지 보존.
- **제외 이유**:
  - **유료 API 키** (ConvertAPI는 분당 처리량 제한, 월 구독)
  - PDF 내용이 외부 서버로 전송 (프라이버시·기밀성 이슈)
  - 인터넷 연결 필수

---

## Why pdf2slides was the only viable option

요구사항을 매트릭스화하면 결과는 자명합니다:

| 요구사항 | #1 pdf2slides | #2 ppt-master | #3 PDF2PPT | #4-6 image | #7 cloud |
|---|:---:|:---:|:---:|:---:|:---:|
| 편집 가능한 출력 | ✅ | ✅ | ✅ | ❌ | ✅ |
| API 키 불필요 | ✅ | ❌ | ❌ | ✅ | ❌ |
| 1:1 충실도 (요약 아님) | ✅ | 부분 | ❌ | ✅ | ✅ |
| 로컬 실행 | ✅ | ❌ | ❌ | ✅ | ❌ |
| 한국어 OCR | ✅ | n/a | n/a | n/a | ✅ |
| **모두 만족** | **✅** | ❌ | ❌ | ❌ | ❌ |

pdf2slides가 모든 요구사항을 만족하는 **유일한 후보**였습니다.

## Search methodology

조사는 다음 검색어들로 GitHub Topics 및 Google에서 수행:
- `pdf to editable pptx converter python`
- `pdf-to-pptx` GitHub topic
- `pdf2ppt` GitHub topic

상위 20개 결과 중 위 7개가 "현재까지 활성, 사용 가능한 패키지/저장소"로 좁혀졌고, 본 표에 반영됨.
