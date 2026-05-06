# Documentation Images

[install.md](../install.md)와 [usage.md](../usage.md)에서 참조하는 스크린샷을 이 폴더에 두세요.

## 파일명 규칙

`{문서}-{번호}-{설명}.png`

| 파일 | 무엇을 캡처 |
|---|---|
| `install-01-python-download.png` | python.org 3.12.x 다운로드 페이지 — `Windows installer (64-bit)` 행 강조 |
| `install-02-installer-add-path.png` | Python 3.12 인스톨러 첫 화면 — **"Add python.exe to PATH"** 체크박스 강조 |
| `install-03-version-check.png` | cmd에서 `py -3.12 --version` 입력 후 `Python 3.12.x` 출력 |
| `install-04-venv-activated.png` | 가상환경 활성화 후 프롬프트 앞에 `(.venv)` 표시 |
| `install-05-pip-install.png` | `pip install -r requirements.txt` 진행 중 또는 `Successfully installed` 마지막 줄 |
| `install-06-app-running.png` | `python app.py` 실행 후 브라우저에 뜬 첫 화면 |
| `usage-01-home.png` | 앱 실행 직후 브라우저 첫 화면 (PDF 업로드 영역 보임) |
| `usage-02-upload.png` | PDF 드래그&드롭 영역 또는 업로드 직후 페이지 썸네일 |
| `usage-03-dpi.png` | DPI 선택 슬라이더/입력창 |
| `usage-04-progress.png` | 변환 중 페이지별 진행률 표시 |
| `usage-05-review.png` | Review 모드 — 텍스트박스 드래그/리사이즈/브러시 도구 |
| `usage-06-download.png` | `Download .pptx` 버튼 강조 |
| `usage-07-pptx-edit.png` | PowerPoint에서 변환된 PPTX 열어 텍스트박스 편집하는 모습 |

## 권장 형식

- **PNG** (스크린샷에 적합)
- 가로 폭 **1200~1600px** 권장 (그보다 크면 GitHub 모바일에서 무거움)
- 빨간 박스/화살표로 클릭 위치를 강조하면 친절합니다 — Greenshot, ShareX, 또는 Windows 기본 캡처 도구로 충분.

## 누락된 이미지가 있어도 문서는 표시됨

마크다운은 이미지 파일이 없으면 깨진 이미지 아이콘을 보여줄 뿐, 글 내용은 그대로 읽힙니다. 사용자가 단계별 텍스트만 따라가도 설치/사용이 가능하도록 [install.md](../install.md), [usage.md](../usage.md)는 작성되어 있습니다. 이미지는 점진적으로 추가하면 됩니다.
