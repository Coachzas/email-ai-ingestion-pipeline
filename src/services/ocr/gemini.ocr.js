const fs = require('fs');
const fetch = require('node-fetch');

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function geminiOCR(filePath, mimeType) {
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

    const body = {
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text:
                            'Extract all readable text from this document. ' +
                            'Return only the raw text content. ' +
                            'If no text is visible, return an empty string.',
                    },
                    {
                        inlineData: {
                            mimeType,
                            data: base64Data,
                        },
                    },
                ],
            },
        ],
    };

    const res = await fetch(
        `${GEMINI_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    );

    const json = await res.json();

    if (!json.candidates?.length) {
        console.error('Gemini raw response:', JSON.stringify(json, null, 2));
        throw new Error('Gemini OCR ไม่สามารถแสดงผลลัพธ์ผู้สมัครได้');
    }
    return json.candidates[0].content.parts[0].text;
}

module.exports = { geminiOCR };
