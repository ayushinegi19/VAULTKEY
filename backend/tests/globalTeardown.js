const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const file = path.join(__dirname, '.tmp-tokens.json');
  if (fs.existsSync(file)) fs.unlinkSync(file);
};