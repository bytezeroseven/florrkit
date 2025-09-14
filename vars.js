import fs from 'fs';
import { execSync } from 'child_process';

const WasmVars = {};

function editWat(wat) {
	function toRegex(x) {
		return new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('<PARAM>', '(.+)').replaceAll('<ANY>', '.+'))
	}

	function find(x, keys) {
		const matches = toRegex(x).exec(wat);
		if (!matches) throw new Error('not found: ' + keys);

		for (let i = 1; i < matches.length; i++) {
			const key = keys[i - 1];
			let value = matches[i];
			const n = parseFloat(value);
			if (!isNaN(n)) value = n;
			WasmVars[key] = value;
		}
	}

	function replace(search, content, name = 'x') {
		const re = toRegex(search)
		const match = wat.match(re);
		if (!match) throw new Error(`replace search not found: ${name}`);

		console.log(name + '\n' + match[0]);
		wat = wat.replace(re, content.replace(/<PARAM_([0-9]+)>/g, '#$1').replaceAll('#', '$'));
	}

	// find vars

	find(`local.tee <ANY>
                      i32.load offset=<PARAM>
                      local.set <ANY>
                      local.get <ANY>
                      f64.load offset=<ANY>
                      local.set <ANY>
                      local.get <ANY>
                      i32.load offset=<PARAM>`, ['object', 'pos']);

	find(`local.get <ANY>
                        f64.load offset=<PARAM>
                        local.set <ANY>
                        local.get <ANY>
                        f64.load offset=<PARAM>`, ['yValue', 'xValue']);

	find(`end
                            call <ANY>
                            local.set <ANY>
                            local.get <ANY>
                            f32.load offset=<PARAM>`, ['sizeValue'])

	find(`i32.load offset=<PARAM>
      local.tee <ANY>
      i32.eqz
      if $I26
        br $B1
      end
      local.get <ANY>
      i32.load8_u offset=<PARAM>`, ['playerRarity', 'playerRarityValue'])

	find(`local.get <ANY>
                        i32.load
                        i32.load
                        i32.load offset=<PARAM>`, ['petalRarity']);

	find(`drop
                        local.get <ANY>
                        i32.load8_u offset=<PARAM>
                        local.set <ANY>`, ['petalRarityValue'])

	find(`i32.const 2
                i32.shl
                i32.add
                i32.load
                i32.load
                local.tee <ANY>
                local.get <ANY>
                i32.load offset=<ANY>
                i32.eq
                br_if <ANY>
                local.get <ANY>
                i32.load offset=<PARAM>
                local.tee <ANY>
                i32.load8_u offset=<PARAM>`, ['healthBar', 'healthBarTextCount']);

	find(`end
                    local.get <ANY>
                    local.get <PARAM>
                    local.get <ANY>
                    i32.const 255`, ['worldVar']);

	/*find(`block <ANY
              local.get <ANY>
              i32.load offset=<ANY>
              local.tee <ANY>
              i32.load offset=<PARAM>
              local.tee <ANY>
              if <ANY>
                local.get <ANY>
                i32.load8_u offset=<PARAM>
                i32.const 2`, ['isDead', 'isDeadValue']);*/

	find(`i32.const 8
      i32.shr_u
      i32.add
      i32.const 2
      i32.shl
      i32.const <PARAM>`, ['inventoryAddress']);

	find(`end
      local.get $l2
      f32.const 0x0p+0 (;=0;)
      i32.const <PARAM>`, ['rotSpeedAddress']);

	// edit wasm

	replace(`  (func `, `

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
  
  (func `, 'imports');

	replace('(local $l53 i64)\n', `(local $l53 i64) (local $entity i32)\n`, 'params');

	replace(`i32.load
                else
                  local.get <PARAM>
                end
                local.get `, `i32.load
                else
                  local.get <PARAM_1>
                end
                
                local.tee $entity

                local.get `, 'entity value');

	replace(`f64.load offset=32
                f32.demote_f64
                call <PARAM>`, `f64.load offset=32
                f32.demote_f64
                call <PARAM_1>

                local.get ${WasmVars.worldVar}
                local.get $entity
                local.get $l12
                call $drawCircle`, 'draw hitbox');

	replace(`i32.load8_u offset=<PARAM>
                      i32.const 7`, `i32.load8_u offset=<PARAM_1>
                      
                      call $getParticleMinRarity`, 'particle min rarity');

	replace(`i32.const 8
                      i32.shl
                      i32.const 1792
                      i32.eq`, `i32.const 8
                      i32.shl
                      i32.const 1792
                      i32.eq

                      i32.const 1
                      call $showUniqueParticles
                      select`, 'particle color');

	replace(`block <PARAM>
                  block <PARAM>
                    i32.const <PARAM>
                    i32.load8_u
                    i32.eqz
                    br_if`, `block <PARAM_1>
                  block <PARAM_2>
                    i32.const <PARAM_3>
                    i32.load8_u

                    call $alwaysShowPetalRarity
                    i32.xor

                    i32.eqz
                    br_if`, 'show petal rarity');

	replace(`local.get <PARAM>
                local.get <PARAM>
                local.get <PARAM>
                f64.load offset=32
                call <PARAM>`, `local.get <PARAM_1>
                call $startCapturingText

                local.get <PARAM_1>
                local.get <PARAM_2>
                local.get <PARAM_3>
                f64.load offset=32
                call <PARAM_4>
                
                call $stopCapturingText`, 'health bar');

	replace(`block $B8
      block $B9
        block $B10
          local.get <ANY>
          i32.load offset=<ANY>`, `block $B8
      block $B9
        block $B10
          br 0`, 'disable object cull');

	replace(`i32.sub
      local.set $l8
      loop $L450
        block $B451`, `i32.sub
      local.set $l8
      loop $L450
        block $B451
          call $hideChatBubble
          br_if 0`, 'bubbles');

	wat = wat.replaceAll('f32.const 0x1.ep+10 (;=1920;)', 'call $getViewWidth')
		.replaceAll('f32.const 0x1.0ep+10 (;=1080;)', 'call $getViewHeight');

	console.log(WasmVars);

	return wat;
}

let wat = fs.readFileSync('bin/client.wat', { encoding: 'utf8' });
wat = editWat(wat);

fs.writeFileSync('bin/test.wat', wat);
execSync('wat2wasm bin/test.wat -o bin/test.wasm');
fs.rmSync('bin/test.wat')
fs.rmSync('bin/test.wasm');

console.log('Test passed!');