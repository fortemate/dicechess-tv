// The application's test coverage, one LCOV report per test file.
//
//   node --experimental-strip-types scripts/coverage-native.ts
//
// Each test file in native/test/ runs in a process of its own, as
// `npm test --prefix native` runs it, and writes its own report to
// coverage/native/. SonarQube adds the reports up line by line, and
// sonar-project.properties lists every one (test/sonar.test.ts holds the list
// to the files). Node can merge the processes into one report itself, but its
// merge marks lines that no test ran as covered.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { availableParallelism } from 'node:os';

const TESTS = 'native/test';
const REPORTS = 'coverage/native';

// The application's test files, as `npm test --prefix native` finds them.
export const testFiles = (): string[] =>
  readdirSync(TESTS)
    .filter((name) => /\.test\.tsx?$/.test(name))
    .sort();

// Where a test file's report goes, relative to the repository root.
export const reportPath = (file: string): string =>
  `${REPORTS}/${file.replace(/\.test\.tsx?$/, '')}.lcov`;

type Run = { file: string; passed: boolean; output: string };

const cover = (file: string): Promise<Run> =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        '--test',
        '--import',
        `./${TESTS}/hooks.mjs`,
        '--enable-source-maps',
        '--experimental-test-coverage',
        `--test-coverage-exclude=${TESTS}/**`,
        '--test-coverage-exclude=native/src/pieces/**',
        '--test-coverage-exclude=native/src/cueFiles.ts',
        '--test-reporter=dot',
        '--test-reporter-destination=stdout',
        '--test-reporter=lcov',
        `--test-reporter-destination=${reportPath(file)}`,
        `${TESTS}/${file}`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => resolve({ file, passed: code === 0, output }));
  });

const main = async () => {
  rmSync(REPORTS, { recursive: true, force: true });
  mkdirSync(REPORTS, { recursive: true });
  const waiting = testFiles();
  const failed: string[] = [];
  // As many at a time as `node --test` runs.
  const worker = async () => {
    for (let file = waiting.shift(); file; file = waiting.shift()) {
      const run = await cover(file);
      // Each file's output whole, as it finishes, never interleaved.
      process.stdout.write(`\n# ${run.file}\n${run.output}`);
      if (!run.passed) failed.push(run.file);
    }
  };
  const workers = Math.max(availableParallelism() - 1, 1);
  await Promise.all(Array.from({ length: workers }, worker));
  if (failed.length) {
    console.error(`\nfailed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
};

if (import.meta.main) await main();
