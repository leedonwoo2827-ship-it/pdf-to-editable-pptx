# Third Party Notices

본 프로젝트(`pdf-to-editable-powerpoint`)는 다음 오픈소스 라이브러리·모델을 사용합니다.

> 라이선스 전략의 자세한 설명은 [docs/research/04-license-strategy.md](docs/research/04-license-strategy.md) 참고.

---

## Inpainting (text removal)

### LaMa (Resolution-robust Large Mask Inpainting)

- **Paper**: Suvorov et al., *Resolution-robust Large Mask Inpainting with Fourier Convolutions*, WACV 2022 — https://arxiv.org/abs/2109.07161
- **Original repository**: https://github.com/advimman/lama
- **Code license**: Apache License 2.0
- **Role**: 페이지 이미지에서 OCR이 검출한 텍스트 영역만 깨끗이 제거 (배경·로고·차트 픽셀은 보존)

### simple_lama_inpainting (LaMa wrapper, used package)

- **Repository**: https://github.com/enesmsahin/simple-lama-inpainting
- **License**: MIT
- **Role**: LaMa 추론 경로만 래핑한 PyPI 패키지 (`from simple_lama_inpainting import SimpleLama`)

### LaMa model weights

- **Distribution**: `simple_lama_inpainting` 패키지가 첫 호출 시 자동 다운로드 (~200 MB)
- **License**: ⚠️ 가중치 자체의 라이선스는 코드 라이선스와 별개입니다. 학습 데이터(Places2 등)와 원 저자 배포본의 조건을 사용 전에 확인하세요. 본 저장소는 가중치를 재배포하지 않습니다.
- **상용 사용 시 권장**: 다운로드된 가중치 파일에 동봉된 LICENSE를 직접 확인, 또는 같은 아키텍처로 자체 학습한 가중치로 교체.

---

## OCR

### PaddleOCR

- **Repository**: https://github.com/PaddlePaddle/PaddleOCR
- **License**: Apache License 2.0
- **Role**: 한국어 텍스트 검출 + 인식. 본 프로젝트는 `lang='korean'` 으로 한국어 네이티브 모델을 사용합니다 (PaddlePaddle 백엔드).
- **Models**: 첫 호출 시 한국어 인식 모델 + 텍스트 검출(DB) 모델 + 각도 분류기가 자동 다운로드됩니다 (~수십 MB 합산). 가중치 라이선스는 Apache 2.0 (코드와 동일).

### PaddlePaddle (PaddleOCR 백엔드)

- **Repository**: https://github.com/PaddlePaddle/Paddle
- **License**: Apache License 2.0
- **Role**: PaddleOCR이 사용하는 딥러닝 프레임워크. CPU/GPU 둘 다 지원. 본 저장소의 requirements.txt는 CPU 기본 빌드를 명시.

### PaddleOCR이 의존하는 추가 패키지

- **Shapely** (BSD 3-Clause) — 폴리곤 기하 연산
- **pyclipper** (MIT) — 폴리곤 오프셋 (텍스트 영역 확장)
- **lmdb**, **imgaug**, **scikit-image** 등 (BSD/MIT 계열)

이 패키지들은 PaddleOCR 설치 시 자동으로 함께 깔립니다.

---

## PDF rendering

### pdfplumber

- **Repository**: https://github.com/jsvine/pdfplumber
- **License**: MIT
- **Role**: PDF 페이지 → PIL.Image (변환 파이프라인). 내부적으로 pypdfium2 사용.

### pypdfium2

- **Repository**: https://github.com/pypdfium2-team/pypdfium2
- **License**: Apache 2.0 (Python 바인딩) / BSD-3 (PDFium 코어, Chromium project)
- **Role**: 두 경로에서 사용:
  - 변환 파이프라인 — pdfplumber를 통해 간접 사용
  - 브라우저 썸네일 — `src/core/page_render.py`에서 직접 사용 (모듈 레벨 lock으로 PDFium의 thread-safety 한계 보완)

> 이전 버전에서는 썸네일 경로에 PyMuPDF(AGPL-3.0)를 사용했지만, 본 앱을 LAN 서버로 띄워 동료들과 공유할 가능성을 고려해 **AGPL을 의존성에서 완전히 제거**했습니다 (자세한 결정 배경: [docs/research/04-license-strategy.md](docs/research/04-license-strategy.md)). 현재 본 프로젝트의 모든 의존성은 MIT / Apache 2.0 / BSD / HPND 등 copyleft가 아닌 라이선스만 사용합니다.

---

## ML / image / array

### PyTorch (torch, torchvision)

