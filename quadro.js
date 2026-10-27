// Quadro de avisos do dia: intimações (DJEN), mensagens novas no WhatsApp e peças editadas.
// A varredura é feita pelo servidor (avisos.mjs), sem gastar uso da conta Claude.
// Depende de app.js: $, api, aviso, escapar, telas, atual, novaConversa, enviar, desenharLista.
let quadroItens = []
let quadroChecagem = 0
let quadroAberto = false

const dataBR = (ms) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const horaBR = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

async function carregarQuadro() {
	try {
		const r = await api('avisos')
		quadroItens = r.itens || []
		quadroChecagem = r.ultimaChecagem || 0
	} catch (e) { aviso(e.message) }
	const qtd = $('#qtd-quadro')
	qtd.textContent = quadroItens.length || ''
	qtd.classList.toggle('tem', quadroItens.length > 0)
	if (quadroAberto) await desenharQuadro()
}

function mostrarQuadro() {
	quadroAberto = true
	if (!abas.includes(QUADRO)) abas.unshift(QUADRO)
	atual = null
	for (const t of telas.values()) t.el.hidden = true
	$('#quadro').hidden = false
	$('#compositor').hidden = true
	$('#titulo').textContent = 'Avisos do dia'
	$('#abrir-quadro').setAttribute('aria-current', 'true')
	desenharLista()
	desenharAbas()
	desenharFila()
	desenharQuadro()
}
function esconderQuadro() {
	quadroAberto = false
	$('#quadro').hidden = true
	$('#compositor').hidden = false
	$('#abrir-quadro').removeAttribute('aria-current')
	desenharAbas()
}

async function desenharQuadro() {
	const q = $('#quadro')
	let cfg = { oabs: [] }
	try { cfg = await api('avisos/config') } catch {}
	const grupos = [
		['intimacao', 'Intimações novas (Diário de Justiça Eletrônico Nacional)'],
		['whatsapp', 'Mensagens novas de clientes no WhatsApp'],
		['aprendizado', 'Peças que você editou'],
	]
	q.innerHTML = `<div class="quadro-topo">
			<div><h2>Avisos do dia</h2><small>${quadroChecagem ? `Última verificação: ${dataBR(quadroChecagem)} às ${horaBR(quadroChecagem)}` : 'Ainda não verificado'}</small></div>
			<div class="opcoes" style="margin:0">
				<button class="opcao" id="q-atualizar">Verificar agora</button>
				${quadroItens.length ? '<button class="opcao discreta" id="q-todos">Marcar todos como vistos</button>' : ''}
			</div>
		</div>`
	if (!cfg.oabs.length) {
		q.insertAdjacentHTML('beforeend', `<div class="pedido"><div class="tit">Cadastre sua OAB para receber as intimações</div>
			<div class="det">As intimações vêm do Diário de Justiça Eletrônico Nacional (CNJ), consultado pelo número da OAB. É gratuito e não precisa de senha.</div></div>`)
	}
	if (!quadroItens.length) q.insertAdjacentHTML('beforeend', '<p class="vazio-quadro">Nada novo por aqui. Quando sair intimação, chegar mensagem de cliente ou você editar uma peça entregue, aparece aqui.</p>')
	for (const [tipo, titulo] of grupos) {
		const itens = quadroItens.filter((i) => i.tipo === tipo)
		if (!itens.length) continue
		q.insertAdjacentHTML('beforeend', `<h3>${titulo} (${itens.length})</h3>`)
		if (tipo === 'intimacao') { for (const g of porProcesso(itens)) q.append(cartaoAviso(g[0], g.slice(1))); continue }
		for (const i of itens) q.append(cartaoAviso(i))
	}
	q.append(formularioOab(cfg.oabs))
	q.querySelector('#q-atualizar').onclick = async (e) => {
		e.target.disabled = true; e.target.textContent = 'Verificando…'
		try { await api('avisos/atualizar', {}) } catch (er) { aviso(er.message) }
		await carregarQuadro()
	}
	q.querySelector('#q-todos')?.addEventListener('click', async () => { await api('avisos/marcar', { todos: true }); await carregarQuadro() })
}

