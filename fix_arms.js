const fs = require('fs');
const path = require('path');

const svgDir = path.join(__dirname, 'assets', 'svg');
const files = fs.readdirSync(svgDir).filter(f => f.endsWith('.svg'));

let updatedCount = 0;

for (const file of files) {
  const filePath = path.join(svgDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace 4px 15px with 5px 15px
  content = content.replace(/transform-origin:\s*4px\s+15px/g, 'transform-origin: 5px 15px');
  
  // Replace 20px 15px with 19px 15px
  content = content.replace(/transform-origin:\s*20px\s+15px/g, 'transform-origin: 19px 15px');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
    updatedCount++;
  }
}

console.log(`Done. Updated ${updatedCount} files.`);
