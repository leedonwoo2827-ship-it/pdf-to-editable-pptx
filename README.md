# PDF → Editable PowerPoint

PDF를 **진짜 편집 가능한 PowerPoint**로 변환합니다. AI(LaMa)가 페이지 이미지에서 텍스트만 깨끗이 지우고, 그 위에 편집 가능한 텍스트박스를 얹습니다.

**100% 로컬 · API 키 불필요 · 인터넷 불필요** (LaMa 모델 첫 다운로드 시만 필요)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10–3.12](https://img.shields.io/badge/python-3.10--3.12-blue.svg)](https://www.python.org/downloads/release/python-3129/)

---

## 📚 처음 사용하는 분

1. **[설치 가이드 — docs/install.md](docs/install.md)** (스크린샷 포함, 15~20분)
2. **[사용법 — docs/usage.md](docs/usage.md)** (스크린샷 포함)

> ⚠️ **Python 3.10 / 3.11 / 3.12 만 지원**합니다. 3.13 / 3.14는 동작하지 않습니다 (몇몇 ML 의존성이 아직 그 버전용 wheel을 배포하지 않았습니다). 자세한 이유와 대처는 [install.md](docs/install.md) 참고.

---

## 🚀 Quick start (이미 Python 3.12가 깔린 분)

### Windows — 두 가지 경로

**대부분 사용자 — `setup.bat` (격리된 .venv, 추천)**
```cmd
git clone https://github.com/leedonwoo2827-ship-it/pdf-to-editable-pptx
cd pdf-to-editable-pptx
setup.bat
.venv\Scripts\activate
python app.py
```

**Advanced — 시스템 Python에 호환 PyTorch가 이미 있을 때 — `install.bat`**
```cmd
git clone https://github.com/leedonwoo2827-ship-it/pdf-to-editable-pptx
cd pdf-to-editable-pptx
install.bat
python app.py
```

> `install.bat`은 .venv를 만들지 않고 **시스템 Python에 직접** 설치합니다.
> 이미 깔린 PyTorch를 재사용하므로 ~200 MB 다운로드를 아낍니다. 단, 다른
> 프로젝트와 의존성 버전이 충돌하면 그쪽이 깨질 수 있으니 본인이 Python 환경을
> 관리하는 사람만 선택하세요. 잘 모르겠으면 **`setup.bat`을 쓰세요**.

다음 번부터는 **`start.bat` 더블클릭**으로 끝.

### macOS / Linux
```bash
git clone https://github.com/leedonwoo2827-ship-it/pdf-to-editable-pptx
cd pdf-to-editable-pptx
bash setup.sh
source .venv/bin/activate
python app.py
```

> macOS / Linux는 `setup.sh` (격리된 .venv) 한 가지 경로만 제공합니다. 시스템 Python을
> 직접 쓰고 싶으면 `pip install -r requirements.txt`로 수동 설치하세요.

브라우저가 자동으로 `http://127.0.0.1:8000` 열립니다.

---

## ⚙️ 작동 원리

페이지마다:

1. **pdfplumber** — PDF 페이지 → 이미지
2. **EasyOCR** (`['ko', 'en']`) — 텍스트 위치·내용 검출 (한·영 네이티브 모델)
3. **LaMa** (PyTorch) — 검출된 텍스트만 깨끗이 지움
4. **python-pptx** — 깨끗한 배경 + 편집 가능한 텍스트박스로 슬라이드 구성

코드 구조는 `src/core/` 안의 모듈들로 책임 분리되어 있습니다:
[ocr.py](src/core/ocr.py) · [inpaint.py](src/core/inpaint.py) ·
[pdf_pages.py](src/core/pdf_pages.py) · [mask.py](src/core/mask.py) ·
[slide_writer.py](src/core/slide_writer.py) ·
[workspace.py](src/core/workspace.py) · [review.py](src/core/review.py) ·
[pipeline.py](src/core/pipeline.py).

자세한 설계 결정은 [docs/research/](docs/research/) 참고.

---

## 🆚 다른 방식과 비교

| | 이 도구 | 클라우드 변환기 | 이미지 박는 도구 |
|---|:---:|:---:|:---:|
| 텍스트 편집 가능 | ✅ | ✅ | ❌ |
| 100% 로컬 | ✅ | ❌ | ✅ |
| API 키 불필요 | ✅ | ❌ | ✅ |
| 한국어 OCR | ✅ | ✅ | n/a |
| 무료 | ✅ | 제한적 | ✅ |

---

## 🧪 한계

- **CPU 모드 느림**: 페이지당 30~60초 (200 DPI). NVIDIA GPU + CUDA 환경에서는 페이지당 2~5초. GPU 활성화는 [install.md "GPU 가속"](docs/install.md#gpu-가속-선택) 참고.
- **OCR 정확도**: 매우 작은/스타일된 텍스트는 가끔 누락. 변환 후 브라우저 Review 모드에서 누락된 영역을 직접 칠해서 보완 가능 ([usage.md 5단계](docs/usage.md#5-선택-브라우저에서-다듬기)).
- **메모리**: 큰 PDF + 고해상도 인페인팅은 RAM/VRAM 많이 사용.

---

## 📜 License

MIT — see [LICENSE](LICENSE). 의존성 라이선스 고지: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

LaMa 모델 가중치는 코드와 라이선스가 다를 수 있으니 상업 사용 전 별도 확인 필요 ([docs/research/04-license-strategy.md](docs/research/04-license-strategy.md)).

---

## 🙏 Credits

- [LaMa](https://github.com/saic-mdal/lama) — Resolution-robust Large Mask Inpainting (Suvorov et al., WACV 2022)
- [simple_lama_inpainting](https://github.com/enesmsahin/simple-lama-inpainting) — LaMa 추론 래퍼
- [EasyOCR](https://github.com/JaidedAI/EasyOCR) — 한국어 네이티브 OCR (PyTorch 기반)

---

## 📁 문서 인덱스

| 문서 | 내용 |
|---|---|
| [docs/install.md](docs/install.md) | 설치 가이드 (Windows 스크린샷 포함) |
| [docs/usage.md](docs/usage.md) | 사용법 (스크린샷 포함) |
| [docs/research/](docs/research/) | 설계 결정 트레일 (왜 LaMa? 왜 EasyOCR? 라이선스 전략?) |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | 의존성 라이선스 고지 |
