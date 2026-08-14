# Personal File Manager Agent Instructions

Claude Code가 이 저장소에서 작업할 때 매 턴 지켜야 하는 규칙이다.
배경 설명과 근거는 `docs/releases/v0.1/`의 문서에 있다. 이 파일에는 규칙만 둔다.

## General Rules

- 이모지를 사용하지 않는다.
- 제품 코드는 TypeScript로 구현한다. Electron main/preload와 React renderer를 포함한 애플리케이션 기능에 Python을 사용하지 않는다.
- Python은 테스트 데이터 생성, 검증 자동화 등 제품 기능과 분리된 보조 개발 도구에만 선택적으로 사용한다.
- Python 보조 작업에는 `C:\winpython\WPy64-31180\python-3.11.8.amd64\python.exe` 인터프리터를 사용한다.
- Python 코드의 경로 표기는 `os.path` 방식을 사용하며 `Path`를 사용하지 않는다.
- 코드 내 주석은 영어로 작성한다.
- 사용자의 명시적인 요청 없이 코드나 문서를 생성하지 않는다.
- Markdown 문서는 한국어로 작성한다. 다만 코드, 명령어, 파일 경로, 제품·라이브러리의 고유 이름은 원문 표기를 유지한다.
- 대상 OS는 Windows다. 셸은 PowerShell을 우선 사용한다.

## Project Rules

이 프로젝트에서 위반 시 되돌려야 하는 규칙이다. 근거는 `docs/releases/v0.1/TECH_GUIDE.md`와 `SPEC.md`에 있다.

- Renderer에서 `node:fs`를 직접 호출하지 않는다. 파일 시스템 접근은 preload와 typed IPC를 경유한다.
- `src/main/filesystem/*`에서 `electron`을 import하지 않는다. `node:fs`, `node:path`만 사용한다. Electron 의존은 `src/main/ipc/` 층에서 주입한다. 이 경계가 무너지면 가장 위험한 코드가 Vitest로 테스트 불가능해진다.
- 외부 프로세스 실행 시 인자를 **배열로** 전달한다. 문자열 조합을 금지한다. 폴더명에 `&`, `^`가 있을 때 명령 주입이 발생한다.
- 삭제의 기본값은 휴지통(`shell.trashItem`)이다. 영구 삭제는 `Shift+Delete`에만 배정하고 별도 확인을 거친다.
- 새 의존성을 추가하기 전에 기본 API로 구현 가능한지 확인하고, 사용자 승인을 받는다.
- 파괴적 작업(Copy / Move / Delete)은 테스트 없이 완료로 처리하지 않는다.
- v0.1 범위를 넘는 기능을 임의로 구현하지 않는다. 범위는 `PRD.md` §5 Non-Goals에 있다.
- 문서에 확정된 키 매핑(`SPEC.md` §16)과 기술 선택(`TECH_GUIDE.md` §2)을 임의로 변경하지 않는다.
- 성능 최적화는 `SPEC.md` §10에 명시된 것만 선제 적용하고, 나머지는 측정 후 수행한다.
- 불필요한 추상화 계층을 추가하지 않는다.

## Document Rules

- 문서 역할: `BRIEF.md`(무엇을·왜) → `TECH_GUIDE.md`(어떤 기술로) → `PRD.md`(요구사항 표) → `SPEC.md`(상세 기술) → `PLAN.md`(Phase) → `backlog.json`(작업 단위).
- 릴리스 문서는 `docs/releases/v{major}.{minor}/`에 둔다.
- 사용자 요청으로 구현 또는 프로젝트 내용이 변경되면 영향받는 문서를 반드시 `BRIEF.md → PRD.md → SPEC.md → PLAN.md → backlog.json` 순서로 갱신한다.
- Phase 완료 여부는 `backlog.json`의 각 Phase `status` 필드에서만 관리한다. `README.md`, `BRIEF.md`, `PRD.md`, `SPEC.md`, `PLAN.md`에는 현재 또는 완료된 Phase 상태를 기록하지 않는다.

