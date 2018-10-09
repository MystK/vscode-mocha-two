const babylon = require('@babel/parser');

if (!RegExp.escape) { RegExp.escape = s => String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&'); }

function isValidTest(token) {
  const { expression } = token;

  return token.type === 'ExpressionStatement' && expression.type === 'CallExpression' // This is a function call
    && ['context', 'describe', 'it', 'specify'].includes(expression.callee.name) && expression.arguments.length > 1 // This is a valid mocha test context
    // It has two arguments, a string and function
    && expression.arguments.length === 2
    && ['TemplateLiteral', 'StringLiteral'].includes(expression.arguments[0].type)
    && ['FunctionExpression', 'ArrowFunctionExpression', 'CallExpression'].includes(expression.arguments[1].type);
}

function formatTestName(argument) {
  if (argument.type === 'StringLiteral') { return RegExp.escape(argument.value); } else if (argument.type !== 'TemplateLiteral') { return '(.+)'; }

  const tokens = [];

  for (const token of argument.expressions) {
    tokens.push({ start: token.start, value: '(.+)' });
  }

  for (const token of argument.quasis) {
    tokens.push({ start: token.start, value: RegExp.escape(token.value.raw) });
  }

  return tokens.sort((a, b) => a.start - b.start).map(t => t.value).join('');
}

function outSideCursor(position, cursor) {
  const { start, end } = position;

  const afterCursor = (
    start.line > cursor.row ||
    (start.line === cursor.row && start.column > cursor.column)
  );
  const beforeCursor = (
    end.line < cursor.row ||
    (
      end.line === cursor.row &&
      end.column < cursor.column
    )
  );
  return afterCursor || beforeCursor;
}

function detectTests(body, path, tests, cursor) {

  let bodyToParse = body;
  if (body.type === 'BlockStatement') { // For blocks, fetch the list of statements
    bodyToParse = body.body;
  }

  for (const token of bodyToParse) { // For all statements
    const { expression } = token;
    const position = token.loc;

    // The definition is outside cursor position, ignore it
    if (outSideCursor(position, cursor)) continue;

    // This is a valid mocha test context
    if (isValidTest(token)) {
      // Add the new definition to the path
      const newPath = Array.from(path).concat(formatTestName(token.expression.arguments[0]));
      tests.push({
        depth: newPath.length, label: `^(${newPath.join(' ')})`, start: position.start.line, end: position.end.line,
      }); // Add the test

      // Since this defines a new suite, visit the block
      if (['context', 'describe'].includes(expression.callee.name)) {
        detectTests(expression.arguments[1].body, newPath, tests, cursor);
      }
    } else if (token.body) { // This is a block statement, visit the block without changing the path
      detectTests(token.body, path, tests, cursor);
    }
  }
}

module.exports.getTests = function getTests(text, selection) {
  const cursor = { row: selection.line + 1, column: selection.character };
  const ast = babylon.parse(text, {
    sourceType: 'import',
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    plugins: [
      'typescript',
    ],
  });

  const tests = [];
  // Start a depth-first visit of the tree

  try {
    detectTests(ast.program.body, [], tests, cursor);
    return tests;
  } catch (e) {
    console.error(e);
    return [];
  }
};

module.exports.getTestAtCursor = function getTestAtCursor(text, selection) {
  // Now order tests by depth and then line - The cursor is
  const sortedTests = module.exports.getTests(text, selection).sort((a, b) => {
    // Sort by descending depth in order to correct recognize nested positions
    if (b.depth !== a.depth) {
      return b.depth - a.depth;
    }

    // Upon same depth, sort by start line
    return b.start - a.start;
  });

  return sortedTests[0];
};
