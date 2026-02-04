const XLSX = require('xlsx');

module.exports = async (filePath) => {
  const workbook = XLSX.readFile(filePath);
  let text = '';

  workbook.SheetNames.forEach((name) => {
    const sheet = workbook.Sheets[name];
    text += XLSX.utils.sheet_to_csv(sheet);
  });

  return text;
};
