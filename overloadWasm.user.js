// ==UserScript==
// @name         florr wasm overload
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  sex
// @author       zertalious
// @match        https://florr.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=florr.io
// @run-at       document-start
// ==/UserScript==

HTMLElement.prototype.insertBefore = new Proxy(HTMLElement.prototype.insertBefore, {
	apply(target, thisArgs, args) {
		if (args[0].src && args[0].src.indexOf('client.js') > -1) {
			Module.locateFile = () => {
				return 'http://localhost:5000/wasm'
			}
		}
		return Reflect.apply(...arguments);
	}
});