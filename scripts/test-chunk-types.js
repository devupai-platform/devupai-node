/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const scratchDir = path.join(__dirname, '..', 'audit', 'consumer');

if (fs.existsSync(scratchDir)) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
}
fs.mkdirSync(scratchDir, { recursive: true });

const pkg = {
    name: "chunk-consumer",
    version: "1.0.0",
    dependencies: {
        "devupai": "file:../../devupai-3.0.0.tgz"
    }
};

fs.writeFileSync(path.join(scratchDir, 'package.json'), JSON.stringify(pkg, null, 2));

const tsconfig = {
    compilerOptions: {
        target: "ES2022",
        moduleResolution: "node",
        module: "CommonJS",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true
    }
};

fs.writeFileSync(path.join(scratchDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

const code = `
import DevupAI from 'devupai';
import { ChatCompletionChunk } from 'devupai';

async function testIterate() {
    const client = new DevupAI({ apiKey: 'test' });
    const stream = await client.chat.completions.create({
        model: "gpt-4",
        messages: [],
        stream: true
    });

    for await (const chunk of stream) {
        if ("_devup" in chunk) {
            console.log(chunk._devup.cost_dzd);
        } else {
            console.log(chunk.choices[0].delta.content);
        }
    }
}
testIterate();
`;

fs.writeFileSync(path.join(scratchDir, 'index.ts'), code);

console.log("Installing devupai in isolated chunk consumer...");
execSync('npm install', { cwd: scratchDir, stdio: 'inherit' });

console.log("Compiling chunk consumer...");
try {
    execSync('npx tsc index.ts --noEmit', { cwd: scratchDir, stdio: 'inherit' });
    console.log("[PASS] Chunk consumer compiled successfully!");
} catch (err) {
    console.error("[FAIL] Chunk consumer compilation failed!");
    process.exit(1);
}
