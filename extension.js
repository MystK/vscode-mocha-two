const parser = require('./parser');
const path = require('path');
const Promise = require('bluebird');
const Runner = require('./runner');
const vscode = require('vscode');

const runner = new Runner();

function runAllTests() {
  runner.loadTestFiles()
    .then((files) => {
      if (!files.length) {
        vscode.window.showWarningMessage('No tests were found.');
        return;
      }

      runner.runAll();
    }).catch(err => vscode.window.showErrorMessage(`Failed to run tests due to ${err.message}`));
}

function hasWorkspace() {
  const root = vscode.workspace.rootPath;
  const validWorkspace = typeof root === 'string' && root.length;

  if (!validWorkspace) {
    vscode.window.showErrorMessage('Please open a folder before trying to execute Mocha.');
  }

  return validWorkspace;
}

async function runTestAtCursor() {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return vscode.window.showErrorMessage('No active editors were found.');
  } else if (editor.document.languageId !== 'javascript' && editor.document.languageId !== 'typescript') {
    return vscode.window.showErrorMessage('Mocha is only available for JavaScript files.');
  }

  let detectError = 'No test(s) were detected at the current cursor position.';
  let test;

  try {
    test = parser.getTestAtCursor(editor.document.getText(), editor.selection.active);
  } catch (e) {
    console.error(e);
    detectError = `Parsing failed while detecting test(s) at the current cursor position: ${e.message}`;
  }

  try {
    await runner.loadTestFiles();

    // Only run test from the current file
    const currentFile = editor.document.fileName;
    runner.tests = runner.tests.filter(t => t.file === currentFile);

    if (test) return runner.runWithGrep(test.label, editor.document.fileName);

    vscode.window.showErrorMessage(`WARNING: ${detectError} Running all tests in the current file.`);
    return runner.runAll();
  } catch (err) {
    return vscode.window.showErrorMessage(`Failed to run test(s) at the cursor position due to ${err.message}`);
  }
}

function selectAndRunTest() {
  const { rootPath } = vscode.workspace;

  vscode.window.showQuickPick(runner.loadTestFiles()
    .then(
      (tests) => {
        if (!tests.length) {
          vscode.window.showWarningMessage('No tests were found.');
          throw new Error('no tests found');
        }

        return tests.map(test => ({
          detail: path.relative(rootPath, test.file),
          label: test.fullName,
          test,
        }));
      },
      (err) => {
        vscode.window.showErrorMessage(`Failed to find tests due to ${err.message}`);
        throw err;
      },
    ))
    .then((entry) => {
      if (!entry) { return; }

      runner
        .runTest(entry.test)
        .catch((err) => {
          vscode.window.showErrorMessage(`Failed to run selected tests due to ${err.message}`);
        });
    });
}

function runFailedTests() {
  runner.runFailed()
    .catch(err => vscode.window.showErrorMessage(`Failed to rerun failed tests due to ${err.message}`));
}

function runTestsByPattern() {
  return Promise.props({
    pattern: vscode.window.showInputBox({
      placeHolder: 'Regular expression',
      prompt: 'Pattern of tests to run',
      value: '',
    }),
    loadTests: runner.loadTestFiles(),
  }).then((props) => {
    const { pattern } = props;

    if (!pattern) return;

    runner.runWithGrep(pattern);
  }, err => vscode.window.showErrorMessage(`Failed to run tests by pattern due to ${err.message}`));
}

function runLastSetAgain() {
  runner.runLastSet();
}

exports.activate = (context) => {
  const { subscriptions } = context;

  subscriptions.push(vscode.commands.registerCommand('mocha.runAllTests', () => {
    if (hasWorkspace()) {
      runAllTests();
    }
  }));

  subscriptions.push(vscode.commands.registerCommand('mocha.runTestAtCursor', () => {
    if (hasWorkspace()) {
      runTestAtCursor();
    }
  }));

  subscriptions.push(vscode.commands.registerCommand('mocha.selectAndRunTest', () => {
    if (hasWorkspace()) {
      selectAndRunTest();
    }
  }));

  subscriptions.push(vscode.commands.registerCommand('mocha.runFailedTests', () => {
    if (hasWorkspace()) {
      runFailedTests();
    }
  }));

  subscriptions.push(vscode.commands.registerCommand('mocha.runTestsByPattern', () => {
    if (hasWorkspace()) {
      runTestsByPattern();
    }
  }));

  subscriptions.push(vscode.commands.registerCommand('mocha.runLastSetAgain', () => {
    if (hasWorkspace()) {
      runLastSetAgain();
    }
  }));
};
