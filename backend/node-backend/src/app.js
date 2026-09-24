const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { sendError } = require('./utils/response');

const app = express();

// =============================================
// SECURITY MIDDLEWARE
// =============================================

// Helmet: Sets secure HTTP headers
app.use(helmet());

// CORS: Restrict cross-origin requests
app.use(cors({
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Rate Limiting: Prevent API abuse
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// =============================================
// BODY PARSING
// =============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================
// HTTP REQUEST LOGGING
// =============================================

const morganStream = {
  write: (message) => logger.info(message.trim()),
};
app.use(morgan('short', { stream: morganStream }));

// =============================================
// HEALTH CHECK
// =============================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AttendAI backend is running',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// =============================================
// API ROUTES (will be added as modules are built)
// =============================================

// TODO: app.use('/api/auth', authRoutes);
// TODO: app.use('/api/classes', classRoutes);
// TODO: app.use('/api/sessions', sessionRoutes);
// TODO: app.use('/api/enrollments', enrollmentRoutes);
// TODO: app.use('/api/attendance', attendanceRoutes);
// TODO: app.use('/api/reports', reportRoutes);

// =============================================
// 404 HANDLER
// =============================================

app.use((req, res) => {
  sendError(res, {
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    error: 'ROUTE_NOT_FOUND',
  });
});

// =============================================
// GLOBAL ERROR HANDLER (must be last)
// =============================================

app.use(errorHandler);

module.exports = app;
