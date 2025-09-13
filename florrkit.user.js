// ==UserScript==
// @name         Florrkit - Hitboxes, infinite zoom, particles & more for florr.io
// @namespace    http://tampermonkey.net/
// @version      0.6.2
// @description  Hitboxes, petal particles, inventory rarity counter, unlock all petals, server selector, get entity position, disable crafting, infinite zooming & more for florr.io
// @author       zertalious
// @match        https://florr.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=florr.io
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_info
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

function onGameObjects(objects) {
	/* 

	Use this function to access game objects in your view.
	Might be handy for creating mob alerts or self-playing bots.

	[{ type, x, y, size, guild, level, rarity, mob }]

	*/

	// console.log(objects)
}

HTMLElement.prototype.insertBefore = new Proxy(HTMLElement.prototype.insertBefore, {
	apply(target, thisArgs, args) {
		if (args[0].src && args[0].src.indexOf('client.js') > -1) {
			Module.print = function (text) {
				if (typeof text === 'string' && text.indexOf('Connecting to ') > -1) {
					server = text.split(' ')[2].split('.')[0]
					setServerUI(server);
				}

				console.log.apply(console, arguments);
			}
		}

		return Reflect.apply(...arguments);
	}
});

function ProxyFunction(object, key, callback) {
	const original = object[key];

	object[key] = function () {
		callback(this, arguments);
		return original.apply(this, arguments);
	}

	return object[key];
}

const PI2 = Math.PI * 2;

let craftDisableT = 0;
let craftBoard;

ProxyFunction(HTMLElement.prototype, 'addEventListener', (el, args) => {
	if (['mousedown', 'touchstart'].includes(args[0])) {
		const old = args[1];
		args[1] = function (event) {
			if (craftBoard) {
				const x = event.clientX;
				const y = event.clientY;
				
				if (x > craftBoard.x && x < craftBoard.x + craftBoard.width && 
					y > craftBoard.y && y < craftBoard.y + craftBoard.height) {
					craftDisableT = 1;
					return;
				}
			}

			old(event)
		}
	}
})

const CTX = CanvasRenderingContext2D.prototype;

CTX.fillRect = new Proxy(CTX.fillRect, {
	apply(target, ctx, args) {
		if (settings.showRarityCount && ctx.fillStyle === '#5a9fdb') {
			drawRarityCount(ctx);
		} else if (settings.disableCrafting && ctx.fillStyle === '#db9d5a') {
			Reflect.apply(...arguments);

			const matrix = ctx.getTransform();

			const {
				a: width,
				d: height, 
				e: x,
				f: y
			} = matrix;

			craftBoard = { x, y: y + 50, width, height };

			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.translate(x, y);

			const f = width / 800;
			ctx.scale(f, f);

			ctx.translate(15, 15);

			const t = craftDisableT;
			if (t > 0) {
				ctx.translate(
					(Math.random() * 2 - 1) * 14 * t, 
					(Math.random() * 2 - 1) * 14 * t
				);
			}

			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';
			ctx.font = 'bolder 20px Ubuntu';
			ctx.fillStyle = '#ff3535';
			ctx.strokeStyle = '#000';
			ctx.lineWidth = 2;

			const text = 'Crafting is disabled for eternity.';

			ctx.strokeText(text, 0, 0);
			ctx.fillText(text, 0, 0);

			ctx.restore();
			return;
		}

		Reflect.apply(...arguments);
	}
});

function drawRarityCount(ctx) {
	const rarityCount = getRarityCount();

	const list = [];
	for (const rarity in rarityCount) {
		list.push([
			rarity, rarityCount[rarity]
		]);
	}

	if (list.length === 0) return;

	const margin = 10;
	const rowHeight = 24;

	const itemCount = list.length;
	const width = 280;
	const height = Math.ceil(itemCount / 2) * rowHeight + margin * 2;
	const r = 8;

	const matrix = ctx.getTransform();

	const {
		a: W,
		e: x,
		f: y
	} = matrix;

	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.translate(x + W / 2, y);

	const f = W / 500;
	ctx.scale(f, f);
	ctx.translate(-width / 2, -height - 3);

	ctx.beginPath();
	ctx.roundRect(0, 0, width, height + r, r);
	ctx.clip();

	ctx.fillStyle = '#4981b1';
	ctx.fill();

	ctx.translate(0, margin);

	for (let i = 0; i < itemCount; i++) {
		ctx.save();

		if (itemCount % 2 === 1 && i === 0) {
			ctx.translate(width / 2, rowHeight / 2);
		} else {
			ctx.translate(
				((i - (itemCount % 2)) % 2) * width / 2 + width / 4,
				Math.floor(((itemCount % 2) + i) / 2) * rowHeight + rowHeight / 2
			);
		}

		const [rarity, count] = list[i];
		const [name, color] = rarities[rarity];
		const text = count.toLocaleString('en-US') + ' ' + name;

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = 'bolder 19px Ubuntu';
		ctx.fillStyle = color;
		ctx.strokeStyle = '#000';
		ctx.lineWidth = 1.9;

		ctx.strokeText(text, 0, 0);
		ctx.fillText(text, 0, 0);
		ctx.restore();
	}

	ctx.restore();
}

