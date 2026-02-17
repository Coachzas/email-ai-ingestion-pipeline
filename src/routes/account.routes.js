const express = require('express');
const router = express.Router();
const {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  testConnection
} = require('../controllers/account.controller');

// GET /api/accounts - Get all email accounts
router.get('/', getAccounts);

// GET /api/accounts/:id - Get single account
router.get('/:id', getAccount);

// POST /api/accounts - Create new account
router.post('/', createAccount);

// PUT /api/accounts/:id - Update account
router.put('/:id', updateAccount);

// DELETE /api/accounts/:id - Delete account
router.delete('/:id', deleteAccount);

// POST /api/accounts/test-connection - Test connection
router.post('/test-connection', testConnection);

module.exports = router;
