// 1. 공통 모듈 (db, onUserCreated 등)을 가져옵니다.
const { db, onUserCreated, onUserDeleted, logger } = require("../common");


exports.createUserDocument = onUserCreated(async (event) => {
  const user = event.data; // 방금 가입한 유저 정보
  const userRef = db.collection("users").doc(user.uid);

  logger.log(`Creating user document for: ${user.uid}, email: ${user.email}`);

  try {
    await userRef.set({
      email: user.email || null,
      displayName: user.displayName || "신규 유저",
      userLP: 0,
      teamIds: [], // 다중 팀 지원: teamIds 배열로 초기화
      leaderOf: [], // 팀장인 팀 목록
      wakeUpTime: null,
      lastChallengeStatus: "pending",
      weeklySuccessCount: 0,
      fcmToken: null, 
    });
    logger.log(`Successfully created user document for: ${user.uid}`);
    return;
  } catch (error) {
    logger.error(`Error creating user document for ${user.uid}:`, error);
    return;
  }
});

exports.deleteUserDocument = onUserDeleted(async (event) => {
  const user = event.data; // 방금 탈퇴한 유저 정보
  const userRef = db.collection("users").doc(user.uid);

  logger.log(`Deleting user document for: ${user.uid}`);

  try {
    // TODO: 유저가 속했던 팀의 멤버 목록에서 제거하는 로직 추가 필요
    await userRef.delete();
    logger.log(`Successfully deleted user document for: ${user.uid}`);
    return;
  } catch (error) {
    logger.error(`Error deleting user document for ${user.uid}:`, error);
    return;
  }
});