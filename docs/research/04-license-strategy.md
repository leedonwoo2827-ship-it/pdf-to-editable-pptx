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

| 항목 | 라이선스 |
|---|---|
| **코드** ([saic-mdal/lama](https://github.com/saic-mdal/lama) 저장소) | Apache 2.0 (상업 사용 OK) |
| **Big-LaMa 가중치 파일 (~200 MB)** | 명시적 LICENSE 파일이 동봉되지 않음. 학습에 사용된 [Places2](http://places2.csail.mit.edu/) 데이터셋은 **연구·비상업 목적**만 허용 |

→ 가중치를 상업 환경에 사용하는 게 **명시적으로 허용된 적이 없는** 상태입니다.
금지된다고 명시된 것도 아닙니다. ML 분야의 흔한 회색 지대.

`simple_lama_inpainting`은 자동 다운로드되는 가중치의 출처를 코드로
확인할 수 있습니다 (패키지 `__init__.py` 또는 GitHub 릴리스 URL).

### 사용 시나리오별 실무 위험도

엄밀한 법적 판단은 회색 지대지만, 시나리오에 따라 실무 위험은 크게 다릅니다.

| 시나리오 | 위험도 | 이유 |
|---|:---:|---|
| 개인이 사내·로컬에서 자료 정리용으로 변환 | 🟢 거의 없음 | "내부 사용"은 분쟁 사례가 사실상 0 |
| 사내 다수 동료가 사용, 변환 결과를 회의·발표에 활용 | 🟡 낮음 | 학술 데이터셋 라이선스(Places2 CC-BY-NC)의 enforcement는 사실상 없음 |
| 변환 결과 PPTX를 외부 고객·계약 산출물에 포함 | 🟡 낮음 | PPTX는 사용자가 만든 콘텐츠이고, LaMa 가중치를 포함·재배포하는 게 아님 |
| 본 도구를 **제품화**하여 외부 고객에게 SaaS로 제공 | 🔴 위배 가능성 명확 | 가중치를 상업 서비스의 핵심 부품으로 사용 |
| 가중치 파일 자체를 **재배포** | 🔴 위배 명확 | 라이선스 명시 없는 ML 가중치는 재배포 불가 |

**비유**: academic ML 가중치는 학술 논문 PDF에 가깝습니다. 학술 논문도 저자가
"회사에서 의사결정에 참고하지 마세요"라고 막을 방법이 없죠. 학술 공개된
가중치를 사내에서 사용하는 행위 자체를 막은 사례는 없습니다. 반면 가중치를
통째로 다른 SaaS에 끼워서 파는 건 명확히 다른 얘기.

### Industry context

ML 가중치 라이선스는 **산업 전체가 회색 지대**고, 사내 사용에 대한
enforcement는 사실상 없는 상태입니다. 비슷한 위치의 다른 도구들:

- **IOPaint** (구 lama-cleaner) — 같은 LaMa 가중치 사용. 수많은 회사·개인이 내부 도구로 사용 중. 분쟁 사례 0.
- **Stable Diffusion** — OpenRAIL-M 라이선스에 "no harmful use" 조항 있지만 사내 사용은 광범위.
- **Whisper** (OpenAI) — MIT지만 학습 데이터의 라이선스는 별개. 회사들이 사내 STT로 광범위 사용.

### When to escalate

다음 두 시점에서는 멈추고 검토하는 게 안전합니다:

1. **본 도구를 회사 외부 사람도 쓸 수 있게 배포하려는 시점** — 가중치 라이선스의 명시적 확인이 필요. 모호하면 commercial-OK 가중치로 교체하거나 직접 재학습.
2. **변환 결과물에 LaMa로 만든 이미지가 유료 산출물의 핵심 가치가 되는 시점** — 사내 법무팀 컨펌 권장.

> ⚠️ **Disclaimer**: 본 문서의 위험도 평가는 ML 산업 일반 관행에 기반한
> 실무적 가이드이지 법률 자문이 아닙니다. 회사 정책에 따라 사내 법무팀
> 의견이 우선합니다.

### Action items (본 저장소 유지보수)

1. `simple_lama_inpainting`이 다운로드하는 가중치 파일 URL을 확인.
2. 해당 가중치의 LICENSE 파일이 있다면 읽어 **상업 사용이 허용되는지** 명시 확인.
3. 비상업 제한이 명시된다면 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)에서 더 강하게 경고하고, 본 저장소를 상업 제품에 통합하려는 사용자에게 직접 학습한 가중치로 교체하도록 안내.

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
