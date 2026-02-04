const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');

module.exports = async (filePath) => {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const parser = new XMLParser();

  let text = '';

  for (const entry of entries) {
    // ดึงเฉพาะ slide
    if (entry.entryName.startsWith('ppt/slides/slide')) {
      const xml = entry.getData().toString('utf8');
      const json = parser.parse(xml);

      // recursive walk ดึง text
      const extract = (obj) => {
        if (!obj) return;
        if (typeof obj === 'string') {
          text += obj + ' ';
        } else if (typeof obj === 'object') {
          for (const key in obj) {
            extract(obj[key]);
          }
        }
      };

      extract(json);
    }
  }

  return text.trim();
};
