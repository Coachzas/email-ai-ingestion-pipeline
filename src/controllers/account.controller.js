const prisma = require('../utils/prisma');

// Get all email accounts
async function getAccounts(req, res) {
  try {
    const accounts = await prisma.emailAccount.findMany({
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            emails: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
}

// Get single account by ID
async function getAccount(req, res) {
  try {
    const { id } = req.params;
    
    const account = await prisma.emailAccount.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            emails: true
          }
        }
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
}

// Create new email account
async function createAccount(req, res) {
  try {
    const { name, host, port, secure, username, password } = req.body;

    // Validation
    if (!name || !host || !port || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const account = await prisma.emailAccount.create({
      data: {
        name,
        host,
        port: parseInt(port),
        secure: secure !== false,
        username,
        password
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(201).json(account);
  } catch (error) {
    console.error('Error creating account:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Failed to create account: ' + error.message });
  }
}

// Update email account
async function updateAccount(req, res) {
  try {
    const { id } = req.params;
    const { name, host, port, secure, username, password, status } = req.body;

    // Check if account exists
    const existingAccount = await prisma.emailAccount.findUnique({
      where: { id }
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = parseInt(port);
    if (secure !== undefined) updateData.secure = secure;
    if (username !== undefined) updateData.username = username;
    if (password !== undefined) updateData.password = password;
    if (status !== undefined) updateData.status = status;

    const account = await prisma.emailAccount.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(account);
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
}

// Delete email account
async function deleteAccount(req, res) {
  try {
    const { id } = req.params;

    // Check if account exists
    const existingAccount = await prisma.emailAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            emails: true
          }
        }
      }
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Prevent deletion if account has emails
    if (existingAccount._count.emails > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete account with existing emails. Please delete emails first.' 
      });
    }

    await prisma.emailAccount.delete({
      where: { id }
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}

// Test email account connection
async function testConnection(req, res) {
  try {
    const { host, port, secure, username, password } = req.body;

    if (!host || !port || !username || !password) {
      return res.status(400).json({ error: 'All connection fields are required' });
    }

    const { ImapFlow } = require('imapflow');

    const client = new ImapFlow({
      host,
      port: parseInt(port),
      secure: secure !== false,
      auth: {
        user: username,
        pass: password,
      },
      timeout: 10000,
      connectionTimeout: 10000,
      authTimeout: 5000,
    });

    try {
      await client.connect();
      await client.mailboxOpen('INBOX');
      await client.logout();
      
      res.json({ success: true, message: 'Connection successful' });
    } catch (imapError) {
      console.error('IMAP connection error:', imapError);
      res.status(400).json({ 
        success: false, 
        error: 'Connection failed: ' + imapError.message 
      });
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
}

// Get currently selected account
async function getSelectedAccount(req, res) {
  try {
    const selectedAccount = await prisma.emailAccount.findFirst({
      where: { 
        status: 'ACTIVE',
        isSelected: true 
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            emails: true
          }
        }
      }
    });

    // If no selected account, return the first active account
    if (!selectedAccount) {
      const firstActive = await prisma.emailAccount.findFirst({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          host: true,
          port: true,
          secure: true,
          username: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              emails: true
            }
          }
        }
      });

      return res.json(firstActive);
    }

    res.json(selectedAccount);
  } catch (error) {
    console.error('Error fetching selected account:', error);
    res.status(500).json({ error: 'Failed to fetch selected account' });
  }
}

// Set selected account
async function setSelectedAccount(req, res) {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Check if account exists and is active
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Account is not active' });
    }

    // Reset all accounts to not selected
    await prisma.emailAccount.updateMany({
      where: { status: 'ACTIVE' },
      data: { isSelected: false }
    });

    // Set the selected account
    const updatedAccount = await prisma.emailAccount.update({
      where: { id: accountId },
      data: { isSelected: true },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(updatedAccount);
  } catch (error) {
    console.error('Error setting selected account:', error);
    res.status(500).json({ error: 'Failed to set selected account' });
  }
}

module.exports = {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  testConnection,
  getSelectedAccount,
  setSelectedAccount
};
