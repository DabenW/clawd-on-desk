const fs = require('fs');
const path = require('path');

const svgDir = path.join(__dirname, 'assets', 'svg');
const files = fs.readdirSync(svgDir).filter(f => f.endsWith('.svg'));

for (const file of files) {
  const filePath = path.join(svgDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the viewBox with the new one that shifts the camera down by 10 pixels
  // Original was mostly "-15 -25 45 45", some were "-5 -5 34 34".
  // We unify all of them to "-15 -15 45 45" so the ground (y=23) is visible!
  content = content.replace(/viewBox="[^"]+"/, 'viewBox="-15 -15 45 45"');
  
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log("Fixed viewBox for all SVGs!");
