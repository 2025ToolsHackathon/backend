// Firebase Admin SDK 초기화는 common/index.js에서 처리됩니다.

// 1.Auth 트리거 로드
const authTriggers = require("./triggers/auth");

// 2.API 로드
const userApi = require("./api/user");
const challengeApi = require("./api/challenge");
const teamApi = require("./api/teams");
const rankingScheduler = require("./scheduled/ranking"); // 신규 추가
const notificationScheduler = require("./scheduled/notifications");

// 4. Firebase에 모든 함수들을 등록
exports.auth = {
  ...authTriggers,
};

exports.api = {
  ...userApi,
  ...challengeApi,
  ...teamApi,
};

// 스케줄링된 작업 (알람 및 랭킹)
exports.scheduled = {
  ...notificationScheduler,
  ...rankingScheduler, // 주간 랭킹 처리 함수 추가
};
