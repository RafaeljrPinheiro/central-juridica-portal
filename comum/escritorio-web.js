// Escritório no navegador (Portal da advogada): o MESMO formato de escritorio.mjs, sem nada do Node.
// - scrypt (N do escritório, r=8, p=1, 32 bytes) sobre a senha do escritório em NFC → chave AES-256-GCM.
// - cifra = base64( iv[12] | tag[16] | dados ), com AAD "coleção:id" (amarra a cifra ao registro).
// O WebCrypto do navegador faz PBKDF2 e AES-GCM, mas não faz scrypt: o scrypt está aqui, em JavaScript puro
// (RFC 7914), conferido contra o crypto.scryptSync do Node em comum/teste.mjs (central-app).
// Funciona igual no navegador e no Node (globalThis.crypto.subtle).

const sutil = () => globalThis.crypto.subtle
const b64 = {
	para: (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s) },
	de: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
}
export { b64 }

/* ---------- scrypt (RFC 7914) ---------- */
function salsa208(B) {
	// B: Uint32Array(16), alterado no lugar
	const x = B.slice()
	const R = (a, b) => (a << b) | (a >>> (32 - b))
	for (let i = 0; i < 8; i += 2) {
		x[4] ^= R(x[0] + x[12], 7); x[8] ^= R(x[4] + x[0], 9); x[12] ^= R(x[8] + x[4], 13); x[0] ^= R(x[12] + x[8], 18)
		x[9] ^= R(x[5] + x[1], 7); x[13] ^= R(x[9] + x[5], 9); x[1] ^= R(x[13] + x[9], 13); x[5] ^= R(x[1] + x[13], 18)
		x[14] ^= R(x[10] + x[6], 7); x[2] ^= R(x[14] + x[10], 9); x[6] ^= R(x[2] + x[14], 13); x[10] ^= R(x[6] + x[2], 18)
		x[3] ^= R(x[15] + x[11], 7); x[7] ^= R(x[3] + x[15], 9); x[11] ^= R(x[7] + x[3], 13); x[15] ^= R(x[11] + x[7], 18)
		x[1] ^= R(x[0] + x[3], 7); x[2] ^= R(x[1] + x[0], 9); x[3] ^= R(x[2] + x[1], 13); x[0] ^= R(x[3] + x[2], 18)
		x[6] ^= R(x[5] + x[4], 7); x[7] ^= R(x[6] + x[5], 9); x[4] ^= R(x[7] + x[6], 13); x[5] ^= R(x[4] + x[7], 18)
		x[11] ^= R(x[10] + x[9], 7); x[8] ^= R(x[11] + x[10], 9); x[9] ^= R(x[8] + x[11], 13); x[10] ^= R(x[9] + x[8], 18)
		x[12] ^= R(x[15] + x[14], 7); x[13] ^= R(x[12] + x[15], 9); x[14] ^= R(x[13] + x[12], 13); x[15] ^= R(x[14] + x[13], 18)
	}
	for (let i = 0; i < 16; i++) B[i] = (B[i] + x[i]) | 0
}
function blockMix(B, Y, r) {
	// B: Uint32Array(32r) → B (via Y)
	const X = B.slice(32 * r - 16, 32 * r)
	for (let i = 0; i < 2 * r; i++) {
		for (let j = 0; j < 16; j++) X[j] ^= B[16 * i + j]
		salsa208(X)
		Y.set(X, 16 * i)
	}
	for (let i = 0; i < r; i++) B.set(Y.subarray(32 * i, 32 * i + 16), 16 * i)
	for (let i = 0; i < r; i++) B.set(Y.subarray(32 * i + 16, 32 * i + 32), 16 * (i + r))
}
function roMix(blocoBytes, N, r) {
	const n32 = 32 * r
	const X = new Uint32Array(n32)
	const dv = new DataView(blocoBytes.buffer, blocoBytes.byteOffset, blocoBytes.byteLength)
	for (let i = 0; i < n32; i++) X[i] = dv.getUint32(i * 4, true)
	const V = new Uint32Array(n32 * N), Y = new Uint32Array(n32)
	for (let i = 0; i < N; i++) { V.set(X, i * n32); blockMix(X, Y, r) }
	for (let i = 0; i < N; i++) {
		const j = X[n32 - 16] & (N - 1)
		for (let k = 0; k < n32; k++) X[k] ^= V[j * n32 + k]
		blockMix(X, Y, r)
	}
	for (let i = 0; i < n32; i++) dv.setUint32(i * 4, X[i], true)
}
async function pbkdf2(senhaBytes, sal, bytes) {
	const k = await sutil().importKey('raw', senhaBytes, 'PBKDF2', false, ['deriveBits'])
	return new Uint8Array(await sutil().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 1 }, k, bytes * 8))
}
export async function scrypt(senha, sal, { N = 2 ** 15, r = 8, p = 1, tamanho = 32 } = {}) {
	const senhaBytes = new TextEncoder().encode(String(senha).normalize('NFC'))
	const B = await pbkdf2(senhaBytes, sal, p * 128 * r)
	for (let i = 0; i < p; i++) roMix(B.subarray(i * 128 * r, (i + 1) * 128 * r), N, r)
	return pbkdf2(senhaBytes, B, tamanho)
}

