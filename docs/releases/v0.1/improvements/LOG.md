# v0.1 이후 개별 개선 기록

v0.1 MVP를 태그 `v0.1`로 고정한 뒤, 사용자가 실제로 사용하며 발견한 디자인·사용편이성·필수 기능
개선 사항을 한 건씩 순차적으로 처리하기 위한 로그이다.

`../BRIEF.md`, `../TECH_GUIDE.md`, `../PRD.md`, `../SPEC.md`, `../PLAN.md`, `../backlog.json`,
`../reviews/`는 태그로 고정된 v0.1 산출물이다. **이 로그 작업으로 수정하지 않는다.** 참조만 한다.

판단 근거와 mdviewer 참조 기준은 `CONTEXT.md`에 있다. 후보 항목 목록도 그 문서 §5에 있다.

## 진행 원칙

- **개선 항목은 사용자가 지정한다.** 에이전트가 추측으로 순서를 정하지 않는다.
- 항목 상태는 이 파일의 `- 상태:` 필드에서만 관리한다. `README.md`나 v0.1 문서에 적지 않는다.
- 이 단계는 v0.1 범위 안의 완성도 작업이다. 새 기능 영역은 v0.2로 미룬다
  (범위는 `../BRIEF.md` §11과 `../PRD.md` Non-Goals).
- `v0.1` 태그는 이동하지 않는다.

## 항목 처리 순서

1. 사용자 요청 접수
2. 에이전트가 수정 구현
3. 적대적 검증 실행 (아래 검증 규칙). Critical 지적은 수정 후 동일 벤더로 재검증하며,
   재실행 포함 최대 3회로 제한한다
4. 사용자 재확인 및 피드백
5. 사용자 확정 시 항목 단위로 커밋 승인 요청

## 검증 규칙

교차 벤더 적대적 검증을 적용한다. 마지막 실질 구현자가 Claude Code면 Codex CLI가, Codex면
Claude Sonnet headless CLI가 검토한다. 상세는 `../../../../CLAUDE.md`와 `AGENTS.md`에 있다.

검증 결과는 별도 파일을 만들지 않고 **각 항목 안에 인라인 표로 기록한다.**
`../reviews/A{n}.md`는 v0.1 Phase 배치 검증 전용이며 이 로그의 항목과 무관하다.

**검증 면제 불가 조건.** 다음을 건드리는 변경은 항목 크기와 무관하게 항상 검증한다.

- `src/main/filesystem/*`, `src/main/ipc/*`, `src/preload/*`
- 파괴적 작업 경로 (Copy / Move / Delete)
- 외부 프로세스 실행 인자
- IPC 계약 (`src/shared/ipc.ts`)

그 외 순수 스타일·문구 변경은 사유를 적고 검증을 생략할 수 있다. 생략한 경우 그 사실과 사유를
항목에 남긴다.

## 항목 기록 형식

```
## I{n}. <한 줄 제목>

- 요청 일시 / 요청자:
- 요청 내용:
- 원인 분석 (선택):
- 변경 내용 (구현자):
- 커밋:
- 적대적 검증
  | 회차 | 검토자 | 결과 요약 |
  |---|---|---|

  | 심각도 | 건수 | 처리 상태 | 근거 |
  |---|---|---|---|
- Critical 수정 및 재검증 (해당 시):
- 남은 위험 (선택):
- 사용자 확인/피드백:
- 상태: 확정 / 보류 / 재작업 필요
```

- 항목 번호는 `I` + 3자리(`I001`)로 매긴다.
- 한 항목이 해결되지 않으면 `- 상태: 재작업 필요 (아래 I0{n}으로 처리)`로 다음 항목에 연결한다.
- 같은 항목 안의 후속 요청은 `### 추가 반영` 하위 섹션으로 덧붙인다.
- 검증을 생략한 경우 `적대적 검증` 자리에 생략 사유를 적는다.

---

<!-- 개선 항목은 여기부터 append 한다. 사용자가 I001을 지정하면 시작한다. -->

## I001. 패널 내부 스크롤 분리 (통째 스크롤 버그)

- 요청 일시 / 요청자: 2026-08-16 / 사용자
- 요청 내용:
  1. 파일 매니저 실행 후 스크롤하면 패널1/패널2가 통째로 스크롤된다. 개별 목록 영역만 스크롤되어야 한다.
  2. 상단 드라이브바/경로/이름·확장자·크기·날짜 헤더는 고정되고, 좌/우 파일 목록 부분만 내부적으로 스크롤되어야 하는데 전체가 함께 스크롤된다.
  3. 스크롤 시 하단 F2~F8 함수키 바가 목록과 함께 밀려 이동한다.
- 원인 분석: `src/renderer/src/styles.css`의 `.file-pane-layout`은 CSS Grid이고 `.file-pane`이 그 grid item이다. `.file-pane`에 `min-height`를 지정하지 않아 grid item 기본값인 `min-height: auto`가 적용되었고, 내부 파일 목록 전체 높이만큼 `.file-pane`이 늘어났다. 그 결과 `.file-list`의 `overflow-y: auto`가 무력화되고 `.file-pane` → `.file-pane-layout` → `body`가 콘텐츠 높이만큼 커져 페이지 전체(헤더, F2~F8 바 포함)가 함께 스크롤되었다.
- 변경 내용 (구현자): `.file-pane` 규칙에 `min-height: 0;` 한 줄 추가. 다른 파일은 수정하지 않음.
- 검증 명령: `npm run typecheck` 통과, `npm test` 통과 (139 tests).
- 적대적 검증: 생략. 순수 스타일 변경(`src/renderer/src/styles.css` 한 줄)이며 검증 면제 불가 조건(`src/main/filesystem/*`, `src/main/ipc/*`, `src/preload/*`, 파괴적 작업 경로, 외부 프로세스 실행 인자, IPC 계약)에 해당하지 않음.
- 화면 확인: 에이전트가 백그라운드 job 환경(인터랙티브 데스크톱 세션 없음)에서 `npm run dev`로 Electron 창을 띄우려 했으나 렌더러/프리로드 빌드까지는 성공해도 실제 GUI 창이 뜨지 않아 Dark/Light 테마 시각 확인을 완료하지 못함. 사용자가 `npm run package:win`으로 포터블 빌드를 직접 실행해 확인함.
- 커밋: 4bf9ae9
- 남은 위험: 없음 (스타일 변경 1줄, 로직/IPC/파일시스템 영향 없음).
- 사용자 확인/피드백: 사용자가 빌드하여 이상 없이 정상 작동함을 확인함 (2026-08-16).
- 상태: 확정

## I002. Alt+F1/Alt+F2 드라이브 선택을 Ctrl+O 네이티브 폴더 선택으로 대체

- 요청 일시 / 요청자: 2026-08-16 / 사용자
- 요청 내용: Alt+F1 / Alt+F2로 왼쪽/오른쪽 패널에서 드라이브(디렉토리) 선택이 작동하지 않는다.
- 원인 분석: `docs/releases/v0.1/SPEC.md`(§3.2, §4.7, §16)에 확정된 드라이브 선택 단축키는 Alt+F1(좌)/Alt+F2(우)이며, Alt+1/Alt+2 매핑은 문서에 없다. 사용자 확인 결과 Alt+F1을 누르면 Windows(또는 노트북 드라이버) 스크린샷 기능이 열려, 키 입력이 앱에 도달하기 전에 OS 레벨에서 가로채이는 것으로 확인됨. 렌더러 키 처리 로직의 결함이 아니라 사용자 PC의 OS/드라이버 단축키 충돌이며, 렌더러 수정으로는 해결 불가.
- 처리 방향: 사용자가 다른 키 조합으로 변경하기로 결정. 이후 대안으로 "패널을 선택하고 Ctrl+O로 해당 패널에서만 폴더를 지정"하는 방식을 제안, Alt+F1/F2 드라이브 목록 오버레이 기능을 완전히 대체하기로 확정.
- 변경 내용 (구현자):
  - Alt+F1/F2로 열리던 드라이브 목록 오버레이(드라이브 루트로만 이동 가능)를 제거하고, Ctrl+O로 네이티브 OS 폴더 선택 대화상자를 열어 임의의 폴더로 바로 이동하는 기능으로 대체. 활성 패널에만 적용되며 다른 패널에는 영향 없음.
  - `src/shared/ipc.ts`: `sys:listDrives` 채널 제거, `sys:selectFolder` 채널 추가.
  - `src/main/ipc/index.ts`: `sys:selectFolder` 핸들러 추가 (`dialog.showOpenDialog`, `BrowserWindow.fromWebContents`로 부모 창 지정, `openDirectory` 속성). `sys:listDrives` 핸들러 제거.
  - `src/main/system/drives.ts`: 더 이상 쓰이지 않는 `listDrives()`/`DRIVE_LETTERS` 제거. 개별 드라이브 용량 조회용 `driveUsage()`(DriveBar 표시용)는 그대로 유지.
  - `src/preload/index.ts`, `src/shared/preload.d.ts`: `listDrives` 바인딩 제거, `selectFolder` 바인딩 추가.
  - `src/renderer/src/App.tsx`: 이제 쓰이지 않는 `drives` 상태·`listDrives()` 호출·`DriveInfo` import 제거.
  - `src/renderer/src/components/FilePane/FilePane.tsx`: `DRIVE_MENU_KEY`, 드라이브 메뉴 캡처 단계 키 리스너, 드라이브 메뉴 오버레이 JSX 제거. `Ctrl+O` 핸들러 추가 — `window.fileManager.selectFolder(state.currentPath)` 호출 후 결과가 있으면 `goToPath()`로 이동.
  - `src/main/index.ts`: `UV_THREADPOOL_SIZE` 관련 주석을 "24개 드라이브 동시 프로브" 근거에서 "driveUsage 단건 프로브" 근거로 갱신 (listDrives 제거로 주석이 실측과 어긋나게 되어 수정, 설정값 자체는 변경 없음).
  - `docs/releases/v0.1/SPEC.md`는 v0.1 동결 문서라 수정하지 않음. §3.2/§4.7/§16의 Alt+F1/F2 매핑은 문서상 그대로 남아 있으나 현재 구현과는 다르다는 점을 이 항목에 기록해 둔다.
- 검증 명령: `npm run typecheck` 통과, `npm test` 통과 (139 tests) — 1차/2차 수정 후 모두 재확인.
- 적대적 검증 (필수 — `src/main/ipc/*`, `src/preload/*`, IPC 계약 변경)

  | 회차 | 검토자 | 결과 요약 |
  |---|---|---|
  | 1 | Codex (gpt-5.6-sol), 2026-08-16 | Critical 0건. Major 2건, Minor 1건 |
  | 2 (재검증) | Codex (gpt-5.6-sol), 2026-08-16 | 1차 지적 3건 모두 RESOLVED 확인. 신규 지적 없음 |

  | 심각도 | 건수 | 처리 상태 | 근거 |
  |---|---|---|---|
  | Major | 1 | 수정 | `sys:selectFolder`의 `defaultPath`가 `resolve()` 정규화 없이 전달됨 (SPEC §12.3). `safeDefaultPath()` 헬퍼 추가로 `assertAbsolutePath()`와 동일하게 `resolve()` 정규화 후 사용, 실패 시 힌트 없이 진행 |
  | Major | 1 | 수정 | Ctrl+O 연타 시 두 개의 `dialog.showOpenDialog()` 호출이 경쟁해 나중에 resolve된 것이 먼저 선택한 결과를 덮어씀 (SPEC §16.7). `folderPickerOpenRef`로 진행 중 재요청을 무시하도록 가드 추가 |
  | Minor | 1 | 수정 | Ctrl+Shift+O / Ctrl+Alt+O도 폴더 선택을 열어버림 (SPEC §16 키 매핑 원칙 위반). 조건에 `!event.shiftKey && !event.altKey` 추가 |
- Critical 수정 및 재검증: 해당 없음 (Critical 지적 없음). Major 2건, Minor 1건은 위와 같이 모두 수정 후 2차 재검증에서 해소 확인.
- 남은 위험: 없음. 네이티브 폴더 선택 대화상자가 반환한 경로는 이후 `goToPath()` → `fs:listDirectory`로 이어지며, 그 경로에서도 `assertAbsolutePath()`(Main)로 재검증됨.
- 확인 과정에서 발생한 오진 1건 (코드 결함 아님): 사용자가 "Ctrl+O가 동작하지 않는다"고 보고했으나 원인은 구버전 바이너리 실행이었다. `npm run package:win`은 `npm run build`(→ `out/` 갱신) 후 electron-builder를 실행하는데, electron-builder가 `release\win-unpacked` 삭제 단계에서 `EBUSY`로 실패해도 앞단계 빌드는 이미 성공한 뒤다. 그 결과 `out/`만 새 코드로 갱신되고 `app.asar`과 portable exe는 이전 빌드 그대로 남아, 실행 중인 앱에는 I002 코드가 들어있지 않았다. `app.asar`에 구 채널 `sys:listDrives`가 남아 있고 `sys:selectFolder`가 없는 것으로 확정.
  - `EBUSY`의 원인은 `SPEC.md` §19.1의 의도된 동작이다. 창을 닫아도 종료되지 않고 트레이로 숨으므로, 사용자가 창을 닫은 뒤에도 `release\win-unpacked\Personal File Manager.exe` 프로세스가 살아남아 electron-builder가 지워야 할 폴더를 잠근다.
  - 대응: 패키징 전에 트레이 아이콘의 Quit으로 앱을 완전히 종료한다. 확인용 명령은 `Get-Process "Personal File Manager" -ErrorAction SilentlyContinue | Stop-Process -Force`. 빌드 후 exe 타임스탬프가 갱신됐는지 확인하면 이 실패 모드를 조기에 잡을 수 있다.
- 사용자 확인/피드백: 프로세스 종료 후 재패키징한 빌드에서 Ctrl+O 폴더 선택이 제대로 작동함을 사용자가 확인함 (2026-08-16).
- 상태: 확정

## I003. mdviewer 탐색기 스타일 적용

- 요청 일시 / 요청자: 2026-08-17 / 사용자
- 요청 내용: mdviewer의 UI 탐색기 스타일을 file_manager에 적용해 달라는 요청. `CONTEXT.md` §4는 "색 토큰까지 전면 통일한다"는 방향을 이미 확정해 두었으나, §4.3은 mdviewer에 없는 두 개념(Active Pane 구분, 포커스/Selection 3상태 분리)의 파생값을 착수 시 사용자에게 확인하도록 명시. 착수 전 AskUserQuestion으로 4개 판단 지점을 확인함:
  1. 포커스 없이 선택만 된 행의 배경 → `surface-hover` 계열로 표시
  2. Active Pane 강조색 → mdviewer의 `link`/`focus` 토큰 값 재사용 (두 토큰이 mdviewer에서 항상 동일 값)
  3. 테마 단계 → 2단계(dark/light)에서 mdviewer와 동일한 3단계(light/dark/dim)로 확장
  4. 모서리 → mdviewer와 동일하게 `border-radius: 4px` 도입 (버튼·스크롤바 한정)
- 변경 내용 (구현자):
  - `src/renderer/src/styles.css`: `:root[data-theme='dark'|'light']` 토큰 값을 mdviewer(`d:\projects\tools\mdviewer\src\renderer\src\styles.css`)의 GitHub 팔레트로 전면 교체하고 `:root[data-theme='dim']` 블록을 신설. 신규 토큰 2개 추가 — `--focused-text`(포커스 행 글자색, 강한 배경 위 대비 확보), `--scrollbar-thumb-hover`. `--scrollbar-thumb`은 새 토큰을 만들지 않고 기존 `--border`를 재사용(mdviewer도 light 테마에서 동일하게 재사용하며 dark/dim 실측값도 border와 일치).
  - `.file-row-selected`(다중 선택, 포커스 없음)에 배경(`--selected-item`)을 추가 — 기존에는 글자색만 바뀌고 배경이 없던 결함(`CONTEXT.md` §3.2)을 함께 해소. `.file-row-focused`(커서 행)는 `--focused-item` 배경 + `--focused-text` 글자색으로 강화. 두 클래스가 동시에 적용되는 행(다중 선택 위에 커서가 있는 경우)은 `.file-row-focused.file-row-selected` 결합 셀렉터로 focused가 이기도록 명시.
  - `.favorites-dialog button.favorites-focused`에도 동일하게 `color: var(--focused-text)` 추가.
  - `.file-list`에 mdviewer 방식의 얇은 스크롤바(`scrollbar-width: thin`, 8px webkit thumb, `border-radius: 4px`, hover 시 `--scrollbar-thumb-hover`) 추가. 다른 스크롤 영역(다이얼로그, 뷰어)은 범위 밖으로 제외.
  - 버튼류(`.favorites-dialog button`, `.op-dialog-buttons button`/`.op-dialog input`, `.command-launcher button`, `.viewer-header button`, `.editor-header button`)에 `border-radius: 4px` 추가. 목록 행·다이얼로그 박스·패널 경계는 각진 형태 유지(mdviewer 자신도 이 요소들에는 radius를 쓰지 않음).
  - `body`의 UI 폰트 스택에 한글 폴백 추가: `'Segoe UI', 'Malgun Gothic', sans-serif` (`CONTEXT.md` §5.2 후보, 이번에 함께 처리).
  - `src/shared/types.ts`(`AppState.theme`, `Settings.theme`), `src/main/config/settings.ts`(검증 조건)에 `'dim'` 값 추가. `src/renderer/src/App.tsx`의 `Ctrl+Shift+D` 토글을 dark → light → dim → dark 순환으로 변경.
  - 구조는 바꾸지 않음: grid 컬럼형 목록, 가상 스크롤, `px` 단위, `Cascadia Code` 모노스페이스 스택 유지. `rem` 전환·monospace 스택 통일은 범위 밖(별도 후보로 남김).
- SPEC.md 대비 편차 (문서는 수정하지 않고 이 항목에만 기록, I002와 동일한 처리 방식):
  - §14.3 토큰 목록에 없는 `--focused-text`, `--scrollbar-thumb-hover` 신규 추가
  - §14.3 "Dark가 기본이며 Light를 제공" → 3단계(dim 추가)로 확장, 기본값은 dark 유지
  - §14.1 "장식을 최소화" 원칙과 절충해 버튼·스크롤바에 한해 `border-radius: 4px` 도입
- 검증 명령: `npm run typecheck` 통과, `npm test` 통과 (139 tests, 21 test files).
- 화면 확인: 이 세션의 Bash 도구 환경에서 `npm run dev`(및 `electron .` 직접 실행)로 Electron 창을 띄우려 했으나 I001과 동일한 사유(인터랙티브 데스크톱 세션 없음)로 GUI 창이 뜨지 않고 프로세스가 조용히 종료됨 (`electron.exe` 프로세스 자체가 생성되지 않음, `tasklist` 확인). Dark/Light/Dim 3개 테마의 실제 화면 확인을 에이전트가 완료하지 못함. 사용자가 `npm run dev` 또는 `npm run package:win`으로 직접 확인 필요. (재패키징 시 I002 기록의 트레이 EBUSY/구버전 바이너리 함정 주의 — 패키징 전 트레이에서 Quit으로 완전 종료할 것.)
- 적대적 검증: `src/main/filesystem/*`, `src/main/ipc/*`, `src/preload/*`, 파괴적 작업 경로, 외부 프로세스 실행 인자, `src/shared/ipc.ts`를 건드리지 않음 (순수 스타일 변경 + `src/shared/types.ts`의 테마 enum 확장 + 설정 검증 로직 1줄). 검증 면제 불가 조건에 해당하지 않아 생략을 제안했고, 사용자가 생략을 확정함 (2026-08-17).
- 빌드: 패키징 전 `release\win-unpacked`에 남아 있던 이전 빌드의 트레이 프로세스 4개(`Personal File Manager.exe`)를 `Stop-Process`로 완전 종료한 뒤 `npm run package:win` 실행 — I002 기록의 EBUSY/구버전 바이너리 함정을 피하기 위함. `release\Personal File Manager-0.1.0-Portable.exe` 생성 확인 (수정 시각 2026-08-17 01:22, 빌드 로그에 EBUSY 없이 정상 완료).
- 남은 위험: 시각적 검증이 아직 사용자 확인을 거치지 않음. 코드 검토상 대비(contrast) 계산은 mdviewer 원본 값을 그대로 재사용했으므로 가독성 문제 가능성은 낮으나 실측 확인 전까지 단정할 수 없음.
- 커밋: 98896a0

### 추가 반영

- 요청 일시 / 요청자: 2026-08-17 / 사용자
- 요청 내용: mdviewer UI의 글꼴 / 크기 / 줄간격 / 글꼴 색깔(그레이 계열) 모두 적용.
- 변경 내용 (구현자):
  - `body` 폰트 스택에 mdviewer의 1순위 폰트 `'Segoe UI Variable'` 추가 (`'Segoe UI Variable', 'Segoe UI', 'Malgun Gothic', sans-serif`). 폰트 크기(`13px` = mdviewer `.8125rem`)는 직전 반영에서 이미 일치해 변경 없음.
  - **파일 목록 기본 글자색을 그레이 계열로 전환** — mdviewer의 `.explorer-file`/`.explorer-directory`가 기본 상태에서 `muted-text`(회색)이고 hover/선택 시에만 `text`(고대비)로 바뀌는 패턴을 그대로 이식. `.file-row`(파일)와 `.file-row-directory`(디렉터리, 굵게)의 기본 색을 `--text-primary`에서 `--text-secondary`로 변경. `.file-row-selected`(→ `--text-primary`)와 `.file-row-focused`(→ `--focused-text`)는 이미 강한 색으로 오버라이드하고 있어 선택/포커스 시에만 밝아지는 대비 효과가 자연스럽게 생김.
  - `.path-bar`에 `color: var(--text-secondary)` 추가 — mdviewer의 `.current-directory`(경로 표시)가 muted-text인 것과 동일하게 맞춤. 기존에는 색 지정이 없어 `body`의 `--text-primary`를 그대로 물려받고 있었음.
  - 줄간격(line-height) 추가: `.file-row`/`.file-list-header` `1.2`(mdviewer `.explorer-file`/`.explorer-directory`와 동일), `.op-dialog-body` `1.4`(mdviewer `.markdown-content p/li`와 동일), `.viewer-content pre`/`.editor-textarea` `1.5`(mdviewer `pre`/코드 뷰어와 동일). `.file-row`는 `height: 22px` 고정 grid 행이라 `align-items: center`로 이미 수직 정렬되므로 시각적 위치는 바뀌지 않고, 줄바꿈이 있는 텍스트 영역(다이얼로그 본문, 뷰어, 에디터)에서 가독성 차이가 생김.
  - 폰트 패밀리는 UI(`Segoe UI Variable`)와 모노스페이스(`Cascadia Code`, 직전 반영에서 유지 결정)만 다루고, mdviewer에는 있는 `document-content`용 콘텐츠 폰트 스케일(`--content-font-scale`) 같은 뷰어 전용 타이포그래피 기능은 이번 범위에 없어 이식하지 않음(뷰어는 file_manager에서 별도 후보로 남은 항목).
- 검증 명령: `npm run typecheck` 통과, `npm test` 통과 (139 tests, 21 test files).
- 적대적 검증: 순수 스타일(색·타이포그래피) 변경이며 검증 면제 불가 조건(`src/main/filesystem/*`, `src/main/ipc/*`, `src/preload/*`, 파괴적 작업 경로, 외부 프로세스 실행 인자, `src/shared/ipc.ts`)에 해당하지 않음. 직전 반영과 동일하게 사용자 승인으로 생략.
- 빌드: 트레이 프로세스 재확인(없음) 후 `npm run package:win` 재실행. `release\Personal File Manager-0.1.0-Portable.exe` 갱신 확인 (수정 시각 2026-08-17 01:31).
- 커밋: 813d158

### 추가 반영 2

- 요청 일시 / 요청자: 2026-08-17 / 사용자
- 요청 내용: 탐색기 패널에 폴더 아이콘이 안 보인다.
- 원인 분석: 회귀가 아니라 v0.1 원래 설계의 공백이었음. `src/main/system/icons.ts`의 `getFileIcon`은 SPEC.md §17/§656(`sys:fileIcon(ext)`)에 따라 **확장자 단위**로만 OS 아이콘을 조회·캐싱하며, 폴더용 아이콘 조회 경로 자체가 없다. `FileRow.tsx`도 `{!isDirectory && iconUrl ? <img .../> : null}`로 디렉터리는 항상 아이콘 칸을 비워두고 굵은 글자(`font-weight: 600`)로만 구분했다 — v0.1 내내 그랬다. mdviewer의 `App.tsx` `EntryIcon`은 파일뿐 아니라 폴더도 인라인 SVG 글리프(`stroke="currentColor"`)로 표시하는데, 이번 I003의 "탐색기 스타일 적용"을 사용자가 이 정도까지 포함하는 것으로 요청해 반영함.
- 변경 내용 (구현자): `src/renderer/src/components/FileRow/FileRow.tsx`에 mdviewer의 `EntryIcon`(디렉터리 분기) 경로 데이터를 그대로 가져온 `FolderIcon` 컴포넌트를 추가하고, 아이콘 칸 렌더링을 `isDirectory ? <FolderIcon /> : iconUrl ? <img .../> : null`로 변경. `stroke="currentColor"`라 별도 색 토큰 없이 행의 현재 글자색(기본 회색 → 선택/포커스 시 강조색)을 그대로 따라간다. IPC(`sys:fileIcon`), 캐싱 로직, `FileList.tsx`의 아이콘 조회 스킵 조건(`!entry.isDirectory && !entry.isParent`)은 그대로 둠 — 폴더는 여전히 OS 아이콘을 조회하지 않고 SVG로만 표시.
- 검증 명령: `npm run typecheck` 통과, `npm test` 통과 (139 tests, 21 test files).
- 적대적 검증: 렌더러 컴포넌트 내 순수 표시 로직 변경(SVG 추가)이며 검증 면제 불가 조건(`src/main/filesystem/*`, `src/main/ipc/*`, `src/preload/*`, 파괴적 작업 경로, 외부 프로세스 실행 인자, `src/shared/ipc.ts`)에 해당하지 않음. 앞선 두 반영과 동일하게 사용자 승인으로 생략.
- 빌드: 트레이 프로세스 재확인(없음) 후 `npm run package:win` 재실행. `release\Personal File Manager-0.1.0-Portable.exe` 갱신 확인 (수정 시각 2026-08-17 01:39).
- 커밋: 4d2813c

### 추가 반영 3

