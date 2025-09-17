
import { Request, Response, NextFunction } from 'express';

export const realtimeHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Add headers for real-time API responses
  res.set({
    'X-API-Type': 'realtime',
    'X-Timestamp': new Date().toISOString(),
    'X-Request-ID': req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  next();
};

export const performanceTracker = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Override res.json to add performance metrics
  const originalJson = res.json;
  res.json = function(body: any) {
    const executionTime = Date.now() - startTime;
    
    // Add performance metrics to response if it's a real-time API response
    if (body && typeof body === 'object' && !body.executionTime) {
      body.executionTime = executionTime;
      body.timestamp = new Date().toISOString();
    }
    
    res.set('X-Execution-Time', executionTime.toString());
    return originalJson.call(this, body);
  };
  
  next();
};
