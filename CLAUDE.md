# Personal File Manager Agent Instructions

Claude Code가 이 저장소에서 작업할 때 매 턴 지켜야 하는 규칙이다. 이 파일에는 규칙만 둔다.
배경 설명과 근거는 `docs/releases/v0.1/`의 기획·명세 문서와 `docs/releases/v0.1/improvements/CONTEXT.md`에 있다.

## Release Version Status

- v0.1 MVP는 완료되어 Git 태그 `v0.1`로 고정되었다. `docs/releases/v0.1/`의 `BRIEF.md`, `TECH_GUIDE.md`, `PRD.md`, `SPEC.md`, `PLAN.md`, `backlog.json`, `reviews/`는 이후 수정하지 않고 참조만 한다.
- **현재 작업은 v0.1 개선 루프다.** 디자인과 필수 기능의 완성도를 한 항목씩 순차적으로 끌어올리는 단계이며, 새 문서 사이클을 만들지 않는다. 기록은 `docs/releases/v0.1/improvements/`에 둔다.
  - `LOG.md` — 항목별 실행 기록. 항목 상태는 이 파일에서만 관리한다.
  - `CONTEXT.md` — 판단 근거, mdviewer 참조 기준, 후보 항목 목록.
- **`improvements/`는 위 동결 규칙의 예외다.** 태그로 고정된 것은 v0.1의 기획·명세 문서이며, `improvements/` 하위 파일은 개선 루프가 진행되는 동안 계속 갱신한다.
- **개선 항목은 사용자가 지정한다.** 에이전트가 추측으로 순서를 정하거나 항목을 신설하지 않는다.
- `v0.1` 태그는 MVP 달성 시점의 기록이다. 개선 작업으로 이동하거나 재배치하지 않는다.
- v0.2는 **추가 기능 개발 단계**로 예약되어 있다. 착수 시점에 `docs/releases/v0.2/`를 만들고 `BRIEF.md → PRD.md → SPEC.md → PLAN.md → backlog.json` 순서로 문서 사이클을 새로 쓴다. 그전까지 v0.2 디렉터리를 만들지 않는다.

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
- 개선 루프의 범위를 넘는 기능을 임의로 구현하지 않는다. 범위 밖 목록은 `docs/releases/v0.1/PRD.md` Non-Goals와 `BRIEF.md` §11에 있다. 이 단계는 v0.1 범위 안의 완성도 작업이며, 새 기능 영역은 v0.2로 미룬다.
- 문서에 확정된 키 매핑(`docs/releases/v0.1/SPEC.md` §16)과 기술 선택(`docs/releases/v0.1/TECH_GUIDE.md` §2)을 임의로 변경하지 않는다.
- 성능 최적화는 `docs/releases/v0.1/SPEC.md` §10에 명시된 것만 선제 적용하고, 나머지는 측정 후 수행한다.
- 불필요한 추상화 계층을 추가하지 않는다.

## Document Rules

- 릴리스 문서는 `docs/releases/v{major}.{minor}/`에 둔다.
- 문서 사이클의 역할 구분은 다음과 같다. **v0.1이 이 절차로 만들어졌고, v0.2 착수 시 다시 사용한다. 현재 개선 루프에는 적용하지 않는다.**
  `BRIEF.md`(무엇을·왜) → `TECH_GUIDE.md`(어떤 기술로) → `PRD.md`(요구사항 표) → `SPEC.md`(상세 기술) → `PLAN.md`(Phase) → `backlog.json`(작업 단위).
- **개선 루프에서는 문서 사이클을 갱신하지 않는다.** 사용자 요청으로 구현이 바뀌면 `improvements/LOG.md`에 항목으로 기록한다. 스타일 값의 단일 진실 소스는 `src/renderer/src/styles.css`이며, 별도 문서에 hex나 픽셀값을 중복 기술하지 않는다.
- 개선 항목의 상태는 `improvements/LOG.md`의 각 항목 `- 상태:` 필드에서만 관리한다. `README.md`나 v0.1 기획·명세 문서에 진행 상태를 기록하지 않는다.
- Git 태그가 달린 릴리스 버전의 기획·명세 문서와 `backlog.json`은 이후 수정하지 않는다. 참조만 한다. `improvements/` 하위는 이 규칙의 예외다.

## Improvement Log Workflow

현재 작업 단위는 Phase가 아니라 **개선 항목**이다. 항목은 사용자가 지정하며, `docs/releases/v0.1/improvements/LOG.md`에 `I{3자리}` 번호로 한 건씩 append 한다. 후보 항목 목록은 같은 폴더의 `CONTEXT.md` §5에 있다.