const rarities = [
	['Common', '#7EEF6D'],
	['Unusual', '#FFE65D'],
	['Rare', '#4D52E3'],
	['Epic', '#861FDE'],
	['Legendary', '#DE1F1F'],
	['Mythic', '#1FDBDE'],
	['Ultra', '#FF2B75'],
	['Super', '#2BFFA3'],
	['Unique', '#555555']
];

const rarityIds = {};
for (let i = 0; i < rarities.length; i++) {
	const [name] = rarities[i];
	rarityIds[name] = i;
	rarityIds[name.toLowerCase()] = i;
}

let ROT_SPEED_ADDRESS = -1;
function setRotSpeed(n) {
	if (ROT_SPEED_ADDRESS <= -1) return;
	f32(ROT_SPEED_ADDRESS, 0, n);
}

let INVENTORY_ADDRESS = -1;
const PETAL_COUNT = 106;
const RARITY_COUNT = 9;

function getRarityCount() {
	if (INVENTORY_ADDRESS <= -1) return {};

	const map = {};

	for (let petal = 1; petal <= PETAL_COUNT; petal++) {
		for (let rarity = 0; rarity < RARITY_COUNT; rarity++) {
			const offset = (petal * RARITY_COUNT + rarity) << 2;
			const stock = Module.HEAPU32[(INVENTORY_ADDRESS + offset) >> 2];

			if (stock > 0) {
				map[rarity] = (map[rarity] || 0) + stock;
			}
		}
	}

	return map;
}

function unlockAllPetals() {
	if (INVENTORY_ADDRESS <= -1) return;

	for (let petal = 1; petal <= PETAL_COUNT; petal++) {
		for (let rarity = 0; rarity < RARITY_COUNT; rarity++) {
			const offset = (petal * RARITY_COUNT + rarity) << 2;
			Module.HEAPU32[(INVENTORY_ADDRESS + offset) >> 2] = 1;
		}
	}
}

let canvas;
let ctx;

let entityTexts = {};
let texts;
let objects = [];

let zoom = 1;
let nZoom = zoom;

let hitboxBroken = false;

const FlorrkitImports = {
	print(n) {
		console.log('float: ' + n);
	},
	printInt(n) {
		console.log('int: ' + n);
	},
	drawCircle(world, entity, layer) {
		if (layer === 8) return; // petal drops

		const isDead = u8(u32(entity, 68), 8) === 1;
		if (isDead) return;

		const pos = u32(u32(u32(entity, 72)), 84);
		const x = f64(pos, 360);
		const y = f64(pos, 368);
		
		const size = f32(u32(entity, 72), 8);

		const healthBar = u32(u32(u32(entity, 72)), 76);
		const healthBarTextCount = u8(healthBar, 10);

		const playerRarity = u32(u32(u32(entity, 72)), 64);

		const texts = entityTexts[healthBar];
		if (texts && texts.length > 0) {
			const data = {
				type: 'unknown', 
				x, 
				y, 
				size
			};

			if (playerRarity > 0) {
				data.type = 'player';
				data.rarity = u8(playerRarity, 18);

				if (texts.length === 2) {
					[data.username, data.level] = texts;
				} else {
					[data.username, data.guild, data.level] = texts;
				}

				data.level = parseInt(data.level.split(' ')[1]);
			} else {
				data.type = 'mob';
				[data.mob, data.rarity] = texts;

				const n = rarityIds[data.rarity]
				if (n !== undefined) data.rarity = n;
			}

			objects.push(data);
		}

		if (!settings.showHitbox) return;

		if (playerRarity > 0) {
			const n = u8(playerRarity, 18);
			if (!settings.showPlayerHitbox) return;
		}

		const petalRarity = u32(u32(u32(entity, 72)), 80);
		if (petalRarity > 0) {
			const n = u8(petalRarity, 10);
			if (!settings.showPetalHitbox) return;
		}

		if (!playerRarity && !petalRarity) {
			if (!settings.showMobHitbox) return;
		}

		if (size <= 0) {
			if (!hitboxBroken) {
				hitboxBroken = true;
				alert(`Looks like hitboxes are patched or broken due to an update. Report to script developer.`);
			}
			return;
		}

		ctx.save();

		ctx.setTransform(
			f32(world, 0),
			f32(world, 4),
			f32(world, 8),
			f32(world, 12),
			f32(world, 16),
			f32(world, 20)
		);

		ctx.beginPath();
		ctx.arc(x, y, size, 0, Math.PI * 2);
		ctx.strokeStyle = hitboxColorEl.value;
		ctx.lineWidth = hitboxSize;
		ctx.stroke();

		ctx.restore();
	},
	getParticleMinRarity: () => settings.showParticles ? 0 : 7,
	showUniqueParticles: () => settings.showUniqueParticles ? 1 : 0, 
	alwaysShowPetalRarity: () => settings.alwaysShowPetalRarity ? 1 : 0, 
	hideChatBubble: () => settings.showChatBubble ? 0 : 1, 
	startCapturingText(entity) {
		entityTexts[entity] = texts = [];
	}, 
	stopCapturingText() {
		texts = null;
	}, 
	getViewWidth: () => 1920 * zoom, 
	getViewHeight: () => 1080 * zoom
};

