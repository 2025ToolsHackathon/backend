
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
      wakeUpTime: null,
      teamId: null,
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
    await userRef.delete();
    logger.log(`Successfully deleted user document for: ${user.uid}`);
    return;
  } catch (error) {
    // (참고) Firestore 보안 규칙으로도 이 문서를 삭제할 수 없는 경우,
    // 이 함수도 실패할 수 있습니다.
    logger.error(`Error deleting user document for ${user.uid}:`, error);
    return;
  }
});