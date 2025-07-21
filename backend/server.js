// backend/server.js

const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const cron = require('node-cron');

// Models
const PlaylistSnapshot = require('./models/PlaylistSnapshot');
const ScheduledTask = require('./models/ScheduledTask');
const { addOrUpdateJob, removeJob } = require('./services/schedulerService');
const User = require('./models/User');

// Routes
const authRoutes = require('./routes/authRoutes');

// Services
const { initScheduler } = require('./services/schedulerService');
const { getPlaylistIdFromUrl, savePlaylistSnapshot } = require('./services/youtubeService');

const { protect } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
    console.error('Error: YOUTUBE_API_KEY is not defined in environment variables.');
    process.exit(1);
}
if (!process.env.JWT_SECRET) {
    console.error('Error: JWT_SECRET is not defined in environment variables.');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas!');
    initScheduler();
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);

app.get('/api/playlists/overview', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const uniquePlaylists = await PlaylistSnapshot.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            {
                $sort: { capturedAt: -1 }
            },
            {
                $group: {
                    _id: '$youtubePlaylistId',
                    latestSnapshot: { $first: '$$ROOT' },
                    snapshotCount: { $sum: 1 }
                }
            },
            {
                $replaceRoot: { newRoot: '$latestSnapshot' }
            },
            {
                $project: {
                    _id: 1,
                    youtubePlaylistId: 1,
                    title: 1,
                    thumbnailUrl: 1,
                    capturedAt: 1,
                    videoCount: 1,
                }
            }
        ]);

        const formattedPlaylists = uniquePlaylists.map(snapshot => ({
            youtubePlaylistId: snapshot.youtubePlaylistId,
            title: snapshot.title,
            thumbnailUrl: snapshot.thumbnailUrl,
            lastCapturedAt: snapshot.capturedAt,
            lastSnapshotId: snapshot._id,
            lastSnapshotVideoCount: snapshot.videoCount,
        }));

        res.status(200).json(formattedPlaylists);

    } catch (error) {
        console.error('Error fetching unique playlists overview:', error);
        res.status(500).json({ message: 'Failed to retrieve unique playlists overview.', error: error.message });
    }
});

// --- API Routes for Scheduled Tasks ---

// @route   POST /api/scheduled-tasks
// @desc    Create a new scheduled task
// @access  Private
app.post('/api/scheduled-tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { youtubePlaylistId, playlistName, cronSchedule } = req.body;

    if (!youtubePlaylistId || !playlistName || !cronSchedule) {
      return res.status(400).json({ message: 'Missing required fields: youtubePlaylistId, playlistName, and cronSchedule.' });
    }
    if (!cron.validate(cronSchedule)) { // Ensure cron syntax is valid
        return res.status(400).json({ message: 'Invalid cron schedule format.' });
    }

    const newScheduledTask = new ScheduledTask({
      userId,
      youtubePlaylistId,
      playlistName,
      cronSchedule,
      status: 'active', // Default to active on creation
    });

    const savedTask = await newScheduledTask.save();
    await addOrUpdateJob(savedTask); // Add this new task to the running scheduler

    res.status(201).json(savedTask);

  } catch (error) {
    console.error('Error creating scheduled task:', error);
    res.status(500).json({ message: 'Failed to create scheduled task.', error: error.message });
  }
});

// @route   GET /api/scheduled-tasks
// @desc    Get all scheduled tasks for the authenticated user
// @access  Private
app.get('/api/scheduled-tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const tasks = await ScheduledTask.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Error fetching scheduled tasks:', error);
    res.status(500).json({ message: 'Failed to retrieve scheduled tasks.', error: error.message });
  }
});

// @route   PUT /api/scheduled-tasks/:taskId
// @desc    Update a specific scheduled task
// @access  Private
app.put('/api/scheduled-tasks/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const { youtubePlaylistId, playlistName, cronSchedule, status } = req.body;

    const task = await ScheduledTask.findOne({ _id: taskId, userId });

    if (!task) {
      return res.status(404).json({ message: 'Scheduled task not found or you do not have permission to update it.' });
    }

    if (cronSchedule && !cron.validate(cronSchedule)) {
        return res.status(400).json({ message: 'Invalid cron schedule format.' });
    }

    // Update fields if provided
    task.youtubePlaylistId = youtubePlaylistId || task.youtubePlaylistId;
    task.playlistName = playlistName || task.playlistName;
    task.cronSchedule = cronSchedule || task.cronSchedule;
    task.status = status || task.status; // Allow status update

    const updatedTask = await task.save();

    // Re-add/update the job in the scheduler if active or remove if paused/deleted
    if (updatedTask.status === 'active') {
        await addOrUpdateJob(updatedTask); // Updates existing or adds new job
    } else {
        removeJob(updatedTask._id); // Stops and removes the job
    }

    res.status(200).json(updatedTask);

  } catch (error) {
    console.error('Error updating scheduled task:', error);
    res.status(500).json({ message: 'Failed to update scheduled task.', error: error.message });
  }
});

// @route   DELETE /api/scheduled-tasks/:taskId
// @desc    Delete a specific scheduled task
// @access  Private
app.delete('/api/scheduled-tasks/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const task = await ScheduledTask.findOne({ _id: taskId, userId });

    if (!task) {
      return res.status(404).json({ message: 'Scheduled task not found or you do not have permission to delete it.' });
    }

    await ScheduledTask.deleteOne({ _id: taskId, userId }); // Ensure deletion is tied to user
    removeJob(taskId); // Remove the job from the running scheduler

    res.status(200).json({ message: 'Scheduled task deleted successfully.' });

  } catch (error) {
    console.error('Error deleting scheduled task:', error);
    res.status(500).json({ message: 'Failed to delete scheduled task.', error: error.message });
  }
});

