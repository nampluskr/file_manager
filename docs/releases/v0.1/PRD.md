# Personal File Manager PRD

> 문서 위치: `docs/releases/v0.1/PRD.md`
> 문서 역할: `BRIEF.md`의 의도를 검증 가능한 요구사항 표로 옮긴다.
> 선행 문서: `BRIEF.md`, `TECH_GUIDE.md`
> 후속 문서: `SPEC.md` → `PLAN.md` → `backlog.json`

---

## 1. Product Overview

Personal File Manager는 터미널 CLI 에이전트(`claude` / `codex` / `agy`)로 작업하는 흐름에서,
작업 디렉터리에 도달하고 그 위치에서 도구를 실행하기까지의 마찰을 없애는 상주형 Windows 데스크톱 애플리케이션이다.

범용 파일 관리자를 만드는 것이 목적이 아니다. 파일 복사/이동/이름변경은 탐색-실행 흐름을 둘러싼
보조 작업이며, Total Commander의 기능 집합을 복제하는 것도 목표가 아니다. 앱은 하루 한 번 실행해
계속 띄워 두고, 전역 핫키로 표시/숨김을 토글하며, 키보드만으로 문서 트리를 훑고 터미널을 띄우는
용도로 쓰인다.

---

## 2. Functional Requirements