function cartaoAviso(i, anteriores = []) {
	const c = document.createElement('div')
	c.className = 'aviso-card ' + i.tipo
	let acoes = []
	if (i.tipo === 'intimacao') {
		// "Atualização no caso de Fulano": quem, o que aconteceu e o trecho que importa; o cabeçalho do tribunal fica no texto inteiro.
		const texto = i.texto ? semHtml(i.texto) : ''
		const titulo = i.pessoa ? `Atualização no caso de ${escapar(i.pessoa)}${i.contra ? ` <span class="contra">× ${escapar(i.contra)}</span>` : ''}` : `Processo ${escapar(i.processo || '')}`
		const destaques = [
			i.prazoCalculado ? `<span class="destaque">Prazo de ${escapar(i.prazo)} · vence em ${dataBR(new Date(i.prazoCalculado.fim + 'T12:00:00').getTime())} (calculado, confira)</span>`
				: i.prazo ? `<span class="destaque">Prazo mencionado: ${escapar(i.prazo)} · confira a contagem</span>` : '',
			i.audiencia ? `<span class="destaque">${escapar(i.audiencia)}</span>` : '',
		].join('')
		c.innerHTML = `<div class="cab"><span>${escapar(i.tribunal || '')} · ${escapar(i.orgao || '')}</span><span>${dataBR(i.quando)}</span></div>
			<div class="tit">${titulo}</div>
			<div class="resumo-ato"><b>${escapar(i.ato || 'Intimação')}</b>${i.classe ? ` · ${escapar(i.classe)}` : ''} · Processo ${escapar(i.processo || '')}</div>
			${destaques ? `<div class="destaques">${destaques}</div>` : ''}
			${i.prazoCalculado ? `<details class="conta-prazo"><summary>Como a Central calculou</summary><ul>${i.prazoCalculado.memoria.map((l) => `<li>${escapar(l)}</li>`).join('')}</ul></details>` : ''}
			<div class="corpo">${escapar(i.trecho || texto)}</div><div class="corpo inteiro">${escapar(texto)}</div>
			${anteriores.length ? `<details class="anteriores"><summary>Mais ${anteriores.length} atualização(ões) neste processo</summary>${anteriores.map((a) => `<div><b>${dataBR(a.quando)}</b> · ${escapar(a.ato || 'Intimação')}${a.prazo ? ` · prazo mencionado: ${escapar(a.prazo)}` : ''}${a.audiencia ? ` · ${escapar(a.audiencia)}` : ''}<br><span>${escapar((a.trecho || semHtml(a.texto || '')).slice(0, 240))}</span></div>`).join('')}</details>` : ''}`
		const todos = [i, ...anteriores]
		const contexto = todos.map((a) => `— Disponibilizada em ${dataBR(a.quando)} (${a.ato || 'Intimação'}):\n${a.texto ? semHtml(a.texto) : ''}`).join('\n\n')
		acoes = [
			['Perguntar sobre isso', 'principal', () => perguntar(i, `Recebi ${todos.length > 1 ? `${todos.length} intimações` : 'esta intimação'} no Diário de Justiça Eletrônico Nacional (processo ${i.processo}, ${i.tribunal}, ${i.orgao}${i.pessoa ? `, caso de ${i.pessoa}` : ''}).\n\n${contexto}\n\nO que ela pede de mim, qual o prazo provável (com as premissas) e o que preciso providenciar?`, todos)],
			['Ver texto inteiro', '', (b) => { c.classList.toggle('aberto'); b.textContent = c.classList.contains('aberto') ? 'Recolher' : 'Ver texto inteiro' }],
		]
		acoes.splice(1, 0, ['Criar prazo', '', () => criarPrazoDoAviso(i)], ['Abrir o caso', '', () => abrirCasoDoAviso(i)])
		if (i.link) acoes.push(['Abrir no site do tribunal', 'discreta', () => abrirLink(i.link)])
		acoes.push(['Marcar como visto', 'discreta', async () => { for (const a of todos) await api('avisos/marcar', { id: a.id }); await carregarQuadro() }])
	} else if (i.tipo === 'whatsapp') {
		c.innerHTML = `<div class="cab"><span>WhatsApp</span><span>${dataBR(i.quando)} às ${horaBR(i.quando)}</span></div>
			<div class="tit">${escapar(i.nome)}: ${i.naoLidas} mensagem(ns) nova(s)</div><div class="corpo">${escapar(i.resumo || '')}</div>`
		acoes = [['Ler a conversa', 'principal', () => perguntar(i, `Leia as mensagens novas da conversa do WhatsApp com ${i.nome} e me diga o que a cliente pede e o que preciso responder ou providenciar.`)]]
	} else if (i.tipo === 'aprendizado') {
		c.innerHTML = `<div class="cab"><span>Aprendizado</span><span>${dataBR(i.quando)}</span></div>
			<div class="tit">Você editou ${i.quantidade} peça(s) depois que eu entreguei</div><div class="corpo">Posso ver o que mudou para escrever mais parecido com você. Só guardo o que você aprovar.</div>`
		acoes = [['Aprender agora', 'principal', () => perguntar(i, 'Verifique as peças que você me entregou e que eu editei depois, e me proponha o que aprender do meu estilo.')]]
	}
	if (i.tipo !== 'intimacao') acoes.push(['Marcar como visto', 'discreta', async () => { await api('avisos/marcar', { id: i.id }); await carregarQuadro() }])
	const box = document.createElement('div')
	box.className = 'opcoes'
	for (const [rot, classe, fn] of acoes) {
		const b = document.createElement('button')
		b.className = ('opcao ' + classe).trim()
		b.textContent = rot
		b.onclick = () => fn(b)
		box.append(b)
	}
	c.append(box)
	return c
}

