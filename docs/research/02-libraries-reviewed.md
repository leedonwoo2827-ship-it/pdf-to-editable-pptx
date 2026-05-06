# 02. Libraries Reviewed

PDF → 편집 가능한 PowerPoint 변환을 위해 검토한 라이브러리들.
파이프라인 단계별로 정리합니다. 조사일: **2026-05-06**.

## Pipeline shape (recap)

```
PDF ──► (page render) ──► (OCR) ──► (mask + inpaint) ──► (PPTX write)
```

각 단계마다 후보가 있고, 본 프로젝트가 고른 조합은 표 끝의 **✅ 채택** 행입니다.

---

## A. Inpainting (텍스트 영역 제거)

| # | 라이브러리 | 방식 | 모델 크기 | 결과 품질 | 라이선스 (코드) | 결정 |
|---|---|---|---|---|---|---|
| A1 | **[simple_lama_inpainting](https://github.com/enesmsahin/simple-lama-inpainting)** (LaMa wrapper) | FFC 기반 단일 forward, PyTorch | ~200 MB 가중치 | 텍스트 같은 얇고 긴 마스크에 강함 | MIT (래퍼), 원 LaMa 코드는 Apache 2.0 | **✅ 채택** |
| A2 | [advimman/lama](https://github.com/advimman/lama) (원본) | LaMa 풀 리포 (학습 + 추론) | 동일 | 동일 | Apache 2.0 | 추론만 필요 → 래퍼 사용 (자세한 비교는 [05-lama-integration-choice.md](05-lama-integration-choice.md)) |
| A3 | [IOPaint](https://github.com/Sanster/IOPaint) (구 lama-cleaner) | LaMa·SD·MAT 등 멀티 백엔드 + 자체 웹 UI | 200 MB ~ 수 GB | 매우 좋음 | Apache 2.0 | UI가 별도 앱 → 본 프로젝트와 통합 부적합 |
| A4 | Stable Diffusion inpainting | Diffusion 기반 재생성 | 4–7 GB | 환각 위험, 텍스트 제거에 과함 | OpenRAIL-M | 텍스트 제거에는 oversized |
| A5 | `cv2.inpaint` (Telea / Navier-Stokes) | 고전 영상처리 | — (OpenCV 기본 포함) | 작은 흠집은 OK, 텍스트는 번짐 | Apache 2.0 (OpenCV) | 품질 부족 |
| A6 | MAT, ZITS, FcF, ICT 등 학술 인페인팅 | 다양 | 중대형 | 좋음 | 각자 다름 (대부분 비상업) | PyPI 즉시설치 가능한 wrapper 없음 |

**선택 이유**: A1 (`simple_lama_inpainting`).

- LaMa는 **텍스트처럼 얇고 길게 분포한 마스크**에 학습 분포가 잘 맞음 (FFC가
  전역 컨텍스트를 잡아서 배경 패턴을 자연스럽게 이어줌).
- 단일 forward, 추가 프롬프트 불필요 → 페이지 단위 자동 처리에 적합.
- `pip install simple_lama_inpainting` 한 줄로 추론 환경 구성 (모델 자동
  다운로드).
- 추가 의존성: `torch`, `torchvision`만 있으면 됨.

코드: [src/core/inpaint.py](../../src/core/inpaint.py).

---

## B. OCR (텍스트 위치 + 내용 검출)

| # | 라이브러리 | 백엔드 | 한국어 모델 | 설치 부담 | 라이선스 | 결정 |
|---|---|---|---|---|---|---|
| B1 | **[EasyOCR](https://github.com/JaidedAI/EasyOCR)** | PyTorch | ✅ **네이티브** (`langs=['ko','en']`) | 중간 (PyTorch는 LaMa 때문에 이미 있음, 모델 ~70 MB) | Apache 2.0 | **✅ 채택** |
| B2 | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | PaddlePaddle | ✅ (`lang='korean'`) — SOTA 한국어 | 무거움 (Paddle 프레임워크 ~수백 MB, Windows 설치 이슈) | Apache 2.0 | 더 정확하지만 무거움 — escalation 후보 |
| B3 | [rapidocr_onnxruntime](https://github.com/RapidAI/RapidOCR) | ONNX Runtime | ⚠️ 기본 모델이 중·영용 — 한국어 페이지에서 한자 헛것 발생 | 가벼움 | Apache 2.0 | 정확도 부족 |
| B4 | [Tesseract](https://github.com/tesseract-ocr/tesseract) (`pytesseract`) | C++ 바이너리 | ✅ (한국어 traineddata 별도 다운) | 외부 바이너리 PATH 필요 | Apache 2.0 | 의존성 외부화 부담 |
| B5 | [docTR](https://github.com/mindee/doctr) | TF / PyTorch | ⚠️ 한국어 모델 약함 | 중간 | Apache 2.0 | 한국어 약함 |
| B6 | Cloud OCR (Google Vision / 네이버 Clova / Azure) | API | ✅ (특히 네이버 Clova가 한국어 SOTA) | API 키 필수, 외부 전송 | 상용 | 100% 로컬 정책 위반 |

**선택 이유**: B1 (`EasyOCR`).

- `easyocr.Reader(['ko', 'en'])` 한 줄로 한국어 네이티브 인식 모델 활성화 → 중·영 모델 기반 OCR(B3)에서 발생하던 "한국어 → 한자 오인식" 문제가 본질적으로 사라짐.
- LaMa가 어차피 PyTorch를 사용하므로 백엔드 공유 → 추가 ML 프레임워크 부담 없음.
- 출력 포맷 `[(box, text, score), ...]`이 단순 → 후처리 코드 짧음.
- Apache 2.0 → MIT 본 프로젝트와 호환.

**Escalation path**: 더 까다로운 한국어 문서 (특수 폰트, 작은 글씨, 손글씨 인접)에서 EasyOCR이 부족하면 **B2 PaddleOCR**로 갈아타는 게 다음 후보. SOTA 한국어 정확도지만 paddlepaddle 설치 부담이 따라옵니다. 코드 측에서는 [src/core/ocr.py](../../src/core/ocr.py)의 `OcrEngine`만 PaddleOCR 기반으로 다시 짜면 됩니다 — 파이프라인 나머지는 그대로.

코드: [src/core/ocr.py](../../src/core/ocr.py).

---

## C. PDF 페이지 렌더링

| # | 라이브러리 | 백엔드 | 스레드 안전 | 라이선스 | 본 프로젝트 사용처 |
|---|---|---|---|---|---|
| C1 | **[pdfplumber](https://github.com/jsvine/pdfplumber)** | pypdfium2 | ⚠️ 단일 스레드 | MIT | **변환 파이프라인** (모듈 lock으로 직렬화) |
| C2 | **[pypdfium2](https://github.com/pypdfium2-team/pypdfium2)** | PDFium (Chromium) | ⚠️ 단일 스레드 | Apache 2.0 / BSD-3 | **브라우저 썸네일** (모듈 lock으로 직렬화) + pdfplumber 내부 백엔드 |
| C3 | [PyMuPDF (fitz)](https://github.com/pymupdf/PyMuPDF) | MuPDF | ✅ | **AGPL-3.0** / 상용 | ❌ 미사용 — 라이선스 청결성을 위해 제거 (이전 버전에서 썸네일 경로에 사용했음) |
| C4 | [pdf2image](https://github.com/Belval/pdf2image) | Poppler (외부 바이너리) | ✅ | MIT (래퍼) / GPL (Poppler) | Poppler PATH 부담 + GPL → 미사용 |
| C5 | pdfminer.six | 자체 | ✅ | MIT | 텍스트 추출용, 이미지 렌더링은 안 함 |

**선택 이유**: **pypdfium2 단일 백엔드** + 두 경로 각자의 모듈 lock.

- `pdfplumber`(C1)는 변환 본 작업에서 사용. 내부적으로 pypdfium2.
  [src/core/pdf_pages.py](../../src/core/pdf_pages.py)의
  전역 `threading.Lock`으로 직렬화 (PDFium은 thread-safe하지 않음).
- `pypdfium2`(C2)는 **브라우저 썸네일** 경로에서 직접 사용
  ([src/core/page_render.py](../../src/core/page_render.py)). 같은 PDFium
  엔진이지만 별도 lock으로 변환 경로와 독립 동작.
- **PyMuPDF는 의도적으로 사용하지 않음**. AGPL-3.0은 본 앱을 LAN 서버나
  외부 SaaS로 배포할 때 소스 공개 의무를 발동시키므로, 사내 LAN 공유를
  지원하기 위해 같은 PDFium 엔진을 쓰는 pypdfium2 직접 사용으로 통일
  ([04-license-strategy.md](04-license-strategy.md) 참고).

---

## D. 마스크 후처리

| # | 라이브러리 | 역할 | 라이선스 |
|---|---|---|---|
| D1 | **[opencv-python](https://github.com/opencv/opencv-python)** | `fillPoly`(OCR bbox → 마스크), `morphologyEx`/`dilate`(마스크를 텍스트 두께만큼 부풀려 LaMa 입력에 적합) | Apache 2.0 (OpenCV BSD) |

LaMa는 마스크가 실제 텍스트 픽셀보다 약간 넓을 때 결과가 깨끗합니다.
[src/core/mask.py](../../src/core/mask.py)는 평균 텍스트 높이의 20%를
dilate (15–40px 클램프)로 적용합니다.

---

## E. PPTX 작성

| # | 라이브러리 | 라이선스 | 결정 |
|---|---|---|---|
| E1 | **[python-pptx](https://github.com/scanny/python-pptx)** | MIT | **✅ 채택** — 16:9 슬라이드, 배경 이미지, 텍스트박스 생성 |
| E2 | LibreOffice / unoconv 등 외부 변환 | LGPL/MPL | 외부 바이너리 의존 부담 |
| E3 | Aspose.Slides | 상용 | 비용 |

`python-pptx`는 PowerPoint OOXML을 직접 생성하므로 외부 프로세스 없이 단일
프로세스 안에서 .pptx가 만들어집니다.

---

## F. 백엔드 / UI

| 단계 | 라이브러리 | 라이선스 | 비고 |
|---|---|---|---|
| HTTP | `fastapi` + `uvicorn[standard]` | MIT / BSD-3 | 로컬 127.0.0.1:8000 |
| 멀티파트 업로드 | `python-multipart` | Apache 2.0 | FastAPI 파일 업로드 의존 |
| 모델 | `pydantic` | MIT | API 요청·응답 스키마 |
| 프론트 | Tailwind CSS, Alpine.js (CDN) | MIT, MIT | 빌드 단계 없음 |

PyQt 같은 데스크톱 GUI 프레임워크 대신 **로컬 HTTP + 브라우저** 패턴을 선택:

- 빌드/패키징 부담 없음 (Python만 있으면 됨).
- 프론트 디버깅이 브라우저 DevTools로 즉시 가능.
- 추후 사내망 단일 서버에 띄우고 여러 사용자가 접속하는 시나리오로 확장
  가능 (단, 그 경우 라이선스 의무가 달라짐 —
  [04-license-strategy.md](04-license-strategy.md) 참조).

---

## Why this combination is the only viable one given our constraints

요구사항을 매트릭스로 보면:

| 요구사항 | 본 스택 (LaMa+EasyOCR) | PDF 텍스트 객체 파싱 only | Cloud LLM | Image-embed only |
|---|:---:|:---:|:---:|:---:|
| 편집 가능한 출력 | ✅ | ✅ | ✅ | ❌ |
| API 키 불필요 | ✅ | ✅ | ❌ | ✅ |
| 이미지-only PDF 입력에서도 동작 | ✅ | ❌ | ✅ | ✅ |
| 1:1 시각 충실도 | ✅ (배경 픽셀 보존) | ⚠️ 폰트/레이아웃 재구성 | ⚠️ 모델 환각 | ✅ |
| 100% 로컬 | ✅ | ✅ | ❌ | ✅ |
| 한국어 OCR (네이티브 모델) | ✅ | n/a (텍스트 객체 직접 사용) | ✅ | n/a |
| **모두 만족** | **✅** | ❌ | ❌ | ❌ |

LaMa+EasyOCR 스택은 위 6개 조건을 동시에 만족하는 유일한 조합입니다.

## Search methodology

조사는 다음 검색어로 GitHub Topics + Google + Papers With Code에서 수행:

- `image inpainting text removal pretrained pytorch`
- `lama inpainting python pip`
- `pdf-to-pptx`, `pdf2pptx` GitHub topics
- `easyocr korean accuracy`, `paddleocr lang='korean'` 비교 글들
- `cjk ocr open source comparison`

상위 결과 중 (a) 활성 유지보수, (b) PyPI 설치 가능, (c) 라이선스 호환,
(d) 한국어 지원 — 4개 조건을 만족하는 후보들을 본 표에 반영.
