const Mocha = require('mocha');

const { reporters, utils } = Mocha;
const { Base, Spec } = reporters;
const { trimArray } = require('../utils');

function toJS(suitePath, test) {
  const name = test.title;

  return {
    name,
    fullName: trimArray(suitePath).concat([name]).join(' '),
    suitePath: suitePath.slice(),
    file: test.file,
  };
}

function Reporter(runner) {
  this._spec = new Spec(runner);

  const suitePath = [];
  const failed = [];
  const passed = [];

  runner
    .on('suite', (suite) => {
      suitePath.push(suite.fullTitle());
    })
    .on('suite end', () => {
      suitePath.pop();
    })
    .on('pass', (test) => {
      passed.push(toJS(suitePath, test));
    })
    .on('fail', (test) => {
      failed.push(toJS(suitePath, test));
    })
    .on('end', () => {
      console.error(JSON.stringify({ passed, failed }, null, 2));
    });
}

utils.inherits(Reporter, Base);

module.exports = Reporter;
