require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const assessmentRoutes = require('./routes/assessments');
const questionRoutes = require('./routes/questions');
const mediaRoutes = require('./routes/media');
const adminRoutes = require('./routes/admin');

// Import middleware
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - serve frontend and backend-owned admin assets
app.use(express.static(path.join(__dirname, '../front')));
app.use('/admin-assets', express.static(path.join(__dirname, 'admin')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/assessments', authenticateToken, assessmentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/media', authenticateToken, mediaRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve backend-owned admin console
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/index.html'));
});

app.get('/admin/users/new', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/user-form.html'));
});

app.get('/admin/users/:id/edit', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/user-form.html'));
});

app.get('/admin/assessments/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/assessment-view.html'));
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../front/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`MMT Assessment API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
