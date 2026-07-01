# AI 기준분석 평어 생성 — 설계

작성 2026-07-01. eval-helper 교과 평어 탭 확장. **AI 전용** 경로.

## 목적
교사가 (1) 채운 엑셀(학생×평가주제, 칸=성취수준)과 (2) 학교 평가 계획안/도구표(PDF·이미지)를
함께 올리면, AI가 계획안의 성취수준별 루브릭을 근거로 학생별 평어를 생성한다.
계획안을 근거로 삼아 스킬 규칙5(평가 내용 밖 소재 금지)를 만족한다.

## 범위
- 대상: 교과 평어 탭의 엑셀 업로드 영역에 "AI 기준 분석" 경로 추가. 기존 내장(양식→내장 생성)은 그대로 병행.
- 입력 형식: 평가 계획안은 **PDF·이미지만**(AI 네이티브). 한글은 사용자가 PDF로 저장해 올린다.
- 프로바이더: **Google·Anthropic만** 파일 분석 지원. OpenAI 선택 시 안내 후 중단.
- NEIS 자동 업로드는 별도 후속 프로젝트(범위 밖).

## 데이터 흐름
1. 업로드: 채운 엑셀 + 평가 계획안(PDF/이미지)
2. `parseWorkbook`로 엑셀 → `{students, subjects(=시트/과목), elements(=주제열), scores(성취수준)}`
3. **과목별 1회 AI 호출**: 프롬프트(그 과목 주제 목록 + 학생별 주제별 성취수준 + 스킬 규칙) + 계획안 파일 첨부
   → JSON으로 학생×주제 평어 반환. 관용적 파서로 파싱.
4. 결과를 `{studentName, subjectName, elementName, level, text}` 행으로 정규화(기존 결과 구조와 동일)
5. 화면에 표시하되 각 평어는 **편집 가능**(textarea)
6. 출력 모드 선택: **과목별 묶기**(한 학생의 그 과목 주제별 평어를 이어 한 문단) / **평가기준별**(개별)
7. **PDF 저장**: 인쇄용 화면 + `window.print()`(시스템 한글 폰트, 폰트 임베딩 회피)

## 컴포넌트
- `lib/providers.js`: `generateWithFile(provider, apiKey, model, prompt, file)` — file = `{mime, base64}`.
  - Google: `contents:[{parts:[{text},{inline_data:{mime_type,data}}]}]`
  - Anthropic: `messages:[{role:user, content:[{type:text,text}, PDF면 {type:document,source:{type:base64,media_type,data}} / 이미지면 {type:image,...}]}]`
  - OpenAI: 미지원 → 명확한 에러.
- `lib/aiPlanGen.js`: `generateFromPlan(ai, evalSet, file, onProgress)` → 결과 행 배열. + 관용적 JSON 파서(코드블록/잡텍스트 흡수).
- `ui/gyogwaTab.js`: 엑셀 패널에 평가 계획안 파일 입력 + "AI로 기준 분석·생성" 버튼(엑셀+계획안 필요). 진행률·스피너.
- 결과/편집/출력/PDF: 편집 textarea, 과목별/기준별 토글, 인쇄 저장. (planResults 렌더)

## 재사용
`parseWorkbook`, 결과 그룹핑, `pyeoeoRules`(규칙·어조), 복사행·카드 스타일 그대로.

## 검증
- node: `generateWithFile` payload 형태(프로바이더별 body 구조) 단위 테스트(실제 호출 X). JSON 파서 테스트. 과목별 묶기(문단 구성) 테스트.
- 브라우저: 파일 업로드·버튼·편집·과목별/기준별 토글·PDF 인쇄 화면 실측. (실제 AI 호출은 실키 필요 → 사용자 확인)

## 알려진 한계
- 실제 AI 호출 결과 품질은 실키로만 확인 가능.
- 이미지(스캔) 평가도구표는 표가 복잡하면 정확도 편차.
- OpenAI PDF 미지원.
