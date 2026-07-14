const fs = require('fs');
const path = require('path');

function loadTokens() {
  const file = path.join(__dirname, '..', '.tmp-tokens.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { loadTokens };