| ID | 기능 영역 | 요구사항 | 우선순위 |
|---|---|---|---|
| FR-01 | Dual Pane | 좌/우 독립된 두 패널이 각각 독립적인 현재 경로를 가진다 | Must |
| FR-02 | Active Pane | 하나의 패널이 항상 Active Pane이며 시각적으로 구분된다 | Must |
| FR-03 | Navigation | 방향키, PgUp/PgDn/Home/End로 항목 이동, Enter로 폴더 진입, Backspace로 상위 이동이 가능하다 | Must |
| FR-04 | Navigation | `Tab`으로 Active Pane을 전환한다 | Must |
| FR-05 | Navigation | 문자 입력 시 Type-ahead로 해당 문자로 시작하는 항목에 포커스를 이동한다 | Should |
| FR-06 | Listing | 폴더를 파일보다 먼저 표시하고, 최상단에 상위 디렉터리 `[..]` 항목을 둔다 (선택 대상 제외) | Must |
| FR-07 | Listing | 파일명 / 확장자 / 크기 / 날짜 컬럼을 표시한다 | Must |
| FR-08 | Sorting | 이름 / 확장자 / 크기 / 날짜 기준 정렬과 오름/내림 반전을 지원한다 (`Ctrl+F3`~`Ctrl+F6`) | Must |
| FR-09 | Launcher | Active Pane의 현재 경로를 작업 디렉터리로 하는 새 터미널 창을 연다 (`Ctrl+T`) | Must |
| FR-10 | Launcher | 동일한 방식으로 `claude`, `codex`, `agy`를 터미널 창에서 실행한다 | Must |
| FR-11 | Launcher | 현재 경로에서 VSCode를 실행한다 (`code .`, `Ctrl+E`) | Must |
| FR-12 | Launcher | Command Launcher는 등록된 프리셋만 실행하며 임의 명령 문자열 입력은 지원하지 않는다 | Must |
| FR-13 | Launcher | 대상 프로그램이 없거나 실행 실패 시 오류를 명확히 표시한다 | Must |
| FR-14 | Launcher | 앱을 종료해도 실행된 터미널 세션은 유지된다 | Must |
| FR-15 | Viewer | `F3`로 텍스트 및 Markdown 파일을 읽기 전용으로 확인한다 | Must |
| FR-16 | Viewer | Markdown은 렌더링해서 표시하고, 렌더링 실패 시 원문을 표시한다 | Must |
| FR-17 | Editor | `F4`로 앱 내장 경량 편집기를 열어 파일을 수정하고 저장한다 (`Ctrl+S`) | Must |
| FR-18 | Editor | 저장하지 않고 닫으려 하면(`Esc`) 확인 절차를 거친다 | Must |
| FR-19 | Editor | 편집 시작 시점의 `mtime`을 보관하고, 저장 직전 재확인해 외부 변경이 있으면 사용자에게 경고한다 | Must |
| FR-20 | Editor | 원본 인코딩(UTF-8/CP949)과 줄바꿈(CRLF/LF)을 저장 시 그대로 유지한다 | Must |
| FR-21 | Editor | 인코딩 판별에 실패하거나 파일이 일정 크기를 초과하면 편집 모드 진입을 막고 뷰어로만 표시한다 | Must |
| FR-22 | Editor | `Shift+F4`로 해당 파일을 VSCode에서 연다 | Must |
| FR-23 | File Ops | `F5`(복사), `F6`(이동)로 Active Pane의 대상을 반대쪽 패널 경로로 처리한다 | Must |
| FR-24 | File Ops | `F2`로 이름을 변경한다 | Must |
| FR-25 | File Ops | 작업 실행 전 Source/Destination을 사용자가 확인할 수 있다 | Must |
| FR-26 | Selection | `Space`로 항목 선택을 토글하고 다음 항목으로 이동하며, 연속 선택 후 일괄 작업이 가능하다 | Should |
| FR-27 | Selection | `Ctrl+A`로 전체 선택, `Esc`로 선택 해제 또는 열린 창을 닫는다 | Should |
| FR-28 | File Ops | `F7`로 새 폴더를 만든다 | Should |
| FR-29 | File Ops | `F8` / `Delete`는 휴지통으로 보내고, `Shift+Delete`는 별도 확인 후 영구 삭제한다 | Should |
| FR-30 | File Ops | 이름 충돌 시 덮어쓰기/건너뛰기/자동 이름변경/취소 및 "모두 적용" 옵션을 제공한다 | Should |
| FR-31 | File Ops | 폴더 대 폴더 충돌의 기본 동작은 병합이다 | Should |
| FR-32 | File Ops | 부분 실패를 허용한다. 일부 실패해도 나머지 항목은 계속 처리하고 결과를 요약해 보여준다 | Should |
| FR-33 | File Ops | 대용량 작업 중 진행 상태(처리 중 파일명)를 표시하고 취소할 수 있다 | Should |
| FR-34 | File Ops | 작업 완료 후 관련 패널의 목록·상태바를 갱신하고, 가능한 범위에서 포커스 위치를 유지한다 | Should |
| FR-35 | Pane | `Ctrl+U`로 좌우 패널의 경로·포커스·선택·스크롤·정렬 상태 전체를 교환한다 | Should |
| FR-36 | Status Bar | 파일/폴더 개수와 선택 개수, 선택 용량을 `선택분 / 전체` 형식으로 표시한다 | Should |
| FR-37 | Status Bar | 선택 항목에 폴더가 포함되어도 하위 용량을 재귀 계산하지 않고, 폴더는 개수에만 반영한다 | Should |
| FR-38 | Favorites | 즐겨찾기 경로로 즉시 이동한다 (`Ctrl+1`~`Ctrl+9`, `Ctrl+D`로 목록) | Must |
| FR-39 | Favorites | 즐겨찾기는 v0.1에서 전용 편집 UI 없이 설정 파일 직접 편집으로 관리한다 | Must |
| FR-40 | State Restore | 마지막 좌우 패널 경로와 테마를 앱 재시작 시 복원한다 | Must |
| FR-41 | Refresh | `Ctrl+R`로 활성 패널을 수동 새로고침한다 | Must |
| FR-42 | Refresh | 창 포커스 복귀 시 양쪽 패널을 자동 새로고침한다 | Must |
| FR-43 | Refresh | 새로고침 후 포커스는 이전 항목명 기준으로 복원한다 | Should |
| FR-44 | Global | 전역 핫키(설정 가능)로 창을 표시/숨김 토글한다 | Must |
| FR-45 | Global | `Ctrl+Shift+D`로 Dark/Light 테마를 전환하고 마지막 선택을 저장한다 | Should |
| FR-46 | Drive Info | 각 패널 상단에 현재 드라이브의 여유/전체 용량을 표시한다 | Could |
| FR-47 | Icons | 파일 아이콘을 시스템 아이콘으로 표시한다 (확장자 단위 캐싱) | Could |
| FR-48 | Mouse | 클릭 선택, 더블클릭 열기를 지원한다 | Could |

---

## 3. Non-Functional Requirements

