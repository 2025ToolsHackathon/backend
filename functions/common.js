
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onUserCreated, onUserDeleted } = require("firebase-functions/v2/auth");
const { logger } = require("firebase-functions");

// Firebase Admin SDK를 한 번만 초기화합니다.
initializeApp();

// Firestore DB 인스턴스를 공통으로 사용합니다.
const db = getFirestore();

// 다른 파일에서 import할 수 있도록 모듈을 내보냅니다.
module.exports = {
  db,
  onCall,
  HttpsError,
  onUserCreated,
  onUserDeleted,
  logger,
};