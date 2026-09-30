// Generated klu-js 0.1.0 wasm-bindgen glue, LGPL-2.1-or-later; see licenses/klu-js-LICENSE.
let wasm_bindgen = (function(exports) {
    let script_src;
    if (typeof document !== 'undefined' && document.currentScript !== null) {
        script_src = new URL(document.currentScript.src, location.href).toString();
    }

    /**
     * KLU's mutable control and statistics object.
     *
     * Create one with [`klu_defaults`]. KLU updates its status and statistics while
     * analyzing, factoring, solving, and refactoring a matrix.
     */
    class KluCommon {
        static __wrap(ptr) {
            const obj = Object.create(KluCommon.prototype);
            obj.__wbg_ptr = ptr;
            KluCommonFinalization.register(obj, obj.__wbg_ptr, obj);
            return obj;
        }
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            KluCommonFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_klucommon_free(ptr, 0);
        }
        /**
         * @returns {number}
         */
        get btf() {
            const ret = wasm.klucommon_btf(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get condest() {
            const ret = wasm.klucommon_condest(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get flops() {
            const ret = wasm.klucommon_flops(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get halt_if_singular() {
            const ret = wasm.klucommon_halt_if_singular(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get initmem() {
            const ret = wasm.klucommon_initmem(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get initmem_amd() {
            const ret = wasm.klucommon_initmem_amd(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get maxwork() {
            const ret = wasm.klucommon_maxwork(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get memgrow() {
            const ret = wasm.klucommon_memgrow(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get mempeak() {
            const ret = wasm.klucommon_mempeak(this.__wbg_ptr);
            return ret >>> 0;
        }
        /**
         * @returns {number}
         */
        get memusage() {
            const ret = wasm.klucommon_memusage(this.__wbg_ptr);
            return ret >>> 0;
        }
        /**
         * Create a KLU common object initialized with the library defaults.
         */
        constructor() {
            const ret = wasm.klucommon_new();
            this.__wbg_ptr = ret;
            KluCommonFinalization.register(this, this.__wbg_ptr, this);
            return this;
        }
        /**
         * @returns {number}
         */
        get noffdiag() {
            const ret = wasm.klucommon_noffdiag(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get numerical_rank() {
            const ret = wasm.klucommon_numerical_rank(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get ordering() {
            const ret = wasm.klucommon_ordering(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get rcond() {
            const ret = wasm.klucommon_rcond(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get rgrowth() {
            const ret = wasm.klucommon_rgrowth(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get scale() {
            const ret = wasm.klucommon_scale(this.__wbg_ptr);
            return ret;
        }
        /**
         * @param {number} value
         */
        set btf(value) {
            wasm.klucommon_set_btf(this.__wbg_ptr, value);
        }
        /**
         * @param {number} value
         */
        set halt_if_singular(value) {
            wasm.klucommon_set_halt_if_singular(this.__wbg_ptr, value);
        }
        /**
         * @param {number} value
         */
        set initmem(value) {
            wasm.klucommon_set_initmem(this.__wbg_ptr, value);
        }
        /**
         * @param {number} value
         */
        set initmem_amd(value) {
            wasm.klucommon_set_initmem_amd(this.__wbg_ptr, value);
        }
        /**
         * @param {number} value
         */
        set maxwork(value) {
            wasm.klucommon_set_maxwork(this.__wbg_ptr, value);
        }
        /**
         * @param {number} value
         */
        set memgrow(value) {
            wasm.klucommon_set_memgrow(this.__wbg_ptr, value);
        }
        /**
         * @param {number} value
         */
        set ordering(value) {
            wasm.klucommon_set_ordering(this.__wbg_ptr, value);
        }
        /**
         * @param {number} value
         */
        set scale(value) {
            wasm.klucommon_set_scale(this.__wbg_ptr, value);
        }
        /**
         * @param {number} value
         */
        set tol(value) {
            wasm.klucommon_set_tol(this.__wbg_ptr, value);
        }
        /**
         * @returns {number}
         */
        get singular_col() {
            const ret = wasm.klucommon_singular_col(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get status() {
            const ret = wasm.klucommon_status(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get structural_rank() {
            const ret = wasm.klucommon_structural_rank(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get tol() {
            const ret = wasm.klucommon_tol(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get work() {
            const ret = wasm.klucommon_work(this.__wbg_ptr);
            return ret;
        }
    }
    if (Symbol.dispose) KluCommon.prototype[Symbol.dispose] = KluCommon.prototype.free;
    exports.KluCommon = KluCommon;

    /**
     * An opaque result of `klu_factor`.
     */
    class KluNumeric {
        static __wrap(ptr) {
            const obj = Object.create(KluNumeric.prototype);
            obj.__wbg_ptr = ptr;
            KluNumericFinalization.register(obj, obj.__wbg_ptr, obj);
            return obj;
        }
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            KluNumericFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_klunumeric_free(ptr, 0);
        }
    }
    if (Symbol.dispose) KluNumeric.prototype[Symbol.dispose] = KluNumeric.prototype.free;
    exports.KluNumeric = KluNumeric;

    /**
     * An opaque result of `klu_analyze`.
     */
    class KluSymbolic {
        static __wrap(ptr) {
            const obj = Object.create(KluSymbolic.prototype);
            obj.__wbg_ptr = ptr;
            KluSymbolicFinalization.register(obj, obj.__wbg_ptr, obj);
            return obj;
        }
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            KluSymbolicFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_klusymbolic_free(ptr, 0);
        }
    }
    if (Symbol.dispose) KluSymbolic.prototype[Symbol.dispose] = KluSymbolic.prototype.free;
    exports.KluSymbolic = KluSymbolic;

    /**
     * Analyze a sparse matrix in compressed-column form.
     * @param {number} n
     * @param {Int32Array} ap
     * @param {Int32Array} ai
     * @param {KluCommon} common
     * @returns {KluSymbolic}
     */
    function klu_analyze(n, ap, ai, common) {
        const ptr0 = passArray32ToWasm0(ap, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray32ToWasm0(ai, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        _assertClass(common, KluCommon);
        const ret = wasm.klu_analyze(n, ptr0, len0, ptr1, len1, common.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return KluSymbolic.__wrap(ret[0]);
    }
    exports.klu_analyze = klu_analyze;

    /**
     * Create a KLU common object with the library defaults.
     * @returns {KluCommon}
     */
    function klu_defaults() {
        const ret = wasm.klu_defaults();
        return KluCommon.__wrap(ret);
    }
    exports.klu_defaults = klu_defaults;

    /**
     * Factor a sparse matrix using the result of `klu_analyze`.
     * @param {Int32Array} ap
     * @param {Int32Array} ai
     * @param {Float64Array} ax
     * @param {KluSymbolic} symbolic
     * @param {KluCommon} common
     * @returns {KluNumeric}
     */
    function klu_factor(ap, ai, ax, symbolic, common) {
        const ptr0 = passArray32ToWasm0(ap, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray32ToWasm0(ai, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF64ToWasm0(ax, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        _assertClass(symbolic, KluSymbolic);
        _assertClass(common, KluCommon);
        const ret = wasm.klu_factor(ptr0, len0, ptr1, len1, ptr2, len2, symbolic.__wbg_ptr, common.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return KluNumeric.__wrap(ret[0]);
    }
    exports.klu_factor = klu_factor;

    /**
     * Free a numeric factorization. The handle can no longer be used afterward.
     * @param {KluNumeric} numeric
     * @param {KluCommon} common
     * @returns {number}
     */
    function klu_free_numeric(numeric, common) {
        _assertClass(numeric, KluNumeric);
        _assertClass(common, KluCommon);
        const ret = wasm.klu_free_numeric(numeric.__wbg_ptr, common.__wbg_ptr);
        return ret;
    }
    exports.klu_free_numeric = klu_free_numeric;

    /**
     * Free a symbolic analysis. The handle can no longer be used afterward.
     * @param {KluSymbolic} symbolic
     * @param {KluCommon} common
     * @returns {number}
     */
    function klu_free_symbolic(symbolic, common) {
        _assertClass(symbolic, KluSymbolic);
        _assertClass(common, KluCommon);
        const ret = wasm.klu_free_symbolic(symbolic.__wbg_ptr, common.__wbg_ptr);
        return ret;
    }
    exports.klu_free_symbolic = klu_free_symbolic;

    /**
     * Refactor a matrix using an existing symbolic analysis and numeric object.
     * @param {Int32Array} ap
     * @param {Int32Array} ai
     * @param {Float64Array} ax
     * @param {KluSymbolic} symbolic
     * @param {KluNumeric} numeric
     * @param {KluCommon} common
     * @returns {number}
     */
    function klu_refactor(ap, ai, ax, symbolic, numeric, common) {
        const ptr0 = passArray32ToWasm0(ap, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray32ToWasm0(ai, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF64ToWasm0(ax, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        _assertClass(symbolic, KluSymbolic);
        _assertClass(numeric, KluNumeric);
        _assertClass(common, KluCommon);
        const ret = wasm.klu_refactor(ptr0, len0, ptr1, len1, ptr2, len2, symbolic.__wbg_ptr, numeric.__wbg_ptr, common.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0];
    }
    exports.klu_refactor = klu_refactor;

    /**
     * Solve `A * X = B` in place. `B` is column-major with `ldim` rows per RHS.
     * @param {KluSymbolic} symbolic
     * @param {KluNumeric} numeric
     * @param {number} ldim
     * @param {number} nrhs
     * @param {Float64Array} b
     * @param {KluCommon} common
     * @returns {number}
     */
    function klu_solve(symbolic, numeric, ldim, nrhs, b, common) {
        _assertClass(symbolic, KluSymbolic);
        _assertClass(numeric, KluNumeric);
        var ptr0 = passArrayF64ToWasm0(b, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        _assertClass(common, KluCommon);
        const ret = wasm.klu_solve(symbolic.__wbg_ptr, numeric.__wbg_ptr, ldim, nrhs, ptr0, len0, b, common.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0];
    }
    exports.klu_solve = klu_solve;

    /**
     * Solve `transpose(A) * X = B` in place. `B` is column-major.
     * @param {KluSymbolic} symbolic
     * @param {KluNumeric} numeric
     * @param {number} ldim
     * @param {number} nrhs
     * @param {Float64Array} b
     * @param {KluCommon} common
     * @returns {number}
     */
    function klu_tsolve(symbolic, numeric, ldim, nrhs, b, common) {
        _assertClass(symbolic, KluSymbolic);
        _assertClass(numeric, KluNumeric);
        var ptr0 = passArrayF64ToWasm0(b, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        _assertClass(common, KluCommon);
        const ret = wasm.klu_tsolve(symbolic.__wbg_ptr, numeric.__wbg_ptr, ldim, nrhs, ptr0, len0, b, common.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0];
    }
    exports.klu_tsolve = klu_tsolve;

    function set_panic_hook() {
        wasm.set_panic_hook();
    }
    exports.set_panic_hook = set_panic_hook;

    function start() {
        wasm.start();
    }
    exports.start = start;
    function __wbg_get_imports() {
        const import0 = {
            __proto__: null,
            __wbg___wbindgen_copy_to_typed_array_4db0cbe2cc60dbee: function(arg0, arg1, arg2) {
                new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
            },
            __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
                throw new Error(getStringFromWasm0(arg0, arg1));
            },
            __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
                let deferred0_0;
                let deferred0_1;
                try {
                    deferred0_0 = arg0;
                    deferred0_1 = arg1;
                    console.error(getStringFromWasm0(arg0, arg1));
                } finally {
                    wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
                }
            },
            __wbg_new_227d7c05414eb861: function() {
                const ret = new Error();
                return ret;
            },
            __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
                const ret = arg1.stack;
                const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
                const len1 = WASM_VECTOR_LEN;
                getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
                getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
            },
            __wbindgen_cast_0000000000000001: function(arg0, arg1) {
                // Cast intrinsic for `Ref(String) -> Externref`.
                const ret = getStringFromWasm0(arg0, arg1);
                return ret;
            },
            __wbindgen_init_externref_table: function() {
                const table = wasm.__wbindgen_externrefs;
                const offset = table.grow(4);
                table.set(0, undefined);
                table.set(offset + 0, undefined);
                table.set(offset + 1, null);
                table.set(offset + 2, true);
                table.set(offset + 3, false);
            },
        };
        return {
            __proto__: null,
            "./klu_js_bg.js": import0,
        };
    }

    const KluCommonFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_klucommon_free(ptr, 1));
    const KluNumericFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_klunumeric_free(ptr, 1));
    const KluSymbolicFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_klusymbolic_free(ptr, 1));

    function _assertClass(instance, klass) {
        if (!(instance instanceof klass)) {
            throw new Error(`expected instance of ${klass.name}`);
        }
    }

    function getArrayU8FromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
    }

    let cachedDataViewMemory0 = null;
    function getDataViewMemory0() {
        if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
            cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
        }
        return cachedDataViewMemory0;
    }

    let cachedFloat64ArrayMemory0 = null;
    function getFloat64ArrayMemory0() {
        if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
            cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
        }
        return cachedFloat64ArrayMemory0;
    }

    function getStringFromWasm0(ptr, len) {
        return decodeText(ptr >>> 0, len);
    }

    let cachedUint32ArrayMemory0 = null;
    function getUint32ArrayMemory0() {
        if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
            cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
        }
        return cachedUint32ArrayMemory0;
    }

    let cachedUint8ArrayMemory0 = null;
    function getUint8ArrayMemory0() {
        if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
            cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
        }
        return cachedUint8ArrayMemory0;
    }

    function passArray32ToWasm0(arg, malloc) {
        const ptr = malloc(arg.length * 4, 4) >>> 0;
        getUint32ArrayMemory0().set(arg, ptr / 4);
        WASM_VECTOR_LEN = arg.length;
        return ptr;
    }

    function passArrayF64ToWasm0(arg, malloc) {
        const ptr = malloc(arg.length * 8, 8) >>> 0;
        getFloat64ArrayMemory0().set(arg, ptr / 8);
        WASM_VECTOR_LEN = arg.length;
        return ptr;
    }

    function passStringToWasm0(arg, malloc, realloc) {
        if (realloc === undefined) {
            const buf = cachedTextEncoder.encode(arg);
            const ptr = malloc(buf.length, 1) >>> 0;
            getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
            WASM_VECTOR_LEN = buf.length;
            return ptr;
        }

        let len = arg.length;
        let ptr = malloc(len, 1) >>> 0;

        const mem = getUint8ArrayMemory0();

        let offset = 0;

        for (; offset < len; offset++) {
            const code = arg.charCodeAt(offset);
            if (code > 0x7F) break;
            mem[ptr + offset] = code;
        }
        if (offset !== len) {
            if (offset !== 0) {
                arg = arg.slice(offset);
            }
            ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
            const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
            const ret = cachedTextEncoder.encodeInto(arg, view);

            offset += ret.written;
            ptr = realloc(ptr, len, offset, 1) >>> 0;
        }

        WASM_VECTOR_LEN = offset;
        return ptr;
    }

    function takeFromExternrefTable0(idx) {
        const value = wasm.__wbindgen_externrefs.get(idx);
        wasm.__externref_table_dealloc(idx);
        return value;
    }

    let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    function decodeText(ptr, len) {
        return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
    }

    const cachedTextEncoder = new TextEncoder();

    if (!('encodeInto' in cachedTextEncoder)) {
        cachedTextEncoder.encodeInto = function (arg, view) {
            const buf = cachedTextEncoder.encode(arg);
            view.set(buf);
            return {
                read: arg.length,
                written: buf.length
            };
        };
    }

    let WASM_VECTOR_LEN = 0;

    let wasmModule, wasmInstance, wasm;
    function __wbg_finalize_init(instance, module) {
        wasmInstance = instance;
        wasm = instance.exports;
        wasmModule = module;
        cachedDataViewMemory0 = null;
        cachedFloat64ArrayMemory0 = null;
        cachedUint32ArrayMemory0 = null;
        cachedUint8ArrayMemory0 = null;
        wasm.__wbindgen_start();
        return wasm;
    }

    async function __wbg_load(module, imports) {
        if (typeof Response === 'function' && module instanceof Response) {
            if (typeof WebAssembly.instantiateStreaming === 'function') {
                try {
                    return await WebAssembly.instantiateStreaming(module, imports);
                } catch (e) {
                    const validResponse = module.ok && expectedResponseType(module.type);

                    if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                        console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                    } else { throw e; }
                }
            }

            const bytes = await module.arrayBuffer();
            return await WebAssembly.instantiate(bytes, imports);
        } else {
            const instance = await WebAssembly.instantiate(module, imports);

            if (instance instanceof WebAssembly.Instance) {
                return { instance, module };
            } else {
                return instance;
            }
        }

        function expectedResponseType(type) {
            switch (type) {
                case 'basic': case 'cors': case 'default': return true;
            }
            return false;
        }
    }

    function initSync(module) {
        if (wasm !== undefined) return wasm;


        if (module !== undefined) {
            if (Object.getPrototypeOf(module) === Object.prototype) {
                ({module} = module)
            } else {
                console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
            }
        }

        const imports = __wbg_get_imports();
        if (!(module instanceof WebAssembly.Module)) {
            module = new WebAssembly.Module(module);
        }
        const instance = new WebAssembly.Instance(module, imports);
        return __wbg_finalize_init(instance, module);
    }

    async function __wbg_init(module_or_path) {
        if (wasm !== undefined) return wasm;


        if (module_or_path !== undefined) {
            if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
                ({module_or_path} = module_or_path)
            } else {
                console.warn('using deprecated parameters for the initialization function; pass a single object instead')
            }
        }

        if (module_or_path === undefined && script_src !== undefined) {
            module_or_path = script_src.replace(/\.js$/, "_bg.wasm");
        }
        const imports = __wbg_get_imports();

        if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
            module_or_path = fetch(module_or_path);
        }

        const { instance, module } = await __wbg_load(await module_or_path, imports);

        return __wbg_finalize_init(instance, module);
    }

    return Object.assign(__wbg_init, { initSync }, exports);
})({ __proto__: null });

export default wasm_bindgen;