각 항목은 다음 순서로 완료한다.

1. 사용자 요청을 접수하고 요청 내용을 항목에 기록한다. 요청이 코드 실측과 어긋나면 그 사실을 먼저 보고한다.
2. 수정을 구현하고 검증 명령(`npm run typecheck`, `npm test`)을 실행한다. 화면 변경은 `npm run dev`로 Dark/Light 양 테마에서 실제로 확인한다.
3. 변경을 커밋한다. 커밋 해시를 항목에 기록한다.
4. 적대적 검증을 별도 서브 에이전트에 위임한다. 항목의 공격 지점과 참조할 `docs/releases/v0.1/SPEC.md` 조항을 프롬프트에 포함한다.
5. 지적사항을 검토한다. Critical은 전부 수정하고 관련 검증을 다시 실행한다. Major와 Minor는 처리 여부와 사유를 기록한다.
6. Critical 수정 후 **같은 적대적 검증을 재실행**해 해소를 확인한다.
7. 변경 내용, 검증 결과, 적대적 검증 결과와 보완 조치, 남은 위험을 사용자에게 보고한다. 검증 결과는 지적사항별 심각도, 근거, 처리 상태를 포함한 Markdown 표로 제시한다.
8. 사용자 확인 후 푸시 승인을 요청한다. 명시적 승인을 받은 후에만 `origin`에 푸시한다.

검증 결과는 별도 파일을 만들지 않고 **`LOG.md`의 해당 항목 안에 인라인 표로 기록한다.** `docs/releases/v0.1/reviews/A{n}.md`는 v0.1 Phase 배치 검증 전용이며 개선 항목과 무관하다.

**적대적 검증 면제 불가 조건.** 다음을 건드리는 변경은 항목 크기와 무관하게 항상 검증한다. 명령 주입, 데이터 손상, 데이터 손실을 다루며 되돌릴 수 없기 때문이다.

- `src/main/filesystem/*`, `src/main/ipc/*`, `src/preload/*`
- 파괴적 작업 경로 (Copy / Move / Delete)
- 외부 프로세스 실행 인자
- IPC 계약 (`src/shared/ipc.ts`)

그 외 순수 스타일·문구 변경은 사유를 항목에 적고 적대적 검증을 생략할 수 있다. 생략 여부를 조용히 결정하지 않고 항목에 남긴다.

**적대적 검증 재실행은 최초 검증을 포함해 최대 3회까지만 자동으로 진행한다** (2026-08-15 갱신).
EXDEV 폴백·overwrite·junction 방어처럼 상호작용이 많은 로직은 한 라운드의 수정이 인접한
지점에서 같은 계열의 새 지적을 유발하는 경우가 있다. 3회차 재검증 이후에도 Critical 또는
새 지적이 남아 있으면 4회차를 자동으로 시작하지 않는다. 대신 지금까지의 전체 라운드 이력과
남은 위험을 사용자에게 보고하고, 다음 중 하나를 사용자가 결정하도록 확인받는다: 추가 라운드
진행, 구조적 한계로 판단되는 항목을 사유와 함께 보류, 또는 더 큰 리팩터링의 별도 착수. 사용자
결정 없이 3회를 넘겨 자동으로 반복하지 않는다.

면제 불가 조건에 해당하는 항목에서 Critical 지적이 남아 있으면 다음 항목으로 넘어가지 않는다.

적대적 검증자를 사용할 수 없는 환경이면 그 사실과 사유를 사용자에게 알리고, 대체 검증 방안을 제시한 뒤 승인을 요청한다. 면제 불가 조건에 해당하는 항목에서 적대적 검증을 생략하지 않는다.

## Codex sol Adversarial Review Sub-agent

구현자는 Claude Code, 적대적 검증자는 Codex sol이다. 서로 다른 벤더의 모델로 분리한다.
같은 모델 계열 안에서 세션만 나누면 학습 편향과 코드 관용구를 공유해 "둘 다 같은 지점을 놓치는" 실패 모드가 남는다.

