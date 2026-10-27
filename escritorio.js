// Escritório: casos, agenda e tarefas (kanban), semana por turno e cofre — cada advogada tem o próprio.
// Os dados chegam já decifrados pelo servidor local; aqui é só tela. Nada daqui vai para a IA sem pedido,
// e o cofre nunca vai.
const ESC = {
	aberto: false, vista: 'painel', dados: { casos: [], itens: [], equipe: [] }, estado: null,
	filtro: { resp: '', tipo: '', busca: '' }, semana: 0, etapaCasos: '',
}
const NOMES = {
	tipo: { prazo: 'Prazo', audiencia: 'Audiência', pericia: 'Perícia', tarefa: 'Tarefa', cobranca: 'Cobrança' },
	coluna: { afazer: 'A fazer', fazendo: 'Fazendo', aguardando: 'Aguardando terceiros', feito: 'Feito' },
	etapa: { atendimento: 'Atendimento', demanda: 'Demanda', administrativo: 'Administrativo', judicial: 'Judicial', encerrado: 'Encerrado' },
	turno: { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' },
}
const ORIGENS = ['Escritório', 'Defensoria', 'Estudos', 'Pessoal']
const hojeISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const dataCurta = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '')
const iniciais = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
const casoDe = (id) => ESC.dados.casos.find((c) => c.id === id)
const turnoDe = (i) => i.turno || (i.hora ? (i.hora < '12:00' ? 'manha' : i.hora < '18:00' ? 'tarde' : 'noite') : null)
// Situação pela data (a prioridade vem do vencimento; "crítico" é o único destaque manual)
function situacao(i) {
	if (i.coluna === 'feito' || !i.data) return null
	const h = hojeISO()
	if (i.data < h) return { classe: 'vencido', texto: 'Venceu' }
	if (i.data === h) return { classe: 'hoje', texto: 'Hoje' }
	if (i.data <= somaDias(h, 7)) return { classe: 'semana', texto: dataCurta(i.data) }
	return { classe: '', texto: dataCurta(i.data) }
}
async function apiEsc(acao, dados = {}) { return api('escritorio/' + acao, dados) }

/* ---------- abrir e fechar (a tela ocupa o lugar das conversas) ---------- */
function mostrarEscritorio() {
	if (typeof quadroAberto !== 'undefined' && quadroAberto) esconderQuadro()
	ESC.aberto = true
	for (const t of telas.values()) t.el.hidden = true
	$('#escritorio').hidden = false
	$('#compositor').hidden = true
	$('#abrir-escritorio').setAttribute('aria-current', 'true')
	document.querySelectorAll('.aba.ativa').forEach((a) => a.classList.remove('ativa'))
	carregarEscritorio()
}
function esconderEscritorio() {
	if (!ESC.aberto) return
	ESC.aberto = false
	$('#escritorio').hidden = true
	$('#compositor').hidden = false
	$('#abrir-escritorio').removeAttribute('aria-current')
}
// Abrir uma conversa, o quadro ou uma conversa nova fecha o escritório.
for (const nome of ['mostrar', 'mostrarQuadro', 'novaConversa']) {
	const original = window[nome]
	window[nome] = function (...a) { esconderEscritorio(); return original.apply(this, a) }
}

async function carregarEscritorio() {
	const el = $('#escritorio')
	try {
		ESC.estado = await api('escritorio/estado')
		if (!ESC.estado.configurado || !ESC.estado.desbloqueado) return desenharEntrada(el)
		const [casos, itens, equipe] = await Promise.all(['casos', 'itens', 'equipe'].map((c) => apiEsc('listar', { colecao: c }).then((r) => r.itens)))
		ESC.dados = { casos, itens, equipe: equipe.filter((p) => p.ativo !== false) }
		desenharEscritorio()
	} catch (e) { el.innerHTML = `<div class="esc-vazio">${escapar(e.message)}</div>` }
}

/* ---------- entrada: nuvem do escritório e senha do escritório ---------- */
function desenharEntrada(el) {
	const e = ESC.estado, nuvem = e.nuvem || {}
	const passo = e.nuvem && !nuvem.conectado ? 'nuvem' : !e.configurado ? 'sem-escritorio' : 'senha'
	el.innerHTML = `<div class="esc-entrada">
		<h2>Escritório</h2>
		<p class="det">Seus casos, prazos, agenda e cofre. Cada advogada tem o próprio escritório: ninguém vê o que é seu. Tudo vai embaralhado com a senha do seu escritório: nem o servidor consegue ler.</p>
		${passo === 'nuvem' ? `
			<form id="esc-f-nuvem" class="esc-form">
				<h3>1. Seu acesso</h3>
				<label>Seu e-mail<input name="email" type="email" required autocomplete="username"></label>
				<label>Sua senha <small>(sua, não a do escritório; mínimo 10 caracteres)</small><input name="senha" type="password" required minlength="10" autocomplete="current-password"></label>
				<div class="opcoes"><button class="opcao principal" value="entrar">Entrar</button><button class="opcao" value="criar">Primeiro acesso: criar minha senha</button><button type="button" class="opcao discreta" id="esc-esqueci">Esqueci minha senha</button></div>
			</form>` : ''}
		${passo === 'senha' ? `
			<form id="esc-f-senha" class="esc-form">
				<h3>${e.nuvem ? '2. ' : ''}Senha do seu escritório</h3>
				<p class="det">Pedida uma vez neste computador. Depois o Windows guarda, protegida.</p>
				<label>Seu nome<input name="nome" required value="${escapar(e.eu || '')}"></label>
				<label>Senha do seu escritório<input name="senha" type="password" required></label>
				<div class="opcoes"><button class="opcao principal">Abrir o escritório</button></div>
				<p class="det">Esta senha embaralha os seus dados e não tem como ser recuperada, nem pelo suporte. Se esqueceu, tente as senhas que costuma usar com calma: errar não apaga nada.</p>
			</form>` : ''}
		${passo === 'sem-escritorio' ? `
			<form id="esc-f-criar" class="esc-form">
				<h3>${e.nuvem ? '2. ' : ''}Criar o seu escritório</h3>
				<p class="det">Você ainda não tem escritório no servidor. Crie uma vez só; nos seus outros computadores, entre com o mesmo e-mail e esta senha.</p>
				<div class="pedido alerta"><div class="det">Se a senha do seu escritório se perder, ninguém recupera os dados, nem o suporte. Guarde-a num lugar seguro.</div></div>
				<label>Seu nome<input name="nome" required></label>
				<label>Senha do seu escritório <small>(mínimo 10 caracteres; pode ser diferente da senha de acesso)</small><input name="senha" type="password" required minlength="10"></label>
				<label>Repita a senha<input name="senha2" type="password" required></label>
				<div class="opcoes"><button class="opcao principal">Criar o escritório</button><button type="button" class="opcao discreta" id="esc-reverificar">Verificar de novo</button></div>
			</form>` : ''}
	</div>`
	const enviar = (form, fn) => form.addEventListener('submit', async (ev) => {
		ev.preventDefault()
		const botao = ev.submitter, rot = botao.textContent
		botao.disabled = true; botao.textContent = 'Aguarde…'
		try { await fn(Object.fromEntries(new FormData(form)), botao.value) ; await carregarEscritorio() }
		catch (er) { aviso(er.message); botao.disabled = false; botao.textContent = rot }
	})
	const fN = $('#esc-f-nuvem'), fS = $('#esc-f-senha'), fC = $('#esc-f-criar')
	if (fN) {
		enviar(fN, (d, acao) => apiEsc(acao === 'criar' ? 'nuvem/criar-acesso' : 'nuvem/entrar', d))
		// O e-mail traz um link que abre a página do celular (aqui ou no celular), onde ela cria a senha nova.
		$('#esc-esqueci').onclick = async (ev) => {
			const b = ev.target, email = fN.email.value.trim()
			b.disabled = true
			let msg = fN.querySelector('.esc-esqueci-msg')
			if (!msg) { msg = document.createElement('p'); msg.className = 'det esc-esqueci-msg'; fN.append(msg) }
			try {
				await apiEsc('nuvem/esqueci', { email })
				msg.textContent = `Se ${email} tem acesso, chega um e-mail com um link em instantes (olhe também o spam). Abra o link, crie a senha nova e entre aqui com ela.`
			} catch (e) { msg.textContent = e.message } finally { b.disabled = false }
		}
	}
	if (fS) enviar(fS, (d) => apiEsc('entrar', d))
	if (fC) {
		enviar(fC, async (d) => {
			if (d.senha !== d.senha2) throw new Error('As duas senhas não são iguais.')
			await apiEsc('criar', d)
			await apiEsc('salvar', { colecao: 'equipe', item: { nome: d.nome } })
		})
		$('#esc-reverificar').onclick = () => apiEsc('nuvem/sincronizar').catch(() => {}).then(carregarEscritorio)
	}
}

