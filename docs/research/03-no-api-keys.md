# 03. No API Keys / 100% Local Execution

## Policy

본 애플리케이션은 **외부 API 키, 클라우드 서비스, 유료 구독 없이 사용자 PC에서 완전히 로컬로 실행**됩니다.

## What this guarantees

| | 보장 |
|---|---|
| 🔒 **프라이버시** | PDF 내용이 외부 서버로 전송되지 않음. 기밀 문서도 안전하게 변환 가능. |
| 💰 **비용** | 사용료 0원. 처리량 제한 없음. |
| 🌐 **오프라인** | 인터넷 연결 없이 동작 (첫 OCR 모델 다운로드 제외). |
| 🔑 **계정 불필요** | 회원가입, API 키 발급, 토큰 관리 모두 불필요. |
| 📊 **추적 없음** | 텔레메트리·사용 분석 코드 없음. |

## Local components

| 컴포넌트 | 위치 | 특징 |
|---|---|---|
| pdf2slides | Python 라이브러리 (로컬) | 변환 엔진, GPL-3.0 |
| python-pptx | Python 라이브러리 (로컬) | PPTX 작성, MIT |
| PyMuPDF (fitz) | Python 라이브러리 (로컬) | PDF 렌더, AGPL-3.0/상용 |
| PaddleOCR | Python 라이브러리 + 모델 파일 (로컬) | OCR 엔진, Apache 2.0 |
| PyQt6 | Python 라이브러리 (로컬) | UI, GPL/상용 |

## One-time external interaction

### PaddleOCR 모델 다운로드 (선택적)
- **언제**: 사용자가 OCR 기능을 처음 사용할 때만
- **무엇**: PaddleOCR 한국어 OCR 모델 (~100MB)
- **어디서**: Baidu/PaddlePaddle 공식 모델 저장소
- **저장**: `%LOCALAPPDATA%/PdfToPptx/models/`에 캐시
- **이후**: 오프라인 동작

OCR을 사용하지 않으면(텍스트 PDF만 변환) 이 다운로드도 발생하지 않습니다.

## What we explicitly do NOT use

다음 기술/서비스는 **의도적으로 사용하지 않습니다**:

| 미사용 | 사유 |
|---|---|
| OpenAI / GPT API | API 키 필요, 비용 발생, 데이터 외부 전송 |
| Anthropic / Claude API | 동일 |
| Google Cloud Vision OCR | 동일 |
| Adobe PDF Services | 동일 |
| ConvertAPI / Smallpdf API | 동일 |
| 텔레메트리·사용 분석 | 사용자 프라이버시 |
| 자동 업데이트 체크 | 인터넷 의존성 회피 |

## Verifiability

본 정책은 다음 방법으로 검증 가능합니다:

1. **소스 코드 검사** — `requirements.txt`에 LLM/클라우드 SDK가 없음을 확인 (`openai`, `anthropic`, `google-cloud-*` 등 부재).
2. **네트워크 모니터링** — 첫 OCR 모델 다운로드 후, 변환 중 외부 통신이 발생하지 않음을 패킷 캡처로 검증 가능.
3. **오프라인 테스트** — 인터넷 연결을 끊은 상태에서도 모든 기능이 동작.

## User-facing communication

UI와 README에 다음 메시지를 표시합니다:

> **"PDF processing happens entirely on your computer. Your files are never uploaded to any server."**
> 
> **"PDF는 사용자 컴퓨터에서만 처리되며, 어떤 서버에도 업로드되지 않습니다."**

## Scope of this policy

본 정책은 변환 엔진과 OCR에 한정됩니다. 다음은 정책 범위 외:

- 사용자가 명시적으로 "Open with PowerPoint"를 클릭하면 Microsoft Office가 동작 (자체 텔레메트리 가질 수 있음)
- PyInstaller 빌드된 .exe를 GitHub Releases에서 다운로드 받을 때는 GitHub의 표준 다운로드 로깅 적용

이는 OS·배포 플랫폼 차원의 동작이며, 본 앱이 직접 통제하는 영역이 아닙니다.