// Abre uma conversa nova já com o pedido; o aviso sai do quadro porque passa a ser tratado na conversa.
async function perguntar(i, texto, todos = [i]) {
	esconderQuadro()
	novaConversa()
	const t = telas.get(atual)
	t.titulo = i.tipo === 'intimacao' ? `Intimação · ${i.processo}` : i.tipo === 'whatsapp' ? `WhatsApp · ${i.nome}` : 'Aprender com as edições'
	$('#titulo').textContent = t.titulo
	await enviar(texto)
	Promise.all(todos.map((a) => api('avisos/marcar', { id: a.id }))).then(carregarQuadro).catch(() => {})
}

function formularioOab(oabs) {
	const d = document.createElement('div')
	d.className = 'aviso-card'
	d.style.borderLeftColor = 'var(--linha)'
	d.innerHTML = `<div class="tit">Minhas OABs</div><div class="corpo" style="max-height:none">As intimações são buscadas para cada número cadastrado aqui (pode ser mais de um, por exemplo de sócias).</div><div class="oabs"></div>
		<div class="opcoes"><button class="opcao discreta" data-acao="mais">Adicionar outra OAB</button><button class="opcao principal" data-acao="salvar">Salvar</button></div>`
	const lista = d.querySelector('.oabs')
	const linha = (o = {}) => {
		const l = document.createElement('div')
		l.className = 'oab-linha'
		l.innerHTML = `<input placeholder="Número" inputmode="numeric" value="${escapar(o.numero || '')}" aria-label="Número da OAB"><input class="uf" placeholder="UF" maxlength="2" value="${escapar(o.uf || '')}" aria-label="UF da OAB"><button class="opcao discreta" type="button">Tirar</button>`
		l.querySelector('button').onclick = () => { l.remove(); salvar(true) }
		lista.append(l)
	}
	for (const o of oabs.length ? oabs : [{}]) linha(o)
	d.querySelector('[data-acao="mais"]').onclick = () => linha()
	async function salvar(silencioso) {
		const novas = [...lista.querySelectorAll('.oab-linha')].map((l) => {
			const [n, u] = l.querySelectorAll('input')
			return { numero: n.value.replace(/\D/g, ''), uf: u.value.trim().toUpperCase() }
		}).filter((o) => o.numero && /^[A-Z]{2}$/.test(o.uf))
		try {
			await api('avisos/config', { oabs: novas })
			if (silencioso) aviso(novas.length ? 'OAB retirada.' : 'Nenhuma OAB cadastrada: as intimações deixam de ser buscadas.')
			else aviso(novas.length ? 'OAB salva. Buscando as intimações…' : 'Nenhuma OAB válida: use o número e a UF com 2 letras.')
		} catch (e) { aviso(e.message) }
	}
	d.querySelector('[data-acao="salvar"]').onclick = () => salvar(false)
	return d
}

$('#abrir-quadro').onclick = mostrarQuadro

/* ---------- início do app: abre no quadro quando há avisos novos ---------- */
carregarLista().then(async () => {
	await carregarQuadro()
	// Se ela já escolheu algo enquanto carregava (uma conversa, o Escritório), não muda de tela.
	if (atual || (typeof ESC !== 'undefined' && ESC.aberto) || (typeof quadroAberto !== 'undefined' && quadroAberto)) return
	if (quadroItens.length) mostrarQuadro()
	else novaConversa()
})

// Intimações do mesmo processo viram um cartão só: a mais recente na frente, as anteriores logo abaixo.
function porProcesso(itens) {
	const grupos = new Map()
	for (const i of [...itens].sort((a, b) => b.quando - a.quando)) {
		const k = i.processo || i.id
		if (!grupos.has(k)) grupos.set(k, [])
		grupos.get(k).push(i)
	}
	return [...grupos.values()]
}

// Avisos guardados antes da limpeza (versões antigas) ainda trazem HTML e CSS do tribunal no texto.
function semHtml(t) {
	const d = document.createElement('div')
	d.innerHTML = String(t).replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
	return (d.textContent || '').replace(/(^|\s)[#.]?[\w-]+\s*\{[^}]*\}\s*;?/g, ' ').replace(/\s+/g, ' ').trim()
}
