declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        role: 'CONSUMER' | 'MERCHANT' | 'DRIVER' | 'VENDOR' | 'ADMIN';
      };
    }
  }
}

export {};