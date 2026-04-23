export const API_BASE_URL = 'http://localhost:4000';

export const API_ENDPOINTS = {
  AUTH: {
    ME: `${API_BASE_URL}/api/auth/me`,
    SIGNIN: `${API_BASE_URL}/api/auth/signin`,
    SIGNUP: `${API_BASE_URL}/api/auth/signup`,
  },
  BATCH_PROGRESS: '/api/batch-progress/progress',
  // Add more endpoints as needed
};
