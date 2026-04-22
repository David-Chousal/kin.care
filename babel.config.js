const path = require('path');

module.exports = function (api) {
  api.cache(true);
  // Use the preset bundled with `expo` (SDK version). A hoisted `babel-preset-expo@55` with `expo@54`
  // breaks JSX dev transforms (duplicate __self).
  const expoPresetEntry = require.resolve('babel-preset-expo', {
    paths: [path.join(__dirname, 'node_modules', 'expo')],
  });
  const babelPresetExpo = require(expoPresetEntry);
  return {
    presets: [[babelPresetExpo]],
  };
};
