import fs from 'fs';
import { execSync } from 'child_process';

main();

async function main() {
	if (!fs.existsSync('bin')) {
		fs.mkdirSync('bin')
	}

	const text = await (await fetch('https://florr.io')).text();
	const version = text.match(/versionHash = "([^"]+)";/)[1];

	console.log(`Version: ${version}`);

	const url = `https://static.florr.io/${version}/client.wasm`;
	const wasm = await (await fetch(url)).arrayBuffer();
	fs.writeFileSync(`bin/client.wasm`, new DataView(wasm));

	console.log('creating wat...');

	execSync(`wasm2wat bin/client.wasm -o bin/client.wat --generate-names`);
	fs.rmSync('bin/client.wasm')
}