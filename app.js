// Central Jurídica: interface. Conversa com o servidor local (servidor.mjs), que roda o motor do Claude.
const $ = (s) => document.querySelector(s)
const icone = (id) => `<svg class="icone"><use href="#${id}"/></svg>`
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/* ---------- acesso ao servidor local ---------- */
const token = new URLSearchParams(location.search).get('t') || sessionStorage.getItem('t')
sessionStorage.setItem('t', token)
// Tira o ?t= da barra, mas mantém a pasta: no link do celular a página mora em /central-juridica-portal/ e os
// outros scripts (quadro.js, escritorio.js…) são procurados a partir dela.
history.replaceState(null, '', location.pathname)
async function api(caminho, dados) {
	const r = await fetch('/api/' + caminho, dados === undefined
		? { headers: { 'x-token': token } }
		: { method: 'POST', headers: { 'x-token': token, 'content-type': 'application/json' }, body: JSON.stringify(dados) })
	const j = await r.json().catch(() => ({}))
	if (j.encerrado) mostrarFimDoTeste(j.erro, j.titulo)
	if (!r.ok) throw new Error(j.erro || 'Falha ao falar com o motor.')
	return j
}
function aviso(t) {
	const a = $('#aviso'); a.textContent = t; a.classList.add('ver')
	clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove('ver'), 3200)
}
document.addEventListener('click', (e) => { const f = e.target.closest('[data-fechar]'); if (f) f.closest('dialog').close() })

/* ---------- conversas ---------- */
let lista = []            // conversas existentes (do Claude)
const telas = new Map()    // id -> { el, titulo, carregada, trabalhando, novidade, bloco }
let atual = null
// Toda vez que a Central abre, começa no Opus. Trocar para o Sonnet vale só até fechar.
let modelo = 'opus'
try { localStorage.removeItem('modelo') } catch {}

