# TECH_GUIDE.md — Personal File Manager v0.1

> 문서 위치: `docs/releases/v0.1/TECH_GUIDE.md`
> 문서 역할: `BRIEF.md`의 요구사항을 **어떤 기술로, 어떤 구조로** 구현할지 정의한다.
> 후속 문서: `PRD.md` → `SPEC.md` → `PLAN.md` → `backlog.json`

---

## 1. 기술 선택의 근거

기술 스택은 `mdviewer`와 동일하다. 다만 그 근거는 "가볍고 빠르다"가 아니다.
Electron 앱의 콜드 스타트는 통상 0.8~2초, 상주 메모리는 150~250MB로,
네이티브 파일 관리자보다 무겁다. 이 사실을 인정한 위에서 다음 세 가지를 근거로 삼는다.

| 근거 | 내용 |
|---|---|
| 상주형 앱이다 | 하루 한 번 실행해 계속 띄워 둔다. Electron의 최대 약점인 시작 시간이 실질 비용이 아니다. 전역 핫키로 창을 토글하면 체감 시작 시간은 0이 된다 |
| 구현 주체가 AI 에이전트다 | Codex/Claude Code의 TypeScript 산출물 품질이 Rust·C#보다 안정적이다. 언어 선택 기준은 "내가 잘 아는 것"이 아니라 "에이전트가 실수를 덜 하는 것"이다 |
| Electron이 Windows 셸 기능을 덮는다 | 휴지통, 기본 프로그램 실행, 시스템 아이콘을 표준 API로 제공한다. Node 단독으로는 불가능하다 |

### 1.1 문서에서 삭제한 전제

- ~~"가볍고 빠른 실행을 우선한다"~~ → **"상주형 도구로서의 입력 반응성을 우선한다"**
- ~~"프로그램 실행 시간이 짧아야 한다"~~ → 이 스택으로는 달성 불가능한 요구다. 전역 핫키로 대체한다.

### 1.2 `mdviewer` 재사용의 범위

`mdviewer`는 **읽기 전용 뷰어**이고 이 앱은 **되돌릴 수 없는 쓰기 작업**을 수행한다.
"검증된 스택"이라는 논거는 빌드·패키징·UI 층에서만 성립하며,
파일 조작 층에서는 아무것도 보증하지 않는다. 해당 영역은 처음부터 새로 설계하고 테스트한다.

재사용 대상:

- 프로젝트 구조 (`main` / `preload` / `renderer` / `shared`)
- electron-vite 빌드 구성, TypeScript 설정
- electron-builder 패키징 구성
- Markdown 렌더링 컴포넌트

`mdviewer` 애플리케이션 전체를 의존성으로 연결하지 않고, 필요한 컴포넌트를 재사용 가능한 형태로 가져온다.

### 1.3 검토했으나 채택하지 않은 스택

| 스택 | 판단 |
|---|---|
| Tauri + Rust | 배포 10MB, 메모리 80MB로 확실히 가볍다. 그러나 에이전트 산출물 품질 저하, mdviewer 자산 상실, WebView2 런타임 의존이 이득을 상쇄한다. 상주형이라 시작 속도 이득도 하루 한 번만 발생 |
| C# + WPF/WinUI | 가장 진지한 경쟁자다. 아래 3장의 Node 공백(드라이브 열거, 숨김 속성, 셸 아이콘)이 .NET에는 전부 표준 API로 존재한다. 그럼에도 Markdown 렌더링에 결국 WebView가 필요하고, 기존 자산이 통째로 버려진다 |
| C++ + Qt | v0.1 개발 비용 과다 |
| Python + Qt | 기존 기술 자산과 무관. 배포 부담 |

---

