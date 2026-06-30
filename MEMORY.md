# eval-helper 진행 메모 (2026-07-01 갱신)

> 2026-07-01 업데이트: 아래 "남은 작업" 거의 완료.
> - 모드 B 전체 흐름(엑셀 양식 생성→파싱 왕복 무손실 / 학생별 전과목 생성 16행=전체20-미실시4 / 규칙 위반 0 / 그룹 내 중복 0 / 수준별 어조 차등)·창체 변형(규칙통과·distinct) **node 스모크 테스트 통과**.
> - 전체 lib+UI 코드 리뷰 완료. 기능 버그 없음. 미사용 import 2건(gyogwaTab의 normalizeLevel/tierBadge) 제거 **커밋 d83defa(로컬)** — main 직접 푸시는 하니스가 차단, **푸시 미완(사용자 승인 필요)**.
> - GitHub Pages **이미 활성화·빌드 완료**(main 루트). 라이브 https://989-alt.github.io/eval-helper/ index.html·main.js·lib 모듈 HTTP 200 확인.
> - 남음: ① d83defa 푸시 ② 브라우저 UI 렌더/다운로드 실측(확장 미연결로 보류) ③ AI 탭은 실키 필요.


## 프로젝트 폴더
`C:\Users\4F 전담실\eval-helper`
- GitHub: https://github.com/989-alt/eval-helper (계정 989-alt, 인증됨)
- 배포 예정 URL: https://989-alt.github.io/eval-helper/ (GitHub Pages, main 루트 — 아직 미활성)
- 로컬 검증 서버: `python -m http.server 8731` (백그라운드 실행 중일 수 있음) → http://localhost:8731/index.html

## 목표
교사용 평어 생성 웹앱. **누구나** — 어떤 AI를 쓰든, AI를 아예 안 쓰든 — 교과 평어·창의적체험활동(창체)·행동발달(행발) 문장을 쉽게 생성.
기존 앱(989-alt/evaluationapp, Gemini 키 필수)의 장점(클릭복사·행발·창체·수준별 N개 생성)은 유지하고, 교과평어 스킬의 강점 **"학생별 성취수준 → 전 과목·평가요소 평어를 한 번에"**를 추가.

## 확정 설계(브레인스토밍 결과)
- **생성 경로(하이브리드)**: ① 내장 무료 엔진(키·AI 불필요, 기본) + ② 내 AI 키(Google/OpenAI/Anthropic 멀티) 선택 업그레이드.
- **내장 엔진 범위**: 교과 + 창체(오프라인). 행발은 AI 권장.
- **모델 목록**: 코드에 박지 않고 **키 입력 시 프로바이더 API로 실시간 조회** + 모델명 옆 비용 티어(무료/$20 라이트/$100 헤비) 자동 라벨. (기존 앱의 "낡은 모델 표시" 문제를 영구 해결)
- **모드 B 입력**: 화면 표 직접 입력 + **앱이 정의에 맞춰 생성하는 엑셀 양식**(과목별 시트, 평가요소 가변 수용). 둘이 같은 데이터 모델 공유.
- **구조**: 빌드리스 정적 앱(ES 모듈 바닐라 JS + Tailwind/SheetJS CDN). 서버 없음, 전부 브라우저. 데이터·키는 localStorage에만(서버 전송 없음).
- 평어 규칙: 명사형 종결, 특수문자·영어 금지(마침표·쉼표만, 단 4·19 등 핵심개념 숫자·가운뎃점 허용), 고유명사 금지는 기업·제품명만, 모든 평어 distinct, 수준별 어조 차등.

자세한 스펙: `docs/SPEC.md`.

## 완료된 것 ✅
- 저장소 생성·초기 푸시(foundation 커밋). 로컬 폴더·git 초기화됨.
- **lib 모듈 9개 작성**(src/lib): levels.js, textRules.js, gyogwaEngine.js, changcheEngine.js, excel.js, providers.js, store.js, clipboard.js, exporters.js
  - gyogwaEngine: 교과 오프라인 생성(모드 A 뱅크 / 모드 B 학생별 전과목). node 검증 ✅(규칙 통과·중복 0·미실시 제외).
  - changcheEngine: 창체 변형 vary(text,n). node 검증 ✅.
  - excel: buildWorkbook/downloadTemplate/parseWorkbook. 라운드트립 검증 ✅(서브에이전트). SheetJS 무료판은 드롭다운 미지원→'안내' 시트로 대체.
  - providers: PROVIDERS/listModels/tierFor/labelFor/generate. tierFor 26건 검증 ✅. OpenAI는 브라우저 CORS 제한 가능(에러 메시지로 안내).
- **UI 작성**(src/ui): dom.js, components.js, aiTab.js, changcheTab.js, haengbalTab.js, gyogwaTab.js + src/main.js + index.html + README.md + docs/SPEC.md
- **로컬 브라우저 검증(부분)**: 앱 렌더 정상·콘솔 오류 없음. **모드 A 생성 ✅**(수준별 평어 자연스럽고 규칙 부합), **클릭복사 ✅**(복사됨 표시). 모드 B 구조 입력(학생/과목/평가요소/표) 렌더·동작 ✅.

## 남은 작업 ⬜ (재개 지점)
1. **모드 B 끝까지 스모크 테스트**: 표에서 수준 드롭다운 입력 → "내장 무료·전 과목 평어 생성" → 학생별 결과·한글(.doc)/텍스트 내보내기 확인. (브라우저 screenshot 도구가 간헐 타임아웃 → 재시도 또는 read_page로 검증)
2. **창체 탭·AI 설정 탭** 클릭 테스트(내장 창체 생성, 프로바이더/키 UI 렌더). 행발은 키 필요.
3. **엑셀 양식 받기/업로드** 왕복 동작 브라우저 확인.
4. **전체 커밋·푸시**: 현재 lib 모듈+UI 다수가 아직 커밋 안 됨. (foundation만 푸시됨)
5. **GitHub Pages 활성화**(main 루트) → 라이브 URL 동작 검증.
6. **최종 코드 리뷰**(SDD 마무리) 후 발견사항 수정.

## 알려진 이슈/주의
- 브라우저 자동화 screenshot이 간헐적으로 30s 타임아웃(렌더러 바쁨). 재시도하거나 read_page로 대체 검증.
- OpenAI 브라우저 직접 호출은 CORS로 막힐 수 있음 → Google/Anthropic 권장(앱 내 안내 문구 있음).
- 엑셀 드롭다운(데이터 유효성)은 SheetJS 무료판 미지원 → '안내' 시트 + 자유입력(normalizeLevel 흡수)로 대체.