/* ---------- moldura: abas internas, busca, nuvem ---------- */
function desenharEscritorio() {
	const el = $('#escritorio')
	const n = ESC.estado.nuvem
	const sinc = !n ? (EDICAO.edicao === 'beta' ? '<span class="esc-nuvem">Guardado só neste computador, criptografado</span>' : '<span class="esc-nuvem alerta">Sem nuvem: só neste computador</span>') : !n.conectado ? '<span class="esc-nuvem alerta">Nuvem desconectada</span>'
		: n.erro ? `<span class="esc-nuvem alerta" title="${escapar(n.erro)}">Sem sincronizar: ${escapar(n.erro).slice(0, 60)}</span>`
		: `<span class="esc-nuvem">Sincronizado${n.ultima ? ' às ' + horaBR(n.ultima) : ''}</span>`
	el.innerHTML = `<div class="esc-topo">
			<div class="esc-vistas" role="tablist">${[['painel', 'Painel'], ['kanban', 'Tarefas'], ['semana', 'Semana'], ['casos', 'Casos']].map(([v, r]) => `<button role="tab" aria-selected="${ESC.vista === v}" data-vista="${v}">${r}</button>`).join('')}</div>
			<div class="esc-acoes">${sinc}${n ? '<button class="opcao" id="esc-sinc">Sincronizar</button>' : ''}<button class="opcao principal" id="esc-novo">+ Nova tarefa</button><button class="opcao" id="esc-novo-caso">+ Novo caso</button><button class="opcao" id="esc-atendimento">+ Atendimento</button><button class="opcao discreta" id="esc-equipe">Equipe</button></div>
		</div><div id="esc-corpo"></div>`
	el.querySelectorAll('[data-vista]').forEach((b) => (b.onclick = () => { ESC.vista = b.dataset.vista; desenharEscritorio() }))
	$('#esc-novo').onclick = () => editarItem({})
	$('#esc-novo-caso').onclick = () => editarCaso({})
	$('#esc-equipe').onclick = () => abrirEquipe()
	$('#esc-atendimento').onclick = () => abrirSustentacao(null, { modo: 'atendimento' })
	if ($('#esc-sinc')) $('#esc-sinc').onclick = async (e) => { e.target.disabled = true; try { await apiEsc('nuvem/sincronizar') } catch (er) { aviso(er.message) } carregarEscritorio() }
	const corpo = $('#esc-corpo')
	;({ painel: desenharPainel, kanban: desenharKanban, semana: desenharSemana, casos: desenharCasos })[ESC.vista](corpo)
}

/* ---------- painel: os números que importam hoje ---------- */
function desenharPainel(corpo) {
	const h = hojeISO(), sete = somaDias(h, 7)
	const abertos = ESC.dados.itens.filter((i) => i.coluna !== 'feito')
	const vencidos = abertos.filter((i) => i.data && i.data < h)
	const deHoje = abertos.filter((i) => i.data === h)
	const semana = abertos.filter((i) => i.data && i.data > h && i.data <= sete)
	const conferir = abertos.filter((i) => i.aConferir)
	const aguardando = abertos.filter((i) => i.coluna === 'aguardando')
	const cobrar = aguardando.filter((i) => i.proximaCobranca && i.proximaCobranca <= h)
	const agenda = abertos.filter((i) => ['audiencia', 'pericia'].includes(i.tipo) && i.data && i.data >= h && i.data <= sete)
	const concluidas7 = ESC.dados.itens.filter((i) => i.coluna === 'feito' && (i._versao || 0) >= Date.now() - 7 * 864e5)
	const tile = (num, rot, sub, classe = '', alvo = '') => `<button class="esc-tile ${classe}" data-alvo="${alvo}"><span class="num">${num}</span><span class="rot">${rot}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</button>`
	const prioridades = [...vencidos, ...deHoje, ...conferir.filter((i) => !vencidos.includes(i) && !deHoje.includes(i)), ...cobrar.filter((i) => !vencidos.includes(i))]
		.filter((i, k, a) => a.indexOf(i) === k).sort((a, b) => (a.data || '9') < (b.data || '9') ? -1 : 1).slice(0, 12)
	const casosAtivos = ESC.dados.casos.filter((c) => c.etapa !== 'encerrado')
	const porEtapa = Object.keys(NOMES.etapa).filter((e) => e !== 'encerrado').map((e) => [NOMES.etapa[e], casosAtivos.filter((c) => c.etapa === e).length])
	const pessoas = [...new Set([...ESC.dados.equipe.map((p) => p.nome), ...abertos.map((i) => i.responsavel).filter(Boolean)])]
	const porPessoa = pessoas.map((p) => [p, abertos.filter((i) => i.responsavel === p).length]).concat([['Sem responsável', abertos.filter((i) => !i.responsavel).length]]).filter(([, n]) => n)
	corpo.innerHTML = `<div class="esc-tiles">
			${tile(vencidos.length, 'Vencidos', vencidos.length ? '⚠ resolver primeiro' : 'nada atrasado', vencidos.length ? 'critico' : '', 'vencidos')}
			${tile(deHoje.length, 'Para hoje', '', deHoje.length ? 'destaque' : '', 'hoje')}
			${tile(semana.length, 'Próximos 7 dias', '', '', 'semana')}
			${tile(conferir.length, 'A conferir', 'prazos sugeridos', conferir.length ? 'atencao' : '', 'conferir')}
			${tile(aguardando.length, 'Aguardando terceiros', cobrar.length ? `${cobrar.length} para cobrar hoje` : '', '', 'aguardando')}
			${tile(agenda.length, 'Audiências e perícias', 'nos próximos 7 dias', '', 'agenda')}
			${tile(concluidas7.length, 'Concluídas', 'nos últimos 7 dias · ver todas', 'feitas', 'concluidas')}
		</div>
		<div class="esc-colunas">
			<section class="esc-cartao"><h3>Prioridades</h3>${prioridades.length ? prioridades.map(linhaItem).join('') : '<p class="esc-vazio">Nada urgente. Bom trabalho.</p>'}</section>
			<div>
				<section class="esc-cartao"><h3>Casos ativos por etapa <small>${casosAtivos.length} no total</small></h3>${barras(porEtapa)}</section>
				<section class="esc-cartao"><h3>Tarefas abertas por pessoa <small>${abertos.length} no total</small></h3>${barras(porPessoa)}</section>
			</div>
		</div>`
	corpo.querySelectorAll('.esc-tile').forEach((b) => (b.onclick = () => { if (b.dataset.alvo === 'concluidas') return mostrarConcluidas('7'); ESC.vista = 'kanban'; ESC.filtro.rapido = b.dataset.alvo; desenharEscritorio() }))
	ligarLinhas(corpo)
}
// Barras horizontais de uma cor só, com o número escrito (sem depender da cor).
function barras(pares) {
	const max = Math.max(1, ...pares.map(([, n]) => n))
	if (!pares.length) return '<p class="esc-vazio">Ainda sem dados.</p>'
	return `<div class="esc-barras" role="table">${pares.map(([r, n]) => `<div class="esc-barra" role="row" title="${escapar(r)}: ${n}"><span role="cell" class="r">${escapar(r)}</span><span role="cell" class="trilho">${n ? `<span style="width:${(n / max) * 100}%"></span>` : ''}</span><span role="cell" class="n">${n}</span></div>`).join('')}</div>`
}
function linhaItem(i) {
	const s = situacao(i), c = casoDe(i.casoId)
	return `<button class="esc-linha" data-item="${i.id}">
		<span class="esc-chip tipo-${i.tipo}">${NOMES.tipo[i.tipo]}</span>
		<span class="tit">${escapar(i.titulo || '(sem título)')}${c ? `<small>${escapar(c.cliente)}</small>` : ''}</span>
		${i.aConferir ? '<span class="esc-chip conferir">a conferir</span>' : ''}
		${s ? `<span class="esc-data ${s.classe}">${s.classe === 'vencido' ? '⚠ ' : ''}${escapar(s.texto)}</span>` : ''}
		${i.responsavel ? `<span class="esc-av" title="${escapar(i.responsavel)}">${iniciais(i.responsavel)}</span>` : ''}
	</button>`
}
function ligarLinhas(raiz) { raiz.querySelectorAll('[data-item]').forEach((b) => (b.onclick = () => editarItem(ESC.dados.itens.find((i) => i.id === b.dataset.item)))) }

