const prisma = require('../utils/prisma');

function parseBoolean(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return undefined;
}

function safeParseInt(value, defaultValue) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : defaultValue;
}

async function listEmails(req, res) {
  const {
    fromDate,
    toDate,
    q,
    hasAttachments,
    ocrStatus,
    limit,
    offset
  } = req.query || {};

  const take = Math.min(Math.max(safeParseInt(limit, 50), 1), 200);
  const skip = Math.max(safeParseInt(offset, 0), 0);

  const receivedAtFilter = {};
  if (fromDate) {
    const startDate = new Date(fromDate);
    // Set to start of day in local timezone (Thailand UTC+7)
    startDate.setHours(0, 0, 0, 0);
    receivedAtFilter.gte = startDate;
  }

  if (toDate) {
    const endDate = new Date(toDate);
    // If it's just a date (no time), set to end of day in local timezone
    if (toDate.includes('T')) {
      receivedAtFilter.lte = endDate;
    } else {
      // Set to end of day (23:59:59.999) in local timezone
      endDate.setHours(23, 59, 59, 999);
      receivedAtFilter.lte = endDate;
    }
  }

  // Get the selected account
  const account = await prisma.emailAccount.findFirst({
    where: { 
      status: 'ACTIVE',
      isSelected: true 
    },
    select: {
      id: true,
      name: true,
      username: true
    }
  });

  // If no selected account, return empty result
  if (!account) {
    return res.json({
      items: [],
      total: 0,
      page: 1,
      totalPages: 0
    });
  }

  const where = {
    accountId: account.id, // Only fetch emails from selected account
    ...(Object.keys(receivedAtFilter).length > 0 ? { receivedAt: receivedAtFilter } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: String(q), mode: 'insensitive' } },
            { fromEmail: { contains: String(q), mode: 'insensitive' } }
          ]
        }
      : {})
  };

  // We'll apply hasAttachments / ocrStatus filtering after fetching,
  // because Prisma filtering across relations would require more complex queries.
  const emails = await prisma.email.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    skip,
    take,
    include: {
      account: {
        select: {
          id: true,
          name: true,
          username: true
        }
      },
      attachments: {
        select: {
          id: true,
          extractedText: true
        }
      }
    }
  });

  const wantsHasAttachments = parseBoolean(hasAttachments);
  const wantsOcrStatus = ocrStatus ? String(ocrStatus).trim().toLowerCase() : undefined;

  const items = emails
    .map((email) => {
      // Debug: Check email structure
      console.log(`🔍 Email ${email.id} structure:`, {
        hasAccount: !!email.account,
        accountKeys: email.account ? Object.keys(email.account) : [],
        attachmentsCount: email.attachments?.length || 0
      });

      const attachmentCount = email.attachments?.length || 0;
      const extractedCount = email.attachments?.filter((a) => a.extractedText && a.extractedText.length > 0).length || 0;
      const pendingCount = attachmentCount - extractedCount;

      let computedOcrStatus = 'none';
      if (attachmentCount > 0 && pendingCount === 0) computedOcrStatus = 'done';
      else if (attachmentCount > 0 && extractedCount === 0) computedOcrStatus = 'pending';
      else if (attachmentCount > 0 && extractedCount > 0) computedOcrStatus = 'partial';

      return {
        id: email.id,
        imapUid: email.imapUid,
        fromEmail: email.fromEmail,
        subject: email.subject,
        receivedAt: email.receivedAt,
        attachmentCount,
        extractedCount,
        pendingCount,
        ocrStatus: computedOcrStatus,
        account: {
          id: email.account.id,
          name: email.account.name,
          username: email.account.username
        }
      };
    })
    .filter((row) => {
      if (wantsHasAttachments === true && row.attachmentCount === 0) return false;
      if (wantsHasAttachments === false && row.attachmentCount > 0) return false;
      if (wantsOcrStatus && row.ocrStatus !== wantsOcrStatus) return false;
      return true;
    });

  res.json({
    status: 'success',
    items,
    returned: items.length,
    limit: take,
    offset: skip
  });
  
}

async function getEmailDetail(req, res) {
  try {
    const { id } = req.params;

    const email = await prisma.email.findUnique({
      where: { id },
      include: {
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            filePath: true,
            size: true,
            extractedText: true,
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!email) {
      return res.status(404).json({
        status: 'error',
        message: 'Email not found'
      });
    }

    res.json({
      status: 'success',
      email
    });
  } catch (error) {
    console.error('❌ Review getEmailDetail error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

async function downloadAttachment(req, res) {
  try {
    const { id } = req.params;

    const attachment = await prisma.attachment.findUnique({
      where: { id }
    });

    if (!attachment) {
      return res.status(404).json({
        status: 'error',
        message: 'Attachment not found'
      });
    }

    const fs = require('fs');
    const path = require('path');

    const filePath = path.join(__dirname, '../../', attachment.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        message: 'File not found on disk'
      });
    }

    res.download(filePath, attachment.fileName, (err) => {
      if (err) {
        console.error('❌ Review downloadAttachment error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            status: 'error',
            message: 'Failed to download file'
          });
        }
      }
    });
  } catch (error) {
    console.error('❌ Review downloadAttachment error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

module.exports = {
  listEmails,
  getEmailDetail,
  downloadAttachment
};