ProxyFunction(CTX, 'clearRect', ctx => {
	if (ctx.canvas === canvas) {
		if (typeof onGameObjects === 'function') onGameObjects(objects);

		entityTexts = {};
		objects = [];
		craftBoard = null;
	}
});

function u8(address, offset = 0) {
	return Module.HEAPU8[address + offset];
}
 
function u32(address, offset = 0) {
	return Module.HEAPU32[(address + offset) >> 2];
}
 
function f32(address, offset = 0, value) {
	if (value === undefined) {
		return Module.HEAPF32[(address + offset) >> 2];	
	} else {
		Module.HEAPF32[(address + offset) >> 2] = value;
	}
}
 
function f64(address, offset = 0) {
	return Module.HEAPF64[(address + offset) >> 3];
}

const _instantiateStreaming = WebAssembly.instantiateStreaming;
WebAssembly.instantiateStreaming = function () {
	return _instantiateStreaming(new Response());
}

const _instantiate = WebAssembly.instantiate;
WebAssembly.instantiate = async function (buffer, imports) {
	console.time('wasm');

	try {
		console.log('overloading wasm...');
		
		buffer = await editWasm(buffer);
		imports.florrkit = FlorrkitImports;
		settingsBtnEl.style.background = '';
		
		console.log('wasm overloaded!');
	} catch (error) {
		alert('Florrkit wasm overload failed! Report issue to developer.\n\nError: ' + error.message);
		console.error('wasm overload failed!', error);
	}

	console.timeEnd('wasm');

	return _instantiate(buffer, imports);
}

async function editWasm(buffer) {
	await new Promise(resolve => {
		const script = document.createElement('script');
		script.src = 'https://cdn.jsdelivr.net/npm/wabt@1.0.37/index.min.js';
		script.onload = resolve
		document.body.appendChild(script);
	});

	const wabt = await WabtModule();
	
	const wasm = wabt.readWasm(buffer, {});
	wasm.generateNames();
    wasm.applyNames();

	let wat = wasm.toText({});

	const funcId = wat.findParam(`local.get $l14
                local.get $p4
                local.get $l17
                f64.load offset=32
                call `, 'funcId');

	wat = wat.replace2(`  (func `, `

  (import "florrkit" "print" (func $print (param f64)))
  (import "florrkit" "printInt" (func $printInt (param i32)))
  (import "florrkit" "drawCircle" (func $drawCircle (param i32 i32 i32)))
  (import "florrkit" "getParticleMinRarity" (func $getParticleMinRarity (result i32)))
  (import "florrkit" "showUniqueParticles" (func $showUniqueParticles (result i32)))
  (import "florrkit" "alwaysShowPetalRarity" (func $alwaysShowPetalRarity (result i32)))
  (import "florrkit" "hideChatBubble" (func $hideChatBubble (result i32)))
  (import "florrkit" "startCapturingText" (func $startCapturingText (param i32)))
  (import "florrkit" "stopCapturingText" (func $stopCapturingText))
  (import "florrkit" "getViewWidth" (func $getViewWidth (result f32)))
  (import "florrkit" "getViewHeight" (func $getViewHeight (result f32)))
  
  (func `, 'imports')
		.replace2('(local $l53 i64)\n', `(local $l53 i64) (local $entity i32)\n`, 'params')
		.replace2(`  local.get $p3
                end
                local.get $l17
                f64.load offset=32
                f32.demote_f64`, 
                `  local.get $p3
                end

                local.tee $entity
                
                local.get $l17
                f64.load offset=32
                f32.demote_f64`, 
                'entity value'
        ).replace2(`local.get $l16
                i32.const 4
                i32.add
                local.tee $l16
                local.get $l14
                i32.ne
                br_if $L415`, `

                local.get $p4
                local.get $entity
                local.get $l12
                call $drawCircle

                local.get $l16
                i32.const 4
                i32.add
                local.tee $l16
                local.get $l14
                i32.ne
                br_if $L415`, 
                'draw hitbox'
        ).replace2(`local.set $p0
                      local.get $l11
                      i32.load8_u offset=9
                      i32.const 7`, 
                  `local.set $p0
                      local.get $l11
                      i32.load8_u offset=9
                      call $getParticleMinRarity`, 
                      'particle min rarity'
        ).replace2(`local.get $l11
                      i32.load8_u offset=9
                      i32.const 8
                      i32.shl
                      i32.const 1792
                      i32.eq`, 
                  `local.get $l11
                      i32.load8_u offset=9
                      i32.const 8
                      i32.shl
                      i32.const 1792
                      i32.eq

                      i32.const 1
                      call $showUniqueParticles
                      select
                      `, 'particle color'
        ).replace2(`local.get $l14
                local.get $p4
                local.get $l17
                f64.load offset=32
                call ${funcId}`, `
                local.get $l14
                call $startCapturingText

                local.get $l14
                local.get $p4
                local.get $l17
                f64.load offset=32
                call ${funcId}
                
                call $stopCapturingText`, 'health bar'
    	).replace2(`i32.load8_u
                    i32.eqz
                    br_if $B356`, `i32.load8_u
                    call $alwaysShowPetalRarity
                    i32.xor
                    i32.eqz
                    br_if $B356`, 
                    'show petal rarity'
        ).replace2(`block $B8
      block $B9
        block $B10
          local.get $p2`, `block $B8
      block $B9
        block $B10
          br 0
          local.get $p2`, 'disable object cull')
        .replaceAll('f32.const 0x1.ep+10 (;=1920;)', 'call $getViewWidth')
        .replaceAll('f32.const 0x1.0ep+10 (;=1080;)', 'call $getViewHeight')
        .replace2(`i32.sub
      local.set $l8
      loop $L450
        block $B451`, `i32.sub
      local.set $l8
      loop $L450
        block $B451
          call $hideChatBubble
          br_if 0`, 'bubbles');

	INVENTORY_ADDRESS = wat.findParam(`i32.const 8
      i32.shr_u
      i32.add
      i32.const 2
      i32.shl
      i32.const `, 'inventory addy');

	console.log('Inventory address: ' + INVENTORY_ADDRESS);

	ROT_SPEED_ADDRESS = wat.findParam(`end
      local.get $l2
      f32.const 0x0p+0 (;=0;)
      i32.const `, 'rot speed addy')

	console.log('Rotation speed address: ' + ROT_SPEED_ADDRESS);

	return wabt.parseWat('x', wat).toBinary({}).buffer;
}

