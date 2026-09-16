const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const i18nRoot = path.resolve(__dirname, "../../packages/core/src/i18n");
config.watchFolders = [...(config.watchFolders ?? []), i18nRoot];
config.resolver.extraNodeModules = {
	...(config.resolver.extraNodeModules ?? {}),
	"gpio-companion-i18n": i18nRoot,
};

module.exports = config;
