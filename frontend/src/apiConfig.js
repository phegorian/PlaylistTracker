// frontend/src/apiConfig.js

// This constant will hold the base URL for your backend API.
// It uses the environment variable set during the build process on Cloud Run.
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

// Export it so other files can import and use it.
export { API_BASE_URL };