| ID | 품질 영역 | 요구사항 | 우선순위 |
|---|---|---|---|
| NFR-01 | Usability | 임의의 프로젝트 디렉터리에 도달해 터미널을 여는 데까지 키 입력 5회 이내로 가능해야 한다 | Must |
| NFR-02 | Performance | 5,000개 이상 항목(예: `node_modules`)이 있는 디렉터리에서도 방향키 이동이 끊기지 않아야 한다 | Must |
| NFR-03 | Performance | Space 다중 선택 시 파일 시스템을 재조회하지 않는다 | Must |
| NFR-04 | Performance | 드라이브 용량 조회가 파일 목록 표시를 지연시키지 않는다 | Must |
| NFR-05 | Reliability | 연결 끊긴 네트워크 드라이브가 있어도 앱 시작이 블로킹되지 않는다 | Must |
| NFR-06 | Reliability | 사용 중인 파일, 권한 없음, 경로 없음 등의 오류를 숨기지 않고 명확히 표시한다 | Must |
| NFR-07 | Reliability | 권한 없는 디렉터리 진입 시 앱이 죽지 않는다 | Must |
| NFR-08 | Data Safety | 파괴적 작업(삭제/덮어쓰기) 전 사용자 확인을 거친다 | Must |
| NFR-09 | Data Safety | 드라이브 간 이동(`EXDEV`)에서 원본 보존을 우선한다. 폴백 중간 실패 시 원본을 남긴다 | Must |
| NFR-10 | Data Safety | 편집 시 원본 인코딩과 줄바꿈을 보존해 Git diff 오염 및 한글 손상을 방지한다 | Must |
| NFR-11 | Security | Renderer는 Node.js 전체 API에 접근하지 않고 `contextIsolation`을 유지한다 | Must |
| NFR-12 | Security | 외부 프로세스 인자는 배열로 전달하며 문자열 조합을 금지한다 (명령 주입 방지) | Must |
| NFR-13 | Security | 임의 명령 자유 입력을 지원하지 않는다 | Must |
| NFR-14 | Maintainability | `src/main/filesystem/*`는 `electron`을 import하지 않아 Vitest로 독립 테스트가 가능하다 | Must |
| NFR-15 | Maintainability | Main / Preload / Renderer 책임을 명확히 분리한다 | Must |
| NFR-16 | Testability | Copy / Move / Delete / Rename 및 이름 충돌, `EXDEV` 폴백, 부분 실패 경로가 `os.tmpdir()` 기반 통합 테스트로 검증된다 | Must |
| NFR-17 | Compatibility | Windows 11에서 정상 동작해야 한다 | Must |
| NFR-18 | Packaging | portable 빌드로 배포 가능해야 한다 (설치/제거 절차 불필요) | Must |
| NFR-19 | Consistency | 색상은 컴포넌트에 하드코딩하지 않고 CSS Variable 토큰으로 관리한다 | Should |
| NFR-20 | Responsiveness | 키 입력에 대한 시각적 반응이 즉시 나타나야 한다 | Should |
| NFR-21 | Dependency | 기본 API로 구현 가능한 것에는 라이브러리를 추가하지 않는다 | Should |

---

## 4. Constraints

| ID | 구분 | 제약사항 |
|---|---|---|
| CON-01 | Platform | v0.1의 대상 OS는 Windows Desktop으로 제한한다 |
| CON-02 | Application | Desktop App은 Electron 35를 사용한다 |
| CON-03 | Frontend | UI는 React 19를 사용한다 |
| CON-04 | Language | 구현 언어는 TypeScript 5를 사용한다 |
| CON-05 | Build | Frontend 개발 및 빌드는 Vite 6 + electron-vite 3 기반으로 한다 |
| CON-06 | Markdown | Markdown Renderer는 `react-markdown` + `remark-gfm`을 동적 import로 사용한다 |
| CON-07 | Editor | 내장 편집기는 `textarea`를 사용한다. Monaco/CodeMirror 등 외부 에디터 라이브러리는 도입하지 않는다 |
| CON-08 | State | `useReducer` + props로 상태를 관리하며, Context는 상태 전달 통로로 사용하지 않는다 |
| CON-09 | Process Boundary | `src/main/filesystem/*`는 `node:fs`, `node:path`만 사용하고 `electron`을 import하지 않는다 |
| CON-10 | Process Boundary | Renderer는 `node:fs`를 직접 호출하지 않고 typed IPC를 경유한다 |
| CON-11 | Process Boundary | Preload는 `contextBridge`로 명시적으로 정의된 API만 노출한다 |
| CON-12 | External Process | 터미널이 필요한 명령은 새 콘솔 창(`wt.exe` 또는 `cmd.exe`)을 띄우고 앱은 출력을 캡처하지 않는다 |
| CON-13 | External Process | `.cmd` shim(`code`, `claude`, `codex`, `agy`) 실행은 `cmd.exe /c` 경유가 필요하다 |
| CON-14 | External Process | 실행된 프로세스는 `detached: true` + `unref()`로 앱 종료와 독립적으로 유지한다 |
| CON-15 | File System | 드라이브 열거는 `C:`~`Z:` 프로브 방식만 가능하며 각 프로브에 타임아웃을 건다 |
| CON-16 | File System | Windows 숨김/시스템 속성은 `fs.Stats`로 조회할 수 없어 이름 기반 필터로 대체한다 |
| CON-17 | File System | 여유/전체 용량은 `fs.statfs()` 값을 캐싱하고, 지정된 시점(드라이브 전환/작업 완료/포커스 복귀)에만 갱신한다 |
| CON-18 | File System | `fs.watch` 기반 실시간 감시는 사용하지 않는다 |
| CON-19 | Move | `fs.rename()` 실패(`EXDEV`) 시 copy → 검증 → 원본 delete 폴백을 사용한다 |
| CON-20 | Delete | 기본 삭제는 `shell.trashItem()`이며, 영구 삭제(`fs.rm`)는 별도 확인을 거친다 |
| CON-21 | Command Launcher | v0.1은 등록된 프리셋만 실행하며 자유 명령 문자열 입력을 지원하지 않는다 |
| CON-22 | Packaging | electron-builder portable 빌드를 기본으로 하며, 코드 서명 및 자동 업데이트는 범위 밖이다 |
| CON-23 | Reuse | `mdviewer`의 프로젝트 구조·빌드 구성·Markdown 렌더링 컴포넌트를 재사용하되, 파일 조작 계층은 새로 설계한다 |

