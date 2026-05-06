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
| `install-07-nvidia-smi.png` | cmd에서 `nvidia-smi` 출력 — GPU 이름·드라이버·CUDA 버전이 표로 보임 (예: RTX 4070 Laptop, CUDA 12.4) |
| `install-08-cuda-verify.png` | `python -c "import torch; print(torch.cuda.is_available()); ..."` 결과로 `cuda: True` + GPU 이름 표시 |
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

## 빠르게 저장하는 헬퍼 — `scripts\save-snip`

매번 저장 대화창에서 폴더 찾고 정확한 파일명 입력하기는 귀찮습니다. 본
저장소에 동봉된 [scripts/save-snip.bat](../../scripts/save-snip.bat) 헬퍼를
쓰면 한 줄에 끝납니다.

### 가장 흔한 워크플로 — 클립보드 → 파일

1. **`Win + Shift + S`** → 영역 선택 (이미지가 클립보드에 들어감)
2. cmd에서 (저장소 루트):
   ```cmd
   scripts\save-snip usage-01-home
   ```
3. 끝. `docs\images\usage-01-home.png` 으로 저장됨 + 다음 git 명령 안내까지 출력.

### 타이밍 잡기 어려운 화면 (변환 진행률 등)

진행률 화면처럼 빠르게 지나가는 UI는 클립보드 캡처 타이밍을 잡기 까다롭습니다. 두 가지 우회법:

**A. Snipping Tool 지연 캡처** — 시작 메뉴에서 "Snipping Tool" 검색·실행 → 클럭 아이콘에서 **3초 / 10초 지연** 설정 → New 클릭 → 카운트다운 동안 원하는 화면 만들기 → 영역 선택. 클립보드에 들어가면 위 1–2 단계 그대로.

**B. 일단 Win+PrtSc로 마구 찍어두고 나중에 정리** — `Win + PrtSc` 는 화면 전체를 즉시 `%USERPROFILE%\Pictures\Screenshots\` 에 PNG로 저장합니다. 변환 중 여러 번 눌러두고, 끝난 다음 "이 프레임이 좋네" 싶은 걸 골라:
```cmd
scripts\save-snip usage-04-progress "%USERPROFILE%\Pictures\Screenshots\Screenshot.png"
```
두 번째 인자에 파일 경로를 주면 클립보드 대신 그 파일을 복사해서 저장합니다.

### 헬퍼 도움말

```cmd
scripts\save-snip
```
인자 없이 실행하면 사용법이 출력됩니다. 더 자세한 내용은 [scripts\save-snip.ps1](../../scripts/save-snip.ps1)의 PowerShell 헬프 주석 참고.

## 누락된 이미지가 있어도 문서는 표시됨

마크다운은 이미지 파일이 없으면 깨진 이미지 아이콘을 보여줄 뿐, 글 내용은 그대로 읽힙니다. 사용자가 단계별 텍스트만 따라가도 설치/사용이 가능하도록 [install.md](../install.md), [usage.md](../usage.md)는 작성되어 있습니다. 이미지는 점진적으로 추가하면 됩니다.
