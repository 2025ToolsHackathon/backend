const admin = require("firebase-admin");
const functions = require("firebase-functions");
const db = admin.firestore(); // admin SDK가 이미 초기화되었다고 가정

/**
 * [scheduler]
 * 1분마다 실행되며, 현재 KST 시간에 알람이 설정된 유저에게
 * 푸시 알림(FCM) 발송
 */
exports.sendWakeUpNotifications = functions
    .pubsub.schedule("every 1 minutes")
    .timeZone("Asia/Seoul")
    .onRun(async (context) => {
    // 1. 현재 KST 시간 (format: "HH:mm")
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const currentTimeKST = `${hours}:${minutes}`;

      console.log(`[${currentTimeKST} KST] 알림 발송 스케줄러 실행.`);

      try {
      // 2. /users 컬렉션에서 currentTimeKST(현재 KST 시간) = wakeUpTime인 user 조회
        const usersRef = db.collection("users");
        const snapshot = await usersRef
            .where("wakeUpTime", "==", currentTimeKST)
            .get();

        if (snapshot.empty) {
          console.log("알림 보낼 유저가 없습니다.");
          return null;
        }

        const tokens = [];
        const updatePromises = [];
        snapshot.forEach((doc) => {
          const user = doc.data();
          if (user.fcmToken) {
            tokens.push(user.fcmToken);
          }
        });

        if (tokens.length === 0) {
          console.log("fcmToken이 등록된 유저가 없습니다.");
          return null;
        }

        // 알림 내용(payload)
        const payload = {
          notification: {
            title: "일어날 시간이에요!",
            body: "앱을 열어서 오늘의 기상 미션을 10분 내로 수행해주세요.",
          },
          data: {
            type: "WAKE_UP_CHALLENGE",
          },
        };

        // 해당 token들에 알림 발송
        const response = await admin.messaging().sendMulticast({ tokens, notification: payload.notification, data: payload.data });
        console.log(`[${currentTimeKST}] ${tokens.length}명 중 ${response.successCount}명에게 알림 발송 성공.`);

        // 실패한 토큰 처리 (무효한 토큰 삭제)
        if (response.failureCount > 0) {
            response.responses.forEach((result, index) => {
                const error = result.error;
                if (error && (error.code === 'messaging/invalid-argument' || error.code === 'messaging/registration-token-not-registered')) {
                    // 유효하지 않거나 만료된 토큰은 DB에서 제거
                    const tokenToDelete = tokens[index];
                    const userRef = db.collection("users").where("fcmToken", "==", tokenToDelete).limit(1);
                    updatePromises.push(userRef.get().then(qs => {
                        if (!qs.empty) {
                            qs.docs[0].ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
                            console.log(`Invalid token removed: ${tokenToDelete}`);
                        }
                    }));
                }
            });
            await Promise.all(updatePromises);
        }

        return null;
      } catch (error) {
        console.error("알림 스케줄러 실행 중 심각한 에러:", error);
        return null;
      }
    });