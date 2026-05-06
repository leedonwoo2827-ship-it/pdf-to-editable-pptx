# 설치 가이드 (Windows)

> 이 문서는 처음 설치하는 분을 위한 **단계별 가이드**입니다. macOS/Linux는 이 문서 끝의 [macOS / Linux 섹션](#macos--linux) 참고.

소요 시간: **15~20분** (Python 설치 + 의존성 다운로드 ~700 MB).

---

## 0. 미리 알아둘 점

본 프로젝트는 **Python 3.10, 3.11, 3.12** 만 동작합니다.
**3.13, 3.14는 동작하지 않습니다** — 몇몇 ML 의존성이 아직 그 버전용 wheel을
PyPI에 올리지 않았기 때문입니다.

| Python | 동작? |
|---|:---:|
| 3.10 / 3.11 / **3.12 (권장)** | ✅ |
| 3.13 / 3.14 | ❌ |

이미 시스템에 3.13/3.14가 깔려 있어도 **지우지 마세요**. 3.12를 추가로 설치하면 됩니다.

> 💡 **winget이나 "Python install manager"로 설치하지 마세요.**
> 그것들은 자동으로 "최신(=3.14)"을 설치해서 다시 막힙니다.
> 아래 1단계처럼 **python.org 공식 인스톨러**로 받는 게 가장 확실합니다.

---

## 1. Python 3.12 설치

### 1-1. python.org에서 인스톨러 다운로드

1. 브라우저로 https://www.python.org/downloads/release/python-3129/ 접속
2. 페이지 하단 **Files** 표에서 **`Windows installer (64-bit)`** 행을 클릭

> ![Python 3.12 다운로드 페이지에서 'Windows installer (64-bit)' 행 클릭](images/install-01-python-download.png)
>
> ⚠️ 페이지 위쪽 노란색 **"Download Python install manager"** 버튼은 누르지 마세요.
> 그건 별개의 도구이고, 자동으로 최신(=3.14)을 깔아서 본 프로젝트에서 막힙니다.

### 1-2. 인스톨러 실행

다운받은 `python-3.12.x-amd64.exe` 파일을 더블클릭하면 설치 마법사가 뜹니다.

> ![Python 3.12 인스톨러 첫 화면 — 'Add python.exe to PATH' 체크박스](images/install-02-installer-add-path.png)

**반드시** 체크하세요:

- ✅ **`Add python.exe to PATH`** — 하단 체크박스. **이거 안 누르면 cmd에서 `python` 명령이 안 잡힙니다.**

그 후 **`Install Now`** 클릭. 1~2분 후 "Setup was successful" 화면이 뜨면 닫아도 됩니다.

### 1-3. 설치 확인

`Win + R` → `cmd` → Enter 로 **새 cmd 창** 열고:

```cmd
py -3.12 --version
```

> ![cmd에서 'py -3.12 --version' 입력 후 'Python 3.12.x' 출력 확인](images/install-03-version-check.png)

`Python 3.12.9` (또는 비슷한 3.12.x) 가 나오면 성공.

만약 `'py'은(는) 내부 또는 외부 명령... 이 아닙니다` 오류가 나면:

- 1-2 단계의 **"Add python.exe to PATH" 체크를 빼먹은 것**입니다. 인스톨러 다시 실행 → "Modify" → 체크하고 진행.

---

## 2. 프로젝트 다운로드

git이 깔려 있다면:

```cmd
cd /d D:\
git clone https://github.com/leedonwoo2827-ship-it/pdf-to-editable-pptx
cd pdf-to-editable-pptx
```

git이 없다면:

1. https://github.com/leedonwoo2827-ship-it/pdf-to-editable-pptx 접속
2. 우측 상단 초록색 **`Code`** → **`Download ZIP`**
3. 다운받은 zip을 적당한 폴더(예: `D:\projects\`)에 압축해제
4. cmd로 그 폴더로 이동:
   ```cmd
   cd /d D:\projects\pdf-to-editable-pptx-main
   ```

---

## 3. 가상환경 만들고 의존성 설치

### 권장: setup.bat 한 번 실행

본 프로젝트 폴더 안에 있는 cmd에서:

```cmd
setup.bat
```

이 한 줄이 다음을 자동 처리합니다:
1. `.venv` 가상환경 생성
2. `.venv\Scripts\activate.bat` 활성화
3. pip 업그레이드
4. `pip install -r requirements.txt` (~700 MB · 5~10분)

> ![가상환경 활성화 후 프롬프트에 (.venv) 표시](images/install-04-venv-activated.png)
>
> ![pip install -r requirements.txt 진행 중](images/install-05-pip-install.png)

마지막에 `Setup complete.` 가 나오면 끝.

> ⚠️ 시스템 PATH의 `python`이 3.13/3.14라면 `setup.bat`이 .venv를 그 버전으로
> 만들어버립니다. **`py launcher`로 명시적으로 3.12를 지정**하는 게 안전합니다 —
> 아래 "수동" 항목 참고.

### 수동 (PATH의 python이 3.13/3.14인 경우)

```cmd
py -3.12 -m venv .venv
.venv\Scripts\activate
python --version
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

마지막 `python --version`이 **`Python 3.12.x`** 면 가상환경 OK.

만약 **이전에 잘못 만들어진 `.venv`** 가 남아 있다면 (예: 3.13으로 만든 것):

```cmd
rmdir /s /q .venv
```

로 지우고 다시 위 단계부터 진행하세요.

### Advanced: 시스템 Python에 호환 PyTorch가 이미 있을 때 — `install.bat`

이미 다른 프로젝트나 Anaconda/Miniconda 환경에서 **PyTorch 2.0+** (CPU/GPU
빌드 무관)을 깔아둔 상태라면, `install.bat`으로 그걸 그대로 쓰고 부족한
의존성만 추가할 수 있습니다.

```cmd
install.bat
```

`install.bat`은 다음과 같이 동작합니다:

1. Python 3.10–3.12 검사 (3.13/3.14면 거부)
2. **5초 카운트다운 경고** — `Ctrl+C`로 취소 가능
3. 시스템 Python에 이미 있는 패키지(`torch`, `easyocr`, `simple_lama_inpainting`)를 미리 표시 → 무엇이 다운로드되고 무엇이 스킵되는지 사용자에게 보여줌
4. `pip install -r requirements.txt` — 이미 설치된 패키지는 자동으로 스킵

#### 언제 `install.bat`이 유리한가
- 이미 PyTorch가 깔린 시스템 Python을 재사용 → ~200 MB 다운로드 절약
- 가상환경을 일일이 만드는 게 번거로운 advanced 사용자

#### 언제 `install.bat`이 위험한가
- 시스템 Python의 PyTorch가 우리 요구(`>=2.0`)를 만족 안 함 → pip이 업그레이드하면서 다른 프로젝트가 깨질 수 있음
- 다른 프로젝트가 `numpy`, `Pillow` 등 다른 버전에 묶여 있는 경우 → 의존성 충돌

**잘 모르겠으면 setup.bat을 쓰세요.** 격리된 .venv는 절대 다른 프로젝트를
깨지 않습니다.

---

## 4. 실행 테스트

여전히 `.venv`가 활성화된 상태(프롬프트에 `(.venv)` 표시)라면:

```cmd
python app.py
```

브라우저가 자동으로 `http://127.0.0.1:8000` 열립니다.

> ![브라우저에서 PDF to Editable PowerPoint UI 첫 화면](images/install-06-app-running.png)

UI가 보이면 설치 완료. cmd 창은 그대로 두세요(끄면 서버도 꺼집니다). 사용법은
[usage.md](usage.md) 참고.

---

## 다음 번부터는

설치를 한 번 끝낸 뒤로는 **`start.bat` 더블클릭**만 하면 됩니다.
파일 탐색기에서 프로젝트 폴더 열고 `start.bat`을 더블클릭하면 자동으로:

1. `.venv`의 Python을 찾고
2. 의존성이 다 깔려 있는지 확인하고
3. 서버 실행 + 브라우저 오픈

까지 해줍니다. (의존성이 안 깔려 있으면 `setup.bat`을 먼저 돌리라고 안내합니다.)

---

## GPU 가속 (선택)

> 📌 **`setup.bat`은 GPU 유무와 상관없이 똑같이 사용합니다.** setup.bat이 깔아주는 건 항상 **CPU용 PyTorch** 입니다. GPU가 있다면 setup.bat 이후 **추가로 한 줄** 실행해서 GPU torch로 덮어씌우면 끝. GPU가 없으면 이 섹션 통째로 건너뛰세요 (CPU 모드로도 동작합니다).

NVIDIA GPU + CUDA가 있으면 변환 속도가 **약 10배 빨라집니다**
(페이지당 30–60초 → 2–5초). 노트북 GPU도 충분합니다.

### 1단계: NVIDIA GPU가 있는지 확인

cmd에서:

```cmd
nvidia-smi
```

> ![nvidia-smi 정상 출력 예시 — RTX 4070 Laptop, CUDA 12.4 드라이버](images/install-07-nvidia-smi.png)

**결과 해석**:

| 출력 | 의미 | 다음 단계 |
|---|---|---|
| 표 형태로 GPU 이름·드라이버·CUDA 버전 출력 | ✅ NVIDIA GPU + 드라이버 OK | 2단계로 진행 |
| `'nvidia-smi'은(는) 내부 또는 외부 명령... 이 아닙니다` | NVIDIA GPU 없음 또는 드라이버 미설치 | CPU torch 그대로 사용 (이번 섹션 건너뜀). 정말 GPU가 있는데 명령이 안 잡히면 https://www.nvidia.com/Download/index.aspx 에서 드라이버 설치 후 재시도 |

표 윗줄의 `CUDA Version: 12.x` 가 **12.0 이상**이면 본 가이드의 `cu121`
휠과 호환됩니다 (드라이버 CUDA 버전 ≥ wheel CUDA 버전이면 OK).

### 2단계: CUDA용 PyTorch 설치

가상환경 활성화한 상태에서, **반드시 기존 CPU torch를 먼저 지우고** 깔아야 합니다:

```cmd
.venv\Scripts\activate
pip uninstall -y torch torchvision
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

> ⚠️ **함정 1 — "Requirement already satisfied"**:
> 그냥 `pip install torch torchvision --index-url ...` 만 치면 pip이 *"Requirement already satisfied"*라고 출력하고 **CPU torch를 그대로 둡니다**. 그래서 위처럼 `pip uninstall`을 먼저 해서 깨끗한 상태로 만든 다음 GPU 빌드를 받아야 해요.
>
> 한 줄로 합치는 대안: `pip install --upgrade --force-reinstall torch torchvision --index-url https://download.pytorch.org/whl/cu121` — `--force-reinstall` 플래그가 같은 효과를 냅니다.

> 💾 **약 2 GB 다운로드, 인터넷 속도에 따라 10–30분.**
> 디스크 공간 ~3 GB 추가 필요.

**확인 팁**: 다운로드 중 wheel 이름이 `torch-2.x.x+cu121-cp312-cp312-win_amd64.whl` 처럼 **`+cu121`** 태그를 포함하는지 보세요. 태그가 없으면 또 CPU 버전 받고 있는 거예요 — 그땐 `Ctrl+C`로 끊고 위 uninstall 명령부터 다시.

대안: GPU 드라이버가 CUDA 12.4 이상이면 더 정확히 매칭되는 cu124 휠도 가능:

```cmd
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
```

(둘 다 동작 — `cu121`이 호환성 폭이 더 넓어서 가이드 기본값.)

> ⚠️ **함정 2 — numpy / pillow 호환 경고**:
> 위 명령이 끝날 때 다음과 같은 빨간 ERROR 메시지가 나올 수 있습니다:
> ```
> ERROR: pip's dependency resolver does not currently take into account all the packages
> that are installed. This behaviour is the source of the following dependency conflicts.
> simple-lama-inpainting 0.1.1 requires numpy<2.0.0,>=1.25.1, but you have numpy 2.4.3 ...
> simple-lama-inpainting 0.1.1 requires pillow<11.0.0,>=10.0.0, but you have pillow 12.1.1 ...
> ```
>
> 무슨 일인가: `--force-reinstall`이 torch의 의존성으로 **numpy / pillow도 더 새 버전으로 업그레이드**해버립니다. 그런데 `simple_lama_inpainting 0.1.x`는 더 옛 버전(numpy<2.0, pillow<11.0)에 핀이 걸려 있음.
>
> 위험: numpy 2.x에서 제거된 API(`np.bool`, `np.int` 등)를 simple_lama_inpainting이 사용하면 런타임 에러. 동작할 가능성도 있고 깨질 가능성도 있어요 — 운에 맡기지 말고 그냥 다운그레이드:
>
> ```cmd
> pip install "numpy<2.0" "pillow<11.0"
> ```
>
> → numpy 1.26.x, pillow 10.4.x로 떨어집니다. torch / torchvision / easyocr / opencv-python 모두 이 범위 지원하므로 안전.

`requirements.txt`에는 **`numpy>=1.24,<2.0` / `Pillow>=10.0,<11.0`** 으로 상한이 걸려 있어서, 처음부터 `setup.bat`으로 깐 환경에서는 이 함정에 안 걸립니다. **함정 2는 이미 깔린 환경에서 CUDA torch로 갈아탈 때만 발생**해요.

### 3단계: PyTorch가 GPU를 인식하는지 검증

```cmd
python -c "import torch; print('cuda:', torch.cuda.is_available()); print('device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU only')"
```

> ![torch.cuda.is_available() True 출력 예시](images/install-08-cuda-verify.png)

**기대 출력**:
```
cuda: True
device: NVIDIA GeForce RTX 4070 Laptop GPU
```

`cuda: True` 가 나오면 GPU 모드 준비 완료. 본 프로젝트가 다음 실행부터
**자동으로 GPU를 사용**합니다 ([src/core/inpaint.py](../src/core/inpaint.py)의
`InpaintEngine`이 `torch.cuda.is_available()`로 자동 분기 — 사용자가 코드
수정할 일 없음).

만약 `cuda: False` 가 나오면:
- `pip list | findstr torch` 로 깔린 torch 버전 확인. 끝에 `+cu121` 같은 태그가 붙어 있어야 GPU 빌드.
- CPU 빌드(`+cpu` 태그)면 `pip uninstall torch torchvision` 후 2단계 재실행.

### 4단계: 본 앱 재실행

이미 앱이 떠 있으면 한 번 끄고(`Ctrl+C`) 다시 띄워야 새 torch가 로드됩니다:

```cmd
start.bat
```

또는:
```cmd
.venv\Scripts\activate
python app.py
```

이제 변환 시 페이지당 2–5초로 처리됩니다. 변환 진행 화면 좌측 패널의
"평균/슬라이드" 값이 GPU 모드인지 한눈에 보여줍니다 (CPU 30s+ vs GPU 5s 미만).

### CPU vs GPU 성능 (참고)

| 환경 | 페이지당 시간 (200 DPI) | 10페이지 PDF 예상 |
|---|---|---|
| CPU only | 30–60초 | 5–10분 |
| **GPU (RTX 30/40 시리즈, 8GB+ VRAM)** | **2–5초** | **30초–1분** |
| GPU (구형 GTX 1060/1070, 6GB) | 5–15초 | 1–3분 |

VRAM이 부족하면(2–4GB) LaMa가 OOM(out of memory)으로 떨어질 수 있습니다.
이 경우 변환 DPI를 낮추거나(200→150) CPU로 회귀.

---

## macOS / Linux

bash 스크립트로 동일한 흐름을 한 번에 처리합니다:

```bash
git clone https://github.com/leedonwoo2827-ship-it/pdf-to-editable-pptx
cd pdf-to-editable-pptx
bash setup.sh
source .venv/bin/activate
python app.py
```

`setup.sh`가 자동으로:
- 시스템에서 사용 가능한 `python3.12` / `python3.11` / `python3.10`을 찾고
- 그 버전이 없으면 명확한 에러로 종료 (위쪽 0단계의 사유와 동일)
- `.venv` 생성 → `requirements.txt` 설치

까지 처리합니다. `python3.12`가 안 잡히면 배포판 패키지 매니저(`apt install python3.12`,
`brew install python@3.12`, 또는 [pyenv](https://github.com/pyenv/pyenv))로 설치 후 재시도.

다음 번부터는 `source .venv/bin/activate && python app.py` 로 실행.

---

## 자주 막히는 문제

### `setup.bat`이 `[ERROR] This project requires Python 3.10, 3.11, or 3.12.`로 멈춤
시스템 PATH의 `python`이 3.13/3.14라서 그렇습니다. 3단계의 "수동" 항목처럼
`py -3.12 -m venv .venv` 로 명시적으로 3.12 venv를 만드세요.

### `ERROR: No matching distribution found for ...`
대부분 같은 원인 — Python 3.13+ 에서 일부 의존성의 wheel이 없습니다. 3.12 venv 안에서 설치하세요.

### `WARNING: The 'install' command is unavailable because this is the legacy py.exe command.`
옛 Python Launcher와 새 Python install manager가 충돌한 상태입니다.
**이 가이드는 install manager를 쓰지 않으니 무시**하셔도 됩니다 — 공식 인스톨러로 깐
3.12는 정상 작동합니다.

### `start.bat`을 눌렀는데 까만 창이 깜빡 떴다 사라짐
오류가 나서 즉시 종료된 것입니다. cmd를 먼저 열고 그 안에서 `start.bat`을
실행해 메시지를 확인하세요:
```cmd
cd /d D:\path\to\pdf-to-editable-pptx
start.bat
```

### 첫 실행이 한참 멈춘 것 같음
정상입니다. **PyTorch + LaMa 모델 가중치 + EasyOCR 한·영 모델**(~합 1 GB 가까이)을
처음 한 번만 다운로드합니다. 이후 실행은 즉시 시작합니다.

### 브라우저가 안 열림
서버는 떴는데 브라우저만 안 떴을 가능성이 큽니다. 브라우저를 열고 직접
`http://127.0.0.1:8000` 으로 접속하세요.

### 한국어가 깨지거나 한자가 섞여 나온다
EasyOCR의 `['ko', 'en']` 모델이 본 프로젝트의 기본값입니다 ([src/core/ocr.py](../src/core/ocr.py#L57)).
그래도 정확도가 부족하면 [docs/research/02-libraries-reviewed.md](research/02-libraries-reviewed.md)의
"Escalation path" — PaddleOCR(`lang='korean'`)로 갈아타기 — 를 검토하세요.
