
// 1. 공통 모듈 (db, onCall 등)을 가져옵니다.
const { db, onCall, HttpsError, logger } = require("../common");


exports.setUserAlarm = onCall(async (request) => {
  // 1. 인증된 유저인지 확인합니다. (로그인 필수)
  if (!request.auth) {
    logger.warn("setUserAlarm: Unauthenticated user.");
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const userId = request.auth.uid;
  const wakeUpTime = request.data.wakeUpTime; // 프론트에서 보낸 알람 시간

  if (!wakeUpTime) {
    logger.warn(`setUserAlarm: Missing wakeUpTime for user ${userId}`);
    throw new HttpsError("invalid-argument", "wakeUpTime 값이 없습니다.");
  }

  const userRef = db.collection("users").doc(userId);

  try {
    // 2. 해당 유저의 문서에 wakeUpTime 필드만 업데이트합니다.
    await userRef.update({
      wakeUpTime: wakeUpTime,
    });

    logger.log(`User ${userId} set alarm to ${wakeUpTime}`);
    return { success: true, wakeUpTime: wakeUpTime };
  } catch (error) {
    logger.error(`Error setting alarm for user ${userId}:`, error);
    throw new HttpsError("internal", "알람 설정 중 오류가 발생했습니다.");
  }
});

exports.registerDeviceToken = onCall(async (request) => {
  // 1. 인증 확인
  if (!request.auth) {
    logger.warn("registerDeviceToken: Unauthenticated user.");
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const userId = request.auth.uid;
  const fcmToken = request.data.fcmToken; // 프론트에서 보낸 기기 토큰

  if (!fcmToken) {
    logger.warn(`registerDeviceToken: Missing fcmToken for user ${userId}`);
    throw new HttpsError("invalid-argument", "fcmToken 값이 없습니다.");
  }

  const userRef = db.collection("users").doc(userId);

  try {
    // 2. 해당 유저의 문서에 fcmToken 필드를 업데이트합니다.
    await userRef.update({
      fcmToken: fcmToken,
    });

    logger.log(`User ${userId} registered FCM token: ${fcmToken}`);
    return { success: true };
  } catch (error) {
    logger.error(`Error registering FCM token for user ${userId}:`, error);
    throw new HttpsError("internal", "토큰 등록 중 오류가 발생했습니다.");
  }
});