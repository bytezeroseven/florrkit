import http from 'http';
import fs from 'fs';
import { execSync } from 'child_process';

const PORT = 5000;

const server = http.createServer((req, res) => {
	if (req.method === 'OPTIONS') return res.writeHead(200).end();

	if (req.url === '/wasm') {
		console.time('wasm');
		try {
			execSync('wat2wasm bin/client.wat -o bin/out.wasm', { encoding: 'utf8' });

			res.writeHead(200, {
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 
				'Access-Control-Allow-Origin': '*', 
				'Content-Type': 'application/wasm'
			});
			fs.createReadStream('bin/out.wasm').pipe(res);
		} catch (error) {
			console.log(error);
			res.writeHead(500).end();
		}
		console.timeEnd('wasm');
		return;
	}

	res.writeHead(404).end();
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}...`));