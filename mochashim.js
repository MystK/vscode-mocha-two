const config = require('./config');
const fork = require('./fork');
const path = require('path');
const Promise = require('bluebird');
const vscode = require('vscode');

function envWithNodePath(rootPath) {
  return Object.assign({}, process.env, {
    NODE_PATH: `${rootPath}${path.sep}node_modules`,
  }, config.env());
}

function applySubdirectory(rootPath) {
  const subdirectory = config.subdirectory();

  let newRootPath;
  if (subdirectory) {
    newRootPath = path.resolve(rootPath, subdirectory);
  }

  return newRootPath || rootPath;
}

function stripWarnings(text) { // Remove node.js warnings, which would make JSON parsing fail
  return text.replace(/\(node:\d+\) DeprecationWarning:\s[^\n]+/g, '');
}

const terminals = {};
function runTests(testFiles, grep) {
  const parsedGrep = grep.slice(2, -1);
  if (terminals[parsedGrep]) terminals[parsedGrep].dispose();
  terminals[parsedGrep] = vscode.window.createTerminal({ name: parsedGrep });
  terminals[parsedGrep].show(true);
  terminals[parsedGrep].sendText(`${path.relative(path.resolve(), path.resolve('node_modules', '.bin', 'mocha'))} ${config.optionsFile().length ? `--opts ${config.optionsFile()}` : ''} ${config.files().glob} --grep "${grep}"`);
}

function findTests(rootPath) {
  // Allow the user to choose a different subfolder
  const parsedRootPath = applySubdirectory(rootPath);

  return fork(
    path.resolve(module.filename, '../worker/findtests.js'),
    [
      JSON.stringify({
        options: config.options(),
        files: {
          glob: config.files().glob,
          ignore: config.files().ignore,
        },
        requires: config.requires(),
        rootPath: parsedRootPath,
      }),
    ],
    {
      env: envWithNodePath(parsedRootPath),
    },
  ).then(process => new Promise((resolve, reject) => {
    const stdoutBuffers = [];
    const resultJSONBuffers = [];

    process.stderr.on('data', (data) => {
      resultJSONBuffers.push(data);
    });

    process.stdout.on('data', (data) => {
      stdoutBuffers.push(data);
    });

    process
      .on('error', (err) => {
        vscode.window.showErrorMessage(`Failed to run Mocha due to ${err.message}`);
        reject(err);
      })
      .on('exit', (code) => {
        console.log(Buffer.concat(stdoutBuffers).toString());

        const stderrText = Buffer.concat(resultJSONBuffers).toString();
        let resultJSON;

        let caughtCode;
        try {
          resultJSON = stderrText && JSON.parse(stripWarnings(stderrText));
        } catch (ex) {
          caughtCode = 1;
        }

        if (code || caughtCode) {
          const outputChannel = vscode.window.createOutputChannel('Mocha');

          outputChannel.show();
          outputChannel.append(stderrText);
          console.error(stderrText);

          reject(new Error('unknown error'));
        } else {
          resolve(resultJSON);
        }
      });
  }));
}

module.exports.runTests = runTests;
module.exports.findTests = findTests;
