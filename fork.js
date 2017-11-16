const ChildProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const { trimArray } = require('./utils');
const vscode = require('vscode');
const config = require('./config');

const access = Promise.promisify(fs.access);

function nodeJSPath() {
  return new Promise((resolve, reject) => {
    const paths = process.env.PATH.split(path.delimiter);

    const pathExts = process.platform === 'win32' ? process.env.PATHEXT.split(path.delimiter) : [''];
    const searchPaths = paths.reduce((a, p) => (
      a.concat(pathExts.map(ext => path.resolve(p, `node${ext}`)))
    ), []);

    Promise.all(searchPaths.map(p => access(p, fs.X_OK).then(() => p, () => false)))
      .then(
        (results) => {
          const trimmedResults = trimArray(results);

          if (trimmedResults.length) {
            resolve(trimmedResults[0]);
          } else {
            const err = new Error('cannot find nodejs');

            err.code = 'ENOENT';

            reject(err);
          }
        },
        err => reject(err),
      );
  });
}

function fork(jsPath, args, options) {
  // Make sure mocha is executed in the right folder
  const parsedOptions = Object.assign({ cwd: path.dirname(options.env.NODE_PATH) }, options);

  return nodeJSPath().then(
    execPath => new Promise((resolve) => {
      resolve(ChildProcess.spawn(
        execPath,
        config.node_options().concat([jsPath]).concat(args),
        parsedOptions,
      ));
    }),
    (err) => {
      if (err.code === 'ENOENT') {
        vscode.window.showErrorMessage('Cannot find Node.js installation from environment variable');
      } else {
        vscode.window.showErrorMessage(`Failed to find Node.js installation due to ${err.message}`);
      }

      throw err;
    },
  );
}

module.exports = fork;
module.exports.nodeJSPath = nodeJSPath;