## Phase Execution Workflow

`docs/releases/v0.1/backlog.json`과 `PLAN.md`의 Phase는 정의된 순서와 의존성을 지켜 진행한다.

각 Phase는 다음 순서로 완료한다.

1. 해당 Phase의 `scope`를 구현하고 `acceptanceCriteria`와 `selfVerification`을 검증한다.
2. Phase 변경을 커밋한다. 커밋 해시를 기록한다.
3. Codex sol 적대적 검증을 별도 서브 에이전트에 위임한다. 해당 Phase의 `adversarialFocus`와 `specRefs`를 프롬프트에 포함한다.
4. 지적사항을 검토한다. Critical은 전부 수정하고 관련 검증을 다시 실행한다. Major와 Minor는 처리 여부와 사유를 기록한다.
5. Critical 수정 후 **같은 적대적 검증을 재실행**해 해소를 확인한다.
6. 변경 내용, 검증 결과, 적대적 검증 결과와 보완 조치, 남은 위험을 사용자에게 보고하고 푸시 승인을 요청한다. 검증 결과는 지적사항별 심각도, 근거, 처리 상태를 포함한 Markdown 표로 제시한다.
7. 사용자의 명시적 승인을 받은 후에만 `origin`에 푸시한다.

**적대적 검증 재실행은 최초 검증을 포함해 최대 3회까지만 자동으로 진행한다** (2026-08-15 갱신).
EXDEV 폴백·overwrite·junction 방어처럼 상호작용이 많은 로직은 한 라운드의 수정이 인접한
지점에서 같은 계열의 새 지적을 유발하는 경우가 있다. 3회차 재검증 이후에도 Critical 또는
새 지적이 남아 있으면 4회차를 자동으로 시작하지 않는다. 대신 지금까지의 전체 라운드 이력
(`reviews/A{n}.md`, `A{n}-2.md`, `A{n}-3.md`)과 남은 위험을 사용자에게 보고하고, 다음 중
하나를 사용자가 결정하도록 확인받는다: 추가 라운드 진행, 구조적 한계로 판단되는 항목을
사유와 함께 보류, 또는 더 큰 리팩터링(예: 스트림 기반 엔진 재설계)의 별도 착수. 사용자
결정 없이 3회를 넘겨 자동으로 반복하지 않는다.

`phase-02`, `phase-04`, `phase-07`은 적대적 검증 **필수 통과** Phase다. 각각 명령 주입, 데이터 손상, 데이터 손실을 다루며 되돌릴 수 없다. Critical 지적이 남아 있으면 다음 Phase로 넘어가지 않는다.

Codex sol을 사용할 수 없는 환경이면 그 사실과 사유를 사용자에게 알리고, 대체 검증 방안을 제시한 뒤 승인을 요청한다. 필수 Phase에서 적대적 검증을 생략하지 않는다.

## Codex sol Adversarial Review Sub-agent

구현자는 Claude Code, 적대적 검증자는 Codex sol이다. 서로 다른 벤더의 모델로 분리한다.
같은 모델 계열 안에서 세션만 나누면 학습 편향과 코드 관용구를 공유해 "둘 다 같은 지점을 놓치는" 실패 모드가 남는다.

