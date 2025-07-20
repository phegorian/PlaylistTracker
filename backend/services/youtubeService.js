// backend/services/youtubeService.js

const axios = require('axios');
const PlaylistSnapshot = require('../models/PlaylistSnapshot'); // Import the PlaylistSnapshot model

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Helper to extract playlist ID from URL
const getPlaylistIdFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const playlistId = urlObj.searchParams.get('list');
    if (!playlistId) {
      throw new Error('No playlist ID found in URL.');
    }
    return playlistId;
  } catch (error) {
    console.error("Error extracting playlist ID from URL:", error.message);
    return null;
  }
};

// Function to get playlist details and videos from YouTube API
const getPlaylistData = async (playlistId) => {
  try {
    // Fetch playlist details
    const playlistDetailsRes = await axios.get(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${YOUTUBE_API_KEY}`
    );
    const playlist = playlistDetailsRes.data.items[0];

    if (!playlist) {
      console.log(`Playlist with ID ${playlistId} not found on YouTube.`);
      return null;
    }

    const playlistTitle = playlist.snippet.title;
    const playlistDescription = playlist.snippet.description;
    const playlistPublishedAt = playlist.snippet.publishedAt;
    const playlistThumbnailUrl = playlist.snippet.thumbnails.high ? playlist.snippet.thumbnails.high.url : '';
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

    let videos = [];
    let nextPageToken = null;
    let position = 1;

    // Fetch all videos in the playlist
    do {
      const playlistItemsRes = await axios.get(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`
      );

      playlistItemsRes.data.items.forEach(item => {
        if (item.snippet.title !== 'Private video' && item.snippet.title !== 'Deleted video') {
          videos.push({
            youtubeVideoId: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            position: position++,
          });
        }
      });
      nextPageToken = playlistItemsRes.data.nextPageToken;
    } while (nextPageToken);

    return {
      youtubePlaylistId: playlistId,
      title: playlistTitle,
      description: playlistDescription,
      publishedAt: playlistPublishedAt,
      thumbnailUrl: playlistThumbnailUrl,
      videos: videos,
      videoCount: videos.length,
      playlistUrl: playlistUrl, // Return the full URL as well
    };

  } catch (error) {
    console.error(`Error fetching playlist data for ID ${playlistId}:`, error.message);
    if (error.response && error.response.data && error.response.data.error) {
        console.error('YouTube API Error:', error.response.data.error.message);
    }
    return null;
  }
};

// Function to save a new playlist snapshot to the database
const savePlaylistSnapshot = async (userId, playlistUrl, initialPlaylistName) => {
    const playlistId = getPlaylistIdFromUrl(playlistUrl);
    if (!playlistId) {
        throw new Error('Invalid playlist URL provided.');
    }

    const playlistData = await getPlaylistData(playlistId);

    if (!playlistData) {
        throw new Error('Could not fetch playlist data from YouTube to save snapshot.');
    }

    const newSnapshot = new PlaylistSnapshot({
        userId: userId,
        youtubePlaylistId: playlistData.youtubePlaylistId,
        title: playlistData.title,
        description: playlistData.description,
        publishedAt: playlistData.publishedAt,
        thumbnailUrl: playlistData.thumbnailUrl,
        videos: playlistData.videos,
        videoCount: playlistData.videoCount,
        capturedAt: new Date(), // Set capture timestamp here
    });

    const savedSnapshot = await newSnapshot.save();
    console.log(`Snapshot saved successfully for playlist "${playlistData.title}"`);
    return savedSnapshot;
};

module.exports = {
  getPlaylistIdFromUrl,
  getPlaylistData,
  savePlaylistSnapshot,
};