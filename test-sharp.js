const sharp = require('sharp');
sharp('assets/svg/clawd-static-base.svg')
  .resize(1024, 1024)
  .png()
  .toFile('test-render.png')
  .then(() => console.log('Done'))
  .catch(console.error);
