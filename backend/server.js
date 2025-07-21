const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Minimal Backend is Running!');
});

app.listen(PORT, () => {
  console.log(`Minimal backend server listening on port ${PORT}`);
});

// Add a simple error handler to catch unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Terminate the process to get a crash log if this happens
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Terminate the process
  process.exit(1);
});