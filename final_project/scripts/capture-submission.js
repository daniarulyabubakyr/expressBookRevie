// Runs the actual curl executable against a freshly started application.
// Start with npm start in another terminal, then run npm run evidence.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { mkdir, writeFile, rm } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const exec = promisify(execFile);
const project = path.resolve(__dirname, '..');
const destination = path.join(project, 'submission');
const baseURL = process.env.BOOK_API_URL || 'http://127.0.0.1:5000';
const executable = process.platform === 'win32' ? 'curl.exe' : 'curl';
const records = [];

function printable(arg) {
  return /^[A-Za-z0-9_./:@=-]+$/.test(arg) ? arg : '"' + arg.replaceAll('"', '\\"') + '"';
}

async function capture(name, args, status, verify) {
  const fullArgs = ['--silent', '--show-error', '--max-time', '30', ...args];
  const command = [executable, ...fullArgs.map(printable)].join(' ');
  const { stdout, stderr } = await exec(executable, fullArgs, { cwd: project, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(stderr, '', name);
  assert.match(stdout, new RegExp(`HTTP_STATUS=${status}(?:\\r?\\n|$)`), name);
  if (verify) verify(JSON.parse(stdout.slice(0, stdout.lastIndexOf('\nHTTP_STATUS='))));
  await writeFile(path.join(destination, `${name}.txt`), `$ ${command}\n\n${stdout}`, 'utf8');
  records.push({ name, command, stdout, status });
  console.log(`${name}: HTTP ${status} verified`);
}

async function main() {
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'credentials.json'), JSON.stringify({ username: 'submission_user', password: 'BookReview123!' }) + '\n');
  await writeFile(path.join(destination, 'review.json'), JSON.stringify({ review: 'An insightful and memorable novel.' }) + '\n');
  await writeFile(path.join(destination, 'updated-review.json'), JSON.stringify({ review: 'Updated: a powerful story with memorable characters.' }) + '\n');
  const lineBreak = String.fromCharCode(92) + 'n'; // cURL's literal \\n escape
  const format = ['--write-out', `${lineBreak}HTTP_STATUS=%{http_code}${lineBreak}`];
  const json = ['--header', 'Content-Type: application/json'];
  const cookie = ['--cookie', 'submission/cookies.txt'];

  await capture('githubrepo', ['--location', '--output', 'submission/githubrepo.html', '--write-out', `HTTP_STATUS=%{http_code}${lineBreak}URL=%{url_effective}${lineBreak}`, 'https://github.com/daniarulyabubakyr/expressBookRevie'], 200);
  await rm(path.join(destination, 'githubrepo.html'));
  await capture('getallbooks', [...format, `${baseURL}/`], 200, (data) => assert.equal(Object.keys(data).length, 10));
  await capture('getbooksbyISBN', [...format, `${baseURL}/isbn/1`], 200, (data) => assert.equal(data.title, 'Things Fall Apart'));
  await capture('getbooksbyauthor', [...format, `${baseURL}/author/Chinua%20Achebe`], 200, (data) => assert.equal(data['1'].author, 'Chinua Achebe'));
  await capture('getbooksbytitle', [...format, `${baseURL}/title/Things%20Fall%20Apart`], 200, (data) => assert.equal(data['1'].title, 'Things Fall Apart'));
  await capture('register', [...format, '--request', 'POST', ...json, '--data-binary', '@submission/credentials.json', `${baseURL}/register`], 201);
  await capture('login', [...format, '--request', 'POST', ...json, '--data-binary', '@submission/credentials.json', '--cookie-jar', 'submission/cookies.txt', `${baseURL}/customer/login`], 200, (data) => assert.equal(data.username, 'submission_user'));
  await capture('reviewadded', [...format, '--request', 'PUT', ...cookie, ...json, '--data-binary', '@submission/review.json', `${baseURL}/customer/auth/review/1`], 201, (data) => assert.equal(data.reviews.submission_user, 'An insightful and memorable novel.'));
  await capture('getbookreview', [...format, `${baseURL}/review/1`], 200, (data) => assert.equal(data.submission_user, 'An insightful and memorable novel.'));
  await capture('reviewupdated', [...format, '--request', 'PUT', ...cookie, ...json, '--data-binary', '@submission/updated-review.json', `${baseURL}/customer/auth/review/1`], 200, (data) => assert.equal(data.reviews.submission_user, 'Updated: a powerful story with memorable characters.'));
  await capture('deletereview', [...format, '--request', 'DELETE', ...cookie, `${baseURL}/customer/auth/review/1`], 200, (data) => assert.deepEqual(data.reviews, {}));
  await capture('reviewafterdelete', [...format, `${baseURL}/review/1`], 200, (data) => assert.deepEqual(data, {}));

  const report = [
    '# Actual cURL submission evidence',
    `Captured at ${new Date().toISOString()}. Each output below came from the curl executable; expected statuses and key response data were asserted.`,
    'Run these commands from final_project after npm ci and npm start. Use a fresh server process before replaying registration. On Windows use curl.exe; on macOS/Linux use curl. Payload files are included under submission/. The password is a public demonstration credential, not a real account password.',
    'The getbookreview request runs after reviewadded so it demonstrates persisted review data. reviewupdated and reviewafterdelete are extra verification beyond the ten requested submission files.',
    ...records.map(({ name, command, stdout }) => `## ${name}\n\nCommand:\n\n\`\`\`sh\n${command}\n\`\`\`\n\nActual output:\n\n\`\`\`text\n${stdout.trimEnd()}\n\`\`\``)
  ].join('\n\n') + '\n';
  await writeFile(path.join(destination, 'SUBMISSION.md'), report, 'utf8');
}

main().catch((err) => {
  console.error('Evidence capture failed:', err.message);
  process.exitCode = 1;
});
