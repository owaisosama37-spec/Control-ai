const { runGitHub } = require('./test-webhooks.js');

runGitHub().catch(error => {
  console.error(`GitHub webhook check failed: ${error.message}`);
  process.exitCode = 1;
});