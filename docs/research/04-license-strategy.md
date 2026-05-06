# 04. License Strategy

## TL;DR

**본 프로젝트는 MIT로 배포됩니다** ([LICENSE](../../LICENSE)).
의존성은 모두 MIT / Apache 2.0 / BSD / HPND 등 호환 라이선스이며,
**한 가지 예외**가 있습니다 — `PyMuPDF`는 **AGPL-3.0** (또는 Artifex 상용)
입니다. 데스크톱·로컬 사용에서는 추가 의무가 발동하지 않지만, **본 앱을
네트워크 서비스로 배포할 경우 AGPL이 사용자에게도 소스 공개를 요구**
합니다. 자세한 의미는 아래 참고.

또한 **LaMa 모델 가중치의 출처와 라이선스**는 사용 전 별도로 확인이
필요합니다 (코드 라이선스와 학습 가중치 라이선스가 다를 수 있음).

## Dependencies & licenses

| 의존성 | 라이선스 | 영향 |
|---|---|---|
| `simple_lama_inpainting` (래퍼) | MIT | 호환 |
| LaMa 추론 코드 (saic-mdal/lama) | Apache 2.0 | 호환 (라이선스 고지 + 변경 표시) |
| **LaMa 가중치 (Big-LaMa)** | ⚠️ **별도 — 사용 전 확인** | 아래 "Model weights" 섹션 |
| `torch`, `torchvision` | BSD-style | 호환 |
| `easyocr` (+ 한·영 모델 가중치) | Apache 2.0 | 호환 |
| `python-bidi`, `Shapely`, `pyclipper` (EasyOCR 의존) | BSD-style / BSD-3 / MIT | 호환 |
| `pdfplumber` | MIT | 호환 |
| `pypdfium2` (pdfplumber 의존) | Apache 2.0 / BSD-3 | 호환 |
| **`PyMuPDF` (fitz)** | **AGPL-3.0** 또는 Artifex 상용 | ⚠️ 네트워크 배포 시 소스 공개 의무 |
| `opencv-python` | Apache 2.0 (OpenCV: BSD-3) | 호환 |
| `numpy` | BSD | 호환 |
| `Pillow` | HPND | 호환 |
| `python-pptx` | MIT | 호환 |
| `fastapi` | MIT | 호환 |
| `uvicorn` | BSD-3 | 호환 |
| `python-multipart` | Apache 2.0 | 호환 |
| `pydantic` | MIT | 호환 |
| Tailwind CSS, Alpine.js (CDN) | MIT, MIT | 호환 |

호환 = 본 프로젝트의 MIT 배포에 충돌 없음. 라이선스 고지(저작권 + 라이선스
전문 또는 링크)만 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)에
포함하면 됩니다.

## The PyMuPDF AGPL question

PyMuPDF는 본 프로젝트가 사용하는 의존성 중 **가장 엄격한 라이선스
(AGPL-3.0)** 를 가집니다. AGPL의 핵심 차이:

- GPL은 **바이너리를 배포할 때**만 소스 공개를 요구.
- AGPL은 **사용자가 네트워크 서비스로 접근**할 때도 소스 공개를 요구.

본 프로젝트의 사용 형태별로 정리하면:

| 사용 형태 | AGPL 의무 | 본 프로젝트 권장 |
|---|---|---|
| 1인 데스크톱 사용 (`python app.py` 후 본인이 localhost 접속) | 발동 안 함 | OK |
| 사내 LAN에 띄우고 같은 팀이 접속 | 발동 가능 (네트워크 사용자에게도 소스 공개) | 본 저장소 자체가 공개 MIT 코드이므로 GitHub URL 안내로 충분히 만족 |
| 외부 SaaS로 호스팅하여 일반 사용자에게 제공 | 명시적 발동 | 사용자에게 (a) GitHub 저장소 URL 노출 또는 (b) PyMuPDF를 pypdfium2로 교체 또는 (c) Artifex 상용 라이선스 구매 |

본 프로젝트의 메인 라이선스는 MIT이지만, **PyMuPDF를 포함한 배포본을 받는
사람은 AGPL 의무도 함께 적용**됩니다 (이중 의무: MIT 본 코드 + AGPL
PyMuPDF).

### Mitigation path: PyMuPDF 제거

만약 폐쇄소스 SaaS 배포가 필요해진다면:

