"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = exports.FRONTEND_URL = exports.APPLE_PRIVATE_KEY = exports.APPLE_KEY_ID = exports.APPLE_TEAM_ID = exports.APPLE_CLIENT_ID = exports.FACEBOOK_APP_SECRET = exports.FACEBOOK_APP_ID = exports.PCN_BASE_URL = exports.VERSION = exports.USER_PASSWORD = exports.USER_EMAIL = exports.HAPI_FHIR_API_KEY = exports.HAPI_FHIR_BASE_URL = exports.REDIS_USERNAME = exports.REDIS_PASSWORD = exports.REDIS_HOST = exports.REDIS_PORT = exports.REDIS_CLIENT_NAME = exports.GOOGLE_REFRESH_TOKEN = exports.GOOGLE_OAUTH2_CLIENT_ID = exports.GOOGLE_CLIENT_SECRET = exports.GOOGLE_CLIENT_ID = exports.GMAIL = exports.NO_REPLY_USER_PASSWORD = exports.NO_REPLY_USER_EMAIL = exports.PORT = exports.JWT_REFRESH_SECRET_KEY = exports.JWT_SECRET_KEY = void 0;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
exports.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'your-jwt-secret-key';
exports.JWT_REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET_KEY || 'your-jwt-refresh-secret-key';
exports.PORT = process.env.PORT || '5000';
exports.NO_REPLY_USER_EMAIL = process.env.NO_REPLY_USER_EMAIL;
exports.NO_REPLY_USER_PASSWORD = process.env.NO_REPLY_USER_PASSWORD;
exports.GMAIL = process.env.GMAIL;
exports.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
exports.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
exports.GOOGLE_OAUTH2_CLIENT_ID = process.env.GOOGLE_OAUTH2_CLIENT_ID;
exports.GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
exports.REDIS_CLIENT_NAME = process.env.REDIS_CLIENT_NAME;
exports.REDIS_PORT = process.env.REDIS_PORT || '6379';
exports.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
exports.REDIS_PASSWORD = process.env.REDIS_PASSWORD;
exports.REDIS_USERNAME = process.env.REDIS_USERNAME;
exports.HAPI_FHIR_BASE_URL = process.env.HAPI_FHIR_BASE_URL;
exports.HAPI_FHIR_API_KEY = process.env.HAPI_FHIR_API_KEY;
exports.USER_EMAIL = process.env.USER_EMAIL;
exports.USER_PASSWORD = process.env.USER_PASSWORD;
exports.VERSION = process.env.VERSION || '1.0.0';
exports.PCN_BASE_URL = process.env.PCN_BASE_URL;
// Social Authentication
exports.FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
exports.FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
exports.APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
exports.APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
exports.APPLE_KEY_ID = process.env.APPLE_KEY_ID;
exports.APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
exports.FRONTEND_URL = process.env.FRONTEND_URL;
exports.env = {
    isDev: String(process.env.NODE_ENV).toLowerCase().includes('dev'),
    isTest: String(process.env.NODE_ENV).toLowerCase().includes('test'),
    isProd: String(process.env.NODE_ENV).toLowerCase().includes('prod'),
    isStaging: String(process.env.NODE_ENV).toLowerCase().includes('staging'),
    env: process.env.NODE_ENV || 'development',
};
