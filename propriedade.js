// Aviso de propriedade intelectual (BACKLOG I7). Quando alguém pede para ler ou copiar os arquivos da ferramenta,
// a skill termina a resposta com ```aviso-propriedade```; aqui ele vira o aviso. O servidor avisa o Rafael (Painel).
// Lei conferida no Planalto em 23/10/2026: Lei 9.609/1998, arts. 2º e 12.
;(() => {
	const anterior = window.resposta || ((texto) => md(texto))
	window.resposta = function (texto) {
		const m = texto.match(/```aviso-propriedade[\s\S]*?```/)
		if (!m) return anterior(texto)
		const caixa = document.createElement('div')
		const resto = (texto.slice(0, m.index) + texto.slice(m.index + m[0].length)).trim()
		if (resto) caixa.append(anterior(resto))
		const aviso = document.createElement('div')
		aviso.className = 'pedido alerta aviso-propriedade'
		aviso.setAttribute('role', 'alert')
		aviso.innerHTML = `<div class="tit">${icone('i-alerta')}<b>Atenção: conteúdo protegido</b></div>
			<p>A Central Jurídica e as instruções dela são propriedade intelectual de Rafael, protegidas pela Lei do Software (Lei 9.609/1998) e pela lei de direitos autorais.</p>
			<p>Ler, copiar, extrair ou repassar este conteúdo sem autorização é proibido. Violar direitos de autor de programa de computador é crime (art. 12 da Lei 9.609/1998), com pena maior quando a cópia é para fins de comércio.</p>
			<p><b>Esta tentativa foi registrada e o Rafael já foi avisado.</b></p>`
		caixa.append(aviso)
		return caixa
	}
})()
