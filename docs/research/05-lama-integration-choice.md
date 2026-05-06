# 05. LaMa Integration Choice — Why `simple_lama_inpainting` (not advimman/lama directly)

## Context

LaMa(Resolution-robust Large Mask Inpainting)를 본 프로젝트에 통합하는
방식은 두 가지였습니다:

```
                  Option A (선택)                    Option B
                                                  
  advimman/lama (원본 코드)                      advimman/lama (원본 코드)
         ↓                                              ↓
  enesmsahin/simple-lama-inpainting              직접 통합 (subclass / 직접 import)
  (추론 경로만 추출 + JIT 컴파일한 래퍼)              + Hydra 설정 + Lightning 보일러플레이트
         ↓                                              ↓
       본 프로젝트                                    본 프로젝트
```

## Decision

**Option A — `simple_lama_inpainting` PyPI 래퍼 사용** ([src/core/inpaint.py:19](../../src/core/inpaint.py)).

```python
# src/core/inpaint.py
from simple_lama_inpainting import SimpleLama

self._lama = SimpleLama()                # CPU/GPU 자동 감지
cleaned = self._lama(pil_image, mask)    # (이미지, 마스크) → 텍스트 지운 이미지
```

## Rationale

### 비교 매트릭스

| 측면 | `simple_lama_inpainting` (선택) | `advimman/lama` 직접 사용 |
|---|---|---|
| 인페인팅 호출 코드량 | **1줄** | ~50–100줄 (config 로드, 모델 빌드, 추론 루프) |
| 추가 파이썬 의존성 | PyTorch만 | PyTorch + **PyTorch Lightning** + **Hydra** + **kornia** + **albumentations** + 기타 |
| 추가 설치 무게 | 0 | ~수백 MB 추가 |
| 모델 로딩 방식 | TorchScript JIT (`big-lama.pt`) | 원본 PyTorch checkpoint (`.ckpt`) + Hydra config (`.yaml`) |
| 첫 실행 시 다운로드 | enesmsahin GitHub Release의 JIT 파일 (~200 MB) | advimman release의 `.ckpt` + 설정 자산 |
| 코드 라이선스 | MIT (래퍼) + Apache 2.0 (원본 LaMa 코드) | Apache 2.0 |
| **가중치 라이선스** | **동일** — Places2 학습 가중치 | **동일** — 같은 가중치 |
| 변경 비용 | 0 (현재) | 1–2일치 작업 + 디버깅 |
| 추론 파라미터 커스터마이징 | 제한적 (입력 이미지/마스크) | 광범위 (해상도, padding, refinement 등) |
| 학습 코드 접근 | ❌ | ✅ (필요 시 자체 데이터로 재학습 가능) |

### 핵심 포인트: 라이선스는 가중치 문제이지 저장소 문제가 아님

`simple_lama_inpainting`을 사용하든 `advimman/lama`를 직접 사용하든
**가중치 라이선스 상황은 동일**합니다:

- 두 경로 모두 **Places2 데이터셋으로 학습된 Big-LaMa 가중치**에 의존
- `simple_lama_inpainting`이 받는 가중치는 advimman의 `.ckpt`를 JIT 컴파일한 것 (같은 모델)
- 회색 지대인 부분(상업 사용)은 가중치 자체의 학습 데이터 문제이지 *어떤 저장소에서 받느냐*가 아님

→ [04-license-strategy.md "Model weights" 섹션](04-license-strategy.md)의
위험도 매트릭스가 두 경로 모두에 동일하게 적용됩니다.

### 왜 추가 의존성이 문제인가

`advimman/lama`를 직접 import하면 끌고 오는 것:

- **PyTorch Lightning**: 학습 루프 추상화. 추론에만 쓸 거면 불필요.
- **Hydra (omegaconf)**: 학습 실험 설정 관리. config YAML 파싱만 위해 무거움.
- **albumentations**: 데이터 증강. 추론에 안 쓰지만 transitive로 끌려옴.
- **kornia**: GPU 영상처리. 일부 모델 정의가 의존.

이들은 학습엔 합리적인 의존성이지만, 본 프로젝트(추론만 필요)에서는
부담만 추가합니다. `simple_lama_inpainting`은 추론에 필요한 코드 경로만
추출해서 PyTorch 외 의존성을 0으로 만든 의도적 미니멀 래퍼.

## Options considered

