# 01. Engine Decision: Why LaMa-based local inpainting

## Context

목표는 PDF를 **진짜 편집 가능한 PowerPoint(.pptx)** 로 변환하는 것입니다.
"진짜 편집 가능"의 정의는 명확합니다 — PowerPoint에서 파일을 열었을 때
모든 텍스트가 클릭으로 편집되는 텍스트박스여야 합니다 (이미지 위에 박힌
텍스트가 아니어야 합니다).

이를 달성하는 접근은 크게 세 가지였습니다:

1. **PDF 파싱 라이브러리에 의존** — `pdf2slides`처럼 PDF의 텍스트 객체·좌표·폰트를 직접 추출해 python-pptx 텍스트박스로 매핑
2. **클라우드 비전 LLM 사용** — Gemini / GPT-4o / Claude Vision 등으로 페이지 이미지에서 요소를 구조화 추출
3. **OCR + 인페인팅으로 합성** — 페이지를 이미지로 렌더 → OCR로 텍스트 위치·내용 검출 → **인페인팅으로 텍스트만 깨끗이 지운 배경 이미지** 생성 → 그 위에 OCR 텍스트를 PowerPoint 텍스트박스로 배치

본 프로젝트는 **(3)** 을 선택했습니다.

## Decision

**핵심 인페인팅 엔진으로 [LaMa](https://github.com/saic-mdal/lama)
(Resolution-robust Large Mask Inpainting, Suvorov et al., WACV 2022)를 채택**,
이를 [`simple_lama_inpainting`](https://github.com/enesmsahin/simple-lama-inpainting)
래퍼를 통해 PyTorch에서 호출합니다.

```python
# src/core/inpaint.py
from simple_lama_inpainting import SimpleLama

self._lama = SimpleLama()                # CPU/GPU 자동 감지
cleaned = self._lama(pil_image, mask)    # (이미지, 마스크) → 텍스트 지운 이미지
```

스택 전체:

| 단계 | 모듈 / 라이브러리 | 역할 |
|---|---|---|
| PDF 렌더 | [pdf_pages.py](../../src/core/pdf_pages.py) (`pdfplumber`) / [page_render.py](../../src/core/page_render.py) (`PyMuPDF`) | 페이지 → PIL.Image (변환 / 썸네일) |
| OCR | [ocr.py](../../src/core/ocr.py) (`easyocr`, `langs=['ko','en']`) | 텍스트 bbox + 내용 (한국어 네이티브) |
| 마스크 후처리 | [mask.py](../../src/core/mask.py) (`opencv-python`) | `fillPoly` + adaptive `dilate` (텍스트 두께만큼 확장) |
| **인페인팅** | [**inpaint.py**](../../src/core/inpaint.py) (**`simple_lama_inpainting`**) | **텍스트 영역만 깨끗이 제거** |
| PPTX 작성 | [slide_writer.py](../../src/core/slide_writer.py) (`python-pptx`) | 16:9 letterbox + 편집 가능한 텍스트박스 |
| 워크스페이스 | [workspace.py](../../src/core/workspace.py) | 페이지별 bg.png + JSON 저장/로드 |
| 리뷰 작업 | [review.py](../../src/core/review.py) | 사용자 영역 OCR + 새 영역 인페인팅 커밋 |
| 오케스트레이션 | [pipeline.py](../../src/core/pipeline.py) | 위 모듈 조립 + 진행률 콜백 |
| 백엔드 | `fastapi` + `uvicorn` | 로컬 HTTP (127.0.0.1:8000) |
| UI | Tailwind + Alpine.js (CDN) | 빌드 단계 없는 단일 페이지 |

## Rationale

### 입력이 "텍스트 객체가 없는 PDF"여도 동작

NotebookLM, Canva, Figma → PDF 출력처럼 페이지 전체가 단일 래스터 이미지인
PDF가 점점 흔합니다. 이런 입력에서는 PDF 파서가 "텍스트 0자"를 반환하므로
**(1) PDF-파싱 접근은 작동하지 않습니다**. OCR + 인페인팅 접근은 페이지를
이미지로 다루므로 이미지-only PDF와 텍스트 PDF를 동일하게 처리합니다.

### "1:1 충실도"가 자연스럽게 따라옴

LaMa가 텍스트만 지우고 **나머지 픽셀(로고, 차트, 사진, 배경 그라디언트)은
원본 그대로 유지**합니다. 그 위에 OCR이 검출한 텍스트를 같은 위치에 PowerPoint
텍스트박스로 얹으면, 시각적으로는 원본과 거의 동일하면서 텍스트는 편집
가능한 슬라이드가 만들어집니다. PDF 레이아웃을 처음부터 재구성할 필요가
없습니다.

### 100% 로컬, API 키 불필요

LaMa, EasyOCR, pdfplumber, python-pptx 모두 로컬에서 동작합니다.
PyTorch와 LaMa 모델 가중치(~700 MB)는 첫 실행 시 자동 다운로드되고, 그
이후로는 인터넷 연결 없이 동작합니다. 사용자 PDF가 외부 서버로 전송되지
않으므로 사내·기밀 문서에도 사용 가능합니다.

### LaMa를 인페인팅으로 고른 이유 (vs Stable Diffusion inpaint, OpenCV inpaint)

- **LaMa**는 텍스트 같은 **얇고 긴 마스크 영역**을 자연스럽게 채우도록
  학습되었습니다 (FFC: Fast Fourier Convolution 기반). 텍스트 제거에
  특히 강합니다.
- **Stable Diffusion inpaint**는 마스크 영역을 "재생성"하므로 배경 패턴이
  반복되거나 환각된 디테일이 생길 위험이 큽니다. 텍스트 지우기엔 과합니다.
- **OpenCV의 `cv2.inpaint`** (Telea / Navier-Stokes)는 작은 흠집엔 충분하지만
  텍스트처럼 긴 영역에선 번짐이 보입니다.
- LaMa는 단일 forward pass, 추가 프롬프트 불필요, GPU/CPU 모두 동작 →
  배치 자동화에 적합.

자세한 비교는 [02-libraries-reviewed.md](02-libraries-reviewed.md).

### 검증된 구현 (`simple_lama_inpainting`)

원본 [saic-mdal/lama](https://github.com/saic-mdal/lama)는 학습/추론 양쪽을
포함한 큰 리포지토리입니다. 본 프로젝트는 추론만 필요하므로 추론 경로만
래핑한 [`simple_lama_inpainting`](https://github.com/enesmsahin/simple-lama-inpainting)
패키지를 사용합니다. PyPI 한 줄 설치로 모델 다운로드까지 자동 처리됩니다.

### OCR은 EasyOCR (`langs=['ko', 'en']`)로

PaddleOCR · RapidOCR · Tesseract 등을 검토한 끝에
[EasyOCR](https://github.com/JaidedAI/EasyOCR)을 선택한 이유:

- **한국어 네이티브 모델** — `easyocr.Reader(['ko', 'en'])` 한 줄로 한국어
  전용 인식 모델이 활성화됩니다. 중국어 모델 기반 OCR이 한국어 페이지에서
  글자를 한자로 오인식하던 문제가 본질적으로 사라집니다.
- **PyTorch 백엔드 공유** — LaMa가 어차피 PyTorch를 쓰므로 추가 ML
  프레임워크 없이 백엔드를 공유합니다.
- **PaddlePaddle 미사용** — Paddle은 무겁고 Windows에서 설치 이슈가 잦음.
  EasyOCR은 그런 부담이 없습니다.
- **단순한 출력 포맷** — `[(box, text, score), ...]` 형태라 후처리 코드가
  짧습니다.

자세한 비교 매트릭스와 escalation path(EasyOCR로도 부족할 때 PaddleOCR로
갈아타는 절차)는 [02-libraries-reviewed.md](02-libraries-reviewed.md) 참고.

## Options considered

### Option A: LaMa + EasyOCR + python-pptx (선택)
- ✅ 이미지-only PDF 입력에서도 동작
- ✅ 1:1 시각 충실도 (배경 픽셀 보존)
- ✅ 100% 로컬, API 키 없음
- ✅ MIT/Apache/BSD 호환 라이선스 (PyMuPDF AGPL은 별도 고지)
- ⚠️ CPU에서 페이지당 30–60초 (200 DPI). GPU에서는 2–5초
- ⚠️ 첫 실행 시 ~700 MB 다운로드 (PyTorch + LaMa 가중치)

### Option B: PDF 텍스트 객체 직접 파싱 (`pdf2slides` 또는 자체 구현)
- ✅ 텍스트 PDF에서는 OCR보다 빠르고 정확
- ❌ **이미지-only PDF에서는 빈 결과** — 본 프로젝트의 일차 사용 사례 실패
- ❌ pdf2slides는 GPL-3.0 → 본 프로젝트도 GPL이어야 함
- ❌ 폰트 매칭, 표 감지 등 엣지케이스가 끝없이 늘어남

### Option C: 클라우드 비전 LLM (Gemini / GPT-4o / Claude Vision)
- ✅ 가장 풍부한 구조 추출 (표, 도형, 다이어그램 인식)
- ❌ **API 키 필수, 비용 발생**
- ❌ PDF 내용이 외부 서버로 전송 → 기밀 문서 사용 불가
- ❌ 인터넷 연결 필수, rate limit (free tier 15 RPM 등)
- ❌ 모델 변경 시 출력 포맷 변경 위험

### Option D: 페이지를 통째로 이미지로 임베드
- ✅ 가장 단순
- ❌ **편집 불가능** — 핵심 요구사항 위반

### Option E: LibreOffice headless로 변환
- ✅ 즉시 동작
- ❌ 출력 품질 일정하지 않음
- ❌ 사용자 PC에 LibreOffice 설치 강제

## Tradeoffs accepted

1. **CPU 모드는 느림.** 페이지당 30–60초. GPU(CUDA)가 있으면 10배 이상
   빠름. README에서 명시하고, 200 DPI를 기본값으로 설정 (300 DPI는 옵션).

2. **OCR 누락 가능성.** 매우 작은 폰트, 회전 텍스트, 스타일된 글꼴은
   가끔 누락됨. 대응: 변환 후 브라우저 UI에서 사용자가 누락된 박스를 직접
   브러시로 그리고 "commit region"하면 그 영역만 추가로 LaMa 인페인팅 +
   해당 위치에 빈 텍스트박스 생성 ([src/core/review.py](../../src/core/review.py)의 `commit_new_region`).

3. **페이지 단위 처리.** 다단(multi-column) 자동 감지나 표 자동 셰이프화는
   하지 않음. OCR이 검출한 박스 단위로 텍스트박스가 생성되므로, 사용자가
   PowerPoint에서 그룹화/표 변환을 직접 할 수 있음.

4. **첫 실행 시 인터넷 필요.** PyTorch 휠과 LaMa 가중치 다운로드. 그 이후
   완전 오프라인. 폐쇄망 환경 대응은 [03-no-api-keys.md](03-no-api-keys.md)
   의 "Offline air-gapped install" 메모 참고.

## Verification

채택 결정 검증을 위해 다음을 확인했습니다:

- [x] `simple_lama_inpainting`이 PyPI에 존재 (`pip install simple_lama_inpainting`)
- [x] `from simple_lama_inpainting import SimpleLama`로 import 성공
- [x] `SimpleLama()(pil_image, mask_pil)` 호출이 PIL 이미지를 반환
- [x] `easyocr.Reader(['ko', 'en'])`가 한·영 혼합 페이지에서 bbox + text + score를 반환
- [x] `pdfplumber`로 PDF → 200 DPI PIL.Image 렌더링 성공
- [x] CPU 환경에서 end-to-end 변환 성공 (`tests/` 픽스처)
- [x] requirements.txt에 OpenAI / Anthropic / Google SDK 부재

## References

- LaMa 논문: Suvorov et al., "Resolution-robust Large Mask Inpainting with Fourier Convolutions" (WACV 2022) — https://arxiv.org/abs/2109.07161
- LaMa 원 저장소: https://github.com/saic-mdal/lama
- simple_lama_inpainting (사용 패키지): https://github.com/enesmsahin/simple-lama-inpainting
- EasyOCR: https://github.com/JaidedAI/EasyOCR
