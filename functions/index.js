const admin = require("firebase-admin");
const functions = require("firebase-functions");
admin.initializeApp();

const teamApi = require("./api/teams");

exports.createTeam = teamApi.createTeam;
exports.joinTeam = teamApi.joinTeam;
exports.getTeamDashboard = teamApi.getTeamDashboard;