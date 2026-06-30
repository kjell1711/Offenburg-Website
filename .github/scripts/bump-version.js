const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

try {
  const lastMsg = run('git log -1 --pretty=%B');
  const lastAuthor = run('git log -1 --pretty=format:%an');

  // avoid loops: if the last commit was made by this action or already a bump, skip
  if (/version-bump/i.test(lastMsg) || /github-actions/i.test(lastAuthor)) {
    console.log('Skip bump: last commit is a version-bump or from github-actions.');
    process.exit(0);
  }

  const file = 'version.json';
  if (!fs.existsSync(file)) {
    console.log('No version.json found, creating default.');
    fs.writeFileSync(file, JSON.stringify({ version: '1.0.0', changes: [] }, null, 2) + '\n');
  }

  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const parts = (json.version || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  parts[2] = (parts[2] || 0) + 1; // bump patch
  const newVersion = parts.join('.');

  const summary = lastMsg.split('\n')[0];
  const date = new Date().toISOString().split('T')[0];
  const entry = `${date} — ${summary} (${lastAuthor})`;

  json.version = newVersion;
  json.changes = [entry].concat(json.changes || []).slice(0, 3);

  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');

  // commit & push
  run('git config user.name "github-actions[bot]"');
  run('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
  run('git add version.json');
  try {
    run(`git commit -m "[version-bump] Bump to ${newVersion}"`);
  } catch (e) {
    console.log('No changes to commit.');
    process.exit(0);
  }
  run('git push');
  console.log('Version bumped to', newVersion);
} catch (err) {
  console.error('Error bumping version:', err && err.message ? err.message : err);
  process.exit(1);
}
