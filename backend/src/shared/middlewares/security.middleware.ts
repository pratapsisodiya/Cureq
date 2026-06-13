import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';

// Helmet configuration to secure HTTP headers
export const helmetMiddleware = helmet();

// Rate limiting configuration to prevent brute-force attacks and DOS
export const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

// HTTP Parameter Pollution protection
export const hppMiddleware = hpp();
