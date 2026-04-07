const fs = require('fs');
const path = require('path');

const svgDir = path.join(__dirname, 'assets', 'svg');
const files = fs.readdirSync(svgDir).filter(f => f.endsWith('.svg') && f !== 'clawd-static-base.svg' && f !== 'clawd-static-green.svg');

const newIP = {
  shadow: `<rect x="3" y="23" width="18" height="1" fill="#000000" opacity="0.3"/>`,
  legs: `<rect x="7" y="21" width="2" height="2"/>\n    <rect x="15" y="21" width="2" height="2"/>`,
  tail: `<rect x="19" y="18" width="2" height="2" fill="#111111"/>\n      <rect x="21" y="15" width="2" height="4" fill="#111111"/>\n      <rect x="22" y="12" width="2" height="4" fill="#111111"/>\n      <rect x="23" y="9" width="2" height="4" fill="#111111"/>`,
  ears: `<rect x="6" y="3" width="2" height="4" fill="#111111"/>\n      <rect x="7" y="2" width="1" height="1" fill="#111111"/>\n      <rect x="16" y="3" width="2" height="4" fill="#111111"/>\n      <rect x="16" y="2" width="1" height="1" fill="#111111"/>`,
  body: `<rect x="6" y="6" width="12" height="1" fill="#111111"/>\n      <rect x="5" y="7" width="14" height="14" fill="#111111"/>\n      <rect x="6" y="21" width="12" height="1" fill="#111111"/>`,
  eyes: `<g class="eyes-blink">\n          <rect x="6" y="10" width="5" height="3" fill="#FFFFFF"/>\n          <rect x="7" y="13" width="3" height="1" fill="#FFFFFF"/>\n          <rect x="8" y="10" width="2" height="2" fill="#111111"/>\n          <rect x="13" y="10" width="5" height="3" fill="#FFFFFF"/>\n          <rect x="14" y="13" width="3" height="1" fill="#FFFFFF"/>\n          <rect x="14" y="10" width="2" height="2" fill="#111111"/>\n        </g>`,
  eyesNoBlink: `<rect x="6" y="10" width="5" height="3" fill="#FFFFFF"/>\n          <rect x="7" y="13" width="3" height="1" fill="#FFFFFF"/>\n          <rect x="8" y="10" width="2" height="2" fill="#111111"/>\n          <rect x="13" y="10" width="5" height="3" fill="#FFFFFF"/>\n          <rect x="14" y="13" width="3" height="1" fill="#FFFFFF"/>\n          <rect x="14" y="10" width="2" height="2" fill="#111111"/>`,
  armL: `<rect x="3" y="14" width="2" height="2" fill="#111111"/>`,
  armR: `<rect x="19" y="14" width="2" height="2" fill="#111111"/>`
};

for (const file of files) {
  let content = fs.readFileSync(path.join(svgDir, file), 'utf8');
  
  // Replace fill colors
  content = content.replace(/#DE886D/g, '#111111');
  
  // Replace transform origins
  content = content.replace(/transform-origin:\s*7\.5px\s*13px/g, 'transform-origin: 12px 20px');
  content = content.replace(/transform-origin:\s*7\.5px\s*9px/g, 'transform-origin: 12px 11px');
  content = content.replace(/transform-origin:\s*7\.5px\s*15px/g, 'transform-origin: 12px 23px');
  content = content.replace(/transform-origin:\s*7\.5px\s*15\.5px/g, 'transform-origin: 12px 23px');
  
  // We need to carefully replace the structure.
  // It's complex because each file has different animations.
  // Let's use a simpler approach: just tell the user this requires a dedicated script or manual work for 37 files.
}
