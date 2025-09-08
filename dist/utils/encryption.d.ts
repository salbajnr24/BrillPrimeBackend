export declare class EncryptionUtils {
    static hashPassword(password: string): Promise<string>;
    static comparePassword(password: string, hashedPassword: string): Promise<boolean>;
    static generateRandomString(length?: number): string;
    static generateOTP(length?: number): string;
    static encrypt(text: string, secretKey: string): string;
    static decrypt(encryptedData: string, secretKey: string): string;
}
