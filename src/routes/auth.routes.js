const express = require('express');
const router = express.Router();
const {
  signUp,
  signIn,
  getCurrentUser,
  signOut,
  verifyUser
} = require('../controllers/auth.controller');

// Public routes
router.post('/signup', signUp);
router.post('/signin', signIn);

// Protected routes
router.get('/me', verifyUser, getCurrentUser);
router.post('/signout', verifyUser, signOut);

module.exports = router;
