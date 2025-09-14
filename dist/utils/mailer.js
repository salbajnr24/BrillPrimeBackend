"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWelcomeEmail = exports.sendOTPEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'gmail';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const transporter = nodemailer_1.default.createTransport({
    service: EMAIL_SERVICE,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
});
const sendOTPEmail = async (email, otp) => {
    try {
        await transporter.sendMail({
            from: EMAIL_USER,
            to: email,
            subject: 'Your BrillPrime OTP Code',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>BrillPrime Verification Code</h2>
          <p>Your One-Time Password (OTP) is:</p>
          <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
            ${otp}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
        });
    }
    catch (error) {
        console.error('Failed to send OTP email:', error);
        throw new Error('Failed to send OTP email');
    }
};
exports.sendOTPEmail = sendOTPEmail;
const sendWelcomeEmail = async (email, fullName) => {
    try {
        await transporter.sendMail({
            from: EMAIL_USER,
            to: email,
            subject: 'Welcome to BrillPrime!',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to BrillPrime, ${fullName}!</h2>
          <p>Thank you for joining our platform. Your account has been successfully verified.</p>
          <p>You can now enjoy all the features of BrillPrime:</p>
          <ul>
            <li>Browse products from verified merchants</li>
            <li>Place orders and track deliveries</li>
            <li>Connect with vendors through our chat system</li>
            <li>And much more!</li>
          </ul>
          <p>Happy shopping!</p>
          <p>The BrillPrime Team</p>
        </div>
      `,
        });
    }
    catch (error) {
        console.error('Failed to send welcome email:', error);
    }
};
exports.sendWelcomeEmail = sendWelcomeEmail;