String.prototype.findParam = function (search, name = 'x') {
	const i = this.indexOf(search);
	if (i > -1) {
		let text = this.slice(i + search.length);
		text = text.slice(0, text.indexOf('\n'))
		const n = parseFloat(text);
		return isNaN(n) ? text : n;
	}

	throw new Error(`param search not found: ${name}`);
}

String.prototype.replace2 = function (a, b, name = 'x') {
	if (this.indexOf(a) === -1) throw new Error(`replace search not found: ${name}`);
	return this.replace(a, b);
}

// ui

const settings = {
	showHitbox: true,
	showPlayerHitbox: true,
	showPetalHitbox: true,
	showMobHitbox: true, 
	showParticles: true,
	showUniqueParticles: true,
	showRarityCount: true, 
	alwaysShowPetalRarity: false, 
	showChatBubble: true, 
	disableCrafting: false, 
	scrollZooming: false
};

let hitboxSize = GM_getValue('hitboxSize', 2);

const Icons = {
	settings: `<svg height="800px" width="800px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 46.937 46.937" xml:space="preserve"> <g> <path style="fill:#fff;" d="M35.639,20.94c0,0,3.321-2.927,5.753-6.389c2.748-3.863,5.187-8.821,5.187-8.821 c0.516-1.614,0.607-2.964-0.63-3.852l-1.656-1.19c-1.237-0.891-2.602-0.336-3.852,0.627c0,0-4.085,3.948-6.771,7.684 c-2.686,3.734-4.168,7.529-4.168,7.529c-0.417,1.227-0.542,2.388,0.059,3.259l-0.592,0.839c-1.071-0.826-2.159-1.554-3.206-2.152 c-3.308-1.892-5.93-3.682-5.309-5.5l1.125-3.29c0.369-1.083-1.329-4.975-2.669-6.314C18.464,2.925,18,2.566,17.579,2.288 c-0.792-0.522-2.892-1.202-4.653-1.058c-1.763,0.144-3.437,0.473-3.688,0.675C9.071,2.041,8.962,2.202,8.92,2.382 c-0.077,0.323,0.068,0.69,0.415,1.034l3.03,3.02c1.066,1.072,1.063,2.815-0.005,3.886l-3.246,3.246 c-0.516,0.515-1.205,0.799-1.937,0.799c-0.741,0-1.432-0.285-1.951-0.806l-3.017-3.018c-0.347-0.345-0.713-0.492-1.036-0.416 c-0.179,0.043-0.339,0.152-0.473,0.32c-0.202,0.25-0.532,1.923-0.677,3.685c-0.145,1.763,0.433,3.854,0.874,4.636 c0.442,0.78,2.219,2.381,4.069,3.181c1.448,0.624,2.929,1.035,3.503,0.84c0,0,1.475-0.503,3.293-1.123 c1.819-0.621,3.843,2.156,5.951,5.614c0.958,1.573,2.126,3.157,3.419,4.448l-8.054,11.409c-0.637,0.902-0.422,2.15,0.48,2.787 c0.351,0.247,0.753,0.366,1.151,0.366c0.628,0,1.246-0.295,1.636-0.847l7.885-11.169c0.737,0.561,1.435,1.084,2.071,1.553 c2.175,1.604,3.98,2.932,3.974,3.048c-0.004,0.07-0.008,0.141-0.008,0.212c0,4.202,3.408,7.611,7.61,7.611 c4.203,0,7.613-3.409,7.613-7.611c0-4.204-3.408-7.611-7.61-7.611c-0.072,0-0.142,0.003-0.212,0.009 c-0.117,0.007-1.126-2.277-2.867-4.737c-0.75-1.06-1.696-2.229-2.839-3.425l0.935-1.324C33.796,22.092,34.72,21.634,35.639,20.94z M35.06,36.266c0.752-0.755,1.752-1.168,2.82-1.168c2.197,0,3.986,1.788,3.986,3.987c0,2.2-1.79,3.989-3.986,3.989 c-2.203,0-3.989-1.789-3.989-3.989C33.891,38.02,34.303,37.017,35.06,36.266z"/> </g> </svg>`, 
	map: `<svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M2.43627 5.14686C2 5.64345 2 6.49488 2 8.19773V17.591C2 18.797 2 19.4 2.3146 19.854C2.62919 20.3079 3.17921 20.4986 4.27924 20.88L5.57343 21.3286C6.27436 21.5717 6.81371 21.7586 7.26633 21.879C7.5616 21.9576 7.83333 21.7258 7.83333 21.4203V6.2701C7.83333 6.02118 7.64964 5.81111 7.40837 5.74991C7.01914 5.65118 6.55127 5.48897 5.91002 5.26666C4.35676 4.72817 3.58014 4.45893 2.98922 4.73235C2.77941 4.82942 2.59116 4.97054 2.43627 5.14686Z" fill="#fff"/> <path d="M12.6204 3.48096L11.0844 4.54596C10.5287 4.93124 10.1215 5.2136 9.77375 5.41491C9.60895 5.51032 9.5 5.68291 9.5 5.87334V20.9203C9.5 21.2909 9.88398 21.5222 10.1962 21.3225C10.5312 21.1082 10.9149 20.8422 11.3796 20.5199L12.9156 19.4549C13.4712 19.0697 13.8785 18.7873 14.2262 18.586C14.3911 18.4906 14.5 18.318 14.5 18.1276V3.08063C14.5 2.71004 14.116 2.47866 13.8038 2.67836C13.4688 2.89271 13.0851 3.15874 12.6204 3.48096Z" fill="#fff"/> <path d="M19.7208 3.12093L18.4266 2.67226C17.7256 2.42923 17.1863 2.24228 16.7337 2.12187C16.4384 2.04333 16.1667 2.2751 16.1667 2.58064V17.7308C16.1667 17.9797 16.3504 18.1898 16.5916 18.251C16.9809 18.3497 17.4488 18.5119 18.09 18.7342C19.6432 19.2727 20.4199 19.542 21.0108 19.2686C21.2206 19.1715 21.4088 19.0304 21.5637 18.854C22 18.3575 22 17.506 22 15.8032V6.40988C22 5.2039 22 4.60091 21.6854 4.14695C21.3708 3.69298 20.8208 3.5023 19.7208 3.12093Z" fill="#fff"/> </svg>`
};

