// frontend/src/components/PlaylistComparison.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import './PlaylistComparison.css';

function PlaylistComparison({ snapshotIds, onCloseComparison }) {
  const [snapshot1, setSnapshot1] = useState(null);
  const [snapshot2, setSnapshot2] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comparisonResults, setComparisonResults] = useState(null);
  const { token, logout } = useAuth(); // <--- NEW: Get the token and logout function

  useEffect(() => {
    const fetchSnapshotsForComparison = async () => {
      setLoading(true);
      setError(null);

      if (!token) { // <--- NEW: Check if token exists
          setError('Authentication required to compare playlists.');
          setLoading(false);
          return;
      }

      try {
        const [id1, id2] = snapshotIds;

        const fetchSnapshot = async (id) => {
            const response = await fetch(`${API_BASE_URL}/api/snapshots/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}` // <--- NEW: Add Authorization header
                }
            });
            const data = await response.json();
            if (!response.ok) {
                if (response.status === 401) {
                    logout(); // Log out if token is invalid/expired
                    throw new Error('Unauthorized: Please log in again.');
                }
                throw new Error(data.message || `Failed to fetch snapshot (${id}).`);
            }
            return data;
        };

        const data1 = await fetchSnapshot(id1);
        setSnapshot1(data1);

        const data2 = await fetchSnapshot(id2);
        setSnapshot2(data2);

        compareSnapshots(data1, data2);

      } catch (err) {
        console.error('Error fetching snapshots for comparison:', err);
        setError(err.message || 'An unexpected error occurred while fetching snapshots for comparison.');
      } finally {
        setLoading(false);
      }
    };

    if (snapshotIds && snapshotIds.length === 2) {
      fetchSnapshotsForComparison();
    } else {
      setError('Please provide exactly two snapshot IDs for comparison.');
      setLoading(false);
    }
  }, [snapshotIds, token, logout]); // Re-run when snapshotIds or token changes

  const compareSnapshots = (snap1, snap2) => {
    const videos1 = snap1.videos || [];
    const videos2 = snap2.videos || [];

    const map1 = new Map(videos1.map(v => [v.youtubeVideoId, v]));
    const map2 = new Map(videos2.map(v => [v.youtubeVideoId, v]));

    const addedVideos = videos2.filter(v => !map1.has(v.youtubeVideoId));
    const removedVideos = videos1.filter(v => !map2.has(v.youtubeVideoId));

    const commonVideos1 = videos1.filter(v => map2.has(v.youtubeVideoId));
    const commonVideos2 = videos2.filter(v => map1.has(v.youtubeVideoId));

    const reorderedVideos = [];
    const unchangedVideos = [];

    for (let i = 0; i < commonVideos1.length; i++) {
        const videoInSnap1 = commonVideos1[i];
        const videoInSnap2 = commonVideos2.find(v => v.youtubeVideoId === videoInSnap1.youtubeVideoId);

        if (videoInSnap2) {
            if (videoInSnap1.position !== videoInSnap2.position) {
                reorderedVideos.push({
                    ...videoInSnap1,
                    oldPosition: videoInSnap1.position,
                    newPosition: videoInSnap2.position
                });
            } else {
                unchangedVideos.push(videoInSnap1);
            }
        }
    }

    setComparisonResults({ addedVideos, removedVideos, reorderedVideos, unchangedVideos });
  };

  if (loading) return <p>Loading comparison data...</p>;
  if (error) return <p className="error-message">Error: {error}</p>;
  if (!snapshot1 || !snapshot2 || !comparisonResults) return <p>Something went wrong. No comparison data.</p>;

  return (
    <div className="comparison-container">
      <button className="close-button" onClick={onCloseComparison}>&times; Back to Snapshots</button>
      <h2>Playlist Comparison</h2>
      <div className="comparison-header">
        <div className="snapshot-info">
          <h3>Snapshot 1: {new Date(snapshot1.capturedAt).toLocaleString()}</h3>
          <p>Videos: {snapshot1.videoCount}</p>
          <p>Title: {snapshot1.title}</p>
        </div>
        <div className="snapshot-info">
          <h3>Snapshot 2: {new Date(snapshot2.capturedAt).toLocaleString()}</h3>
          <p>Videos: {snapshot2.videoCount}</p>
          <p>Title: {snapshot2.title}</p>
        </div>
      </div>

      <div className="comparison-results">
        {comparisonResults.addedVideos.length > 0 && (
          <div className="result-section added">
            <h3>Added Videos ({comparisonResults.addedVideos.length})</h3>
            <ul>
              {comparisonResults.addedVideos.map(video => (
                <li key={video.youtubeVideoId}>
                  {video.title} (New Position: {video.position})
                </li>
              ))}
            </ul>
          </div>
        )}

        {comparisonResults.removedVideos.length > 0 && (
          <div className="result-section removed">
            <h3>Removed Videos ({comparisonResults.removedVideos.length})</h3>
            <ul>
              {comparisonResults.removedVideos.map(video => (
                <li key={video.youtubeVideoId}>
                  {video.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {comparisonResults.reorderedVideos.length > 0 && (
          <div className="result-section reordered">
            <h3>Reordered Videos ({comparisonResults.reorderedVideos.length})</h3>
            <ul>
              {comparisonResults.reorderedVideos.map(video => (
                <li key={video.youtubeVideoId}>
                  {video.title} (Old Pos: {video.oldPosition}, New Pos: {video.newPosition})
                </li>
              ))}
            </ul>
          </div>
        )}

        {comparisonResults.unchangedVideos.length > 0 && (
          <div className="result-section unchanged">
            <h3>Unchanged Videos ({comparisonResults.unchangedVideos.length})</h3>
            <ul>
              {comparisonResults.unchangedVideos.map(video => (
                <li key={video.youtubeVideoId}>
                  {video.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {comparisonResults.addedVideos.length === 0 &&
         comparisonResults.removedVideos.length === 0 &&
         comparisonResults.reorderedVideos.length === 0 &&
         <p className="no-changes">No changes detected between these two snapshots.</p>
        }
      </div>
    </div>
  );
}

export default PlaylistComparison;