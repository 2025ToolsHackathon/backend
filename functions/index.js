<<<<<<< HEAD

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
=======
const admin = require("firebase-admin");
const functions = require("firebase-functions");
admin.initializeApp();

const teamApi = require("./api/teams");

exports.createTeam = teamApi.createTeam;
exports.joinTeam = teamApi.joinTeam;
exports.getTeamDashboard = teamApi.getTeamDashboard;

const userApi = require("./api/users");
exports.registerDeviceToken = userApi.registerDeviceToken;

const missionApi = require("./api/missions");
exports.getTodayMission = missionApi.getTodayMission;

const notificationScheduler = require("./scheduled/notifications");
exports.sendWakeUpNotifications = notificationScheduler.sendWakeUpNotifications;
>>>>>>> a09aee8df6a21d378827454e86a375a89a7df2d1
