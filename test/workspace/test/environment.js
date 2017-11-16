

const
  assert = require('assert');

describe('When environment variable is set in settings', () => {
  it('should run with them', () => {
    assert(process.env.HELLO_WORLD, 'Hello, World!');
  });
});

it('should inherit environment variables', () => {
  // Should cover Linux/Mac and Windows
  assert(process.env.HOME || process.env.PATHEXT);

  // Once I figure out how to pass env variables to the extension host process,
  // we can do this:
  // assert(process.env.INHERITED_ENV_VAR == 'inherited');
});
