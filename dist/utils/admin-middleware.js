"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAdminAction = exports.checkAdminSession = exports.adminAuthMiddleware = exports.preventRegularUserAccess = exports.requireAdminRole = void 0;
const auth_1 = require("./auth");
// Middleware to ensure only admins can access admin routes
const requireAdminRole = (req, res, next) => {
    const user = req.user;
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
exports.requireAdminRole = requireAdminRole;
// Middleware to redirect authenticated regular users away from admin pages
const preventRegularUserAccess = (req, res, next) => {
    const user = req.user;
    if (user && user.role !== 'ADMIN') {
        return res.status(403).json({
            error: 'Access denied. This is an admin-only area.',
            redirectTo: getRoleBasedRedirect(user.role)
        });
    }
    next();
};
exports.preventRegularUserAccess = preventRegularUserAccess;
// Complete admin authentication middleware that combines token verification and role check
exports.adminAuthMiddleware = [
    auth_1.authenticateToken,
    exports.requireAdminRole
];
// Middleware to check session validity for admin routes
const checkAdminSession = (req, res, next) => {
    const user = req.user;
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
exports.checkAdminSession = checkAdminSession;
// Helper function to get role-based redirect URLs
const getRoleBasedRedirect = (role) => {
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
const logAdminAction = (action) => {
    return (req, res, next) => {
        const user = req.user;
        console.log(`Admin Action: ${action} by admin ${user?.userId} (${user?.email}) at ${new Date().toISOString()}`);
        next();
    };
};
exports.logAdminAction = logAdminAction;