const div = fromHtml(`<div>
<style>

	[stroke] {
		--stroke-size: 0.15em;
		position: relative;
	}

	[stroke]:before {
		content: attr(stroke);
		-webkit-text-stroke: var(--stroke-size) #000;
	}

	[stroke]:after {
		content: attr(stroke);
		color: inherit;
		position: absolute;
		left: 0;
		top: 0;
	}

	body {
		margin: 0;
		padding: 0;
		overflow: hidden;
		font-family: Ubuntu;
		font-size: 11px;
		user-select: none;
		font-weight: bolder;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		-webkit-touch-callout: none;
		touch-action: none;
		color: #fff;
	}

	.dialog {
		position: absolute;
		right: 56px;
		bottom: 8px;
		background: #bbb;
		padding: 5px;
		border: 4px solid rgba(0, 0, 0, 0.1);
		border-radius: 4px;
		display: flex;
		flex-direction: column;
		z-index: 2;
		max-height: 80%;
	}

	.settings {
		width: 220px;
	}

	.dialog-header {
		--stroke-size: 0.12em;
		font-size: 19px;
		margin: 0 auto;
		margin-bottom: 8px;
	}

	.dialog-content {
		flex: 1;
		height: 100%;
		overflow-y: auto;
		padding: 0 5px;
		display: flex;
		flex-direction: column;
		grid-gap: 6px;
	}

	label {
		display: flex;
		grid-gap: 4px;
		align-items: center;
		cursor: pointer;
	}

	.checkbox {
		width: 20px;
		height: 20px;
		background: #777;
		margin: 0;
		border: 3px solid rgba(0, 0, 0, 0.2);
		border-radius: 2px;
		appearance: none;
		-webkit-appearance: none;
		position: relative;
		cursor: pointer;
		outline: 0;
	}

	.checkbox:after {
		content: ' ';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 0;
		height: 0;
		background: #ccc;
		transition: all 0.2s;
		transform: translate(-50%, -50%);
	}

	.checkbox:checked:after {
		width: 100%;
		height: 100%;
	}

	.btn {
		cursor: pointer;
		display: grid;
		place-items: center;
		position: relative;
		overflow: hidden;
		border: 2px solid rgba(0, 0, 0, 0.2);
		border-radius: 5px;
		background: #bbb;
		padding: 3px 6px;
		white-space: nowrap;
		flex: 1;
	}

	.icon-btn {
		font-size: 26px;
		width: 1em;
		height: 1em;
		padding: 3px;
	}

	.icon-btn svg {
		width: 0.8em;
		height: 0.8em;
	}

	.close-btn {
		position: absolute;
		right: 5px;
		top: 5px;
		font-size: 12px;
		border-width: 3px;
		background: #d75658;
	}

	.cross {
		width: 100%;
		height: 100%;
		opacity: 0.6;
	}

	.cross:before, .cross:after {
		content: ' ';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 80%;
		height: 15%;
		background: #fff;
		transform: translate(-50%, -50%) rotate(45deg);
		border-radius: 3px;
	}

	.cross:after {
		transform: translate(-50%, -50%) rotate(-45deg);
	}

	.overlay {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.overlay > * {
		pointer-events: all;
	}

	.btns {
		position: absolute;
		right: 8px;
		bottom: 8px;
		display: grid;
		grid-gap: 4px;
		flex-direction: column;
	}

	.btns .btn {
		font-size: 30px;
	}

	.colorpicker {
		appearance: none;
		-moz-appearance: none;
		-webkit-appearance: none;
		background: none;
		width: 1em;
		height: 1em;
		font-size: 17px;
		width: 2.45em;
		margin: 0;
		outline: 0;
		padding: 0;
		border: 2px solid #000;
		cursor: pointer;
	}

	::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	::-webkit-color-swatch {
		border: 0;
		padding: 0;
		border-radius: inherit;
	}

	.servers, .servers-btn {
		background: #ffa93a;
	}

	.servers .dialog-content .btn {
		background: transparent;
	}

	.servers {
		min-width: 300px;
	}

	.servers .dialog-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	select {
		font-family: inherit;
		font-size: 11px;
		padding: 0;
		margin: 0;
		width: 23px;
		border: 2px solid #000;
		border-radius: 2px;
		background: #fff;
		outline: 0;
	}

	select.big {
		width: 100px;
		height: 20px;
	}

	.btn.active {
		border-color: white;
	}

	.hidden, .hidden2 {
		display: none;
	}

	.range {
		--color: dodgerblue;
		-webkit-appearance: none;
		outline: 0;
		position: relative;
		overflow: hidden;
		font-size: 16px;
		height: 1em;
		width: 3em;
		cursor: col-resize;
		border-radius: 0;
		box-shadow: 0 0 0 0.15em #000;
	}

	::-webkit-slider-runnable-track {
		background: #aaa;
	}

	::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 0.3em;
		height: 1em;
		background: #fff;
		box-shadow: -100em 0 0 100em var(--color);
	}

	::-moz-range-track {
		height: 1em;
		background: #aaa;
	}

	::-moz-range-thumb {
		width: 0.3em;
		height: 1em;
		background: #fff;
		box-shadow: -100em 0 0 100em var(--color);
		border-radius: 0 !important;
	}

	.row {
		display: flex; 
		grid-gap: 5px; 
		align-items: center;
	}

</style>

<div class="overlay">
	<div class="dialog settings">
		<div class="btn icon-btn close-btn">
			<div class="cross"></div>
		</div>
		<div class="dialog-header" stroke="Florrkit v${GM_info.script.version}"></div>
		<div class="dialog-content">
			<div class="row">
				<div stroke="Zoom:"></div>
				<input type="range" class="range zoom" style="flex: 1;" min="1" max="20" step="0.5" value="${nZoom}">
				<div stroke="1x"></div>
			</div>
			<settings></settings>
			<div class="row">
				<div stroke="Hitbox Color:"></div>
				<input type="color" class="colorpicker hitbox-color" value="${GM_getValue('hitboxColor', '#ff0000')}">
			</div>
			<div class="row">
				<div stroke="Hitbox Size:"></div>
				<input type="range" class="range hitbox-size" style="flex: 1;" min="0.5" max="10" step="0.5" value="${hitboxSize}">
				<div stroke="${hitboxSize.toFixed(1)}"></div>
			</div>
			<div class="btn unlock-petals">
				<div stroke="Unlock All Petals"></div>
			</div>
			<div style="display: flex; grid-gap: 4px; justify-content: stretch">
				<div class="btn" data-link="https://discord.gg/JJFh7qzHDR">
					<div stroke="Discord"></div>
				</div>
				<div class="btn" data-link="https://zertalious.xyz">
					<div stroke="Website"></div>
				</div>
			</div>
			<div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
				<div stroke="Created by Zertalious"></div>
			</div>
		</div>
	</div>

	<div class="dialog servers">
		<div class="btn icon-btn close-btn">
			<div class="cross"></div>
		</div>
		<div class="dialog-header" stroke="Servers"></div>
		<div class="dialog-content"></div>
	</div>

	<div class="btns">
		<div class="btn icon-btn servers-btn">${Icons.map}</div>
		<div class="btn icon-btn settings-btn" style="background: #fd6a6a">${Icons.settings}</div>
	</div>
</div>

</div>`);

