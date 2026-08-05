/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tarballName = 'devupai-3.0.0.tgz';
const scratchDir = path.join(__dirname, '..', 'audit', 'strict-consumer');

if (fs.existsSync(scratchDir)) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
}
fs.mkdirSync(scratchDir, { recursive: true });

const pkg = {
    name: "strict-consumer",
    version: "1.0.0",
    dependencies: {
        "devupai": `file:../../${tarballName}`
    }
};

fs.writeFileSync(path.join(scratchDir, 'package.json'), JSON.stringify(pkg, null, 2));

const tsconfig = {
    compilerOptions: {
        target: "ES2022",
        moduleResolution: "NodeNext",
        module: "NodeNext",
        strict: true,
        skipLibCheck: false,
        lib: ["ES2022", "DOM"]
    }
};

fs.writeFileSync(path.join(scratchDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

console.log("Installing devupai in isolated strict consumer...");
execSync('npm install', { cwd: scratchDir, stdio: 'inherit' });

const testCode = `
import DevupAI from 'devupai';

const client = new DevupAI({ apiKey: 'test' });

async function run() {
    await client.images.generate({
        model: "model",
        prompt: "prompt"
    });

    await client.images.edit({
        model: "model",
        image: new Blob(),
        prompt: "edit"
    });

    await client.embeddings.create({
        model: "model",
        input: ["hello"]
    });

    await client.audio.speech.create({
        model: "model",
        input: "hello"
    });

    await client.audio.transcriptions.create({
        file: new Blob()
    });

    await client.video.edits.create({
        model: "model",
        video: new Blob()
    });

    // Custom optional overrides
    await client.images.generate({
        model: "model",
        prompt: "prompt",
        size: "1024x1024",
        n: 2
    });

    await client.images.edit({
        model: "model",
        image: new Blob(),
        prompt: "edit",
        mask: new Blob(),
        size: "1024x1024",
        n: 2
    });

    await client.embeddings.create({
        model: "model",
        input: ["hello"],
        encoding_format: "base64"
    });

    await client.audio.speech.create({
        model: "model",
        input: "hello",
        voice: "alloy",
        response_format: "mp3"
    });

    await client.audio.transcriptions.create({
        file: new Blob(),
        model: "model",
        response_format: "json"
    });

    await client.video.edits.create({
        model: "model",
        video: new Blob(),
        mask: new Blob(),
        key_points: "test",
        frame_index: 0,
        auto_trim: true,
        preserve_audio: true,
        background_color: "#000",
        desired_increase: 2
    });
}
`;

fs.writeFileSync(path.join(scratchDir, 'index.ts'), testCode);

console.log("Compiling strict consumer...");
try {
    execSync('npx tsc -p tsconfig.json', { cwd: scratchDir, stdio: 'inherit' });
    console.log("[PASS] Strict consumer compiled successfully!");
} catch (e) {
    console.error("[FAIL] Strict consumer compilation failed!");
    process.exit(1);
}