- 변환 파이프라인은 이미 `pdfplumber`(MIT, 내부적으로 pypdfium2 Apache 2.0/BSD-3)를 사용 → AGPL 영향 없음.
- `PyMuPDF`는 **브라우저 썸네일 경로**에서만 사용 ([src/core/page_render.py](../../src/core/page_render.py)). 변환 파이프라인은 [src/core/pdf_pages.py](../../src/core/pdf_pages.py)에서 `pdfplumber`(MIT) + `pypdfium2`(Apache 2.0/BSD-3)를 사용하므로 AGPL 영향이 없습니다.
- 따라서 썸네일 경로를 `pypdfium2` 또는 다른 스레드-안전 대안으로 교체하면
  의존성에서 PyMuPDF를 완전히 제거 가능 → AGPL 의무 소멸.

이는 **상용화 시점에만** 검토하면 되는 작업이고, 현재 오픈소스 공개에서는
PyMuPDF의 AGPL이 문제가 되지 않습니다.

## Model weights — 별도 확인 필요

코드 라이선스(Apache 2.0)와 **학습된 모델 가중치의 라이선스**는 별개일 수
있습니다. LaMa의 경우:

- 저자 공식 저장소 [saic-mdal/lama](https://github.com/saic-mdal/lama)에서
  배포되는 **Big-LaMa 가중치**는 Places2 데이터셋으로 학습되었고, 일부
  배포본에는 **연구·비상업 목적 제한**이 명시된 경우가 있습니다.
- `simple_lama_inpainting`은 자동 다운로드되는 가중치의 출처를 코드로 확인
  가능합니다 (패키지 `__init__.py` 또는 GitHub 릴리스 URL).

**Action item (배포 전 확인)**:

1. `simple_lama_inpainting`이 다운로드하는 가중치 파일 URL을 확인.
2. 해당 가중치의 LICENSE 파일을 읽어 **상업 사용이 허용되는지** 명시 확인.
3. 비상업 제한이 있다면 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)에 명시하고, 본 저장소를 상업 제품에 통합하려는 사용자가 직접 학습한 가중치로 교체하도록 안내.

> 본 저장소는 학습 가중치를 **재배포하지 않습니다**. 사용자가 처음 실행할
> 때 원 저장소에서 직접 다운로드하므로, 가중치 라이선스의 책임은 최종
> 사용자에게 분배됩니다. 이 구조는 의도된 선택입니다.

## Implications for users

### ✅ 자유롭게 가능 (MIT 본 프로젝트 기준)

- 개인적·사내·상업적 사용
- 결과물(.pptx)을 어떤 라이선스로든 배포 — MIT는 *프로그램*에 적용되지
  *프로그램이 출력한 콘텐츠*에 미치지 않음
- 본 프로젝트를 포크·수정하여 MIT 또는 호환 라이선스로 재배포

### ⚠️ 주의

- **PyMuPDF를 포함한 배포본**은 AGPL 의무가 함께 적용됨 (위 "PyMuPDF AGPL
  question" 표 참조).
- **LaMa 가중치**의 라이선스를 별도 확인 (위 "Model weights" 섹션 참조).
- Apache 2.0 항목들 (LaMa 코드, EasyOCR, OpenCV 등)은 **변경 사항 표시
  요건**이 있음 — 본 저장소가 이 코드들을 수정하지 않고 그대로
  의존하므로 라이선스 고지만으로 충족.

## Required files at distribution

| 파일 | 내용 |
|---|---|
| [LICENSE](../../LICENSE) | MIT 전문 |
| [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) | 모든 의존성의 라이선스 고지 (PyMuPDF AGPL은 더 자세히, LaMa 가중치 출처 명시) |
| [README.md](../../README.md) 라이선스 섹션 | "MIT — see LICENSE. 의존성 라이선스 고지: THIRD_PARTY_NOTICES.md." |

## License compatibility check (recommended)

배포 전 자동 검증을 위해:

```bash
pip install pip-licenses
pip-licenses --format=markdown --with-urls --with-license-file
```

결과를 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)와 비교하여
누락된 라이선스가 있는지 확인.

## References

- MIT License: https://opensource.org/license/mit/
- Apache 2.0: https://www.apache.org/licenses/LICENSE-2.0
- AGPL-3.0 vs GPL-3.0: https://www.gnu.org/licenses/why-affero-gpl.html
- PyMuPDF licensing: https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright
- LaMa repo: https://github.com/saic-mdal/lama
- simple_lama_inpainting: https://github.com/enesmsahin/simple-lama-inpainting
- EasyOCR: https://github.com/JaidedAI/EasyOCR
