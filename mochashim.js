const path = require('path');
const vscode = require('vscode');

const config = require('./config');
const fork = require('./fork');

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
  const { rootPath } = vscode.workspace;
  const mochaPath = path.relative(rootPath, path.resolve(rootPath, 'node_modules', '.bin', 'mocha'));
  const testFilesPath = (
    testFiles.length ?
      testFiles.map(testFile => path.relative(rootPath, testFile)) :
      config.files().glob
  );
  const terminalName = grep ? grep.slice(2, -1) : 'Mocha Tests';
  if (terminals[terminalName]) terminals[terminalName].dispose();
  terminals[terminalName] = vscode.window.createTerminal({ name: terminalName });
  terminals[terminalName].show(true);
  terminals[terminalName].sendText(`${mochaPath}${config.optionsFile().length ? ` --opts ${config.optionsFile()}` : ''} "${testFilesPath}" ${grep ? ` --grep "${grep}"` : ''}`);
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
