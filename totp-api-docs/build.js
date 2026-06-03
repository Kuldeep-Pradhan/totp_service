const fs = require('fs');
const path = require('path');

const DOCS_DIR = __dirname;
const PROJECT_DIR = path.dirname(DOCS_DIR);

const stdMdPath = path.join(DOCS_DIR, 'totp-api-documentation.md');
const notionMdPath = path.join(DOCS_DIR, 'totp-api-documentation-notion.md');
const postmanPath = path.join(PROJECT_DIR, 'OTP_Service.postman_collection.json');
const htmlPath = path.join(DOCS_DIR, 'index.html');

function fileToBase64(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

console.log('Encoding files to Base64...');
const stdMdB64 = fileToBase64(stdMdPath);
const notionMdB64 = fileToBase64(notionMdPath);
const postmanJsonB64 = fileToBase64(postmanPath);

console.log('Reading index.html...');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Replace the placeholder strings
console.log('Injecting Base64 payloads into index.html...');
htmlContent = htmlContent.replace(/const stdMdB64 = "[^"]*";/, `const stdMdB64 = "${stdMdB64}";`);
htmlContent = htmlContent.replace(/const notionMdB64 = "[^"]*";/, `const notionMdB64 = "${notionMdB64}";`);
htmlContent = htmlContent.replace(/const postmanJsonB64 = "[^"]*";/, `const postmanJsonB64 = "${postmanJsonB64}";`);

fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log('Successfully bundled index.html!');
