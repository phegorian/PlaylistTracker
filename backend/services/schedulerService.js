// backend/services/schedulerService.js
const cron = require('node-cron');
const PlaylistSnapshot = require('../models/PlaylistSnapshot');
const ScheduledTask = require('../models/ScheduledTask');
const { getPlaylistData, savePlaylistSnapshot } = require('./youtubeService'); // Re-using our capture logic

// Store active cron jobs so we can manage them (start/stop/delete)
const activeJobs = new Map(); // Map<taskId, cron.ScheduledTask>

// Function to capture a playlist and save a snapshot
const executeScheduledCapture = async (task) => {
  console.log(`[Scheduler] Executing scheduled capture for playlist: ${task.youtubePlaylistId}, Task ID: ${task._id}`);
  try {
    // Step 1: Fetch playlist data from YouTube
    const playlistData = await getPlaylistData(task.youtubePlaylistId);

    if (!playlistData) {
      throw new Error('Could not fetch playlist data from YouTube.');
    }

    // Step 2: Save the snapshot to the database
    // Note: The savePlaylistSnapshot function expects a userId, playlistUrl, and initial name
    // We'll pass the necessary data from the scheduled task.
    const snapshot = await savePlaylistSnapshot(
        task.userId,
        playlistData.playlistUrl, // Use the URL derived by getPlaylistData
        playlistData.title // Use the title derived by getPlaylistData
    );

    // Step 3: Update the scheduled task's lastRunAt and status
    task.lastRunAt = new Date();
    task.status = 'active'; // Reset to active in case it was 'error'
    await task.save();

    console.log(`[Scheduler] Successfully captured snapshot for playlist ${task.youtubePlaylistId}: ${snapshot._id}`);
  } catch (error) {
    console.error(`[Scheduler] Error executing scheduled capture for task ${task._id}:`, error);
    task.status = 'error'; // Set status to error
    // Optionally, store error message
    await task.save();
  }
};

// Function to add/start a single scheduled task
const addOrUpdateJob = async (task) => {
    // If an old job for this task exists, destroy it first
    if (activeJobs.has(task._id.toString())) {
        activeJobs.get(task._id.toString()).stop();
        activeJobs.delete(task._id.toString());
        console.log(`[Scheduler] Stopped existing job for task ${task._id}`);
    }

    if (task.status === 'active' && cron.validate(task.cronSchedule)) {
        const job = cron.schedule(task.cronSchedule, async () => {
            await executeScheduledCapture(task);
        }, {
            scheduled: true, // Start immediately
            timezone: 'UTC' // It's good practice to define a timezone
        });

        activeJobs.set(task._id.toString(), job);
        console.log(`[Scheduler] Scheduled task ${task._id} for playlist ${task.youtubePlaylistId} with schedule: ${task.cronSchedule}`);

        // Manually calculate next run time for display purposes (cron doesn't expose it directly)
        // This is an estimation. For precise next run, you'd need a more robust cron parser or library.
        // For now, we'll just let `lastRunAt` be updated and assume the cron job handles the rest.
        // Or, we can trigger a first run right away if needed
        // await executeScheduledCapture(task); // Uncomment if you want immediate first run
    } else {
        console.warn(`[Scheduler] Task ${task._id} is not active or has invalid cron schedule: ${task.cronSchedule}, Status: ${task.status}`);
    }
};

// Function to remove/stop a single scheduled task
const removeJob = (taskId) => {
    if (activeJobs.has(taskId.toString())) {
        activeJobs.get(taskId.toString()).stop();
        activeJobs.delete(taskId.toString());
        console.log(`[Scheduler] Removed job for task ${taskId}`);
        return true;
    }
    return false;
};

// Initialize the scheduler: Load all active tasks from DB and start jobs
const initScheduler = async () => {
    console.log('[Scheduler] Initializing...');
    try {
        const activeTasks = await ScheduledTask.find({ status: 'active' });
        for (const task of activeTasks) {
            await addOrUpdateJob(task); // Use await here to ensure jobs are set up sequentially
        }
        console.log(`[Scheduler] Loaded and started ${activeTasks.length} active scheduled tasks.`);
    } catch (error) {
        console.error('[Scheduler] Error during initialization:', error);
    }
};

module.exports = {
    initScheduler,
    executeScheduledCapture,
    addOrUpdateJob, // Export so API routes can add new tasks
    removeJob,      // Export so API routes can delete tasks
    activeJobs      // For debugging/status if needed
};