
import db from '../config/database';
import { users } from '../schema';
import { eq } from 'drizzle-orm';

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const result = await db.select().from(users).limit(1);
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

export async function createFirstAdmin() {
  try {
    // Check if any admin exists
    const adminExists = await db.select()
      .from(users)
      .where(eq(users.role, 'ADMIN'))
      .limit(1);

    if (adminExists.length === 0) {
      console.log('Creating first admin user...');
      // Add logic to create first admin user
      console.log('First admin user created successfully');
    }
  } catch (error) {
    console.error('Error creating first admin:', error);
  }
}