---

## 5. Non-Goals

| ID | 제외 기능 | v0.1 정책 |
|---|---|---|
| NG-01 | 디렉터리 탭 | 지원하지 않음. 단 상태 모델은 탭 배열을 전제해 설계 |
| NG-02 | 파일 검색 / 내용 검색 / 필터 | 지원하지 않음 (v0.2 후보) |
| NG-03 | 압축 파일 탐색 | 지원하지 않음 |
| NG-04 | FTP / SFTP / 네트워크 파일 관리 | 지원하지 않음 |
| NG-05 | 파일 비교 / 디렉터리 동기화 | 지원하지 않음 |
| NG-06 | Batch Rename | 지원하지 않음 |
| NG-07 | 임의 명령 자유 입력 | 지원하지 않음. 프리셋 실행 및 터미널 열기로 대체 |
| NG-08 | 내장 터미널 에뮬레이터 | 지원하지 않음. 항상 새 콘솔 창을 띄운다 |
| NG-09 | 폴더 하위 용량 재귀 계산 | 지원하지 않음 (성능) |
| NG-10 | 파일 속성(숨김/시스템) 컬럼 | 지원하지 않음. Node에서 Windows 속성 직접 조회 불가 |
| NG-11 | 플러그인 시스템 | 지원하지 않음 |
| NG-12 | 파일 작업 Queue / Background Job Manager | 지원하지 않음. 단일 작업 진행 표시·취소로 대체 |
| NG-13 | Drag & Drop | 지원하지 않음 (키보드 우선 원칙) |
| NG-14 | 고급 Context Menu | 지원하지 않음 |
| NG-15 | 사용자 정의 테마 편집기 | 지원하지 않음 |
| NG-16 | 자동 업데이트 / 코드 서명 | 지원하지 않음. portable 배포로 대체 |
| NG-17 | 이미지 / PDF / 동영상 뷰어 | 지원하지 않음 |
| NG-18 | Cross-platform | macOS 및 Linux 지원은 범위 밖 |

---

## 6. v0.1 Scope Summary

v0.1의 핵심 범위는 다음과 같다.

- 듀얼 패널 탐색 (좌/우 독립 경로, Active Pane, Tab 전환)
- Command Launcher를 통한 터미널 / `claude` / `codex` / `agy` / VSCode 실행 (프리셋 전용)
- F3 읽기 전용 뷰어 (텍스트 / Markdown)
- F4 내장 경량 편집기 (인코딩·줄바꿈 유지, 외부 변경 감지)
- F2 이름변경, F5 복사, F6 이동, F7 새 폴더, F8 삭제(휴지통), Shift+Delete 영구삭제
- Space 다중 선택, 이름 충돌 처리, 부분 실패 허용, 진행 표시와 취소
- 정렬, 좌우 패널 교환(Ctrl+U), 상태바
- 즐겨찾기 경로 이동, 마지막 경로·테마 복원, 새로고침(수동 + 포커스 복귀 자동)
- Dark 기본 테마, Light 테마
- 드라이브 용량 표시, 시스템 아이콘, 마우스 조작 (Peripheral, 최종 구현)

구현 순서는 TECH_GUIDE.md 17장의 Phase(1 단일 패널 탐색 → 2 Launcher → 3 뷰어 → 4 편집기 →
5 즐겨찾기/복원/새로고침 → 6 듀얼 패널 → 7 파일 작업 → 8 마감)를 따른다.
화면 구조상 1순위로 보이는 듀얼 패널이 의도 기준으로는 6번째라는 점에 유의한다.

---

## 7. Change Management

사용자 요청으로 구현 또는 프로젝트 내용이 변경되면 영향받는 문서를 다음 순서로 갱신한다.

1. `BRIEF.md` (의도·범위 변경 시)
2. `PRD.md`
3. `SPEC.md`
4. `PLAN.md`
5. `docs/releases/v0.1/backlog.json`
