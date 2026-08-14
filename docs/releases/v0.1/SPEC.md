# Personal File Manager Specification

> 문서 위치: `docs/releases/v0.1/SPEC.md`
> 문서 역할: `PRD.md`의 요구사항을 구현 가능한 수준으로 상세화한다. 동작 규칙, 데이터 계약, IPC 인터페이스를 확정한다.
> 선행 문서: `BRIEF.md`, `TECH_GUIDE.md`, `PRD.md`
> 후속 문서: `PLAN.md` → `backlog.json`

---

## 1. Overview

Personal File Manager는 터미널 CLI 에이전트 작업 흐름의 마찰을 제거하기 위한 상주형 Windows 데스크톱 애플리케이션이다.

애플리케이션은 두 개의 파일 패널로 구성되며, 사용자는 키보드만으로 디렉터리를 탐색하고, 문서를 확인·수정하고,
현재 경로를 작업 디렉터리로 하는 터미널 창을 띄운다. 파일 복사/이동/삭제는 이 흐름을 보조한다.

하나의 애플리케이션 인스턴스만 실행되며(`requestSingleInstanceLock`), 창을 닫아도 프로세스는 종료되지 않고
전역 핫키로 다시 표시된다.

### 1.1 Repository README

저장소 루트의 `README.md`는 외부 사용자를 위한 안내 문서다. 다음을 간략히 포함한다.

- Personal File Manager의 목적
- 현재 구현 상태
- 계획된 주요 기능

---

## 2. Application Model

### 2.1 Instance Model

애플리케이션은 단일 인스턴스로 동작한다.

```text
두 번째 실행 시도
  → requestSingleInstanceLock() 실패
  → 기존 창을 표시하고 포커스를 준다
  → 두 번째 프로세스는 즉시 종료한다
```

### 2.2 Window Lifecycle

| 이벤트 | 동작 |
|---|---|
| 앱 시작 | 설정 파일을 읽어 마지막 창 크기·위치, 좌우 경로, 테마를 복원한다 |
| 창 닫기(`X`) | 창을 숨긴다. 프로세스는 종료되지 않는다 |
| 전역 핫키 | 창이 보이면 숨기고, 숨겨져 있으면 표시하고 포커스를 준다 |
| 명시적 종료 | 설정을 저장한 뒤 프로세스를 종료한다 |
| 창 포커스 복귀 | 양쪽 패널을 자동 새로고침한다 (§9.2) |

창 숨김 상태에서도 패널 상태는 메모리에 유지된다. 재표시 시 목록을 다시 조회한다.

### 2.3 Pane Model

두 개의 패널(`left`, `right`)이 존재한다. 두 패널은 완전히 동일한 구조와 기능을 가지며,
어느 쪽이 Active Pane인지에 따라서만 역할이 달라진다.

- 모든 파일 작업의 **Source**는 Active Pane이다.
- 모든 파일 작업의 기본 **Destination**은 반대쪽(Inactive) 패널의 현재 경로다.
- Launcher가 사용하는 작업 디렉터리는 Active Pane의 현재 경로다.

패널의 상태는 v0.1에서 항상 길이 1인 배열로 보관한다. 탭 기능은 구현하지 않지만
상태 모델은 탭 배열을 전제한다 (§7.3).

### 2.4 Scope Boundary

Root Folder 개념이 없다. 사용자는 파일 시스템 전체를 탐색할 수 있으며,
접근 가능한 모든 드라이브의 임의 경로로 이동할 수 있다.

경로 검증은 접근 범위 제한이 아니라 **입력값 유효성 검증** 목적으로 Main에서 수행한다 (§12.3).

---

## 3. User Interface

### 3.1 Main Layout

```text
┌──────────────────────────────┬──────────────────────────────┐
│ D: [109.3 G / 236.7 G]       │ C: [42.1 G / 476.9 G]        │  ← DriveBar
│ D:\projects\tools\file_manager│ C:\Users\nampl\Documents     │  ← PathBar
├──────────────────────────────┼──────────────────────────────┤
│ Name          Ext  Size  Date│ Name          Ext  Size  Date│  ← Header
│ [..]                         │ [..]                         │
│ docs               <DIR> ... │ notes              <DIR> ... │  ← FileList
│ src                <DIR> ... │ memo.txt      txt  1.2K  ... │
│ package.json  json  1.8K ... │                              │
├──────────────────────────────┼──────────────────────────────┤
│ 용량: 0 / 3.1 M  파일: 0/1 …  │ 용량: … 파일: … 폴더: …      │  ← StatusBar
└──────────────────────────────┴──────────────────────────────┘
  D:\projects\tools\file_manager >  [ cmd  claude  codex  agy  code. ]
  F2 Rename  F3 View  F4 Edit  F5 Copy  F6 Move  F7 New  F8 Delete
```

- 두 패널은 화면을 좌우로 균등 분할한다. v0.1에서 분할 비율 조절은 지원하지 않는다.
- Active Pane은 테두리 강조와 헤더 배경색으로 구분한다.
- 하단 공통 영역은 Active Pane 경로 표시, Command Launcher, Function Key 안내로 구성한다.

### 3.2 DriveBar

현재 패널 경로가 속한 드라이브 문자와 여유/전체 용량을 표시한다.

```text
D: [109.3 G / 236.7 G]
```

- 용량 값이 아직 도착하지 않았으면 드라이브 문자만 표시하고 용량 자리는 비워 둔다.
- 용량 조회는 비동기이며 목록 렌더링을 블로킹하지 않는다 (§10.3).
- `Alt+F1` / `Alt+F2`로 좌/우 패널의 드라이브 선택 목록을 연다.

### 3.3 PathBar

현재 전체 경로를 표시한다. 경로가 표시 너비를 초과하면 중간을 생략(`...`)하고 앞뒤를 남긴다.
글꼴은 고정폭(`Cascadia Code`, fallback `Consolas`)을 사용한다.

### 3.4 FileList

컬럼은 `파일명` / `확장자` / `크기` / `날짜` 네 개로 고정한다. v0.1에서 컬럼 너비 조절은 지원하지 않는다.

| 컬럼 | 표시 규칙 |
|---|---|
| 파일명 | 확장자를 제외한 이름. 폴더는 전체 이름 |
| 확장자 | 앞의 `.`을 제외한 확장자. 폴더는 빈 문자열 |
| 크기 | 파일은 자동 단위(B/K/M/G), 폴더는 `<DIR>` |
| 날짜 | `YYYY-MM-DD HH:mm` |