### Option A: simple_lama_inpainting 래퍼 (선택)
- ✅ 1줄 호출
- ✅ PyTorch 외 추가 의존성 0
- ✅ 단일 JIT 파일 자동 다운로드 (~200 MB)
- ✅ Apache 2.0 (원본 LaMa) + MIT (래퍼)
- ⚠️ enesmsahin의 GitHub 미러를 거치는 신뢰 사슬 — 가중치 자체는 advimman 원본과 동일하지만 받는 위치가 다름
- ⚠️ 추론 파라미터 커스터마이징 제한적

### Option B: advimman/lama 직접 import
- ✅ 원 저장소 직접 사용 (enesmsahin 미러 의존 없음)
- ✅ 추론 파라미터 자유 커스터마이징
- ✅ 학습 코드 접근 (도메인 재학습 가능)
- ❌ 1–2일치 통합 작업
- ❌ Lightning + Hydra + kornia 등 무거운 의존성
- ❌ Hydra config 파일 + checkpoint 파일 등 다중 자산 다운로드 필요
- ❌ **라이선스 개선 효과 없음** (가중치 라이선스가 본질)

### Option C: 자체 LaMa 구현 (모델 정의 + checkpoint 직접 로드)
- ✅ 의존성 최소
- ✅ 디버깅 용이
- ❌ 모델 아키텍처 PyTorch 정의를 직접 옮겨와야 함 (수백 줄)
- ❌ 유지보수 부담 (LaMa 모델 코드 변경에 따라 동기화 필요)
- ❌ 잠재적 버그 (forward 구현 차이)

## Tradeoffs accepted

1. **enesmsahin 미러 신뢰 사슬**: 첫 실행 시 가중치를 enesmsahin의 GitHub
   Release에서 받습니다. 가중치 파일 자체는 advimman의 원본을 JIT 컴파일한
   것이지만, 호스트 위치가 다릅니다. 폐쇄망·보안 민감 환경에서는
   `simple_lama_inpainting` 패키지의 가중치 URL을 코드에서 확인하고 사내 캐시
   미러로 받는 절차가 필요할 수 있습니다.

2. **JIT 가중치 커스터마이징 제한**: TorchScript JIT 파일은 forward graph가
   고정되어 있어서 추론 파라미터(예: `pad_to_modulo`, `refine`)를 깊이
   조정하기 어렵습니다. 본 프로젝트의 사용 패턴(텍스트 마스크 + 표준 인페인팅)에는
   기본 동작으로 충분.

3. **학습 불가**: `simple_lama_inpainting`은 추론 전용. 자체 데이터로 LaMa를
   재학습해야 하는 상황이 오면 그때 advimman/lama를 추가로 사용 (학습은 별도
   파이프라인이라 본 추론 코드와 분리 가능).

## When to switch to advimman/lama directly

다음 시점이 오면 Option B로 갈아끼우는 게 합리적:

1. **추론 파라미터를 깊이 커스터마이징해야 할 때** — 매우 큰 페이지 (8K+) 처리, refinement on/off 제어 등.
2. **enesmsahin 미러를 신뢰 못 하는 환경** — 정부·금융 폐쇄망에서 가중치 출처를 advimman 공식 release로 한정해야 할 때.
3. **자체 데이터로 LaMa 재학습이 필요할 때** — 한국어 PowerPoint 슬라이드 도메인 특화 가중치 등. 단, 이 경우 학습은 별도 작업이고 본 추론 코드는 그대로 두면 됩니다.

본 프로젝트는 위 셋 중 어디에도 해당 안 되는 상태이므로 현재의
`simple_lama_inpainting` 방식이 적합합니다.

## Verification

- [x] `simple_lama_inpainting`이 PyPI에 존재하고 `pip install`로 깔림
- [x] `from simple_lama_inpainting import SimpleLama` import 성공
- [x] `SimpleLama()(pil_image, mask_pil)`이 PIL 이미지 반환
- [x] CPU·GPU 자동 감지 ([src/core/inpaint.py](../../src/core/inpaint.py)의 `InpaintEngine.ensure_loaded` 참고)

## References

- LaMa 원 저장소 (활성): https://github.com/advimman/lama
- LaMa 논문 (Suvorov et al., WACV 2022): https://arxiv.org/abs/2109.07161
- simple_lama_inpainting 래퍼 (사용 패키지): https://github.com/enesmsahin/simple-lama-inpainting
- IOPaint (대안 LaMa wrapper, 자체 UI 포함): https://github.com/Sanster/IOPaint