- 메인 에이전트는 Phase 구현과 커밋을 끝낸 뒤, Codex 검증만 담당하는 별도 서브 에이전트를 실행한다.
- 서브 에이전트는 작업 폴더를 기준으로 Codex CLI를 읽기 전용 모드로 실행한다.
- **컨텍스트는 파일 시스템으로만 전달한다.** 현재 세션의 대화 로그, 구현 판단 근거, "이렇게 처리했다"는 설명을 프롬프트에 넣지 않는다. 넣으면 검증자가 구현자의 프레임을 물려받는다.
- 프롬프트에는 다음만 포함한다: 대상 Phase, 검토할 소스 파일 목록, 해당 Phase의 `adversarialFocus` 항목, 참조할 `specRefs` 조항.
- Codex는 코드를 수정하지 않는다. 지적만 반환한다. 수정은 메인 에이전트가 한다.
- 검토 대상은 현재 작업 폴더의 제품 소스 코드로 한정한다. Git 상태, 브랜치, 원격 저장소, 커밋 이력 조회와 셸 도구 호출을 요청하거나 허용하지 않는다.
- 각 지적은 `Critical / Major / Minor` 등급, 재현 조건, 위반한 SPEC 조항 번호를 포함해야 한다.
- 결과는 `docs/releases/v0.1/reviews/A{n}.md`에 기록한다. 검토 대상 커밋 해시, 검증 모델, 실행 일시, 심각도별 건수를 남긴다.
- 유효하지 않다고 판단한 지적은 조용히 넘기지 않고 같은 파일에 반박 사유를 남긴다.
- Codex CLI의 응답 지연, 인증 실패, 네트워크 오류 등으로 검증하지 못하면 서브 에이전트는 오류 내용과 대체 검증안을 메인 에이전트에 반환한다.

서브 에이전트가 PowerShell에서 실행할 기본 명령은 다음과 같다. `<phase>`, `<changed-files>`, `<adversarial-focus>`, `<spec-refs>`는 현재 작업 내용으로 대체한다.

```powershell
codex.cmd exec --model gpt-5.6-sol --sandbox read-only --cd "D:\projects\tools\file_manager" "You are an adversarial reviewer for <phase>. Your job is to break this code, not to confirm it works. Review only these product source files: <changed-files>. Attack these specific points: <adversarial-focus>. Validate against these spec clauses: <spec-refs>. Do not inspect Git status, branches, remotes, or commit history, and do not use shell tools. For each finding, report severity (Critical/Major/Minor), exact reproduction conditions, and the violated spec clause. Order findings by severity. Do not modify any file."
```

추가로 물어볼 때는 `codex.cmd exec resume --last "<추가 질문>"`을 사용한다.

Codex CLI 검토를 실행하는 외부 명령의 시간 제한은 기본 10분으로 설정한다.
CLI 플래그는 Phase 0에서 `codex exec --help`로 실제 지원 여부를 확인하고, 다르면 이 문서를 갱신한다.

**모델 지정 규칙 (2026-08-15 갱신).** Codex CLI 실행에는 전체 모델 ID인
`--model gpt-5.6-sol`을 사용한다. 짧은 별칭 `--model sol`은 사용하지 않는다. PowerShell에서는
실행 정책 때문에 `codex.ps1` 대신 `codex.cmd`를 사용한다. 계정 또는 조직 정책이
`gpt-5.6-sol` 접근을 거부하면 기본 모델로 조용히 폴백하지 말고, 오류와 대체 검증안을
메인 에이전트 및 사용자에게 보고한다. "Codex sol"은 교차 검증자 역할 이름이 아니라
이 지침에서 지정한 `gpt-5.6-sol` 모델을 뜻한다.

## Commit and Push Rules

- 원격 저장소는 `https://github.com/nampluskr/file_manager.git`이며 `origin`으로 등록한다.
- 커밋은 하나의 완료된 Phase에 대응하도록 만든다.
- 커밋 메시지에는 Phase 번호와 핵심 변경 사항을 포함한다.
- 커밋 전에는 해당 Phase의 `selfVerification`을 실행한다.
- 적대적 검증에서 나온 Critical 수정은 별도 커밋으로 남기고, 어떤 지적에 대한 수정인지 메시지에 표시한다.
- Phase 완료, 적대적 검증, 지적사항 수정 및 재검증을 마친 뒤 사용자에게 푸시 승인을 요청한다.
- 사용자의 명시적 승인 이후에만 `origin`에 푸시한다.
- 다른 작업의 변경 사항을 임의로 포함, 되돌리기, 삭제하지 않는다.
