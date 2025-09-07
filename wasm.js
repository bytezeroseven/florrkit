import fs from 'fs';
import { execSync } from 'child_process';

main();

async function main() {
	const text = await (await fetch('https://florr.io')).text();
	const version = text.match(/versionHash = "([^"]+)";/)[1];

	console.log(`Version: ${version}`);

	const url = `https://static.florr.io/${version}/client.wasm`;
	const wasm = await (await fetch(url)).arrayBuffer();
	fs.writeFileSync(`client.wasm`, new DataView(wasm));

	console.log('creating wat...');

	execSync(`wasm2wat client.wasm -o client.wat --generate-names`);
	fs.rmSync('client.wasm')
}