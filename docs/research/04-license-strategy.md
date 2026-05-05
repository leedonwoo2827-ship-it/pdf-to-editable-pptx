# 04. License Strategy

## TL;DR

**본 프로젝트는 GPL-3.0으로 배포됩니다.** 핵심 의존성인 `pdf2slides`(GPL-3.0)와 `PyMuPDF`(AGPL-3.0)의 영향입니다.

## Dependencies & licenses

| 의존성 | 라이선스 | 영향 |
|---|---|---|
| **pdf2slides** | **GPL-3.0** | 본 프로젝트가 import → GPL 전염 |
| **PyMuPDF (fitz)** | **AGPL-3.0** 또는 상용 | 더 강한 카피레프트 (네트워크 공급도 포함) |
| **PyQt6** | GPL v3 또는 상용 | GPL 호환 |
| python-pptx | MIT | 호환 (제한 없음) |
| PaddleOCR | Apache 2.0 | 호환 (제한 없음) |
| paddlepaddle | Apache 2.0 | 호환 |
| pillow | HPND | 호환 |
| numpy | BSD | 호환 |
| scikit-learn | BSD | 호환 |

## Resulting license: GPL-3.0

이 조합에서 가장 엄격한 카피레프트는 PyMuPDF의 **AGPL-3.0**이지만, 본 프로젝트가 **네트워크 서비스를 제공하지 않는 데스크톱 애플리케이션**이므로 AGPL의 추가 의무(소스 공개를 네트워크 사용자에게도)가 실질적으로 작동하지 않습니다. 따라서 실용적으로는 **GPL-3.0** 이상 호환 라이선스로 배포하면 됩니다.

`LICENSE` 파일에는 **GPL-3.0** 전문을 포함하고, AGPL-3.0(PyMuPDF) 의무는 `THIRD_PARTY_NOTICES.md`에서 별도 고지합니다.

## Implications for users

### ✅ 자유롭게 가능
- 개인적 사용
- 사내·조직 내 사용
- 결과물(.pptx 파일)을 어떤 라이선스로든 배포 — GPL은 *프로그램*에 적용되지 본 프로그램이 *출력한 사용자 콘텐츠*에는 미치지 않음
- 본 프로젝트를 포크·수정하여 **GPL-3.0 또는 호환 라이선스**로 재배포

### ❌ 제한됨
- 본 프로그램(또는 파생물)을 **폐쇄소스 상용 제품에 통합** 불가
- 수정본을 배포할 때 **소스 코드 비공개** 불가
- 다른 라이선스(예: MIT, Apache)로 재라이선싱 불가

## Alternative path (not chosen)

상용 폐쇄소스 배포가 필요하다면 다음 경로가 가능했지만, 현재는 채택하지 않음:

1. **PyMuPDF 상용 라이선스 구매** (Artifex 사) + `pdf2slides` 대신 from-scratch 구현 또는 호환 라이선스 라이브러리로 교체
2. **subprocess wrapping**: pdf2slides를 별도 프로세스로 호출 (라이선스 분리 가능성 — 단, 법적 해석에 따라 위험)
3. **PyMuPDF 대체**: pdfminer.six(MIT) 또는 pypdfium2(Apache 2.0/BSD-3) 사용 — 단, 렌더링 성능과 호환성 재검증 필요

이 경로들은 **상용화 전환이 필요해질 때** 재검토하며, 현재는 오픈소스 공개가 목표이므로 GPL-3.0이 자연스러운 선택입니다.

## Required files at distribution

배포 패키지(GitHub Releases, 설치 마법사 등)에 **반드시 포함**:

| 파일 | 내용 |
|---|---|
| `LICENSE` | GPL-3.0 전문 |
| `THIRD_PARTY_NOTICES.md` | 모든 의존성의 라이선스 고지 (AGPL인 PyMuPDF는 더 자세히) |
| `README.md` 라이선스 섹션 | "This project is licensed under GPL-3.0. See LICENSE for details." |
| 앱 About 다이얼로그 | 라이선스와 의존성 목록 표시 |

## License compatibility check (planned)

배포 전 자동 검증을 위해 다음 도구를 CI에 추가 예정:

```bash
pip install pip-licenses
pip-licenses --format=markdown --with-urls
```

결과를 `THIRD_PARTY_NOTICES.md`와 비교하여 누락된 라이선스가 있는지 확인.

## References

- GPL-3.0 전문: https://www.gnu.org/licenses/gpl-3.0.en.html
- AGPL-3.0 vs GPL-3.0 차이: https://www.gnu.org/licenses/why-affero-gpl.html
- pdf2slides LICENSE: https://github.com/ha0ranyu/pdf2slides/blob/main/LICENSE
- PyMuPDF licensing: https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright
