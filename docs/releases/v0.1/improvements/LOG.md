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