/* ---------- concluídas: todas as demandas feitas, com período, pessoa e busca (pedido das advogadas, 26/10) ---------- */
// "Concluída em" = a última alteração da tarefa (quando foi para "Feito", se não mexeram depois).
function mostrarConcluidas(periodo = '7') {
	const f = { periodo, resp: '', busca: '' }
	const pessoas = [...new Set([...ESC.dados.equipe.map((p) => p.nome), ...ESC.dados.itens.map((i) => i.responsavel).filter(Boolean)])]
	const d = janela(`<h2>Concluídas</h2>
		<div class="esc-filtros">
			<select id="conc-periodo"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="mes">Este mês</option><option value="tudo">Tudo</option></select>
			<select id="conc-resp"><option value="">Todas as pessoas</option>${pessoas.map((p) => `<option>${escapar(p)}</option>`).join('')}</select>
			<input type="search" id="conc-busca" placeholder="Buscar tarefa ou cliente">
		</div>
		<p class="det" id="conc-total"></p>
		<div class="esc-lista" id="conc-lista"></div>
		<div class="fim"><span style="flex:1"></span><button type="button" class="opcao discreta" data-fechar>Fechar</button></div>`)
	const desenhar = () => {
		const agora = new Date()
		const desde = f.periodo === 'tudo' ? 0 : f.periodo === 'mes' ? new Date(agora.getFullYear(), agora.getMonth(), 1).getTime() : Date.now() - Number(f.periodo) * 864e5
		const b = f.busca.toLowerCase()
		const lista = ESC.dados.itens.filter((i) => i.coluna === 'feito' && (i._versao || 0) >= desde && (!f.resp || i.responsavel === f.resp) &&
			(!b || `${i.titulo} ${i.descricao} ${casoDe(i.casoId)?.cliente || ''}`.toLowerCase().includes(b))).sort((a, b2) => (b2._versao || 0) - (a._versao || 0))
		d.querySelector('#conc-total').textContent = `${lista.length} concluída(s)`
		d.querySelector('#conc-lista').innerHTML = lista.map((i) => linhaItem(i).replace('</button>', `<small class="esc-data">✓ ${i._versao ? dataBR(i._versao) : ''}</small></button>`)).join('') || '<p class="esc-vazio">Nada concluído neste período.</p>'
		d.querySelectorAll('#conc-lista [data-item]').forEach((x) => (x.onclick = () => { d.close(); editarItem(ESC.dados.itens.find((i) => i.id === x.dataset.item)) }))
	}
	d.querySelector('#conc-periodo').value = periodo
	d.querySelector('#conc-periodo').onchange = (e) => { f.periodo = e.target.value; desenhar() }
	d.querySelector('#conc-resp').onchange = (e) => { f.resp = e.target.value; desenhar() }
	d.querySelector('#conc-busca').oninput = (e) => { f.busca = e.target.value; desenhar() }
	desenhar()
}

/* ---------- kanban ---------- */
function filtrarItens() {
	const f = ESC.filtro, h = hojeISO(), sete = somaDias(h, 7), b = f.busca.toLowerCase()
	return ESC.dados.itens.filter((i) => {
		if (f.resp && i.responsavel !== f.resp) return false
		if (f.tipo && i.tipo !== f.tipo) return false
		if (b && !`${i.titulo} ${i.descricao} ${casoDe(i.casoId)?.cliente || ''}`.toLowerCase().includes(b)) return false
		const r = f.rapido
		if (r === 'vencidos') return i.coluna !== 'feito' && i.data && i.data < h
		if (r === 'hoje') return i.data === h
		if (r === 'semana') return i.data && i.data > h && i.data <= sete
		if (r === 'conferir') return i.aConferir && i.coluna !== 'feito'
		if (r === 'aguardando') return i.coluna === 'aguardando'
		if (r === 'agenda') return ['audiencia', 'pericia'].includes(i.tipo) && i.data >= h && i.data <= sete
		return true
	})
}
function barraFiltros() {
	const f = ESC.filtro
	const pessoas = [...new Set([...ESC.dados.equipe.map((p) => p.nome), ...ESC.dados.itens.map((i) => i.responsavel).filter(Boolean)])]
	const rapidos = { vencidos: 'Vencidos', hoje: 'Hoje', semana: 'Próximos 7 dias', conferir: 'A conferir', aguardando: 'Aguardando', agenda: 'Audiências e perícias' }
	return `<div class="esc-filtros">
		<input type="search" id="esc-busca" placeholder="Buscar tarefa ou cliente" value="${escapar(f.busca)}">
		<select id="esc-f-resp"><option value="">Todas as pessoas</option>${pessoas.map((p) => `<option ${p === f.resp ? 'selected' : ''}>${escapar(p)}</option>`).join('')}</select>
		<select id="esc-f-tipo"><option value="">Todos os tipos</option>${Object.entries(NOMES.tipo).map(([k, v]) => `<option value="${k}" ${k === f.tipo ? 'selected' : ''}>${v}</option>`).join('')}</select>
		${f.rapido ? `<button class="esc-chip filtro" id="esc-f-limpar">${rapidos[f.rapido]} ×</button>` : ''}
	</div>`
}
function ligarFiltros(redesenhar) {
	$('#esc-busca').oninput = (e) => { ESC.filtro.busca = e.target.value; redesenhar(true) }
	$('#esc-f-resp').onchange = (e) => { ESC.filtro.resp = e.target.value; redesenhar() }
	$('#esc-f-tipo').onchange = (e) => { ESC.filtro.tipo = e.target.value; redesenhar() }
	const l = $('#esc-f-limpar'); if (l) l.onclick = () => { ESC.filtro.rapido = ''; redesenhar() }
}
function desenharKanban(corpo, soColunas) {
	const itens = filtrarItens()
	const colunas = Object.keys(NOMES.coluna).map((col) => {
		let doCol = itens.filter((i) => i.coluna === col).sort((a, b) => (b.critico - a.critico) || ((a.data || '9') < (b.data || '9') ? -1 : 1))
		const total = doCol.length
		if (col === 'feito') doCol = doCol.sort((a, b) => b._versao - a._versao).slice(0, 15)
		return `<section class="esc-col" data-coluna="${col}"><h3>${NOMES.coluna[col]} <small>${total}</small></h3>
			<div class="esc-cards">${doCol.map(cartaoItem).join('') || '<p class="esc-vazio">—</p>'}</div>
			${col === 'feito' && total ? `<button type="button" class="opcao discreta esc-ver-concluidas">${total > 15 ? `+${total - 15} concluídas · ` : ''}Ver todas as concluídas</button>` : ''}</section>`
	}).join('')
	if (soColunas) { $('#esc-quadro').innerHTML = colunas } else corpo.innerHTML = barraFiltros() + `<div class="esc-quadro" id="esc-quadro">${colunas}</div>`
	if (!soColunas) ligarFiltros((busca) => desenharKanban(corpo, busca))
	const q = $('#esc-quadro')
	q.querySelectorAll('.esc-ver-concluidas').forEach((b) => (b.onclick = () => mostrarConcluidas('30')))
	q.querySelectorAll('.esc-card').forEach((c) => {
		c.onclick = () => editarItem(ESC.dados.itens.find((i) => i.id === c.dataset.item))
		c.ondragstart = (e) => { e.dataTransfer.setData('text/plain', c.dataset.item); c.classList.add('arrastando') }
		c.ondragend = () => c.classList.remove('arrastando')
	})
	q.querySelectorAll('.esc-col').forEach((col) => {
		col.ondragover = (e) => { e.preventDefault(); col.classList.add('alvo') }
		col.ondragleave = () => col.classList.remove('alvo')
		col.ondrop = async (e) => {
			e.preventDefault(); col.classList.remove('alvo')
			const item = ESC.dados.itens.find((i) => i.id === e.dataTransfer.getData('text/plain'))
			if (!item || item.coluna === col.dataset.coluna) return
			if (col.dataset.coluna === 'feito' && item.aConferir && !confirm('Este prazo ainda está "a conferir". Marcar como feito mesmo assim?')) return
			await salvarItem({ ...item, coluna: col.dataset.coluna }, true)
		}
	})
}
function cartaoItem(i) {
	const s = situacao(i), c = casoDe(i.casoId)
	return `<article class="esc-card ${i.critico ? 'critico' : ''}" draggable="true" data-item="${i.id}" tabindex="0">
		<div class="lin1"><span class="esc-chip tipo-${i.tipo}">${NOMES.tipo[i.tipo]}</span>${i.critico ? '<span class="esc-chip critico">crítico</span>' : ''}${i.aConferir ? '<span class="esc-chip conferir">a conferir</span>' : ''}</div>
		<div class="tit">${escapar(i.titulo || '(sem título)')}</div>
		${c ? `<div class="cli">${escapar(c.cliente)}</div>` : ''}
		${i.coluna === 'aguardando' && i.faltando ? `<div class="falta">Falta: ${escapar(i.faltando)}${i.proximaCobranca ? ` · cobrar ${dataCurta(i.proximaCobranca)}` : ''}</div>` : ''}
		<div class="lin2">${s ? `<span class="esc-data ${s.classe}">${s.classe === 'vencido' ? '⚠ ' : ''}${escapar(s.texto)}${i.hora ? ' ' + i.hora : ''}</span>` : '<span></span>'}${i.responsavel ? `<span class="esc-av" title="${escapar(i.responsavel)}">${iniciais(i.responsavel)}</span>` : ''}</div>
	</article>`
}

