// SonarQube reads the coverage reports sonar-project.properties names, and no
// others: a test file of the application missing from the list would leave
// the code only it covers counted as never run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reportPath, testFiles } from '../scripts/coverage-native.ts';

// A property's value as the scanner reads it: a line that ends in a backslash
// goes on in the next, without that line's leading blanks.
const property = (name: string): string => {
  const source = readFileSync('sonar-project.properties', 'utf8').replace(
    /\\\n[ \t]*/g,
    '',
  );
  const line = source.split('\n').find((each) => each.startsWith(`${name}=`));
  assert.ok(line, `${name} is not set`);
  return line.slice(name.length + 1);
};

test('SonarQube reads the core’s coverage and one report per application test file', () => {
  assert.deepEqual(property('sonar.javascript.lcov.reportPaths').split(','), [
    'coverage/core.lcov',
    ...testFiles().map(reportPath),
  ]);
});
