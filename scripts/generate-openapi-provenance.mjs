/**
 * OpenAPI Provenance Generator
 *
 * Hashes audit/openapi/devupai-v1.yaml and tests/fixtures/openapi.json to produce
 * audit/openapi/PROVENANCE.json.
 *
 * NOTE: Run this script after ANY change to either file, or contract.test.ts
 * will fail with OPENAPI_IDENTITY_MISMATCH or OPENAPI_FIXTURE_IDENTITY_MISMATCH.
 *
 * WHAT THIS GATE DOES NOT DO:
 * This gate proves that neither audit/openapi/devupai-v1.yaml nor
 * tests/fixtures/openapi.json has changed since generation. It does NOT compare
 * audit/openapi/devupai-v1.yaml against the parent repo's live spec. If the live spec
 * changes and this copy is not refreshed, the tests will stay green and the drift
 * will go unnoticed.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourcePath = path.join(rootDir, 'audit', 'openapi', 'devupai-v1.yaml');
const fixturePath = path.join(rootDir, 'tests', 'fixtures', 'openapi.json');
const provenancePath = path.join(rootDir, 'audit', 'openapi', 'PROVENANCE.json');

if (!fs.existsSync(sourcePath)) {
  console.error(`Source file not found at: ${sourcePath}`);
  process.exit(1);
}

if (!fs.existsSync(fixturePath)) {
  console.error(`Fixture file not found at: ${fixturePath}`);
  process.exit(1);
}

const sourceBuffer = fs.readFileSync(sourcePath);
const fixtureBuffer = fs.readFileSync(fixturePath);

const sourceHash = crypto.createHash('sha256').update(sourceBuffer).digest('hex').toUpperCase();
const fixtureHash = crypto.createHash('sha256').update(fixtureBuffer).digest('hex').toUpperCase();

const provenance = {
  SourceSHA256: sourceHash,
  FixtureSHA256: fixtureHash,
};

fs.mkdirSync(path.dirname(provenancePath), { recursive: true });
fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n', 'utf8');

console.log('OpenAPI Provenance generated successfully:');
console.log(`- Source:  ${sourcePath}`);
console.log(`  SHA256:  ${sourceHash}`);
console.log(`- Fixture: ${fixturePath}`);
console.log(`  SHA256:  ${fixtureHash}`);
console.log(`- Output:  ${provenancePath}`);
