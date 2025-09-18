
import { config } from 'dotenv';

config();

export const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'your-jwt-secret-key';
export const JWT_REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET_KEY || 'your-jwt-refresh-secret-key';
export const PORT = process.env.PORT || '3000';
export const NO_REPLY_USER_EMAIL = process.env.NO_REPLY_USER_EMAIL;
export const NO_REPLY_USER_PASSWORD = process.env.NO_REPLY_USER_PASSWORD;

export const GMAIL = process.env.GMAIL;
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
export const GOOGLE_OAUTH2_CLIENT_ID = process.env.GOOGLE_OAUTH2_CLIENT_ID;
export const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

export const REDIS_CLIENT_NAME = process.env.REDIS_CLIENT_NAME;
export const REDIS_PORT = process.env.REDIS_PORT || '6379';
export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
export const REDIS_USERNAME = process.env.REDIS_USERNAME;

export const HAPI_FHIR_BASE_URL = process.env.HAPI_FHIR_BASE_URL;
export const HAPI_FHIR_API_KEY = process.env.HAPI_FHIR_API_KEY;

export const USER_EMAIL = process.env.USER_EMAIL;
export const USER_PASSWORD = process.env.USER_PASSWORD;
export const VERSION = process.env.VERSION || '1.0.0';
export const PCN_BASE_URL = process.env.PCN_BASE_URL;

// Social Authentication
export const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
export const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
export const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
export const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
export const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
export const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
export const FRONTEND_URL = process.env.FRONTEND_URL;

export const env = {
  isDev: String(process.env.NODE_ENV).toLowerCase().includes('dev'),
  isTest: String(process.env.NODE_ENV).toLowerCase().includes('test'),
  isProd: String(process.env.NODE_ENV).toLowerCase().includes('prod'),
  isStaging: String(process.env.NODE_ENV).toLowerCase().includes('staging'),
  env: process.env.NODE_ENV || 'development',
};
