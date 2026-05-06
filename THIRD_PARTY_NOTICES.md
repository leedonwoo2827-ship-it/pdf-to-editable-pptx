# Third Party Notices

본 프로젝트(`pdf-to-editable-powerpoint`)는 다음 오픈소스 라이브러리·모델을 사용합니다.

> 라이선스 전략의 자세한 설명은 [docs/research/04-license-strategy.md](docs/research/04-license-strategy.md) 참고.

---

## Inpainting (text removal)

### LaMa (Resolution-robust Large Mask Inpainting)

- **Paper**: Suvorov et al., *Resolution-robust Large Mask Inpainting with Fourier Convolutions*, WACV 2022 — https://arxiv.org/abs/2109.07161
- **Original repository**: https://github.com/saic-mdal/lama
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

### EasyOCR

- **Repository**: https://github.com/JaidedAI/EasyOCR
- **License**: Apache License 2.0
- **Role**: 한·영 텍스트 검출 + 인식. 본 프로젝트는 `langs=['ko', 'en']`로 한국어 네이티브 모델을 사용합니다. PyTorch 백엔드 (LaMa와 공유).
- **Models**: 첫 호출 시 한국어/영어 인식 모델과 텍스트 검출 모델이 자동 다운로드됩니다 (~70 MB 합산). 가중치 라이선스는 Apache 2.0 (코드와 동일).

### EasyOCR이 의존하는 추가 패키지

- **python-bidi** (BSD-style) — 양방향 텍스트 처리
- **Shapely** (BSD 3-Clause) — 폴리곤 기하 연산
- **pyclipper** (MIT) — 폴리곤 오프셋 (텍스트 영역 확장)

이 패키지들은 EasyOCR 설치 시 자동으로 함께 깔립니다.

---

## PDF rendering

### pdfplumber

- **Repository**: https://github.com/jsvine/pdfplumber
- **License**: MIT
- **Role**: PDF 페이지 → PIL.Image (변환 파이프라인 본 작업). 내부적으로 pypdfium2 사용.

### pypdfium2 (pdfplumber 의존)

- **Repository**: https://github.com/pypdfium2-team/pypdfium2
- **License**: Apache 2.0 / BSD-3 (PDFium은 BSD-3, 본 바인딩은 Apache 2.0)

### PyMuPDF (fitz)

- **Repository**: https://github.com/pymupdf/PyMuPDF
- **License**: **GNU Affero General Public License v3.0 (AGPL-3.0)** 또는 Artifex 상용 라이선스
- **License URL**: https://github.com/pymupdf/PyMuPDF/blob/main/COPYING
- **Role**: 브라우저 썸네일 경로에서만 사용 (스레드 안전이 필요한 경로). 변환 파이프라인은 pdfplumber 사용.

> **⚠️ AGPL 영향:** PyMuPDF는 본 프로젝트 의존성 중 가장 엄격한 라이선스를 가집니다. 데스크톱·로컬 사용에서는 AGPL의 추가 의무가 발동하지 않지만, 본 앱을 외부 SaaS로 호스팅할 경우 네트워크 사용자에게도 소스 공개 의무가 발생합니다. 폐쇄소스 상용 배포 시 Artifex 상용 라이선스를 별도 구매하거나, PyMuPDF를 pypdfium2 등으로 교체해야 합니다 (썸네일 경로만 사용하므로 교체 비용 낮음 — [docs/research/04-license-strategy.md](docs/research/04-license-strategy.md) 참고).
>
> 본 프로젝트의 메인 라이선스는 MIT이지만, 사용자가 PyMuPDF가 포함된 배포본을 받을 때는 AGPL 의무가 함께 적용됩니다.

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
| Apache 2.0 | LaMa 코드, EasyOCR, opencv-python, python-multipart, pypdfium2 (바인딩) | 라이선스 고지 + 변경 사항 표시 |
| BSD-style | python-bidi, Shapely | 라이선스 고지 |
| BSD 3-Clause | Uvicorn, NumPy, PyTorch, pypdfium2 (PDFium 코어) | 라이선스 고지 |
| HPND | Pillow | 라이선스 고지 |
| **AGPL-3.0** | **PyMuPDF** | ⚠️ 데스크톱 사용은 무관, 네트워크 배포 시 소스 공개 의무 |
| ⚠️ 별도 확인 | LaMa 모델 가중치 | 사용 전 가중치 배포본의 LICENSE 확인 (특히 상업 사용 시) |

**본 프로젝트의 라이선스**: MIT.
**배포본에 적용되는 추가 의무**: PyMuPDF의 AGPL 조항 (네트워크 서비스화
시 소스 공개), LaMa 가중치의 별도 라이선스 (상업 사용 시 사용자 확인
필요).

## Acknowledgments

- LaMa 알고리즘에 대한 모든 신용은 Roman Suvorov, Elizaveta Logacheva, Anton Mashikhin, Anastasia Remizova, Arsenii Ashukha, Aleksei Silvestrov, Naejin Kong, Harshith Goka, Kiwoong Park, Victor Lempitsky 및 SAIC 연구진에게 있습니다.
- EasyOCR의 한국어 인식 모델은 JaidedAI 팀이 학습·배포하고 있습니다.
