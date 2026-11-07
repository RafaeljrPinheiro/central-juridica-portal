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
	$('#link-texto').textContent = `Este link abre ${new URL(url).hostname}, que pede seu login com certificado digital (e, no eproc, o código de dois fatores). Ele abre no seu navegador, fora do BDS Jus.`
	$('#link-abrir').onclick = () => { d.close(); api('link', { url }).catch((e) => aviso(e.message)) }
	d.showModal()
}

/* ---------- consulta guiada ---------- */
function cartaoConsulta(t, ev) {
	fecharBloco(t)
	const d = document.createElement('div')
	d.className = 'msg ela'
	d.innerHTML = '<div class="autor">BDS Jus</div>'
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

/* ---------- o Claude consulta o processo sozinho; ela só digita o código da imagem ---------- */
// Pedido do Rafael (06/11): nada de passo a passo nem navegador. O servidor busca o formulário público do tribunal
// (consulta-publica.mjs), aqui aparece só a imagem; com o código certo, a página volta direto para o Claude.
function cartaoProcesso(t, ev) {
	fecharBloco(t)
	const d = document.createElement('div')
	d.className = 'msg ela'
	d.innerHTML = '<div class="autor">BDS Jus</div>'
	const c = document.createElement('div')
	c.className = 'pedido consulta processo-captcha'
	c.innerHTML = `<div class="tit">${icone('i-chave')}Estou abrindo o processo ${escapar(ev.numero)} no ${escapar(ev.tribunal)}</div>
		<div class="det">${escapar(ev.motivo || '')} O tribunal pede um código de verificação que só você pode digitar. O resto eu faço.</div>
		<form class="cp-form">
			<div class="cp-imagem"><span class="det">Buscando a imagem no tribunal…</span></div>
			<input name="codigo" autocomplete="off" spellcheck="false" maxlength="8" placeholder="Código da imagem" aria-label="Código da imagem" required disabled>
			<button class="opcao principal" disabled>Continuar</button>
			<button type="button" class="opcao discreta" data-acao="nova">Outra imagem</button>
			<button type="button" class="opcao discreta" data-acao="nao">Agora não</button>
		</form>
		<p class="det cp-msg" hidden></p>`
	d.append(c)
	const card = { el: c, pedido: null, t }
	t.processos = [...(t.processos || []), card]
	const f = c.querySelector('form'), msg = c.querySelector('.cp-msg'), botao = f.querySelector('button.principal')
	let sessao = null
	const mostrarMsg = (x) => { msg.textContent = x || ''; msg.hidden = !x }
	const porImagem = (src) => {
		c.querySelector('.cp-imagem').innerHTML = `<img alt="Código de verificação do tribunal" src="${src}">`
		f.codigo.disabled = false; f.codigo.value = ''; botao.disabled = false
		if (t.id === atual) f.codigo.focus()
	}
	async function novaImagem() {
		c.querySelector('.cp-imagem').innerHTML = '<span class="det">Buscando a imagem no tribunal…</span>'
		f.codigo.disabled = true; botao.disabled = true
		try { sessao = await api('consulta-publica/iniciar', { tribunal: ev.tribunal }); porImagem(sessao.imagem) }
		catch (e) { c.querySelector('.cp-imagem').innerHTML = ''; mostrarMsg(e.message) }
	}
	const esperarPedido = async () => { for (let i = 0; i < 50 && !card.pedido; i++) await new Promise((r) => setTimeout(r, 100)); return card.pedido }
	const concluir = (texto) => {
		c.querySelectorAll('button, input').forEach((x) => (x.disabled = true))
		f.hidden = true
		c.insertAdjacentHTML('beforeend', `<div class="consulta-feito">${escapar(texto)}</div>`)
		t.processos = t.processos.filter((x) => x !== card)
	}
	f.onsubmit = async (e) => {
		e.preventDefault()
		if (!sessao) return
		botao.disabled = true; botao.textContent = 'Abrindo…'; mostrarMsg('')
		try {
			const r = await api('consulta-publica/consultar', { id: sessao.id, processo: ev.numero, codigo: f.codigo.value })
			if (!r.ok) { mostrarMsg(r.mensagem); if (r.imagem) porImagem(r.imagem); else await novaImagem(); return }
			const pedido = await esperarPedido()
			const resultado = `${r.copia.titulo}\n${r.copia.url || ''}\n\n${r.copia.texto}${r.copia.cortado ? '\n[processo longo: veio o começo da página]' : ''}`
			if (pedido) await api('responder', { conversa: t.id, pedido, resultado })
			else enviarEm(t, `Página pública do processo ${ev.numero}:\n\n${resultado}`)
			concluir('Processo aberto. Continuo daqui.')
		} catch (er) { mostrarMsg(er.message); await novaImagem() }
		finally { botao.textContent = 'Continuar'; if (!f.hidden) botao.disabled = false }
	}
	c.querySelector('[data-acao="nova"]').onclick = () => { mostrarMsg(''); novaImagem() }
	c.querySelector('[data-acao="nao"]').onclick = async () => {
		try { const p = await esperarPedido(); if (p) await api('responder', { conversa: t.id, pedido: p, escolha: 'nao' }) } catch (e) { aviso(e.message) }
		concluir('Tudo bem. Sigo sem abrir o processo e aponto o que fica pendente.')
	}
	t.el.append(d); rolar(t)
	if (t.id !== atual) { t.novidade = true; estadoMudou() }
	novaImagem()
}
function ligarProcesso(t, ev) {
	const card = [...(t.processos || [])].reverse().find((x) => !x.pedido)
	if (card) card.pedido = ev.pedido
}

/* ---------- o Claude navega no tribunal; este cartão só aparece quando ela precisa agir ---------- */
// Entrar com o certificado (PIN e dois fatores) ou digitar um captcha na janela do Edge: o resto ele faz sozinho.
function cartaoTribunalHumano(t, ev) {
	fecharBloco(t)
	const d = document.createElement('div')
	d.className = 'msg ela'
	d.innerHTML = '<div class="autor">BDS Jus</div>'
	const c = document.createElement('div')
	c.className = 'pedido consulta tribunal-humano'
	// Com foto e campo: o código de verificação é digitado aqui mesmo, sem ir à janela do tribunal.
	const comCodigo = ev.campo && ev.imagem
	c.innerHTML = `<div class="tit">${icone('i-chave')}Só um passo seu</div>
		<div class="det">${escapar(ev.texto || '')}</div>
		${comCodigo ? `<form class="cp-form"><div class="cp-imagem"><img alt="Código de verificação do tribunal" src="${escapar(ev.imagem)}"></div>
			<input name="codigo" autocomplete="off" spellcheck="false" maxlength="20" placeholder="Código da imagem" aria-label="Código da imagem" required></form>` : ''}
		<div class="consulta-aviso">Eu não vejo nem guardo senha, PIN ou certificado. ${comCodigo ? 'Você digita o código aqui e eu continuo' : 'Depois deste passo a janela minimiza e eu sigo sozinho'}, só lendo: não peticiono, não assino e não dou ciência de nada.</div>
		<div class="opcoes"><button class="opcao principal" data-acao="feito">${escapar(ev.botao || 'Feito')}</button><button class="opcao discreta" data-acao="nao">Agora não</button></div>`
	d.append(c)
	const campo = c.querySelector('input[name=codigo]')
	const responderHumano = async (escolha, texto) => {
		if (escolha === 'feito' && campo && !campo.value.trim()) { campo.focus(); return aviso('Digite o código da imagem.') }
		c.querySelectorAll('button, input').forEach((x) => (x.disabled = true))
		try { await api('responder', { conversa: t.id, pedido: ev.pedido, escolha, resultado: campo ? campo.value.trim() : undefined }) } catch (e) { aviso(e.message) }
		c.insertAdjacentHTML('beforeend', `<div class="consulta-feito">${escapar(texto)}</div>`)
	}
	if (campo) {
		c.querySelector('form').onsubmit = (e) => { e.preventDefault(); responderHumano('feito', 'Código enviado. Continuo daqui.') }
		if (t.id === atual) setTimeout(() => campo.focus(), 50)
	}
	c.querySelector('[data-acao="feito"]').onclick = () => responderHumano('feito', campo ? 'Código enviado. Continuo daqui.' : 'Obrigado. Continuo daqui.')
	c.querySelector('[data-acao="nao"]').onclick = () => responderHumano('nao', 'Tudo bem. Sigo sem os autos e aponto o que fica pendente.')
	t.el.append(d); rolar(t)
	if (t.id !== atual) { t.novidade = true; estadoMudou() }
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
