const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'default.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

module.exports = config;
