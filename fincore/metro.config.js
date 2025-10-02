const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// 👇 Add .csv as a valid asset type
config.resolver.assetExts.push("csv");

module.exports = config;
