# Personal File Manager — Agent Instructions

매 턴 지켜야 하는 규칙만 압축한다. 배경과 근거는 `CLAUDE.md`, `docs/releases/v0.1/`,
`docs/releases/v0.1/improvements/CONTEXT.md`에 있다.

## 코드 경계

- Renderer는 `node:fs`를 직접 호출하지 않는다. 파일 시스템 접근은 preload와 typed IPC를 경유한다.
- `src/main/filesystem/*`는 `electron`을 import하지 않는다. `node:fs`, `node:path`만 사용한다.
  Electron 의존(`shell.trashItem` 등)은 `src/main/ipc/`에서 주입한다.
- 외부 프로세스 실행 시 인자를 배열로 전달한다. 문자열 조합 금지.
- 삭제 기본값은 휴지통(`shell.trashItem`)이다. 영구 삭제는 `Shift+Delete`에만 배정한다.
- 새 의존성 추가 전 기본 API로 가능한지 확인하고 사용자 승인을 받는다.

## 문서와 개선 항목

- v0.1 MVP는 태그 `v0.1`로 고정되었다. 현재 작업은 **v0.1 개선 루프**이며 작업 단위는 Phase가
  아니라 개선 항목이다. 새 문서 사이클을 만들지 않는다.
- 항목 기록은 `docs/releases/v0.1/improvements/LOG.md`에 `I{3자리}` 번호로 append 한다.
  판단 근거와 mdviewer 참조 기준, 후보 항목 목록은 같은 폴더의 `CONTEXT.md`에 있다.
- **개선 항목은 사용자가 지정한다.** 추측으로 순서를 정하거나 항목을 신설하지 않는다.
- 항목 상태는 `LOG.md`의 `- 상태:` 필드에서만 관리한다. `README.md`나 v0.1 기획·명세 문서에
  진행 상태를 기록하지 않는다.
- `docs/releases/v0.1/`의 기획·명세 문서와 `backlog.json`은 수정하지 않고 참조만 한다.
  `improvements/` 하위는 예외다.
- 파괴적 작업(Copy / Move / Delete)은 테스트 없이 완료로 처리하지 않는다.
- 다음을 건드리는 변경은 항목 크기와 무관하게 적대적 검증을 생략하지 않는다:
  `src/main/filesystem/*`, `src/main/ipc/*`, `src/preload/*`, 파괴적 작업 경로,
  외부 프로세스 실행 인자, IPC 계약(`src/shared/ipc.ts`). 그 외 순수 스타일·문구 변경은
  사유를 항목에 적고 생략할 수 있다.
- 사용자의 명시적 승인 후에만 `origin`에 푸시한다.
- 적대적 검증-수정 재실행은 최초 검증 포함 최대 3회까지만 자동으로 진행한다. 3회차 이후에도
  지적이 남으면 4회차를 자동으로 시작하지 않고 전체 이력과 잔여 위험을 사용자에게 보고한 뒤
  결정을 받는다.

## Codex 교차 적대적 검증

- Codex가 해당 항목의 마지막 실질 구현자이면, 적대적 검증은 Claude Sonnet headless CLI가 담당한다. Codex 서브에이전트에게 Codex 검토를 맡기지 않는다.
- Claude Code가 마지막 실질 구현자이면 기존 `CLAUDE.md`의 규칙에 따라 Codex CLI가 검토한다. 구현 주체는 토큰 한도에 따라 항목 중간에 바뀔 수 있으며, 검토자는 마지막 실질 구현자의 반대 벤더로 정한다.
- 자동 감지 코드나 별도 스킬은 만들지 않는다. 현재 구현 주체와 검토자 선택은 항목 보고 및 `improvements/LOG.md`의 해당 항목에 기록한다.
- Claude 검토는 지정한 제품 소스 파일, 해당 항목의 공격 지점, `docs/releases/v0.1/SPEC.md` 조항만 컨텍스트로 사용한다. 세션 대화, 구현 근거, Git 상태·이력, 문서(`CONTEXT.md`와 `LOG.md` 포함), 설정, 테스트 산출물, 셸 도구 사용은 허용하지 않는다.
- 각 지적은 `Critical / Major / Minor` 등급, 정확한 재현 조건, 위반한 SPEC 조항 번호를 포함해 심각도순으로 반환해야 한다. Claude는 파일을 수정하지 않는다.
- Claude Sonnet 검토를 실행하는 외부 명령의 시간 제한은 기본 10분으로 설정한다.
- Claude 검토 결과의 Critical은 Codex가 수정하고 관련 검증을 다시 실행한다. 면제 불가 조건에 해당하는 항목에서 Claude를 사용할 수 없으면 사유와 대체 검증안을 사용자에게 제시하고 승인을 받기 전에는 검토를 생략하지 않는다.

Codex가 PowerShell에서 실행할 기본 명령은 다음과 같다. `<item>`, `<changed-files>`, `<adversarial-focus>`, `<spec-refs>`는 현재 작업 내용으로 대체한다. `<item>`에는 개선 항목 번호와 제목을 넣는다(예: `I001: focus and selection color separation`). 필요하면 `--max-budget-usd`로 호출별 비용 상한을 둔다.

```powershell
claude -p "You are an adversarial reviewer for <item>. Your job is to break this code, not to confirm it works. Review only these product source-code files: <changed-files>. Attack these specific points: <adversarial-focus>. Validate against these spec clauses: <spec-refs>. Do not inspect documentation, configuration, test artifacts, Git status, branches, remotes, commit history, or use Bash, PowerShell, or any shell tool. For each finding, report severity (Critical/Major/Minor), exact reproduction conditions, and the violated spec clause. Order findings by severity. Do not modify files." --model sonnet --safe-mode --allowedTools "Read,Glob,Grep" --disallowedTools "Edit,Write,Bash" --permission-mode dontAsk --max-turns 5 --output-format json --no-session-persistence
```