/* ---------- semana por turno (como a agenda semanal do escritório) ---------- */
function desenharSemana(corpo) {
	const h = hojeISO()
	const d = new Date(h + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + ESC.semana * 7)
	const dias = Array.from({ length: 6 }, (_, k) => somaDias(d.toISOString().slice(0, 10), k)) // segunda a sábado
	const itens = filtrarItens().filter((i) => i.data && dias.includes(i.data))
	const cel = (dia, turno) => itens.filter((i) => i.data === dia && (turnoDe(i) || 'semturno') === turno).map(cartaoItem).join('')
	corpo.innerHTML = barraFiltros() + `<div class="esc-semana-nav"><button class="opcao" id="esc-sem-ant">‹ Semana anterior</button><strong>${dataCurta(dias[0])} a ${dataCurta(dias[5])}</strong><button class="opcao" id="esc-sem-hoje">Esta semana</button><button class="opcao" id="esc-sem-prox">Próxima semana ›</button></div>
		<div class="esc-semana" style="grid-template-columns: 90px repeat(6, minmax(140px, 1fr))">
			<div></div>${dias.map((dia) => `<div class="cab ${dia === h ? 'hoje' : ''}">${dataCurta(dia)}</div>`).join('')}
			${['manha', 'tarde', 'noite', 'semturno'].map((t) => `<div class="turno">${NOMES.turno[t] || 'Sem turno'}</div>${dias.map((dia) => `<div class="cel" data-dia="${dia}" data-turno="${t}">${cel(dia, t)}</div>`).join('')}`).join('')}
		</div>`
	ligarFiltros(() => desenharSemana(corpo))
	$('#esc-sem-ant').onclick = () => { ESC.semana--; desenharSemana(corpo) }
	$('#esc-sem-prox').onclick = () => { ESC.semana++; desenharSemana(corpo) }
	$('#esc-sem-hoje').onclick = () => { ESC.semana = 0; desenharSemana(corpo) }
	corpo.querySelectorAll('.esc-card').forEach((c) => {
		c.onclick = () => editarItem(ESC.dados.itens.find((i) => i.id === c.dataset.item))
		c.ondragstart = (e) => e.dataTransfer.setData('text/plain', c.dataset.item)
	})
	corpo.querySelectorAll('.cel').forEach((cel) => {
		cel.ondblclick = () => editarItem({ data: cel.dataset.dia, turno: cel.dataset.turno === 'semturno' ? null : cel.dataset.turno })
		cel.ondragover = (e) => e.preventDefault()
		cel.ondrop = async (e) => {
			e.preventDefault()
			const item = ESC.dados.itens.find((i) => i.id === e.dataTransfer.getData('text/plain'))
			if (item) await salvarItem({ ...item, data: cel.dataset.dia, turno: cel.dataset.turno === 'semturno' ? null : cel.dataset.turno }, true)
		}
	})
}

/* ---------- casos ---------- */
function desenharCasos(corpo) {
	const b = (ESC.filtro.busca || '').toLowerCase(), h = hojeISO()
	const casos = ESC.dados.casos.filter((c) => (!ESC.etapaCasos || c.etapa === ESC.etapaCasos) && (!b || `${c.cliente} ${c.assunto} ${c.processos.map((p) => p.numero).join(' ')} ${c.outrasPartes.join(' ')}`.toLowerCase().includes(b)))
		.sort((x, y) => x.cliente.localeCompare(y.cliente, 'pt-BR'))
	const proximo = (c) => ESC.dados.itens.filter((i) => i.casoId === c.id && i.coluna !== 'feito' && i.data).sort((a, b) => (a.data < b.data ? -1 : 1))[0]
	corpo.innerHTML = `<div class="esc-filtros">
			<input type="search" id="esc-busca-casos" placeholder="Buscar cliente, assunto, parte ou nº do processo" value="${escapar(ESC.filtro.busca)}">
			<div class="esc-etapas">${[['', 'Todos'], ...Object.entries(NOMES.etapa)].map(([k, v]) => `<button class="esc-chip filtro ${ESC.etapaCasos === k ? 'ativo' : ''}" data-etapa="${k}">${v} <small>${k ? ESC.dados.casos.filter((c) => c.etapa === k).length : ESC.dados.casos.length}</small></button>`).join('')}</div>
		</div>
		<div class="esc-tabela-caixa"><table class="esc-tabela"><thead><tr><th>Cliente</th><th>Assunto</th><th>Etapa</th><th>Responsável</th><th>Próximo compromisso</th><th>Abertas</th></tr></thead><tbody>
		${casos.map((c) => { const p = proximo(c), s = p && situacao(p); return `<tr data-caso="${c.id}" tabindex="0"><td><b>${escapar(c.cliente)}</b>${c.processos[0] ? `<small>${escapar(c.processos[0].numero)}</small>` : ''}</td><td>${escapar(c.assunto)}</td><td><span class="esc-chip">${NOMES.etapa[c.etapa]}</span></td><td>${escapar(c.responsavel)}</td><td>${p ? `<span class="esc-data ${s?.classe || ''}">${s?.classe === 'vencido' ? '⚠ ' : ''}${escapar(s?.texto || dataCurta(p.data))}</span> ${escapar(p.titulo)}` : '—'}</td><td>${ESC.dados.itens.filter((i) => i.casoId === c.id && i.coluna !== 'feito').length}</td></tr>` }).join('') || `<tr><td colspan="6" class="esc-vazio">${ESC.dados.casos.length ? 'Nenhum caso com esse filtro.' : 'Nenhum caso ainda. Use "+ Novo caso".'}</td></tr>`}
		</tbody></table></div>`
	$('#esc-busca-casos').oninput = (e) => { ESC.filtro.busca = e.target.value; const pos = e.target.selectionStart; desenharCasos(corpo); const i = $('#esc-busca-casos'); i.focus(); i.setSelectionRange(pos, pos) }
	corpo.querySelectorAll('[data-etapa]').forEach((b) => (b.onclick = () => { ESC.etapaCasos = b.dataset.etapa; desenharCasos(corpo) }))
	corpo.querySelectorAll('[data-caso]').forEach((tr) => { tr.onclick = () => abrirCaso(casoDe(tr.dataset.caso)); tr.onkeydown = (e) => { if (e.key === 'Enter') tr.onclick() } })
}