div.querySelector('.hitbox-size').oninput = function () {
	hitboxSize = parseFloat(this.value);
	GM_setValue('hitboxSize', hitboxSize);
	this.nextElementSibling.setAttribute('stroke', hitboxSize.toFixed(1));
}

const zoomEl = div.querySelector('.zoom');
const zoomValueEl = zoomEl.nextElementSibling;
zoomEl.oninput = function () {
	nZoom = parseFloat(this.value);
	updateZoomValue();
}
updateZoomValue();

function updateZoomValue() {
	zoomValueEl.setAttribute('stroke', nZoom.toFixed(1) + 'x');
}

document.onwheel = function (event) {
	if (settings.scrollZooming) {
		const f = event.deltaY < 0 ? 0.9 : 1.1;
		nZoom *= f;
		nZoom = Math.min(Math.max(0.1, nZoom), 100)
		zoomEl.value = nZoom;
		updateZoomValue();
	}
}

const overlayEl = div.querySelector('.overlay');

const hitboxColorEl = div.querySelector('.hitbox-color');
hitboxColorEl.onchange = function () {
	GM_setValue('hitboxColor', this.value);
}

function updateScale() {
	const scale = Math.max(window.innerWidth / 1500, window.innerHeight / 700) * 1.10;

	Object.assign(overlayEl.style, {
		transformOrigin: '0 0',
		transform: `scale(${scale})`,
		width: window.innerWidth / scale + 'px',
		height: window.innerHeight / scale + 'px'
	});
}

