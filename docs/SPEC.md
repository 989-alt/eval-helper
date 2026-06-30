# eval-helper — 교사 평어 도우미 (스펙 & 계획)

배포: `989-alt/eval-helper` → https://989-alt.github.io/eval-helper/ (GitHub Pages, main 루트)
구조: **빌드리스 정적 앱** — ES 모듈 바닐라 JS + Tailwind Play CDN + SheetJS CDN. 서버 없음, 100% 클라이언트.

## 목표
누구나(어떤 AI를 쓰든, AI를 안 쓰든) 교과 평어·창의적체험활동·행동발달 문장을 쉽게 생성. 기존 evaluationapp의 클릭복사·행발·창체·수준별 N개 생성은 유지하고, "학생별 점수→전 과목 평어 일괄"을 추가.

## 생성 경로 (하이브리드)
- **내장 무료 엔진**(기본, 키 불필요): 교과·창체. 표현 풀+규칙 기반.
- **내 AI 키**(선택, 멀티 프로바이더): Google/OpenAI/Anthropic. 행발은 AI 권장.
- **모델 목록은 실시간 조회**: 키 입력 시 프로바이더 `/models`로 실제 사용가능 모델만 표시. 이름 패턴으로 비용 티어(무료/$20/$100) 자동 라벨.

## 절대 규칙 (교과/창체 텍스트)
1. 특수문자·영어 금지(마침표·쉼표만 허용). 예외: 핵심개념의 숫자·가운뎃점(4·19 등) 허용.
2. 고유명사 금지는 기업·제품·서비스명만. 교육과정 핵심개념(비발디 등)은 허용.
3. 명사형 종결(~함/~임/~됨...).
4. 반영 우선순위 성취수준→평가요소.
5. 모든 평어 서로 다르게.
6. 수준별 어조 차등(매우잘함=강조, 보통은 "도움을 받아" 금지, 노력요함=성장지향).
→ `src/lib/textRules.js`로 1·3·5 기계 검증.

## 데이터 모델 (단일 출처)
```
EvalSet {
  students: [{ id, name }]
  subjects: [{ id, name, elements: [{ id, name }] }]   // 평가요소 이름 자유 텍스트
  scores:   { [studentId]: { [elementId]: level } }     // level ∈ 성취수준 or 특수토큰
}
LEVELS = ['매우잘함','잘함','보통','노력요함']   // 특수: '미실시'(건너뜀), ''(빈칸)
```
표 입력과 엑셀이 이 구조를 공유. 엑셀 = 과목별 시트, 1행 평가요소명, 행=학생, 셀=수준 드롭다운.

## 모듈 (파일별 책임)
- `src/lib/levels.js` — 성취수준 상수, 약어 정규화(매잘→매우잘함 등), 건너뜀 토큰
- `src/lib/textRules.js` — 허용문자/명사형/중복 검증 (check_pyeoeo.py 포팅)
- `src/lib/gyogwaEngine.js` — 교과 오프라인 생성: Mode A(수준별 N개 뱅크), Mode B(학생별 전과목), 규칙 자체검증
- `src/lib/changcheEngine.js` — 창체 오프라인: 원문→유사 N개 변형
- `src/lib/excel.js` — SheetJS: 정의 기반 양식 생성(드롭다운 검증) + 업로드 파싱
- `src/lib/providers.js` — AI: 실시간 모델 조회 + 티어 라벨 + generate(Gemini/OpenAI/Anthropic, CORS 처리)
- `src/lib/store.js` — EvalSet 상태 + localStorage 자동저장
- `src/lib/clipboard.js` — 클릭복사
- `src/lib/exporters.js` — HWP(HTML blob) / 채워진 엑셀 내보내기
- `src/ui/*.js` — 탭 UI(교과/창체/행발/AI설정), 렌더 헬퍼
- `index.html`, `src/main.js` — 앱 셸/통합

## 탭
1. 교과 평어 — 모드 A(성취기준→수준별 N개) / 모드 B(과목·평가요소·학생·점수→전과목 일괄). 출력=수준별/학생별 정리 + 클릭복사 + HWP·엑셀 내보내기.
2. 창의적 체험활동 — 원문→유사 N개(내장 또는 AI).
3. 행동발달 — 특성 체크→문장(AI 권장).
4. AI 설정 — 프로바이더 선택, 키 입력, 실시간 모델 목록+티어, 모델 선택.

## 배포·검증
정적 파일 push → Pages(main 루트) → 라이브 URL을 브라우저로 열어 각 탭 동작·내장 생성·클릭복사 확인. AI 경로는 키 없이도 UI/모델조회 호출 흐름까지 검증.
