# Personal File Manager

터미널 CLI 에이전트(`claude` / `codex` / `agy`)로 작업하는 흐름에서, 작업 디렉터리에 도달하고
그 위치에서 도구를 실행하기까지의 마찰을 없애기 위한 상주형 Windows 데스크톱 애플리케이션입니다.

범용 파일 관리자를 만드는 것이 목적이 아닙니다. `cmd`를 실행하고 `cd`로 목표 디렉터리를 찾아
들어가는 과정, 문서를 보려고 무거운 편집기를 새로 띄우는 과정, 한두 줄 수정을 위해 편집기를
여는 과정 — 이 세 가지 반복되는 마찰을 없애는 것이 목적입니다. 파일 복사·이동·이름변경 같은
기능은 이 흐름을 둘러싼 보조 작업이며, Total Commander의 기능 집합을 복제하는 것은 목표가
아닙니다.

## 시작하기

1. Personal File Manager를 실행합니다. 좌/우 듀얼 패널에 마지막으로 사용한 경로가 복원됩니다.
2. `Tab`으로 좌우 패널을 전환하고, 방향키로 목록을 탐색합니다.
3. `Ctrl+L`로 하단 Command Launcher에 포커스를 옮기고 `1`~`5`로 터미널 / `claude` / `codex` /
   `agy` / VSCode를 현재 경로에서 엽니다.
4. 전역 핫키(기본값 `` Alt+` ``, 설정 파일에서 변경 가능)로 창을 어디서든 표시/숨김할 수
   있습니다. 창을 닫아도 트레이 아이콘으로 상주하며, 트레이 메뉴의 Quit로만 완전히 종료됩니다.

## 듀얼 패널 탐색

- 좌/우 패널은 각각 독립된 경로·정렬 상태를 가지며, 창을 닫을 때 자동 저장되어 다음 실행 시
  복원됩니다.
- `Alt+F1` / `Alt+F2`로 좌/우 패널의 드라이브를 선택합니다. 드라이브 막대에는 여유 공간과 전체
  용량이 `[109.3 G / 236.7 G]` 형식으로 표시됩니다.
- 상태 표시줄에 선택한 항목과 전체 항목의 용량·파일 수·폴더 수가 나란히 표시됩니다.
- `Ctrl+1`~`Ctrl+9`로 즐겨찾기 경로로 즉시 이동하고, `Ctrl+D`로 즐겨찾기 목록을 열어 확인합니다.
- `Ctrl+U`로 좌우 패널의 경로·정렬·선택 상태를 통째로 교환합니다.
- 문자를 입력하면 Type-ahead로 이름이 일치하는 항목에 포커스가 이동합니다.
- 창 포커스가 돌아오면 현재 패널을 자동으로 새로고침합니다. `Ctrl+R`로 수동 새로고침도 가능합니다.

## 파일 작업

- `F2` 이름 변경, `F5` 복사, `F6` 이동, `F7` 새 폴더, `F8`/`Delete` 삭제(휴지통),
  `Shift+Delete` 영구 삭제.
- `Space`로 항목을 선택하며 자동으로 다음 항목으로 이동하고, `Ctrl+A`로 전체 선택, `Esc`로
  선택을 해제합니다.
- 복사·이동 중 이름 충돌이 발생하면 덮어쓰기 / 건너뛰기 / 자동 이름 변경 중 선택하며, "모두
  적용"으로 남은 항목에 일괄 적용할 수 있습니다.
- 대상 드라이브가 달라 이동이 실패하면 복사 후 원본 삭제로 자동 전환합니다.
- 진행 중인 작업은 대화상자에서 현재 처리 중인 파일명을 보여주며 취소할 수 있습니다.
- `Ctrl+F3`/`Ctrl+F4`/`Ctrl+F5`/`Ctrl+F6`로 이름·확장자·날짜·크기 순 정렬을 전환합니다.

## 문서 보기·편집

- `F3`로 읽기 전용 뷰어를 엽니다. Markdown 파일은 GitHub Flavored Markdown(표, 체크박스, 코드
  블록 포함)으로 렌더링되고, 그 외 텍스트·코드 파일은 원문 그대로 표시됩니다.
- `F4`로 내장 경량 편집기를 엽니다. 원본 인코딩과 줄바꿈을 그대로 유지하며, 저장 시 파일이
  외부에서 바뀌었으면 덮어쓸지 확인합니다. `Ctrl+S`로 저장, `Esc`로 닫습니다(변경 사항이 있으면
  확인 후 닫음).
- 편집기 안에서 `Shift+F4`를 누르면 같은 파일을 VSCode로 바로 엽니다.

## 화면 취향에 맞추기

- `Ctrl+Shift+D`로 Dark / Light 테마를 전환합니다. 오버레이(뷰어·편집기·대화상자)가 열려
  있어도 항상 동작하는 전역 단축키입니다.
- 선택한 테마는 자동 저장되어 다음 실행 시 복원됩니다.

## 단축키

| 단축키 | 동작 |
| --- | --- |
| `Tab` | 좌우 패널 전환 |
| `↑` / `↓` | 항목 이동 |
| `PgUp` / `PgDn` / `Home` / `End` | 페이지 / 처음 / 끝 이동 |
| `Enter` | 폴더 진입, 파일은 기본 연결 프로그램 실행 |
| `Backspace` | 상위 디렉터리로 이동 |
| `Alt+F1` / `Alt+F2` | 좌 / 우 패널 드라이브 선택 |
| `Ctrl+R` | 현재 패널 새로고침 |
| `Ctrl+U` | 좌우 패널 상태 교환 |
| `Ctrl+1`~`Ctrl+9` | 즐겨찾기 경로로 이동 |
| `Ctrl+D` | 즐겨찾기 목록 열기 |
| 문자 입력 | Type-ahead |
| `Space` | 선택 토글 후 다음 항목으로 이동 |
| `Ctrl+A` | 전체 선택 |
| `Esc` | 선택 해제 / 열린 창 닫기 |
| `Ctrl+F3` / `Ctrl+F4` / `Ctrl+F5` / `Ctrl+F6` | 이름 / 확장자 / 날짜 / 크기순 정렬 |
| `F2` | 이름 변경 |
| `F3` | 뷰어(읽기 전용) |
| `F4` | 내장 편집기 |
| `F5` / `F6` | 복사 / 이동 |
| `F7` | 새 폴더 |
| `F8` / `Delete` | 삭제(휴지통) |
| `Shift+Delete` | 영구 삭제 |
| `Ctrl+T` | 현재 경로에서 터미널 열기 |
| `Ctrl+E` | 현재 경로에서 VSCode 열기 |
| `Ctrl+L` | Command Launcher 포커스 |
| Launcher 내 `1`~`5` | cmd / claude / codex / agy / `code .` 실행 |
| 전역 핫키(설정 가능, 기본 `` Alt+` ``) | 창 표시 / 숨김 토글 |
| `Ctrl+Shift+D` | Dark / Light 테마 전환 |