function quando(ms) {
	const d = new Date(ms), hoje = new Date()
	if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
	const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
	if (d.toDateString() === ontem.toDateString()) return 'ontem'
	return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function tela(id, titulo) {
	if (!telas.has(id)) {
		const el = document.createElement('div')
		el.className = 'mensagens'
		el.setAttribute('aria-live', 'polite')
		el.hidden = true
		$('#conversas').append(el)
		telas.set(id, { id, el, titulo, carregada: false, trabalhando: false, novidade: false, bloco: null })
	}
	return telas.get(id)
}

let arquivadas = []
let busca = ''              // texto no campo de pesquisa
let achadasNoConteudo = null // resultado da busca no conteúdo (Enter); null = só filtra pelo nome
let verArquivadas = false
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function itemConversa(c, { trecho } = {}) {
	const t = telas.get(c.id)
	const caixa = document.createElement('div')
	caixa.className = 'item-conv'
	const b = document.createElement('button')
	b.className = 'item'
	if (c.id === atual) b.setAttribute('aria-current', 'true')
	const estado = t?.trabalhando ? '<small class="ocupada">trabalhando…</small>' : t?.novidade ? '<small class="nova">● nova</small>' : `<small>${quando(c.atualizado)}</small>`
	b.innerHTML = `<span><span class="tit-conv">${escapar(c.titulo)}</span>${trecho ? `<span class="trecho">${escapar(trecho)}</span>` : ''}</span>${estado}`
	b.title = c.pasta ? `Pasta: ${c.pasta}` : ''
	b.onclick = () => abrirConversa(c.id, c.titulo)
	caixa.append(b)
	// Conversa nova que ainda não foi gravada pelo Claude não tem menu (não há o que renomear ainda).
	if (!c.provisoria) {
		const mais = document.createElement('button')
		mais.className = 'btn-mais'
		mais.textContent = '⋯'
		mais.setAttribute('aria-label', `Opções da conversa ${c.titulo}`)
		mais.setAttribute('aria-haspopup', 'menu')
		mais.onclick = (e) => { e.stopPropagation(); abrirMenuConversa(c, mais) }
		b.oncontextmenu = (e) => { e.preventDefault(); abrirMenuConversa(c, mais) }
		caixa.append(mais)
	}
	return caixa
}

function desenharLista() {
	const caixa = $('#lista-conversas')
	caixa.innerHTML = ''
	const vazio = (texto) => caixa.insertAdjacentHTML('beforeend', `<p style="margin:8px 10px;color:var(--marinho-suave);font-size:14px">${texto}</p>`)
	// Pesquisa: com resultado do conteúdo, mostra só ele; senão filtra pelo nome enquanto digita.
	if (achadasNoConteudo) {
		$('#tit-lista').textContent = `Encontradas: ${achadasNoConteudo.length}`
		if (!achadasNoConteudo.length) vazio('Nada encontrado. Tente outra palavra.')
		for (const c of achadasNoConteudo) caixa.append(itemConversa(c, { trecho: c.trecho || (c.arquivada ? 'arquivada' : '') }))
		if (achadasNoConteudo.semDocs && achadasNoConteudo.length < 30) {
			const b = document.createElement('button')
			b.className = 'item buscar-conteudo'
			b.textContent = 'Procurar também nos documentos lidos nas conversas (mais lento)'
			b.onclick = () => buscarNoConteudo(true)
			caixa.append(b)
		}
		$('#ver-arquivadas').hidden = true; $('#lista-arquivadas').hidden = true
		return
	}
	// Conversas abertas aqui que o servidor ainda não listou (novas ou recém-criadas): no topo, enquanto tiverem conteúdo.
	const conhecidas = new Set([...lista, ...arquivadas].map((c) => c.id))
	const novas = [...telas.values()].filter((t) => t.id !== QUADRO && !conhecidas.has(t.id) && !t.vazia)
	let itens = [...novas.map((t) => ({ id: t.id, titulo: t.titulo, atualizado: Date.now(), provisoria: true })), ...lista]
	const q = semAcento(busca).trim()
	if (q) itens = [...itens, ...arquivadas].filter((c) => semAcento(c.titulo).includes(q))
	$('#tit-lista').textContent = q ? 'Pelo nome' : 'Conversas'
	if (!itens.length) vazio(q ? 'Nenhum nome com essa palavra.' : 'Nenhuma conversa ainda.')
	for (const c of itens) caixa.append(itemConversa(c, { trecho: q && c.arquivada ? 'arquivada' : '' }))
	if (q) {
		const b = document.createElement('button')
		b.className = 'item buscar-conteudo'
		b.textContent = `Procurar “${busca.trim()}” dentro das conversas (Enter)`
		b.onclick = buscarNoConteudo
		caixa.append(b)
	}
	// Arquivadas: recolhidas no fim da lista.
	$('#ver-arquivadas').hidden = !!q || !arquivadas.length
	$('#qtd-arquivadas').textContent = verArquivadas ? 'esconder' : String(arquivadas.length)
	const arq = $('#lista-arquivadas')
	arq.hidden = !!q || !verArquivadas
	arq.innerHTML = ''
	if (verArquivadas && !q) for (const c of arquivadas) arq.append(itemConversa(c))
}
$('#ver-arquivadas').onclick = () => { verArquivadas = !verArquivadas; desenharLista() }

let esperaBusca = null
$('#busca').oninput = (e) => {
	busca = e.target.value
	achadasNoConteudo = null
	clearTimeout(esperaBusca); esperaBusca = setTimeout(desenharLista, 120)
}
$('#busca').onkeydown = (e) => {
	if (e.key === 'Enter') { e.preventDefault(); buscarNoConteudo() }
	if (e.key === 'Escape') { e.target.value = ''; busca = ''; achadasNoConteudo = null; desenharLista() }
}
// Enter: procura nas mensagens (índice, instantâneo). docs: procura também nos documentos lidos (lê os arquivos).
async function buscarNoConteudo(docs = false) {
	const q = busca.trim()
	if (q.length < 2) return aviso('Digite pelo menos 2 letras para procurar.')
	$('#tit-lista').textContent = docs ? 'Procurando também nos documentos…' : 'Procurando dentro das conversas…'
	try {
		const r = await api('conversas/buscar?q=' + encodeURIComponent(q) + (docs === true ? '&docs=1' : ''))
		achadasNoConteudo = r.conversas
		achadasNoConteudo.semDocs = !!r.semDocs
		if (r.parcial) aviso('São muitas conversas: mostrei o que achei nos primeiros 25 segundos. Use uma palavra mais específica para achar o resto.')
	}
	catch (e) { aviso(e.message); achadasNoConteudo = null }
	desenharLista()
}

/* ---------- menu da conversa: renomear, arquivar, apagar ---------- */
let conversaDoMenu = null
function abrirMenuConversa(c, botao) {
	const menu = $('#menu-conv')
	fecharMenuConversa()
	conversaDoMenu = c
	menu.querySelector('[data-acao="arquivar"]').textContent = c.arquivada ? 'Desarquivar' : 'Arquivar'
	menu.hidden = false
	const r = botao.getBoundingClientRect()
	menu.style.left = Math.min(r.left, innerWidth - menu.offsetWidth - 8) + 'px'
	menu.style.top = Math.min(r.bottom + 4, innerHeight - menu.offsetHeight - 8) + 'px'
	botao.setAttribute('aria-expanded', 'true')
	menu._botao = botao
	menu.querySelector('button').focus()
}
function fecharMenuConversa() {
	const menu = $('#menu-conv')
	menu.hidden = true
	menu._botao?.setAttribute('aria-expanded', 'false')
}
document.addEventListener('click', (e) => { if (!e.target.closest('#menu-conv')) fecharMenuConversa() })
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#menu-conv').hidden) { fecharMenuConversa(); } })
$('#menu-conv').onclick = async (e) => {
	const acao = e.target.closest('[data-acao]')?.dataset.acao
	const c = conversaDoMenu
	if (!acao || !c) return
	fecharMenuConversa()
	try {
		if (acao === 'renomear') {
			$('#renomear-nome').value = c.titulo || ''
			$('#renomear-nome').required = false
			$('#d-renomear').showModal()
			$('#renomear-nome').select()
		}
		if (acao === 'arquivar') {
			await api('conversas/arquivar', { id: c.id, arquivada: !c.arquivada })
			aviso(c.arquivada ? 'Conversa de volta à lista.' : 'Conversa arquivada. Ela fica em "Arquivadas", no fim da lista.')
			await carregarLista()
		}
		if (acao === 'apagar') {
			if (!confirm(`Apagar a conversa "${c.titulo}"?\n\nEla sai da Central agora e fica 30 dias na lixeira antes de ser apagada de vez. Os arquivos que você salvou (peças em Word e PDF) não são apagados.`)) return
			await api('conversas/apagar', { id: c.id })
			if (abas.includes(c.id)) fecharAba(c.id)
			telas.get(c.id)?.el.remove(); telas.delete(c.id)
			aviso('Conversa apagada.')
			achadasNoConteudo = achadasNoConteudo?.filter((x) => x.id !== c.id) || null
			await carregarLista()
		}
	} catch (err) { aviso(err.message) }
}
$('#f-renomear').onsubmit = async (e) => {
	e.preventDefault()
	const c = conversaDoMenu
	if (!c) return $('#d-renomear').close()
	const nome = $('#renomear-nome').value.trim()
	try {
		await api('conversas/renomear', { id: c.id, nome })
		$('#d-renomear').close()
		const t = telas.get(c.id)
		if (t && nome) { t.titulo = nome; if (c.id === atual) $('#titulo').textContent = nome }
		aviso(nome ? 'Conversa renomeada.' : 'Nome automático de volta.')
		if (achadasNoConteudo) { const x = achadasNoConteudo.find((y) => y.id === c.id); if (x && nome) x.titulo = nome }
		await carregarLista()
	} catch (err) { aviso(err.message) }
}

async function carregarLista() {
	try {
		const r = await api('conversas')
		lista = r.conversas
		arquivadas = r.arquivadas || []
		for (const id of r.trabalhando) tela(id).trabalhando = true
		// abas e cabeçalho acompanham o título que o Claude deu à conversa
		for (const c of [...lista, ...arquivadas]) { const t = telas.get(c.id); if (t && c.titulo && t.titulo !== c.titulo) { t.titulo = c.titulo; if (c.id === atual) $("#titulo").textContent = c.titulo } }
		desenharLista()
		desenharAbas()
	} catch (e) { aviso(e.message) }
}

function mostrar(id) {
	if (quadroAberto) esconderQuadro()
	atual = id
	for (const t of telas.values()) t.el.hidden = t.id !== id
	const t = telas.get(id)
	t.novidade = false
	$('#titulo').textContent = t.titulo || 'Nova conversa'
	if (!abas.includes(id)) abas.push(id)
	botoesTrabalho(!!t.trabalhando)
	desenharLista()
	desenharAbas()
	desenharFila()
	t.el.scrollTop = t.el.scrollHeight
}

/* ---------- abas (como no VS Code): conversas abertas no topo, com × para fechar ---------- */
const QUADRO = '__quadro'
let abas = []
function desenharAbas() {
	const caixa = $('#abas')
	caixa.innerHTML = ''
	const itens = [...(quadroAberto || abas.includes(QUADRO) ? [QUADRO] : []), ...abas.filter((id) => id !== QUADRO)]
	for (const id of itens) {
		const ehQuadro = id === QUADRO
		const t = telas.get(id)
		if (!ehQuadro && !t) continue
		const ativa = ehQuadro ? quadroAberto : id === atual && !quadroAberto
		const aba = document.createElement('div')
		aba.className = 'aba' + (ativa ? ' ativa' : '')
		aba.setAttribute('role', 'tab')
		aba.setAttribute('aria-selected', String(ativa))
		const estado = t?.trabalhando ? '<span class="aba-estado girando" title="Trabalhando"></span>' : t?.novidade ? '<span class="aba-estado nova" title="Resposta nova"></span>' : ''
		const titulo = ehQuadro ? 'Avisos do dia' : t.titulo || 'Nova conversa'
		aba.innerHTML = `${estado}<button class="aba-tit" title="${escapar(titulo)}">${escapar(titulo)}</button><button class="aba-fechar" aria-label="Fechar aba ${escapar(titulo)}">×</button>`
		aba.querySelector('.aba-tit').onclick = () => (ehQuadro ? mostrarQuadro() : mostrar(id))
		aba.querySelector('.aba-fechar').onclick = (e) => { e.stopPropagation(); fecharAba(id) }
		aba.onauxclick = (e) => { if (e.button === 1) fecharAba(id) } // botão do meio fecha, como no VS Code
		caixa.append(aba)
	}
	caixa.querySelector('.ativa')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
// Fechar a aba não apaga a conversa: ela continua na lista (e termina o que estava fazendo).
function fecharAba(id) {
	const eraAtiva = id === QUADRO ? quadroAberto : id === atual && !quadroAberto
	const pos = abas.indexOf(id)
	abas = abas.filter((x) => x !== id)
	if (id === QUADRO && quadroAberto) esconderQuadro()
	if (eraAtiva) {
		const proxima = abas[Math.min(pos, abas.length - 1)]
		if (proxima === QUADRO) return mostrarQuadro()
		if (proxima) return mostrar(proxima)
		return novaConversa()
	}
	desenharAbas()
}

/* ---------- atualiza lista e abas só quando algo visível mudou (não a cada pedaço de texto) ---------- */
function estadoMudou() { desenharLista(); desenharAbas() }

async function abrirConversa(id, titulo) {
	const t = tela(id, titulo)
	if (titulo) t.titulo = titulo
	mostrar(id)
	if (t.carregada || id.startsWith('nova-')) return
	t.el.innerHTML = '<p class="vazio">Abrindo a conversa…</p>'
	try {
		const r = await api('conversa?id=' + encodeURIComponent(id))
		t.el.innerHTML = ''
		for (const item of r.itens) desenhar(t, item, true)
		fecharBloco(t)
		t.carregada = true
		if (r.trabalhando) { t.trabalhando = true; botoesTrabalho(id === atual) }
		if (r.total > r.itens.length) avisoConversaLonga(t, r.total)
		t.el.scrollTop = t.el.scrollHeight
	} catch (e) { t.el.innerHTML = `<p class="vazio">${escapar(e.message)}</p>` }
}

// Conversa muito longa: mostra só o fim e sugere continuar num chat novo (cada mensagem relê tudo e gasta mais).
const PEDIDO_RESUMO = 'Vou continuar este trabalho num chat novo. Faça um resumo para isso: caso e partes, fatos importantes, o que já decidimos, o que já foi feito (peças, arquivos e onde estão) e o que falta. Responda só com o resumo.'
function avisoConversaLonga(t, total) {
	const d = document.createElement('div')
	d.className = 'msg ela'
	d.innerHTML = `<div class="pedido"><div class="tit">${icone('i-alerta')}Conversa longa: aparecem só as últimas 300 de ${total} partes.</div>
		<div class="det">Cada mensagem nova relê a conversa inteira: fica mais lenta e gasta mais do limite. Vale continuar num chat novo.</div><div class="opcoes"></div></div>`
	const box = d.querySelector('.opcoes')
	const b1 = document.createElement('button'); b1.className = 'opcao principal'; b1.textContent = 'Novo chat com o resumo desta'
	b1.onclick = () => { if (t.trabalhando) return aviso('Espere esta conversa terminar.'); t.resumoParaNovo = true; mostrar(t.id); enviar(PEDIDO_RESUMO); d.remove() }
	const b2 = document.createElement('button'); b2.className = 'opcao'; b2.textContent = 'Novo chat em branco'
	b2.onclick = () => novaConversa()
	box.append(b1, b2)
	t.el.append(d)
}

function novaConversa() {
	// Reaproveita uma conversa nova que ainda não recebeu mensagem, em vez de empilhar vazias.
	const vazia = [...telas.values()].find((t) => t.id.startsWith('nova-') && t.vazia)
	if (vazia) { mostrar(vazia.id); return $('#entrada').focus() }
	const id = 'nova-' + Math.random().toString(36).slice(2, 10)
	const t = tela(id, 'Nova conversa')
	t.carregada = true
	t.vazia = true
	t.el.innerHTML = `<div class="msg ela"><div class="autor">Central Jurídica</div>
		<p>Em que caso vamos trabalhar?</p>
		<div class="atalhos">
			<button class="atalho" data-inicio="Quero fazer uma peça."><strong>Fazer uma peça</strong><span>Inicial, contestação, recurso, manifestação</span></button>
			<button class="atalho" data-inicio="Quero trazer o caso de uma cliente que me mandou tudo pelo WhatsApp. Liste minhas conversas mais recentes."><strong>Trazer o caso do WhatsApp</strong><span>Leio as mensagens e os áudios da cliente</span></button>
			<button class="atalho" data-inicio="Quero pensar um caso junto: provas, riscos e estratégia."><strong>Pensar um caso junto</strong><span>Provas, riscos e estratégia</span></button>
			<button class="atalho" data-inicio="Quero revisar uma peça antes de protocolar."><strong>Revisar antes de protocolar</strong><span>Fatos, citações, pedidos, restos de modelo</span></button>
			<button class="atalho" data-inicio="Quero pesquisar as decisões de um magistrado (juiz ou relator) para usar na estratégia de um caso."><strong>Decisões de um magistrado</strong><span>Como o juiz ou relator decidiu casos parecidos</span></button>
		</div></div>`
	t.el.querySelectorAll('[data-inicio]').forEach((b) => (b.onclick = () => enviar(b.dataset.inicio)))
	if (typeof cartaoPassos === 'function') cartaoPassos(t.el).catch(() => {})
	mostrar(id)
	$('#entrada').focus()
}

/* ---------- desenho das mensagens ---------- */
function md(texto) {
	const html = DOMPurify.sanitize(marked.parse(texto, { gfm: true, breaks: false }))
	const d = document.createElement('div'); d.className = 'md'; d.innerHTML = html
	d.querySelectorAll('a[href]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); typeof abrirLink === 'function' ? abrirLink(a.href) : api('link', { url: a.href }).catch((er) => aviso(er.message)) }))
	return d
}
// Respostas com o bloco do treino de sustentação viram a tela de resultado; as demais, texto formatado.
const formatar = (texto) => (typeof resposta === 'function' ? resposta(texto) : md(texto))
function rolar(t) { if (t.id === atual) t.el.scrollTo({ top: t.el.scrollHeight, behavior: 'smooth' }) }

function blocoAtividade(t, aoVivo) {
	if (t.bloco) return t.bloco
	const det = document.createElement('details')
	det.className = 'atividade' + (aoVivo ? ' vivo' : '')
	det.open = aoVivo
	det.innerHTML = `<summary><span class="at-tit">${aoVivo ? 'Trabalhando…' : ''}</span><span class="at-tempo"></span></summary><ol></ol>`
	t.el.append(det)
	t.bloco = { det, ol: det.querySelector('ol'), n: 0, inicio: Date.now(), aoVivo }
	if (aoVivo) t.bloco.relogio = setInterval(() => (det.querySelector('.at-tempo').textContent = Math.round((Date.now() - t.bloco.inicio) / 1000) + ' s'), 1000)
	return t.bloco
}
function fecharBloco(t) {
	const b = t.bloco
	if (!b) return
	clearInterval(b.relogio)
	b.det.classList.remove('vivo')
	if (!b.n) { b.det.remove(); t.bloco = null; return } // sem atividade: não mostra "0 etapas"
	b.ol.querySelectorAll('li.agora').forEach((li) => (li.className = 'feito'))
	b.det.querySelector('.at-tit').textContent = b.n === 1 ? '1 etapa' : `${b.n} etapas`
	if (b.aoVivo) b.det.querySelector('.at-tempo').textContent = Math.max(1, Math.round((Date.now() - b.inicio) / 1000)) + ' s'
	b.det.open = false
	t.bloco = null
}

function desenhar(t, item, doHistorico = false) {
	if (item.tipo === 'atividade') {
		const b = blocoAtividade(t, !doHistorico)
		b.ol.querySelectorAll('li.agora').forEach((li) => (li.className = 'feito'))
		const li = document.createElement('li')
		li.className = doHistorico ? 'feito' : 'agora'
		li.innerHTML = `<span>${escapar(item.texto)}</span>`
		b.ol.append(li); b.n++
		return rolar(t)
	}
	if (item.tipo === 'arquivo') {
		const d = document.createElement('div')
		d.className = 'msg ela'
		d.innerHTML = `<div class="cartao arquivo"><div class="arquivo-icone">${/\.pdf$/i.test(item.caminho) ? 'PDF' : 'W'}</div><div style="flex:1;min-width:0"><strong>${escapar(item.caminho.split(/[\\/]/).pop())}</strong><small>${escapar(item.caminho)}</small></div><div class="opcoes" style="margin:0"><button class="opcao" data-acao="abrir">Abrir</button><button class="opcao discreta" data-acao="pasta">Mostrar na pasta</button></div></div>`
		d.querySelector('[data-acao="abrir"]').onclick = () => api('abrir', { caminho: item.caminho }).catch((e) => aviso(e.message))
		d.querySelector('[data-acao="pasta"]').onclick = () => api('abrir', { caminho: item.caminho, naPasta: true }).catch((e) => aviso(e.message))
		t.el.append(d)
		return rolar(t)
	}
	fecharBloco(t)
	const d = document.createElement('div')
	if (item.tipo === 'eu' && item.texto.startsWith('[ATENDIMENTO]') && typeof atendimentoEu === 'function') { t.el.append(atendimentoEu(item.texto)); return rolar(t) }
	if (item.tipo === 'eu' && item.texto.startsWith('[SUSTENTAÇÃO ORAL]') && typeof sustentacaoEu === 'function') { t.el.append(sustentacaoEu(item.texto)); return rolar(t) }
	if (item.tipo === 'eu') { d.className = 'msg eu'; d.textContent = item.texto; if (item.modelo) d.insertAdjacentHTML('beforeend', `<small class="motor-usado">${item.modelo === 'opus' ? 'Opus' : 'Sonnet'}</small>`) }
	else if (item.tipo === 'erro') {
		d.className = 'msg ela'
		d.innerHTML = `<div class="pedido alerta"><div class="tit">${icone('i-alerta')}${escapar(item.texto)}</div></div>`
		// Tentar de novo: reenvia a última mensagem desta conversa (o contexto continua o mesmo).
		if (item.repetir && t.ultima) {
			const b = document.createElement('button')
			b.className = 'opcao'; b.textContent = 'Tentar de novo'; b.style.marginTop = '8px'
			b.onclick = () => { if (t.trabalhando) return aviso('Esta conversa ainda está trabalhando.'); b.remove(); despachar(t, t.ultima) }
			d.querySelector('.pedido').append(b)
		}
	}
	else {
		// Se o texto já veio sendo escrito aos pedaços, troca o rascunho pelo texto formatado no mesmo lugar.
		if (t.parcial) { const p = t.parcial; t.parcial = null; p.querySelector('.ao-vivo').replaceWith(formatar(item.texto)); return rolar(t) }
		d.className = 'msg ela'; d.innerHTML = '<div class="autor">Central Jurídica</div>'; d.append(formatar(item.texto))
	}
	t.el.append(d)
	rolar(t)
}

// Resposta aparecendo enquanto é escrita (texto simples; vira formatado quando o bloco termina).
function escreverParcial(t, pedaco) {
	if (!t.parcial) {
		fecharBloco(t) // a espera vira texto; se houve atividade, ela fica registrada acima
		const d = document.createElement('div')
		d.className = 'msg ela'
		d.innerHTML = '<div class="autor">Central Jurídica</div><div class="ao-vivo"></div>'
		t.el.append(d); t.parcial = d
	}
	t.parcial.querySelector('.ao-vivo').textContent += pedaco
	rolar(t)
}

/* ---------- pedidos do motor: permissões e perguntas ---------- */
function cartaoPermissao(t, ev) {
	fecharBloco(t)
	const d = document.createElement('div')
	d.className = 'msg ela'
	// Em consultas à internet, explica para quê, se o site é oficial, o que sai do computador e se há dado sensível.
	const extras = [
		ev.para ? `<div class="det">Para quê: ${escapar(ev.para)}</div>` : '',
		ev.oficial === true ? '<div class="det oficial">Site oficial (tribunal, CNJ ou governo).</div>' : ev.oficial === false ? '<div class="det">Site não oficial: serve para localizar; a informação só vale conferida na fonte oficial.</div>' : '',
		ev.saida ? `<div class="det">${escapar(ev.saida)}</div>` : '',
		ev.sensivel ? `<div class="consulta-aviso">${escapar(ev.sensivel)}</div>` : '',
	].join('')
	d.innerHTML = `<div class="pedido"><div class="tit">${icone('i-chave')}${escapar(ev.titulo)}</div><div class="det">${escapar(ev.detalhe || '')}</div>${extras}<div class="opcoes"></div></div>`
	const box = d.querySelector('.opcoes')
	for (const [rot, esc] of [['Permitir uma vez', 'uma'], ['Permitir sempre', 'sempre'], ['Não permitir', 'nao']]) {
		const b = document.createElement('button')
		b.className = 'opcao' + (esc === 'nao' ? ' discreta' : '')
		b.textContent = rot
		b.onclick = async () => {
			box.querySelectorAll('button').forEach((x) => (x.disabled = true)); b.classList.add('escolhida'); b.disabled = false
			try { await api('responder', { conversa: t.id, pedido: ev.pedido, escolha: esc }); resolverCartao(d, esc) }
			catch (e) { aviso(e.message); box.querySelectorAll('button').forEach((x) => (x.disabled = false)); b.classList.remove('escolhida') }
		}
		box.append(b)
	}
	d.dataset.pedido = ev.pedido
	d.dataset.titulo = ev.titulo
	t.el.append(d); rolar(t)
	if (t.id !== atual) { t.novidade = true; desenharLista() }
}

// Depois de respondido, o cartão vira uma linha no registro de atividade: some da frente, mas fica o rastro.
function resolverCartao(d, esc) {
	const rot = { uma: '✓ Permitido', sempre: '✓ Permitido sempre', nao: '✕ Não permitido' }[esc]
	d.className = 'atividade permissao-feita'
	d.textContent = `${rot}: ${d.dataset.titulo}`
}

function cartaoPergunta(t, ev) {
	fecharBloco(t)
	const d = document.createElement('div')
	d.className = 'msg ela'
	d.innerHTML = '<div class="autor">Central Jurídica</div>'
	const respostas = {}
	const total = ev.perguntas.length
	const enviarSePronto = async () => {
		if (Object.keys(respostas).length < total) return
		try {
			await api('responder', { conversa: t.id, pedido: ev.pedido, respostas })
			d.className = 'atividade permissao-feita'
			d.textContent = Object.entries(respostas).map(([q, r]) => `✓ ${q} → ${r}`).join('\n')
		} catch (e) { aviso(e.message) }
	}
	for (const q of ev.perguntas) {
		const c = document.createElement('div')
		c.className = 'pedido'
		c.innerHTML = `<div class="tit">${icone('i-pergunta')}${escapar(q.question)}</div><div class="opcoes"></div>`
		const box = c.querySelector('.opcoes')
		for (const op of q.options || []) {
			const b = document.createElement('button')
			b.className = 'opcao'
			b.innerHTML = escapar(op.label) + (op.description ? `<small>${escapar(op.description)}</small>` : '')
			b.onclick = async () => {
				// "Escolher arquivos no computador": abre a janela do Windows e responde com os caminhos escolhidos.
				if (/^Escolher (outros )?arquivos/i.test(op.label)) {
					let arquivos = []
					try { arquivos = (await api('escolher-arquivos', {})).arquivos } catch (e) { return aviso(e.message) }
					if (!arquivos.length) return
					box.querySelectorAll('button').forEach((x) => (x.disabled = true)); b.classList.add('escolhida'); b.disabled = false
					respostas[q.question] = 'Arquivos escolhidos pela advogada: ' + arquivos.join('; ')
					return enviarSePronto()
				}
				if (q.multiSelect) { b.classList.toggle('escolhida'); return }
				box.querySelectorAll('button').forEach((x) => (x.disabled = true)); b.classList.add('escolhida'); b.disabled = false
				respostas[q.question] = op.label; enviarSePronto()
			}
			box.append(b)
		}
		const outro = document.createElement('button')
		outro.className = 'opcao discreta'
		outro.textContent = q.multiSelect ? 'Confirmar' : 'Outra resposta'
		outro.onclick = () => {
			if (q.multiSelect) {
				const marcadas = [...box.querySelectorAll('.escolhida')].map((x) => x.firstChild.textContent)
				if (!marcadas.length) return aviso('Marque ao menos uma opção.')
				box.querySelectorAll('button').forEach((x) => (x.disabled = true))
				respostas[q.question] = marcadas.join(', '); return enviarSePronto()
			}
			const livre = prompt(q.question)
			if (!livre) return
			box.querySelectorAll('button').forEach((x) => (x.disabled = true))
			respostas[q.question] = livre; enviarSePronto()
		}
		box.append(outro)
		d.append(c)
	}
	t.el.append(d); rolar(t)
	if (t.id !== atual) { t.novidade = true; desenharLista() }
}

/* ---------- eventos ao vivo do motor ---------- */
function conectarEventos() {
	const es = new EventSource('/api/eventos?t=' + token)
	es.onmessage = (m) => {
		const ev = JSON.parse(m.data)
		if (ev.tipo === 'encerrado') return mostrarFimDoTeste(ev.mensagem)
		if (ev.tipo === 'controle') return aplicarControle(ev)
		if (ev.tipo === 'atualizando' || ev.tipo === 'reiniciando') return mostrarReabrindo(ev.tipo)
		if (ev.tipo === 'desinstalando') { reabrindo = true; return mostrarFimDoTeste('O Rafael desinstalou a Central Jurídica deste computador. Esta janela pode ser fechada.', 'Central desinstalada', 'Suas conversas, os dados do Escritório, os backups e as peças no Word continuam neste computador.') }
		if (ev.tipo === 'uso') return desenharUso(ev.uso)
		if (ev.tipo === 'avisos') return carregarQuadro()
		if (ev.tipo === 'sustentacao') return eventoSustentacao(ev)
		if (ev.tipo === 'id') {
			// conversa nova ganhou o id definitivo do Claude
			const t = telas.get(ev.conversa)
			if (!t) return
			telas.delete(ev.conversa); t.id = ev.id; telas.set(ev.id, t)
			if (atual === ev.conversa) atual = ev.id
			abas = abas.map((x) => (x === ev.conversa ? ev.id : x))
			return estadoMudou()
		}
		const t = telas.get(ev.conversa)
		if (!t) return
		const antes = `${t.trabalhando}|${t.novidade}`
		if (ev.tipo === 'parcial') { escreverParcial(t, ev.texto); if (t.id !== atual) t.novidade = true }
		else if (ev.tipo === 'texto') { t.ultimoTexto = ev.texto; desenhar(t, { tipo: 'ela', texto: ev.texto }); if (t.id !== atual) t.novidade = true }
		else if (ev.tipo === 'atividade') desenhar(t, { tipo: 'atividade', texto: ev.texto })
		else if (ev.tipo === 'arquivo') desenhar(t, { tipo: 'arquivo', caminho: ev.caminho })
		else if (ev.tipo === 'permissao') cartaoPermissao(t, ev)
		else if (ev.tipo === 'permissao-resolvida') { const d = [...t.el.querySelectorAll('[data-pedido]')].find((x) => x.dataset.pedido === ev.pedido); if (d) resolverCartao(d, ev.escolha) }
		else if (ev.tipo === 'pergunta') cartaoPergunta(t, ev)
		else if (ev.tipo === 'consulta') cartaoConsulta(t, ev)
		else if (ev.tipo === 'consulta-pedido') ligarConsulta(t, ev)
		else if (ev.tipo === 'fonte') anotarFonte(t, ev.url)
		else if (ev.tipo === 'fim' || ev.tipo === 'erro') {
			t.parcial = null // se foi interrompida no meio, o rascunho fica como está
			fecharBloco(t)
			if ((ev.erro || ev.tipo === 'erro') && !t.interrompidaParaFila) desenhar(t, { tipo: 'erro', texto: ev.erro || ev.texto, repetir: true })
			t.trabalhando = false
			if (t.id !== atual) t.novidade = true
			if (t.id === atual) botoesTrabalho(false)
			mostrarFontes(t)
			carregarLista()
			proximaDaFila(t)
			if (!t.trabalhando && typeof soltarDica === 'function') soltarDica(t)
			// Pedido de resumo para continuar: abre o chat novo já com o resumo no campo.
			if (t.resumoParaNovo) {
				t.resumoParaNovo = false
				if (!ev.erro && t.ultimoTexto) {
					const titulo = t.titulo
					novaConversa()
					$('#entrada').value = `Continuação da conversa "${titulo}".

${t.ultimoTexto}

Vamos continuar daqui.`
					aviso('O resumo está no campo do chat novo. Confira e envie.')
				}
			}
		}
		if (`${t.trabalhando}|${t.novidade}` !== antes || ev.tipo === 'permissao' || ev.tipo === 'pergunta') estadoMudou()
	}
	// Sem ligação com o servidor da Central por mais de 15 s: explica o que fazer, em vez de só "Reconectando…".
	es.onerror = () => {
		$('#ponto-motor').className = 'ponto alerta'; $('#texto-motor').textContent = 'Reconectando…'
		clearTimeout(conectarEventos.t)
		conectarEventos.t = setTimeout(() => { if (es.readyState !== 1 && !reabrindo) faixaLigacao('A Central perdeu a ligação com este computador. Se não voltar em instantes, feche a janela e abra a Central de novo pelo atalho.') }, 15000)
	}
	es.onopen = () => { clearTimeout(conectarEventos.t); faixaLigacao(null); verificarEstado() }
}

/* ---------- envio ---------- */
let anexos = []
// O campo e o Enviar ficam sempre disponíveis; com a conversa trabalhando, o Parar aparece ao lado.
function botoesTrabalho(ocupado) {
	$('#parar').hidden = !ocupado
	$('#enviar').textContent = ocupado ? 'Pôr na fila' : 'Enviar'
}

// Fila por conversa, como no Claude Code: Enter com a conversa trabalhando guarda a mensagem,
// que vai sozinha quando a resposta atual terminar. Dá para tirar da fila antes de ela ir.
function enfileirar(t, msg) {
	t.fila = [...(t.fila || []), { msg }]
	if (t.id === atual) desenharFila()
}
function desenharFila() {
	const caixa = $('#fila-visivel')
	const t = telas.get(atual)
	const fila = (!quadroAberto && t?.fila) || []
	caixa.innerHTML = ''
	caixa.hidden = !fila.length
	for (const item of fila) {
		const d = document.createElement('div')
		d.className = 'msg eu na-fila'
		d.innerHTML = '<div class="fila-rotulo">Na fila · vai quando a resposta atual terminar · <button type="button">tirar</button></div>'
		d.append(document.createTextNode(item.msg))
		d.querySelector('button').onclick = () => { t.fila = t.fila.filter((x) => x !== item); desenharFila() }
		caixa.append(d)
	}
	// Quando a mensagem nova muda a tarefa, não vale esperar: para a resposta atual e manda a fila na hora.
	if (fila.length && t.trabalhando) {
		const b = document.createElement('button')
		b.type = 'button'; b.className = 'opcao'; b.textContent = fila.length > 1 ? 'Interromper e mandar estas agora' : 'Interromper e mandar agora'
		b.onclick = () => { t.interrompidaParaFila = true; b.disabled = true; api('parar', { conversa: t.id }).catch((e) => aviso(e.message)) }
		caixa.append(b)
	}
}
// Tudo o que entrou na fila vai junto, num pedido só: a IA lê todas antes de agir (antes ia uma por vez,
// e ela começava a primeira sem saber que a segunda mudava o pedido).
function proximaDaFila(t) {
	const itens = t.fila || []
	t.fila = []
	if (t.id === atual) desenharFila()
	if (!itens.length) return
	for (const item of itens) desenhar(t, { tipo: 'eu', texto: item.msg, modelo })
	const nota = t.interrompidaParaFila ? 'Interrompi a resposta anterior para incluir isto. ' : ''
	t.interrompidaParaFila = false
	const msg = itens.length === 1 && !nota ? itens[0].msg
		: `${nota}Mandei ${itens.length > 1 ? 'estas mensagens' : 'esta mensagem'} enquanto você trabalhava. Leia tudo antes de agir; se houver conflito, vale a mais recente.\n\n` +
			itens.map((x, k) => (itens.length > 1 ? `${k + 1}. ` : '') + x.msg).join('\n\n')
	despachar(t, msg)
}

async function enviar(texto) {
	if (!atual) novaConversa()
	const t = telas.get(atual)
	let msg = texto.trim()
	if (anexos.length) msg = `Arquivos anexados:\n${anexos.map((a) => '- ' + a).join('\n')}\n\n${msg || 'Veja os arquivos anexados.'}`
	if (!msg) return
	anexos = []; desenharAnexos()
	t.vazia = false
	if (t.id.startsWith('nova-') && t.titulo === 'Nova conversa') { t.titulo = msg.replace(/\s+/g, ' ').slice(0, 60); $('#titulo').textContent = t.titulo; desenharAbas() }
	if (t.trabalhando) return enfileirar(t, msg)
	desenhar(t, { tipo: 'eu', texto: msg, modelo })
	despachar(t, msg)
	if (typeof avaliarDica === 'function') avaliarDica(t, msg)
}
async function despachar(t, msg) {
	t.ultima = msg
	t.trabalhando = true; if (t.id === atual) botoesTrabalho(true); desenharLista()
	blocoAtividade(t, true)
	try { await api('enviar', { conversa: t.id, texto: msg, modelo, nova: t.id.startsWith('nova-') }) }
	catch (e) { fecharBloco(t); t.trabalhando = false; botoesTrabalho(false); desenhar(t, { tipo: 'erro', texto: e.message, repetir: true }); desenharLista(); proximaDaFila(t) }
}
$('#form').onsubmit = (e) => { e.preventDefault(); const v = $('#entrada').value; $('#entrada').value = ''; enviar(v) }
$('#entrada').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#form').requestSubmit() } })
$('#parar').onclick = () => api('parar', { conversa: atual }).catch((e) => aviso(e.message))
$('#novo').onclick = novaConversa
$('#whats').onclick = () => enviar('Quero trazer o caso de uma cliente que me mandou tudo pelo WhatsApp. Liste minhas conversas mais recentes.')

/* ---------- ditado: fala, a Central transcreve neste computador e o texto entra no campo para revisar ---------- */
let ditado = null
$('#ditar').onclick = async () => {
	const botao = $('#ditar'), rotulo = botao.querySelector('span')
	if (ditado?.gravador) return ditado.gravador.stop()
	if (ditado) return // ainda transcrevendo o anterior
	let stream
	try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) }
	catch { return aviso('Não consegui usar o microfone. Confira se ele está ligado e se o Windows permite o acesso.') }
	const pedacos = []
	const gravador = new MediaRecorder(stream)
	ditado = { gravador }
	gravador.ondataavailable = (e) => e.data.size && pedacos.push(e.data)
	gravador.onstop = async () => {
		stream.getTracks().forEach((t) => t.stop())
		ditado.gravador = null
		botao.classList.remove('gravando')
		rotulo.textContent = 'Transcrevendo…'
		botao.disabled = true
		try {
			const { pcm } = await converter(new Blob(pedacos, { type: gravador.mimeType }))
			const r = await fetch('/api/ditado', { method: 'POST', headers: { 'x-token': token }, body: pcm.buffer })
			const j = await r.json().catch(() => ({}))
			if (j.encerrado) mostrarFimDoTeste(j.erro)
			if (!r.ok) throw new Error(j.erro || 'Não consegui transcrever o áudio.')
			if (!j.texto) throw new Error('Não entendi nada no áudio. Tente falar mais perto do microfone.')
			const campo = $('#entrada')
			campo.value = (campo.value.trim() ? campo.value.trimEnd() + ' ' : '') + j.texto
			campo.dispatchEvent(new Event('input'))
			campo.focus()
			aviso('Pronto: confira o texto antes de enviar.')
		} catch (e) { aviso(e.message) }
		finally { ditado = null; botao.disabled = false; rotulo.textContent = 'Ditar' }
	}
	gravador.start(1000)
	botao.classList.add('gravando')
	rotulo.textContent = 'Parar'
	aviso('Gravando: fale e clique em Parar quando terminar.')
}

/* ---------- anexos ---------- */
function desenharAnexos() {
	$('#anexos').innerHTML = anexos.map((a, i) => `<span class="anexo">${escapar(a.split(/[\\/]/).pop())}<button data-tirar="${i}" aria-label="Tirar anexo">×</button></span>`).join('')
	$('#anexos').querySelectorAll('[data-tirar]').forEach((b) => (b.onclick = () => { anexos.splice(+b.dataset.tirar, 1); desenharAnexos() }))
}
async function anexar(arquivos) {
	for (const f of arquivos) {
		try {
			const r = await fetch('/api/anexo?nome=' + encodeURIComponent(f.name), { method: 'POST', headers: { 'x-token': token }, body: f })
			const j = await r.json()
			if (!r.ok) throw new Error(j.erro)
			anexos.push(j.caminho)
		} catch (e) { aviso(`Não consegui anexar ${f.name}: ${e.message}`) }
	}
	desenharAnexos()
}
$('#anexar').onclick = () => $('#arquivo').click()
$('#arquivo').onchange = (e) => { anexar([...e.target.files]); e.target.value = '' }
const comp = $('#compositor')
comp.addEventListener('dragover', (e) => { e.preventDefault(); comp.classList.add('soltar') })
comp.addEventListener('dragleave', () => comp.classList.remove('soltar'))
comp.addEventListener('drop', (e) => { e.preventDefault(); comp.classList.remove('soltar'); anexar([...e.dataTransfer.files]) })

/* ---------- uso da conta (dados reais do motor) ---------- */
let usoAtual = null
function desenharUso(u) {
	usoAtual = u
	for (const [id, w] of [['5h', u?.cinco], ['semana', u?.semana]]) {
		$('#pct-' + id).textContent = w ? w.pct + '%' : '–'
		const b = $('#barra-' + id)
		b.style.width = (w ? w.pct : 0) + '%'
		b.classList.toggle('alto', !!w && w.pct >= 80)
	}
	$('#abrir-uso').title = u ? `Atualizado às ${new Date(u.atualizado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Aparece depois da primeira mensagem'
}
function renova(ms) {
	if (!ms) return ''
	const falta = ms - Date.now()
	if (falta <= 0) return 'Já renovou'
	const h = Math.floor(falta / 3600000), m = Math.round((falta % 3600000) / 60000)
	if (h < 24) return `Renova em ${h ? h + ' h ' : ''}${m} min`
	return 'Renova ' + new Date(ms).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
$('#abrir-uso').onclick = () => {
	const u = usoAtual
	const linha = (nome, w) => `<div class="uso-linha"><div class="cab"><strong>${nome}</strong><span>${w ? w.pct + '%' : '–'}</span></div><div class="barra"><span style="width:${w ? w.pct : 0}%"></span></div><small>${w ? renova(w.renova) : 'Sem dados ainda'}</small></div>`
	$('#uso-detalhe').innerHTML = u
		? linha('Limite de 5 horas', u.cinco) + linha('Semana', u.semana) + `<small style="color:var(--tinta-suave)">Atualizado às ${new Date(u.atualizado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>`
		: '<p style="margin:0">Os números aparecem depois da primeira mensagem enviada por aqui.</p>'
	$('#d-uso').showModal()
}

/* ---------- estado e ajustes ---------- */
async function verificarEstado() {
	try {
		const e = await api('estado')
		$('#conta-lateral').textContent = e.email || 'conta não conectada'
		const ok = e.motor && e.logado
		$('#ponto-motor').className = 'ponto' + (ok ? '' : ' alerta')
		$('#texto-motor').textContent = !e.motor ? 'Motor do Claude não encontrado' : !e.logado ? 'Conta do Claude desconectada' : 'Pronta para trabalhar'
		const c = await api('controle').catch(() => CONTROLE)
		const [textoVersao, versaoOk] = situacaoVersao(c)
		$('#ajustes-estado').innerHTML = [
			['Versão da Central', textoVersao, versaoOk],
			['Conta Claude', e.email || 'não conectada', e.logado],
			['Programa do Claude (vem com o VS Code)', e.versao || 'não encontrado', e.motor],
			['Skill da Central Jurídica', e.skill ? 'instalada' : 'não instalada', e.skill],
			['Conector do WhatsApp', e.whatsapp ? 'instalado' : 'não instalado', e.whatsapp],
			['Pasta onde o Claude trabalha nas conversas novas', e.pastaPadrao, true],
		].map(([n, v, bom]) => `<div class="linha-status"><div>${n}<small>${escapar(v)}</small></div><span class="${bom ? 'ok' : ''}" style="${bom ? '' : 'color:var(--carimbo)'}">${bom ? 'ok' : 'atenção'}</span></div>`).join('')
		if (!ok) {
			const msg = !e.motor
				? 'Não encontrei o motor do Claude. Ele vem com a extensão do Claude no VS Code: confira se o VS Code e a extensão estão instalados.'
				: CONTROLE.login === 'bloqueado' ? 'A conta do Claude saiu deste computador e o login está bloqueado. Fale com o Rafael.'
				: CONTROLE.login === 'autorizado' ? 'A conta do Claude saiu deste computador. O Rafael liberou o login: clique em "Entrar na conta do Claude".'
				: 'A conta do Claude não está conectada neste computador. Abra o VS Code uma vez, entre na conta pelo painel do Claude e volte para cá.'
			$('.aviso-motor')?.remove()
			$('#conversas').insertAdjacentHTML('afterbegin', `<div class="pedido alerta aviso-motor"><div class="tit">${icone('i-alerta')}${msg}</div>${e.motor && CONTROLE.login === 'autorizado' ? '<div class="opcoes"><button class="opcao principal" id="entrar-claude">Entrar na conta do Claude</button></div>' : ''}</div>`)
			const b = $('#entrar-claude')
			if (b) b.onclick = () => acaoBackup(b, async () => { await api('conta/conectar', {}); aviso('Entre na sua conta do Claude na janela que abriu e cole o código, se ela pedir.'); esperarLogin(null) })
		} else $('.aviso-motor')?.remove()
	} catch (err) { $('#texto-motor').textContent = err.message }
}
$('#abrir-ajustes').onclick = () => { verificarEstado(); carregarBackup(); carregarConta(); carregarRemoto(); $('#d-ajustes').showModal() }

/* ---------- versão beta: período de teste e troca de conta do Claude ---------- */
let EDICAO = { edicao: null }
function mostrarFimDoTeste(mensagem, titulo, det) {
	$('#fim-teste-titulo').textContent = titulo || 'Período de testes encerrado'
	$('#fim-teste-det').textContent = det || (titulo === 'Central em manutenção' ? 'Seus dados continuam neste computador. Quando o Rafael terminar, a Central volta sozinha.' : 'Obrigado por testar a Central Jurídica. Seus dados continuam guardados e criptografados neste computador.')
	$('#fim-teste-texto').textContent = mensagem || 'O período de testes terminou.'
	document.querySelectorAll('dialog[open]').forEach((d) => d.close())
	$('#fim-teste').hidden = false
	$('#app').inert = true
}
async function carregarEdicao() {
	try { EDICAO = await api('edicao') } catch { return }
	if (EDICAO.edicao !== 'beta') return
	document.title = 'Central Jurídica · beta'
	$('.marca strong').insertAdjacentHTML('beforeend', '<span class="selo-beta">beta</span>')
	$('#ajustes-conta').hidden = false
	$('#ajustes-backup .det').textContent = 'Uma cópia por dia dos casos, da agenda e do cofre, criptografada com a senha do escritório: sem ela o arquivo não abre. Fica neste computador.'
	if (EDICAO.encerrado) mostrarFimDoTeste(EDICAO.mensagem)
}
async function carregarConta() {
	if (EDICAO.edicao !== 'beta') return
	try {
		const [e, b] = await Promise.all([api('estado'), api('conta/backups', {})])
		$('#conta-email').textContent = e.logado ? e.email || 'conectada' : 'nenhuma conta conectada'
		$('#conta-trocar').hidden = !e.logado
		$('#conta-conectar').hidden = !!e.logado
		$('#conta-conectar').disabled = CONTROLE.login === 'bloqueado'
		$('#conta-conectar').textContent = CONTROLE.login === 'bloqueado' ? 'Login bloqueado: fale com o Rafael' : 'Conectar conta'
		const ult = b.backups[0]
		$('#conta-ultimo-bkp').textContent = ult ? `${ult.nome.replace(/^completo-|\.cjcompleto$/g, '').replace(/^(\d{4})-(\d\d)-(\d\d)-(\d\d)-(\d\d).*/, '$3/$2/$1 às $4:$5')} · ${(ult.tamanho / 1048576).toFixed(1)} MB` : 'Ainda não foi feito'
		$('#conta-restaurar').disabled = !ult
		$('#conta-restaurar').dataset.nome = ult?.nome || ''
		$('#teste-ate').textContent = EDICAO.ate ? `até ${dataBR(EDICAO.ate)} às ${horaBR(EDICAO.ate)}` : 'sem prazo fixo: o Rafael avisa quando terminar'
	} catch (err) { $('#conta-email').textContent = err.message }
}
// Depois de abrir o login, confere a cada 3 s se a conta nova entrou (até 5 minutos).
function esperarLogin(anterior) {
	let n = 0
	const t = setInterval(async () => {
		if (++n > 100) return clearInterval(t)
		try {
			const e = await api('estado')
			if (e.logado && e.email !== anterior) { clearInterval(t); aviso(`Conta conectada: ${e.email}.`); verificarEstado(); carregarConta() }
		} catch {}
	}, 3000)
}
$('#conta-trocar').onclick = () => $('#d-trocar-conta').showModal()
$('#trocar-confirmar').onclick = (ev) => acaoBackup(ev.target, async () => {
	const antes = (await api('estado')).email
	const r = await api('conta/trocar', {})
	$('#d-trocar-conta').close()
	aviso(`Backup feito (${(r.tamanho / 1048576).toFixed(1)} MB). Entre na outra conta na janela que abriu.`)
	verificarEstado(); carregarConta(); esperarLogin(antes)
})
$('#conta-conectar').onclick = (ev) => acaoBackup(ev.target, async () => {
	await api('conta/conectar', {})
	aviso('Entre na sua conta do Claude na janela que abriu.')
	esperarLogin(null)
})
$('#conta-backup').onclick = (ev) => acaoBackup(ev.target, async () => {
	const r = await api('conta/backup', {})
	aviso(`Backup completo feito: ${(r.tamanho / 1048576).toFixed(1)} MB.`)
	carregarConta()
})
$('#conta-restaurar').onclick = (ev) => acaoBackup(ev.target, async () => {
	if (!confirm('Restaurar o último backup completo? Só volta o que estiver faltando; nada que já está aqui é apagado ou trocado.')) return
	const r = await api('conta/restaurar', { nome: ev.target.dataset.nome })
	aviso(`Restaurado: ${r.conversas} conversa(s), ${r.escritorio} registro(s) do escritório e ${r.arquivos} outro(s) arquivo(s).`)
	carregarLista()
})

/* ---------- backup do escritório (nos Ajustes) ---------- */
let pastaBackup = ''
async function carregarBackup() {
	try {
		const b = await api('escritorio/backup/estado', {})
		pastaBackup = b.pasta
		$('#bkp-pasta').textContent = b.pasta
		$('#bkp-ultimo').textContent = !b.configurado ? 'O escritório ainda não foi criado nesta Central: o backup começa depois disso.'
			: b.ultimo ? `${dataBR(b.ultimo)} às ${horaBR(b.ultimo)}` : 'Ainda não foi feito'
		$('#bkp-agora').disabled = !b.configurado
	} catch (e) { $('#bkp-ultimo').textContent = e.message }
}
async function acaoBackup(botao, fn) {
	const rotulo = botao.textContent
	botao.disabled = true; botao.textContent = 'Aguarde…'
	try { await fn() } catch (e) { aviso(e.message) } finally { botao.disabled = false; botao.textContent = rotulo; carregarBackup() }
}
$('#bkp-escolher').onclick = (e) => acaoBackup(e.target, async () => {
	const r = await api('escritorio/backup/escolher-pasta', {})
	if (r.escolhida) aviso('Pasta do backup alterada.')
})
$('#bkp-agora').onclick = (e) => acaoBackup(e.target, async () => {
	const r = await api('escritorio/backup/fazer', {})
	aviso(r ? `Backup feito: ${r.registros} registro(s) guardados.` : 'Nada para guardar ainda.')
})
// Acesso pelo celular (Portal): só na Central com login do escritório na nuvem (alfa).
async function carregarRemoto() {
	let r
	try { r = await api('remoto') } catch { return }
	$('#ajustes-remoto').hidden = !r.disponivel
	if (!r.disponivel) return
	$('#remoto-link').textContent = r.link
	$('#remoto-abrir').onclick = () => api('link', { url: r.link }).catch((e) => aviso(e.message))
	$('#remoto-sempre').checked = !!r.sempreLigada
	$('#remoto-situacao').textContent = !r.escritorioNaNuvem ? 'Entre no login do escritório (Escritório) para usar o link.'
		: r.erro ? 'Sem contato com a nuvem agora; tenta de novo sozinha.'
		: r.linkAberto ? 'O link está aberto agora.' : r.pedido ? `Último pedido pelo link: ${horaBR(r.pedido.em)}.` : 'Pronta para receber pedidos pelo link.'
}
$('#remoto-sempre').onchange = async (e) => {
	try { await api('remoto/sempre-ligada', { ligar: e.target.checked }); aviso(e.target.checked ? 'A Central vai ficar ligada (e liga sozinha com o Windows).' : 'A Central volta a fechar sozinha quando a janela fecha.') }
	catch (err) { e.target.checked = !e.target.checked; aviso(err.message) }
}
$('#sugestao-enviar').onclick =(e) => acaoBackup(e.target, async () => {
	const r = await api('sugestao', { texto: $('#sugestao-texto').value })
	$('#sugestao-texto').value = ''
	aviso(r.enviada ? 'Sugestão enviada ao Rafael. Obrigado!' : 'Sugestão guardada: vai para o Rafael assim que houver internet.')
})
$('#bkp-abrir').onclick =() => api('abrir', { caminho: pastaBackup }).catch((e) => aviso(e.message))
$('#bkp-restaurar').onclick = (e) => acaoBackup(e.target, async () => {
	const { arquivo } = await api('escritorio/backup/escolher-arquivo', {})
	if (!arquivo) return
	if (!confirm('Restaurar este backup? Só entra o que for mais novo do que o que já está aqui; nada é apagado.')) return
	const r = await api('escritorio/backup/restaurar', { arquivo })
	aviso(`Backup de ${dataBR(r.criadoEm)}: ${r.trazidos} de ${r.total} registro(s) trazidos.`)
})
function desenharModelo() {
	const nome = modelo === 'opus' ? 'Opus' : 'Sonnet'
	$('#pilula-modelo').textContent = modelo === 'opus' ? 'Opus · profundo' : 'Sonnet · econômico'
	$('#pilula-modelo').title = 'Motor de escrita: a Central abre sempre no Opus; trocar para o Sonnet vale até fechar. Clique para ver as opções.'
	$('#ajustes-modelo').textContent = nome
	$('#modelo').value = modelo
}
$('#modelo').onchange = (e) => { modelo = e.target.value; desenharModelo(); aviso(`Motor trocado para ${modelo === 'opus' ? 'Opus' : 'Sonnet'}.`) }
// Escolha explicada, em vez de trocar às cegas. A escolha fica lembrada para todas as conversas.
$('#pilula-modelo').onclick = () => {
	let d = $('#d-motor')
	if (!d) { d = document.createElement('dialog'); d.id = 'd-motor'; document.body.append(d) }
	const op = (v, nome, texto) => `<button class="atalho ${modelo === v ? 'escolhido' : ''}" data-motor="${v}"><strong>${nome}${modelo === v ? ' ✓' : ''}</strong><span>${texto}</span></button>`
	d.innerHTML = `<div class="janela"><h2>Motor de escrita</h2>
		<p class="det">A Central abre sempre no <b>Opus</b>. Se quiser poupar o limite da conta, troque para o Sonnet: vale para todas as conversas até você fechar a Central.</p>
		<div class="atalhos">${op('opus', 'Opus · profundo', 'O padrão: o melhor para peças, estratégia e revisão antes de protocolar. Gasta mais do limite.')}${op('sonnet', 'Sonnet · econômico', 'Para poupar o limite: pedidos simples, resumos e ajustes rápidos. Vale até fechar a Central.')}</div>
		<div class="fim"><button class="opcao discreta" data-fechar>Fechar</button></div></div>`
	d.querySelectorAll('[data-motor]').forEach((b) => (b.onclick = () => { modelo = b.dataset.motor; desenharModelo(); d.close(); aviso(`Motor: ${modelo === 'opus' ? 'Opus' : 'Sonnet'}. Vale até fechar a Central; ao abrir, volta ao Opus.`) }))
	d.querySelector('[data-fechar]').onclick = () => d.close()
	d.showModal()
}
$('#tema').onclick = () => {
	const escuro = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
	document.documentElement.dataset.theme = escuro ? 'light' : 'dark'
	localStorage.setItem('tema', document.documentElement.dataset.theme)
}
if (localStorage.getItem('tema')) document.documentElement.dataset.theme = localStorage.getItem('tema')

// "Versão da Central" nos Ajustes: qual está instalada e como está a atualização automática.
function situacaoVersao(c) {
	const v = c.versao || (typeof NOVIDADES !== 'undefined' ? NOVIDADES[0].versao : '')
	const hora = (ms) => `${dataBR(ms)} às ${horaBR(ms)}`
	if (!c.ativo) return [`${v} · atualização automática desligada nesta instalação`, true]
	if (c.pronta) return [`${v} · a versão ${c.pronta} já foi baixada e instala quando você fechar a Central`, true]
	if (c.baixando) return [`${v} · baixando a versão ${c.baixando.versao} (${Math.round((c.baixando.feito / c.baixando.total) * 100) || 0}%)`, true]
	if (c.atualizacao && !c.atualizacao.ok) return [`${v} · a última atualização (${c.atualizacao.versao}) não deu certo; a Central continua nesta versão e o Rafael já foi avisado`, false]
	if (/atualiza/.test(c.erro || '')) return [`${v} · não consegui baixar a versão nova agora; tento de novo sozinha`, false]
	if (!c.aceita) return [`${v} · aguardando o Rafael liberar as atualizações desta Central`, true]
	const conferido = c.ultimoContato ? ` · conferido ${hora(c.ultimoContato)}` : ''
	return [`${v} · em dia${c.atualizacao?.ok ? ` (atualizada em ${hora(new Date(c.atualizacao.em).getTime())})` : ''}${conferido}`, true]
}

/* ---------- controle pelo Rafael: manutenção, login, nome da beta, atualização ---------- */
let CONTROLE = { login: 'livre' }
let reabrindo = false
function aplicarControle(c) {
	const antes = CONTROLE
	CONTROLE = c
	if (c.bloqueio) return mostrarFimDoTeste(c.bloqueio.mensagem, c.bloqueio.titulo)
	// Liberado pelo Rafael: tira a tela de manutenção.
	if (antes.bloqueio && !$('#fim-teste').hidden) { $('#fim-teste').hidden = true; $('#app').inert = false; aviso('A Central foi liberada.'); carregarLista() }
	if (antes.login !== c.login) verificarEstado()
}
function mostrarReabrindo(tipo) {
	reabrindo = true
	mostrarFimDoTeste('Ela abre de novo sozinha em instantes, numa janela nova. Esta janela pode ser fechada.', tipo === 'atualizando' ? 'Atualizando a Central' : 'Reiniciando a Central', 'Nada se perde: conversas e dados ficam como estão.')
	setTimeout(() => window.close(), 8000)
}
function faixaLigacao(texto) {
	$('.faixa-ligacao')?.remove()
	if (texto) $('#conversas').insertAdjacentHTML('afterbegin', `<div class="pedido alerta faixa-ligacao"><div class="tit">${icone('i-alerta')}${escapar(texto)}</div></div>`)
}
addEventListener('offline', () => faixaLigacao('Este computador está sem internet. As respostas voltam a funcionar quando a conexão voltar; o que já foi escrito não se perde.'))
addEventListener('online', () => { faixaLigacao(null); aviso('A internet voltou.') })
// Erros da própria tela vão para o registro de erros do Rafael (o servidor limpa antes de enviar).
let errosTela = 0
const anotarErroTela = (m) => { if (++errosTela <= 20) fetch('/api/erro-tela', { method: 'POST', headers: { 'x-token': token, 'content-type': 'application/json' }, body: JSON.stringify({ mensagem: String(m).slice(0, 500) }) }).catch(() => {}) }
addEventListener('error', (e) => anotarErroTela(`${e.message} (${String(e.filename).split('/').pop()}:${e.lineno})`))
addEventListener('unhandledrejection', (e) => anotarErroTela('promessa: ' + (e.reason?.message || e.reason)))
async function carregarControle() {
	try { aplicarControle(await api('controle')) } catch { return }
	if (!CONTROLE.precisaNome) return
	// Beta: na primeira abertura, só o nome da advogada (quem preenche é o Rafael, na instalação).
	const d = document.createElement('dialog')
	d.innerHTML = `<div class="janela"><h2>Nome da advogada</h2><p class="det">Só para o Rafael saber de quem é esta Central. Nada mais é pedido.</p>
		<input id="nome-central" style="width:100%;border:1px solid var(--linha);border-radius:6px;padding:8px 10px;background:var(--fundo)" placeholder="Ex.: Dra. Maria Souza" maxlength="120">
		<div class="fim"><button class="opcao principal" id="nome-salvar">Salvar</button></div></div>`
	document.body.append(d)
	d.addEventListener('cancel', (e) => e.preventDefault())
	d.querySelector('#nome-salvar').onclick = async () => {
		try { await api('controle/nome', { nome: d.querySelector('#nome-central').value }); d.close(); d.remove(); aviso('Nome salvo.') } catch (e) { aviso(e.message) }
	}
	d.showModal()
}

/* ---------- início ---------- */
desenharModelo()
carregarEdicao()
carregarControle()
api('uso').then((r) => desenharUso(r.uso)).catch(() => {})
conectarEventos()
// O início (lista, quadro de avisos ou conversa nova) fica no fim de quadro.js, que carrega depois deste arquivo.
