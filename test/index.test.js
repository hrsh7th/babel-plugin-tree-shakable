const runner = require('babel-plugin-tester');
const plugin = require('../src');

runner({
  plugin: plugin,
  pluginName: 'babel-plugin-transform-cjs2esm-safety',
  pluginOptions: {
    ignoreFilenameMatchs: [/events/]
  },
  fixtures: __dirname + '/fixtures',
  snapshot: false
});

