const prisma = require('../utils/prisma');

const accountSelect = {
  id: true, name: true, host: true, port: true, secure: true,
  username: true, status: true, createdAt: true, updatedAt: true
};

const accountSelectWithCount = {
  ...accountSelect,
  _count: { select: { emails: true } }
};

async function getAccounts(req, res) {
  try {
    const accounts = await prisma.emailAccount.findMany({
      select: accountSelectWithCount,
      orderBy: { createdAt: 'desc' }
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
}

async function getAccount(req, res) {
  try {
    const account = await prisma.emailAccount.findUnique({
      where: { id: req.params.id },
      select: accountSelectWithCount
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
}

async function createAccount(req, res) {
  try {
    const { name, host, port, secure, username, password } = req.body;
    if (!name || !host || !port || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const account = await prisma.emailAccount.create({
      data: { name, host, port: parseInt(port), secure: secure !== false, username, password },
      select: accountSelect
    });
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create account' });
  }
}

async function updateAccount(req, res) {
  try {
    const { id } = req.params;
    const { name, host, port, secure, username, password, status } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = parseInt(port);
    if (secure !== undefined) updateData.secure = secure;
    if (username !== undefined) updateData.username = username;
    if (password !== undefined && password !== '') updateData.password = password;
    if (status !== undefined) updateData.status = status;

    const account = await prisma.emailAccount.update({
      where: { id },
      data: updateData,
      select: accountSelect
    });
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update account' });
  }
}

async function deleteAccount(req, res) {
  try {
    const { id } = req.params;
    const existingAccount = await prisma.emailAccount.findUnique({
      where: { id },
      include: { _count: { select: { emails: true } } }
    });
    
    if (!existingAccount) return res.status(404).json({ error: 'Account not found' });
    if (existingAccount._count.emails > 0) {
      return res.status(400).json({ error: 'Cannot delete account with existing emails. Please delete emails first.' });
    }
    
    await prisma.emailAccount.delete({ where: { id } });
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
}

async function testConnection(req, res) {
  try {
    const { host, port, secure, username, password } = req.body;
    if (!host || !port || !username || !password) {
      return res.status(400).json({ error: 'All connection fields are required' });
    }

    const { ImapFlow } = require('imapflow');
    const client = new ImapFlow({
      host, port: parseInt(port), secure: secure !== false,
      auth: { user: username, pass: password },
      timeout: 10000, connectionTimeout: 10000, authTimeout: 5000
    });

    try {
      await client.connect();
      await client.mailboxOpen('INBOX');
      await client.logout();
      res.json({ success: true, message: 'Connection successful' });
    } catch (imapError) {
      res.status(400).json({ success: false, error: 'Connection failed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to test connection' });
  }
}

async function getSelectedAccount(req, res) {
  try {
    let account = await prisma.emailAccount.findFirst({
      where: { status: 'ACTIVE', isSelected: true },
      select: accountSelectWithCount
    });
    
    if (!account) {
      account = await prisma.emailAccount.findFirst({
        where: { status: 'ACTIVE' },
        select: accountSelectWithCount
      });
    }
    
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch selected account' });
  }
}

async function setSelectedAccount(req, res) {
  try {
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ error: 'Account ID is required' });

    const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (account.status !== 'ACTIVE') return res.status(400).json({ error: 'Account is not active' });

    await prisma.emailAccount.updateMany({
      where: { status: 'ACTIVE' },
      data: { isSelected: false }
    });

    const updatedAccount = await prisma.emailAccount.update({
      where: { id: accountId },
      data: { isSelected: true },
      select: accountSelect
    });
    res.json(updatedAccount);
  } catch (error) {
    res.status(500).json({ error: 'Failed to set selected account' });
  }
}

module.exports = {
  getAccounts, getAccount, createAccount, updateAccount,
  deleteAccount, testConnection, getSelectedAccount, setSelectedAccount
};
