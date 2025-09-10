const fs = require('fs');
const path = require('path');
const os = require('os');

// Find the config file path
const configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'displayops-controller-electron', 'config.json');

console.log('Looking for config at:', configPath);

if (fs.existsSync(configPath)) {
    console.log('Found existing config, deleting it...');
    fs.unlinkSync(configPath);
    console.log('Config deleted. Next run will show setup dialog.');
} else {
    console.log('No config file found. Setup dialog will show on next run.');
}