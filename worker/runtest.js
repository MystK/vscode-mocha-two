

const
  CustomReporter = require('./customreporter'),
  escapeRegExp = require('escape-regexp'),
  fs = require('fs'),
  Mocha = require('mocha'),
  path = require('path'),
  Promise = require('bluebird');

const
  args = JSON.parse(process.argv[process.argv.length - 1]),
  options = args.options;

for (const file of args.requires) { require(file); }

if (Object.keys(options || {}).length) {
  console.log(`Applying Mocha options:\n${indent(JSON.stringify(options, null, 2))}`);
} else {
  console.log('No Mocha options are configured. You can set it under File > Preferences > Workspace Settings.');
}

// const requireOptions = options.require || [];

// if (requireOptions) {
//   if (typeof requireOptions === 'string') {
//     global[requireOptions] = require(requireOptions);
//   } else {
//     requireOptions.forEach(name => {
//       global[name] = require(name);
//     });
//   }
// }

const mocha = new Mocha(options);

args.files.forEach((file) => {
  mocha.addFile(file);
});

const grep = args.grep;

if (grep) {
  console.log();
  console.log('Grep pattern:');
  console.log(`  ${grep}`);

  mocha.grep(new RegExp(grep, 'i'));
}

// mocha.reporter(CustomReporter);

mocha.run();

function indent(lines) {
  return lines.split('\n').map(line => `  ${line}`).join('\n');
}

function initReporters() {
}
