// frontend/src/components/PlaylistSnapshotsList.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './PlaylistSnapshotsList.css';

function PlaylistSnapshotsList({ youtubePlaylistId, onSelectSnapshotsForComparison, onClose }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState([]);
  const { token, logout } = useAuth();

  useEffect(() => {
    const fetchSnapshots = async () => {
      if (!youtubePlaylistId) {
        setLoading(false);
        return;
      }

      if (!token) {
          setError('Authentication required to view snapshots.');
          setLoading(false);
          return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:5000/api/playlists/${youtubePlaylistId}/snapshots`, {
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
            throw new Error(data.message || 'Failed to fetch snapshots.');
        }

        setSnapshots(data);
      } catch (err) {
        console.error('Error fetching snapshots:', err);
        setError(err.message || 'An unexpected error occurred while fetching snapshots.');
      } finally {
        setLoading(false);
      }
    };

    fetchSnapshots();
  }, [youtubePlaylistId, token, logout]);

  const handleCheckboxChange = (snapshotId) => {
    setSelectedSnapshotIds(prevSelected => {
      if (prevSelected.includes(snapshotId)) {
        return prevSelected.filter(id => id !== snapshotId);
      } else if (prevSelected.length < 2) {
        return [...prevSelected, snapshotId];
      }
      return prevSelected;
    });
  };

  const handleCompareClick = () => {
    if (selectedSnapshotIds.length === 2) {
      onSelectSnapshotsForComparison(selectedSnapshotIds);
    } else {
      alert('Please select exactly two snapshots to compare.');
    }
  };

  const handleExportClick = async (snapshotId, format) => {
      if (!token) {
          setError('Authentication required to export snapshots.');
          return;
      }
      try {
          const response = await fetch(`http://localhost:5000/api/snapshots/${snapshotId}/export`, {
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });

          if (!response.ok) {
              if (response.status === 401) {
                  logout();
                  throw new Error('Unauthorized: Please log in again.');
              }
              throw new Error(`Failed to export snapshot: ${response.statusText}`);
          }

          const data = await response.json();
          const filename = `playlist_snapshot_${data.youtubePlaylistId}_${new Date(data.capturedAt).toISOString().split('T')[0]}`;

          if (format === 'json') {
              const jsonString = JSON.stringify(data, null, 2);
              const blob = new Blob([jsonString], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${filename}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              alert('Snapshot exported as JSON!');
          } else if (format === 'csv') {
              if (!data.videos || data.videos.length === 0) {
                  alert('No video data to export to CSV.');
                  return;
              }

              const headers = ["Position", "Video Title", "Video ID"];
              const rows = data.videos.map(video => [
                  video.position,
                  `"${video.title.replace(/"/g, '""')}"`,
                  video.youtubeVideoId
              ]);

              const csvString = [
                  headers.join(','),
                  ...rows.map(e => e.join(','))
              ].join('\n');

              const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${filename}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              alert('Snapshot exported as CSV!');

          } else {
              alert('Unsupported export format.');
          }

      } catch (err) {
          console.error('Export error:', err);
          setError(err.message || 'An error occurred during export.');
      }
  };

  // NEW: Handle delete click
  const handleDeleteClick = async (snapshotId, snapshotTitle, capturedAt) => {
      if (!token) {
          setError('Authentication required to delete snapshots.');
          return;
      }

      const confirmDelete = window.confirm(
          `Are you sure you want to delete the snapshot titled "${snapshotTitle}" captured on ${new Date(capturedAt).toLocaleString()}? This action cannot be undone.`
      );

      if (!confirmDelete) {
          return;
      }

      try {
          const response = await fetch(`http://localhost:5000/api/snapshots/${snapshotId}`, {
              method: 'DELETE', // <--- IMPORTANT: Use DELETE method
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });

          if (!response.ok) {
              if (response.status === 401) {
                  logout();
                  throw new Error('Unauthorized: Please log in again.');
              }
              throw new Error(`Failed to delete snapshot: ${response.statusText}`);
          }

          // Update the UI: Filter out the deleted snapshot
          setSnapshots(prevSnapshots => prevSnapshots.filter(s => s._id !== snapshotId));
          // Also remove from selected snapshots if it was selected
          setSelectedSnapshotIds(prevSelected => prevSelected.filter(id => id !== snapshotId));

          alert('Snapshot deleted successfully!');
          // If this was the last snapshot, we might want to close the list
          if (snapshots.length === 1) { // If it was the only snapshot
              onClose(); // Go back to the playlist overview
          }

      } catch (err) {
          console.error('Delete error:', err);
          setError(err.message || 'An error occurred during deletion.');
      }
  };


  if (loading) return <p>Loading snapshots...</p>;
  if (error) return <p className="error-message">Error: {error}</p>;
  if (snapshots.length === 0) return <p>No snapshots available for this playlist.</p>;

  const sortedSnapshots = [...snapshots].sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));

  return (
    <div className="snapshots-list-container">
      <button className="close-button" onClick={onClose}>× Close List</button>
      <h2>Snapshots for Playlist ID: {youtubePlaylistId}</h2>
      <div className="compare-controls">
        <button
          onClick={handleCompareClick}
          disabled={selectedSnapshotIds.length !== 2}
          className="compare-button"
        >
          Compare Selected ({selectedSnapshotIds.length}/2)
        </button>
      </div>
      <ul className="snapshot-items">
        {sortedSnapshots.map(snapshot => (
          <li key={snapshot._id} className="snapshot-item">
            <input
              type="checkbox"
              id={`snapshot-${snapshot._id}`}
              checked={selectedSnapshotIds.includes(snapshot._id)}
              onChange={() => handleCheckboxChange(snapshot._id)}
              disabled={!selectedSnapshotIds.includes(snapshot._id) && selectedSnapshotIds.length >= 2}
            />
            <label htmlFor={`snapshot-${snapshot._id}`}>
              <strong>Captured:</strong> {new Date(snapshot.capturedAt).toLocaleString()} |
              <strong> Videos:</strong> {snapshot.videoCount} |
              <span className="snapshot-title"> {snapshot.title}</span>
            </label>
            <div className="snapshot-actions">
                <button className="export-button" onClick={() => handleExportClick(snapshot._id, 'json')}>
                    Export JSON
                </button>
                <button className="export-button" onClick={() => handleExportClick(snapshot._id, 'csv')}>
                    Export CSV
                </button>
                <button
                    className="delete-button" // <--- NEW: Delete button
                    onClick={() => handleDeleteClick(snapshot._id, snapshot.title, snapshot.capturedAt)}
                >
                    Delete
                </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PlaylistSnapshotsList;