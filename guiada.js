// Orientação em consultas externas: consulta guiada (eproc, PJe, portais com CAPTCHA), aviso antes de abrir
// links que pedem certificado e "Sites consultados" no fim da resposta. Depende de app.js.

// Sistemas que pedem login da advogada; as consultas públicas não pedem.
const PEDE_LOGIN = /(^|\.)(pje\d?g?|eproc\d?g?|esaj|projudi)[\w-]*\.[\w.-]*jus\.br$/i
function pedeLogin(url) {
	try {
		const h = new URL(url).hostname
		return PEDE_LOGIN.test(h) && !/consulta-?publica/i.test(h + new URL(url).pathname)
	} catch { return false }
}

// Abre um link no navegador dela; se for de sistema com login, avisa antes.
function abrirLink(url) {
	if (!pedeLogin(url)) return api('link', { url }).catch((e) => aviso(e.message))
	const d = $('#d-link')
	$('#link-texto').textContent = `Este link abre ${new URL(url).hostname}, que pede seu login com certificado digital (e, no eproc, o código de dois fatores). Ele abre no seu navegador, fora da Central Jurídica.`
	$('#link-abrir').onclick = () => { d.close(); api('link', { url }).catch((e) => aviso(e.message)) }
	d.showModal()
}

/* ---------- consulta guiada ---------- */
function cartaoConsulta(t, ev) {
	fecharBloco(t)
	const d = document.createElement('div')
	d.className = 'msg ela'
	d.innerHTML = '<div class="autor">Central Jurídica</div>'
	const c = document.createElement('div')
	c.className = 'pedido consulta'
	c.innerHTML = `<div class="tit">${icone('i-chave')}Preciso da sua ajuda para consultar: ${escapar(ev.sistema || 'um sistema judicial')}</div>
		<div class="det">${escapar(ev.motivo || '')}</div>
		${ev.pede_certificado ? '<div class="consulta-aviso">Vai pedir seu login com certificado digital (no eproc, também o código de dois fatores). Eu não vejo nem guardo esses dados.</div>' : ''}
		<ol class="consulta-passos">${(ev.passos || []).map((p) => `<li>${escapar(p)}</li>`).join('')}</ol>
		${ev.termo ? `<div class="consulta-termo"><span>Para digitar ou colar no sistema:</span> <code>${escapar(ev.termo)}</code> <button class="opcao discreta" data-acao="copiar">Copiar</button></div>` : ''}
		<div class="opcoes"><button class="opcao principal" data-acao="abrir">Abrir ${escapar(ev.sistema || 'o sistema')}</button></div>
		<label class="consulta-trazer">Cole aqui ${escapar((ev.trazer || 'o resultado').replace(/^./, (c) => c.toLowerCase()))}:
			<textarea rows="5" placeholder="Copie da tela do sistema e cole aqui. Se baixou um PDF, use Anexar arquivo."></textarea></label>
		<div class="opcoes">
			<button class="opcao" data-acao="anexar">Anexar arquivo baixado</button><input type="file" hidden multiple>
			<button class="opcao principal" data-acao="enviar">Enviar resultado</button>
			<button class="opcao discreta" data-acao="nao">Não consigo agora</button>
		</div>`
	d.append(c)
	const card = { el: c, pedido: null, t }
	t.consultas = [...(t.consultas || []), card]
	const caixa = c.querySelector('textarea')
	c.querySelector('[data-acao="abrir"]').onclick = () => abrirLink(ev.endereco)
	c.querySelector('[data-acao="copiar"]')?.addEventListener('click', async () => { await navigator.clipboard.writeText(ev.termo); aviso('Copiado.') })
	const arquivo = c.querySelector('input[type=file]')
	c.querySelector('[data-acao="anexar"]').onclick = () => arquivo.click()
	arquivo.onchange = async () => {
		for (const f of arquivo.files) {
			try {
				const r = await fetch('/api/anexo?nome=' + encodeURIComponent(f.name), { method: 'POST', headers: { 'x-token': token }, body: f })
				const j = await r.json()
				if (!r.ok) throw new Error(j.erro)
				caixa.value += (caixa.value ? '\n' : '') + `Arquivo anexado (leia este arquivo): ${j.caminho}`
			} catch (e) { aviso(`Não consegui anexar ${f.name}: ${e.message}`) }
		}
		arquivo.value = ''
	}
	const concluir = (texto) => {
		c.querySelectorAll('button, textarea').forEach((x) => (x.disabled = true))
		c.insertAdjacentHTML('beforeend', `<div class="consulta-feito">${escapar(texto)}</div>`)
		t.consultas = t.consultas.filter((x) => x !== card)
	}
	c.querySelector('[data-acao="enviar"]').onclick = async () => {
		const resultado = caixa.value.trim()
		if (!resultado) return aviso('Cole o resultado ou anexe o arquivo antes de enviar.')
		try {
			// Com o pedido do motor aberto, o resultado volta na mesma resposta; sem ele, vai como mensagem nova.
			if (card.pedido) await api('responder', { conversa: t.id, pedido: card.pedido, resultado })
			else enviarEm(t, `Resultado da consulta em ${ev.sistema}:\n\n${resultado}`)
			concluir('Resultado enviado. Vou continuar a partir dele.')
		} catch (e) { aviso(e.message) }
	}
	c.querySelector('[data-acao="nao"]').onclick = async () => {
		try { if (card.pedido) await api('responder', { conversa: t.id, pedido: card.pedido, escolha: 'nao' }) } catch (e) { aviso(e.message) }
		concluir('Tudo bem. Sigo sem essa consulta e aponto o que fica pendente.')
	}
	t.el.append(d); rolar(t)
	if (t.id !== atual) { t.novidade = true; estadoMudou() }
}
// O pedido do motor chega logo depois do cartão: liga o cartão mais recente dessa conversa a ele.
function ligarConsulta(t, ev) {
	const card = [...(t.consultas || [])].reverse().find((x) => !x.pedido)
	if (card) card.pedido = ev.pedido
}

/* ---------- sites consultados nesta resposta ---------- */
function anotarFonte(t, url) { (t.fontes ||= new Set()).add(url) }
function mostrarFontes(t) {
	if (!t.fontes?.size) return
	const d = document.createElement('div')
	d.className = 'fontes'
	d.innerHTML = '<span>Sites consultados nesta resposta:</span>'
	for (const url of t.fontes) {
		let rotulo = url
		try { const u = new URL(url); rotulo = u.hostname + (u.pathname.length > 1 ? u.pathname.slice(0, 40) : '') } catch {}
		const b = document.createElement('button')
		b.className = 'fonte'
		b.textContent = rotulo
		b.title = url
		b.onclick = () => abrirLink(url)
		d.append(b)
	}
	t.fontes = null
	t.el.append(d); rolar(t)
}
