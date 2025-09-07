import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();
const configService = new ConfigService();

export const JWT_SECRET_KEY = configService.get('JWT_SECRET_KEY');
export const JWT_REFRESH_SECRET_KEY = configService.get('JWT_REFRESH_SECRET_KEY');
export const PORT = configService.get('PORT');
export const NO_REPLY_USER_EMAIL = configService.get('NO_REPLY_USER_EMAIL');
export const NO_REPLY_USER_PASSWORD = configService.get('NO_REPLY_USER_PASSWORD');

export const GMAIL = configService.get('GMAIL');
export const GOOGLE_CLIENT_ID = configService.get('GOOGLE_CLIENT_ID');
export const GOOGLE_CLIENT_SECRET = configService.get('GOOGLE_CLIENT_CLIENT_SECRET');
export const GOOGLE_OAUTH2_CLIENT_ID = configService.get('GOOGLE_OAUTH2_CLIENT_ID');
export const GOOGLE_REFRESH_TOKEN = configService.get('GOOGLE_REFRESH_TOKEN');

export const REDIS_CLIENT_NAME = configService.get('REDIS_CLIENT_NAME');
export const REDIS_PORT = configService.get('REDIS_PORT');
export const REDIS_HOST = configService.get('REDIS_HOST');
export const REDIS_PASSWORD = configService.get('REDIS_PASSWORD');
export const REDIS_USERNAME = configService.get('REDIS_USERNAME');

export const HAPI_FHIR_BASE_URL = configService.get('HAPI_FHIR_BASE_URL');
export const HAPI_FHIR_API_KEY = configService.get('HAPI_FHIR_API_KEY');

export const USER_EMAIL = configService.get('USER_EMAIL');
export const USER_PASSWORD = configService.get('USER_PASSWORD');
export const VERSION = configService.get('VERSION');
export const PCN_BASE_URL = configService.get('PCN_BASE_URL');

export const env = {
  isDev: String(process.env.NODE_ENV).toLowerCase().includes('dev'),
  isTest: String(process.env.NODE_ENV).toLowerCase().includes('test'),
  isProd: String(process.env.NODE_ENV).toLowerCase().includes('prod'),
  isStaging: String(process.env.NODE_ENV).toLowerCase().includes('staging'),
  env: process.env.NODE_ENV,
};