/* ---------- janelas de edição ---------- */
function janela(html) {
	let d = $('#d-esc')
	if (!d) { d = document.createElement('dialog'); d.id = 'd-esc'; document.body.append(d) }
	d.innerHTML = `<div class="janela esc-janela">${html}</div>`
	d.showModal()
	d.querySelectorAll('[data-fechar]').forEach((b) => (b.onclick = () => d.close()))
	return d
}
const opcoesPessoas = (atual) => `<option value="">—</option>${[...new Set([...ESC.dados.equipe.map((p) => p.nome), atual].filter(Boolean))].map((p) => `<option ${p === atual ? 'selected' : ''}>${escapar(p)}</option>`).join('')}<option value="__nova">+ Adicionar pessoa…</option>`
const opcoesCasos = (atual) => `<option value="">Sem caso</option>${[...ESC.dados.casos].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR')).map((c) => `<option value="${c.id}" ${c.id === atual ? 'selected' : ''}>${escapar(c.cliente)}${c.assunto ? ' · ' + escapar(c.assunto) : ''}</option>`).join('')}`
async function pessoaNova(select) {
	if (select.value !== '__nova') return
	const nome = prompt('Nome da pessoa da equipe:')
	if (!nome?.trim()) { select.value = ''; return }
	await apiEsc('salvar', { colecao: 'equipe', item: { nome: nome.trim() } })
	ESC.dados.equipe.push({ nome: nome.trim() })
	select.insertAdjacentHTML('afterbegin', `<option selected>${escapar(nome.trim())}</option>`)
	select.value = nome.trim()
}

