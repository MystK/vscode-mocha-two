

const escapeRegExp = require('escape-regexp');
const MochaShim = require('./mochashim');
const vscode = require('vscode');


function dedupeStrings(array) {
  const keys = {};

  array.forEach((key) => { keys[key] = 0; });

  return Object.keys(keys);
}

function Runner() {
  this.tests = [];
  this.lastRunResult = null;
}

Runner.prototype.loadTestFiles = function () {
  return MochaShim.findTests(vscode.workspace.rootPath)
    .then((tests) => {
      this.tests = tests;
      return tests;
    });
};

Runner.prototype._runMocha = function (testFiles, grep) {
  this.lastRunParameters = [testFiles, grep];
  return MochaShim.runTests(dedupeStrings(testFiles), grep);
};

Runner.prototype.runAll = function () {
  return this._runMocha(this.tests.map(test => test.file));
};

Runner.prototype.runWithGrep = function (grep, file) {
  return this._runMocha(file ? [file] : this.tests.map(test => test.file), grep);
};

Runner.prototype.runTest = function (test) {
  return this._runMocha([test.file], `^${escapeRegExp(test.fullName)}$`);
};

Runner.prototype.runFailed = function () {
  const failed = (this.lastRunResult || {}).failed || [];

  if (!failed.length) {
    vscode.window.showWarningMessage('No tests failed in last run.');

    return new Promise(resolve => resolve());
  }
  return this._runMocha(
    dedupeStrings(failed.map(test => test.file)),
    `^${failed.map(test => `(${escapeRegExp(test.fullName)})`).join('|')}$`,
  );
};

Runner.prototype.runLastSet = function () {
  if (!this.lastRunParameters) {
    return vscode.window.showWarningMessage('No last set to run');
  }
  return this._runMocha(
    this.lastRunParameters[0],
    this.lastRunParameters[1],
    this.lastRunParameters[2],
  );
};

module.exports = Runner;
