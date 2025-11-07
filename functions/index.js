
// 1.Auth 트리거 로드
const authTriggers = require("./triggers/auth");

// 2.API 로드
const userApi = require("./api/user");
const challengeApi = require("./api/challenge");

// 4. Firebase에 모든 함수들을 등록
exports.auth = {
  ...authTriggers,
};

exports.api = {
  ...userApi,
  ...challengeApi,
  // ...teamApi, 
};

exports.scheduled = {
  // ...scheduledTasks, 
};