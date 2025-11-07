// 1. 공통 모듈 (db, onCall 등)을 가져옵니다.
const { db, onCall, HttpsError, logger } = require("../common");

const { getFirestore } = require("firebase-admin/firestore");
const admin = require('firebase-admin'); // 배열 처리용


exports.getTodayMission = onCall(async (request) => {
  // ... (기존 코드 유지)
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
      const teamIds = userData.teamIds || [];
      const primaryTeamId = teamIds.length > 0 ? teamIds[0] : null; // 첫 번째 팀만 처리

      // 3-2. (쓰기 1) 챌린지 이력 저장
      transaction.set(challengeRef, {
        userId: userId,
        date: dateStr,
        status: result,
      });

      // 3-3. (쓰기 2) 유저 정보 업데이트
      const isSuccess = result === "success";
      const lpChange = isSuccess ? 100 : -10;
      const successCountChange = isSuccess ? 1 : 0;

      transaction.update(userRef, {
        userLP: (userData.userLP || 0) + lpChange,
        lastChallengeStatus: result,
        weeklySuccessCount: (userData.weeklySuccessCount || 0) + successCountChange,
      });

      // 3-4. (쓰기 3) 팀 정보 업데이트 및 업적 확인 (팀에 속해 있을 때만)
      if (primaryTeamId) {
        const teamRef = db.collection("teams").doc(primaryTeamId);
        const teamDoc = await transaction.get(teamRef);

        if (teamDoc.exists) {
          const teamData = teamDoc.data();
          let teamUpdates = {};

          // 팀 LP 업데이트 (개인의 LP 변동에 따라 팀 LP도 변동)
          teamUpdates.teamLP = (teamData.teamLP || 0) + lpChange;

          // --- [A] 공통 업데이트 로직 ---
          if (isSuccess) {
            // A. 팀의 주간 성공 카운트 업데이트 (기존 로직 유지)
            const teamUpdateField = `members.${userId}.weeklySuccessCount`;
            const currentTeamSuccessCount = teamData.members?.[userId]?.weeklySuccessCount || 0;
            teamUpdates[teamUpdateField] = currentTeamSuccessCount + 1;
          } else {
            // ★ 위기 탈출 넘버원: 팀에서 실패가 발생한 날짜 기록 ★
            const failDayKey = `weeklyFailDays.${dateStr}`;
            // 해당 날짜에 이미 실패가 기록되지 않았으면 기록
            if (!teamData.weeklyFailDays || !teamData.weeklyFailDays[dateStr]) {
              teamUpdates[failDayKey] = true;
            }
            // 챌린지 실패는 팀원 중 한 명이라도 실패하면 그날은 '실패일'로 카운트됩니다.
          }
          // --- [A] 공통 업데이트 로직 끝 ---


          // --- [B] 업적: 숙면의 증명 로직 (팀 총 성공 일수 100일) ---
          if (isSuccess) {
            const achievementId = 'proofOfSleep';
            const ACHIEV_TARGET_COUNT = 100;
            const ACHIEV_REWARD_LP = 1000;
            
            const currentTotalSuccessCount = teamData.totalSuccessCount || 0;
            const newTotalSuccessCount = currentTotalSuccessCount + 1;
            
            // 카운터 업데이트
            teamUpdates.totalSuccessCount = newTotalSuccessCount;
            
            // 업적 달성 검증
            const isAchievementGranted = teamData.achievements?.[achievementId];

            if (newTotalSuccessCount === ACHIEV_TARGET_COUNT && !isAchievementGranted) {
              // *** 업적 달성! (100일 돌파) ***
              teamUpdates.teamLP += ACHIEV_REWARD_LP; 
              teamUpdates[`achievements.${achievementId}`] = admin.firestore.FieldValue.serverTimestamp(); 

              const memberUids = Object.keys(teamData.members || {});
              for (const memberUid of memberUids) {
                const memberRef = db.collection("users").doc(memberUid);
                const memberDoc = await transaction.get(memberRef);
                if (memberDoc.exists) {
                  const memberData = memberDoc.data();
                  transaction.update(memberRef, {
                    userLP: (memberData.userLP || 0) + ACHIEV_REWARD_LP
                  });
                }
              }
              logger.log(`Achievement '${achievementId}' granted to team ${primaryTeamId}.`);
            }
          }
          // --- [B] 업적: 숙면의 증명 로직 끝 ---

          // 팀 문서에 업데이트 적용
          if (Object.keys(teamUpdates).length > 0) {
            transaction.update(teamRef, teamUpdates);
          }
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