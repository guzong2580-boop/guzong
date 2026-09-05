import { useState, useEffect } from "react";

const GRAD = "linear-gradient(135deg, #2ECC9A 0%, #4A90D9 30%, #7B6CF6 65%, #F472B6 85%, #E91E8C 100%)";

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR9J7MYIQb0uWQ16FLOsHy8ttEEeG8HPTIAxrSnilJPHYQH7yjxnRpr1uL1S8nJqc1qQDGB_A3isvu-/pub?output=csv";

function maskName(name) {
  if (!name) return '';
  if (name.length <= 2) return name[0] + '*';
  return name[0] + '*' + name.slice(2);
}

function dateToKey(dateStr) {
  const parts = dateStr.trim().split('.');
  if (parts.length < 3) return '';
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  return `${month}/${day}`;
}

function getExamKeysFromName(examName) {
  const match = examName.match(/\[([^\]]+)개강\]/);
  if (!match) return [];
  return match[1].split('·');
}

// 현장실습(출석수업) 개강반 — 온라인 중간/기말고사 미시행.
// 공개시트 '실습개강일' 칸이 비어 있는 학생 보완용. 시트에 채우면 자동 반영됨.
const PRACTICE_ONLY = {
  "조소연": ["5/13"],
  "이소희": ["7/15"],
  "조현영": ["9/9"], "강봉구": ["9/9"], "송지현": ["9/9"],
  "안재현": ["9/9"], "안경선": ["9/9"], "김태리": ["9/9"],
};

// 시험 대상자 = 개강반 키 매칭 − 그 개강반이 실습인 학생 제외
function matchExamStudents(students, examName) {
  const keys = getExamKeysFromName(examName);
  return students.filter(st =>
    st.classKeys.some(k => keys.includes(k) && !(st.practiceKeys || []).includes(k))
  );
}

// 고사 종료/임박/예정 자동 판정 (종료일 < 오늘 → closed, 시작 14일 내 → soon, 그 외 → upcoming)
function autoStatus(exam) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(exam.date);
  const end = new Date(exam.endDate || exam.date);
  if (end < today) return "closed";
  const daysToStart = (start - today) / 86400000;
  if (daysToStart <= 14) return "soon";
  return "upcoming";
}

// ── 고사 기간 데이터 (시작~종료) ──
const examPeriods = [
  // 중간고사
  { start:"2026-01-16", end:"2026-01-20", label:"[11/26개강] 중간고사", type:"mid" },
  { start:"2026-01-30", end:"2026-02-03", label:"[12/10개강] 중간고사", type:"mid" },
  { start:"2026-03-06", end:"2026-03-10", label:"[1/14·11/26개강] 중간/기말고사", type:"mid" },
  { start:"2026-03-20", end:"2026-03-24", label:"[12/10개강] 기말고사", type:"final" },
  { start:"2026-04-03", end:"2026-04-07", label:"[2/11개강] 중간고사", type:"mid" },
  { start:"2026-04-24", end:"2026-04-28", label:"[1/14개강] 기말고사", type:"final" },
  { start:"2026-05-01", end:"2026-05-05", label:"[3/11개강] 중간고사", type:"mid" },
  { start:"2026-05-22", end:"2026-05-26", label:"[2/11개강] 기말고사", type:"final" },
  { start:"2026-06-05", end:"2026-06-09", label:"[4/15개강] 중간고사", type:"mid" },
  { start:"2026-06-19", end:"2026-06-23", label:"[3/11개강] 기말고사", type:"final" },
  { start:"2026-07-03", end:"2026-07-07", label:"[5/13개강] 중간고사", type:"mid" },
  { start:"2026-07-10", end:"2026-07-14", label:"[5/20개강] 중간고사", type:"mid" },
  { start:"2026-07-24", end:"2026-07-28", label:"[4/15개강] 기말고사", type:"final" },
  { start:"2026-08-21", end:"2026-08-25", label:"[5/13개강] 기말고사", type:"final" },
  { start:"2026-08-28", end:"2026-09-01", label:"[5/20개강] 기말고사", type:"final" },
  { start:"2026-07-31", end:"2026-08-04", label:"[6/10개강] 중간고사", type:"mid" },
  { start:"2026-09-18", end:"2026-09-22", label:"[6/10개강] 기말고사", type:"final" },
  { start:"2026-09-04", end:"2026-09-08", label:"[7/15개강] 중간고사", type:"mid" },
  { start:"2026-10-23", end:"2026-10-27", label:"[7/15개강] 기말고사", type:"final" },
  { start:"2026-10-02", end:"2026-10-06", label:"[8/12개강] 중간고사", type:"mid" },
  { start:"2026-11-20", end:"2026-11-24", label:"[8/12개강] 기말고사", type:"final" },
  { start:"2026-10-30", end:"2026-11-03", label:"[9/9개강] 중간고사", type:"mid" },
  { start:"2026-12-18", end:"2026-12-22", label:"[9/9개강] 기말고사", type:"final" },
];

// ── 실습 일정 (오리엔테이션·세미나·평가회) ──
// attendees: 실습 대상자 명단 직접 지정 (개강반 매칭으로는 안 됨)
const practicePeriods = [
  // [3/11개강 실습 cohort] 출석수업 (대상: 박희연 4분반)
  { start:"2026-03-14", end:"2026-03-15", label:"사회복지현장실습 오리엔테이션", type:"practice", attendees:["박희연"] },
  { start:"2026-04-25", end:"2026-04-26", label:"사회복지현장실습 중간평가회", type:"practice", attendees:["박희연"] },
  { start:"2026-06-20", end:"2026-06-21", label:"사회복지현장실습 최종평가회", type:"practice", attendees:["박희연"] },
  // [5/13개강 실습 cohort] 출석수업 (대상: 조소연 2분반)
  { start:"2026-05-16", end:"2026-05-16", label:"사회복지현장실습 오리엔테이션", type:"practice", attendees:["조소연"] },
  { start:"2026-07-04", end:"2026-07-04", label:"사회복지현장실습 중간평가회", type:"practice", attendees:["조소연"] },
  { start:"2026-08-22", end:"2026-08-22", label:"사회복지현장실습 최종평가회", type:"practice", attendees:["조소연"] },
  // [7/15개강 실습 cohort] 출석수업 (대상: 이소희)
  { start:"2026-07-18", end:"2026-07-18", label:"사회복지현장실습 오리엔테이션", type:"practice", attendees:["이소희"] },
  { start:"2026-09-05", end:"2026-09-05", label:"사회복지현장실습 중간평가회", type:"practice", attendees:["이소희"] },
  { start:"2026-10-24", end:"2026-10-24", label:"사회복지현장실습 최종평가회", type:"practice", attendees:["이소희"] },
  // [9/9개강 실습 cohort] 출석수업 3회 (대상: 조현영2·강봉구2·송지현1·안재현3·안경선3·김태리12분반) — 시험 없음, 출석수업만
  { start:"2026-09-12", end:"2026-09-12", label:"사회복지현장실습 오리엔테이션 (9/9개강)", type:"practice", attendees:["조현영","강봉구","송지현","안재현","안경선","김태리"] },
  { start:"2026-10-31", end:"2026-10-31", label:"사회복지현장실습 중간평가회 (9/9개강)", type:"practice", attendees:["조현영","강봉구","송지현","안재현","안경선","김태리"] },
  { start:"2026-12-19", end:"2026-12-19", label:"사회복지현장실습 최종평가회 (9/9개강)", type:"practice", attendees:["조현영","강봉구","송지현","안재현","안경선","김태리"] },
  // [2027 1-5/3-17개강 실습 cohort] 17분반 (대상: 안희진·홍미정·홍순정·이종석)
  // 출석수업(OT/중간/최종) 날짜 교육원 미발표 → 일정 미정. 확정 시 start/end 채우면 캘린더 자동 표시됨.
  { start:"", end:"", label:"사회복지현장실습 오리엔테이션 (2027-03-17개강 / 일정 미정)", type:"practice", attendees:["안희진","홍미정","홍순정","이종석"] },
  { start:"", end:"", label:"사회복지현장실습 중간평가회 (2027-03-17개강 / 일정 미정)", type:"practice", attendees:["안희진","홍미정","홍순정","이종석"] },
  { start:"", end:"", label:"사회복지현장실습 최종평가회 (2027-03-17개강 / 일정 미정)", type:"practice", attendees:["안희진","홍미정","홍순정","이종석"] },
];

