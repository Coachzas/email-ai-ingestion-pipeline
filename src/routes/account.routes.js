const express = require('express');
const router = express.Router();
const {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  testConnection,
  getSelectedAccount,
  setSelectedAccount
} = require('../controllers/account.controller');

// GET /api/accounts - Get all email accounts
router.get('/', getAccounts);

// GET /api/accounts/selected - Get currently selected account
router.get('/selected', getSelectedAccount);

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

// POST /api/accounts/select - Set selected account
router.post('/select', setSelectedAccount);

module.exports = router;
