const express = require('express');
const router = express.Router();

const {
  listEmails,
  getEmailDetail,
  downloadAttachment
} = require('../controllers/review.controller');

router.get('/emails', listEmails);
router.get('/emails/:id', getEmailDetail);
router.get('/attachments/:id/download', downloadAttachment);

module.exports = router;
