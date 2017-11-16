const { Glob } = require('glob');
const Mocha = require('mocha');
const path = require('path');
const Promise = require('bluebird');
const { trimArray } = require('../utils');

const args = JSON.parse(process.argv[process.argv.length - 1]);

for (const file of args.requires) require(file);

function createMocha(rootPath, options, glob, ignore) {
  return new Promise((resolve, reject) => {
    new Glob(glob, { cwd: rootPath, ignore }, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const mocha = new Mocha(options);

        files.forEach(file => mocha.addFile(path.resolve(rootPath, file)));
        mocha.loadFiles();
        resolve(mocha);
      } catch (ex) {
        reject(ex);
      }
    });
  });
}

function crawlTests(testSuite) {
  let suites = [{ suite: testSuite, path: [testSuite.fullTitle()] }];
  let tests = [];

  while (suites.length) {
    const entry = suites.shift();
    const { suite } = entry;

    tests = tests.concat((suite.tests || []).map((test) => {
      const name = test.title;

      return {
        name,
        fullName: trimArray(entry.path).concat([name]).join(' '),
        suitePath: entry.path,
        file: test.file,
      };
    }));

    suites = suites.concat((suite.suites || []).map(suiteLoop => ({
      suite: suiteLoop,
      path: entry.path.concat(suiteLoop.fullTitle()),
    })));
  }

  return tests;
}

createMocha(args.rootPath, args.options, args.files.glob, args.files.ignore)
  .then(mocha => crawlTests(mocha.suite))
  .then(tests => console.error(JSON.stringify(tests, null, 2)))
  .catch((err) => {
    console.error(err.stack);

    process.exit(-1);
  });
