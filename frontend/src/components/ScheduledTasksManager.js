// frontend/src/components/ScheduledTasksManager.js

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import { getPlaylistIdFromUrl } from '../utils/playlistUtils';
import './ScheduledTasksManager.css';

// Helper to format time (e.g., '14:30' => { hour: 14, minute: 30 })
const parseTime = (timeString) => {
  const [hour, minute] = timeString.split(':').map(Number);
  return { hour, minute };
};

// Helper to format time back to string (e.g., { hour: 14, minute: 30 } => '14:30')
const formatTime = (hour, minute) => {
  // Ensure hour and minute are always two digits
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

// Helper to get current hour and minute in UTC as string 'HH:MM'
const getCurrentUTCTimestring = () => {
    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    return formatTime(hour, minute);
};


function ScheduledTasksManager({ onClose }) {
  const { token, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- State for the new task form - Simplified Cron Input ---
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newScheduleType, setNewScheduleType] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [newDailyTime, setNewDailyTime] = useState(getCurrentUTCTimestring()); // HH:MM format
  const [newWeeklyDay, setNewWeeklyDay] = useState('0'); // 0=Sunday, 1=Monday...6=Saturday
  const [newWeeklyTime, setNewWeeklyTime] = useState(getCurrentUTCTimestring());
  const [newMonthlyDay, setNewMonthlyDay] = useState('1'); // Day of month (1-31)
  const [newMonthlyTime, setNewMonthlyTime] = useState(getCurrentUTCTimestring());
  // newCustomCron state removed as it's no longer an option

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // --- State for editing a task - Simplified Cron Input ---
  const [editingTask, setEditingTask] = useState(null); // Stores the task object being edited
  const [editScheduleType, setEditScheduleType] = useState('');
  const [editDailyTime, setEditDailyTime] = useState('');
  const [editWeeklyDay, setEditWeeklyDay] = useState('');
  const [editWeeklyTime, setEditWeeklyTime] = useState('');
  const [editMonthlyDay, setEditMonthlyDay] = useState('');
  const [editMonthlyTime, setEditMonthlyTime] = useState('');
  // editCustomCron state removed
  const [editStatus, setEditStatus] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  // Helper function to generate cron expression from user-friendly inputs
  const generateCronExpression = (type, dailyTime, weeklyDay, weeklyTime, monthlyDay, monthlyTime) => { // Removed customCron arg
    let cron = '';
    let hour, minute;

    switch (type) {
      case 'daily':
        ({ hour, minute } = parseTime(dailyTime));
        cron = `${minute} ${hour} * * *`;
        break;
      case 'weekly':
        ({ hour, minute } = parseTime(weeklyTime));
        cron = `${minute} ${hour} * * ${weeklyDay}`;
        break;
      case 'monthly':
        ({ hour, minute } = parseTime(monthlyTime));
        cron = `${minute} ${hour} ${monthlyDay} * *`;
        break;
      // 'custom' case removed
      default:
        console.error("Unknown schedule type:", type);
        cron = ''; // Fallback for safety, though should not be hit
    }
    return cron;
  };

  // Helper function to try and parse an existing cron into user-friendly fields
  const parseCronToFields = (cronString) => {
      const parts = cronString.split(' ');
      if (parts.length !== 5) {
          // Default to daily if not a standard 5-part cron, or if it's not recognizable
          return { type: 'daily', dailyTime: getCurrentUTCTimestring() };
      }
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      // Attempt to detect daily
      if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
          return { type: 'daily', dailyTime: formatTime(hour, minute) };
      }
      // Attempt to detect weekly
      if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
          return { type: 'weekly', weeklyDay: dayOfWeek, weeklyTime: formatTime(hour, minute) };
      }
      // Attempt to detect monthly
      if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
          return { type: 'monthly', monthlyDay: dayOfMonth, monthlyTime: formatTime(hour, minute) };
      }

      // If none of the above friendly patterns match, default to daily for editing
      // User will have to adjust if original was a complex custom cron.
      // We can't display it as "custom" anymore.
      console.warn("Existing cron schedule does not match a simplified pattern, defaulting to daily:", cronString);
      return { type: 'daily', dailyTime: getCurrentUTCTimestring() };
  };


  // Fetch all scheduled tasks for the user (remains the same)
  const fetchScheduledTasks = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduled-tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          throw new Error('Unauthorized: Please log in again.');
        }
        throw new Error(data.message || 'Failed to fetch scheduled tasks.');
      }
      setTasks(data);
    } catch (err) {
      console.error('Error fetching scheduled tasks:', err);
      setError(err.message || 'An unexpected error occurred while fetching tasks.');
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    fetchScheduledTasks();
  }, [fetchScheduledTasks]);

  // Handle new task creation
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    if (!token) {
        setFormError('Authentication required.');
        setFormLoading(false);
        return;
    }
    if (!newPlaylistUrl || !newPlaylistName) {
        setFormError('Playlist URL and Display Name are required.');
        setFormLoading(false);
        return;
    }

    const youtubePlaylistId = getPlaylistIdFromUrl(newPlaylistUrl);
    if (!youtubePlaylistId) {
        setFormError('Invalid YouTube playlist URL.');
        setFormLoading(false);
        return;
    }

    const cronSchedule = generateCronExpression(
      newScheduleType,
      newDailyTime,
      newWeeklyDay,
      newWeeklyTime,
      newMonthlyDay,
      newMonthlyTime
      // Removed newCustomCron argument
    );

    if (!cronSchedule) { // Simple check if cron generation failed
        setFormError('Could not generate schedule. Please check inputs.');
        setFormLoading(false);
        return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduled-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          youtubePlaylistId,
          playlistName: newPlaylistName,
          cronSchedule, // Use the generated cron expression
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          throw new Error('Unauthorized: Please log in again.');
        }
        throw new Error(data.message || 'Failed to create scheduled task.');
      }

      setTasks(prevTasks => [data, ...prevTasks]); // Add new task to the list
      setNewPlaylistUrl('');
      setNewPlaylistName('');
      setNewScheduleType('daily'); // Reset schedule form
      setNewDailyTime(getCurrentUTCTimestring());
      setNewWeeklyDay('0');
      setNewWeeklyTime(getCurrentUTCTimestring());
      setNewMonthlyDay('1');
      setNewMonthlyTime(getCurrentUTCTimestring());
      // newCustomCron state reset removed
      alert('Scheduled task created successfully!');
      onClose();

    } catch (err) {
      console.error('Error creating task:', err);
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle task deletion (remains the same)
  const handleDeleteTask = async (taskId, playlistName) => {
    if (!window.confirm(`Are you sure you want to delete the scheduled task for "${playlistName}"?`)) {
      return;
    }
    if (!token) {
        setError('Authentication required.');
        return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduled-tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          throw new Error('Unauthorized: Please log in again.');
        }
        throw new Error('Failed to delete scheduled task.');
      }

      setTasks(prevTasks => prevTasks.filter(task => task._id !== taskId));
      alert('Scheduled task deleted successfully!');

    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Handle opening edit form
  const handleEditClick = (task) => {
    setEditingTask(task);
    setEditStatus(task.status);
    const parsedCron = parseCronToFields(task.cronSchedule);
    setEditScheduleType(parsedCron.type);
    setEditDailyTime(parsedCron.dailyTime || getCurrentUTCTimestring());
    setEditWeeklyDay(parsedCron.weeklyDay || '0');
    setEditWeeklyTime(parsedCron.weeklyTime || getCurrentUTCTimestring());
    setEditMonthlyDay(parsedCron.monthlyDay || '1');
    setEditMonthlyTime(parsedCron.monthlyTime || getCurrentUTCTimestring());
    // setEditCustomCron removed
    setEditError(null);
    setEditLoading(false);
  };

  // Handle updating a task
  const handleUpdateTask = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);

    if (!token) {
        setEditError('Authentication required.');
        setEditLoading(false);
        return;
    }
    if (!editingTask || !editStatus) { // cronSchedule will be generated
        setEditError('All fields are required.');
        setEditLoading(false);
        return;
    }

    const cronSchedule = generateCronExpression(
      editScheduleType,
      editDailyTime,
      editWeeklyDay,
      editWeeklyTime,
      editMonthlyDay,
      editMonthlyTime
      // editCustomCron argument removed
    );

    if (!cronSchedule) { // Simple check if cron generation failed
        setEditError('Could not generate schedule. Please check inputs.');
        setEditLoading(false);
        return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduled-tasks/${editingTask._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cronSchedule, // Use the generated cron expression
          status: editStatus,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          throw new Error('Unauthorized: Please log in again.');
        }
        throw new Error(data.message || 'Failed to update scheduled task.');
      }

      setTasks(prevTasks => prevTasks.map(task =>
        task._id === data._id ? data : task
      ));
      setEditingTask(null);
      alert('Scheduled task updated successfully!');

    } catch (err) {
      console.error('Error updating task:', err);
      setEditError(err.message || 'An unexpected error occurred.');
    } finally {
      setEditLoading(false);
    }
  };


  // --- Render Helpers for Schedule Inputs ---
  // Removed customCron and setCustomCron args
  const renderScheduleInputs = (scheduleType, dailyTime, setDailyTime, weeklyDay, setWeeklyDay, weeklyTime, setWeeklyTime, monthlyDay, setMonthlyDay, monthlyTime, setMonthlyTime, disabled) => {
    switch (scheduleType) {
      case 'daily':
        return (
          <div className="schedule-options">
            <label>Time (UTC):</label>
            <input
              type="time"
              value={dailyTime}
              onChange={(e) => setDailyTime(e.target.value)}
              required
              disabled={disabled}
            />
          </div>
        );
      case 'weekly':
        return (
          <div className="schedule-options">
            <label>Day of Week (UTC):</label>
            <select value={weeklyDay} onChange={(e) => setWeeklyDay(e.target.value)} required disabled={disabled}>
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
            </select>
            <label>Time (UTC):</label>
            <input
              type="time"
              value={weeklyTime}
              onChange={(e) => setWeeklyTime(e.target.value)}
              required
              disabled={disabled}
            />
          </div>
        );
      case 'monthly':
        return (
          <div className="schedule-options">
            <label>Day of Month (UTC):</label>
            <input
              type="number"
              min="1"
              max="31"
              value={monthlyDay}
              onChange={(e) => setMonthlyDay(e.target.value)}
              required
              disabled={disabled}
            />
            <label>Time (UTC):</label>
            <input
              type="time"
              value={monthlyTime}
              onChange={(e) => setMonthlyTime(e.target.value)}
              required
              disabled={disabled}
            />
          </div>
        );
      // 'custom' case removed
      default:
        return null;
    }
  };


  if (!token) {
    return <p className="info-message">Please log in to manage scheduled tasks.</p>;
  }
  if (loading) return <p>Loading scheduled tasks...</p>;
  if (error) return <p className="error-message">Error: {error}</p>;

  return (
    <div className="scheduled-tasks-manager">
      <section className="create-task-section">
        <h3>Schedule New Snapshot</h3>
        <form onSubmit={handleCreateTask} className="task-form">
          <div className="form-group">
            <label htmlFor="newPlaylistUrl">YouTube Playlist URL:</label>
            <input
              type="text"
              id="newPlaylistUrl"
              value={newPlaylistUrl}
              onChange={(e) => setNewPlaylistUrl(e.target.value)}
              placeholder="e.g., https://www.youtube.com/playlist?list=PL... "
              required
              disabled={formLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="newPlaylistName">Display Name (for your reference):</label>
            <input
              type="text"
              id="newPlaylistName"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="e.g., My Favorite Vlogs"
              required
              disabled={formLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="newScheduleType">Schedule Frequency (UTC):</label>
            <select
              id="newScheduleType"
              value={newScheduleType}
              onChange={(e) => setNewScheduleType(e.target.value)}
              disabled={formLoading}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              {/* Removed custom option */}
            </select>
          </div>
          {renderScheduleInputs(
            newScheduleType,
            newDailyTime, setNewDailyTime,
            newWeeklyDay, setNewWeeklyDay, newWeeklyTime, setNewWeeklyTime,
            newMonthlyDay, setNewMonthlyDay, newMonthlyTime, setNewMonthlyTime,
            formLoading // Removed custom cron related args
          )}
          <button type="submit" disabled={formLoading} className="submit-button">
            {formLoading ? 'Scheduling...' : 'Schedule Snapshot'}
          </button>
          {formError && <p className="error-message">{formError}</p>}
        </form>
        {/* Removed cronExamples div and cron-hint paragraph */}
      </section>

      <section className="task-list-section">
        <h3>Your Scheduled Tasks ({tasks.length})</h3>
        {tasks.length === 0 ? (
          <p>You have no scheduled tasks yet. Create one above!</p>
        ) : (
          <ul className="task-list">
            {tasks.map(task => (
              <li key={task._id} className="task-item">
                {editingTask && editingTask._id === task._id ? (
                  // Edit form
                  <form onSubmit={handleUpdateTask} className="edit-task-form">
                    <h4>Editing: {task.playlistName}</h4>
                    <div className="form-group">
                        <label htmlFor="editScheduleType">Schedule Frequency (UTC):</label>
                        <select
                            id="editScheduleType"
                            value={editScheduleType}
                            onChange={(e) => setEditScheduleType(e.target.value)}
                            disabled={editLoading}
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            {/* Removed custom option */}
                        </select>
                    </div>
                    {renderScheduleInputs(
                        editScheduleType,
                        editDailyTime, setEditDailyTime,
                        editWeeklyDay, setEditWeeklyDay, editWeeklyTime, setEditWeeklyTime,
                        editMonthlyDay, setEditMonthlyDay, editMonthlyTime, setEditMonthlyTime,
                        editLoading // Removed custom cron related args
                    )}
                    <div className="form-group">
                      <label htmlFor="editStatus">Status:</label>
                      <select
                        id="editStatus"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        disabled={editLoading}
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                    <div className="edit-buttons">
                      <button type="submit" disabled={editLoading} className="update-button">
                        {editLoading ? 'Updating...' : 'Update Task'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTask(null)}
                        disabled={editLoading}
                        className="cancel-button"
                      >
                        Cancel
                      </button>
                    </div>
                    {editError && <p className="error-message">{editError}</p>}
                  </form>
                ) : (
                  // Display task info (remains mostly same, cronSchedule display is fine)
                  <div className="task-details">
                    <p><strong>Playlist:</strong> {task.playlistName}</p>
                    <p><strong>YouTube ID:</strong> {task.youtubePlaylistId}</p>
                    <p><strong>Schedule:</strong> <code>{task.cronSchedule}</code></p> {/* Keep this for showing the saved cron */}
                    <p><strong>Status:</strong> <span className={`task-status ${task.status}`}>{task.status}</span></p>
                    {task.lastRunAt && <p><strong>Last Run:</strong> {new Date(task.lastRunAt).toLocaleString()}</p>}
                    <p><strong>Created:</strong> {new Date(task.createdAt).toLocaleString()}</p>
                    <div className="task-actions">
                      <button className="edit-button" onClick={() => handleEditClick(task)}>Edit</button>
                      <button className="delete-button" onClick={() => handleDeleteTask(task._id, task.playlistName)}>Delete</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default ScheduledTasksManager;