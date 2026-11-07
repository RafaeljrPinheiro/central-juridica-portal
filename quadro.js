// Quadro de avisos do dia: intimações (DJEN), mensagens novas no WhatsApp e peças editadas.
// A varredura é feita pelo servidor (avisos.mjs), sem gastar uso da conta Claude.
// Depende de app.js: $, api, aviso, escapar, telas, atual, novaConversa, enviar, desenharLista.
let quadroItens = []
let quadroChecagem = 0
let quadroAberto = false
let quadroQtdVistas = 0

const dataBR = (ms) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const horaBR = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

async function carregarQuadro() {
	try {
		const r = await api('avisos')
		quadroItens = r.itens || []
		quadroChecagem = r.ultimaChecagem || 0
		quadroQtdVistas = r.qtdVistas || 0
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

// Resumo do dia (automacao.mjs): depois de cada verificação, se houver intimação nova que pede providência e ainda
// não houve resumo hoje, abre uma conversa numa aba nova SEM tirar a advogada do que está fazendo.
let resumoEmAndamento = false
async function resumoAutomatico() {
	if (resumoEmAndamento || typeof tela !== 'function') return
	resumoEmAndamento = true
	try {
		const r = await api('automacao/resumo')
		if (!r?.texto) return
		await api('automacao/resumo-feito', { ids: r.ids, avisos: r.avisos || [] }) // antes de mandar: duas janelas não fazem dois resumos
		const id = 'nova-' + Math.random().toString(36).slice(2, 10)
		const t = tela(id, r.titulo)
		t.carregada = true; t.vazia = false; t.automatica = true
		if (!abas.includes(id)) abas.push(id)
		t.novidade = true
		enviarEm(t, r.texto)
		estadoMudou()
		aviso(`${r.titulo}: estou preparando o que chegou de importante. Está na aba nova.`)
	} catch {} finally { resumoEmAndamento = false }
}

// Lembrete de prazo (automacao.mjs, sem Claude): prazos e audiências de hoje até depois de amanhã, da agenda e das
// intimações. Cartão no topo dos Avisos do dia e um aviso por item por dia, mesmo com o quadro fechado.
let prazosVencendo = []
const QUANDO_PRAZO = ['Hoje', 'Amanhã', 'Depois de amanhã']
async function lembrarPrazos() {
	try { prazosVencendo = (await api('automacao/prazos')).prazos || [] } catch { return }
	const hoje = new Date().toLocaleDateString('sv-SE')
	let vistos = {}
	try { vistos = JSON.parse(localStorage.getItem('cj-lembretes') || '{}') } catch {}
	const novos = prazosVencendo.filter((p) => vistos[p.id] !== hoje)
	if (novos.length) {
		const p = novos[0]
		aviso(novos.length === 1 ? `${QUANDO_PRAZO[p.dias] || ''}: ${p.titulo}` : `${novos.length} prazos/audiências até depois de amanhã. O primeiro: ${QUANDO_PRAZO[p.dias] || ''}, ${p.titulo}. Veja nos Avisos do dia.`)
		for (const x of novos) vistos[x.id] = hoje
		try { localStorage.setItem('cj-lembretes', JSON.stringify(Object.fromEntries(Object.entries(vistos).filter(([, d]) => d === hoje)))) } catch {}
	}
	if (quadroAberto) desenharQuadro()
}
function cartaoPrazos() {
	const d = document.createElement('div')
	d.className = 'aviso-card prazos-vencendo'
	d.style.borderLeftColor = 'var(--alerta, #b3261e)'
	d.innerHTML = `<div class="tit">Vencendo até depois de amanhã (${prazosVencendo.length})</div>
		<ul class="lista-prazos">${prazosVencendo.map((p) => `<li><b>${QUANDO_PRAZO[p.dias] || p.data}</b> · ${escapar(p.titulo)}${p.aConferir ? ' <span class="det">(data a conferir)</span>' : ''}</li>`).join('')}</ul>
		<div class="det">${prazosVencendo.some((p) => p.origem === 'intimacao') ? 'Os que vieram das intimações ainda não estão na agenda: abra o Escritório para entrarem sozinhos.' : 'Da agenda do Escritório.'}</div>`
	return d
}

// Quantos dias para trás a busca olha (Minhas OABs › "Buscar publicações dos últimos"). Padrão 90.
let quadroDias = 90
let quadroAuto = { agenda: true, resumo: true }
const OPCOES_DIAS_QUADRO = [[30, '30 dias'], [60, '60 dias'], [90, '90 dias'], [180, '6 meses'], [365, '1 ano']]

async function desenharQuadro() {
	const q = $('#quadro')
	let cfg = { oabs: [] }
	try { cfg = await api('avisos/config') } catch {}
	quadroDias = cfg.dias || 90
	quadroAuto = cfg.auto || { agenda: true, resumo: true }
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
			<div class="det">As intimações vêm do Diário de Justiça Eletrônico Nacional (CNJ), consultado pelo número da OAB. É gratuito e não precisa de senha.</div>
			<div class="opcoes"><button class="opcao principal" id="q-cadastrar">Cadastrar minha OAB</button></div></div>`)
	}
	if (prazosVencendo.length) q.append(cartaoPrazos())
	// No topo: com centenas de intimações, no fim da lista ninguém veria o cartão.
	if (cfg.oabs.length) q.append(cartaoTribunais())
	if (!quadroItens.length && cfg.oabs.length) q.insertAdjacentHTML('beforeend', '<p class="vazio-quadro">Nada novo por aqui. Quando sair intimação, chegar mensagem de cliente ou você editar uma peça entregue, aparece aqui.</p>')
	for (const [tipo, titulo] of grupos) {
		const itens = quadroItens.filter((i) => i.tipo === tipo)
		if (!itens.length) continue
		if (tipo === 'intimacao') { q.append(...gruposDeIntimacoes(itens)); continue }
		q.insertAdjacentHTML('beforeend', `<h3>${titulo} (${itens.length})</h3>`)
		for (const i of itens) q.append(cartaoAviso(i))
	}
	if (quadroQtdVistas) q.append(secaoVistas())
	q.append(formularioOab(cfg.oabs))
	q.querySelector('#q-atualizar').onclick = async (e) => {
		e.target.disabled = true; e.target.textContent = 'Verificando…'
		try { await api('avisos/atualizar', {}) } catch (er) { aviso(er.message) }
		await carregarQuadro()
	}
	q.querySelector('#q-cadastrar')?.addEventListener('click', () => { const f = $('#q-oabs'); f?.scrollIntoView({ block: 'center', behavior: 'smooth' }); f?.querySelector('input')?.focus({ preventScroll: true }) })
	q.querySelector('#q-todos')?.addEventListener('click', async () => { await api('avisos/marcar', { todos: true }); await carregarQuadro() })
}

/* ---------- já vistas: para consultar o que passou batido (pedido do Rafael, 05/11) ---------- */
// Recolhida e carregada só quando ela abre (com centenas de intimações, não pesa a lista do dia). Mesmo período das novas.
function secaoVistas() {
	const s = document.createElement('details')
	s.className = 'grupo-intimacoes vistas'
	s.innerHTML = `<summary><h3><span class="g-tit">Já vistas</span> <span class="g-qtd">${quadroQtdVistas} intimação(ões) dos últimos ${quadroDias} dias</span></h3></summary>
		<p class="g-explica">As que você marcou como vistas. Abra para reler, perguntar ou criar o prazo; "Voltar para as novas" devolve ao quadro.</p>
		<input type="search" class="g-busca" placeholder="Buscar por nome, processo ou o que aconteceu" aria-label="Buscar nas já vistas">
		<div class="previas"></div>`
	let todas = null
	const lista = s.querySelector('.previas')
	const busca = s.querySelector('.g-busca')
	const desenhar = () => {
		const t = normalizarBusca(busca.value)
		const achadas = t ? todas.filter((i) => normalizarBusca([i.pessoa, i.contra, i.processo, i.ato, i.audiencia, i.tribunal, i.orgao, i.trecho].join(' ')).includes(t)) : todas
		const grupos = porProcesso(achadas)
		lista.replaceChildren(...grupos.slice(0, 60).map(linhaPrevia))
		if (!grupos.length) lista.innerHTML = `<p class="vazio-quadro">${t ? 'Nada encontrado com essa busca.' : `Nenhuma intimação vista nos últimos ${quadroDias} dias.`}</p>`
		else if (grupos.length > 60) lista.insertAdjacentHTML('beforeend', `<p class="g-explica">Mostrando 60 de ${grupos.length} processos. Use a busca para achar o que procura.</p>`)
	}
	s.addEventListener('toggle', async () => {
		if (!s.open || todas) return
		lista.innerHTML = '<p class="g-explica">Carregando…</p>'
		try { todas = ((await api('avisos/vistas')).itens || []).map((i) => ({ ...i, visto: true })) } catch (e) { todas = []; aviso(e.message) }
		desenhar()
	})
	busca.addEventListener('input', () => todas && desenhar())
	return s
}
const normalizarBusca = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/* ---------- intimações separadas pelo que pedem, em prévia de uma linha (pedido do Rafael, 04/11) ---------- */
// A separação vem do servidor (avisos.mjs, categoriaIntimacao: regra simples, sem IA). Cada processo vira uma linha;
// o cartão completo só é montado quando ela abre, e o texto inteiro só é buscado quando ela pede: economiza dados
// (a lista chega sem os textos) e token ("Perguntar" leva só a intimação escolhida).
const CATEGORIAS = [
	['audiencia', 'Audiências marcadas', 'Têm audiência mencionada no texto. Confira data, hora e local.'],
	['acao', 'Pedem providência', 'Têm prazo, citação ou decisão (sentença, decisão, acórdão, tutela).'],
	['info', 'Só para saber', 'Editais, pautas, certidões e despachos sem prazo. Dê uma olhada quando puder.'],
]
const POR_VEZ = 30

function gruposDeIntimacoes(itens) {
	const secoes = []
	const temUrgente = itens.some((i) => i.categoria === 'acao' || i.categoria === 'audiencia')
	for (const [cat, titulo, explica] of CATEGORIAS) {
		const doCat = itens.filter((i) => (i.categoria || 'acao') === cat)
		if (!doCat.length) continue
		const grupos = porProcesso(doCat)
		const s = document.createElement(cat === 'info' && temUrgente ? 'details' : 'section')
		s.className = 'grupo-intimacoes ' + cat
		s.dataset.categoria = cat
		const cab = `<span class="g-tit">${titulo}</span> <span class="g-qtd">${doCat.length} intimação(ões) em ${grupos.length} processo(s)</span>`
		s.innerHTML = s.tagName === 'DETAILS' ? `<summary><h3>${cab}</h3></summary>` : `<h3>${cab}</h3>`
		s.insertAdjacentHTML('beforeend', `<p class="g-explica">${explica}</p><div class="previas"></div>`)
		const lista = s.querySelector('.previas')
		let mostrados = 0
		const mais = () => {
			for (const g of grupos.slice(mostrados, mostrados + POR_VEZ)) lista.append(linhaPrevia(g))
			mostrados += POR_VEZ
			s.querySelector('.g-mais')?.remove()
			if (mostrados < grupos.length) {
				const b = Object.assign(document.createElement('button'), { className: 'opcao discreta g-mais', textContent: `Mostrar mais ${Math.min(POR_VEZ, grupos.length - mostrados)} de ${grupos.length - mostrados}` })
				b.onclick = mais
				s.append(b)
			}
		}
		mais()
		if (cat === 'info') {
			const b = Object.assign(document.createElement('button'), { className: 'opcao discreta g-vistos', textContent: 'Marcar todas estas como vistas' })
			b.onclick = async () => {
				if (!confirm(`Marcar as ${doCat.length} intimações de "Só para saber" como vistas?`)) return
				b.disabled = true
				for (const i of doCat) await api('avisos/marcar', { id: i.id })
				await carregarQuadro()
			}
			s.append(b)
		}
		secoes.push(s)
	}
	return secoes
}

// Uma linha por processo: data, tribunal, de quem é o caso, o que aconteceu e o prazo. Clicar abre o cartão completo.
function linhaPrevia(g) {
	const i = g[0]
	const l = document.createElement('div')
	l.className = 'previa ' + (i.categoria || '')
	const prazo = i.prazoCalculado ? `vence ${dataBR(new Date(i.prazoCalculado.fim + 'T12:00:00').getTime())}` : i.prazo ? `prazo ${i.prazo}` : ''
	const quem = i.pessoa ? i.pessoa + (i.contra ? ` × ${i.contra}` : '') : `Processo ${i.processo || ''}`
	l.innerHTML = `<button class="previa-linha" aria-expanded="false" data-id="${escapar(i.id)}">
		<span class="p-data">${dataBR(i.quando).slice(0, 5)}</span><span class="p-trib">${escapar(i.tribunal || '')}</span>
		<span class="p-quem">${escapar(quem)}</span><span class="p-ato">${escapar(i.audiencia || i.ato || 'Intimação')}${g.length > 1 ? ` <small>+${g.length - 1}</small>` : ''}</span>
		${prazo ? `<span class="p-prazo">${escapar(prazo)}</span>` : '<span></span>'}</button>`
	const b = l.querySelector('button')
	b.onclick = () => {
		const aberto = l.querySelector('.aviso-card')
		if (aberto) { aberto.remove(); b.setAttribute('aria-expanded', 'false'); return }
		l.append(cartaoAviso(i, g.slice(1)))
		b.setAttribute('aria-expanded', 'true')
	}
	return l
}

// Texto inteiro sob demanda (a lista chega sem ele). Guarda no próprio item depois de buscar.
async function textosDe(itens) {
	const faltam = itens.filter((i) => i.texto === undefined && i.temTexto !== false)
	if (faltam.length) {
		const r = await api('avisos/texto?id=' + encodeURIComponent(faltam.map((i) => i.id).join(',')))
		for (const i of faltam) i.texto = r.textos?.[i.id] || ''
	}
	return itens.map((i) => (i.texto ? semHtml(i.texto) : ''))
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
			${i.prazoCalculado ? `<details class="conta-prazo"><summary>Como o BDS Jus calculou</summary><ul>${i.prazoCalculado.memoria.map((l) => `<li>${escapar(l)}</li>`).join('')}</ul></details>` : ''}
			<div class="corpo">${escapar(i.trecho || texto)}</div><div class="corpo inteiro">${escapar(texto)}</div>
			${anteriores.length ? `<details class="anteriores"><summary>Mais ${anteriores.length} atualização(ões) neste processo</summary>${anteriores.map((a) => `<div><b>${dataBR(a.quando)}</b> · ${escapar(a.ato || 'Intimação')}${a.prazo ? ` · prazo mencionado: ${escapar(a.prazo)}` : ''}${a.audiencia ? ` · ${escapar(a.audiencia)}` : ''}<br><span>${escapar((a.trecho || semHtml(a.texto || '')).slice(0, 240))}</span></div>`).join('')}</details>` : ''}`
		const todos = [i, ...anteriores]
		// Economia de token: só a intimação escolhida vai inteira; as anteriores do processo vão resumidas em uma linha.
		// Se a IA precisar do texto de alguma, ela pede (ou lê do banco local pelo pacote de tribunais).
		const perguntarSobre = async () => {
			const [inteiro] = await textosDe([i])
			const resumoAnteriores = anteriores.map((a) => `— ${dataBR(a.quando)} · ${a.ato || 'Intimação'}${a.prazo ? ` · prazo mencionado: ${a.prazo}` : ''}${a.audiencia ? ` · ${a.audiencia}` : ''}: ${(a.trecho || '').replace(/\s+/g, ' ').slice(0, 200)}…`).join('\n')
			await perguntar(i, `Recebi esta intimação no Diário de Justiça Eletrônico Nacional (processo ${i.processo}, ${i.tribunal}, ${i.orgao}${i.pessoa ? `, caso de ${i.pessoa}` : ''}), disponibilizada em ${dataBR(i.quando)}:\n\n${inteiro}${anteriores.length ? `\n\nAnteriores neste processo (só o resumo; se precisar do texto inteiro de alguma, me diga qual):\n${resumoAnteriores}` : ''}\n\nO que ela pede de mim, qual o prazo provável (com as premissas) e o que preciso providenciar?`, todos)
		}
		acoes = [
			['Perguntar sobre isso', 'principal', perguntarSobre],
			['Ver texto inteiro', '', async (b) => {
				if (!c.classList.contains('aberto')) {
					b.disabled = true; b.textContent = 'Carregando…'
					try { const [t] = await textosDe([i]); c.querySelector('.corpo.inteiro').textContent = t || 'O texto inteiro não está mais guardado: abra no site do tribunal.' } catch (e) { aviso(e.message) }
					b.disabled = false
				}
				c.classList.toggle('aberto'); b.textContent = c.classList.contains('aberto') ? 'Recolher' : 'Ver texto inteiro'
			}],
		]
		acoes.splice(1, 0, ['Criar prazo', '', () => criarPrazoDoAviso(i)], ['Abrir o caso', '', () => abrirCasoDoAviso(i)])
		// Entrar com o certificado e trazer eventos/decisão para a Central (tribunal.mjs): só endereço oficial.
		if (typeof temEnderecoOficial === 'function' && temEnderecoOficial({ link: i.link, tribunal: i.tribunal }))
			acoes.push([rotuloConsulta({ processo: i.processo, tribunal: i.tribunal, link: i.link }), '', () => abrirNoTribunal({ processo: i.processo, tribunal: i.tribunal, link: i.link })])
		if (i.link) acoes.push(['Abrir no site do tribunal', 'discreta', () => abrirLink(i.link)])
		if (i.visto) acoes.push(['Voltar para as novas', 'discreta', async () => { for (const a of todos) await api('avisos/desmarcar', { id: a.id }); await carregarQuadro() }])
		else acoes.push(['Marcar como visto', 'discreta', async () => { for (const a of todos) await api('avisos/marcar', { id: a.id }); await carregarQuadro() }])
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
	d.id = 'q-oabs'
	d.style.borderLeftColor = 'var(--linha)'
	// O botão de salvar fica junto das OABs (só elas precisam dele: período e automações salvam na hora). Teste de UX, 06/11.
	d.innerHTML = `<div class="tit">Minhas OABs</div><div class="corpo" style="max-height:none">As intimações são buscadas para cada número cadastrado aqui (pode ser mais de um, por exemplo de sócias).</div><div class="oabs"></div>
		<div class="opcoes"><button class="opcao principal" data-acao="salvar">${oabs.length ? 'Salvar as OABs' : 'Salvar a OAB'}</button><button class="opcao discreta" data-acao="mais">Adicionar outra OAB</button></div>
		<div class="tit" style="margin-top:14px">Período e automações <span class="det" style="font-weight:400">(mudanças valem na hora)</span></div>
		<label class="oab-periodo">Buscar publicações dos últimos
			<select id="q-dias" aria-label="Período da busca">${OPCOES_DIAS_QUADRO.map(([v, t]) => `<option value="${v}"${v === quadroDias ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
		<div class="corpo" style="max-height:none;font-size:.9em">Período maior traz intimações mais antigas. A primeira busca demora um pouco mais; depois só o último mês é buscado de novo.</div>
		<div class="tit" style="margin-top:14px">O que o BDS Jus faz sozinho</div>
		<label class="oab-auto"><input type="checkbox" id="q-auto-agenda"${quadroAuto.agenda !== false ? ' checked' : ''}> Pôr na agenda do Escritório as intimações com prazo ou audiência, no caso do mesmo processo, marcadas "a conferir" (não usa o seu limite do Claude)</label>
		<label class="oab-auto"><input type="checkbox" id="q-auto-resumo"${quadroAuto.resumo !== false ? ' checked' : ''}> Uma vez por dia, abrir uma conversa com o resumo do que chegou de importante: o que fazer e o prazo conferido (usa o seu limite do Claude)</label>`
	const lista = d.querySelector('.oabs')
	const linha = (o = {}) => {
		const l = document.createElement('div')
		l.className = 'oab-linha'
		l.innerHTML = `<input placeholder="Número" inputmode="numeric" value="${escapar(o.numero || '')}" aria-label="Número da OAB"><input class="uf" placeholder="UF" maxlength="2" value="${escapar(o.uf || '')}" aria-label="UF da OAB"><button class="opcao discreta" type="button">Tirar</button>`
		const tirar = l.querySelector('button')
		tirar.hidden = !o.numero // linha em branco: "Tirar" não tira nada
		tirar.onclick = () => { l.remove(); salvar(true) }
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
	for (const [id, chave] of [['#q-auto-agenda', 'agenda'], ['#q-auto-resumo', 'resumo']]) {
		d.querySelector(id).onchange = async (ev) => {
			const auto = { ...quadroAuto, [chave]: ev.target.checked }
			try { await api('avisos/config', { auto }); quadroAuto = auto; aviso(ev.target.checked ? 'Ligado.' : 'Desligado.') } catch (e) { aviso(e.message); ev.target.checked = !ev.target.checked }
		}
	}
	d.querySelector('#q-dias').onchange = async (ev) => {
		const dias = Number(ev.target.value)
		try {
			await api('avisos/config', { dias })
			quadroDias = dias
			aviso(`Período: últimos ${OPCOES_DIAS_QUADRO.find(([v]) => v === dias)?.[1] || dias + ' dias'}. Buscando as intimações…`)
		} catch (e) { aviso(e.message) }
	}
	return d
}

// "De onde vêm suas publicações": contagem por tribunal nos últimos 30 dias, para conferir se um tribunal
// (ex.: TJSP) está chegando. Vem do banco local do pacote central_juridica, sem consultar o DJEN de novo.
function cartaoTribunais() {
	const d = document.createElement('div')
	d.className = 'aviso-card tribunais'
	d.id = 'q-tribunais'
	d.style.borderLeftColor = 'var(--linha)'
	d.innerHTML = '<div class="tit">De onde vêm suas publicações</div><div class="corpo" style="max-height:none">Carregando…</div>'
	api('avisos/tribunais').then((r) => {
		const corpo = d.querySelector('.corpo')
		if (!r.disponivel) { corpo.textContent = 'Disponível depois da próxima atualização do BDS Jus.'; return }
		const erro = r.erro ? `<div class="destaque erro-fonte">Última busca no DJEN falhou: ${escapar(r.erro.mensagem)}. Mostrando o que já estava guardado.</div>` : ''
		if (!r.tribunais.length) {
			corpo.innerHTML = `${erro}Nenhuma publicação nos últimos ${quadroDias} dias para as OABs cadastradas. Clique em <b>Verificar agora</b> para buscar.`
			return
		}
		const total = r.tribunais.reduce((s, t) => s + t.total, 0)
		corpo.innerHTML = `${erro}<p>Nos últimos ${quadroDias} dias chegaram <b>${total}</b> publicações de <b>${r.tribunais.length}</b> tribunal(is). A busca é pelo número da OAB no Diário de Justiça Eletrônico Nacional, que reúne todos os tribunais.</p>
			<div class="lista-tribunais">${r.tribunais.map((t, k) => `<span class="chip-tribunal${k >= 10 ? ' extra' : ''}" title="Mais recente: ${escapar(t.ultima ? dataBR(new Date(t.ultima + 'T12:00:00').getTime()) : '')}"><b>${escapar(t.tribunal)}</b> ${t.total}${t.novas ? ` <em>+${t.novas}</em>` : ''}</span>`).join('')}${r.tribunais.length > 10 ? `<button class="ver-todos" type="button">ver todos os ${r.tribunais.length}</button>` : ''}</div>
			<p class="dica">Atua num tribunal que não aparece aqui? Confira se a publicação sai com o seu número de OAB. Se você tem OAB suplementar (outro estado), cadastre-a em <b>Minhas OABs</b>.</p>
			<div class="opcoes" style="margin:0"><button class="opcao discreta" id="q-ir-oabs">Minhas OABs</button><button class="opcao discreta" id="q-como">Como funciona</button></div>`
		d.querySelector('#q-como').onclick = () => tourPublicacoes()
		d.querySelector('.ver-todos')?.addEventListener('click', (ev) => {
			const l = d.querySelector('.lista-tribunais'), todos = l.classList.toggle('todos')
			ev.target.textContent = todos ? 'mostrar menos' : `ver todos os ${r.tribunais.length}`
		})
		d.querySelector('#q-ir-oabs').onclick = () => {
			const f = $('#q-oabs')
			f?.scrollIntoView({ block: 'center' })
			f?.querySelector('input')?.focus({ preventScroll: true })
		}
		// 1ª vez com dados na tela: o tour mostra a novidade sozinho (uma vez só; "Como funciona" repete).
		if (!tourQuadroVisto() && typeof tourAtivo === 'function' && !tourAtivo())
			setTimeout(() => { if (quadroAberto && !tourAtivo()) tourPublicacoes() }, 400)
	}).catch((e) => { d.querySelector('.corpo').textContent = e.message })
	return d
}

/* ---------- tour guiado da novidade (mesmo motor do Radar: public/tour.js) ---------- */
const TOUR_QUADRO = 'cj-quadro-tour-tribunais'
function tourQuadroVisto() { try { return localStorage.getItem(TOUR_QUADRO) === '1' } catch { return false } }
function marcarTourQuadro() { try { localStorage.setItem(TOUR_QUADRO, '1') } catch {} }

function tourPublicacoes() {
	if (typeof tourGuiado !== 'function' || !$('#q-tribunais')) return
	const passos = [
		{ chapeu: 'Novidade · Publicações', titulo: 'Agora você vê de onde vem cada publicação.', botao: 'Mostrar',
			texto: 'O BDS Jus busca as suas publicações no <b>Diário de Justiça Eletrônico Nacional</b> (CNJ) pelo número da OAB. Ele reúne <b>todos os tribunais</b>: TJMG, TJSP, TRF6, TRTs e os demais. Agora a busca também traz <b>todas</b> as publicações, mesmo quando chegam centenas de uma vez, e guarda tudo neste computador.' },
		{ alvo: '#q-tribunais .lista-tribunais', chapeu: 'Passo 1 · Por tribunal', titulo: 'Quantas publicações de cada tribunal.',
			texto: `Cada etiqueta é um tribunal com o total dos últimos ${quadroDias} dias.` + ' O número em destaque (<b>+3</b>, por exemplo) são as que chegaram na última verificação. Serve para conferir, num relance, se o tribunal onde você atua está chegando.' },
		{ alvo: '#q-tribunais .dica', chapeu: 'Passo 2 · Faltou algum?', titulo: 'Se um tribunal não aparece.',
			texto: 'A publicação só chega se sair com o seu número de OAB. Se você atua em outro estado com <b>OAB suplementar</b>, ela tem outro número: cadastre também.' },
		{ alvo: '#q-ir-oabs', chapeu: 'Passo 3 · Minhas OABs', titulo: 'Cadastre todas as suas inscrições.',
			texto: 'Este botão leva ao cadastro, no fim do quadro. Lá, <b>Adicionar outra OAB</b> serve para a suplementar ou para as sócias do escritório. Cada publicação aparece uma vez só, mesmo que saia para mais de uma OAB.' },
		{ alvo: '#q-atualizar', chapeu: 'Passo 4 · Verificar', titulo: 'O BDS Jus verifica sozinho.',
			texto: 'A cada 30 minutos, com o BDS Jus aberto. Se quiser na hora, clique em <b>Verificar agora</b>. Se o Diário estiver fora do ar, você continua vendo o que já tinha chegado.' },
		{ alvo: '.grupo-intimacoes > h3, .grupo-intimacoes > summary', chapeu: 'Passo 5 · Separadas pelo que pedem', titulo: 'Primeiro o que pede providência.',
			texto: 'As intimações vêm em grupos: <b>Audiências marcadas</b>, <b>Pedem providência</b> (prazo, citação, decisão) e <b>Só para saber</b> (edital, pauta, despacho sem prazo), que fica recolhido. A separação é automática e não gasta o seu limite do Claude.' },
		{ alvo: '.previa-linha', chapeu: 'Passo 6 · Prévia', titulo: 'Uma linha por processo. Clique para abrir.',
			texto: 'Data, tribunal, de quem é o caso, o que aconteceu e o prazo. Clicando, abre o cartão com o trecho, <b>Criar prazo</b> e <b>Perguntar sobre isso</b>, que leva para a conversa só esta intimação (as anteriores vão resumidas), para gastar menos.' },
	].filter((p) => !p.alvo || document.querySelector(p.alvo)) // sem intimação na tela, o passo 5 sai
	tourGuiado(passos, { aoFim: marcarTourQuadro })
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

// Lembrete de prazo também ao abrir a Central (não só depois de cada verificação).
setTimeout(() => lembrarPrazos(), 4000)
