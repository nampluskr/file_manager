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
- `phase-02`, `phase-04`, `phase-07`은 Codex sol 적대적 검증 필수 통과 Phase다.
- 사용자의 명시적 승인 후에만 `origin`에 푸시한다.
