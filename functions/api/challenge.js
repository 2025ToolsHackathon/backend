
// 1. 공통 모듈 (db, onCall 등)을 가져옵니다.
const { db, onCall, HttpsError, logger } = require("../common");

const { getFirestore } = require("firebase-admin/firestore");


exports.getTodayMission = onCall(async (request) => {
  // 1. 인증 확인
  if (!request.auth) {
    logger.warn("getTodayMission: Unauthenticated user.");
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  
  const missionRef = db.collection("config").doc("todayMission");

  try {
    const doc = await missionRef.get();
    if (!doc.exists) {
      logger.error("getTodayMission: 'todayMission' document does not exist!");
      throw new HttpsError("not-found", "오늘의 미션 정보를 찾을 수 없습니다.");
    }

    // 3. 프론트엔드에 미션 정보를 반환합니다.
    // 예: { poseName: 'warrior_2', poseGuideUrl: '...', difficulty: 'easy' }
    logger.log("Fetched todayMission:", doc.data());
    return doc.data();
  } catch (error) {
    logger.error("Error fetching todayMission:", error);
    throw new HttpsError("internal", "미션 정보 로딩 중 오류가 발생했습니다.");
  }
});

exports.processChallengeResult = onCall(async (request) => {
  // 1. 인증 확인
  if (!request.auth) {
    logger.warn("processChallengeResult: Unauthenticated user.");
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const userId = request.auth.uid;
  const result = request.data.result; // "success" 또는 "fail"

  if (result !== "success" && result !== "fail") {
    logger.warn(`processChallengeResult: Invalid result value '${result}' from user ${userId}`);
    throw new HttpsError("invalid-argument", "결과값이 'success' 또는 'fail'이어야 합니다.");
  }

  // 오늘 날짜 (KST 기준)
  const today = new Date();
  today.setHours(today.getHours() + 9); // KST (UTC+9)
  const dateStr = today.toISOString().split("T")[0]; // "YYYY-MM-DD"

  // 2. 관련 문서들의 참조(Ref)를 미리 정의
  const userRef = db.collection("users").doc(userId);
  const challengeId = `${dateStr}_${userId}`;
  const challengeRef = db.collection("challenges").doc(challengeId);

  try {
    // 3. [트랜잭션] DB 작업을 하나로 묶어 안전하게 처리
    await getFirestore().runTransaction(async (transaction) => {
      // 3-1. (읽기) 유저의 현재 정보를 가져옵니다.
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("User document not found!");
      }

      const userData = userDoc.data();
      const teamId = userData.teamId;

      // 3-2. (쓰기 1) 챌린지 이력 저장
      transaction.set(challengeRef, {
        userId: userId,
        date: dateStr,
        status: result,
      });

      // 3-3. (쓰기 2) 유저 정보 업데이트
      const lpChange = result === "success" ? 100 : -10;
      const successCountChange = result === "success" ? 1 : 0;

      transaction.update(userRef, {
        userLP: userData.userLP + lpChange,
        lastChallengeStatus: result,
        weeklySuccessCount: userData.weeklySuccessCount + successCountChange,
      });

      // 3-4. (쓰기 3) 팀 정보 업데이트 (팀이 있고, 성공했을 때만)
      if (teamId && result === "success") {
        // 명세서의 /teams/{teamId} 문서 안의 'members' 맵(Map) 객체를 업데이트
        const teamRef = db.collection("teams").doc(teamId);
        
        // (주의) Firestore의 맵 객체 필드를 업데이트하는 문법입니다.
        // 'members' 맵 안의 'userId' 키의 'weeklySuccessCount' 값을 업데이트
        const teamUpdateField = `members.${userId}.weeklySuccessCount`;

        // (읽기) 팀의 현재 정보를 가져와서 1 더함
        // 트랜잭션 안에서는 transaction.get()을 사용해야 합니다.
        const teamDoc = await transaction.get(teamRef);
        if (teamDoc.exists && teamDoc.data().members && teamDoc.data().members[userId]) {
            const currentTeamSuccessCount = teamDoc.data().members[userId].weeklySuccessCount || 0;
            
            transaction.update(teamRef, {
                [teamUpdateField]: currentTeamSuccessCount + 1
            });
        }
      }
    }); // [트랜잭션 종료]

    // 4. 성공 응답
    logger.log(`Successfully processed challenge result '${result}' for user ${userId}`);
    return { success: true, result: result };
  } catch (error) {
    logger.error(`Error processing challenge result for user ${userId}:`, error);
    throw new HttpsError("internal", "챌린지 결과 처리 중 오류가 발생했습니다.");
  }
});