- 메인 에이전트는 항목 구현과 커밋을 끝낸 뒤, Codex 검증만 담당하는 별도 서브 에이전트를 실행한다.
- 서브 에이전트는 작업 폴더를 기준으로 Codex CLI를 읽기 전용 모드로 실행한다.
- **컨텍스트는 파일 시스템으로만 전달한다.** 현재 세션의 대화 로그, 구현 판단 근거, "이렇게 처리했다"는 설명을 프롬프트에 넣지 않는다. 넣으면 검증자가 구현자의 프레임을 물려받는다. `CONTEXT.md`와 `LOG.md`도 프롬프트에 넣지 않는다 — 구현자의 판단이 담겨 있다.
- 프롬프트에는 다음만 포함한다: 대상 항목 제목, 검토할 소스 파일 목록, 해당 항목의 공격 지점, 참조할 `docs/releases/v0.1/SPEC.md` 조항.
- Codex는 코드를 수정하지 않는다. 지적만 반환한다. 수정은 메인 에이전트가 한다.
- 검토 대상은 현재 작업 폴더의 제품 소스 코드로 한정한다. Git 상태, 브랜치, 원격 저장소, 커밋 이력 조회와 셸 도구 호출을 요청하거나 허용하지 않는다.
- 각 지적은 `Critical / Major / Minor` 등급, 재현 조건, 위반한 SPEC 조항 번호를 포함해야 한다.
- 결과는 `docs/releases/v0.1/improvements/LOG.md`의 해당 항목에 인라인으로 기록한다. 검토 대상 커밋 해시, 검증 모델, 실행 일시, 심각도별 건수를 남긴다.
- 유효하지 않다고 판단한 지적은 조용히 넘기지 않고 같은 항목에 반박 사유를 남긴다.
- Codex CLI의 응답 지연, 인증 실패, 네트워크 오류 등으로 검증하지 못하면 서브 에이전트는 오류 내용과 대체 검증안을 메인 에이전트에 반환한다.

서브 에이전트가 PowerShell에서 실행할 기본 명령은 다음과 같다. `<item>`, `<changed-files>`, `<adversarial-focus>`, `<spec-refs>`는 현재 작업 내용으로 대체한다. `<item>`에는 개선 항목 번호와 제목(예: `I001: focus and selection color separation`)을 넣는다.

```powershell
codex.cmd exec --model gpt-5.6-sol --sandbox read-only --cd "D:\projects\tools\file_manager" "You are an adversarial reviewer for <item>. Your job is to break this code, not to confirm it works. Review only these product source files: <changed-files>. Attack these specific points: <adversarial-focus>. Validate against these spec clauses: <spec-refs>. Do not inspect Git status, branches, remotes, or commit history, and do not use shell tools. For each finding, report severity (Critical/Major/Minor), exact reproduction conditions, and the violated spec clause. Order findings by severity. Do not modify any file."
```

추가로 물어볼 때는 `codex.cmd exec resume --last "<추가 질문>"`을 사용한다.

Codex CLI 검토를 실행하는 외부 명령의 시간 제한은 기본 10분으로 설정한다.
CLI 플래그가 실제와 다르면 `codex exec --help`로 확인하고 이 문서를 갱신한다.

**모델 지정 규칙 (2026-08-15 갱신).** Codex CLI 실행에는 전체 모델 ID인
`--model gpt-5.6-sol`을 사용한다. 짧은 별칭 `--model sol`은 사용하지 않는다. PowerShell에서는
실행 정책 때문에 `codex.ps1` 대신 `codex.cmd`를 사용한다. 계정 또는 조직 정책이
`gpt-5.6-sol` 접근을 거부하면 기본 모델로 조용히 폴백하지 말고, 오류와 대체 검증안을
메인 에이전트 및 사용자에게 보고한다. "Codex sol"은 교차 검증자 역할 이름이 아니라
이 지침에서 지정한 `gpt-5.6-sol` 모델을 뜻한다.

## Commit and Push Rules

- 원격 저장소는 `https://github.com/nampluskr/file_manager.git`이며 `origin`으로 등록한다.
- 커밋은 하나의 완료된 개선 항목에 대응하도록 만든다.
- 커밋 메시지에는 개선 항목 번호(`I{n}`)와 핵심 변경 사항을 포함한다.
- 커밋 전에는 `npm run typecheck`와 `npm test`를 실행한다. 화면 변경은 `npm run dev`로 Dark/Light 양 테마에서 확인한다.
- 적대적 검증에서 나온 Critical 수정은 별도 커밋으로 남기고, 어떤 지적에 대한 수정인지 메시지에 표시한다.
- 항목 완료, 적대적 검증, 지적사항 수정 및 재검증을 마친 뒤 사용자에게 푸시 승인을 요청한다.
- 사용자의 명시적 승인 이후에만 `origin`에 푸시한다.
- 다른 작업의 변경 사항을 임의로 포함, 되돌리기, 삭제하지 않는다.
