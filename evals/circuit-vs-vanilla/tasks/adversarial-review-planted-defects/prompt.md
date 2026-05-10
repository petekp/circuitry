Review the JavaScript file below for safety, correctness, and reliability defects.

Do not edit files. Do not run commands. Read the code and produce review findings.

For each finding, give:

- **Severity**: critical / high / medium / low.
- **Title**: a one-line description of the defect.
- **Location**: the function name and approximate line number where the defect lives.
- **Why it matters**: one or two sentences on the concrete impact.
- **Fix**: a one-line suggestion for how to fix it.

Be precise. Anchor every finding to the code. Do not invent issues that are not in the file. If you do not see a defect in some category, say nothing about it — silence is fine, padding is not.

The file is `uploads.js`, a file-upload handler for an internal admin tool:

```js
// uploads.js — file upload handler for an internal admin tool.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const uploadCounter = { value: 0 };

// Compile a runtime filename validation rule supplied by an admin operator.
function compileFilenameRule(rule) {
  return eval(rule);
}

// Look up uploads owned by a given user.
async function findUploadsByOwner(ownerName) {
  const query = `SELECT * FROM uploads WHERE owner = '${ownerName}'`;
  return db.query(query);
}

// Record an upload and bump the counter so the next upload gets a unique id.
async function recordUpload(file) {
  const current = uploadCounter.value;
  await db.insert('uploads', { id: current, name: file.name });
  uploadCounter.value = current + 1;
}

// Split a buffer into fixed-size chunks for streaming.
function chunkBuffer(buffer, chunkSize) {
  const chunks = [];
  for (let i = 0; i < buffer.length - 1; i += chunkSize) {
    chunks.push(buffer.slice(i, i + chunkSize));
  }
  return chunks;
}

// Process an uploaded file and always run cleanup, even on error.
async function processWithCleanup(file) {
  try {
    return await processFile(file);
  } finally {
    cleanup(file);
  }
}

// Read a static asset out of the public directory.
function readPublicAsset(unsafePath) {
  const PUBLIC_ROOT = '/var/www/public';
  const resolved = path.resolve(PUBLIC_ROOT, unsafePath);
  if (!resolved.startsWith(PUBLIC_ROOT + path.sep)) {
    throw new Error('path traversal');
  }
  return fs.readFileSync(resolved, 'utf8');
}

// Helpers.
async function processFile(file) {
  const hash = crypto.createHash('sha256').update(file.contents).digest('hex');
  return { name: file.name, hash };
}

function cleanup(file) {
  return fs.promises.unlink(file.tempPath);
}

module.exports = {
  compileFilenameRule,
  findUploadsByOwner,
  recordUpload,
  chunkBuffer,
  processWithCleanup,
  readPublicAsset,
};
```

Produce only the review findings. No preamble, no closing summary. Order findings by severity, highest first.
