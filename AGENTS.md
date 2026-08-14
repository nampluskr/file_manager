# Personal File Manager — Agent Instructions

매 턴 지켜야 하는 규칙만 압축한다. 배경과 근거는 `CLAUDE.md`와 `docs/releases/v0.1/`에 있다.

## 코드 경계

- Renderer는 `node:fs`를 직접 호출하지 않는다. 파일 시스템 접근은 preload와 typed IPC를 경유한다.
- `src/main/filesystem/*`는 `electron`을 import하지 않는다. `node:fs`, `node:path`만 사용한다.
  Electron 의존(`shell.trashItem` 등)은 `src/main/ipc/`에서 주입한다.
- 외부 프로세스 실행 시 인자를 배열로 전달한다. 문자열 조합 금지.
- 삭제 기본값은 휴지통(`shell.trashItem`)이다. 영구 삭제는 `Shift+Delete`에만 배정한다.
- 새 의존성 추가 전 기본 API로 가능한지 확인하고 사용자 승인을 받는다.

## 문서와 Phase

- Phase 순서와 범위는 `docs/releases/v0.1/backlog.json`과 `PLAN.md`를 따른다.
- Phase 상태는 `backlog.json`의 `status` 필드에서만 관리한다.
- 파괴적 작업(Copy / Move / Delete)은 테스트 없이 완료로 처리하지 않는다.
- `phase-02`, `phase-04`, `phase-07`은 적대적 검증 필수 통과 Phase다.
- 사용자의 명시적 승인 후에만 `origin`에 푸시한다.

## Codex 교차 적대적 검증

- Codex가 해당 Phase의 마지막 실질 구현자이면, 적대적 검증은 Claude Sonnet headless CLI가 담당한다. Codex 서브에이전트에게 Codex 검토를 맡기지 않는다.
- Claude Code가 마지막 실질 구현자이면 기존 `CLAUDE.md`의 규칙에 따라 Codex CLI가 검토한다. 구현 주체는 토큰 한도에 따라 Phase 중간에 바뀔 수 있으며, 검토자는 마지막 실질 구현자의 반대 벤더로 정한다.
- 자동 감지 코드나 별도 스킬은 만들지 않는다. 현재 구현 주체와 검토자 선택은 Phase 보고 및 `reviews/A{n}.md`에 기록한다.
- Claude 검토는 지정한 제품 소스 파일, 해당 Phase의 `adversarialFocus`, `specRefs`만 컨텍스트로 사용한다. 세션 대화, 구현 근거, Git 상태·이력, 문서, 설정, 테스트 산출물, 셸 도구 사용은 허용하지 않는다.
- Codex가 Claude 검토를 실행할 때는 `claude -p`에 `--model sonnet --safe-mode --allowedTools "Read,Glob,Grep" --disallowedTools "Edit,Write,Bash" --permission-mode dontAsk --max-turns 5 --output-format json --no-session-persistence`를 사용한다. 필요하면 `--max-budget-usd`로 호출별 비용 상한을 둔다.
- Claude 검토 결과의 Critical은 Codex가 수정하고 관련 검증을 다시 실행한다. 필수 Phase에서 Claude를 사용할 수 없으면 사유와 대체 검증안을 사용자에게 제시하고 승인을 받기 전에는 검토를 생략하지 않는다.
