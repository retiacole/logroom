'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.LOGROOM_PLAYWRIGHT_MODULE || 'playwright');
const launchOptions = {headless: true};
if (process.env.LOGROOM_BROWSER_EXECUTABLE) {
  launchOptions.executablePath = process.env.LOGROOM_BROWSER_EXECUTABLE;
} else if (process.env.LOGROOM_BROWSER_CHANNEL) {
  launchOptions.channel = process.env.LOGROOM_BROWSER_CHANNEL;
}
const artifacts = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(artifacts, {recursive: true});

module.exports = {chromium, launchOptions, artifacts};
