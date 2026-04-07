const fs = require('fs');
const path = require('path');

const svgDir = path.join(__dirname, 'assets', 'svg');
const files = fs.readdirSync(svgDir).filter(f => f.endsWith('.svg'));

const skipFiles = ['clawd-static-base.svg', 'clawd-static-green.svg', 'clawd-working-typing.svg', 'clawd-working-thinking.svg', 'clawd-sleeping.svg'];

const newLegs = `
  <g id="legs" fill="#111111">
    <rect x="7" y="21" width="2" height="2"/>
    <rect x="15" y="21" width="2" height="2"/>
  </g>`;

const newShadow = `<rect x="3" y="23" width="18" height="1" fill="#000000" opacity="0.3"/>`;

const newBodyParts = `
      <!-- Tail -->
      <rect x="19" y="18" width="2" height="2" fill="#111111"/>
      <rect x="21" y="15" width="2" height="4" fill="#111111"/>
      <rect x="22" y="12" width="2" height="4" fill="#111111"/>
      <rect x="23" y="9" width="2" height="4" fill="#111111"/>

      <!-- Ears -->
      <rect x="6" y="3" width="2" height="4" fill="#111111"/>
      <rect x="7" y="2" width="1" height="1" fill="#111111"/>
      <rect x="16" y="3" width="2" height="4" fill="#111111"/>
      <rect x="16" y="2" width="1" height="1" fill="#111111"/>
      
      <!-- Head and Torso -->
      <rect x="6" y="6" width="12" height="1" fill="#111111"/>
      <rect x="5" y="7" width="14" height="14" fill="#111111"/>
      <rect x="6" y="21" width="12" height="1" fill="#111111"/>
`;

const newEyes = `
          <!-- Left Eye -->
          <rect x="6" y="10" width="5" height="3" fill="#FFFFFF"/>
          <rect x="7" y="13" width="3" height="1" fill="#FFFFFF"/>
          <rect x="8" y="10" width="2" height="2" fill="#111111"/>
          <!-- Right Eye -->
          <rect x="13" y="10" width="5" height="3" fill="#FFFFFF"/>
          <rect x="14" y="13" width="3" height="1" fill="#FFFFFF"/>
          <rect x="14" y="10" width="2" height="2" fill="#111111"/>
`;

for (const file of files) {
  if (skipFiles.includes(file)) continue;
  
  let content = fs.readFileSync(path.join(svgDir, file), 'utf8');
  
  // Transform origins
  content = content.replace(/transform-origin:\s*7\.5px\s*13px/g, 'transform-origin: 12px 20px');
  content = content.replace(/transform-origin:\s*7\.5px\s*15px/g, 'transform-origin: 12px 23px');
  content = content.replace(/transform-origin:\s*7\.5px\s*15\.5px/g, 'transform-origin: 12px 23.5px');
  content = content.replace(/transform-origin:\s*7\.5px\s*9px/g, 'transform-origin: 12px 11px');
  content = content.replace(/transform-origin:\s*7\.5px\s*8px/g, 'transform-origin: 12px 11px');
  
  // Replace shadow
  content = content.replace(/<rect[^>]*id="ground-shadow"[^>]*\/>/, `<g id="ground-shadow">${newShadow}</g>`);
  content = content.replace(/<rect[^>]*class="shadow-anim"[^>]*\/>/, `<g class="shadow-anim">${newShadow}</g>`);
  content = content.replace(/<rect[^>]*class="shadow-think"[^>]*\/>/, `<g class="shadow-think">${newShadow}</g>`);
  content = content.replace(/<g id="shadow-js">[\s\S]*?<\/g>/, `<g id="shadow-js">\n    ${newShadow}\n  </g>`);
  
  // Replace legs
  content = content.replace(/<g id="legs"[^>]*>[\s\S]*?<\/g>/, newLegs);
  
  // Replace torso and add tail/ears
  content = content.replace(/<rect id="torso"[^>]*\/>/, newBodyParts);
  
  // Replace eyes
  content = content.replace(/<rect x="4" y="8" width="1" height="2"\/>\s*<rect x="10" y="8" width="1" height="2"\/>/g, newEyes);
  content = content.replace(/<rect x="5" y="7" width="1" height="2"\/>\s*<rect x="11" y="7" width="1" height="2"\/>/g, newEyes);
  
  // Adjust arms (simple heuristic: left arm x=0->3, y=9->14; right arm x=13->19, y=9->14)
  content = content.replace(/<rect x="0" y="9" width="2" height="2" fill="#DE886D"\/>/g, '<rect x="3" y="14" width="2" height="2" fill="#111111"/>');
  content = content.replace(/<rect x="13" y="9" width="2" height="2" fill="#DE886D"\/>/g, '<rect x="19" y="14" width="2" height="2" fill="#111111"/>');
  
  content = content.replace(/<rect x="0" y="9" width="2" height="2"\/>/g, '<rect x="3" y="14" width="2" height="2" fill="#111111"/>');
  content = content.replace(/<rect x="13" y="9" width="2" height="2"\/>/g, '<rect x="19" y="14" width="2" height="2" fill="#111111"/>');
  
  content = content.replace(/<rect x="0" y="9" width="3" height="2"\/>/g, '<rect x="3" y="14" width="2" height="2" fill="#111111"/>');
  
  // Change any remaining old skin color to black
  content = content.replace(/#DE886D/g, '#111111');
  
  fs.writeFileSync(path.join(svgDir, file), content, 'utf8');
}

console.log("Migration complete.");