- **Repository**: https://github.com/pytorch/pytorch
- **License**: BSD-style (PyTorch project 자체 라이선스)
- **Role**: LaMa 추론 백엔드 (CPU 또는 CUDA)

### OpenCV (opencv-python)

- **Repository**: https://github.com/opencv/opencv-python (Python 바인딩), https://github.com/opencv/opencv (코어)
- **License**: Apache License 2.0 (코어 OpenCV는 BSD-3에서 Apache 2.0으로 전환됨)
- **Role**: 마스크 생성·후처리 (`fillPoly`, `morphologyEx`, `dilate`)

### NumPy

- **Repository**: https://github.com/numpy/numpy
- **License**: BSD 3-Clause
- **Role**: 배열 연산

### Pillow (PIL)

- **Repository**: https://github.com/python-pillow/Pillow
- **License**: HPND (Historical Permission Notice and Disclaimer)
- **Role**: 이미지 입출력·crop·변환

---

## PPTX writing

### python-pptx

- **Repository**: https://github.com/scanny/python-pptx
- **License**: MIT
- **Role**: 16:9 슬라이드 생성, 배경 이미지 + 편집 가능한 텍스트박스 작성

---

## Web backend / frontend

### FastAPI

- **Repository**: https://github.com/fastapi/fastapi
- **License**: MIT
- **Role**: 로컬 HTTP 백엔드 (127.0.0.1:8000)

### Uvicorn

- **Repository**: https://github.com/encode/uvicorn
- **License**: BSD 3-Clause
- **Role**: ASGI 서버

### python-multipart

- **Repository**: https://github.com/Kludex/python-multipart
- **License**: Apache License 2.0
- **Role**: FastAPI 멀티파트 파일 업로드

### Pydantic

- **Repository**: https://github.com/pydantic/pydantic
- **License**: MIT
- **Role**: API 요청·응답 모델 정의

### Frontend libraries (CDN, not bundled)

- **Tailwind CSS** — MIT, https://github.com/tailwindlabs/tailwindcss
- **Alpine.js** — MIT, https://github.com/alpinejs/alpine

이 라이브러리들은 빌드 단계 없이 CDN(`cdn.tailwindcss.com`,
`unpkg.com/alpinejs`)에서 직접 로드됩니다. 본 저장소에 번들되지 않습니다.

---

## License compatibility summary

| 라이선스 | 사용 항목 | 의무 |
|---|---|---|
| MIT | FastAPI, python-pptx, pdfplumber, simple_lama_inpainting, pyclipper, Pydantic, Tailwind, Alpine, **본 프로젝트** | 라이선스 고지 |
| Apache 2.0 | LaMa 코드, PaddleOCR, PaddlePaddle, opencv-python, python-multipart, pypdfium2 (바인딩) | 라이선스 고지 + 변경 사항 표시 |
| BSD-style | python-bidi, Shapely | 라이선스 고지 |
| BSD 3-Clause | Uvicorn, NumPy, PyTorch, pypdfium2 (PDFium 코어) | 라이선스 고지 |
| HPND | Pillow | 라이선스 고지 |
| ⚠️ 별도 확인 | LaMa 모델 가중치 | 사용 전 가중치 배포본의 LICENSE 확인 (특히 상업 사용 시) |

**본 프로젝트의 라이선스**: MIT.
**Copyleft (GPL/AGPL) 의존성**: 없음. 모든 코드 의존성이 MIT / Apache 2.0 / BSD / HPND 계열 — 네트워크 배포·사내 LAN 공유·외부 SaaS 어떤 형태로 운영해도 라이선스 측면 추가 의무 없음.
**한 가지 잔존 회색 지대**: LaMa 모델 가중치의 학습 데이터(Places2) 라이선스. 본 저장소는 가중치를 재배포하지 않고 사용자 PC에서 첫 실행 시 원 저장소에서 다운로드하므로, 가중치 라이선스의 책임은 최종 사용자 환경에 분배됩니다 ([docs/research/04-license-strategy.md "Model weights"](docs/research/04-license-strategy.md) 참고).

## Acknowledgments

- LaMa 알고리즘에 대한 모든 신용은 Roman Suvorov, Elizaveta Logacheva, Anton Mashikhin, Anastasia Remizova, Arsenii Ashukha, Aleksei Silvestrov, Naejin Kong, Harshith Goka, Kiwoong Park, Victor Lempitsky 및 SAIC 연구진에게 있습니다.
- PaddleOCR의 한국어 인식 모델은 PaddlePaddle / PaddleOCR 팀(Baidu 및 오픈소스 컨트리뷰터)이 학습·배포하고 있습니다.