app.post('/api/playlists/capture', protect, async (req, res) => {
    const { playlistUrl, initialPlaylistName } = req.body;
    const userId = req.user.id;

    if (!playlistUrl) {
        return res.status(400).json({ message: 'Playlist URL is required.' });
    }

    try {
        const savedSnapshot = await savePlaylistSnapshot(userId, playlistUrl, initialPlaylistName);
        res.status(201).json(savedSnapshot);

    } catch (error) {
        console.error('Error capturing playlist:', error);
        let errorMessage = 'Failed to capture playlist.';
        if (error.message.includes('No playlist ID found')) {
            errorMessage = 'Invalid YouTube playlist URL.';
        } else if (error.message.includes('Could not fetch playlist data')) {
            errorMessage = 'Could not fetch playlist data from YouTube. Please check the URL.';
        }
        res.status(500).json({ message: errorMessage, error: error.message });
    }
});

app.get('/api/snapshots/:snapshotId/export', protect, async (req, res) => {
  try {
    const { snapshotId } = req.params;
    const userId = req.user.id;

    const snapshot = await PlaylistSnapshot.findOne({ _id: snapshotId, userId });

    if (!snapshot) {
      return res.status(404).json({ message: 'Snapshot not found or you do not have access.' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=playlist_snapshot_${snapshot.youtubePlaylistId}_${new Date(snapshot.capturedAt).toISOString().split('T')[0]}.json`);
    res.status(200).json(snapshot);

  } catch (error) {
    console.error('Error exporting snapshot:', error);
    res.status(500).json({ message: 'Failed to export snapshot.', error: error.message });
  }
});

app.delete('/api/snapshots/:snapshotId', protect, async (req, res) => {
  try {
    const { snapshotId } = req.params;
    const userId = req.user.id;

    const snapshot = await PlaylistSnapshot.findOne({ _id: snapshotId, userId });

    if (!snapshot) {
      return res.status(404).json({ message: 'Snapshot not found or you do not have permission to delete it.' });
    }

    await PlaylistSnapshot.deleteOne({ _id: snapshotId, userId });

    res.status(200).json({ message: 'Snapshot deleted successfully.' });

  } catch (error) {
    console.error('Error deleting snapshot:', error);
    res.status(500).json({ message: 'Failed to delete snapshot.', error: error.message });
  }
});

app.post('/api/snapshots/import', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const importedSnapshotData = req.body;

    if (!importedSnapshotData.youtubePlaylistId || !importedSnapshotData.title || !importedSnapshotData.videos || !Array.isArray(importedSnapshotData.videos)) {
      return res.status(400).json({ message: 'Invalid snapshot data: Missing required fields or videos array is malformed.' });
    }

    const areVideosValid = importedSnapshotData.videos.every(video =>
        video.youtubeVideoId && video.title && typeof video.position === 'number'
    );

    if (!areVideosValid) {
        return res.status(400).json({ message: 'Invalid snapshot data: Video objects must have youtubeVideoId, title, and position.' });
    }

    const newSnapshot = new PlaylistSnapshot({
      userId: userId,
      youtubePlaylistId: importedSnapshotData.youtubePlaylistId,
      title: importedSnapshotData.title,
      description: importedSnapshotData.description || '',
      publishedAt: importedSnapshotData.publishedAt || new Date(),
      thumbnailUrl: importedSnapshotData.thumbnailUrl || '',
      videos: importedSnapshotData.videos,
      videoCount: importedSnapshotData.videos.length,
      capturedAt: importedSnapshotData.capturedAt || new Date()
    });

    const savedSnapshot = await newSnapshot.save();

    res.status(201).json(savedSnapshot);

  } catch (error) {
    console.error('Error importing snapshot:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to import snapshot.', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the Playlist Tracker Backend! Database Connected! Ready for API calls.');
});

app.get('/api/playlists/:playlistId/snapshots', protect, async (req, res) => { // <--- ADD protect middleware
  try {
    const { playlistId } = req.params;
    const userId = req.user.id; // <--- NEW: Get userId

    const snapshots = await PlaylistSnapshot.find({ userId, youtubePlaylistId: playlistId }).sort({ capturedAt: -1 }); // <--- Filter by userId
    if (snapshots.length === 0) {
      return res.status(404).json({ message: 'No snapshots found for this playlist ID.' });
    }
    res.status(200).json(snapshots);
  } catch (error) {
    console.error('Error fetching playlist snapshots:', error);
    res.status(500).json({ message: 'Failed to retrieve playlist snapshots.', error: error.message });
  }
});

// Protect and filter by userId (for single snapshot too)
app.get('/api/snapshots/:snapshotId', protect, async (req, res) => { // <--- ADD protect middleware
  try {
    const { snapshotId } = req.params;
    const userId = req.user.id; // <--- NEW: Get userId

    const snapshot = await PlaylistSnapshot.findOne({ _id: snapshotId, userId }); // <--- Filter by userId
    if (!snapshot) {
      return res.status(404).json({ message: 'Snapshot not found or you do not have access.' });
    }
    res.status(200).json(snapshot);
  } catch (error) {
    console.error('Error fetching single snapshot:', error);
    res.status(500).json({ message: 'Failed to retrieve snapshot.', error: error.message });
  }
});