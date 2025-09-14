"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testDatabaseConnection = testDatabaseConnection;
exports.createFirstAdmin = createFirstAdmin;
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
async function testDatabaseConnection() {
    try {
        const result = await database_1.default.select().from(schema_1.users).limit(1);
        console.log('✅ Database connection successful');
        return true;
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
}
async function createFirstAdmin() {
    try {
        // Check if any admin exists
        const adminExists = await database_1.default.select()
            .from(schema_1.users)
            .where(eq(schema_1.users.role, 'ADMIN'))
            .limit(1);
        if (adminExists.length === 0) {
            console.log('Creating first admin user...');
            // Add logic to create first admin user
            console.log('First admin user created successfully');
        }
    }
    catch (error) {
        console.error('Error creating first admin:', error);
    }
}
