// Áudio do atendimento gravado no celular: μ-law (G.711), 8 bits por amostra em vez de 16. O arquivo cai pela
// metade (30 min a 16 kHz ≈ 29 MB) e a fala continua clara para o transcritor. Usado no navegador e no Node.
const BIAS = 0x84, CLIP = 32635

export function codificar(pcm16) {
	const out = new Uint8Array(pcm16.length)
	for (let i = 0; i < pcm16.length; i++) {
		let s = pcm16[i]
		const sinal = s < 0 ? 0x80 : 0
		if (sinal) s = -s
		if (s > CLIP) s = CLIP
		s += BIAS
		let exp = 7
		for (let mascara = 0x4000; (s & mascara) === 0 && exp > 0; exp--, mascara >>= 1);
		out[i] = ~(sinal | (exp << 4) | ((s >> (exp + 3)) & 0x0f)) & 0xff
	}
	return out
}

// Devolve PCM de 16 bits (little-endian), o formato que a Central já transcreve.
export function decodificar(bytes) {
	const out = new Int16Array(bytes.length)
	for (let i = 0; i < bytes.length; i++) {
		const u = ~bytes[i] & 0xff
		const exp = (u >> 4) & 7
		const s = ((((u & 0x0f) << 3) + BIAS) << exp) - BIAS
		out[i] = u & 0x80 ? -s : s
	}
	return out
}