/* ---------- chave e cifra do escritório ---------- */
// config: { sal (base64), kdfN?, verificador } — o registro "config" do escritório (não é segredo).
// Devolve a chave AES (CryptoKey, não exportável) se a senha conferir com o verificador; senão, erro.
export async function abrirEscritorio(config, senha) {
	const bruta = await scrypt(senha, b64.de(config.sal), { N: config.kdfN || 2 ** 15 })
	const chave = await sutil().importKey('raw', bruta, 'AES-GCM', false, ['encrypt', 'decrypt'])
	try { await decifrar(chave, config.verificador, 'config') } catch { throw new Error('Senha do escritório incorreta.') }
	return chave
}
export async function decifrar(chave, cifra, contexto) {
	const b = b64.de(cifra)
	const iv = b.subarray(0, 12), tag = b.subarray(12, 28), dados = b.subarray(28)
	const junto = new Uint8Array(dados.length + 16); junto.set(dados); junto.set(tag, dados.length) // WebCrypto: dados | tag
	const claro = await sutil().decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(contexto) }, chave, junto)
	return JSON.parse(new TextDecoder().decode(claro))
}
// Arquivos (foto, documento, peça): mesmos bytes de escritorio.mjs cifrarArquivo — iv[12] | tag[16] | dados.
export async function cifrarBytes(chave, bytes, contexto) {
	const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
	const sai = new Uint8Array(await sutil().encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(contexto) }, chave, bytes))
	const b = new Uint8Array(sai.length + 12); b.set(iv); b.set(sai.subarray(sai.length - 16), 12); b.set(sai.subarray(0, sai.length - 16), 28)
	return b
}
export async function decifrarBytes(chave, b, contexto) {
	const iv = b.subarray(0, 12), tag = b.subarray(12, 28), dados = b.subarray(28)
	const junto = new Uint8Array(dados.length + 16); junto.set(dados); junto.set(tag, dados.length)
	return new Uint8Array(await sutil().decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(contexto) }, chave, junto))
}
export async function cifrar(chave, obj, contexto) {
	const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
	const sai = new Uint8Array(await sutil().encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(contexto) }, chave, new TextEncoder().encode(JSON.stringify(obj))))
	const dados = sai.subarray(0, sai.length - 16), tag = sai.subarray(sai.length - 16)
	const b = new Uint8Array(12 + 16 + dados.length); b.set(iv); b.set(tag, 12); b.set(dados, 28) // escritorio.mjs: iv | tag | dados
	return b64.para(b)
}
