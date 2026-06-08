const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Owner\\.gemini\\antigravity\\brain\\e49c1c33-aed6-44e3-8e89-0a023da76bf0\\.system_generated\\logs\\transcript.jsonl';
const outputPath = path.join(__dirname, 'prd.txt');

try {
  const line = fs.readFileSync(logPath, 'utf8').split('\n')[0];
  const obj = JSON.parse(line);
  fs.writeFileSync(outputPath, obj.content, 'utf8');
  console.log('PRD extracted successfully to ' + outputPath);
} catch (e) {
  console.error('Error:', e);
}
