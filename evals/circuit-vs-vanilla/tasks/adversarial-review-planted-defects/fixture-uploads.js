// uploads.js — file upload handler for an internal admin tool.
// Reviewed by both Circuit and vanilla arms in the
// adversarial-review-planted-defects comparison.

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

// Helpers (no defects).
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
