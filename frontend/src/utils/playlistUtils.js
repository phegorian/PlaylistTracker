// frontend/src/utils/playlistUtils.js

// Helper to extract playlist ID from a YouTube URL
const getPlaylistIdFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const playlistId = urlObj.searchParams.get('list');
    if (!playlistId) {
      throw new Error('No playlist ID found in URL.');
    }
    return playlistId;
  } catch (error) {
    // console.error("Error extracting playlist ID from URL:", error.message);
    return null;
  }
};

module.exports = {
  getPlaylistIdFromUrl,
};