- 행 높이는 고정한다. windowing 계산의 전제다 (§10.1).
- Focus(커서 위치)와 Selection(선택 상태)을 다른 스타일로 구분한다.
  Focus는 테두리 또는 배경, Selection은 전경색 강조로 구분해 두 상태가 겹쳐도 판별 가능해야 한다.

### 3.5 StatusBar

Total Commander의 `선택분 / 전체` 병기 형식을 따른다.

```text
용량: 128.4 M / 934.6 M    파일: 5 / 51    폴더: 2 / 4
```

- 좌측 값은 선택 항목 기준, 우측 값은 현재 디렉터리 전체 기준이다.
- 폴더는 개수에만 반영하고 용량 합계에서 제외한다. 하위 용량을 재귀 계산하지 않는다.
- `[..]` 항목은 어느 집계에도 포함하지 않는다.
- 선택 상태 변경 시 이미 조회한 메타데이터만으로 재계산한다. 파일 시스템을 다시 조회하지 않는다.

### 3.6 Command Launcher

하단에 프리셋 버튼 행을 표시한다. `Ctrl+L`로 포커스를 이동하며, 포커스 상태에서 숫자 `1`~`5`로 실행한다.

```text
1 cmd    2 claude    3 codex    4 agy    5 code .
```

텍스트 입력 필드가 아니다. 임의 문자열을 입력할 수 없다 (§8.4).

### 3.7 FunctionKeyBar

최하단에 기능 키 안내를 표시한다.

```text
F2 Rename  F3 View  F4 Edit  F5 Copy  F6 Move  F7 New  F8 Delete
```

---

## 4. Navigation Behavior

### 4.1 Directory Listing

경로 진입 시 다음 순서로 처리한다.

```text
1. isLoading = true, 이전 entries 유지 (화면 깜빡임 방지)
2. Main에 listDirectory 요청
3. 성공 → entries 교체, isLoading = false, error = null
   실패 → isLoading = false, error 설정, entries는 빈 배열
4. 정렬 적용 (§4.5)
5. 포커스 결정 (§4.4)
```

### 4.2 Entry Ordering

정렬 기준과 무관하게 다음 순서가 항상 우선한다.

```text
1. [..] 항목 (최상단 고정)
2. 폴더 (정렬 기준 적용)
3. 파일 (정렬 기준 적용)
```

