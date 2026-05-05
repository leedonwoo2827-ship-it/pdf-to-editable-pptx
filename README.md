# PDF → Editable PowerPoint

PDF를 **진짜 편집 가능한 PowerPoint**로 변환합니다. AI(LaMa)가 페이지 이미지에서 텍스트만 깨끗이 지우고, 그 위에 편집 가능한 텍스트박스를 얹습니다.

**100% 로컬 · API 키 불필요 · 인터넷 불필요** (LaMa 모델 첫 다운로드 시만 필요)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

---

## 🚀 Quick start (Windows)

```cmd
git clone https://github.com/leedonwoo2827-ship-it/pdf-to-editable-pptx
cd pdf-to-editable-pptx
install.bat
python app.py
```

> 첫 설치 약 **5~10분** (PyTorch + LaMa 모델 ~700MB).
> 가상환경 격리 원하면 `install.bat` 대신 `setup.bat` 사용.

### macOS / Linux

```bash
git clone https://github.com/leedonwoo2827-ship-it/pdf-to-editable-pptx
cd pdf-to-editable-pptx
bash setup.sh
source .venv/bin/activate
python app.py
```

### GPU 가속 (선택, ~10배 빠름)

NVIDIA GPU + CUDA가 있으면:
```cmd
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

## 📖 사용법

`python app.py` 실행 → 브라우저 자동 오픈 → PDF 업로드 → DPI 선택(권장 200) → **Start Convert** → 페이지별 진행률 확인 → **Download .pptx**

PowerPoint에서 열면 모든 텍스트가 클릭으로 편집 가능합니다.

## ⚙️ 작동 원리

페이지마다:
1. **pdfplumber** — PDF 페이지 → 이미지
2. **RapidOCR** — 텍스트 위치·내용 검출 (한·영)
3. **LaMa** (PyTorch) — 검출된 텍스트만 깨끗이 지움
4. **python-pptx** — 깨끗한 배경 + 편집 가능한 텍스트박스로 슬라이드 구성

## 🆚 다른 방식과 비교

| | 이 도구 | 클라우드 변환기 | 이미지 박는 도구 |
|---|:---:|:---:|:---:|
| 텍스트 편집 가능 | ✅ | ✅ | ❌ |
| 100% 로컬 | ✅ | ❌ | ✅ |
| API 키 불필요 | ✅ | ❌ | ✅ |
| 한국어 OCR | ✅ | ✅ | n/a |
| 무료 | ✅ | 제한적 | ✅ |

## 🧪 한계

- **CPU 모드 느림**: 페이지당 30~60초 (200 DPI). GPU에서는 2~5초.
- **OCR 정확도**: 매우 작은/스타일된 텍스트는 가끔 누락.
- **메모리**: 큰 PDF + 고해상도 인페인팅은 RAM/VRAM 많이 사용.

## 📜 License

MIT — see [LICENSE](LICENSE). 의존성 라이선스 고지: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## 🙏 Credits

- [ysrock/pdf2pptx-ai-tool](https://github.com/ysrock/pdf2pptx-ai-tool) — 핵심 파이프라인 영감
- [LaMa](https://github.com/saic-mdal/lama) — Resolution-robust large mask inpainting
- [RapidOCR](https://github.com/RapidAI/RapidOCR) — ONNX 다국어 OCR
- [simple_lama_inpainting](https://github.com/enesmsahin/simple-lama-inpainting) — LaMa 간소화 래퍼

설계 결정 트레일은 [docs/research/](docs/research/) 참고.
