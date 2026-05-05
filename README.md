# PDF → Editable PowerPoint

> **PDF 페이지에서 AI가 텍스트를 깨끗이 제거하고 그 위에 편집 가능한 텍스트박스를 얹어 진짜 편집 가능한 .pptx로 변환합니다. 100% 로컬, API 키 없음.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![100% Local](https://img.shields.io/badge/100%25-local-success.svg)](docs/research/06-pivot-to-gemini.md)

---

## ✨ Features

- 🔒 **100% 로컬 실행** — PDF가 어떤 외부 서버에도 올라가지 않음. API 키, 인터넷 연결 모두 불필요 (LaMa 모델 첫 다운로드 시만 인터넷 필요)
- 🎯 **이중 텍스트 없음** — LaMa AI 인페인팅으로 원본 텍스트를 깨끗이 제거 후 편집 가능한 텍스트만 얹음
- 🇰🇷 **한국어/영어 OCR** — RapidOCR(CPU 친화적)이 한·영 혼합 문서 처리
- 🖥️ **웹 UI** — 단일 프로세스, `python app.py` 한 번으로 시작
- 📊 **페이지별 상태** — 변환 중 ✓⚠️❌으로 어느 페이지가 잘 됐는지 즉시 확인
- 🆓 **무료, 오픈소스** — MIT 라이선스

## 🆚 vs other approaches

| | This app | Cloud converters | Image-based tools |
|---|:---:|:---:|:---:|
| 텍스트 편집 가능 | ✅ | ✅ | ❌ |
| 100% 로컬 | ✅ | ❌ | ✅ |
| API 키 불필요 | ✅ | ❌ | ✅ |
| 한국어 OCR | ✅ | ✅ | n/a |
| 무료 | ✅ | 제한적 | ✅ |
| **이미지 PDF 지원** | **✅ (LaMa 인페인팅)** | ⚠️ | ❌ |

## 🚀 Quick start

### Prerequisites

- Python 3.10+ (3.11 권장)
- 디스크 약 1.5 GB (PyTorch + LaMa 모델 포함)
- (선택) NVIDIA GPU + CUDA → 페이지당 변환 시간이 30초 → 2초로 단축됨

### Install & run

```bash
git clone https://github.com/<TBD>/pdf-to-editable-powerpoint.git
cd pdf-to-editable-powerpoint
python -m pip install -r requirements.txt
python app.py
```

`python app.py` 실행 시:
1. FastAPI 서버가 `http://127.0.0.1:8000`에서 시작
2. 자동으로 브라우저가 열림
3. PDF 업로드 → DPI 선택 → "Start Convert" → 진행률 → 다운로드

> 처음 변환 실행 시 **LaMa 모델(~196MB)** 이 자동 다운로드됩니다. 이후엔 오프라인 동작.

### GPU 가속 (선택)

NVIDIA GPU가 있으면 변환이 ~10~20배 빨라집니다:

```bash
# CUDA 12.1 기준
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

자동 감지되며, GPU가 없으면 CPU 모드로 fallback.

## 📖 Usage

```
Upload PDF → DPI 선택 (200 권장) → Start Convert
                ↓
좌측 패널에 페이지별 상태 실시간 표시:
  Page 1   ✅ Done (32 text blocks · 28s)
  Page 2   🔄 Removing text from background…
  Page 3   ⏳ Queued
  ...
                ↓
완료 후 "Download .pptx" 클릭 → PowerPoint에서 편집
```

각 페이지의 모든 텍스트가 **진짜 편집 가능한 PowerPoint 텍스트박스**로 들어가 있고, 다이어그램/이미지/도형은 LaMa가 텍스트만 깨끗이 지우고 보존합니다.

## 🔬 How it works

```
페이지마다:
  1. pdfplumber: PDF 페이지 → PIL 이미지 (DPI 200)
  2. RapidOCR: 텍스트 영역과 내용 검출 (한·영)
  3. cv2: 검출 영역의 폴리곤 마스크 + 적응형 dilation
  4. LaMa (PyTorch): 마스크 영역의 텍스트를 자연스럽게 제거
  5. python-pptx: 깨끗한 배경 + 편집 가능한 텍스트박스로 슬라이드 구성

모든 슬라이드는 16:9 (13.33×7.5") 로 통일, 각 페이지는 letterbox로 맞춤.
```

원본 프로젝트 [ysrock/pdf2pptx-ai-tool](https://github.com/ysrock/pdf2pptx-ai-tool)의 파이프라인을 기반으로 4가지 버그 수정을 적용했습니다 (자세한 내용은 [docs/research/06-pivot-to-gemini.md](docs/research/06-pivot-to-gemini.md)).

## 📁 Project structure

```
pdf-to-editable-powerpoint/
├── app.py                      # FastAPI + uvicorn 진입점, 자동으로 브라우저 오픈
├── requirements.txt
├── src/
│   ├── settings.py             # 경로, 사용자 데이터 디렉토리
│   ├── api/
│   │   ├── main.py             # FastAPI app
│   │   ├── routes.py           # /api/upload, /api/process, /api/status, /api/result
│   │   └── schemas.py          # Pydantic 모델 (JobStatus, PageStatus)
│   └── core/
│       ├── jobs.py             # in-memory job 저장소
│       ├── page_render.py      # PDF 페이지 → PNG 썸네일
│       └── local_export.py     # 핵심: OCR + LaMa + PPTX 생성
├── static/                     # SPA (Tailwind CDN + Alpine.js)
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── docs/research/              # 설계 결정 근거
```

## 🧪 Limitations

- **CPU 모드는 느림** — 페이지당 30~60초 (200 DPI 기준). GPU에서는 2~5초.
- **OCR 정확도** — RapidOCR은 일반 텍스트엔 정확하지만, 매우 작은/스타일링된 텍스트(예: 그래프 라벨)는 가끔 누락하거나 오인식.
- **메모리** — 큰 페이지(고해상도) + LaMa 인페인팅은 RAM/VRAM을 많이 씀. 너무 큰 PDF는 DPI를 낮추세요.
- **글꼴** — 원본 폰트 이름은 추출 못함; 시스템 기본 글꼴로 대체. 크기는 OCR bbox 기반 추정.

## 🗺️ Roadmap

- [x] 100% 로컬 변환 파이프라인 (v4)
- [x] 페이지별 진행률 + 상태 표시
- [x] DPI 슬라이더
- [ ] 변환 후 결과 미리보기 (편집 후 재export)
- [ ] 폰트 크기 휴리스틱 개선
- [ ] PyInstaller 단일 .exe 빌드

## 🤝 Contributing

PR 환영합니다. 새 기능 시 `docs/research/`에 결정 근거 문서 추가 권장.

## 📜 License

MIT — see [LICENSE](LICENSE). 의존성 라이선스: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## 🙏 Credits

- **[ysrock/pdf2pptx-ai-tool](https://github.com/ysrock/pdf2pptx-ai-tool)** — 핵심 파이프라인 영감
- **[LaMa](https://github.com/saic-mdal/lama)** — Resolution-robust large mask inpainting
- **[RapidOCR](https://github.com/RapidAI/RapidOCR)** — ONNX 기반 다국어 OCR
- **[simple_lama_inpainting](https://github.com/enesmsahin/simple-lama-inpainting)** — LaMa 간소화 래퍼