## 2. 기술 스택 확정

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
Editor        : textarea (외부 에디터 라이브러리 없음)
State         : useReducer + props (Context는 상태 전달에 사용하지 않음)
Architecture  : main + preload + renderer + shared
Target OS     : Windows
```

### 2.1 의존성 정책

Node.js / Electron / React 기본 기능으로 구현 가능한 것에는 라이브러리를 추가하지 않는다.

추가 검토가 필요한 경우 다음을 확인한다.

- 기본 API만으로 구현이 불합리하게 복잡한가
- 충분히 작고 유지보수되고 있는가
- v0.1 핵심 기능에 실제로 필요한가

**예외 조항 하나** — 상태 관리 라이브러리(Zustand 등, 1KB 수준)는
prop drilling이 실제로 감당 불가능해지는 시점에 도입을 허용한다.
Context로 같은 문제를 풀려면 Context를 다수로 분할하거나 메모이제이션을 수동 관리해야 하므로,
"의존성 최소화" 원칙이 오히려 복잡도를 늘리는 사례다. 단, 실제 문제 확인 전에는 도입하지 않는다.

### 2.2 v0.1 Dependency 범위

```text
runtime      : react, react-dom, @electron-toolkit/preload, @electron-toolkit/utils
viewer       : react-markdown, remark-gfm      (동적 import로 초기 번들에서 분리)
devDependency: electron, electron-vite, vite, typescript, vitest, electron-builder
```

`react-markdown` + `remark-gfm`은 unified/micromark 생태계를 포함해 gzip 기준 100~150KB다.
초기 로드 경로에 포함시키지 않고, F3를 처음 누를 때 로드한다.

---

## 3. Windows / Node 제약 (구현 전 필독)

파일 관리자를 Node로 만들 때 부딪히는 지점을 능력별로 분류한다.
이 장의 내용을 모르고 구현하면 설계를 되돌려야 한다.

### 3.1 Electron API로 해결되는 것

| 기능 | API |
|---|---|
| 휴지통 삭제 | `shell.trashItem()` |
| 기본 연결 프로그램으로 열기 | `shell.openPath()` |
| 탐색기에서 항목 선택 상태로 열기 | `shell.showItemInFolder()` |
| 파일 아이콘 | `app.getFileIcon()` |

`app.getFileIcon()`은 시스템 아이콘을 그대로 가져오므로 별도 아이콘 테마가 필요 없다.
다만 파일당 비동기 호출이므로 **확장자 단위로 캐싱**한다. 5,000개 목록에서 전부 호출하지 않는다.

### 3.2 Node 표준으로 해결되는 것

| 기능 | API | 비고 |
|---|---|---|
| 여유/전체 용량 | `fs.statfs()` | Windows에서 `GetDiskFreeSpaceEx`로 직결. 로컬 드라이브 1ms 미만 |
| 재귀 복사 | `fs.cp()` | `AbortSignal` 지원 → 취소 가능 |
| 재귀 삭제 | `fs.rm()` | `AbortSignal` 지원. 영구 삭제 전용 |
| 디렉터리 조회 | `fs.readdir(withFileTypes)` | |
| 메타데이터 | `fs.stat()` / `fs.lstat()` | |

### 3.3 해결책이 없는 것

**드라이브 열거** — Node에 API가 없다. `C:`~`Z:`를 프로브하는 것이 유일한 순수 Node 방법이며,
**연결이 끊긴 네트워크 드라이브에서 SMB 타임아웃으로 수십 초 블로킹된다.**

대응:
- 앱 시작 시 백그라운드에서 한 번만 조회하고 캐싱한다.
- 각 프로브에 짧은 타임아웃을 건다.
- 조회 완료 전에도 UI는 정상 동작해야 한다. 드라이브 바만 비어 있으면 된다.
- 명시적 새로고침 시에만 갱신한다.

**숨김 / 시스템 속성** — `fs.Stats`에 Windows 파일 속성이 없다.
이름이 `.`으로 시작하는지만 알 수 있어 `.git`은 걸러도 시스템 파일은 걸러지지 않는다.

대응:
- v0.1에서 속성 컬럼을 만들지 않는다.
- 숨김 처리는 **이름 기반 필터**로 대체한다 (`.`으로 시작 + 제외 목록).
- 실제 Windows 속성이 필요하면 `attrib` 실행이 필요하나 디렉터리마다 프로세스를 띄우는 비용이 크다. v0.2 검토 사항.

**긴 경로 (260자 초과)** — `\\?\` 접두사 처리를 직접 해야 한다.
`node_modules` 중첩에서 실제로 발생한다. 경로 정규화 유틸리티에서 일괄 처리한다.

### 3.4 여유 공간 조회 정책

`fs.statfs()`가 충분히 싸므로 값을 캐싱해 델타로 갱신하지 않는다.
델타 방식은 다음 이유로 구조적으로 어긋난다.

- 휴지통 삭제는 같은 볼륨 내 이동이라 여유 공간이 늘지 않는다
- 같은 볼륨 내 Move는 공간 변화가 0이다
- 파일 크기와 실제 점유 공간이 다르다 (클러스터 할당, NTFS 압축, sparse, hardlink)
- OneDrive placeholder는 논리 크기와 점유가 다르다
- Launcher로 띄운 에이전트가 만드는 파일 등 앱 외부 변화를 반영할 수 없다

대신 **조회 시점을 통제**한다.

- 패널 경로가 다른 드라이브로 바뀔 때
- 파일 작업 완료 후 (해당 드라이브만)
- 창 포커스 복귀 시

전부 비동기이며 목록 렌더링을 기다리지 않는다. 값이 도착하기 전에는 이전 값 또는 빈칸을 유지한다.

### 3.5 그 밖의 Windows 함정

| 항목 | 내용 |
|---|---|
| 드라이브 간 Move | `fs.rename()`은 볼륨이 다르면 `EXDEV`로 실패한다. copy → 검증 → delete 폴백이 필수다. `D:` → `C:`는 실제 사용 시나리오다 |
| symlink / junction | 재귀 복사가 순환 참조에 빠질 수 있다. `lstat`으로 판별하고 재귀하지 않는다 |
| OneDrive 온디맨드 파일 | `stat` 호출이 실제 다운로드를 유발하거나 수 초 지연될 수 있다. `D:\OneDrive\` 하위 탐색에서 발생한다 |
| 경로 대소문자 | Windows는 대소문자를 구분하지 않는다. 선택 상태를 경로 문자열로 관리할 때 정규화 키(소문자)가 필요하다 |
| 네트워크 드라이브 | 조회가 수십 초 블로킹될 수 있다. 모든 파일 시스템 호출은 타임아웃 또는 취소 가능해야 한다 |

---

## 4. 프로세스 책임 분리

```text
Renderer  ──(typed IPC)──▶  Preload  ──▶  Main  ──▶  File System / Shell / Process
```

### 4.1 Main Process

- 디렉터리 조회, 메타데이터 조회
- Copy / Move / Rename / Delete / New Folder
- 휴지통 삭제, 기본 프로그램 실행, 아이콘 조회
- 드라이브 열거, 용량 조회
- 외부 프로세스 실행
- 파일 읽기 / 쓰기 (뷰어, 편집기)
- 설정 파일 읽기 / 쓰기

### 4.2 Preload

- `contextBridge`로 명시적으로 정의된 API만 노출한다.
- Node.js 전체 API를 Renderer에 노출하지 않는다.
- IPC 채널과 타입은 `shared/`에 정의된 것만 사용한다.

### 4.3 Renderer

- 패널 렌더링, 키 입력 처리, 상태 관리
- 뷰어 / 편집기 UI, 확인 대화상자
- 테마 적용

Renderer에서 `node:fs`를 직접 호출하지 않는다.

### 4.4 테스트 가능성 제약 (중요)

Vitest는 Electron을 import하는 모듈을 테스트할 수 없다. 따라서 다음 규칙을 강제한다.

> **`src/main/filesystem/*`는 `electron`을 import하지 않는다. `node:fs`, `node:path`만 사용한다.
> Electron 의존(`shell.trashItem` 등)은 `src/main/ipc/` 층에서 주입한다.**

이 경계를 지키면 copy / move / delete / 이름충돌 / EXDEV / 부분실패를
`os.tmpdir()` 픽스처로 전부 테스트할 수 있다. 지키지 않으면 가장 위험한 코드가 테스트 불가 영역에 갇힌다.

---

## 5. 애플리케이션 구조

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

## 6. 상태 모델

### 6.1 FileEntry

Main ↔ Renderer 계약의 핵심이며 IPC 직렬화 비용의 근원이다.

```ts
type FileEntry = {
  name: string          // 파일명 (전체 경로 아님)
  ext: string           // 확장자 (폴더는 빈 문자열)
  size: number          // bytes (폴더는 0)
  mtime: number         // epoch ms
  isDirectory: boolean
  isSymlink: boolean
  isParent: boolean     // [..] 항목
}
```

**엔트리마다 전체 경로를 담지 않는다.** 디렉터리 경로는 응답에 한 번만 포함하고
Renderer에서 조합한다. 5,000 엔트리 기준 payload가 절반 이하로 줄어든다.

### 6.2 PaneState

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

- `selectedNames`는 **소문자 정규화**해서 저장한다 (Windows 대소문자 비구분).
- `sortKey` / `sortAsc`를 처음부터 포함한다. 사후 추가하면 swap·refresh 로직이 전부 영향을 받는다.
- `isLoading` / `error`를 포함한다. 느린 네트워크 드라이브와 권한 오류가 실제로 발생한다.

### 6.3 AppState

```ts
type AppState = {
  panes: {
    left: PaneState[]     // 탭 배열. v0.1에서는 항상 length 1
    right: PaneState[]
  }
  activeTabIndex: { left: number; right: number }
  activePane: 'left' | 'right'
  theme: 'dark' | 'light'
}
```

**v0.1에서 탭 기능은 구현하지 않지만 상태 모델은 배열로 둔다.**
탭을 나중에 추가하면 swap, 활성 패널, 상태 복원 로직이 전부 바뀐다.
배열 전제를 미리 잡아두는 비용은 거의 없다.

### 6.4 상태 관리 방식

- `useReducer`로 중앙 상태를 관리하고 props로 전달한다.
- **Context를 상태 전달 통로로 사용하지 않는다.** Context는 어떤 값이 바뀌든 모든 소비자를 재렌더링시켜 메모이제이션을 무력화한다.
- 테마처럼 거의 바뀌지 않는 값에만 Context를 허용한다.

---

## 7. 성능 설계

이 앱의 실질적 병목은 **대용량 디렉터리에서의 React 렌더링** 하나다.
`node_modules`를 열면 5,000개 엔트리가 나오고, 두 가지가 동시에 터진다.

1. 최초 렌더링 500ms~1초
2. **방향키로 포커스를 한 칸 옮길 때마다 5,000행 전체 재렌더링**

2번이 더 치명적이다. 키보드 중심 앱에서 키 반복이 뭉개진다.
"문제가 확인되면 그때 최적화"는 이 항목에 적용하지 않는다. 확인은 첫날 된다.

### 7.1 v0.1에 포함하는 대응

| 대응 | 방법 |
|---|---|
| 행 windowing | 행 높이가 고정이므로 스크롤 위치에서 가시 범위를 계산해 슬라이스한다. 외부 라이브러리 불필요 |
| 행 메모이제이션 | `FileRow`는 `isFocused`, `isSelected` 불리언만 받고 `React.memo`로 감싼다. 포커스 이동 시 두 행만 갱신된다 |
| Context 회피 | 6.4 참조 |
| 아이콘 캐싱 | 확장자 단위로 1회 조회 후 재사용 |

### 7.2 그 밖의 원칙

- 앱 시작 시 불필요한 초기화를 하지 않는다.
- Space 다중 선택 시 파일 시스템을 재조회하지 않는다. 이미 조회한 메타데이터를 사용한다.
- 폴더 크기를 Selection마다 재귀 계산하지 않는다.
- 드라이브 열거와 용량 조회가 목록 표시를 블로킹하지 않는다.
- Markdown 렌더러는 동적 로드로 초기 번들에서 분리한다.
- 그 외의 최적화는 실제 병목이 측정된 뒤에 수행한다.

---

## 8. 파일 작업 구현

### 8.1 Copy

- `fs.cp()`를 기본으로 사용하고 `AbortSignal`을 연결해 취소를 지원한다.
- 폴더 대 폴더 충돌의 기본 동작은 병합이다.
- 부분 실패를 허용한다. 실패 항목을 수집해 결과와 함께 반환한다.

### 8.2 Move

```text
1. fs.rename() 시도
2. EXDEV 발생 시 → copy → 검증 → 원본 delete 폴백
3. 폴백 중간 실패 시 복사본을 정리하고 원본을 보존한다
```

원본 보존이 우선이다. 애매하면 원본을 남긴다.

### 8.3 Delete

| 동작 | 구현 |
|---|---|
| `F8` / `Delete` | `shell.trashItem()` |
| `Shift+Delete` | `fs.rm({ recursive: true })` + 별도 확인 |

기본값은 반드시 휴지통이다.

### 8.4 이름 충돌

Main은 충돌을 감지해 Renderer에 보고하고, 사용자 결정을 받아 재개하는 구조로 만든다.
`overwrite` / `skip` / `rename` / `cancel` 및 `applyToAll` 플래그를 IPC 타입에 포함한다.

### 8.5 오류 표준화

`EPERM` `EACCES` `EBUSY` `ENOENT` `EXDEV` `ENOSPC`를 사용자 문구로 매핑하는 테이블을 둔다.
원본 오류 코드는 로그에 남기고 숨기지 않는다.

---

## 9. 뷰어 / 편집기 구현

### 9.1 뷰어 (F3)

- Markdown은 `react-markdown` + `remark-gfm`으로 렌더링한다. 동적 import.
- 렌더링 실패 시 원문으로 폴백한다.
- 읽기 전용이며 파일을 잠그지 않는다.

### 9.2 편집기 (F4)

**`textarea`를 사용한다.** Monaco(5MB+)는 논외이며, CodeMirror 6(200KB)도 v0.1에서는 과하다.
문법 강조와 자동완성은 목적에 필요 없다. 부족하면 컴포넌트 하나를 교체하면 되므로 전환 비용이 낮다.

### 9.3 읽기 / 쓰기 정책

| 항목 | 구현 |
|---|---|
| 인코딩 판별 | BOM 확인 후 UTF-8 유효성 검사. 유효하지 않으면 CP949로 간주 |
| 인코딩 유지 | 읽을 때 판별한 인코딩으로 저장한다 |
| 판별 실패 시 | **편집 모드 진입을 막고 뷰어로만 표시한다.** 깨진 저장보다 낫다 |
| 줄바꿈 | 원본의 CRLF / LF를 유지한다 |
| 크기 제한 | 일정 크기 초과 시 편집 모드 진입을 막는다. `textarea` 성능 한계이자 VSCode로 넘길 신호다 |
| 변경 감지 | 열 때의 `mtime`을 보관하고, 저장 직전에 재확인한다. 다르면 사용자에게 알리고 덮어쓸지 묻는다 |

마지막 항목은 이 앱 고유의 요구다. 앱에서 파일을 열어둔 채
터미널에서 에이전트를 돌리는 것이 기본 사용 패턴이기 때문이다.

Node 표준으로 CP949 디코딩이 어려우면 `iconv-lite` 도입을 검토한다.
2.1의 의존성 예외 절차를 따른다.

---

## 10. 외부 프로세스 실행

### 10.1 실행 모델

터미널이 필요한 명령은 **새 콘솔 창을 띄우고 앱은 손을 뗀다.**

```text
Windows Terminal 존재      → wt.exe 에 시작 디렉터리 전달
Windows Terminal 없음      → cmd.exe 를 새 창으로 실행
VSCode                     → 터미널 경유 없이 직접 실행
```

이 모델이면 stdout 캡처, 진행 상태 추적, 프로세스 생명주기 관리가 모두 불필요해진다.

### 10.2 필수 준수 사항

| 항목 | 규칙 |
|---|---|
| 인자 전달 | `execFile`에 **인자를 배열로** 전달한다. 문자열 조합을 금지한다. 폴더명에 `&`, `^`가 있을 때 명령 주입이 발생한다 |
| `.cmd` shim | `code`, `claude`, `codex`는 대부분 `.cmd` 래퍼다. Node 20+ 보안 패치로 `spawn`이 shell 없이 `.cmd`를 실행하지 못한다. `cmd.exe /c` 경유가 필요하다 |
| 생명주기 | `detached: true` + `unref()`. 앱을 닫아도 터미널 세션이 살아 있어야 한다 |
| 자유 입력 | v0.1에서 지원하지 않는다. 프리셋만 실행한다 (BRIEF 5.3) |
| 실패 | 실행 파일을 찾지 못하면 명확한 오류를 표시한다 |

---

## 11. 새로고침과 외부 변경

CLI 에이전트가 터미널에서 파일을 만들고 지우므로 패널은 상시 낡은 상태가 된다.

| 시점 | 동작 |
|---|---|
| `Ctrl+R` | 활성 패널 수동 새로고침 |
| 창 포커스 복귀 | 양쪽 패널 자동 새로고침. 터미널을 오가는 것이 기본 패턴이므로 이것이 외부 변경을 대부분 잡는다 |
| 파일 작업 완료 | 관련 패널 갱신 |
| 경로 변경 | 목록 조회 |

`fs.watch` 기반 실시간 감시는 v0.1에서 사용하지 않는다.
Windows에서 중복 이벤트가 많고, 위 네 시점으로 실사용 요구가 충족된다.

새로고침 후 포커스는 이전 항목명 기준으로 복원한다. 인덱스 기준으로 복원하면 엉뚱한 곳을 가리킨다.

---

## 12. 설정과 영속화

- 위치: `app.getPath('userData')/settings.json`
- 저장 항목: 마지막 좌우 경로, 테마, 창 크기·위치, 즐겨찾기 목록, 정렬 상태, 전역 핫키
- v0.1에서 설정 편집 UI를 만들지 않는다. 파일 직접 편집으로 충분하다.
- 파일이 없거나 손상되면 기본값으로 시작한다. 앱이 죽지 않는다.

---

## 13. 테마

- CSS Variable 기반. 컴포넌트에 색상을 하드코딩하지 않는다.
- `:root[data-theme='dark' | 'light']`로 전환한다.

토큰:

```text
background, panelBackground, headerBackground
textPrimary, textSecondary, border
activePane, focusedItem, selectedItem
statusBar, commandBar
```

---

## 14. 보안

- Renderer에 Node.js 전체 API를 노출하지 않는다.
- `contextIsolation`을 유지하고, preload에서 필요한 API만 노출한다.
- IPC 요청값을 Main에서 검증한다. 특히 경로가 예상 범위를 벗어나는지 확인한다.
- 외부 프로세스 인자는 배열로 전달한다 (10.2).
- 파괴적 작업 전에 사용자 확인을 제공한다.
- 사용자 요청 없이 파일을 덮어쓰거나 삭제하지 않는다.
- 실패를 숨기지 않는다.

---

## 15. 패키징

`mdviewer`와 달리 **portable 빌드를 기본**으로 한다.

| 항목 | 판단 |
|---|---|
| portable | 폴더에 풀어 실행. 업데이트는 폴더 덮어쓰기. 재빌드가 잦은 개인용 상주 앱에 설치/제거 사이클은 마찰이다 |
| NSIS | 필요 시 추가. 코드 서명이 없어 SmartScreen 경고가 뜬다 |
| 파일 연결 | 불필요. `mdviewer`와 달리 `.md` 연결 대상이 아니다 |
| 자동 업데이트 | v0.1 범위 밖 |

### 15.1 추가 필수 구성

- `app.requestSingleInstanceLock()` — 인스턴스 중복 방지
- `globalShortcut` — 창 표시/숨김 토글. 상주형 앱에서 Electron의 시작 시간 문제를 무력화한다
- 창 닫기는 종료가 아니라 숨김으로 처리한다 (트레이 상주 여부는 구현 시 결정)

---

## 16. 테스트

### 16.1 우선순위

되돌릴 수 없는 것부터 테스트한다. 쉬운 것부터가 아니다.

| 순위 | 대상 | 방식 |
|---|---|---|
| 1 | Copy / Move / Delete / Rename | `os.tmpdir()` 픽스처 통합 테스트 |
| 2 | 이름 충돌, EXDEV 폴백, 부분 실패 | 같은 방식 |
| 3 | 인코딩 판별, 줄바꿈 유지, mtime 검증 | 같은 방식 |
| 4 | 경로 정규화, 긴 경로 | 순수 함수 |
| 5 | 정렬 비교자, 크기 포맷 | 순수 함수 |

4·5는 테스트하기 쉬워서 우선순위가 높은 것이 아니다. 순위는 위험도 순이다.

### 16.2 제약

Vitest는 Electron import 모듈을 다루지 못한다. 4.4의 경계 규칙을 지켜야 1~3위를 테스트할 수 있다.

---

## 17. 구현 순서

의도 기준으로 세로로 자른다. 각 Phase가 끝나면 실제로 사용 가능한 상태가 된다.
`PLAN.md`는 이 순서를 기준으로 상세화한다.

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

---

## 18. 구현 에이전트 지침

- 문서 역할을 구분한다: `BRIEF.md`(무엇을·왜) → `PRD.md`(요구사항 표) → `SPEC.md`(상세 기술) → `PLAN.md`(Phase) → `backlog.json`(작업 단위).
- 본 문서의 기술 선택을 기본값으로 사용하고 임의로 변경하지 않는다.
- 새 의존성 추가 전에 기본 API로 구현 가능한지 확인하고, 추가 시 목적과 근거를 명시한다.
- v0.1 범위를 넘는 기능을 임의로 구현하지 않는다.
- Main / Preload / Renderer 경계를 유지한다. 특히 4.4의 filesystem 층 규칙을 지킨다.
- 3장의 Windows / Node 제약을 우회하려 하지 말고, 명시된 대응을 따른다.
- 파괴적 작업(Copy / Move / Delete)은 테스트 없이 완료로 처리하지 않는다.
- 성능 최적화는 7.1에 명시된 것만 선제 적용하고, 나머지는 측정 후 수행한다.
- 불필요한 추상화 계층을 추가하지 않는다.

### 18.1 문서 위치 규칙

```text
docs/releases/v0.1/
├─ BRIEF.md
├─ TECH_GUIDE.md
├─ PRD.md
├─ SPEC.md
├─ PLAN.md
└─ backlog.json
```

이후 버전은 `docs/releases/v{major}.{minor}/`에 같은 순서로 작성한다.

`AGENTS.md`에는 매 턴 지켜져야 하는 규칙만 옮긴다.
긴 배경 설명은 본 문서에 두고, `AGENTS.md`는 다음 정도로 압축한다.

- Renderer에서 `node:fs` 직접 호출 금지
- `src/main/filesystem/*`에서 `electron` import 금지
- 외부 프로세스 인자는 배열 전달
- 삭제 기본값은 휴지통
- 의존성 추가 전 승인
