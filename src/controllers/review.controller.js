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

  const take = Math.min(Math.max(safeParseInt(limit, 100), 1), 200);
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
  
  // Get total count for pagination (before filtering)
  const totalCount = await prisma.email.count({ where });
  
  const wantsHasAttachments = parseBoolean(hasAttachments);
  const wantsOcrStatus = ocrStatus ? String(ocrStatus).trim().toLowerCase() : undefined;

  let emails, filteredTotal;
  
  if (wantsHasAttachments !== undefined || wantsOcrStatus !== undefined) {
    // If there are filters, we need to fetch all emails and then filter
    // This is less efficient but ensures correct pagination
    const allEmails = await prisma.email.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
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
            extractedText: true,
            fileName: true,
            filePath: true,
            size: true
          }
        }
      }
    });
    
    // Apply the same filtering logic
    const filteredEmails = allEmails
      .map((email) => {
        const attachmentCount = email.attachments?.length || 0;
        const extractedCount = email.attachments?.filter((a) => a.extractedText && a.extractedText.length > 0).length || 0;
        const pendingCount = attachmentCount - extractedCount;

        let computedOcrStatus = 'none';
        if (attachmentCount > 0) {
          if (extractedCount === 0) computedOcrStatus = 'pending';
          else if (extractedCount < attachmentCount) computedOcrStatus = 'partial';
          else computedOcrStatus = 'completed';
        }

        return {
          ...email,
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
    
    filteredTotal = filteredEmails.length;
    
    // Apply pagination to the filtered results
    emails = filteredEmails.slice(skip, skip + take);
  } else {
    // No filters, use normal pagination
    filteredTotal = totalCount;
    emails = await prisma.email.findMany({
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
            extractedText: true,
            fileName: true,
            filePath: true,
            size: true
          }
        }
      }
    });
    
    // Apply the same mapping for consistency
    emails = emails.map((email) => {
      const attachmentCount = email.attachments?.length || 0;
      const extractedCount = email.attachments?.filter((a) => a.extractedText && a.extractedText.length > 0).length || 0;
      const pendingCount = attachmentCount - extractedCount;

      let computedOcrStatus = 'none';
      if (attachmentCount > 0) {
        if (extractedCount === 0) computedOcrStatus = 'pending';
        else if (extractedCount < attachmentCount) computedOcrStatus = 'partial';
        else computedOcrStatus = 'completed';
      }

      return {
        ...email,
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
    });
  }

  const total = filteredTotal;
  const currentPage = Math.floor(skip / take) + 1;
  const totalPages = Math.ceil(total / take);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  res.json({
    status: 'success',
    items: emails,
    pagination: {
      total,
      currentPage,
      totalPages,
      limit: take,
      offset: skip,
      hasNextPage,
      hasPrevPage
    }
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

    const filePath = attachment.filePath; // ใช้ path ที่เก็บไว้ในฐานข้อมูลโดยตรง
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        message: 'File not found on disk'
      });
    }

    res.download(filePath, attachment.fileName, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(500).json({
            status: 'error',
            message: 'Failed to download file'
          });
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

async function deleteAllEmails(req, res) {
  try {
    const accountId = req.user?.id || req.account?.id || req.body?.accountId || req.query?.accountId;
    
    // If no accountId provided, delete all emails (for backward compatibility)
    const whereClause = accountId ? { accountId: accountId } : {};
    
    const emails = await prisma.email.findMany({
      where: whereClause,
      include: {
        attachments: true
      }
    });

    if (!emails || emails.length === 0) {
      return res.json({
        status: 'success',
        message: 'No emails to delete',
        deletedCount: 0,
        deletedAttachments: 0
      });
    }

    let deletedAttachmentsCount = 0;
    const foldersToDelete = new Set();

    for (const email of emails) {
      if (email.attachments && email.attachments.length > 0) {
        for (const attachment of email.attachments) {
          try {
            if (attachment.filePath && fs.existsSync(attachment.filePath)) {
              await fsPromises.unlink(attachment.filePath);
              deletedAttachmentsCount++;
              
              const folderPath = path.dirname(attachment.filePath);
              if (folderPath && folderPath !== '.') {
                foldersToDelete.add(folderPath);
              }
            }
          } catch (fileErr) {
            // Silently ignore file deletion errors
          }
        }
      }
    }

    for (const folderPath of foldersToDelete) {
      try {
        const files = await fsPromises.readdir(folderPath);
        if (files.length === 0) {
          await fsPromises.rmdir(folderPath);
        }
      } catch (folderErr) {
        // Silently ignore folder deletion errors
      }
    }

    const attachmentsResult = await prisma.attachment.deleteMany({
      where: whereClause
    });

    const emailsResult = await prisma.email.deleteMany({
      where: whereClause
    });

    res.json({
      status: 'success',
      message: 'All emails deleted successfully',
      deletedCount: emailsResult.count,
      deletedAttachments: deletedAttachmentsCount
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete all emails',
      error: error.message
    });
  }
}

async function deleteEmail(req, res) {
  try {
    const { id } = req.params;

    const email = await prisma.email.findUnique({
      where: { id },
      include: {
        attachments: true
      }
    });

    if (!email) {
      return res.status(404).json({
        status: 'error',
        message: 'Email not found'
      });
    }

    if (email.attachments && email.attachments.length > 0) {
      const foldersToDelete = new Set();
      
      for (const attachment of email.attachments) {
        try {
          if (attachment.filePath && fs.existsSync(attachment.filePath)) {
            await fsPromises.unlink(attachment.filePath);
            
            const folderPath = path.dirname(attachment.filePath);
            if (folderPath && folderPath !== '.') {
              foldersToDelete.add(folderPath);
            }
          }
        } catch (fileError) {
          // Silently ignore file deletion errors
        }
      }
      
      for (const folderPath of foldersToDelete) {
        try {
          const files = await fsPromises.readdir(folderPath);
          if (files.length === 0) {
            await fsPromises.rmdir(folderPath);
          }
        } catch (folderError) {
          // Silently ignore folder deletion errors
        }
      }
    }

    if (email.attachments && email.attachments.length > 0) {
      await prisma.attachment.deleteMany({
        where: { emailId: id }
      });
    }

    await prisma.email.delete({
      where: { id }
    });

    res.json({
      status: 'success',
      message: 'Email deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete email: ' + error.message
    });
  }
}

module.exports = {
  listEmails,
  getEmailDetail,
  downloadAttachment,
  deleteEmail,
  deleteAllEmails
};
