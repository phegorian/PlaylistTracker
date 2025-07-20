// frontend/src/components/PlaylistCaptureForm.js

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // <--- NEW: Import useAuth
import './PlaylistCaptureForm.css';

function PlaylistCaptureForm({ onPlaylistCaptured }) {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const { token } = useAuth(); // <--- NEW: Get the token from AuthContext

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // <--- NEW: Check if token exists before sending request
    if (!token) {
        setError('You must be logged in to capture playlists.');
        setLoading(false);
        return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/playlists/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // <--- NEW: Add Authorization header
        },
        body: JSON.stringify({ playlistUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific 401 Unauthorized errors
        if (response.status === 401) {
            throw new Error('Unauthorized: Please log in again.');
        }
        throw new Error(data.message || 'Failed to capture playlist.');
      }

      setSuccessMessage('Playlist snapshot captured successfully!');
      setPlaylistUrl(''); // Clear the input field
      if (onPlaylistCaptured) {
        onPlaylistCaptured(data);
      }

    } catch (err) {
      console.error('Error capturing playlist:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="playlist-capture-form">
      <div className="form-group">
        <label htmlFor="playlistUrl">YouTube Playlist URL:</label>
        <input
          type="text"
          id="playlistUrl"
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
          placeholder="e.g., https://www.youtube.com/playlist?list=PLpTqVlC9a2k-5l5l5l5l5l5l5l5l5l5l"
          required
          className="form-input"
        />
      </div>
      <button type="submit" disabled={loading} className="submit-button">
        {loading ? 'Capturing...' : 'Capture Snapshot'}
      </button>

      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}
    </form>
  );
}

export default PlaylistCaptureForm;