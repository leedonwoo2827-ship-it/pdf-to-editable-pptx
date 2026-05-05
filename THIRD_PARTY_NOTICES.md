# Third Party Notices

본 프로젝트(`pdf-to-editable-powerpoint`)는 다음 오픈소스 라이브러리·서비스를 사용합니다.

> 라이선스 전략의 자세한 설명은 [docs/research/04-license-strategy.md](docs/research/04-license-strategy.md)와 pivot 이후의 변경사항을 정리한 [06-pivot-to-gemini.md](docs/research/06-pivot-to-gemini.md)를 참고하세요.

---

## google-genai (Google Gemini SDK)

- **Repository**: https://github.com/googleapis/python-genai
- **License**: Apache License 2.0
- **Role**: Gemini 2.5 Flash API 호출 (페이지 이미지 → 구조화된 요소 추출)
- **Note**: SDK는 Apache 2.0이지만, 호출하는 Gemini API는 Google의 [Generative AI 서비스 약관](https://ai.google.dev/gemini-api/terms)을 따릅니다. 무료 티어 사용 시 추가 약관이 적용될 수 있습니다.

## FastAPI

- **Repository**: https://github.com/fastapi/fastapi
- **License**: MIT
- **Role**: HTTP 백엔드 프레임워크

## Uvicorn

- **Repository**: https://github.com/encode/uvicorn
- **License**: BSD 3-Clause
- **Role**: ASGI 서버

## PyMuPDF (fitz)

- **Repository**: https://github.com/pymupdf/PyMuPDF
- **License**: GNU Affero General Public License v3.0 (AGPL-3.0) 또는 Artifex 상용 라이선스
- **Role**: PDF 페이지 렌더링 (페이지 → PNG, 페이지 영역 crop)
- **License URL**: https://github.com/pymupdf/PyMuPDF/blob/main/COPYING

PyMuPDF는 본 프로젝트에서 사용되는 의존성 중 가장 엄격한 라이선스(AGPL-3.0)를 가집니다. **데스크톱·로컬 사용에서는 AGPL의 추가 의무가 발동하지 않지만**, 본 앱을 네트워크 서비스로 변형하여 외부에 제공할 경우 그 사용자에게도 소스 코드를 공개해야 합니다. 상용 폐쇄소스 배포 시 Artifex의 상용 라이선스를 별도 구매해야 합니다.

본 프로젝트의 메인 라이선스는 MIT이지만, 사용자가 PyMuPDF가 포함된 배포본을 받을 때는 AGPL 의무가 함께 적용됩니다.

## python-pptx

- **Repository**: https://github.com/scanny/python-pptx
- **License**: MIT
- **Role**: PPTX 파일 작성 (텍스트박스, 이미지, 도형 등 셰이프 생성)

## Pillow (PIL)

- **Repository**: https://github.com/python-pillow/Pillow
- **License**: HPND (Historical Permission Notice and Disclaimer)
- **Role**: 이미지 crop 및 변환 (PDF 영역 → PNG 바이트)

## Pydantic

- **Repository**: https://github.com/pydantic/pydantic
- **License**: MIT
- **Role**: API 요청·응답 모델, Gemini structured output 스키마 정의

## python-dotenv

- **Repository**: https://github.com/theskumar/python-dotenv
- **License**: BSD 3-Clause
- **Role**: `.env` 파일에서 환경변수 로드

## Frontend libraries (CDN, not bundled)

- **Tailwind CSS** — MIT, https://github.com/tailwindlabs/tailwindcss
- **Alpine.js** — MIT, https://github.com/alpinejs/alpine

이 라이브러리들은 빌드 단계 없이 CDN(`cdn.tailwindcss.com`, `unpkg.com/alpinejs`)에서 직접 로드됩니다. 본 저장소에 번들되지 않습니다.

---

## License compatibility summary

| 라이선스 | 호환성 | 의무 |
|---|---|---|
| MIT (FastAPI, python-pptx, Pydantic, Tailwind, Alpine, 본 프로젝트) | ✅ | 라이선스 고지 |
| BSD 3-Clause (Uvicorn, python-dotenv) | ✅ | 라이선스 고지 |
| Apache 2.0 (google-genai) | ✅ | 라이선스 고지, 변경 사항 표시 |
| HPND (Pillow) | ✅ | 라이선스 고지 |
| **AGPL-3.0** (PyMuPDF) | ⚠️ 데스크톱 사용은 무관, 네트워크 배포 시 소스 공개 의무 | 본 프로젝트 사용자에게도 소스 공개 |

**본 프로젝트의 라이선스**: MIT.
**배포본에 적용되는 의무**: PyMuPDF의 AGPL 조항이 함께 적용됨 (네트워크 서비스화 시 소스 공개).

## API service notice

본 앱은 사용자가 입력한 Gemini API 키로 [Google Gemini API](https://ai.google.dev/) 를 호출합니다. 이 호출에는 다음이 포함됩니다:

- **전송**: 분석 대상 PDF 페이지의 PNG 이미지
- **수신**: 페이지에 포함된 요소들의 JSON 표현

Google의 데이터 처리 약관은 [https://ai.google.dev/gemini-api/terms](https://ai.google.dev/gemini-api/terms)을 참고하세요. 무료 티어로 호출된 콘텐츠는 Google의 모델 개선에 사용될 수 있습니다(2025년 기준; Google 정책 확인 필요). 민감한 PDF는 유료 티어를 사용하거나 본 앱을 사용하지 마세요.

## Acknowledgments

- Google AI Studio의 "CUP PDF to PPTX" 데모가 본 프로젝트의 UX 영감을 제공했습니다.
- 본 프로젝트는 첫 시도(pdf2slides 기반 데스크톱 변환기)에서 사용자의 실제 요구사항을 잘못 이해한 후, 사용자의 명확한 피드백 덕분에 올바른 방향(AI 비전 기반 편집기)으로 pivot했습니다. 자세한 내용: [docs/research/06-pivot-to-gemini.md](docs/research/06-pivot-to-gemini.md).