`[..]`은 루트 디렉터리(`D:\`)에서는 표시하지 않는다.

### 4.3 Key Behavior

| 키 | 동작 |
|---|---|
| `↑` `↓` | 포커스를 한 칸 이동한다. 목록 경계에서 멈춘다(순환하지 않음) |
| `PgUp` `PgDn` | 화면에 보이는 행 수만큼 이동한다 |
| `Home` `End` | 첫 항목 / 마지막 항목으로 이동한다 |
| `Enter` | 폴더·`[..]`이면 진입, 파일이면 `shell.openPath()`로 기본 연결 프로그램 실행 |
| `Backspace` | 상위 디렉터리로 이동한다. 루트에서는 무시한다 |
| `Tab` | Active Pane을 전환한다 |
| 문자 입력 | Type-ahead (§4.6) |

### 4.4 Focus Restoration

경로가 바뀔 때 포커스 결정 규칙은 다음과 같다.

| 상황 | 포커스 대상 |
|---|---|
| `Backspace` 또는 `[..]`로 상위 이동 | 방금 빠져나온 폴더 항목 |
| 새 경로로 진입 | 첫 번째 항목 (`[..]` 다음 항목) |
| 새로고침 | 이전 포커스 항목명과 일치하는 항목. 없으면 같은 인덱스 위치, 그것도 범위를 벗어나면 마지막 항목 |

**인덱스 기준 복원은 새로고침에서 사용하지 않는다.** 항목명 기준이 우선이다.

### 4.5 Sorting

| 키 | 정렬 기준 |
|---|---|
| `Ctrl+F3` | 이름 (`name`) |
| `Ctrl+F4` | 확장자 (`ext`) |
| `Ctrl+F5` | 날짜 (`mtime`) |
| `Ctrl+F6` | 크기 (`size`) |

- 같은 키를 다시 누르면 `sortAsc`가 반전된다.
- 다른 키를 누르면 새 기준으로 바뀌고 `sortAsc = true`로 초기화한다.
- 이름 비교는 대소문자를 구분하지 않으며, 숫자 부분은 자연 정렬(natural sort)을 적용한다
  (`file2.txt`가 `file10.txt`보다 앞에 온다).
- 확장자 정렬 시 확장자가 같으면 이름으로 2차 정렬한다.
- 정렬 기준은 패널별로 독립이며 설정 파일에 저장된다.
- 정렬은 Renderer에서 수행한다. 정렬 변경 시 파일 시스템을 재조회하지 않는다.

### 4.6 Type-ahead

인쇄 가능한 문자 입력 시 동작한다.

- 입력 버퍼에 문자를 누적하고, 버퍼로 시작하는 첫 항목(대소문자 무시)으로 포커스를 옮긴다.
- 마지막 입력 후 1초가 지나면 버퍼를 비운다.
- 일치하는 항목이 없으면 포커스를 옮기지 않고 버퍼도 누적하지 않는다.
- 편집기/뷰어/대화상자가 열려 있으면 동작하지 않는다.

### 4.7 Drive Selection

`Alt+F1`(좌) / `Alt+F2`(우)로 드라이브 목록을 연다.

- 목록은 앱 시작 시 백그라운드에서 조회해 캐싱한 값을 사용한다 (§10.4).
- 목록이 아직 준비되지 않았으면 "조회 중" 상태를 표시한다.
- 드라이브 선택 시 해당 드라이브의 루트로 이동한다.

---

## 5. Selection Behavior

### 5.1 Selection Model

선택 상태는 `Set<string>`으로 관리하며, 키는 **소문자 정규화된 파일명**이다.
Windows가 대소문자를 구분하지 않으므로 정규화 없이 문자열 비교하면 새로고침 후 선택이 어긋난다.

### 5.2 Rules

| 키 | 동작 |
|---|---|
| `Space` | 현재 포커스 항목의 선택을 토글하고 포커스를 다음 항목으로 옮긴다. 마지막 항목에서는 포커스를 유지한다 |
| `Ctrl+A` | `[..]`을 제외한 전체 항목을 선택한다 |
| `Esc` | 선택을 해제한다. 열린 뷰어/편집기/대화상자가 있으면 그것을 먼저 닫는다 |

- `[..]`은 선택 대상에서 제외한다. `Space`를 눌러도 선택되지 않고 포커스만 다음으로 이동한다.
- 경로가 바뀌면 선택을 모두 해제한다.
- 새로고침 시에는 선택을 유지하되, 사라진 항목의 키는 제거한다.

### 5.3 Operation Target

파일 작업 대상은 다음 규칙으로 결정한다.

```text
selectedNames가 비어 있지 않으면 → 선택된 항목 전체
selectedNames가 비어 있으면      → 포커스 항목 하나
포커스 항목이 [..]이면           → 작업을 수행하지 않는다
```

---

## 6. File Operations

### 6.1 Common Flow

모든 파일 작업은 다음 흐름을 따른다.

```text
1. 대상 결정 (§5.3)
2. 확인 대화상자 표시 — Source 목록과 Destination 경로를 사용자가 볼 수 있어야 한다
3. Main에 작업 요청 (AbortSignal 연결)
4. 진행 상태 수신 → 현재 처리 중인 파일명 표시, 취소 버튼 제공
5. 이름 충돌 발생 시 → 중단하고 사용자 결정을 요청 (§6.6)
6. 완료 → 결과 요약(성공 수 / 실패 목록) 표시
7. 관련 패널 새로고침, 포커스 복원 (§4.4)
```

### 6.2 Copy (`F5`)

- Source: Active Pane의 대상, Destination: 반대쪽 패널의 현재 경로.
- 구현은 `fs.cp()`를 사용하고 `AbortSignal`을 연결한다.
- 폴더 대 폴더 충돌의 기본 동작은 **병합**이다. 폴더 통째 대체는 기본값이 아니다.
- symlink / junction은 `lstat`으로 판별하고 재귀하지 않는다. 링크 자체를 복사 대상에서 제외하고
  실패 목록에 "링크는 지원하지 않음"으로 기록한다.
- 부분 실패를 허용한다. 실패 항목을 수집해 결과와 함께 반환한다.

### 6.3 Move (`F6`)

```text
1. fs.rename() 시도
2. EXDEV 발생 시:
   a. 대상으로 복사
   b. 복사 결과 검증 (크기 일치 확인)
   c. 검증 성공 시에만 원본 삭제
3. 폴백 중간에 실패하면 복사본을 정리하고 원본을 보존한다
```

**원본 보존이 최우선이다.** 판단이 애매하면 원본을 남기고 실패로 보고한다.
`D:` → `C:` 이동은 실제 사용 시나리오이므로 EXDEV 경로가 테스트되어야 한다.

### 6.4 Rename (`F2`)

- 포커스 항목 하나만 대상으로 한다. 다중 선택 상태여도 포커스 항목만 변경한다.
- 인라인 편집 또는 단일 입력 대화상자로 처리한다. 초기값은 현재 이름이며,
  파일인 경우 확장자를 제외한 부분만 선택 상태로 시작한다.
- 같은 이름이 이미 존재하면 오류를 표시하고 이름을 다시 입력받는다.
- Windows에서 허용되지 않는 문자(`\ / : * ? " < > |`)를 입력하면 저장을 막고 오류를 표시한다.

### 6.5 Delete (`F8` / `Delete` / `Shift+Delete`)

| 동작 | 구현 | 확인 |
|---|---|---|
| `F8` / `Delete` | `shell.trashItem()` | 대상 목록을 보여주는 확인 대화상자 |
| `Shift+Delete` | `fs.rm({ recursive: true, force: false })` | "영구 삭제" 문구를 명시한 별도 확인 |

- 기본값은 반드시 휴지통이다.
- 여러 항목이 선택되어 있으면 전체가 대상이다.
- 부분 실패를 허용하며, 삭제되지 않은 항목을 결과에 나열한다.

### 6.6 Name Conflict

충돌 발생 시 작업을 일시 중단하고 Renderer에 보고한다. 사용자 결정을 받아 재개한다.

| 선택지 | 동작 |
|---|---|
| 덮어쓰기 (`overwrite`) | 대상을 덮어쓴다 |
| 건너뛰기 (`skip`) | 해당 항목만 건너뛰고 계속한다 |
| 자동 이름 변경 (`rename`) | `name (2).ext` 형식으로 번호를 붙인다. 그 이름도 존재하면 번호를 증가시킨다 |
| 취소 (`cancel`) | 전체 작업을 중단한다. 이미 처리된 항목은 되돌리지 않는다 |

- **"모두 적용"(`applyToAll`) 체크박스를 반드시 제공한다.** 없으면 50개 파일에 50번 대화상자가 뜬다.
- `applyToAll`이 체크되면 이후 동일 유형의 충돌에 같은 결정을 자동 적용한다.

### 6.7 New Folder (`F7`)

- Active Pane의 현재 경로에 폴더를 만든다.
- 이름 입력 대화상자를 표시한다. 기본값은 비어 있다.
- 생성 후 새 폴더로 포커스를 옮긴다.
- 같은 이름이 존재하면 오류를 표시하고 다시 입력받는다.

### 6.8 Progress and Cancellation

- 진행 표시는 현재 처리 중인 파일명 수준으로 충분하다. 전체 진행률(%) 계산을 위해 사전 스캔하지 않는다.
- 취소는 `AbortController`로 구현한다. 취소 시 이미 완료된 항목은 되돌리지 않고,
  "취소됨: n개 처리 후 중단" 형식으로 보고한다.
- 작업 Queue나 Background Job Manager는 만들지 않는다. 동시에 하나의 파일 작업만 수행한다.
  작업 진행 중 새 파일 작업 요청은 무시하거나 거부한다.

### 6.9 Error Standardization

Main은 Node 오류 코드를 사용자 문구로 매핑해 반환한다. 원본 코드는 로그에 남기고 숨기지 않는다.

| 코드 | 사용자 문구 |
|---|---|
| `EPERM` | 권한이 없어 작업할 수 없습니다 |
| `EACCES` | 접근이 거부되었습니다 |
| `EBUSY` | 다른 프로그램이 파일을 사용 중입니다 |
| `ENOENT` | 파일 또는 경로를 찾을 수 없습니다 |
| `EXDEV` | 다른 드라이브로의 이동입니다 (내부 폴백 처리) |
| `ENOSPC` | 디스크 공간이 부족합니다 |
| `ENOTEMPTY` | 폴더가 비어 있지 않습니다 |
| 그 외 | 원본 메시지를 그대로 표시한다 |

---

## 7. Application State

### 7.1 FileEntry

Main ↔ Renderer 계약의 핵심이며 IPC 직렬화 비용의 근원이다.

```ts
type FileEntry = {
  name: string          // 파일명 (전체 경로 아님)
  ext: string           // 확장자, 앞의 '.' 제외 (폴더는 빈 문자열)
  size: number          // bytes (폴더는 0)
  mtime: number         // epoch ms
  isDirectory: boolean
  isSymlink: boolean
  isParent: boolean     // [..] 항목
}
```

**엔트리마다 전체 경로를 담지 않는다.** 디렉터리 경로는 응답에 한 번만 포함하고 Renderer에서 조합한다.

### 7.2 PaneState

```ts
type SortKey = 'name' | 'ext' | 'size' | 'mtime'

type PaneState = {
  currentPath: string
  entries: FileEntry[]
  focusedIndex: number
  selectedNames: Set<string>   // 소문자 정규화된 파일명
  scrollTop: number
  sortKey: SortKey
  sortAsc: boolean
  isLoading: boolean
  error: string | null
}
```

- `sortKey` / `sortAsc`를 처음부터 포함한다. 사후 추가하면 swap·refresh 로직이 전부 영향을 받는다.
- `isLoading` / `error`를 포함한다. 느린 네트워크 드라이브와 권한 오류가 실제로 발생한다.

### 7.3 AppState

```ts
type AppState = {
  panes: {
    left: PaneState[]     // 탭 배열. v0.1에서는 항상 length 1
    right: PaneState[]
  }
  activeTabIndex: { left: number; right: number }
  activePane: 'left' | 'right'
  theme: 'dark' | 'light'
  overlay: OverlayState   // 뷰어 / 편집기 / 대화상자
}
```

v0.1에서 탭 기능은 구현하지 않지만 상태 모델은 배열로 둔다. 탭을 나중에 추가하면
swap, 활성 패널, 상태 복원 로직이 전부 바뀐다.

### 7.4 Pane Swap (`Ctrl+U`)

`panes.left`와 `panes.right`를 통째로 교환한다.

교환 대상: `currentPath`, `entries`, `focusedIndex`, `selectedNames`, `scrollTop`, `sortKey`, `sortAsc`.
**표시 문자열만 바꾸는 구현은 허용하지 않는다.** `activePane` 값 자체는 바뀌지 않는다
(왼쪽이 활성이었다면 교환 후에도 왼쪽이 활성이며, 그 왼쪽에는 이전 오른쪽 내용이 들어 있다).

### 7.5 State Management

- `useReducer`로 중앙 상태를 관리하고 props로 전달한다.
- **Context를 상태 전달 통로로 사용하지 않는다.** Context는 어떤 값이 바뀌든 모든 소비자를
  재렌더링시켜 메모이제이션을 무력화한다.
- 테마처럼 거의 바뀌지 않는 값에만 Context를 허용한다.
- 상태 관리 라이브러리는 prop drilling이 실제로 감당 불가능해지는 시점에만 도입한다.

---

## 8. Viewer, Editor, Launcher

### 8.1 Viewer (`F3`)

- 대상: `.md` `.txt` `.log` `.json` `.yaml` `.yml` `.toml` `.ini` `.csv` 및 일반 소스 코드.
- Markdown(`.md`)은 `react-markdown` + `remark-gfm`으로 렌더링한다. **동적 import**로 로드하며,
  F3를 처음 누를 때 로드된다. 초기 번들에 포함하지 않는다.
- 렌더링에 실패하면 원문을 표시한다.
- 그 외 텍스트는 고정폭 글꼴로 원문을 표시한다.
- 읽기 전용이며 파일을 잠그지 않는다.
- 이미지 / PDF / 동영상 뷰어는 v0.1 범위 밖이다. 해당 확장자는 "지원하지 않는 형식" 메시지를 표시한다.
- `Esc`로 닫는다.

### 8.2 Editor (`F4`)

`textarea` 하나로 구현한다. Monaco / CodeMirror 등 외부 에디터 라이브러리를 도입하지 않는다.
문법 강조와 자동완성은 "제목 바꾸기, 몇 줄 추가"라는 목적에 필요 없다.

| 키 | 동작 |
|---|---|
| `Ctrl+S` | 저장 |
| `Esc` | 닫기. 변경사항이 있으면 확인 대화상자 표시 |

`Shift+F4`는 편집기를 열지 않고 해당 파일을 VSCode에서 연다.

### 8.3 Read / Write Policy

| 항목 | 구현 |
|---|---|
| 인코딩 판별 | BOM 확인 → 없으면 UTF-8 유효성 검사 → 유효하지 않으면 CP949로 간주 |
| 인코딩 유지 | 읽을 때 판별한 인코딩으로 저장한다 |
| 판별 실패 시 | 편집 모드 진입을 막고 뷰어로만 표시한다. 깨진 저장보다 낫다 |
| 줄바꿈 | 원본의 CRLF / LF를 판별해 저장 시 복원한다. 혼재 시 다수를 따른다 |
| 크기 제한 | 임계값 초과 시 편집 모드 진입을 막고 "VSCode에서 열기"를 안내한다. 초기 임계값은 1MB로 하고 구현 중 조정한다 |
| 변경 감지 | 열 때의 `mtime`을 보관하고 저장 직전에 재확인한다. 다르면 사용자에게 알리고 덮어쓸지 묻는다 |

변경 감지는 이 앱 고유의 요구다. 앱에서 파일을 열어둔 채 터미널에서 에이전트를 돌리는 것이
기본 사용 패턴이기 때문이다.

Node 표준으로 CP949 디코딩이 어려우면 `iconv-lite` 도입을 검토한다 (TECH_GUIDE 2.1의 예외 절차).

### 8.4 Launcher

#### 8.4.1 실행 모델

> 현재 Active Pane의 경로를 작업 디렉터리로 하는 터미널 창을 새로 띄우고, 앱은 관여를 끝낸다.

`claude`, `codex`, `agy`는 대화형 TUI다. 앱 내부에 출력을 표시하려는 시도는 하지 않는다.
stdout 캡처, 진행 상태 추적, 내장 터미널 에뮬레이터는 모두 범위 밖이다.

```text
Windows Terminal 존재  → wt.exe 에 시작 디렉터리 전달
Windows Terminal 없음  → cmd.exe 를 새 창으로 실행
VSCode                → 터미널 경유 없이 직접 실행
```

`wt.exe` 존재 여부는 앱 시작 시 한 번 확인하고 캐싱한다.

#### 8.4.2 프리셋

| 키 | 프리셋 | 실행 형태 |
|---|---|---|
| `1` | `cmd` | 현재 경로에서 터미널 창 |
| `2` | `claude` | 터미널 창에서 `claude` 실행 |
| `3` | `codex` | 터미널 창에서 `codex` 실행 |
| `4` | `agy` | 터미널 창에서 `agy` 실행 |
| `5` | `code .` | 터미널 없이 VSCode 직접 실행 |

`Ctrl+T`는 프리셋 1과 동일하고, `Ctrl+E`는 프리셋 5와 동일하다.

#### 8.4.3 필수 준수 사항

| 항목 | 규칙 |
|---|---|
| 인자 전달 | `execFile`에 **인자를 배열로** 전달한다. 문자열 조합을 금지한다. 폴더명에 `&`, `^`가 있을 때 명령 주입이 발생한다 |
| `.cmd` shim | `code`, `claude`, `codex`, `agy`는 대부분 `.cmd` 래퍼다. Node 20+ 보안 패치로 `spawn`이 shell 없이 `.cmd`를 실행하지 못한다. `cmd.exe /c` 경유가 필요하다 |
| 생명주기 | `detached: true` + `unref()`. 앱을 닫아도 터미널 세션이 살아 있어야 한다 |
| 자유 입력 | 지원하지 않는다. 프리셋만 실행한다 |
| 실패 | 실행 파일을 찾지 못하면 명확한 오류를 표시한다. 조용히 무시하지 않는다 |

---

## 9. Refresh and External Changes

### 9.1 Policy

CLI 에이전트가 터미널에서 파일을 만들고 지우므로 패널은 상시 낡은 상태가 된다.

| 시점 | 동작 |
|---|---|
| `Ctrl+R` | 활성 패널 수동 새로고침 |
| 창 포커스 복귀 | 양쪽 패널 자동 새로고침 |
| 파일 작업 완료 | 관련 패널 갱신 |
| 경로 변경 | 목록 조회 |

`fs.watch` 기반 실시간 감시는 v0.1에서 사용하지 않는다. Windows에서 중복 이벤트가 많고,
위 네 시점으로 실사용 요구가 충족된다.

### 9.2 Focus Return Refresh

창 포커스 복귀 시 양쪽 패널을 새로고침한다. 이때:

- 포커스는 이전 항목명 기준으로 복원한다 (§4.4).
- 선택 상태는 유지하되 사라진 항목의 키를 제거한다.
- 스크롤 위치는 복원된 포커스가 화면에 보이도록 조정한다.
- 새로고침 중에도 키 입력을 받을 수 있어야 한다. 화면을 비우지 않는다.
- 현재 경로가 사라졌으면 존재하는 가장 가까운 상위 경로로 이동하고 그 사실을 알린다.

---

## 10. Performance

이 앱의 실질적 병목은 **대용량 디렉터리에서의 React 렌더링** 하나다.
`node_modules`를 열면 5,000개 엔트리가 나오고, 최초 렌더링 지연과
방향키 이동 시 전체 재렌더링이 동시에 발생한다. 후자가 더 치명적이다.

"문제가 확인되면 그때 최적화"를 이 항목에 적용하지 않는다. 아래는 선제 적용 대상이다.

### 10.1 Row Windowing

- 행 높이가 고정이므로 `scrollTop`과 컨테이너 높이로 가시 범위를 계산해 슬라이스한다.
- 외부 라이브러리를 사용하지 않는다.
- 가시 범위 위아래로 여유 행(overscan)을 두어 스크롤 시 빈 영역이 보이지 않게 한다.

### 10.2 Row Memoization

- `FileRow`는 `isFocused`, `isSelected` 불리언과 표시에 필요한 원시값만 props로 받고 `React.memo`로 감싼다.
- 포커스 이동 시 이전 행과 새 행 두 개만 재렌더링되어야 한다.
- props로 객체나 인라인 함수를 새로 만들어 전달하면 메모이제이션이 무력화된다.

### 10.3 Non-blocking Queries

- 드라이브 용량 조회는 목록 조회와 독립적으로 수행한다.
- 값이 도착하기 전에는 이전 값 또는 빈칸을 유지한다.
- 조회 시점: 패널 경로가 다른 드라이브로 바뀔 때 / 파일 작업 완료 후(해당 드라이브만) / 창 포커스 복귀 시.
- 값을 캐싱해 델타로 갱신하지 않는다. 휴지통 삭제·동일 볼륨 Move·클러스터 할당·OneDrive placeholder 등으로
  델타 계산은 구조적으로 어긋난다.

### 10.4 Drive Enumeration

Node에 드라이브 열거 API가 없다. `C:`~`Z:` 프로브가 유일한 순수 Node 방법이며,
연결이 끊긴 네트워크 드라이브에서 SMB 타임아웃으로 수십 초 블로킹된다.

- 앱 시작 시 백그라운드에서 한 번만 조회하고 캐싱한다.
- 각 프로브에 짧은 타임아웃을 건다.
- 조회 완료 전에도 UI는 정상 동작해야 한다. 드라이브 바만 비어 있으면 된다.
- 명시적 새로고침 시에만 갱신한다.

### 10.5 Other Rules

- Space 다중 선택 시 파일 시스템을 재조회하지 않는다. 이미 조회한 메타데이터를 사용한다.
- 폴더 크기를 Selection마다 재귀 계산하지 않는다.
- 아이콘은 확장자 단위로 1회 조회 후 캐싱한다. 5,000개 목록에서 전부 호출하지 않는다.
- Markdown 렌더러는 동적 로드로 초기 번들에서 분리한다.
- 그 외의 최적화는 실제 병목이 측정된 뒤에 수행한다.

---

## 11. IPC Contract

### 11.1 Boundary

```text
Renderer ──(typed IPC)──▶ Preload ──▶ Main ──▶ File System / Shell / Process
```

- Renderer는 `node:fs`를 직접 호출하지 않는다.
- Preload는 `contextBridge`로 명시적으로 정의된 API만 노출한다.
- IPC 채널과 타입은 `shared/`에 정의된 것만 사용한다.

### 11.2 Channels

```ts
// 디렉터리 / 메타데이터
'fs:listDirectory'   (path: string) => { path: string; entries: FileEntry[] }
'fs:createDirectory' (path: string, name: string) => OpResult

// 파일 작업 (진행 이벤트 및 충돌 질의를 동반)
'fs:copy'   (req: TransferRequest) => OpResult
'fs:move'   (req: TransferRequest) => OpResult
'fs:rename' (path: string, from: string, to: string) => OpResult
'fs:delete' (req: DeleteRequest) => OpResult
'fs:cancel' (opId: string) => void

// 텍스트 읽기 / 쓰기
'file:readText'  (path: string) => ReadTextResult
'file:writeText' (req: WriteTextRequest) => WriteTextResult

// 시스템
'sys:listDrives'   () => DriveInfo[]
'sys:driveUsage'   (letter: string) => { free: number; total: number }
'sys:fileIcon'     (ext: string) => string        // data URL
'sys:openPath'     (path: string) => void         // 기본 연결 프로그램
'sys:launch'       (preset: PresetId, cwd: string) => OpResult

// 설정
'config:load' () => Settings
'config:save' (settings: Settings) => void

// Main → Renderer 이벤트
'op:progress'  { opId: string; currentFile: string; done: number }
'op:conflict'  { opId: string; name: string; kind: 'file' | 'dir' }
'app:focus'    // 창 포커스 복귀 알림
```

### 11.3 Types

```ts
type ConflictAction = 'overwrite' | 'skip' | 'rename' | 'cancel'

type TransferRequest = {
  opId: string
  sourceDir: string
  names: string[]
  destDir: string
}

type DeleteRequest = {
  opId: string
  dir: string
  names: string[]
  permanent: boolean     // false = 휴지통
}

type OpResult = {
  ok: boolean
  succeeded: string[]
  failed: { name: string; code: string; message: string }[]
  cancelled: boolean
}

type ReadTextResult = {
  content: string
  encoding: 'utf8' | 'utf8-bom' | 'cp949'
  eol: 'crlf' | 'lf'
  mtime: number
  editable: boolean      // 인코딩 판별 실패 또는 크기 초과 시 false
  reason?: string        // editable = false 인 이유
}

type WriteTextRequest = {
  path: string
  content: string
  encoding: ReadTextResult['encoding']
  eol: ReadTextResult['eol']
  expectedMtime: number
  force: boolean         // mtime 불일치를 무시하고 덮어쓸지
}

type WriteTextResult =
  | { ok: true; mtime: number }
  | { ok: false; reason: 'mtime-mismatch'; actualMtime: number }
  | { ok: false; reason: 'error'; code: string; message: string }

type DriveInfo = { letter: string; free: number | null; total: number | null }

type PresetId = 'cmd' | 'claude' | 'codex' | 'agy' | 'code'
```

충돌 응답은 `op:conflict` 이벤트에 대한 Renderer의 회신
(`{ action: ConflictAction; applyToAll: boolean }`)으로 전달하며, Main은 이를 받아 작업을 재개한다.

### 11.4 Module Boundary (필수)

> **`src/main/filesystem/*`는 `electron`을 import하지 않는다. `node:fs`, `node:path`만 사용한다.
> Electron 의존(`shell.trashItem` 등)은 `src/main/ipc/` 층에서 주입한다.**

Vitest는 Electron을 import하는 모듈을 테스트할 수 없다. 이 경계를 지키면
copy / move / delete / 이름충돌 / EXDEV / 부분실패를 `os.tmpdir()` 픽스처로 전부 테스트할 수 있다.
지키지 않으면 가장 위험한 코드가 테스트 불가 영역에 갇힌다.

---

## 12. Path Handling and Security

### 12.1 Long Path

260자를 초과하는 경로는 `\\?\` 접두사 처리를 직접 해야 한다. `node_modules` 중첩에서 실제로 발생한다.
경로 정규화 유틸리티(`pathUtils.ts`)에서 일괄 처리하고, 개별 호출부에서 다루지 않는다.

### 12.2 Case Normalization

Windows는 경로 대소문자를 구분하지 않는다. 선택 상태 키, 경로 비교, 드라이브 문자 비교에는
소문자 정규화 키를 사용한다.

### 12.3 IPC Validation

Main은 Renderer가 보낸 경로 값을 검증한다.

- 절대 경로인지 확인한다.
- `..` 세그먼트를 정규화한 뒤 처리한다.
- 파일명 인자에 경로 구분자가 포함되어 있으면 거부한다 (`names`는 파일명만 허용).
- 존재 여부를 확인하고, 없으면 `ENOENT`로 응답한다.

### 12.4 Security Rules

- Renderer에 Node.js 전체 API를 노출하지 않는다. `contextIsolation`을 유지한다.
- 외부 프로세스 인자는 배열로 전달한다 (§8.4.3).
- 임의 명령 자유 입력을 지원하지 않는다.
- 파괴적 작업 전에 사용자 확인을 제공한다.
- 사용자 요청 없이 파일을 덮어쓰거나 삭제하지 않는다.
- 실패를 숨기지 않는다.

---

## 13. Settings and Persistence

### 13.1 Location

```text
app.getPath('userData')/settings.json
```

### 13.2 Schema

```ts
type Settings = {
  version: 1
  panes: {
    left:  { path: string; sortKey: SortKey; sortAsc: boolean }
    right: { path: string; sortKey: SortKey; sortAsc: boolean }
  }
  activePane: 'left' | 'right'
  theme: 'dark' | 'light'
  window: { width: number; height: number; x: number | null; y: number | null }
  favorites: { key: number; label: string; path: string }[]   // key: 1~9
  globalHotkey: string                                        // 예: 'Alt+`'
}
```

### 13.3 Rules

- v0.1에서 설정 편집 UI를 만들지 않는다. 즐겨찾기 추가·수정은 파일 직접 편집으로 충분하다.
- 파일이 없거나 손상되면 기본값으로 시작한다. **앱이 죽지 않는다.**
- 복원한 경로가 더 이상 존재하지 않으면 존재하는 가장 가까운 상위 경로로 대체하고,
  그것도 불가능하면 사용자 홈 디렉터리를 사용한다.
- 저장 시점: 앱 종료 시, 그리고 경로·테마·정렬·창 크기 변경 후 디바운스(수 초) 저장.

### 13.4 Favorites

- `Ctrl+1` ~ `Ctrl+9`로 `favorites[].key`에 해당하는 경로로 Active Pane을 이동한다.
- 해당 키에 등록된 항목이 없으면 아무 동작도 하지 않는다.
- `Ctrl+D`로 즐겨찾기 목록을 열어 선택 이동한다. 목록에서 추가·삭제는 v0.1에 없다.
- 등록된 경로가 존재하지 않으면 오류를 표시하고 이동하지 않는다.

---

## 14. Theme and Style

### 14.1 Style Rules

- VS Code 계열의 조밀한 개발자 도구 스타일. 정보 밀도를 높이고 여백과 장식을 최소화한다.
- 애니메이션을 사용하지 않는다.
- 키 입력에 대한 시각적 반응이 즉시 나타나야 한다.

### 14.2 Fonts

| 대상 | 글꼴 |
|---|---|
| 일반 UI | `Segoe UI` |
| 경로, Command Launcher, 뷰어/편집기 본문 | `Cascadia Code`, fallback `Consolas` |

### 14.3 Tokens

CSS Variable 기반이며 `:root[data-theme='dark' | 'light']`로 전환한다.
컴포넌트에 색상을 하드코딩하지 않는다.

```text
background, panelBackground, headerBackground
textPrimary, textSecondary, border
activePane, focusedItem, selectedItem
statusBar, commandBar
```

Dark가 기본이며 Light를 제공한다. 사용자 정의 테마 편집기는 v0.1 범위 밖이다.

---

## 15. Error Handling

| 상황 | 동작 |
|---|---|
| 권한 없는 디렉터리 진입 | 앱이 죽지 않고 패널에 오류를 표시한다. 이전 경로에 머문다 |
| 현재 경로가 외부에서 삭제됨 | 존재하는 가장 가까운 상위 경로로 이동하고 사실을 알린다 |
| 연결 끊긴 네트워크 드라이브 | 프로브 타임아웃으로 처리하고 목록에서 제외하거나 비활성으로 표시한다. 앱 시작을 블로킹하지 않는다 |
| OneDrive 온디맨드 파일 | `stat` 호출이 지연될 수 있다. 목록 조회에 타임아웃을 두고, 지연 항목은 메타데이터 없이 표시한다 |
| 편집 중 파일이 외부에서 삭제됨 | 저장 시 `ENOENT`를 감지해 알리고, 새 파일로 저장할지 묻는다 |
| 실행 파일을 찾을 수 없음 | 어떤 명령이 실패했는지 명시한 오류를 표시한다 |
| 설정 파일 손상 | 기본값으로 시작하고 손상 사실을 알린다 |

모든 파일 시스템 호출은 타임아웃 또는 취소 가능해야 한다.

---

## 16. Keyboard Shortcuts

§4~§8의 키 배치를 종합한다. 구현 중 임의로 변경하지 않는다.

### 16.1 탐색

| 키 | 동작 |
|---|---|
| `Tab` | Active Pane 전환 |
| `↑` `↓` | 항목 이동 |
| `PgUp` `PgDn` `Home` `End` | 페이지 / 처음 / 끝 이동 |
| `Enter` | 폴더 진입, 파일은 기본 연결 프로그램 실행 |
| `Backspace` | 상위 디렉터리 |
| `Alt+F1` `Alt+F2` | 좌 / 우 패널 드라이브 선택 |
| `Ctrl+R` | 현재 패널 새로고침 |
| `Ctrl+U` | 좌우 패널 전체 상태 교환 |
| `Ctrl+1` ~ `Ctrl+9` | 즐겨찾기 경로로 이동 |
| `Ctrl+D` | 즐겨찾기 목록 열기 |
| 문자 입력 | Type-ahead |

### 16.2 선택

| 키 | 동작 |
|---|---|
| `Space` | 선택 토글 후 다음 항목으로 이동 |
| `Ctrl+A` | 전체 선택 |
| `Esc` | 선택 해제 / 열린 창 닫기 |

### 16.3 정렬

| 키 | 동작 |
|---|---|
| `Ctrl+F3` | 이름순 |
| `Ctrl+F4` | 확장자순 |
| `Ctrl+F5` | 날짜순 |
| `Ctrl+F6` | 크기순 |

### 16.4 파일 작업

| 키 | 동작 |
|---|---|
| `F2` | 이름 변경 |
| `F3` | 뷰어 (읽기 전용) |
| `F4` | 내장 편집기 |
| `Shift+F4` | 외부 편집기(VSCode)로 해당 파일 열기 |
| `F5` | 복사 |
| `F6` | 이동 |
| `F7` | 새 폴더 |
| `F8` / `Delete` | 삭제 (휴지통) |
| `Shift+Delete` | 영구 삭제 |

### 16.5 실행

| 키 | 동작 |
|---|---|
| `Ctrl+T` | 현재 경로에서 터미널 열기 |
| `Ctrl+E` | 현재 경로에서 VSCode 열기 |
| `Ctrl+L` | Command Launcher 포커스 |
| Launcher 내 `1`~`5` | 프리셋 실행 |

### 16.6 전역

| 키 | 동작 |
|---|---|
| 전역 핫키 (설정 가능) | 창 표시 / 숨김 토글 |
| `Ctrl+Shift+D` | Dark / Light 테마 전환 |

### 16.7 Key Routing

오버레이(뷰어/편집기/대화상자)가 열려 있으면 패널 키 핸들러는 동작하지 않는다.
전역 핫키만 예외이며 항상 동작한다.

---

## 17. Application Structure

```text
src/
├─ main/
│  ├─ index.ts
│  ├─ filesystem/          # electron import 금지. 순수 Node
│  │  ├─ listDirectory.ts
│  │  ├─ copyItems.ts
│  │  ├─ moveItems.ts      # EXDEV 폴백 포함
│  │  ├─ renameItem.ts
│  │  ├─ deleteItems.ts
│  │  ├─ createDirectory.ts
│  │  ├─ readTextFile.ts   # 인코딩 판별
│  │  ├─ writeTextFile.ts  # 인코딩/줄바꿈 유지, mtime 검증
│  │  └─ pathUtils.ts      # 긴 경로, 정규화
│  ├─ system/
│  │  ├─ drives.ts         # 열거 + 캐싱, statfs
│  │  ├─ icons.ts          # getFileIcon + 확장자 캐싱
│  │  ├─ trash.ts          # shell.trashItem
│  │  └─ launcher.ts       # 터미널 / VSCode 실행
│  ├─ config/
│  │  └─ settings.ts       # userData/settings.json
│  └─ ipc/                 # electron 의존은 여기까지
│
├─ preload/
│  └─ index.ts
│
├─ renderer/
│  ├─ App.tsx
│  ├─ components/
│  │  ├─ FilePane/
│  │  ├─ FileList/         # windowing 포함
│  │  ├─ FileRow/          # React.memo
│  │  ├─ PathBar/
│  │  ├─ DriveBar/
│  │  ├─ StatusBar/
│  │  ├─ CommandLauncher/
│  │  ├─ FunctionKeyBar/
│  │  ├─ Viewer/           # F3
│  │  ├─ Editor/           # F4
│  │  └─ Dialog/
│  ├─ hooks/
│  ├─ state/
│  └─ styles/
│
└─ shared/
   ├─ types.ts
   └─ ipc.ts
```

---

## 18. Testing

### 18.1 우선순위

되돌릴 수 없는 것부터 테스트한다. 쉬운 것부터가 아니다.

| 순위 | 대상 | 방식 |
|---|---|---|
| 1 | Copy / Move / Delete / Rename | `os.tmpdir()` 픽스처 통합 테스트 |
| 2 | 이름 충돌, EXDEV 폴백, 부분 실패 | 같은 방식 |
| 3 | 인코딩 판별, 줄바꿈 유지, mtime 검증 | 같은 방식 |
| 4 | 경로 정규화, 긴 경로 | 순수 함수 |
| 5 | 정렬 비교자, 크기 포맷 | 순수 함수 |

4·5는 테스트하기 쉬워서 우선순위가 높은 것이 아니다. 순위는 위험도 순이다.

### 18.2 제약

Vitest는 Electron import 모듈을 다루지 못한다. §11.4의 경계 규칙을 지켜야 1~3위를 테스트할 수 있다.

파괴적 작업(Copy / Move / Delete)은 테스트 없이 완료로 처리하지 않는다.

---

## 19. Packaging

`mdviewer`와 달리 **portable 빌드를 기본**으로 한다.

| 항목 | 판단 |
|---|---|
| portable | 폴더에 풀어 실행. 업데이트는 폴더 덮어쓰기 |
| NSIS | 필요 시 추가. 코드 서명이 없어 SmartScreen 경고가 뜬다 |
| 파일 연결 | 불필요 |
| 자동 업데이트 | v0.1 범위 밖 |

### 19.1 필수 구성

- `app.requestSingleInstanceLock()` — 인스턴스 중복 방지
- `globalShortcut` — 창 표시/숨김 토글. 상주형 앱에서 Electron의 시작 시간 문제를 무력화한다
- 창 닫기는 종료가 아니라 숨김으로 처리한다 (트레이 상주 여부는 구현 시 결정)

---

## 20. Technology Baseline

```text
Desktop       : Electron 35
Language      : TypeScript 5
UI            : React 19
Build         : Vite 6 + electron-vite 3
Packaging     : electron-builder (portable 우선)
Test          : Vitest
Styling       : CSS + CSS Variables
File System   : node:fs/promises, node:path
Shell         : Electron shell API
Process       : node:child_process
Markdown      : react-markdown + remark-gfm (동적 로드)
Editor        : textarea
State         : useReducer + props
Architecture  : main + preload + renderer + shared
Target OS     : Windows
```

Node.js / Electron / React 기본 기능으로 구현 가능한 것에는 라이브러리를 추가하지 않는다.

---

## 21. v0.1 Scope

구현 순서는 의도 기준으로 세로로 자른다. 각 Phase가 끝나면 실제로 사용 가능한 상태가 된다.

| Phase | 내용 | 완료 시 사용 가능한 것 |
|---|---|---|
| 1 | 단일 패널 탐색 | 목록, 방향키, Enter/Backspace, 정렬, 폴더 우선 |
| 2 | Launcher | 터미널 / claude / codex / agy / `code .` 실행. **이 시점에 "cmd 열고 cd" 마찰이 사라진다** |
| 3 | 뷰어 (F3) | 텍스트 / Markdown 확인 |
| 4 | 편집기 (F4) | 인코딩·줄바꿈 유지, mtime 충돌 감지 |
| 5 | 즐겨찾기 · 경로 복원 · 새로고침 | 반복 경로 즉시 도달 |
| 6 | 듀얼 패널 | Tab 전환, Ctrl+U 교환 |
| 7 | 파일 작업 | Rename, Copy, Move, New Folder, 휴지통 삭제, 충돌 처리, 진행/취소 |
| 8 | 마감 | 드라이브 용량, 아이콘, Light 테마, 마우스, 전역 핫키 |

Phase 2까지만 완료되어도 매일 사용 가능하고, Phase 5면 의도의 대부분이 충족된다.
**듀얼 패널이 6번**이라는 점에 주의한다. 화면 구조상으로는 1순위처럼 보이지만
의도 기준의 우선순위는 그렇지 않다.

후속 버전 검토 항목: 디렉터리 탭, 파일/내용 검색, 경로·명령 History, 사용자 정의 프리셋,
편집기 선택, 파일 비교, 압축 파일 지원, Drag & Drop, 파일 속성 표시, 선택 반전.

---

## 22. Change Management

사용자 요청으로 구현 또는 프로젝트 내용이 변경되면 영향받는 문서를 다음 순서로 갱신한다.

1. `BRIEF.md` (의도·범위 변경 시)
2. `PRD.md`
3. `SPEC.md`
4. `PLAN.md`
5. `docs/releases/v0.1/backlog.json`
