const express = require('express');
const router = express.Router();

const {
  listEmails,
  getEmailDetail,
  downloadAttachment,
  deleteEmail,
  deleteAllEmails
} = require('../controllers/review.controller');

router.get('/emails', listEmails);
router.get('/emails/:id', getEmailDetail);
router.get('/attachments/:id/download', downloadAttachment);
router.delete('/emails', deleteAllEmails);  // Put this BEFORE the :id route
router.delete('/emails/:id', deleteEmail);

module.exports = router;