function editarItem(i) {
	const novo = !i.id
	const d = janela(`<h2>${novo ? 'Nova tarefa' : 'Editar'}</h2>
		<form class="esc-form" id="esc-f-item">
			<label>O que fazer<input name="titulo" required value="${escapar(i.titulo || '')}" placeholder="Ex.: Manifestação sobre o laudo"></label>
			<div class="esc-grade tres">
				<label>Tipo<select name="tipo">${Object.entries(NOMES.tipo).map(([k, v]) => `<option value="${k}" ${k === (i.tipo || 'tarefa') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
				<label>Coluna<select name="coluna">${Object.entries(NOMES.coluna).map(([k, v]) => `<option value="${k}" ${k === (i.coluna || 'afazer') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
				<label>Responsável<select name="responsavel">${opcoesPessoas(i.responsavel)}</select></label>
			</div>
			<label>Caso<select name="casoId">${opcoesCasos(i.casoId)}</select></label>
			<div class="esc-grade tres">
				<label>Data<input type="date" name="data" value="${i.data || ''}"></label>
				<label>Turno<select name="turno"><option value="">—</option>${Object.entries(NOMES.turno).map(([k, v]) => `<option value="${k}" ${k === i.turno ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
				<label>Hora<input type="time" name="hora" value="${i.hora || ''}" title="Para audiência e perícia"></label>
			</div>
			<div class="esc-aguardando" ${i.coluna === 'aguardando' ? '' : 'hidden'}>
				<div class="esc-grade"><label>O que está faltando<input name="faltando" value="${escapar(i.faltando || '')}" placeholder="Ex.: laudo médico atualizado"></label>
				<label>Cobrar em<input type="date" name="proximaCobranca" value="${i.proximaCobranca || ''}"></label></div>
			</div>
			<div class="esc-checks">
				<label><input type="checkbox" name="aConferir" ${i.aConferir ? 'checked' : ''}> A conferir <small>(data ainda não confirmada)</small></label>
				<label><input type="checkbox" name="critico" ${i.critico ? 'checked' : ''}> Crítico</label>
			</div>
			<details class="esc-mais" ${i.descricao || i.origem ? 'open' : ''}><summary>Mais detalhes</summary>
				<div class="esc-form">
					<label>Origem<select name="origem"><option value="">—</option>${ORIGENS.map((o) => `<option ${o === i.origem ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
					<label>Observações<textarea name="descricao" rows="2">${escapar(i.descricao || '')}</textarea></label>
					${i._autor ? `<p class="det">Última alteração por ${escapar(i._autor)}${i._versao ? ` em ${dataBR(i._versao)} às ${horaBR(i._versao)}` : ''}</p>` : ''}
				</div>
			</details>
			<div class="fim">${novo ? '' : '<button type="button" class="opcao discreta" id="esc-apagar">Apagar</button>'}<span style="flex:1"></span><button type="button" class="opcao discreta" data-fechar>Cancelar</button><button class="opcao principal">Salvar</button></div>
		</form>`)
	const f = $('#esc-f-item')
	f.coluna.onchange = () => (d.querySelector('.esc-aguardando').hidden = f.coluna.value !== 'aguardando')
	f.responsavel.onchange = () => pessoaNova(f.responsavel)
	f.onsubmit = async (e) => {
		e.preventDefault()
		const v = Object.fromEntries(new FormData(f))
		await salvarItem({ ...i, ...v, aConferir: f.aConferir.checked, critico: f.critico.checked, casoId: v.casoId || null, turno: v.turno || null, hora: v.hora || null, data: v.data || null, proximaCobranca: v.proximaCobranca || null })
		d.close()
	}
	const ap = $('#esc-apagar')
	if (ap) ap.onclick = async () => { if (!confirm('Apagar este item para todas?')) return; await apiEsc('apagar', { colecao: 'itens', id: i.id }); d.close(); carregarEscritorio() }
}
async function salvarItem(item, rapido) {
	try {
		const { item: salvo } = await apiEsc('salvar', { colecao: 'itens', item })
		const k = ESC.dados.itens.findIndex((x) => x.id === salvo.id)
		if (k >= 0) ESC.dados.itens[k] = salvo; else ESC.dados.itens.push(salvo)
		if (rapido) aviso(salvo.coluna === 'feito' ? 'Feito ✓' : 'Atualizado.')
		if (ESC.aberto) desenharEscritorio()
		return salvo
	} catch (e) { aviso(e.message) }
}

function editarCaso(c, depois) {
	const novo = !c.id
	const d = janela(`<h2>${novo ? 'Novo caso' : 'Editar caso'}</h2>
		<form class="esc-form" id="esc-f-caso">
			<label>Cliente<input name="cliente" required value="${escapar(c.cliente || '')}"></label>
			<label>Assunto<input name="assunto" value="${escapar(c.assunto || '')}" placeholder="Ex.: Auxílio-doença; BPC; Alimentos"></label>
			<div class="esc-grade tres">
				<label>Etapa<select name="etapa">${Object.entries(NOMES.etapa).map(([k, v]) => `<option value="${k}" ${k === (c.etapa || 'demanda') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
				<label>Responsável<select name="responsavel">${opcoesPessoas(c.responsavel)}</select></label>
				<label>Origem<select name="origem"><option value="">—</option>${ORIGENS.map((o) => `<option ${o === c.origem ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
			</div>
			<label>Outras partes <small>(uma por linha)</small><textarea name="outrasPartes" rows="2">${escapar((c.outrasPartes || []).join('\n'))}</textarea></label>
			<label>Processos <small>(um por linha: número · tribunal)</small><textarea name="processos" rows="2">${escapar((c.processos || []).map((p) => [p.numero, p.tribunal].filter(Boolean).join(' · ')).join('\n'))}</textarea></label>
			<label>Notas<textarea name="notas" rows="3">${escapar(c.notas || '')}</textarea></label>
			<div class="fim">${novo ? '' : '<button type="button" class="opcao discreta" id="esc-apagar-caso">Apagar</button>'}<span style="flex:1"></span><button type="button" class="opcao discreta" data-fechar>Cancelar</button><button class="opcao principal">Salvar</button></div>
		</form>`)
	const f = $('#esc-f-caso')
	f.responsavel.onchange = () => pessoaNova(f.responsavel)
	f.onsubmit = async (e) => {
		e.preventDefault()
		const v = Object.fromEntries(new FormData(f))
		const caso = {
			...c, ...v,
			outrasPartes: v.outrasPartes.split('\n').map((s) => s.trim()).filter(Boolean),
			processos: v.processos.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => { const [numero, tribunal] = s.split('·').map((x) => x.trim()); return { numero, tribunal: tribunal || '' } }),
		}
		try {
			const { item: salvo } = await apiEsc('salvar', { colecao: 'casos', item: caso })
			const k = ESC.dados.casos.findIndex((x) => x.id === salvo.id)
			if (k >= 0) ESC.dados.casos[k] = salvo; else ESC.dados.casos.push(salvo)
			d.close()
			if (depois) return depois(salvo)
			if (ESC.aberto) { desenharEscritorio(); abrirCaso(salvo) }
		} catch (er) { aviso(er.message) }
	}
	const ap = $('#esc-apagar-caso')
	if (ap) ap.onclick = async () => { if (!confirm('Apagar este caso para todas? As tarefas dele continuam, sem caso.')) return; await apiEsc('apagar', { colecao: 'casos', id: c.id }); d.close(); carregarEscritorio() }
}

// Ficha do caso: dados, tarefas, cofre e "conversar sobre o caso" (sem o cofre).
async function abrirCaso(c) {
	if (!c) return
	const itens = ESC.dados.itens.filter((i) => i.casoId === c.id).sort((a, b) => (a.coluna === 'feito') - (b.coluna === 'feito') || ((a.data || '9') < (b.data || '9') ? -1 : 1))
	let cofre = []
	try { cofre = (await apiEsc('listar', { colecao: 'cofre' })).itens.filter((s) => s.casoId === c.id) } catch {}
	const d = janela(`<div class="esc-ficha-topo"><div><h2>${escapar(c.cliente)}</h2><p class="det">${escapar(c.assunto || '')} · <span class="esc-chip">${NOMES.etapa[c.etapa]}</span>${c.responsavel ? ' · ' + escapar(c.responsavel) : ''}</p></div>
			<div class="opcoes"><button class="opcao" id="esc-editar-caso">Editar</button><button class="opcao" id="esc-gravar-atend">Gravar atendimento</button><button class="opcao" id="esc-treinar">Treinar sustentação</button><button class="opcao principal" id="esc-conversar">Conversar sobre o caso</button></div></div>
		${c.processos.length ? `<p><b>Processos:</b> ${c.processos.map((p) => escapar([p.numero, p.tribunal].filter(Boolean).join(' · '))).join('; ')}</p>` : ''}
		${c.outrasPartes.length ? `<p><b>Outras partes:</b> ${c.outrasPartes.map(escapar).join('; ')}</p>` : ''}
		${c.notas ? `<p class="esc-notas">${escapar(c.notas)}</p>` : ''}
		<h3>Tarefas e prazos <button class="opcao" id="esc-item-caso">+ Adicionar</button></h3>
		<div class="esc-lista">${itens.map((i) => linhaItem(i).replace('class="esc-linha"', `class="esc-linha ${i.coluna === 'feito' ? 'feito' : ''}"`)).join('') || '<p class="esc-vazio">Nada ainda.</p>'}</div>
		${c.atendimentos?.length ? `<h3>Atendimentos</h3>${[...c.atendimentos].reverse().map((a) => `<details class="esc-atend"><summary><b>${dataBR(a.quando)}</b> · ${escapar(a.resumo.slice(0, 140))}${a.resumo.length > 140 ? '…' : ''}</summary><p>${escapar(a.resumo)}</p></details>`).join('')}` : ''}
		${c.audios?.length ? `<h3>Áudios dos atendimentos <small>(ficam no computador que recebeu)</small></h3><div class="esc-lista">${[...c.audios].reverse().map((a) => `<div class="esc-cofre"><span><b>${dataBR(a.quando)}</b> ${a.duracao ? `${Math.floor(a.duracao / 60)}:${String(a.duracao % 60).padStart(2, '0')}` : ''} <small>${escapar(a.arquivo)}</small></span>${document.body.classList.contains('portal') ? '<small>no computador</small>' : `<button class="opcao" data-ouvir="${escapar(a.arquivo)}">Ouvir</button><button class="opcao discreta" data-pasta-audio="${escapar(a.arquivo)}">Mostrar na pasta</button>`}</div>`).join('')}</div>` : ''}
		<h3>Cofre <small>(senhas do cliente; nunca vão para a IA)</small> <button class="opcao" id="esc-cofre-novo">+ Guardar senha</button></h3>
		<div class="esc-lista">${cofre.map((s) => `<div class="esc-cofre"><span><b>${escapar(s.sistema)}</b> ${escapar(s.usuario)}${s.obs ? ` <small>${escapar(s.obs)}</small>` : ''}</span><code data-senha="${s.id}">••••••••</code><button class="opcao" data-ver="${s.id}">Ver</button><button class="opcao discreta" data-copiar="${s.id}">Copiar</button></div>`).join('') || '<p class="esc-vazio">Nenhuma senha guardada.</p>'}</div>
		<div class="fim"><button class="opcao discreta" data-fechar>Fechar</button></div>`)
	ligarLinhas(d)
	$('#esc-editar-caso').onclick = () => editarCaso(c)
	$('#esc-item-caso').onclick = () => editarItem({ casoId: c.id, responsavel: c.responsavel, origem: c.origem })
	$('#esc-conversar').onclick = () => { d.close(); conversarSobreCaso(c, itens) }
	$('#esc-gravar-atend').onclick = () => { d.close(); abrirSustentacao(null, { modo: 'atendimento', casoId: c.id }) }
	$('#esc-treinar').onclick = () => { d.close(); abrirSustentacao(null, { modo: 'sustentacao', casoId: c.id }) }
	$('#esc-cofre-novo').onclick = () => editarCofre({ casoId: c.id }, c)
	d.querySelectorAll('[data-ouvir], [data-pasta-audio]').forEach((b) => (b.onclick = () => api('audio-atendimento', { arquivo: b.dataset.ouvir || b.dataset.pastaAudio, naPasta: !!b.dataset.pastaAudio }).catch((e) => aviso(e.message))))
	d.querySelectorAll('[data-ver]').forEach((b) => (b.onclick = async () => {
		const alvo = d.querySelector(`[data-senha="${b.dataset.ver}"]`)
		if (b.textContent === 'Ocultar') { alvo.textContent = '••••••••'; b.textContent = 'Ver'; return }
		try { alvo.textContent = (await apiEsc('senha', { id: b.dataset.ver })).senha; b.textContent = 'Ocultar'; setTimeout(() => { alvo.textContent = '••••••••'; b.textContent = 'Ver' }, 30000) } catch (e) { aviso(e.message) }
	}))
	d.querySelectorAll('[data-copiar]').forEach((b) => (b.onclick = async () => {
		try { await navigator.clipboard.writeText((await apiEsc('senha', { id: b.dataset.copiar })).senha); aviso('Senha copiada.') } catch (e) { aviso(e.message) }
	}))
}
function editarCofre(s, caso) {
	const d = janela(`<h2>Guardar senha · ${escapar(caso.cliente)}</h2>
		<form class="esc-form" id="esc-f-cofre">
			<p class="det">Fica embaralhada com a senha do escritório. Aparece só quando alguém clica em "Ver", e fica registrado quem viu. Nunca vai para a IA.</p>
			<label>Sistema<input name="sistema" value="${escapar(s.sistema || 'gov.br / Meu INSS')}"></label>
			<label>Usuário (CPF ou login)<input name="usuario" value="${escapar(s.usuario || '')}"></label>
			<label>Senha<input name="senha" type="password" autocomplete="new-password" required></label>
			<label>Observação<input name="obs" value="${escapar(s.obs || '')}" placeholder="Ex.: verificação em duas etapas no celular dela"></label>
			<div class="fim"><button type="button" class="opcao discreta" data-fechar>Cancelar</button><button class="opcao principal">Guardar</button></div>
		</form>`)
	$('#esc-f-cofre').onsubmit = async (e) => {
		e.preventDefault()
		try { await apiEsc('salvar', { colecao: 'cofre', item: { ...s, ...Object.fromEntries(new FormData(e.target)) } }); d.close(); abrirCaso(caso) } catch (er) { aviso(er.message) }
	}
}
// Abre uma conversa com o resumo do caso. O cofre fica de fora, sempre.
// Resumo do caso que vai para a IA: dados, pendências e os últimos atendimentos. O cofre NUNCA entra.
function resumoCasoParaIA(c, itens) {
	const abertos = itens.filter((i) => i.coluna !== 'feito')
	const atend = (c.atendimentos || []).slice(-2)
	return `${c.cliente}${c.assunto ? ` (${c.assunto})` : ''}. Etapa: ${NOMES.etapa[c.etapa]}.` +
		(c.processos.length ? `\nProcessos: ${c.processos.map((p) => [p.numero, p.tribunal].filter(Boolean).join(' · ')).join('; ')}.` : '') +
		(c.outrasPartes.length ? `\nOutras partes: ${c.outrasPartes.join('; ')}.` : '') +
		(c.notas ? `\nNotas: ${c.notas}` : '') +
		(abertos.length ? `\nPendências: ${abertos.map((i) => `${NOMES.tipo[i.tipo]} "${i.titulo}"${i.data ? ` em ${i.data}` : ''}${i.aConferir ? ' (a conferir)' : ''}`).join('; ')}.` : '') +
		(atend.length ? `\nÚltimos atendimentos:\n${atend.map((a) => `- ${dataBR(a.quando)}: ${a.resumo}`).join('\n')}` : '')
}
async function resumoCasoPorId(id) {
	try {
		const [{ itens: casos }, { itens }] = await Promise.all([apiEsc('listar', { colecao: 'casos' }), apiEsc('listar', { colecao: 'itens' })])
		const c = casos.find((x) => x.id === id)
		return c ? resumoCasoParaIA(c, itens.filter((i) => i.casoId === id)) : ''
	} catch { return '' }
}
async function conversarSobreCaso(c, itens) {
	const texto = `Caso do escritório: ${resumoCasoParaIA(c, itens)}\n\nQuero trabalhar neste caso. Comece me dizendo o que precisa de atenção.`
	novaConversa()
	const t = telas.get(atual)
	t.titulo = c.cliente
	$('#titulo').textContent = t.titulo
	$('#entrada').value = texto
	$('#entrada').focus()
	aviso('O resumo do caso está no campo. Ajuste se quiser e envie.')
}

/* ---------- avisos do DJEN → prazo "a conferir" ---------- */
// Chamado pelo quadro de avisos. Liga ao caso pelo número do processo; se não houver caso, oferece criar.
async function criarPrazoDoAviso(i) {
	try { ESC.estado = await api('escritorio/estado') } catch {}
	if (!ESC.estado?.desbloqueado) { aviso('Abra o Escritório e entre primeiro.'); return mostrarEscritorio() }
	if (!ESC.dados.casos.length) await carregarEscritorio()
	const num = (s) => String(s || '').replace(/\D/g, '')
	let caso = ESC.dados.casos.find((c) => c.processos.some((p) => num(p.numero) === num(i.processo)))
	const item = {
		tipo: i.audiencia && /^Per/.test(i.audiencia) ? 'pericia' : i.audiencia ? 'audiencia' : 'prazo',
		titulo: `${i.ato || 'Intimação'}${i.pessoa ? ' · ' + i.pessoa : ''}`,
		descricao: `${i.tribunal || ''} · ${i.orgao || ''}\nProcesso ${i.processo}\nDisponibilizada em ${dataBR(i.quando)}${i.prazoCalculado ? `\nPrazo de ${i.prazo}, calculado pela Central (confira):\n- ${i.prazoCalculado.memoria.join('\n- ')}` : i.prazo ? `\nPrazo mencionado no texto: ${i.prazo} (calcule e confirme a data)` : ''}${i.audiencia ? `\n${i.audiencia}` : ''}\n\n${i.trecho || ''}`,
		...(i.prazoCalculado && !i.audiencia ? { data: i.prazoCalculado.fim } : {}),
		aConferir: true, coluna: 'afazer', origem: 'Escritório', fonte: { tipo: 'djen', id: i.id },
	}
	const ja = ESC.dados.itens.find((x) => x.fonte?.id === i.id)
	if (ja) return editarItem(ja)
	if (!caso && i.pessoa && confirm(`Não há caso com o processo ${i.processo}. Criar o caso de ${i.pessoa} agora?`)) {
		return editarCaso({ cliente: i.pessoa, outrasPartes: i.contra ? [i.contra] : [], processos: [{ numero: i.processo, tribunal: i.tribunal }], etapa: 'judicial', assunto: i.classe || '' }, (novo) => editarItem({ ...item, casoId: novo.id, responsavel: novo.responsavel }))
	}
	editarItem({ ...item, casoId: caso?.id || null, responsavel: caso?.responsavel || '' })
}

// Aviso → ficha do caso (pelo número do processo); se não houver caso, oferece criar com os dados da intimação.
async function abrirCasoDoAviso(i) {
	try { ESC.estado = await api('escritorio/estado') } catch {}
	if (!ESC.estado?.desbloqueado) { aviso('Abra o Escritório e entre primeiro.'); return mostrarEscritorio() }
	if (!ESC.aberto || !ESC.dados.casos.length) { ESC.vista = 'casos'; mostrarEscritorio(); await carregarEscritorio() }
	const num = (s) => String(s || '').replace(/\D/g, '')
	const caso = ESC.dados.casos.find((c) => c.processos.some((p) => num(p.numero) === num(i.processo)))
	if (caso) return abrirCaso(caso)
	if (!confirm(`Ainda não há caso com o processo ${i.processo}. Criar o caso${i.pessoa ? ' de ' + i.pessoa : ''} agora?`)) return
	editarCaso({ cliente: i.pessoa || '', outrasPartes: i.contra ? [i.contra] : [], processos: [{ numero: i.processo, tribunal: i.tribunal }], etapa: 'judicial', assunto: i.classe || '' })
}

/* ---------- sugestões da IA → Escritório (a advogada confirma; nada entra sozinho) ---------- */
// A skill termina algumas respostas com ```json escritorio-sugestoes {...}```; aqui ele vira um cartão.
;(() => {
	const anterior = window.resposta || ((texto) => md(texto))
	window.resposta = function (texto) {
		const m = texto.match(/```json escritorio-sugestoes\s*([\s\S]*?)```/)
		if (!m) return anterior(texto)
		let s
		try { s = JSON.parse(m[1]) } catch { return anterior(texto) }
		const caixa = document.createElement('div')
		const resto = (texto.slice(0, m.index) + texto.slice(m.index + m[0].length)).trim()
		if (resto) caixa.append(anterior(resto))
		caixa.append(cartaoSugestoes(s, m[1]))
		return caixa
	}
})()
const chaveSugestao = (bruto) => 'sug:' + [...bruto].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)
function cartaoSugestoes(s, bruto) {
	const c = document.createElement('div')
	c.className = 'cartao esc-sugestoes'
	const itens = (s.itens || []).slice(0, 8).filter((i) => i && i.titulo)
	let feito = null
	try { feito = localStorage.getItem(chaveSugestao(bruto)) } catch {}
	if (feito) { c.innerHTML = `<div class="sus-tit">Escritório</div><p class="det">✓ ${escapar(feito)}</p>`; return c }
	if (!itens.length && !s.resumo) return c
	c.innerHTML = `<div class="sus-tit">Sugestões para o Escritório</div>
		<p class="det">Marque o que deve entrar. Prazos, audiências e perícias entram como "a conferir".</p>
		<label class="esc-sug-caso">Caso<select><option value="">Carregando…</option></select></label>
		${s.resumo ? `<label class="esc-sug-linha"><input type="checkbox" data-resumo checked> <span><b>Guardar o resumo do atendimento no caso</b><small>${escapar(s.resumo.slice(0, 280))}${s.resumo.length > 280 ? '…' : ''}</small></span></label>` : ''}
		${itens.map((i, k) => `<div class="esc-sug-linha"><input type="checkbox" data-item="${k}" checked>
			<span class="esc-chip tipo-${escapar(i.tipo || 'tarefa')}">${NOMES.tipo[i.tipo] || 'Tarefa'}</span>
			<input class="esc-sug-tit" data-tit="${k}" value="${escapar(i.titulo)}">
			<input type="date" data-data="${k}" value="${/^\d{4}-\d{2}-\d{2}$/.test(i.data || '') ? i.data : ''}">
			${i.motivo ? `<small class="esc-sug-motivo">${escapar(i.motivo)}</small>` : ''}</div>`).join('')}
		<div class="opcoes"><button class="opcao principal">Adicionar ao Escritório</button></div>`
	const sel = c.querySelector('select'), botao = c.querySelector('button.principal')
	;(async () => {
		let estado = null
		try { estado = await api('escritorio/estado') } catch {}
		if (!estado?.desbloqueado) {
			sel.closest('label').remove()
			botao.textContent = 'Abrir o Escritório para adicionar'
			botao.onclick = () => mostrarEscritorio()
			return
		}
		const { itens: casos } = await apiEsc('listar', { colecao: 'casos' })
		const num = (x) => String(x || '').replace(/\D/g, '')
		const alvo = casos.find((x) => s.caso?.processo && x.processos.some((p) => num(p.numero) === num(s.caso.processo)))
			|| casos.find((x) => s.caso?.cliente && x.cliente.toLowerCase() === String(s.caso.cliente).toLowerCase())
		sel.innerHTML = `<option value="">Sem caso</option>${s.caso?.cliente && !alvo ? `<option value="__novo">Criar caso: ${escapar(s.caso.cliente)}</option>` : ''}` +
			casos.sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR')).map((x) => `<option value="${x.id}">${escapar(x.cliente)}${x.assunto ? ' · ' + escapar(x.assunto) : ''}</option>`).join('')
		sel.value = alvo ? alvo.id : s.caso?.cliente ? '__novo' : ''
	})()
	botao.onclick = async () => {
		if (botao.textContent.startsWith('Abrir')) return
		botao.disabled = true; botao.textContent = 'Adicionando…'
		try {
			let casoId = sel.value || null
			if (casoId === '__novo') {
				const { item } = await apiEsc('salvar', { colecao: 'casos', item: { cliente: s.caso.cliente, etapa: 'atendimento', processos: s.caso.processo ? [{ numero: s.caso.processo, tribunal: '' }] : [] } })
				casoId = item.id
			}
			let n = 0
			for (const cb of c.querySelectorAll('[data-item]:checked')) {
				const k = cb.dataset.item, i = itens[k]
				const tipo = NOMES.tipo[i.tipo] ? i.tipo : 'tarefa'
				const data = c.querySelector(`[data-data="${k}"]`).value || null
				await apiEsc('salvar', { colecao: 'itens', item: {
					tipo, titulo: c.querySelector(`[data-tit="${k}"]`).value.trim() || i.titulo, data,
					hora: /^\d{2}:\d{2}$/.test(i.hora || '') ? i.hora : null, casoId,
					coluna: tipo === 'cobranca' ? 'aguardando' : 'afazer', faltando: i.faltando || '',
					aConferir: ['prazo', 'audiencia', 'pericia'].includes(tipo) || !!data,
					descricao: i.motivo ? `Sugerido pela Central: ${i.motivo}` : 'Sugerido pela Central', fonte: { tipo: 'chat', id: '' },
				} })
				n++
			}
			const comResumo = c.querySelector('[data-resumo]')?.checked && casoId
			if (comResumo) {
				const { itens: casos } = await apiEsc('listar', { colecao: 'casos' })
				const caso = casos.find((x) => x.id === casoId)
				if (caso) await apiEsc('salvar', { colecao: 'casos', item: { ...caso, atendimentos: [...(caso.atendimentos || []), { quando: Date.now(), resumo: s.resumo }] } })
			}
			const msg = `Adicionado ao Escritório: ${n} item(ns)${comResumo ? ' e o resumo do atendimento' : ''}.`
			try { localStorage.setItem(chaveSugestao(bruto), msg) } catch {}
			c.innerHTML = `<div class="sus-tit">Escritório</div><p class="det">✓ ${escapar(msg)}</p><div class="opcoes"><button class="opcao">Ver no Escritório</button></div>`
			c.querySelector('button').onclick = () => mostrarEscritorio()
			if (ESC.aberto) carregarEscritorio()
		} catch (e) { aviso(e.message); botao.disabled = false; botao.textContent = 'Adicionar ao Escritório' }
	}
	return c
}

/* ---------- equipe: nomes que aparecem em "Responsável" (cada advogada tem a sua lista) ---------- */
function abrirEquipe() {
	const nuvem = ESC.estado?.nuvem
	const d = janela(`<h2>Equipe</h2>
		<h3>Nomes da equipe <small>(aparecem em "Responsável")</small></h3>
		<div class="esc-lista">${ESC.dados.equipe.map((p) => `<div class="esc-cofre"><span>${escapar(p.nome)}</span><button class="opcao discreta" data-tirar="${p.id}">Tirar da lista</button></div>`).join('') || '<p class="esc-vazio">Ninguém ainda.</p>'}</div>
		<form class="esc-filtros" id="esc-f-pessoa"><input name="nome" placeholder="Nome de quem entra na equipe" required><button class="opcao">Adicionar</button></form>
		${nuvem?.conectado ? `<p class="det">Conectada como ${escapar(nuvem.email || '')}. Este escritório é só seu: as pessoas desta lista não veem nada, só aparecem como responsáveis.</p>` : ''}
		<div class="fim"><span style="flex:1"></span><button class="opcao discreta" data-fechar>Fechar</button></div>`)
	d.querySelectorAll('[data-tirar]').forEach((b) => (b.onclick = async () => {
		await apiEsc('salvar', { colecao: 'equipe', item: { id: b.dataset.tirar, ativo: false } })
		ESC.dados.equipe = ESC.dados.equipe.filter((p) => p.id !== b.dataset.tirar)
		abrirEquipe()
	}))
	$('#esc-f-pessoa').onsubmit = async (e) => {
		e.preventDefault()
		const { item } = await apiEsc('salvar', { colecao: 'equipe', item: { nome: e.target.nome.value.trim() } })
		ESC.dados.equipe.push(item)
		abrirEquipe()
	}
}

/* ---------- sincronização chegou de outra advogada ---------- */
;(() => {
	const es = new EventSource('/api/eventos?t=' + token)
	es.onmessage = (m) => { try { if (JSON.parse(m.data).tipo === 'escritorio' && ESC.aberto) carregarEscritorio() } catch {} }
})()
$('#abrir-escritorio').onclick = mostrarEscritorio
