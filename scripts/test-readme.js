/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const originalReadmePath = path.join(__dirname, '..', 'README.md');
const tarballName = 'devupai-3.0.0.tgz';
const scratchDir = path.join(__dirname, '..', 'audit', 'readme');

if (fs.existsSync(scratchDir)) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
}
fs.mkdirSync(scratchDir, { recursive: true });

// Find real versions from package-lock.json
const lockfile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
function getExactVersion(pkgName) {
    const pkg = lockfile.packages[`node_modules/${pkgName}`];
    if (pkg && pkg.version) return pkg.version;
    if (pkgName === 'ai') return '6.0.0';
    if (pkgName === '@ai-sdk/openai-compatible') return '2.0.50';
    if (pkgName === '@ai-sdk/provider') return '3.0.10';
    throw new Error(`Could not find exact version for ${pkgName} in package-lock.json`);
}

const aiVersion = getExactVersion('ai');
const openaiCompatVersion = getExactVersion('@ai-sdk/openai-compatible');
const providerVersion = getExactVersion('@ai-sdk/provider');

console.log(`Using exact dependency versions: ai@${aiVersion}, @ai-sdk/openai-compatible@${openaiCompatVersion}, @ai-sdk/provider@${providerVersion}`);

const pkg = {
    name: "readme-consumer",
    version: "1.0.0",
    type: "module",
    dependencies: {
        "devupai": `file:../../${tarballName}`,
        "ai": aiVersion,
        "@ai-sdk/openai-compatible": openaiCompatVersion,
        "@ai-sdk/provider": providerVersion
    }
};

fs.writeFileSync(path.join(scratchDir, 'package.json'), JSON.stringify(pkg, null, 2));

const tsconfig = {
    compilerOptions: {
        target: "ES2022",
        moduleResolution: "NodeNext",
        module: "NodeNext",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: false,
        lib: ["ES2022", "DOM"]
    }
};

fs.writeFileSync(path.join(scratchDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

console.log("Installing dependencies in isolated consumer...");
execSync('npm install', { cwd: scratchDir, stdio: 'inherit' });

const tarballReadmePath = path.join(scratchDir, 'node_modules', 'devupai', 'README.md');
const originalReadmeContent = fs.readFileSync(originalReadmePath);
const tarballReadmeContent = fs.readFileSync(tarballReadmePath);

if (!originalReadmeContent.equals(tarballReadmeContent)) {
    console.error("FAIL: package/README.md is not byte-for-byte identical to root README.md");
    process.exit(1);
}
console.log("SUCCESS: package/README.md is byte-for-byte identical to root README.md");

const readmeContentText = tarballReadmeContent.toString('utf8');
const tsRegex = /```(?:typescript|ts)\r?\n([\s\S]*?)```/g;
let match;
let blockCount = 0;
const blocks = [];

while ((match = tsRegex.exec(readmeContentText)) !== null) {
    blocks.push(match[1]);
    blockCount++;
}

console.log(`Found ${blockCount} TypeScript blocks in tarball README.md`);

if (blockCount === 0) {
    console.error(`Expected at least 1 TypeScript block in README.md, but found ${blockCount}.`);
    process.exit(1);
}

let passCount = 0;
for (let i = 0; i < blocks.length; i++) {
    const code = blocks[i];
    const fileName = `index.ts`; // compile one by one as project
    const filePath = path.join(scratchDir, fileName);
    fs.writeFileSync(filePath, code);

    console.log(`Compiling block_${i + 1}.ts...`);
    try {
        execSync(`npx tsc -p tsconfig.json`, { cwd: scratchDir, encoding: 'utf8' });
        console.log(`[PASS] block_${i + 1}.ts`);
        passCount++;
    } catch (err) {
        console.error(`[FAIL] block_${i + 1}.ts`);
        if (err.stdout) console.error(err.stdout.toString());
        if (err.stderr) console.error(err.stderr.toString());
    }

    // clear file for next run
    fs.rmSync(filePath);
}

if (passCount !== blocks.length) {
    console.error(`Only ${passCount}/${blocks.length} blocks compiled successfully.`);
    process.exit(1);
}

fs.rmSync(scratchDir, { recursive: true, force: true });
console.log("All README examples compiled successfully!");