- 요청 일시 / 요청자: 2026-08-17 / 사용자
- 요청 내용: "추가 반영 2"의 SVG 폴더 아이콘 대신, 다른 파일 아이콘처럼 Windows 내장 폴더 아이콘을 쓸 수 없는지 문의 → 사용자가 진행 확정.
- 변경 내용 (구현자): SVG 폴더 아이콘을 제거하고, 파일 아이콘과 동일한 방식(OS 셸 아이콘, `app.getFileIcon`)으로 폴더 아이콘을 조회하도록 전환.
  - `src/shared/ipc.ts`: `'sys:folderIcon': () => string` 채널 추가 (인자 없음, 모든 폴더가 동일한 셸 아이콘 하나를 공유).
  - `src/main/system/icons.ts`: `getFolderIconDataUrl()` 추가. 확장자별 프로브 *파일*이 아니라, 이미 만들어져 있는 프로브 *디렉터리*(`probeDir()`) 자체에 `app.getFileIcon(dir, { size: 'small' })`를 호출해 Windows 탐색기가 쓰는 폴더 아이콘을 그대로 가져온다. 확장자 캐시(Map)에 NUL 바이트로 시작하는 예약 키(`'\0folder'`)로 저장 — `getFileIconDataUrl`이 쓰는 키는 실제 파일 확장자(NUL을 포함할 수 없음)뿐이라 충돌 불가능.
  - `src/main/ipc/index.ts`: `sys:folderIcon` 핸들러 추가 (인자 없어 별도 검증 불필요).
  - `src/preload/index.ts`, `src/shared/preload.d.ts`: `folderIcon()` 바인딩 추가.
  - `src/renderer/src/state/iconCache.ts`: `getCachedFolderIcon()`/`ensureFolderIconLoaded()` 추가. 렌더러 쪽도 동일하게 NUL 바이트 예약 키(`'\0dir'`)로 별도 캐시 슬롯 사용, 앱 실행 중 단 1회만 IPC 호출.
  - `src/renderer/src/components/FileList/FileList.tsx`: 디렉터리 행은 확장자 캐시 대신 폴더 아이콘 캐시를 조회하도록 분기 (`[..]`도 `isDirectory: true`라 동일 경로를 탄다).
  - `src/renderer/src/components/FileRow/FileRow.tsx`: "추가 반영 2"에서 추가한 `FolderIcon` SVG 컴포넌트를 제거하고, 파일과 동일하게 `iconUrl`이 있으면 `<img>`로 렌더링 (아이콘 도착 전까지는 파일과 마찬가지로 빈 칸).
- 검증 명령: `npm run typecheck` 통과, `npm test` 통과 (139 tests, 21 test files).
- 적대적 검증 (필수 — `src/shared/ipc.ts` IPC 계약, `src/main/ipc/*`, `src/preload/*` 변경)

  | 회차 | 검토자 | 결과 요약 |
  |---|---|---|
  | 1 | Codex (gpt-5.6-sol), 2026-08-17 | Critical 0건, Major 0건, Minor 0건. 5개 공격 지점(IPC 계약 일관성, 예약 키 충돌 안전성, probeDir 재사용 경합, 에러 처리, FileList/FileRow 분기) 모두 이상 없음 확인 |

  | 심각도 | 건수 | 처리 상태 | 근거 |
  |---|---|---|---|
  | (해당 없음) | 0 | - | 지적사항 없음 |
- Critical 수정 및 재검증: 해당 없음 (Critical 지적 없음, 재검증 불필요).
- 남은 위험: Codex가 "위반은 아니나 참고"로 언급한 사항 — 최초 폴더 아이콘 조회가 실패하면 그 세션 동안 계속 빈 칸으로 남는다(`null`을 영구 캐시). 기존 확장자별 파일 아이콘과 동일한 정책이며 SPEC.md §10.5(확장자당 1회 조회, 재시도 없음)와 일치하므로 결함이 아님.
- 커밋: (진행 중)
- 빌드: (진행 중)
- 사용자 확인/피드백: (대기)
- 상태: 재작업 필요 (사용자 화면 확인 대기)
