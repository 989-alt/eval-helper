// src/lib/excel.skeleton.test.mjs
// buildSkeletonEvalSet 함수 검증 테스트 (node 실행)

import { buildSkeletonEvalSet, buildWorkbook, parseWorkbook } from './excel.js';

// 테스트 전에 XLSX를 globalThis에 세팅
globalThis.XLSX = await import('xlsx');

// ─── 테스트 1: 기본 동작 ──────────────────────────────────────────────────────

console.log('Test 1: 기본 동작 (3학생, [2, 3] 과목)...');
const skeleton1 = buildSkeletonEvalSet(3, [2, 3]);

if (skeleton1.students.length !== 3) {
  console.error('FAIL: students.length !== 3');
  process.exit(1);
}

if (skeleton1.students[0].name !== '학생1') {
  console.error('FAIL: students[0].name !== "학생1"');
  process.exit(1);
}

if (skeleton1.students[2].name !== '학생3') {
  console.error('FAIL: students[2].name !== "학생3"');
  process.exit(1);
}

if (skeleton1.subjects.length !== 2) {
  console.error('FAIL: subjects.length !== 2');
  process.exit(1);
}

if (skeleton1.subjects[0].name !== '과목1') {
  console.error('FAIL: subjects[0].name !== "과목1"');
  process.exit(1);
}

if (skeleton1.subjects[0].elements.length !== 2) {
  console.error('FAIL: subjects[0].elements.length !== 2');
  process.exit(1);
}

if (skeleton1.subjects[0].elements[1].name !== '평가기준2') {
  console.error('FAIL: subjects[0].elements[1].name !== "평가기준2"');
  process.exit(1);
}

if (skeleton1.subjects[1].elements.length !== 3) {
  console.error('FAIL: subjects[1].elements.length !== 3');
  process.exit(1);
}

if (Object.keys(skeleton1.scores).length !== 0) {
  console.error('FAIL: scores is not empty');
  process.exit(1);
}

console.log('  PASS');

// ─── 테스트 2: 경계값 (0 입력 → 최소 1) ──────────────────────────────────────

console.log('Test 2: 경계값 처리...');
const skeleton2 = buildSkeletonEvalSet(0, [0]);

if (skeleton2.students.length !== 1) {
  console.error('FAIL: students.length !== 1 (should be minimum 1)');
  process.exit(1);
}

if (skeleton2.subjects[0].elements.length !== 1) {
  console.error('FAIL: subjects[0].elements.length !== 1 (should be minimum 1)');
  process.exit(1);
}

console.log('  PASS');

// ─── 테스트 3: 빈 과목 ────────────────────────────────────────────────────────

console.log('Test 3: 빈 과목...');
const skeleton3 = buildSkeletonEvalSet(2, []);

if (skeleton3.subjects.length !== 0) {
  console.error('FAIL: subjects.length !== 0');
  process.exit(1);
}

console.log('  PASS');

// ─── 테스트 4: 왕복 (buildWorkbook → serialize → parseWorkbook) ────────────────

console.log('Test 4: 왕복 테스트...');
const skeleton4 = buildSkeletonEvalSet(4, [2, 2, 3]);
const wb = buildWorkbook(skeleton4);
const buf = globalThis.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
const parsed = parseWorkbook(buf);

if (parsed.students.length !== 4) {
  console.error('FAIL: parsed.students.length !== 4');
  process.exit(1);
}

if (parsed.subjects.length !== 3) {
  console.error('FAIL: parsed.subjects.length !== 3');
  process.exit(1);
}

const elemLengths = parsed.subjects.map(s => s.elements.length);
if (JSON.stringify(elemLengths) !== JSON.stringify([2, 2, 3])) {
  console.error('FAIL: parsed elements lengths !== [2, 2, 3]');
  process.exit(1);
}

if (parsed.subjects[0].name !== '과목1') {
  console.error('FAIL: parsed.subjects[0].name !== "과목1"');
  process.exit(1);
}

console.log('  PASS');

console.log('ALL PASS');
