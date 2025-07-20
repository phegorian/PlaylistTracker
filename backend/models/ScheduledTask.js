// backend/models/ScheduledTask.js
const mongoose = require('mongoose');

const ScheduledTaskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  youtubePlaylistId: {
    type: String,
    required: true,
  },
  playlistName: { // Storing name for easier display in UI
    type: String,
    required: true,
  },
  cronSchedule: {
    type: String,
    required: true, // e.g., "0 0 * * *" for daily at midnight
    // Consider adding a custom validator for cron format if needed
  },
  lastRunAt: {
    type: Date,
    default: null,
  },
  nextRunAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'error'],
    default: 'active',
  },
  // You could add lastError, errorCount, etc. for robustness
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ScheduledTask', ScheduledTaskSchema);