const express = require('express');
const router = express.Router();

const {
  listEmails,
  getEmailDetail,
  downloadAttachment,
  deleteEmail
} = require('../controllers/review.controller');

router.get('/emails', listEmails);
router.get('/emails/:id', getEmailDetail);
router.get('/attachments/:id/download', downloadAttachment);
router.delete('/emails/:id', deleteEmail);

module.exports = router;
