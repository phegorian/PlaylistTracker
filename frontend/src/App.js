// src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import PlaylistCaptureForm from './components/PlaylistCaptureForm';
import PlaylistSnapshotsList from './components/PlaylistSnapshotsList';
import PlaylistComparison from './components/PlaylistComparison';
import Register from './components/Register';
import Login from './components/Login';
import ImportSnapshot from './components/ImportSnapshot';
import ScheduledTasksManager from './components/ScheduledTasksManager';
import { useAuth } from './context/AuthContext';

function App() {
  const { user, isAuthenticated, logout, token } = useAuth();
  const [uniqueCapturedPlaylists, setUniqueCapturedPlaylists] = useState([]);
  const [viewingPlaylistId, setViewingPlaylistId] = useState(null);
  const [snapshotsToCompareIds, setSnapshotsToCompareIds] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false); // <--- NEW: State for schedule modal visibility

  const fetchUserPlaylistsOverview = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setUniqueCapturedPlaylists([]);
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/playlists/overview', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
            logout();
            throw new Error('Session expired. Please log in again.');
        }
        throw new Error(data.message || 'Failed to fetch your playlists overview.');
      }
      setUniqueCapturedPlaylists(data);
    } catch (error) {
      console.error('Error fetching user playlists overview:', error);
    }
  }, [isAuthenticated, token, logout]);

  useEffect(() => {
    fetchUserPlaylistsOverview();
  }, [fetchUserPlaylistsOverview]);

  const handlePlaylistActionSuccess = () => {
    fetchUserPlaylistsOverview();
    setShowImportModal(false);
    // No need to close schedule modal here, as it's for managing tasks, not a direct action
  };

  const handleViewSnapshots = (playlistId) => {
    setViewingPlaylistId(playlistId);
    setSnapshotsToCompareIds(null);
  };

  const handleCloseSnapshotsList = () => {
    setViewingPlaylistId(null);
    setSnapshotsToCompareIds(null);
    handlePlaylistActionSuccess();
  };

  const handleSelectSnapshotsForComparison = (ids) => {
    setSnapshotsToCompareIds(ids);
    setViewingPlaylistId(null);
  };

  const handleCloseComparison = () => {
    setSnapshotsToCompareIds(null);
    setViewingPlaylistId(null);
    handlePlaylistActionSuccess();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Playlist Tracker</h1>
        <p>Capture, Compare, and Export YouTube Playlist Snapshots</p>
        {isAuthenticated ? (
          <div className="auth-status">
            <span>Welcome, {user?.username}!</span>
            <button className="logout-button" onClick={logout}>Logout</button>
          </div>
        ) : (
          <div className="auth-status">
            <span>Please Login or Register to use the app.</span>
          </div>
        )}
      </header>
      <main>
        {!isAuthenticated ? (
          <section className="auth-section">
            {showRegister ? <Register /> : <Login />}
            <div className="toggle-auth-mode">
              {showRegister ? (
                <p>Already have an account?
                  <button onClick={() => setShowRegister(false)}>Login here</button>
                </p>
              ) : (
                <p>Don't have an account?
                  <button onClick={() => setShowRegister(true)}>Register here</button>
                </p>
              )}
            </div>
          </section>
        ) : (
          <>
            <section>
              <h2>Capture New Playlist</h2>
              <PlaylistCaptureForm onPlaylistCaptured={handlePlaylistActionSuccess} />
            </section>

            {/* --- NEW: Button to open the Scheduled Tasks Manager modal --- */}
            <section className="manage-scheduled-tasks-section">
                <div className="overview-header-group"> {/* Re-using this class for general section headers */}
                    <h2>Automation Hub</h2>
                    <button
                        className="primary-button" // Apply a suitable button style
                        onClick={() => setShowScheduleModal(true)}
                    >
                        Manage Scheduled Snapshots
                    </button>
                </div>
                <p>Automate your playlist snapshot captures with custom schedules.</p>
            </section>
            {/* --- END NEW --- */}

            {!viewingPlaylistId && !snapshotsToCompareIds && (
              <section>
                <div className="overview-header-group">
                    <h2>Your Captured Playlists Overview</h2>
                    <button
                        className="import-trigger-button"
                        onClick={() => setShowImportModal(true)}
                    >
                        Import Snapshot
                    </button>
                </div>

                {uniqueCapturedPlaylists.length === 0 ? (
                  <p>No playlists captured yet. Submit a URL above!</p>
                ) : (
                  <div className="playlist-overview-list">
                    {uniqueCapturedPlaylists.map((playlist) => (
                      <div key={playlist.youtubePlaylistId} className="playlist-card">
                        {playlist.thumbnailUrl && <img src={playlist.thumbnailUrl} alt={playlist.title} className="playlist-thumbnail" />}
                        <h3>{playlist.title}</h3>
                        <p>YouTube ID: {playlist.youtubePlaylistId}</p>
                        <p>Last Captured: {new Date(playlist.lastCapturedAt).toLocaleString()}</p>
                        <p>Videos: {playlist.lastSnapshotVideoCount}</p>
                        <button
                          className="view-snapshots-button"
                          onClick={() => handleViewSnapshots(playlist.youtubePlaylistId)}
                        >
                          View Snapshots
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {viewingPlaylistId && !snapshotsToCompareIds && (
              <section>
                <PlaylistSnapshotsList
                  youtubePlaylistId={viewingPlaylistId}
                  onSelectSnapshotsForComparison={handleSelectSnapshotsForComparison}
                  onClose={handleCloseSnapshotsList}
                />
              </section>
            )}

            {snapshotsToCompareIds && (
              <section>
                <PlaylistComparison
                  snapshotIds={snapshotsToCompareIds}
                  onCloseComparison={handleCloseComparison}
                />
              </section>
            )}

            {showImportModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button className="modal-close-button" onClick={() => setShowImportModal(false)}>×</button>
                        <ImportSnapshot onSnapshotImported={handlePlaylistActionSuccess} />
                    </div>
                </div>
            )}

            {/* --- NEW: Modal for ScheduledTasksManager --- */}
            {showScheduleModal && (
                <div className="modal-overlay">
                    <div className="modal-content large-modal-content"> {/* Added large-modal-content for more space */}
                        <button className="modal-close-button" onClick={() => setShowScheduleModal(false)}>×</button>
                        <ScheduledTasksManager onClose={() => setShowScheduleModal(false)} /> {/* Pass onClose prop */}
                    </div>
                </div>
            )}
            {/* --- END NEW --- */}
          </>
        )}
      </main>
    </div>
  );
}

export default App;