div.querySelector('.unlock-petals').onclick = unlockAllPetals;

function initLinks() {
	const els = div.querySelectorAll('[data-link]');

	for (let i = 0; i < els.length; i++) {
		els[i].onclick = onClick;
	}

	function onClick() {
		window.open(this.getAttribute('data-link'), '_open');
	}
}

function initSettings() {
	const placeholder = div.querySelector('settings');

	for (const key in settings) {
		const el = fromHtml(`<label>
			<input type="checkbox" class="checkbox">
			<span stroke="${fromCamel(key)}"></span>
		</label>`);

		const checkboxEl = el.querySelector('.checkbox');
		settings[key] = GM_getValue(key, settings[key]);

		checkboxEl.checked = settings[key];
		checkboxEl.onchange = function () {
			settings[key] = this.checked;
			GM_setValue(key, settings[key]);
		}

		placeholder.parentNode.insertBefore(el, placeholder);
	}

	placeholder.remove();
}

const dialogs = [];

const settingsBtnEl = div.querySelector('.settings-btn');
new Dialog(
	div.querySelector('.settings'),
	settingsBtnEl
);

function setClass(el, cls, v) {
	el.classList[v ? 'add' : 'remove'](cls);
}

async function initServers() {
	const container = div.querySelector('.servers .dialog-content');

	const mapNames = [
		'Garden',
		'Desert',
		'Ocean',
		'Jungle',
		'Ant Hell',
		'Hel',
		'Sewers',
		'Factory',
		'Pyramid'
	];

	const regions = {
		'vultr-miami': 'NA', 
		'vultr-frankfurt': 'EU', 
		'vultr-tokyo': 'AS'
	};

	container.innerHTML = `<div style="display: flex; align-items: center; grid-gap: 4px; justify-content: center; grid-column: span 2;">
		<div stroke="Region:"></div>
		<select class="big regions">
			<option value="">All</option>
			${Object.values(regions).map(x => `<option value="${x}">${x}</option>`).join('\n')}
		</select>
		<div style="margin-left: auto" stroke="Biome:"></div>
		<select class="big maps">
			<option value="">All</option>
			${mapNames.map(x => `<option value="${x}">${x}</option>`).join('\n')}
		</select>
	</div>`;

	container.querySelector('.regions').onchange = function () {
		for (const el of container.children) {
			if (el.region) {
				setClass(el, 'hidden', this.value && el.region !== this.value);
			}
		}
	}

	container.querySelector('.maps').onchange = function () {
		for (const el of container.children) {
			if (el.map) {
				setClass(el, 'hidden2', this.value && el.map !== this.value);
			}
		}
	}

	for (let i = 0; i < mapNames.length; i++) {
		try {
			const json = await (await fetch(`https://api.n.m28.io/endpoint/florrio-map-${i}-green/findEach/`)).json();
			for (const key in json.servers) {
				const id = json.servers[key].id;
				const region = regions[key];
				const map = mapNames[i]
				const el = fromHtml(`<div class="btn" server="${id}">
					<div stroke="[${region}] [${id}] ${map}"></div>
				</div>`);
				el.region = region;
				el.map = map;
				el.onclick = ServerBtnOnClick;
				container.appendChild(el);
			}

			server && setServerUI(server);
		} catch (error) {
			console.log(error);
		}
	}

	function ServerBtnOnClick() {
		const id = this.getAttribute('server');
		cp6.forceServerID(id);
		setServerUI(id);
	}
}

