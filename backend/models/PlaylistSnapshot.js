// backend/models/PlaylistSnapshot.js

const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  youtubeVideoId: { type: String, required: true },
  title: { type: String, required: true },
  position: { type: Number, required: true }
}, { _id: false }); // Do not create _id for subdocuments (videos)

const playlistSnapshotSchema = new mongoose.Schema({
  userId: { // <--- NEW FIELD: Link to the User model
    type: mongoose.Schema.Types.ObjectId, // This type indicates it's a MongoDB ObjectId
    ref: 'User', // This tells Mongoose that this field refers to the 'User' model
    required: true
  },
  youtubePlaylistId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  publishedAt: { type: Date },
  thumbnailUrl: { type: String },
  videos: [videoSchema],
  videoCount: { type: Number, required: true },
  capturedAt: { type: Date, default: Date.now }
});

// Add an index to improve query performance for user-specific playlists
playlistSnapshotSchema.index({ userId: 1, youtubePlaylistId: 1, capturedAt: -1 });

const PlaylistSnapshot = mongoose.model('PlaylistSnapshot', playlistSnapshotSchema);

module.exports = PlaylistSnapshot;