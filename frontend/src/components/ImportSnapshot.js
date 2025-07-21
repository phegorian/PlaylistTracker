// frontend/src/components/ImportSnapshot.js

import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import './ImportSnapshot.css';

function ImportSnapshot({ onSnapshotImported }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const fileInputRef = useRef(null); // Ref to clear the file input
  const { token, logout } = useAuth();

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!token) {
        setError('You must be logged in to import snapshots.');
        setLoading(false);
        return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const fileContent = e.target.result;
          const snapshotData = JSON.parse(fileContent);

          // Basic client-side validation (matching backend expectations)
          if (!snapshotData.youtubePlaylistId || !snapshotData.title || !snapshotData.videos || !Array.isArray(snapshotData.videos)) {
            throw new Error('Invalid JSON structure: Missing playlist ID, title, or videos array.');
          }
          const areVideosValid = snapshotData.videos.every(video =>
              video.youtubeVideoId && video.title && typeof video.position === 'number'
          );
          if (!areVideosValid) {
              throw new Error('Invalid JSON structure: Video objects must have youtubeVideoId, title, and position.');
          }


          const response = await fetch(`${API_BASE_URL}/api/snapshots/import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(snapshotData),
          });

          const data = await response.json();

          if (!response.ok) {
            if (response.status === 401) {
                logout();
                throw new Error('Unauthorized: Session expired. Please log in again.');
            }
            throw new Error(data.message || 'Failed to import snapshot.');
          }

          setSuccessMessage('Snapshot imported successfully!');
          // Trigger a re-fetch of user's playlists in App.js
          if (onSnapshotImported) {
            onSnapshotImported(data);
          }
          // Clear the file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }

        } catch (parseError) {
          console.error('Error parsing or validating JSON:', parseError);
          setError(`Invalid file content: ${parseError.message}`);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file); // Read the file as text
    } catch (err) {
      console.error('File read error:', err);
      setError(err.message || 'An error occurred while reading the file.');
      setLoading(false);
    }
  };

  return (
    <div className="import-snapshot-container">
      <h3>Import Snapshot from JSON</h3>
      <p>Upload a JSON file containing a previously exported playlist snapshot.</p>
      <input
        type="file"
        accept=".json"
        onChange={handleFileChange}
        disabled={loading}
        ref={fileInputRef}
        className="file-input"
      />
      {loading && <p>Importing...</p>}
      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}
    </div>
  );
}

export default ImportSnapshot;