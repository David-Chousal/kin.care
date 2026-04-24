const { withDangerousMod } = require('expo/config-plugins');

/**
 * Default SENTRY_DISABLE_AUTO_UPLOAD to true for local Xcode builds so
 * sentry-cli does not require org/auth. EAS preview/production set
 * SENTRY_DISABLE_AUTO_UPLOAD=false in eas.json, which overrides this default.
 */
function withSentryDisableUploadDefault(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(cfg.modRequest.platformProjectRoot, '.xcode.env');
      if (!fs.existsSync(envPath)) {
        return cfg;
      }
      const marker = '# kin.care: Sentry auto-upload default';
      let body = fs.readFileSync(envPath, 'utf8');
      if (body.includes(marker)) {
        return cfg;
      }
      body += `\n${marker}\nexport SENTRY_DISABLE_AUTO_UPLOAD=\${SENTRY_DISABLE_AUTO_UPLOAD:-true}\n`;
      fs.writeFileSync(envPath, body);
      return cfg;
    },
  ]);
}

module.exports = withSentryDisableUploadDefault;
