"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeConnection = exports.testConnection = exports.db = void 0;
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const schema = __importStar(require("../schema"));
const connectionString = process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/brillprime_db';
// PostgreSQL connection configuration
const client = (0, postgres_1.default)(connectionString, {
    prepare: false,
    max: 10, // Maximum number of connections in the pool
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    onnotice: () => { }, // Disable notices
});
exports.db = (0, postgres_js_1.drizzle)(client, { schema });
// Test database connection
const testConnection = async () => {
    try {
        await client `SELECT 1`;
        console.log('✅ Database connected successfully');
        return true;
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
};
exports.testConnection = testConnection;
// Graceful shutdown
const closeConnection = async () => {
    try {
        await client.end();
        console.log('🔌 Database connection closed');
    }
    catch (error) {
        console.error('❌ Error closing database connection:', error);
    }
};
exports.closeConnection = closeConnection;
exports.default = exports.db;
//# sourceMappingURL=database.js.map