const initialExams = [
  { id:101, name:"[11/26개강] 중간고사", date:"2026-01-16", endDate:"2026-01-20", time:"17:00 ~ 17:00", place:"온라인", status:"closed" },
  { id:102, name:"[11/26개강] 기말고사", date:"2026-03-06", endDate:"2026-03-10", time:"17:00 ~ 17:00", place:"온라인", status:"closed" },
  { id:201, name:"[12/10개강] 중간고사", date:"2026-01-30", endDate:"2026-02-03", time:"17:00 ~ 17:00", place:"온라인", status:"closed" },
  { id:202, name:"[12/10개강] 기말고사", date:"2026-03-20", endDate:"2026-03-24", time:"17:00 ~ 17:00", place:"온라인", status:"closed" },
  { id:301, name:"[1/14개강] 중간고사", date:"2026-03-06", endDate:"2026-03-10", time:"17:00 ~ 17:00", place:"온라인", status:"closed" },
  { id:302, name:"[1/14개강] 기말고사", date:"2026-04-24", endDate:"2026-04-28", time:"17:00 ~ 17:00", place:"온라인", status:"soon" },
  { id:401, name:"[2/11개강] 중간고사", date:"2026-04-03", endDate:"2026-04-07", time:"17:00 ~ 17:00", place:"온라인", status:"soon" },
  { id:402, name:"[2/11개강] 기말고사", date:"2026-05-22", endDate:"2026-05-26", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:501, name:"[3/11개강] 중간고사", date:"2026-05-01", endDate:"2026-05-05", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:502, name:"[3/11개강] 기말고사", date:"2026-06-19", endDate:"2026-06-23", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:601, name:"[4/15개강] 중간고사", date:"2026-06-05", endDate:"2026-06-09", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:602, name:"[4/15개강] 기말고사", date:"2026-07-24", endDate:"2026-07-28", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:701, name:"[5/13개강] 중간고사", date:"2026-07-03", endDate:"2026-07-07", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:702, name:"[5/13개강] 기말고사", date:"2026-08-21", endDate:"2026-08-25", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:801, name:"[5/20개강] 중간고사", date:"2026-07-10", endDate:"2026-07-14", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:802, name:"[5/20개강] 기말고사", date:"2026-08-28", endDate:"2026-09-01", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:901, name:"[6/10개강] 중간고사", date:"2026-07-31", endDate:"2026-08-04", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:902, name:"[6/10개강] 기말고사", date:"2026-09-18", endDate:"2026-09-22", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:1001, name:"[7/15개강] 중간고사", date:"2026-09-04", endDate:"2026-09-08", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:1002, name:"[7/15개강] 기말고사", date:"2026-10-23", endDate:"2026-10-27", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:1101, name:"[8/12개강] 중간고사", date:"2026-10-02", endDate:"2026-10-06", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:1102, name:"[8/12개강] 기말고사", date:"2026-11-20", endDate:"2026-11-24", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:1201, name:"[9/9개강] 중간고사", date:"2026-10-30", endDate:"2026-11-03", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
  { id:1202, name:"[9/9개강] 기말고사", date:"2026-12-18", endDate:"2026-12-22", time:"17:00 ~ 17:00", place:"온라인", status:"upcoming" },
];

const initialNotices = [
  { id:16, tag:"important", title:"📄 9월 9일 개강 학사일정 안내 (26년 2학기)", date:"2026-07-30", content:"2026년 9월 9일 개강 학사일정이 등록되었습니다. (2학기)\n\n▶ 학습기간: 2026-09-09 ~ 2026-12-22\n\n▶ 주요 일정\n• 1차 학습평가: 2026-10-02 ~ 10-05\n• 중간고사: 2026-10-30 ~ 11-03\n• 과제물 제출: 2026-11-04 ~ 11-17\n• 2차 학습평가: 2026-11-27 ~ 11-30\n• 기말고사: 2026-12-18 ~ 12-22\n• 성적보고 완료: 2027-01-07\n\n▶ 사회복지현장실습 출석수업 (3회 필수 참석)\n• 오리엔테이션: 2026-09-12(토)\n• 중간평가회: 2026-10-31(토)\n• 최종평가회: 2026-12-19(토)\n\n▶ 보육교사 대면교과목 수업일정 [1~7분반]\n• 아동관찰및행동연구: 2026-11-08(일) (8분반 2026-10-25)\n• 아동동작: 2026-11-07(토) (8분반 2026-10-24)\n• 아동권리와복지: 2026-11-22(일) (8분반 2026-11-01)\n• 언어지도: 2026-11-21(토) (8분반 2026-09-12)\n• 놀이지도: 2026-11-28(토) (8분반 2026-11-14)\n• 아동수학지도: 2026-12-06(일) (8분반 2026-11-29)\n• 아동생활지도: 2026-12-05(토) (8분반 2026-12-12)\n\n※ 사회복지현장실습 과목 수강자는 출석수업 3회로 평가하며, 실습 과목의 온라인 중간/기말고사는 없습니다.\n※ 수강 인원 20명 미만 시 폐강\n자세한 내용은 첨부 PDF를 확인하세요.", pdfUrl:"/2026년 9월9일 학사일정.pdf", isNew:true },
  { id:15, tag:"important", title:"📄 9월 9일 개강 현장실습 일정 안내 (26년 2학기)", date:"2026-06-29", content:"2026년 9월 9일 개강 사회복지현장실습 일정이 등록되었습니다. (2학기)\n\n▶ 학습기간: 2026-09-09 ~ 2026-12-22\n\n▶ 사회복지현장실습 출석수업 (3회 필수 참석)\n• 오리엔테이션: 2026-09-12(토)\n• 중간평가회: 2026-10-31(토)\n• 최종평가회: 2026-12-19(토)\n\n※ 사회복지현장실습 과목은 온라인 중간/기말고사를 시행하지 않습니다. (같은 개강반의 이론과목 시험 일정은 「9월 9일 개강 학사일정 안내」 참조)\n※ 출석수업 3회는 모두 필수 참석입니다.\n위 일정은 교육원 사정에 의해 변경될 수 있습니다.", isNew:true },
  { id:14, tag:"important", title:"📄 8월 12일 개강 학사일정 안내 (26년 2학기)", date:"2026-06-16", content:"2026년 8월 12일 개강 학사일정이 등록되었습니다. (2학기)\n\n▶ 학습기간: 2026-08-12 ~ 2026-11-24\n\n▶ 주요 일정\n• 1차 학습평가: 2026-09-04 ~ 09-07\n• 중간고사: 2026-10-02 ~ 10-06\n• 과제물 제출: 2026-10-07 ~ 10-20\n• 2차 학습평가: 2026-10-30 ~ 11-02\n• 기말고사: 2026-11-20 ~ 11-24\n• 성적보고 완료: 2026-12-10\n\n※ 사회복지현장실습 / 보육실습 / 대면교과목 출석수업: 미운영\n\n※ 수강 인원 20명 미만 시 폐강\n위 일정은 교육원 사정에 의해 변경될 수 있습니다.", isNew:true },
  { id:13, tag:"important", title:"📄 7월 15일 개강 학사일정 안내 (26년 2학기)", date:"2026-06-09", content:"2026년 7월 15일 개강 학사일정이 등록되었습니다. (2학기)\n\n▶ 학습기간: 2026-07-15 ~ 2026-10-27\n\n▶ 주요 일정\n• 1차 학습평가: 2026-08-07 ~ 08-10\n• 중간고사: 2026-09-04 ~ 09-08\n• 과제물 제출: 2026-09-09 ~ 09-22\n• 2차 학습평가: 2026-10-02 ~ 10-05\n• 기말고사: 2026-10-23 ~ 10-27\n• 성적보고 완료: 2026-11-12\n\n▶ 사회복지현장실습 출석수업 (3회 참석, 본원 과목 수강자)\n• 오리엔테이션: 2026-07-18(토)\n• 중간평가회: 2026-09-05(토)\n• 최종평가회: 2026-10-24(토)\n\n▶ 보육교사 대면교과목 수업일정\n• 아동동작: 2026-08-29(토)\n• 아동관찰및행동연구: 2026-08-30(일)\n• 언어지도: 2026-09-12(토)\n• 아동권리와복지: 2026-09-13(일)\n• 놀이지도: 2026-09-19(토)\n• 아동생활지도: 2026-10-17(토)\n• 아동수학지도: 2026-10-18(일)\n\n※ 수강 인원 20명 미만 시 폐강\n위 일정은 교육원 사정에 의해 변경될 수 있습니다.", isNew:true },
  { id:12, tag:"important", title:"📄 6월 10일 개강 학사일정 안내 (26년 2학기)", date:"2026-05-22", content:"2026년 6월 10일 개강 학사일정이 등록되었습니다. (2학기)\n\n▶ 학습기간: 2026-06-10 ~ 2026-09-22\n\n▶ 주요 일정\n• 1차 학습평가: 2026-07-03 ~ 07-06\n• 중간고사: 2026-07-31 ~ 08-04\n• 과제물 제출: 2026-08-05 ~ 08-18\n• 2차 학습평가: 2026-08-28 ~ 08-31\n• 기말고사: 2026-09-18 ~ 09-22\n• 성적보고 완료: 2026-10-08\n\n※ 사회복지현장실습 / 보육실습 / 대면교과목 출석수업: 미운영\n\n자세한 내용은 첨부 PDF를 확인하세요.", pdfUrl:"/2026년 6월10일 학사일정.pdf", isNew:true },
  { id:7, tag:"important", title:"📄 5월 20일 개강 학사일정 안내 (26년 2학기)", date:"2026-05-07", content:"2026년 5월 20일 개강 학사일정이 등록되었습니다. (2학기)\n\n▶ 학습기간: 2026-05-20 ~ 2026-09-01\n\n▶ 주요 일정\n• 1차 학습평가: 2026-06-12 ~ 06-15\n• 중간고사: 2026-07-10 ~ 07-14\n• 과제물 제출: 2026-07-15 ~ 07-28\n• 2차 학습평가: 2026-08-07 ~ 08-10\n• 기말고사: 2026-08-28 ~ 09-01\n• 성적보고 완료: 2026-09-17\n\n※ 사회복지현장실습 / 보육실습 / 대면교과목 출석수업: 미운영\n\n자세한 내용은 첨부 PDF를 확인하세요.", pdfUrl:"/2026년 5월20일 학사일정.pdf", isNew:true },
  { id:6, tag:"important", title:"📄 5월 13일 개강 학사일정 안내 (26년 1학기)", date:"2026-05-07", content:"2026년 5월 13일 개강 학사일정이 등록되었습니다. (1학기)\n\n▶ 학습기간: 2026-05-13 ~ 2026-08-25\n\n▶ 주요 일정\n• 1차 학습평가: 2026-06-05 ~ 06-08\n• 중간고사: 2026-07-03 ~ 07-07\n• 과제물 제출: 2026-07-08 ~ 07-21\n• 2차 학습평가: 2026-07-31 ~ 08-03\n• 기말고사: 2026-08-21 ~ 08-25\n• 성적보고 완료: 2026-09-10\n\n▶ 사회복지현장실습 출석수업\n• 오리엔테이션: 2026-05-16(토)\n• 중간평가회: 2026-07-04(토)\n• 최종평가회: 2026-08-22(토)\n\n▶ 보육교사 대면교과목 수업일정\n• 아동관찰및행동연구: 2026-06-27(토)\n• 아동동작: 2026-06-28(일)\n• 아동권리와복지: 2026-07-11(토)\n• 언어지도: 2026-07-12(일)\n• 놀이지도: 2026-07-26(일)\n• 아동수학지도: 2026-08-08(토)\n• 아동생활지도: 2026-08-09(일)\n\n※ 수강 인원 20명 미만 시 폐강\n자세한 내용은 첨부 PDF를 확인하세요.", pdfUrl:"/2026년 5월13일 학사일정.pdf", isNew:true },
  { id:10, tag:"important", title:"📄 4월 15일 개강 학사일정 안내 (26년 1학기)", date:"2026-04-08", content:"2026년 4월 15일 개강 학사일정이 등록되었습니다. (1학기)\n\n▶ 학습기간: 2026-04-15 ~ 2026-07-28\n\n▶ 주요 일정\n• 1차 학습평가: 2026-05-08 ~ 05-11\n• 중간고사: 2026-06-05 ~ 06-09\n• 과제물 제출: 2026-06-10 ~ 06-23\n• 2차 학습평가: 2026-07-03 ~ 07-06\n• 기말고사: 2026-07-24 ~ 07-28\n• 성적보고 완료: 2026-08-13\n\n※ 사회복지현장실습 / 보육실습 / 대면교과목 출석수업: 미운영\n\n자세한 내용은 첨부 PDF를 확인하세요.", pdfUrl:"/2026년 4월15일 학사일정.pdf", isNew:false },
  { id:1, tag:"important", title:"2026년 1학기 학사일정 안내 (8개 개강일)", date:"2026-03-23", content:"2026년 1학기 학사일정이 등록되었습니다.\n\n▶ 개강일별 일정\n• 11월 26일 개강: ~2026.03.10\n• 12월 10일 개강: ~2026.03.24\n• 1월 14일 개강: ~2026.04.28\n• 2월 11일 개강: ~2026.05.26\n• 3월 11일 개강: ~2026.06.23\n• 4월 15일 개강: ~2026.07.28\n• 5월 13일 개강: ~2026.08.25\n• 5월 20일 개강: ~2026.09.01\n\n위 일정은 교육원 사정에 의해 변경될 수 있으며, 변경 시 사전에 공지됩니다.", isNew:true },
  { id:2, tag:"exam", title:"중간고사 안내 - 개강일별 일정 확인 필수", date:"2026-03-23", content:"각 개강일별 중간고사 일정이 다르오니 본인의 개강일을 확인해주세요.\n\n• [11/26개강] 2026-01-16~01-20\n• [12/10개강] 2026-01-30~02-03\n• [1/14개강] 2026-03-06~03-10\n• [2/11개강] 2026-04-03~04-07\n• [3/11개강] 2026-05-01~05-05\n• [4/15개강] 2026-06-05~06-09\n• [5/13개강] 2026-07-03~07-07\n• [5/20개강] 2026-07-10~07-14", isNew:true },
  { id:3, tag:"important", title:"기말고사 안내 - 개강일별 일정 확인 필수", date:"2026-03-23", content:"각 개강일별 기말고사 일정이 다르오니 본인의 개강일을 확인해주세요.\n\n• [11/26개강] 2026-03-06~03-10\n• [12/10개강] 2026-03-20~03-24\n• [1/14개강] 2026-04-24~04-28\n• [2/11개강] 2026-05-22~05-26\n• [3/11개강] 2026-06-19~06-23\n• [4/15개강] 2026-07-24~07-28\n• [5/13개강] 2026-08-21~08-25\n• [5/20개강] 2026-08-28~09-01", isNew:true },
  { id:4, tag:"general", title:"대면교과목 출석수업 일정 안내 (3/11개강)", date:"2026-03-11", content:"3월 11일 개강 학생 대상 대면교과목 일정입니다.\n\n• 아동관찰및행동연구: 2026-05-09(토)\n• 아동동작: 2026-05-10(일)\n• 아동권리와복지: 2026-05-30(토)\n• 언어지도: 2026-05-31(일)\n• 놀이지도: 2026-06-07(일)\n• 아동수학지도: 2026-06-13(토)\n• 아동생활지도: 2026-06-14(일)\n\n※ 8분반 별도 일정 있음. 수강 인원 20명 미만 시 폐강.", isNew:false },
  { id:9, tag:"important", title:"📄 3월 11일 개강 학사일정 안내 (26년 1학기)", date:"2026-03-04", content:"2026년 3월 11일 개강 학사일정이 등록되었습니다. (1학기)\n\n▶ 학습기간: 2026-03-11 ~ 2026-06-23\n\n▶ 주요 일정\n• 1차 학습평가: 2026-04-03 ~ 04-06\n• 중간고사: 2026-05-01 ~ 05-05\n• 과제물 제출: 2026-05-06 ~ 05-19\n• 2차 학습평가: 2026-05-29 ~ 06-01\n• 기말고사: 2026-06-19 ~ 06-23\n• 성적보고 완료: 2026-07-09\n\n▶ 사회복지현장실습 출석수업\n• 오리엔테이션: 2026-03-14(토) / 2026-03-15(일)\n• 중간평가회: 2026-04-25(토) / 2026-04-26(일)\n• 최종평가회: 2026-06-20(토) / 2026-06-21(일)\n\n▶ 보육교사 대면교과목 수업일정\n• 아동관찰및행동연구: 2026-05-09(토) (8분반 2026-03-28)\n• 아동동작: 2026-05-10(일) (8분반 2026-03-29)\n• 아동권리와복지: 2026-05-30(토) (8분반 2026-04-04)\n• 언어지도: 2026-05-31(일) (8분반 2026-04-05)\n• 놀이지도: 2026-06-07(일) (8분반 2026-04-12)\n• 아동수학지도: 2026-06-13(토) (8분반 2026-04-18)\n• 아동생활지도: 2026-06-14(일) (8분반 2026-04-19)\n\n※ 수강 인원 20명 미만 시 폐강\n자세한 내용은 첨부 PDF를 확인하세요.", pdfUrl:"/2026년 3월11일 학사일정.pdf", isNew:false },
  { id:8, tag:"important", title:"📄 2월 11일 개강 학사일정 안내 (26년 1학기)", date:"2026-02-04", content:"2026년 2월 11일 개강 학사일정이 등록되었습니다. (1학기)\n\n▶ 학습기간: 2026-02-11 ~ 2026-05-26\n\n▶ 주요 일정\n• 1차 학습평가: 2026-03-06 ~ 03-09\n• 중간고사: 2026-04-03 ~ 04-07\n• 과제물 제출: 2026-04-08 ~ 04-21\n• 2차 학습평가: 2026-05-01 ~ 05-04\n• 기말고사: 2026-05-22 ~ 05-26\n• 성적보고 완료: 2026-06-11\n\n※ 사회복지현장실습 / 대면교과목 출석수업: 미운영\n※ 보육실습 오리엔테이션: 2025-06-14(토) (과거)\n\n자세한 내용은 첨부 PDF를 확인하세요.", pdfUrl:"/2026년 2월11일 학사일정.pdf", isNew:false },
  { id:11, tag:"important", title:"📄 1월 14일 개강 학사일정 안내 (26년 1학기)", date:"2026-01-07", content:"2026년 1월 14일 개강 학사일정이 등록되었습니다. (1학기)\n\n▶ 학습기간: 2026-01-14 ~ 2026-04-28\n\n▶ 주요 일정\n• 1차 학습평가: 2026-02-06 ~ 02-09\n• 중간고사: 2026-03-06 ~ 03-10\n• 과제물 제출: 2026-03-11 ~ 03-24\n• 2차 학습평가: 2026-04-03 ~ 04-06\n• 기말고사: 2026-04-24 ~ 04-28\n• 성적보고 완료: 2026-05-14\n\n※ 사회복지현장실습 / 대면교과목 출석수업: 미운영\n※ 보육실습 오리엔테이션: 2025-06-14(토) (과거)\n\n자세한 내용은 첨부 PDF를 확인하세요.", pdfUrl:"/2026년 1월14일 학사일정.pdf", isNew:false },
];

const MONTHS_KO = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["일","월","화","수","목","금","토"];

const tagStyle = {
  important: { bg:"rgba(233,30,140,0.12)", color:"#E91E8C", label:"중요" },
  exam:      { bg:"rgba(123,108,246,0.12)", color:"#7B6CF6", label:"시험" },
  general:   { bg:"rgba(74,144,217,0.12)",  color:"#4A90D9", label:"일반" },
};
const statusStyle = {
  soon:     { bg:"rgba(244,114,182,0.15)", color:"#E91E8C", label:"진행중" },
  upcoming: { bg:"rgba(46,204,154,0.15)",  color:"#2ECC9A", label:"예정" },
  closed:   { bg:"rgba(107,114,128,0.1)",  color:"#9CA3AF", label:"종료" },
};

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

// 날짜 문자열 → Date (자정 기준)
function toDate(str) {
  const [y,m,d] = str.split("-").map(Number);
  return new Date(y, m-1, d);
}

// 특정 날짜가 고사 기간에 속하는지 체크
function getExamPeriodForDay(year, month, day) {
  const target = new Date(year, month, day);
  for (const ep of examPeriods) {
    const s = toDate(ep.start);
    const e = toDate(ep.end);
    if (target >= s && target <= e) return ep;
  }
  return null;
}

function getPracticePeriodForDay(year, month, day) {
  const target = new Date(year, month, day);
  for (const ep of practicePeriods) {
    const s = toDate(ep.start);
    const e = toDate(ep.end);
    if (target >= s && target <= e) return ep;
  }
  return null;
}

function Calendar({ students = [] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i=0; i<firstDay; i++) cells.push({ day: daysInPrev-firstDay+1+i, type:"prev" });
  for (let d=1; d<=daysInMonth; d++) cells.push({ day:d, type:"cur" });
  const rem = (firstDay+daysInMonth)%7;
  if (rem>0) for (let i=1; i<=7-rem; i++) cells.push({ day:i, type:"next" });

  // 선택된 날짜 일정
  const selectedExamPeriod = selectedDay ? getExamPeriodForDay(year, month, selectedDay) : null;
  const selectedPracticePeriod = selectedDay ? getPracticePeriodForDay(year, month, selectedDay) : null;

  function prev() { if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1); setSelectedDay(null); }
  function next() { if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1); setSelectedDay(null); }

  return (
    <div>
      {/* 월 이동 */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <button onClick={prev} style={navBtnStyle}>‹</button>
        <span style={{ fontWeight:700, fontSize:15, background:GRAD, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          {year}년 {MONTHS_KO[month]}
        </span>
        <button onClick={next} style={navBtnStyle}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:2 }}>
        {DAYS.map((d,i) => (
          <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, padding:"5px 0",
            color: i===0?"#EF4444": i===6?"#4A90D9":"#6B7280" }}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((c, i) => {
          const dow = i % 7;
          const isToday = c.type==="cur" && today.getFullYear()===year && today.getMonth()===month && today.getDate()===c.day;
          const isSelected = c.type==="cur" && selectedDay===c.day;
          const ep = c.type==="cur" ? getExamPeriodForDay(year, month, c.day) : null;
          const pp = c.type==="cur" && !ep ? getPracticePeriodForDay(year, month, c.day) : null;
          const isMid = ep?.type === "mid";
          const isFinal = ep?.type === "final";
          const isPractice = pp?.type === "practice";

          // 기간 내 첫날/마지막날 체크 (둥근 모서리용)
          const period = ep || pp;
          const isStart = period && toDate(period.start).getDate()===c.day && toDate(period.start).getMonth()===month && toDate(period.start).getFullYear()===year;
          const isEnd = period && toDate(period.end).getDate()===c.day && toDate(period.end).getMonth()===month && toDate(period.end).getFullYear()===year;

          let bg = "transparent";
          let color = c.type!=="cur" ? "#D1D5DB" : dow===0 ? "#EF4444" : dow===6 ? "#4A90D9" : "#1A1A2E";
          let borderRadius = "8px";
          let fontWeight = 500;

          if (isToday) { bg = GRAD; color = "white"; fontWeight = 700; }
          else if (isSelected) { bg = "rgba(123,108,246,0.18)"; fontWeight = 700; }
          else if (isMid) {
            bg = "rgba(233,30,140,0.13)";
            color = "#C2185B";
            fontWeight = 600;
            if (isStart) borderRadius = "8px 0 0 8px";
            else if (isEnd) borderRadius = "0 8px 8px 0";
            else borderRadius = "0";
          } else if (isFinal) {
            bg = "rgba(123,108,246,0.15)";
            color = "#5E35B1";
            fontWeight = 600;
            if (isStart) borderRadius = "8px 0 0 8px";
            else if (isEnd) borderRadius = "0 8px 8px 0";
            else borderRadius = "0";
          } else if (isPractice) {
            bg = "rgba(14,116,144,0.15)";
            color = "#0E7490";
            fontWeight = 600;
            if (isStart) borderRadius = "8px 0 0 8px";
            else if (isEnd) borderRadius = "0 8px 8px 0";
            else borderRadius = "0";
          }

          return (
            <div key={i} onClick={()=>c.type==="cur"&&setSelectedDay(isSelected?null:c.day)}
              style={{
                aspectRatio:"1", display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", fontSize:12, fontWeight, background: bg, color,
                borderRadius, position:"relative", cursor: c.type==="cur"?"pointer":"default",
                outline: isSelected ? "2px solid #7B6CF6" : "none",
                outlineOffset: "-1px",
              }}>
              {c.day}
              {/* 중간/기말/실습 라벨 - 시작일에만 */}
              {isStart && !isToday && (
                <div style={{
                  position:"absolute", top:1, right:2, fontSize:7, fontWeight:800,
                  color: isMid ? "#E91E8C" : isFinal ? "#7B6CF6" : "#0E7490", lineHeight:1,
                }}>
                  {isMid ? "중" : isFinal ? "기" : "실"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 선택된 날 이벤트 */}
      {selectedDay && (selectedExamPeriod || selectedPracticePeriod) && (
        <div style={{ marginTop:12, padding:"12px 14px", background:"rgba(123,108,246,0.06)", borderRadius:12, border:"1px solid rgba(123,108,246,0.15)" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#7B6CF6", marginBottom:8 }}>
            {month+1}월 {selectedDay}일 일정
          </div>
          {[selectedExamPeriod, selectedPracticePeriod].filter(Boolean).map((p, pi) => {
            const isMidT = p.type==="mid", isFinalT = p.type==="final", isPracT = p.type==="practice";
            const matched = isPracT
              ? (p.attendees || []).map(name => ({ name }))
              : matchExamStudents(students, p.label);
            const badge = isMidT
              ? { bg:"rgba(233,30,140,0.15)", color:"#E91E8C", label:"중간고사" }
              : isFinalT
                ? { bg:"rgba(123,108,246,0.15)", color:"#7B6CF6", label:"기말고사" }
                : { bg:"rgba(14,116,144,0.15)", color:"#0E7490", label:"실습" };
            const chip = isPracT
              ? { bg:"rgba(14,116,144,0.1)", color:"#0E7490" }
              : { bg:"rgba(123,108,246,0.1)", color:"#7B6CF6" };
            return (
              <div key={pi} style={{ marginBottom: pi===0 ? 8 : 0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ padding:"2px 8px", borderRadius:4, fontSize:10, fontWeight:800, background:badge.bg, color:badge.color }}>
                    {badge.label}
                  </span>
                  <span style={{ fontSize:12, color:"#374151", fontWeight:600 }}>{p.label}</span>
                </div>
                {matched.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:6 }}>
                    {matched.map((st, i) => (
                      <span key={i} style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:chip.bg, color:chip.color }}>
                        {maskName(st.name)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 범례 */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:12 }}>
        {[
          { color:"rgba(233,30,140,0.3)", label:"중간고사" },
          { color:"rgba(123,108,246,0.3)", label:"기말고사" },
          { color:"rgba(14,116,144,0.3)", label:"실습" },
        ].map(l=>(
          <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:l.color }}/>
            <span style={{ fontSize:10, color:"#6B7280" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const navBtnStyle = {
  width:32, height:32, border:"1px solid rgba(123,108,246,0.2)", background:"#fff",
  borderRadius:8, cursor:"pointer", fontSize:16, color:"#6B7280",
};

function ExamItem({ exam, students = [] }) {
  const d = new Date(exam.date);
  const s = statusStyle[autoStatus(exam)];
  const matched = matchExamStudents(students, exam.name);
  return (
    <div style={{ padding:"13px 0", borderBottom:"1px solid rgba(123,108,246,0.08)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ minWidth:44, textAlign:"center", padding:"7px 6px", borderRadius:10, background:GRAD, color:"white", flexShrink:0 }}>
          <div style={{ fontSize:9, opacity:0.85 }}>{MONTHS_EN[d.getMonth()]}</div>
          <div style={{ fontSize:18, fontWeight:900, lineHeight:1 }}>{String(d.getDate()).padStart(2,"0")}</div>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{exam.name}</div>
          <div style={{ fontSize:11, color:"#6B7280" }}>📅 {exam.date} ~ {exam.endDate}</div>
          <div style={{ fontSize:11, color:"#6B7280" }}>📍 {exam.place}</div>
        </div>
        <span style={{ padding:"3px 8px", borderRadius:20, fontSize:10, fontWeight:700, background:s.bg, color:s.color, flexShrink:0 }}>{s.label}</span>
      </div>
      {matched.length > 0 && (
        <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:6, paddingLeft:56 }}>
          {matched.map((st, i) => (
            <span key={i} style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:"rgba(123,108,246,0.1)", color:"#7B6CF6" }}>
              {maskName(st.name)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function NoticeItem({ notice, onClick }) {
  const t = tagStyle[notice.tag];
  return (
    <div onClick={onClick} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"13px 0", borderBottom:"1px solid rgba(123,108,246,0.08)", cursor:"pointer" }}>
      <span style={{ padding:"3px 7px", borderRadius:6, fontSize:10, fontWeight:700, background:t.bg, color:t.color, whiteSpace:"nowrap", marginTop:2, flexShrink:0 }}>{t.label}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {notice.title}
          {notice.isNew && <span style={{ background:"#E91E8C", color:"white", fontSize:9, fontWeight:700, padding:"2px 4px", borderRadius:4, marginLeft:5 }}>N</span>}
        </div>
        <div style={{ fontSize:11, color:"#9CA3AF" }}>{notice.date}</div>
      </div>
      <span style={{ fontSize:14, color:"#D1D5DB", flexShrink:0, marginTop:2 }}>›</span>
    </div>
  );
}

function Card({ icon, title, children, style, bodyStyle }) {
  return (
    <div style={{ background:"#fff", borderRadius:16, boxShadow:"0 2px 16px rgba(123,108,246,0.08)", border:"1px solid rgba(123,108,246,0.12)", overflow:"hidden", ...style }}>
      {title && (
        <div style={{ padding:"16px 18px 12px", borderBottom:"1px solid rgba(123,108,246,0.08)", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:"rgba(123,108,246,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>{icon}</div>
          <div style={{ fontSize:14, fontWeight:700 }}>{title}</div>
        </div>
      )}
      <div style={{ padding:"16px 18px", ...bodyStyle }}>{children}</div>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(26,26,46,0.55)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"28px 20px 40px", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ width:36, height:4, borderRadius:2, background:"#E5E7EB", margin:"0 auto 20px" }}/>
        {title && <div style={{ fontWeight:700, fontSize:17, marginBottom:20, background:GRAD, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

function FormInput({ label, as, children, ...props }) {
  const base = { width:"100%", padding:"11px 14px", border:"1.5px solid rgba(123,108,246,0.2)", borderRadius:12, fontFamily:"inherit", fontSize:14, color:"#1A1A2E", background:"#F8F9FD", outline:"none", boxSizing:"border-box" };
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</label>
      {as==="select" ? <select {...props} style={base}>{children}</select>
       : as==="textarea" ? <textarea {...props} style={{ ...base, resize:"vertical", minHeight:80 }}/>
       : <input {...props} style={base}/>}
    </div>
  );
}

function BottomNav({ page, setPage, onAdminTap }) {
  const items = [
    { key:"home", icon:"🏠", label:"홈" },
    { key:"exam", icon:"📅", label:"시험일정" },
    { key:"notice", icon:"📢", label:"공지사항" },
    { key:"admin", icon:"⚙️", label:"관리자" },
  ];
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1px solid rgba(123,108,246,0.15)", display:"flex", zIndex:200, paddingBottom:"env(safe-area-inset-bottom)", boxShadow:"0 -4px 20px rgba(0,0,0,0.08)" }}>
      {items.map(it => {
        const active = page===it.key;
        return (
          <button key={it.key} onClick={()=>it.key==="admin"?onAdminTap():setPage(it.key)}
            style={{ flex:1, padding:"10px 0 8px", border:"none", background:"transparent", display:"flex", flexDirection:"column", alignItems:"center", gap:2, cursor:"pointer" }}>
            <span style={{ fontSize:20 }}>{it.icon}</span>
            <span style={{ fontSize:10, fontWeight:active?700:500, color:active?"#7B6CF6":"#9CA3AF" }}>{it.label}</span>
            {active && <div style={{ width:4, height:4, borderRadius:2, background:"#7B6CF6" }}/>}
          </button>
        );
      })}
    </div>
  );
}

function DesktopHeader({ page, setPage, isAdmin, onAdminTap }) {
  return (
    <div style={{ background:"#fff", borderBottom:"2px solid transparent", borderImage:`${GRAD} 1`, padding:"0 32px", display:"flex", alignItems:"center", justifyContent:"space-between", height:64, position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 16px rgba(0,0,0,0.06)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:38, height:38, background:GRAD, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:900, fontSize:13 }}>서원</div>
        <div>
          <div style={{ fontSize:15, fontWeight:700 }}>서울원격평생교육원</div>
          <div style={{ fontSize:11, color:"#6B7280" }}>학사일정 · 공지사항 포털</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:4 }}>
        {[{k:"home",l:"🏠 홈"},{k:"exam",l:"📅 시험일정"},{k:"notice",l:"📢 공지사항"}].map(n=>(
          <button key={n.k} onClick={()=>setPage(n.k)} style={{ padding:"8px 16px", border:"none", borderRadius:8, fontFamily:"inherit", fontSize:14, fontWeight:page===n.k?700:500, cursor:"pointer", background:page===n.k?"rgba(123,108,246,0.1)":"transparent", color:page===n.k?"#7B6CF6":"#6B7280" }}>{n.l}</button>
        ))}
      </div>
      <button onClick={onAdminTap} style={{ padding:"9px 18px", background:GRAD, border:"none", borderRadius:10, color:"white", fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer" }}>
        {isAdmin?"⚙️ 관리자":"🔐 관리자"}
      </button>
    </div>
  );
}

export default function App() {
  const isMobile = useIsMobile();
  const [page, setPage] = useState("home");
  const [exams, setExams] = useState(initialExams);
  const [notices, setNotices] = useState(initialNotices);
  const [students, setStudents] = useState([]);
  const [examSearch, setExamSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [studentHeaders, setStudentHeaders] = useState([]);
  const [studentRows, setStudentRows] = useState([]);

  useEffect(() => {
    fetch(CSV_URL)
      .then(r => r.text())
      .then(text => {
        // CSV 파서: 따옴표 안 쉼표 처리
        const parseLine = (line) => {
          const out = [];
          let cur = '';
          let inQ = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQ) {
              if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
              else if (ch === '"') { inQ = false; }
              else { cur += ch; }
            } else {
              if (ch === ',') { out.push(cur); cur = ''; }
              else if (ch === '"') { inQ = true; }
              else { cur += ch; }
            }
          }
          out.push(cur);
          return out.map(c => c.trim());
        };

        const lines = text.replace(/\r/g, '').trim().split('\n');
        if (lines.length === 0) return;
        const headers = parseLine(lines[0]);
        const rows = lines.slice(1).map(parseLine).filter(r => r[0]);

        // 개강반차수1/2/3 (또는 cols[1] 단일 개강반) 전부 매칭 키로 사용
        const ganIdxs = headers
          .map((h, i) => (h === '개강반' || h.startsWith('개강반차수')) ? i : -1)
          .filter(i => i >= 0);
        const silIdx = headers.findIndex(h => h === '실습개강일');
        const data = rows
          .map(cols => ({
            name: cols[0],
            classKeys: ganIdxs
              .map(i => dateToKey(cols[i] || ''))
              .filter(Boolean),
            // 실습 개강반은 시험 대상에서 제외 (시트 '실습개강일' + 보완 맵)
            practiceKeys: [
              silIdx >= 0 ? dateToKey(cols[silIdx] || '') : '',
              ...(PRACTICE_ONLY[cols[0]] || []),
            ].filter(Boolean),
          }))
          .filter(s => s.name && s.classKeys.length > 0);
        setStudents(data);

        setStudentHeaders(headers);
        setStudentRows(rows);
      })
      .catch(console.error);
  }, []);

  // 교육생 상세 — 검색·그룹핑
  const [studentSearch, setStudentSearch] = useState('');
  const [studentGroup, setStudentGroup] = useState('all'); // 'all' | 개강반값
  const [adminTab, setAdminTab] = useState("exams");
  const [loginOpen, setLoginOpen] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeDetailOpen, setNoticeDetailOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginErr, setLoginErr] = useState(false);
  const [editExam, setEditExam] = useState(null);
  const [editNotice, setEditNotice] = useState(null);
  const [eName,setEName]=useState(""); const [eDate,setEDate]=useState(""); const [eEndDate,setEEndDate]=useState("");
  const [ePlace,setEPlace]=useState(""); const [eStatus,setEStatus]=useState("upcoming");
  const [nTag,setNTag]=useState("general"); const [nTitle,setNTitle]=useState(""); const [nContent,setNContent]=useState("");

  const today = new Date(); today.setHours(0,0,0,0);
  const nextExam = exams.filter(e=>e.status!=="closed").map(e=>({...e,d:new Date(e.date)})).filter(e=>e.d>=today).sort((a,b)=>a.d-b.d)[0];
  const dday = nextExam ? Math.ceil((nextExam.d-today)/(1000*60*60*24)) : null;

  function onAdminTap() {
    if (isAdmin) setPage("admin");
    else { setLoginOpen(true); setLoginId(""); setLoginPw(""); setLoginErr(false); }
  }

  function doLogin() {
    if (loginId==="guzong"&&loginPw==="sotlawkd1") { setIsAdmin(true); setLoginOpen(false); setPage("admin"); }
    else setLoginErr(true);
  }

  function openExamForm(exam=null) {
    setEditExam(exam);
    setEName(exam?.name||""); setEDate(exam?.date||""); setEEndDate(exam?.endDate||"");
    setEPlace(exam?.place||""); setEStatus(exam?.status||"upcoming");
    setExamModalOpen(true);
  }

  function saveExam() {
    if (!eName||!eDate) return;
    if (editExam) setExams(exams.map(e=>e.id===editExam.id?{...e,name:eName,date:eDate,endDate:eEndDate,place:ePlace,status:eStatus}:e));
    else setExams([...exams,{id:Date.now(),name:eName,date:eDate,endDate:eEndDate,place:ePlace,status:eStatus}]);
    setExamModalOpen(false);
  }

  function openNoticeForm(notice=null) {
    setEditNotice(notice);
    setNTag(notice?.tag||"general"); setNTitle(notice?.title||""); setNContent(notice?.content||"");
    setNoticeModalOpen(true);
  }

  function saveNotice() {
    if (!nTitle) return;
    const d = new Date().toISOString().slice(0,10);
    if (editNotice) setNotices(notices.map(n=>n.id===editNotice.id?{...n,tag:nTag,title:nTitle,content:nContent}:n));
    else setNotices([{id:Date.now(),tag:nTag,title:nTitle,content:nContent,date:d,isNew:true},...notices]);
    setNoticeModalOpen(false);
  }

  const pb = isMobile ? 80 : 0;
  const px = isMobile ? 16 : 24;

  return (
    <div style={{ fontFamily:"'Apple SD Gothic Neo','Noto Sans KR',sans-serif", background:"#F8F9FD", minHeight:"100vh", color:"#1A1A2E" }}>

      {isMobile
        ? <BottomNav page={page} setPage={setPage} onAdminTap={onAdminTap}/>
        : <DesktopHeader page={page} setPage={setPage} isAdmin={isAdmin} onAdminTap={onAdminTap}/>
      }

      {isMobile && (
        <div style={{ background:GRAD, padding:"20px 20px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, background:"rgba(255,255,255,0.25)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:900, fontSize:13 }}>서원</div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"white" }}>서울원격평생교육원</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)" }}>학사일정 · 공지사항 포털</div>
          </div>
        </div>
      )}

      {!isMobile && page==="home" && (
        <div style={{ background:GRAD, padding:"48px 24px 40px", textAlign:"center" }}>
          <div style={{ fontWeight:900, fontSize:26, color:"white", marginBottom:6 }}>📚 서울원격평생교육원</div>
          <div style={{ color:"rgba(255,255,255,0.85)", fontSize:14 }}>2026년 1학기 학사일정 · 공지사항</div>
        </div>
      )}

      <div style={{ maxWidth: isMobile?480:1100, margin:"0 auto", padding:`${isMobile?16:28}px ${px}px ${pb}px` }}>

        {page==="home" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {/* D-Day */}
            <div style={{ background:GRAD, borderRadius:16, padding:"20px", color:"white", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:11, opacity:0.85, marginBottom:4 }}>다음 고사까지</div>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>{nextExam?.name||"-"}</div>
                <div style={{ fontSize:11, opacity:0.75 }}>{nextExam?.date||""} ~ {nextExam?.endDate||""}</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:11, opacity:0.85 }}>D-</div>
                <div style={{ fontSize:44, fontWeight:900, lineHeight:1 }}>{dday??"-"}</div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
              {[{n:exams.length,l:"전체"},{n:exams.filter(e=>e.status==="soon").length,l:"진행중"},{n:exams.filter(e=>e.status==="upcoming").length,l:"예정"},{n:notices.length,l:"공지"}].map(s=>(
                <div key={s.l} style={{ background:"#fff", borderRadius:12, padding:"12px 8px", textAlign:"center", border:"1px solid rgba(123,108,246,0.12)" }}>
                  <div style={{ fontWeight:900, fontSize:22, background:GRAD, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", lineHeight:1, marginBottom:4 }}>{s.n}</div>
                  <div style={{ fontSize:11, color:"#6B7280" }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* 캘린더 */}
            <Card icon="📅" title="학사일정 캘린더 (날짜 클릭 시 상세확인)">
              <Calendar students={students}/>
            </Card>

            {/* 고사 목록 */}
            <Card icon="📝" title="고사 일정">
              {exams.filter(e=>autoStatus(e)!=="closed").slice(0,4).map(e=><ExamItem key={e.id} exam={e} students={students}/>)}
            </Card>

            {/* 공지 */}
            <Card icon="📢" title="공지사항">
              {notices.slice(0,4).map(n=>(
                <NoticeItem key={n.id} notice={n} onClick={()=>{ setSelectedNotice(n); setNoticeDetailOpen(true); }}/>
              ))}
              <button onClick={()=>setPage("notice")} style={{ width:"100%", marginTop:12, padding:"10px", border:"1px solid rgba(123,108,246,0.2)", borderRadius:10, background:"transparent", fontFamily:"inherit", fontSize:13, color:"#7B6CF6", fontWeight:600, cursor:"pointer" }}>
                전체보기 →
              </button>
            </Card>
          </div>
        )}

        {page==="exam" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:16, fontWeight:700, padding:"4px 0" }}>📅 고사 일정</div>
            <Card icon="🔎" title="이름으로 내 시험 찾기">
              <input value={examSearch} onChange={e=>setExamSearch(e.target.value)} placeholder="이름 입력 (예: 홍길동)"
                style={{ width:"100%", boxSizing:"border-box", padding:"12px 14px", border:"1px solid #ddd", borderRadius:12, fontFamily:"inherit", fontSize:15, outline:"none" }} />
              {examSearch.trim() && (()=>{
                const q = examSearch.trim();
                const matched = students.filter(s => s.name.includes(q));
                if (matched.length === 0) return <div style={{ padding:"12px 4px", color:"#888", fontSize:14 }}>일치하는 교육생이 없습니다.</div>;
                return matched.map(s => {
                  const my = exams.filter(e => getExamKeysFromName(e.name).some(k => s.classKeys.includes(k)))
                    .sort((a,b) => new Date(a.date) - new Date(b.date));
                  return (
                    <div key={s.name} style={{ marginTop:12, padding:"12px 14px", border:"1px solid #eee", borderRadius:12, background:"#fafbff" }}>
                      <div style={{ fontWeight:700, marginBottom:8 }}>{s.name} <span style={{ fontSize:12, color:"#999", fontWeight:400 }}>({s.classKeys.join(", ")}개강)</span></div>
                      {my.length ? my.map(e => { const st = statusStyle[autoStatus(e)]; return (
                        <div key={e.id} style={{ display:"flex", justifyContent:"space-between", gap:10, fontSize:13, padding:"4px 0", borderTop:"1px solid #f2f2f2" }}>
                          <span>{e.name}</span>
                          <span style={{ color:st.color, whiteSpace:"nowrap" }}>{e.date} ~ {e.endDate} <b>{st.label}</b></span>
                        </div>
                      ); }) : <div style={{ fontSize:12, color:"#888" }}>등록된 시험 없음</div>}
                    </div>
                  );
                });
              })()}
            </Card>
            <Card icon="📅" title="캘린더">
              <Calendar students={students}/>
            </Card>
            <Card>
              {exams.filter(e=>autoStatus(e)!=="closed").map(e=><ExamItem key={e.id} exam={e} students={students}/>)}
            </Card>
          </div>
        )}

        {page==="notice" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:16, fontWeight:700, padding:"4px 0" }}>📢 전체 공지사항</div>
            <Card>
              {notices.map(n=>(
                <NoticeItem key={n.id} notice={n} onClick={()=>{ setSelectedNotice(n); setNoticeDetailOpen(true); }}/>
              ))}
            </Card>
          </div>
        )}

        {page==="admin" && isAdmin && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:16, fontWeight:700, padding:"4px 0" }}>⚙️ 관리자 페이지</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[{k:"exams",l:"📅 시험 관리"},{k:"notices",l:"📢 공지 관리"},{k:"students",l:"👥 교육생 상세"}].map(t=>(
                <button key={t.k} onClick={()=>setAdminTab(t.k)} style={{ flex:"1 1 30%", minWidth:0, padding:"11px 0", border:adminTab===t.k?"none":"1.5px solid rgba(123,108,246,0.2)", background:adminTab===t.k?GRAD:"#fff", borderRadius:12, fontFamily:"inherit", fontSize:13, fontWeight:600, color:adminTab===t.k?"white":"#6B7280", cursor:"pointer" }}>
                  {t.l}
                </button>
              ))}
            </div>

            {adminTab==="exams" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <button onClick={()=>openExamForm()} style={{ padding:"13px", background:GRAD, border:"none", borderRadius:12, color:"white", fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer" }}>＋ 시험 일정 등록</button>
                {exams.map(e=>(
                  <div key={e.id} style={{ background:"#fff", borderRadius:14, padding:"16px", border:"1px solid rgba(123,108,246,0.12)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div style={{ fontSize:14, fontWeight:700, flex:1, marginRight:8 }}>{e.name}</div>
                      <span style={{ padding:"3px 8px", borderRadius:20, fontSize:10, fontWeight:700, background:statusStyle[e.status].bg, color:statusStyle[e.status].color }}>{statusStyle[e.status].label}</span>
                    </div>
                    <div style={{ fontSize:12, color:"#6B7280", marginBottom:12 }}>📅 {e.date} ~ {e.endDate} &nbsp; 📍 {e.place}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>openExamForm(e)} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", background:"rgba(74,144,217,0.12)", color:"#4A90D9", fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer" }}>수정</button>
                      <button onClick={()=>setExams(exams.filter(x=>x.id!==e.id))} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", background:"rgba(233,30,140,0.1)", color:"#E91E8C", fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer" }}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab==="notices" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <button onClick={()=>openNoticeForm()} style={{ padding:"13px", background:GRAD, border:"none", borderRadius:12, color:"white", fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer" }}>＋ 공지사항 등록</button>
                {notices.map(n=>(
                  <div key={n.id} style={{ background:"#fff", borderRadius:14, padding:"16px", border:"1px solid rgba(123,108,246,0.12)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <span style={{ padding:"3px 8px", borderRadius:6, fontSize:10, fontWeight:700, background:tagStyle[n.tag].bg, color:tagStyle[n.tag].color }}>{tagStyle[n.tag].label}</span>
                      {n.isNew && <span style={{ background:"#E91E8C", color:"white", fontSize:9, fontWeight:700, padding:"2px 5px", borderRadius:4 }}>NEW</span>}
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, margin:"8px 0 4px" }}>{n.title}</div>
                    <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:12 }}>{n.date}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>openNoticeForm(n)} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", background:"rgba(74,144,217,0.12)", color:"#4A90D9", fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer" }}>수정</button>
                      <button onClick={()=>setNotices(notices.filter(x=>x.id!==n.id))} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", background:"rgba(233,30,140,0.1)", color:"#E91E8C", fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer" }}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab==="students" && (() => {
              // 컬럼 인덱스 찾기
              const nameIdx = 0; // 항상 첫 컬럼
              const gradeIdx = studentHeaders.findIndex(h => h === '개강반');
              // 그룹 옵션: 개강반 unique
              const groupOptions = Array.from(new Set(
                studentRows.map(r => (gradeIdx >= 0 ? r[gradeIdx] : '')).filter(Boolean)
              )).sort();

              // 필터
              const filtered = studentRows.filter(r => {
                const matchSearch = !studentSearch.trim() || (r[nameIdx] || '').includes(studentSearch.trim());
                const matchGroup = studentGroup === 'all' || (gradeIdx >= 0 && r[gradeIdx] === studentGroup);
                return matchSearch && matchGroup;
              });

              // 개강반별 그룹핑
              const byGroup = {};
              filtered.forEach(r => {
                const key = gradeIdx >= 0 ? (r[gradeIdx] || '미지정') : '전체';
                if (!byGroup[key]) byGroup[key] = [];
                byGroup[key].push(r);
              });
              const groupKeys = Object.keys(byGroup).sort();

              return (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {/* 통계 */}
                  <div style={{ background:"#fff", borderRadius:12, padding:"14px 16px", border:"1px solid rgba(123,108,246,0.12)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:11, color:"#6B7280", marginBottom:2 }}>전체 교육생</div>
                      <div style={{ fontSize:22, fontWeight:900, background:GRAD, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                        {studentRows.length}명
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:"#9CA3AF", textAlign:"right" }}>
                      필터 결과<br/>
                      <span style={{ fontSize:16, fontWeight:700, color:"#7B6CF6" }}>{filtered.length}명</span>
                    </div>
                  </div>

                  {/* 검색 박스 */}
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={e=>setStudentSearch(e.target.value)}
                    placeholder="🔍 이름으로 검색"
                    style={{
                      width:"100%", padding:"12px 14px",
                      border:"1.5px solid rgba(123,108,246,0.2)",
                      borderRadius:12, fontFamily:"inherit", fontSize:14,
                      background:"#fff", outline:"none", boxSizing:"border-box",
                    }}
                  />

                  {/* 개강반 필터 */}
                  <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
                    <button
                      onClick={()=>setStudentGroup('all')}
                      style={{
                        padding:"7px 13px", borderRadius:20, fontSize:12, fontWeight:600,
                        border:studentGroup==='all'?"none":"1.5px solid rgba(123,108,246,0.2)",
                        background:studentGroup==='all'?GRAD:"#fff",
                        color:studentGroup==='all'?"white":"#6B7280",
                        cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
                      }}
                    >전체</button>
                    {groupOptions.map(g => (
                      <button
                        key={g}
                        onClick={()=>setStudentGroup(g)}
                        style={{
                          padding:"7px 13px", borderRadius:20, fontSize:12, fontWeight:600,
                          border:studentGroup===g?"none":"1.5px solid rgba(123,108,246,0.2)",
                          background:studentGroup===g?GRAD:"#fff",
                          color:studentGroup===g?"white":"#6B7280",
                          cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
                        }}
                      >{g}</button>
                    ))}
                  </div>

                  {/* 개강반별 카드 그룹 */}
                  {studentHeaders.length === 0 && (
                    <div style={{ textAlign:"center", padding:"40px 20px", color:"#9CA3AF", fontSize:13 }}>
                      교육생 데이터 로딩 중...
                    </div>
                  )}

                  {groupKeys.map(gk => (
                    <div key={gk} style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                        <div style={{
                          padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700,
                          background:"rgba(123,108,246,0.12)", color:"#7B6CF6",
                        }}>📅 {gk}</div>
                        <span style={{ fontSize:11, color:"#9CA3AF" }}>{byGroup[gk].length}명</span>
                      </div>
                      {byGroup[gk].map((row, ri) => (
                        <div key={ri} style={{
                          background:"#fff", borderRadius:14, padding:"14px 16px",
                          border:"1px solid rgba(123,108,246,0.12)",
                          boxShadow:"0 1px 4px rgba(123,108,246,0.04)",
                        }}>
                          <div style={{ fontSize:15, fontWeight:700, marginBottom:8, color:"#1A1A2E" }}>
                            👤 {row[nameIdx]}
                          </div>
                          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(2, 1fr)", gap:"6px 14px" }}>
                            {studentHeaders.map((h, ci) => {
                              if (ci === nameIdx) return null;
                              const val = row[ci];
                              if (!val) return null;
                              return (
                                <div key={ci} style={{ display:"flex", gap:8, alignItems:"baseline", fontSize:12, lineHeight:1.5 }}>
                                  <span style={{ color:"#9CA3AF", fontWeight:600, minWidth:60, flexShrink:0 }}>{h}</span>
                                  <span style={{ color:"#374151", fontWeight:500, wordBreak:"break-all" }}>{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {filtered.length === 0 && studentHeaders.length > 0 && (
                    <div style={{ textAlign:"center", padding:"30px 20px", color:"#9CA3AF", fontSize:13 }}>
                      검색 결과가 없습니다.
                    </div>
                  )}

                  <div style={{ fontSize:10, color:"#9CA3AF", textAlign:"center", marginTop:6, lineHeight:1.6 }}>
                    데이터 출처: Google Sheets (sync.py로 동기화)<br/>
                    개인정보 보호 — 관리자만 열람 가능
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {page==="admin" && !isAdmin && (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🔐</div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>관리자 로그인이 필요합니다</div>
            <button onClick={()=>{ setLoginOpen(true); setLoginId(""); setLoginPw(""); setLoginErr(false); }} style={{ padding:"13px 32px", background:GRAD, border:"none", borderRadius:12, color:"white", fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer" }}>로그인하기</button>
          </div>
        )}
      </div>

      {/* 로그인 */}
      <Modal open={loginOpen} onClose={()=>setLoginOpen(false)} title="🔐 관리자 로그인">
        <FormInput label="아이디" type="text" value={loginId} onChange={e=>setLoginId(e.target.value)} placeholder="아이디"/>
        <FormInput label="비밀번호" type="password" value={loginPw} onChange={e=>setLoginPw(e.target.value)} placeholder="••••••" onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
        {loginErr && <div style={{ color:"#E91E8C", fontSize:12, marginBottom:12 }}>아이디 또는 비밀번호가 올바르지 않습니다.</div>}
        <div style={{ display:"flex", gap:10, marginTop:8 }}>
          <button onClick={()=>setLoginOpen(false)} style={cancelBtn}>취소</button>
          <button onClick={doLogin} style={submitBtn}>로그인</button>
        </div>
      </Modal>

      {/* 공지 상세 */}
      <Modal open={noticeDetailOpen} onClose={()=>setNoticeDetailOpen(false)}>
        {selectedNotice && (
          <>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <span style={{ padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:700, background:tagStyle[selectedNotice.tag].bg, color:tagStyle[selectedNotice.tag].color }}>{tagStyle[selectedNotice.tag].label}</span>
              <span style={{ fontSize:12, color:"#9CA3AF" }}>{selectedNotice.date}</span>
            </div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:16, lineHeight:1.4 }}>{selectedNotice.title}</div>
            <div style={{ fontSize:14, color:"#4B5563", lineHeight:1.8, padding:"16px", background:"#F8F9FD", borderRadius:12, whiteSpace:"pre-line" }}>{selectedNotice.content}</div>
            {selectedNotice.pdfUrl && (
              <a href={encodeURI(selectedNotice.pdfUrl)} target="_blank" rel="noopener noreferrer"
                 style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                          marginTop:14, padding:"13px", borderRadius:12,
                          background:"linear-gradient(135deg, #4A90D9, #7B6CF6)",
                          color:"#fff", fontSize:14, fontWeight:700,
                          textDecoration:"none", cursor:"pointer" }}>
                📄 학사일정 PDF 보기 / 다운로드
              </a>
            )}
            <button onClick={()=>setNoticeDetailOpen(false)} style={{ ...submitBtn, width:"100%", marginTop:14 }}>닫기</button>
          </>
        )}
      </Modal>

      {/* 시험 등록/수정 */}
      <Modal open={examModalOpen} onClose={()=>setExamModalOpen(false)} title={editExam?"📅 시험 수정":"📅 시험 등록"}>
        <FormInput label="시험명" value={eName} onChange={e=>setEName(e.target.value)} placeholder="예: [3/11개강] 중간고사"/>
        <FormInput label="시작 날짜" type="date" value={eDate} onChange={e=>setEDate(e.target.value)}/>
        <FormInput label="종료 날짜" type="date" value={eEndDate} onChange={e=>setEEndDate(e.target.value)}/>
        <FormInput label="장소" value={ePlace} onChange={e=>setEPlace(e.target.value)} placeholder="예: 온라인"/>
        <FormInput label="상태" as="select" value={eStatus} onChange={e=>setEStatus(e.target.value)}>
          <option value="upcoming">예정</option>
          <option value="soon">진행중</option>
          <option value="closed">종료</option>
        </FormInput>
        <div style={{ display:"flex", gap:10, marginTop:8 }}>
          <button onClick={()=>setExamModalOpen(false)} style={cancelBtn}>취소</button>
          <button onClick={saveExam} style={submitBtn}>저장</button>
        </div>
      </Modal>

      {/* 공지 등록/수정 */}
      <Modal open={noticeModalOpen} onClose={()=>setNoticeModalOpen(false)} title={editNotice?"📢 공지 수정":"📢 공지 등록"}>
        <FormInput label="분류" as="select" value={nTag} onChange={e=>setNTag(e.target.value)}>
          <option value="important">중요</option>
          <option value="exam">시험</option>
          <option value="general">일반</option>
        </FormInput>
        <FormInput label="제목" value={nTitle} onChange={e=>setNTitle(e.target.value)} placeholder="공지 제목을 입력하세요"/>
        <FormInput label="내용" as="textarea" value={nContent} onChange={e=>setNContent(e.target.value)} placeholder="공지 내용을 입력하세요"/>
        <div style={{ display:"flex", gap:10, marginTop:8 }}>
          <button onClick={()=>setNoticeModalOpen(false)} style={cancelBtn}>취소</button>
          <button onClick={saveNotice} style={submitBtn}>저장</button>
        </div>
      </Modal>
    </div>
  );
}

const cancelBtn = { flex:1, padding:13, border:"1.5px solid rgba(123,108,246,0.2)", background:"transparent", borderRadius:12, fontFamily:"inherit", fontSize:14, fontWeight:600, color:"#6B7280", cursor:"pointer" };
const submitBtn = { flex:2, padding:13, border:"none", background:GRAD, borderRadius:12, fontFamily:"inherit", fontSize:14, fontWeight:700, color:"white", cursor:"pointer" };
