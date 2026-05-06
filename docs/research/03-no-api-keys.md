# 03. No API Keys / 100% Local Execution

## Policy

본 애플리케이션은 **외부 API 키, 클라우드 서비스, 유료 구독 없이 사용자
PC에서 완전히 로컬로 실행**됩니다.

> 일회성 예외: 첫 실행 시 PyTorch 휠과 LaMa 모델 가중치(~700 MB), EasyOCR
> 한·영 모델(~70 MB)을 다운로드합니다. 그 이후로는 인터넷 연결 없이 동작합니다.

## What this guarantees

| | 보장 |
|---|---|
| 🔒 **프라이버시** | PDF 내용이 외부 서버로 전송되지 않음. 사내·기밀 문서도 안전. |
| 💰 **비용** | 사용료 0원. 처리량 제한 없음. |
| 🌐 **오프라인** | 첫 모델 다운로드 이후 인터넷 연결 없이 동작. |
| 🔑 **계정 불필요** | 회원가입, API 키 발급, 토큰 관리 모두 불필요. |
| 📊 **추적 없음** | 텔레메트리·사용 분석 코드 없음. |

## Local components

[requirements.txt](../../requirements.txt) 기준, 변환 파이프라인이 의존하는
모든 컴포넌트가 사용자 PC에서 동작합니다:

| 컴포넌트 | 위치 | 라이선스 | 역할 |
|---|---|---|---|
| `simple_lama_inpainting` (+ LaMa 가중치) | Python 패키지 + 캐시 | MIT (래퍼), Apache 2.0 (LaMa 코드) | 텍스트 영역 인페인팅 |
| `torch` / `torchvision` | Python 패키지 | BSD-style | LaMa 추론 백엔드 |
| `easyocr` (+ 한·영 모델) | Python 패키지 + 캐시 | Apache 2.0 | OCR (KR/EN, PyTorch 백엔드) |
| `pdfplumber` (+ pypdfium2) | Python 패키지 | MIT / Apache 2.0·BSD-3 | PDF 페이지 → 이미지 (변환 단계) |
| `PyMuPDF` (fitz) | Python 패키지 | AGPL-3.0 / 상용 | 브라우저 썸네일 (스레드 안전 필요한 경로) |
| `opencv-python` | Python 패키지 | Apache 2.0 (OpenCV BSD) | 마스크 후처리 |
| `python-pptx` | Python 패키지 | MIT | .pptx 작성 |
| `Pillow`, `numpy` | Python 패키지 | HPND, BSD | 이미지·배열 |
| `fastapi` + `uvicorn` | Python 패키지 | MIT / BSD-3 | 로컬 HTTP (127.0.0.1) |
| Tailwind CSS, Alpine.js | CDN (브라우저) | MIT / MIT | UI |

라이선스 영향 정리는 [04-license-strategy.md](04-license-strategy.md).

## One-time external interaction

### 1. PyPI에서 패키지 다운로드 (`pip install -r requirements.txt`)

`setup.bat`/`setup.sh` 첫 실행 시. 이후 변환 중에는 PyPI에
접속하지 않습니다.

### 2. PyTorch 휠 다운로드

CPU 빌드 기본. NVIDIA GPU가 있고 더 빠른 변환을 원하면 README의 GPU 가속
섹션 참고 (`pip install torch torchvision --index-url
https://download.pytorch.org/whl/cu121`).

### 3. LaMa 모델 가중치 자동 다운로드

`SimpleLama()` 첫 호출 시 `simple_lama_inpainting`이 GitHub Releases에서
가중치(~200 MB)를 받아 사용자 캐시 디렉토리에 저장. 이후 재실행 시 캐시
사용.

### 4. EasyOCR 한·영 모델 자동 다운로드

`easyocr.Reader(['ko', 'en'])` 첫 호출 시 한국어 인식 모델 + 영어 인식
모델 + 텍스트 검출 모델(합 ~70 MB)을 EasyOCR의 GitHub Releases에서
받아 `~/.EasyOCR/`에 저장. 이후 재실행 시 캐시 사용.

## What we explicitly do NOT use

다음 기술/서비스는 **의도적으로 사용하지 않습니다**:

| 미사용 | 사유 |
|---|---|
| OpenAI / GPT API | API 키 필요, 비용 발생, 데이터 외부 전송 |
| Anthropic / Claude API | 동일 |
| Google Gemini / Cloud Vision | 동일 |
| Adobe PDF Services / ConvertAPI / Smallpdf | API 키 + 외부 전송 |
| 텔레메트리·사용 분석 SDK | 사용자 프라이버시 |
| 자동 업데이트 체크 | 인터넷 의존성 회피 |

## Verifiability

본 정책은 다음 방법으로 검증 가능합니다:

1. **소스 코드 검사** — `requirements.txt`에 LLM/클라우드 SDK 부재 (`openai`,
   `anthropic`, `google-genai`, `google-cloud-*` 등 없음). `grep -ri 'api_key\|API_KEY' src/`로 외부 인증 호출 부재 확인.
2. **네트워크 모니터링** — 첫 모델 다운로드 후 변환 중 외부 통신이
   발생하지 않음을 패킷 캡처(예: Wireshark)로 검증 가능.
3. **오프라인 테스트** — 인터넷 연결을 끊은 상태에서 (캐시된 모델로)
   전 변환 파이프라인이 동작.

## Offline / air-gapped install

폐쇄망 환경에서 사용해야 하는 경우:

1. 인터넷 가능 PC에서 `setup.bat`/`setup.sh`로 한 번 설치 → `python app.py`로 첫 변환을 한 번 돌려 LaMa 가중치 + EasyOCR 한·영 모델까지 캐시.
2. 다음 항목들을 통째로 폐쇄망 PC로 복사:
   - `.venv/` 폴더 (설치된 패키지)
   - `~/.cache/torch/hub/` (PyTorch 캐시; LaMa 가중치 일부 포함)
   - `~/.EasyOCR/` (Windows: `%USERPROFILE%\.EasyOCR\`) — EasyOCR 모델 가중치
   - simple_lama_inpainting의 가중치 저장 위치 (보통 `%LOCALAPPDATA%\torch\hub` 근처)
3. 폐쇄망 PC에서 `python app.py` 실행. 외부 통신 없이 동작.

## User-facing communication

UI와 README에 다음 메시지를 표시합니다:

> **"PDF processing happens entirely on your computer. Your files are never uploaded to any server."**
>
> **"PDF는 사용자 컴퓨터에서만 처리되며, 어떤 서버에도 업로드되지 않습니다."**

## Scope of this policy

본 정책은 변환 엔진과 OCR에 한정됩니다. 다음은 정책 범위 외:

- 사용자가 명시적으로 "Open with PowerPoint"를 클릭하면 Microsoft Office가
  동작 (자체 텔레메트리 가질 수 있음).
- GitHub에서 본 저장소를 클론하거나 PyPI에서 패키지를 받을 때는 GitHub /
  PyPI의 표준 다운로드 로깅이 적용 (OS·배포 플랫폼 차원).

이는 본 앱이 직접 통제하는 영역이 아닙니다.
