import { Request, Response, NextFunction } from 'express';
import { JWTPayload, authenticateToken } from './auth';

// Middleware to ensure only admins can access admin routes
export const requireAdminRole = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user as JWTPayload;

  if (!user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      redirectTo: '/admin/login'
    });
  }

  if (user.role !== 'ADMIN') {
    return res.status(403).json({ 
      error: 'Admin access required',
      redirectTo: '/admin/login'
    });
  }

  next();
};

// Middleware to redirect authenticated regular users away from admin pages
export const preventRegularUserAccess = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user as JWTPayload;

  if (user && user.role !== 'ADMIN') {
    return res.status(403).json({ 
      error: 'Access denied. This is an admin-only area.',
      redirectTo: getRoleBasedRedirect(user.role)
    });
  }

  next();
};

// Complete admin authentication middleware that combines token verification and role check
export const adminAuthMiddleware = [
  authenticateToken,
  requireAdminRole
];

// Middleware to check session validity for admin routes
export const checkAdminSession = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user as JWTPayload;

  if (!user) {
    return res.status(401).json({ 
      error: 'Session expired. Please login again.',
      redirectTo: '/admin/login'
    });
  }

  if (user.role !== 'ADMIN') {
    return res.status(403).json({ 
      error: 'Invalid session. Admin access required.',
      redirectTo: '/admin/login'
    });
  }

  next();
};

// Helper function to get role-based redirect URLs
const getRoleBasedRedirect = (role: string): string => {
  switch (role) {
    case 'CONSUMER':
      return '/consumer/dashboard';
    case 'MERCHANT':
      return '/merchant/dashboard';
    case 'DRIVER':
      return '/driver/dashboard';
    case 'VENDOR':
      return '/vendor/dashboard';
    default:
      return '/';
  }
};

// Middleware to log admin actions
export const logAdminAction = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as JWTPayload;
    console.log(`Admin Action: ${action} by admin ${user?.userId} (${user?.email}) at ${new Date().toISOString()}`);
    next();
  };
};