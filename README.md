# Personal File Manager

터미널 CLI 에이전트(`claude` / `codex` / `agy`)로 작업하는 흐름에서, 작업 디렉터리에 도달하고
그 위치에서 도구를 실행하기까지의 마찰을 없애기 위한 상주형 Windows 데스크톱 애플리케이션입니다.

## 프로젝트 의도

범용 파일 관리자를 만드는 것이 목적이 아닙니다. 다음 세 가지 반복되는 마찰을 없애는 것이 목적입니다.

- `cmd`를 실행하고 `cd`로 목표 디렉터리까지 찾아 들어가는 과정
- 문서 내용을 확인하려고 무거운 편집기를 새로 띄우는 과정
- 제목 한 줄, 몇 줄 추가하는 수정을 위해 편집기를 여는 과정

파일 복사/이동/이름변경 같은 기능은 이 흐름을 둘러싼 보조 작업이며, Total Commander의 기능 집합을
복제하는 것은 목표가 아닙니다. 앱은 하루 한 번 실행해 계속 띄워 두고, 전역 핫키로 표시/숨김을
토글하며, 키보드만으로 문서 트리를 훑고 터미널을 띄우는 용도로 씁니다.

## 현재 상태

요구사항과 기술 명세, Phase 계획이 확정되어 있으며 구현이 진행 중입니다. Phase별 진행 상태는
[`docs/releases/v0.1/backlog.json`](docs/releases/v0.1/backlog.json)에서 관리합니다.

## 계획된 주요 기능

- 좌/우 독립 경로를 가진 듀얼 패널 탐색
- 현재 경로에서 터미널 / `claude` / `codex` / `agy` / VSCode를 여는 Command Launcher
- `F3` 읽기 전용 뷰어 (텍스트 / Markdown)
- `F4` 내장 경량 편집기 (원본 인코딩·줄바꿈 유지, 외부 변경 감지)
- `F2`/`F5`/`F6`/`F7`/`F8` 이름변경 · 복사 · 이동 · 새 폴더 · 삭제(휴지통)
- 즐겨찾기 경로 이동, 마지막 좌우 경로·테마 복원
- 창 포커스 복귀 시 자동 새로고침
- Dark / Light 테마

자세한 기능 범위는 [`docs/releases/v0.1/PRD.md`](docs/releases/v0.1/PRD.md)를 참고하십시오.

## 기술 스택

```text
Desktop   : Electron 35
Language  : TypeScript 5
UI        : React 19
Build     : Vite 6 + electron-vite 3
Packaging : electron-builder (portable)
Target OS : Windows
```

## 문서 구조

계획 및 명세 문서는 `docs/releases/v0.1/`에 순서대로 있습니다.

| 문서 | 역할 |
|---|---|
| [`BRIEF.md`](docs/releases/v0.1/BRIEF.md) | 무엇을, 왜 만드는가 — 제품 의도와 범위 |
| [`TECH_GUIDE.md`](docs/releases/v0.1/TECH_GUIDE.md) | 어떤 기술로, 어떤 구조로 구현하는가 |
| [`PRD.md`](docs/releases/v0.1/PRD.md) | 기능·비기능 요구사항 표 |
| [`SPEC.md`](docs/releases/v0.1/SPEC.md) | 동작 규칙과 인터페이스 상세 명세 |
| [`PLAN.md`](docs/releases/v0.1/PLAN.md) | Phase별 구현 계획과 검증 절차 |
| [`backlog.json`](docs/releases/v0.1/backlog.json) | Phase 단위 작업 항목과 진행 상태 |

이후 릴리스는 각각 `docs/releases/v{major}.{minor}/` 경로를 사용합니다.

## v0.1 범위 밖

디렉터리 탭, 파일/내용 검색, 압축 파일 탐색, FTP/SFTP, 임의 명령 자유 입력, 내장 터미널
에뮬레이터, Drag & Drop은 v0.1에 포함되지 않습니다. 전체 목록은
[`PRD.md`](docs/releases/v0.1/PRD.md)의 Non-Goals 절을 참고하십시오.