편집기가 열려 있을 때는 다음이 추가로 동작합니다.

| 단축키 | 동작 |
| --- | --- |
| `Ctrl+S` | 저장 |
| `Shift+F4` | 같은 파일을 VSCode로 열기 |
| `Esc` | 편집기 닫기(변경 사항 있으면 확인) |

오버레이(뷰어·편집기·대화상자)가 열려 있으면 패널 키 핸들러는 동작하지 않습니다. 전역 핫키와
테마 전환만 예외입니다.

## 설정 저장

경로·정렬·즐겨찾기·테마·창 크기·전역 핫키는 `%APPDATA%\Personal File Manager\settings.json`에
저장되며, 다음 실행 시 그대로 복원됩니다. 저장된 경로가 더 이상 존재하지 않으면 가장 가까운
상위 폴더로, 그마저 없으면 홈 폴더로 자동 대체됩니다.

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

위 문서는 v0.1 MVP를 만들 때의 산출물이며 태그 `v0.1` 시점으로 고정되어 있습니다.

v0.1 완성 이후의 개선 작업은 문서 사이클을 다시 쓰지 않고 순차 기록 방식으로 진행합니다.

| 문서 | 역할 |
|---|---|
| [`improvements/LOG.md`](docs/releases/v0.1/improvements/LOG.md) | 개선 항목별 실행 기록과 상태 |
| [`improvements/CONTEXT.md`](docs/releases/v0.1/improvements/CONTEXT.md) | 판단 근거, 참조 기준, 후보 항목 목록 |

추가 기능을 다루는 v0.2에 착수할 때 `docs/releases/v0.2/`에 문서 사이클을 새로 작성합니다.

## v0.1 범위 밖

디렉터리 탭, 파일/내용 검색, 압축 파일 탐색, FTP/SFTP, 임의 명령 자유 입력, 내장 터미널
에뮬레이터, Drag & Drop은 v0.1에 포함되지 않습니다. 전체 목록은
[`PRD.md`](docs/releases/v0.1/PRD.md)의 Non-Goals 절을 참고하십시오.

## Windows 패키지 만들기

Windows portable 실행 파일은 다음 명령으로 생성합니다.

```powershell
npm run package:win
```

생성된 실행 파일은 `release` 폴더에 저장됩니다.

## 클론 후 Windows 패키지 생성

Git에 패키징에 필요한 소스 코드와 설정 파일이 모두 포함되어 있으므로, 새 클론에서도 Windows
portable 실행 파일을 만들 수 있습니다.

```powershell
git clone https://github.com/nampluskr/file_manager.git
cd file_manager
npm ci
npm run package:win
```

`npm ci`와 `npm run package:win`은 Electron 및 electron-builder 패키징 도구를 내려받을 수
있으므로 네트워크 연결이 필요할 수 있습니다.

다음 폴더는 의존성 또는 빌드·패키징 과정에서 생성되며 Git에서 제외됩니다.

```text
node_modules/  # npm ci로 재생성되는 의존성
out/           # 애플리케이션 빌드 산출물
release/       # portable 실행 파일과 패키징 산출물
```