let server;

function setServerUI(server) {
	const activeEl = serversEl.querySelector('.active');
	if (activeEl) activeEl.classList.remove('active');
	const el = serversEl.querySelector(`[server="${server}"]`);
	el && el.classList.add('active');
}

initServers();

const serversEl = div.querySelector('.servers');
new Dialog(
	serversEl, 
	div.querySelector('.servers-btn')
);

function lerp(start, target, f) {
	if (Math.abs(start - target) < 0.001) return target;
	else return start + (target - start) * f;
}

function Dialog(el, btnEl) {
	let t = 0;
	let visible = false;

	this.update = function () {
		t = lerp(t, visible ? 1 : 0, 0.3);
		el.style.transform = `translateY(${(1 - t) * 150}%)`;
		el.style.opacity = t;
	}

	this.setVisible = function (v) {
		visible = v;
	}

	const closeBtnEl = fromHtml(`<div class="btn icon-btn close-btn">
		<div class="cross"></div>
	</div>`);
	el.appendChild(closeBtnEl)

	closeBtnEl.onclick = function () {
		visible = false;
	}

	btnEl.onclick = () => {
		visible = !visible;
		if (visible) {
			for (const dialog of dialogs) {
				if (dialog !== this) dialog.setVisible(false);
			}
		}
	}

	dialogs.push(this);
}

function Grid(size = 20) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d');

	ctx.lineWidth = size * 0.05;
	ctx.strokeStyle = '#000';
	ctx.globalAlpha = 0.1;

	ctx.beginPath();
	const s = size / 2;
	ctx.moveTo(0, s);
	ctx.lineTo(size, s);
	ctx.moveTo(s, 0);
	ctx.lineTo(s, size);
	ctx.stroke();

	return ctx.createPattern(canvas, 'repeat');
}

function animate() {
	for (const dialog of dialogs) dialog.update();

	craftDisableT = lerp(craftDisableT, 0, 0.2);
	zoom = lerp(zoom, nZoom, 0.1);

	window.requestAnimationFrame(animate);
}

initLinks();
initSettings();

updateScale();
window.addEventListener('resize', updateScale);

animate();

const interval = setInterval(() => {
	if (document.body) {
		clearInterval(interval);

		canvas = document.getElementById('canvas');
		ctx = canvas.getContext('2d');

		canvas.addEventListener('click', () => {
			for (const dialog of dialogs) {
				dialog.setVisible(false);
			}
		});

		const host = fromHtml(`<div style="
			position: absolute;
			left: 0;
			top: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			font-family: Ubuntu;
			color: white;
			font-weight: bolder;
			font-size: 11px;
		"></div>`);

		const shadow = host.attachShadow({ mode: 'closed' });

		while (div.children.length > 0) {
			shadow.appendChild(div.children[0]);
		}

		document.body.appendChild(host);
	}
}, 0);

function fromHtml(html) {
	const div = document.createElement('div');
	div.innerHTML = html;
	return div.children[0];
}

function fromCamel(text){
	const result = text.replace(/([A-Z])/g,' $1');
	return result.charAt(0).toUpperCase() + result.slice(1);
}

// Event.prototype.preventDefault = function () {}
// localStorage.florrio_tutorial = 'complete';

// maybe use in future
function Pointer(address) {
	this.u8 = (offset = 0) => new Pointer(Module.HEAPU8[address + offset]);
	this.u32 = (offset = 0) => new Pointer(Module.HEAPU32[(address + offset) >> 2]);
	this.f32 = (offset = 0) => new Pointer(Module.HEAPF32[(address + offset) >> 2]);
	this.f64 = (offset = 0) => new Pointer(Module.HEAPF64[(address + offset) >> 3]);
}