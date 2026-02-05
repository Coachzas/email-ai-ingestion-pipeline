const fs = require('fs');
const path = require('path');

// Test extractors
const csvExtractor = require('./src/services/extractors/csv.extractor.js');
const docxExtractor = require('./src/services/extractors/docx.extractor.js');
const xlsxExtractor = require('./src/services/extractors/xlsx.extractor.js');
const pptxExtractor = require('./src/services/extractors/pptx.extractor.js');

async function testExtractors() {
  const testDir = 'storage/0dd049eb-e20c-4a26-9eaf-1cc542b5dec4';
  
  try {
    console.log('🧪 Testing CSV extractor...');
    const csvFile = path.join(testDir, 'mock_data.csv');
    const csvText = await csvExtractor(csvFile);
    console.log('CSV Result:', csvText.length, 'characters');
    console.log('CSV Content:', csvText.substring(0, 100));
    
    console.log('\n🧪 Testing DOCX extractor...');
    const docxFile = path.join(testDir, 'mock_word.docx');
    const docxText = await docxExtractor(docxFile);
    console.log('DOCX Result:', docxText.length, 'characters');
    console.log('DOCX Content:', docxText.substring(0, 100));
    
    console.log('\n🧪 Testing XLSX extractor...');
    const xlsxFile = path.join(testDir, 'mock_excel.xlsx');
    const xlsxText = await xlsxExtractor(xlsxFile);
    console.log('XLSX Result:', xlsxText.length, 'characters');
    console.log('XLSX Content:', xlsxText.substring(0, 100));
    
    console.log('\n🧪 Testing PPTX extractor...');
    const pptxFile = path.join(testDir, 'mock_office.pptx');
    const pptxText = await pptxExtractor(pptxFile);
    console.log('PPTX Result:', pptxText.length, 'characters');
    console.log('PPTX Content:', pptxText.substring(0, 100));
    
  } catch (err) {
    console.error('❌ Extractor test failed:', err.message);
  }
}

testExtractors();
