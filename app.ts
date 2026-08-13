import express from 'express';
import path from 'path';
import cors from 'cors';
import './server/config/env.js';

import uploadRoutes from './server/routes/uploadRoutes.js';
import adminRoutes from './server/routes/adminRoutes.js';
import feedbackRoutes from './server/routes/feedbackRoutes.js';
import aiRoutes from './server/routes/aiRoutes.js';
import googleChatRoutes from './server/routes/googleChatRoutes.js';
import { errorHandler } from './server/middleware/errorHandler.js';

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check API
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/', uploadRoutes);
app.use('/', adminRoutes);
app.use('/', feedbackRoutes);
app.use('/', aiRoutes);
app.use('/', googleChatRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
