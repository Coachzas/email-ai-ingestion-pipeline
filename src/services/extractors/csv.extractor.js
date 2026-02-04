const fs = require('fs');

module.exports = async (filePath) => fs.readFileSync(filePath, 'utf8');
