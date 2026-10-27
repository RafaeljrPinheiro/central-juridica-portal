// Portal da advogada (BACKLOG I13, só ALFA): a PRÓPRIA Central, aberta no celular ou em qualquer navegador.
// Estas telas são as mesmas da Central (copiadas de central-app/public por publicar-portal.mjs). Este arquivo entra
// antes delas e troca o "caminho": em vez do servidor do computador, cada pedido vai cifrado pelo correio do Supabase
// até a Central dela, que executa e devolve. Agenda e casos vêm direto do banco (funcionam com o computador desligado).
// Nada é guardado no navegador, a não ser que ela marque "lembrar neste aparelho por 7 dias".
;(() => {
	const CONFIG = { url: 'https://jgjyrkbftxznsfqvwrgt.supabase.co', chave: 'sb_publishable_eBgdgsuIGMCtd12OWh4bAA_AOPptDDZ' }
	const SEM_USO_MS = 15 * 60 * 1000
	// Mesmas rotas que a Central aceita pelo link (central-app/remoto.mjs).
	const PELA_CENTRAL = new Set(['GET estado', 'GET conversas', 'GET conversas/buscar', 'GET conversa', 'GET uso', 'GET avisos', 'GET avisos/config',
		'GET controle', 'GET abertura-imagem', 'POST enviar', 'POST responder', 'POST parar', 'POST conversas/renomear', 'POST conversas/arquivar',
		'POST avisos/marcar', 'POST avisos/atualizar', 'POST sugestao'])
	let cli = null, liberar
	const pronto = new Promise((r) => (liberar = r))
	const resp = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
	const erro = (m, status = 400) => resp({ erro: m }, status)

	/* ---------- Central ligada? (consulta no máximo a cada 15 s) ---------- */
	let ligada = { ligada: false }, conferidaEm = 0, conferindo = null
	// Quem pergunta durante uma conferência espera a mesma (sem receber a resposta velha).
	async function centralLigada(forcar) {
		if (!forcar && Date.now() - conferidaEm < 15000) return conferindo || ligada
		conferidaEm = Date.now()
		conferindo = (async () => {
			const antes = ligada.ligada
			ligada = await cli.centralLigada().catch(() => ({ ligada: false }))
			desenharFaixa()
			// Central acabou de ligar: recarrega a lista de conversas (antes estava vazia).
			if (ligada.ligada && !antes && typeof carregarLista === 'function') setTimeout(() => carregarLista(), 0)
			return ligada
		})()
		try { return await conferindo } finally { conferindo = null }
	}
	function desenharFaixa() {
		const f = document.getElementById('portal-faixa')
		if (!f || !cli) return
		const ha = ligada.visto ? Math.round((Date.now() - new Date(ligada.visto)) / 60000) : null
		f.className = ligada.ligada ? 'ligada' : 'desligada'
		f.innerHTML = `<span>${ligada.ligada ? '● Sua Central está ligada · pelo celular, as respostas levam um pouco mais' : `○ Sua Central está desligada${ha != null ? ` (último sinal há ${ha < 60 ? ha + ' min' : Math.round(ha / 60) + ' h'})` : ''}: a agenda funciona; mensagens ficam na fila e rodam quando ela ligar`}</span><span style="display:flex;gap:6px"><button type="button" id="portal-menu">☰ Menu</button><button type="button" id="portal-sair">Sair</button></span>`
		document.getElementById('portal-sair').onclick = sair
		document.getElementById('portal-menu').onclick = () => document.body.classList.toggle('menu-aberto')
	}

	const autor = () => (cli.email || '').split('@')[0] + ' (celular)'
	// A Central busca o que mudou a cada 2 minutos; com ela ligada, pede para buscar já (sem esperar a resposta).
	function sincronizarCentral() { if (ligada.ligada) cli.pedir('escritorio/nuvem/sincronizar', 'POST', {}, { esperar: false }).catch(() => {}) }

	/* ---------- o "caminho": cada /api/... vai para o lugar certo ---------- */
	async function rota(caminho, metodo, dados) {
		await pronto
		const r = caminho.replace(/^\/api\//, '').split('?')[0]
		const consulta = caminho.includes('?') ? '?' + caminho.split('?')[1].replace(/(^|&)t=[^&]*/, '') : ''
		// Escritório: direto do banco, só leitura nesta primeira versão. Cofre de senhas nunca vem para o link.
		if (r === 'escritorio/estado') return resp({ configurado: true, desbloqueado: true, eu: '', nuvem: { conectado: true, email: cli.email, ultima: Date.now() } })
		if (r === 'escritorio/listar') return resp({ itens: await cli.listar(dados.colecao) })
		if (r.startsWith('escritorio/backup')) return resp({ configurado: true, pasta: '(no computador)', ultimo: null })
		// Fase 2: mexer na agenda e nos casos pelo link. Grava no banco (cifrado) e avisa a Central para buscar já.
		if (r === 'escritorio/salvar') { const item = await cli.salvar(dados.colecao, dados.item || {}, autor()); sincronizarCentral(); return resp({ item }) }
		if (r === 'escritorio/apagar') { await cli.apagar(dados.colecao, dados.id, autor()); sincronizarCentral(); return resp({ ok: true }) }
		if (r === 'escritorio/nuvem/sincronizar') { sincronizarCentral(); return resp({ recebidos: 0, enviados: 0 }) }
		if (r.startsWith('escritorio/')) return erro('Pelo link isto não está disponível (o cofre de senhas fica só no computador).')
		if (r === 'link') { window.open(dados.url, '_blank', 'noopener'); return resp({ ok: true }) }
		// Fase 3: peça gerada numa conversa → baixa no aparelho (a Central manda trancada pelo depósito).
		if (r === 'abrir') {
			if (dados.naPasta) return erro('A pasta está no computador: abra pela Central de lá.')
			if (!(await centralLigada()).ligada) return erro('Sua Central está desligada: o arquivo está no computador.')
			const { nome, bytes } = await cli.baixarArquivo(dados.caminho)
			const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes])); a.download = nome
			document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 4000)
			return resp({ ok: true })
		}
		if (r === 'edicao') return resp({ edicao: null })
		if (r === 'remoto') return resp({ disponivel: false })
		if (r === 'erro-tela') return resp({ ok: true })
		const chave = `${metodo} ${r}`
		if (!PELA_CENTRAL.has(chave)) return erro('Pelo link isto não está disponível. Use a Central no computador.')
		if (!(await centralLigada()).ligada) {
			if (chave === 'POST enviar') { await cli.pedir(r, metodo, dados, { esperar: false }); avisoPortal('Mensagem guardada: ela roda quando sua Central ligar.'); return resp({ ok: true }) }
			if (chave === 'GET conversas') return resp({ conversas: [], arquivadas: [], trabalhando: [] })
			if (chave === 'GET controle') return resp({ ativo: false, login: 'livre', bloqueio: null })
			if (chave === 'GET uso') return resp({ uso: null })
			if (chave === 'GET avisos') return resp({ itens: [], ultimaChecagem: 0 })
			if (chave === 'GET estado') return resp({ motor: true, logado: true, email: cli.email, versao: '(Central desligada)', skill: true, whatsapp: true, pastaPadrao: '' })
			return erro('Sua Central está desligada agora. Ligue o computador (ou peça para alguém do escritório) e tente de novo.')
		}
		// Passou de 2,5 s: avisa que é a Central no computador quem está fazendo (pelo celular demora mais).
		let ligou = false
		const lento = setTimeout(() => { ligou = true; avisoLento(true) }, 2500)
		try {
			const r2 = await cli.pedir(r + consulta, metodo, dados, { limite: r === 'conversas/buscar' ? 90000 : 60000 }) // procurar dentro das conversas demora mais
			return resp(r2.corpo, r2.status)
		} catch (e) { conferidaEm = 0; return erro(e.message, 504) }
		finally { clearTimeout(lento); if (ligou) avisoLento(false) }
	}
	let lentos = 0
	function avisoLento(ligar) {
		lentos = Math.max(0, lentos + (ligar ? 1 : -1))
		let a = document.getElementById('portal-lento')
		if (!a) { a = document.createElement('div'); a.id = 'portal-lento'; a.setAttribute('role', 'status'); a.textContent = 'Sua Central está fazendo isso no computador do escritório. Pelo celular pode demorar um pouco mais que o normal…'; document.body.append(a) }
		a.hidden = !lentos
	}
	const fetchReal = window.fetch.bind(window)
	window.fetch = (url, op = {}) => {
		const u = String(url)
		if (!u.startsWith('/api/')) return fetchReal(url, op)
		let dados
		// Fase 3: foto ou documento anexado no celular vai trancado para a Central, que guarda e devolve o caminho.
		if (u.startsWith('/api/anexo')) return (async () => {
			await pronto
			if (!(await centralLigada()).ligada) return erro('Sua Central está desligada: anexos só com ela ligada.')
			const nome = new URL(u, location.href).searchParams.get('nome') || 'arquivo'
			try { return resp({ caminho: await cli.enviarArquivo(nome, new Uint8Array(await new Response(op.body).arrayBuffer())) }) } catch (e) { return erro(e.message) }
		})()
		if (op.body !== undefined && typeof op.body !== 'string') return Promise.resolve(erro('Pelo link não dá para mandar áudio, por enquanto.'))
		try { dados = op.body ? JSON.parse(op.body) : undefined } catch { dados = undefined }
		return rota(u, op.method || (dados === undefined ? 'GET' : 'POST'), dados).catch((e) => erro(e.message))
	}
	// Eventos da tela (texto chegando, cartões de permissão): vêm da Central pelo correio.
	const EventSourceReal = window.EventSource
	window.EventSource = function (url) {
		if (!String(url).startsWith('/api/eventos')) return new EventSourceReal(url)
		let parar = null
		const es = { readyState: 0, onmessage: null, onopen: null, onerror: null, close() { parar?.(); es.readyState = 2 } }
		pronto.then(() => {
			es.readyState = 1; es.onopen?.()
			parar = cli.assinarEventos((lote) => [].concat(lote).forEach((ev) => es.onmessage?.({ data: JSON.stringify(ev) })))
		})
		return es
	}

	/* ---------- entrar: e-mail e senha → (código do celular) → senha do escritório ---------- */
	const css = document.createElement('style')
	css.textContent = `
	#portal-entrar { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; padding: 16px; background: var(--fundo, #f4f2ee); overflow: auto; }
	#portal-entrar .cartao { width: min(420px, 100%); display: grid; gap: 10px; padding: 22px; background: var(--superficie, #fff); border: 1px solid var(--linha, #ddd8cf); border-top: 3px solid var(--latao, #b08d57); border-radius: 12px; }
	#portal-entrar h1 { margin: 0; font-size: 20px; } #portal-entrar p { margin: 0; color: var(--tinta-suave, #5d6577); font-size: 14px; }
	#portal-entrar input[type=email], #portal-entrar input[type=password], #portal-entrar input[inputmode] { font: inherit; padding: 10px 12px; border: 1px solid var(--linha, #ddd8cf); border-radius: 8px; background: var(--fundo, #f4f2ee); color: inherit; width: 100%; }
	#portal-entrar button { font: inherit; font-weight: 600; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--latao, #b08d57); background: var(--latao, #b08d57); color: #1b1408; cursor: pointer; }
	#portal-entrar button.link { background: none; border: 0; padding: 2px; font-weight: 400; font-size: 14px; color: var(--tinta-suave, #5d6577); text-decoration: underline; justify-self: center; }
	#portal-entrar .ok { color: var(--petroleo, #2d5f5d); } #portal-entrar [data-passo][hidden] { display: none !important; }
	#portal-entrar .erro { color: #a33a2a; min-height: 1.2em; } #portal-entrar label { display: flex; gap: 8px; align-items: center; font-size: 14px; }
	#portal-faixa { position: fixed; left: 0; right: 0; bottom: 0; z-index: 1500; display: flex; gap: 10px; justify-content: space-between; align-items: center; padding: 6px 12px; font-size: 13px; background: #1d2b45; color: #fff; }
	#portal-lento { position: fixed; left: 12px; right: 12px; bottom: 40px; z-index: 1600; padding: 10px 14px; border-radius: 10px; background: #1d2b45; color: #fff; font-size: 14px; box-shadow: 0 6px 20px #0005; border-left: 4px solid #b08d57; }
	#portal-lento[hidden] { display: none; }
	#portal-faixa.desligada { background: #6b3a2a; } #portal-faixa button { font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 6px; border: 1px solid #fff6; background: transparent; color: #fff; }
	body.portal .app { padding-bottom: 30px; }
	/* Celular: a coluna da esquerda (conversas, Escritório, Nova conversa) abre pelo botão Menu, por cima da tela. */
	@media (max-width: 900px) { body.portal.menu-aberto .lateral { display: flex !important; position: fixed; top: 0; bottom: 30px; left: 0; width: min(300px, 86vw); z-index: 1400; overflow-y: auto; box-shadow: 0 0 0 100vmax #0006; } }
	@media (min-width: 901px) { #portal-menu { display: none; } }
	/* No link não há ditado, treino de sustentação nem as opções do computador (gravar atendimento há). */
	body.portal #ditar, body.portal #abrir-sustentacao, body.portal #esc-treinar, body.portal #ajustes-backup, body.portal #ajustes-conta, body.portal #ajustes-prefs, body.portal #ajustes-passos, body.portal .cartao-passos { display: none !important; }`
	document.head.append(css)

	// recuperacao: a volta do e-mail de "esqueci a senha" ({ email, precisaCodigo, fator }) ou { erro } se o link venceu.
	function telaEntrar(recuperacao = null) {
		const d = document.createElement('div')
		d.id = 'portal-entrar'
		d.innerHTML = `<div class="cartao">
			<h1>Central Jurídica</h1><p>Sua Central, de qualquer lugar. Entre com o seu e-mail do escritório.</p>
			<div data-passo="senha" style="display:grid;gap:10px">
				<input type="email" id="pe-email" autocomplete="username" placeholder="seu e-mail">
				<input type="password" id="pe-senha" autocomplete="current-password" placeholder="senha do login do escritório">
				<button id="pe-entrar">Entrar</button>
				<button type="button" class="link" id="pe-esqueci">Esqueci a senha do login</button></div>
			<div data-passo="esqueci" hidden style="display:grid;gap:10px">
				<p>Digite o seu e-mail. Chega um e-mail com um link: abra o link e crie a senha nova. A <b>senha do escritório</b> é outra e não muda.</p>
				<input type="email" id="pe-email2" autocomplete="username" placeholder="seu e-mail">
				<button id="pe-mandar">Mandar o link</button>
				<button type="button" class="link" data-voltar>Voltar</button></div>
			<div data-passo="nova" hidden style="display:grid;gap:10px">
				<p>Crie a senha nova do login<span id="pe-nova-email"></span>. Mínimo de 10 caracteres.</p>
				<input type="password" id="pe-nova" autocomplete="new-password" placeholder="senha nova">
				<input type="password" id="pe-nova2" autocomplete="new-password" placeholder="repita a senha nova">
				<button id="pe-trocar">Trocar a senha</button></div>
			<div data-passo="codigo" hidden style="display:grid;gap:10px">
				<p>Digite o código de 6 números do app autenticador do celular.</p>
				<input inputmode="numeric" id="pe-codigo" maxlength="6" autocomplete="one-time-code"><button id="pe-confirmar">Confirmar</button></div>
			<div data-passo="escritorio" hidden style="display:grid;gap:10px">
				<p>Agora a <b>senha do escritório</b> (a mesma da Central). Ela destranca seus dados aqui mesmo, no aparelho: nada sai aberto.</p>
				<input type="password" id="pe-esc" placeholder="senha do escritório">
				<label><input type="checkbox" id="pe-lembrar"> Lembrar neste aparelho por 7 dias</label>
				<button id="pe-abrir">Abrir minha Central</button></div>
			<p class="erro" id="pe-erro"></p></div>`
		document.body.append(d)
		const passo = (n) => d.querySelectorAll('[data-passo]').forEach((x) => (x.hidden = x.dataset.passo !== n))
		const falha = (e) => { d.querySelector('#pe-erro').textContent = e.message }
		const ocupado = async (botao, fn) => { botao.disabled = true; d.querySelector('#pe-erro').textContent = ''; try { await fn() } catch (e) { falha(e) } finally { botao.disabled = false } }
		let fator = null, trocando = false
		d.querySelector('#pe-esqueci').onclick = () => { d.querySelector('#pe-email2').value = d.querySelector('#pe-email').value; passo('esqueci'); d.querySelector('#pe-email2').focus() }
		d.querySelector('[data-voltar]').onclick = () => passo('senha')
		d.querySelector('#pe-mandar').onclick = (ev) => ocupado(ev.target, async () => {
			const email = d.querySelector('#pe-email2').value
			await cli.esqueci(email, location.origin + location.pathname)
			passo('senha')
			d.querySelector('#pe-email').value = email.trim()
			d.querySelector('#pe-erro').innerHTML = '<span class="ok">Se este e-mail tem acesso, o link chega em instantes. Olhe também o spam.</span>'
		})
		d.querySelector('#pe-trocar').onclick = (ev) => ocupado(ev.target, async () => {
			if (d.querySelector('#pe-nova').value !== d.querySelector('#pe-nova2').value) throw new Error('As duas senhas não são iguais.')
			await cli.trocarSenha(d.querySelector('#pe-nova').value)
			d.querySelector('#pe-nova').value = d.querySelector('#pe-nova2').value = ''
			trocando = false
			passo('senha')
			d.querySelector('#pe-erro').innerHTML = '<span class="ok">Senha trocada. Entre com a senha nova (no computador também).</span>'
		})
		if (recuperacao?.erro) d.querySelector('#pe-erro').textContent = recuperacao.erro
		else if (recuperacao) {
			trocando = true
			fator = recuperacao.fator
			d.querySelector('#pe-email').value = recuperacao.email || ''
			d.querySelector('#pe-nova-email').textContent = recuperacao.email ? ` de ${recuperacao.email}` : ''
			passo(recuperacao.precisaCodigo ? 'codigo' : 'nova')
		}
		d.querySelector('#pe-entrar').onclick = (ev) => ocupado(ev.target, async () => {
			const r = await cli.entrar(d.querySelector('#pe-email').value, d.querySelector('#pe-senha').value)
			d.querySelector('#pe-senha').value = ''
			if (r.precisaCodigo) { fator = r.fator; passo('codigo'); d.querySelector('#pe-codigo').focus() } else { passo('escritorio'); d.querySelector('#pe-esc').focus() }
		})
		d.querySelector('#pe-confirmar').onclick = (ev) => ocupado(ev.target, async () => { await cli.confirmarCodigo(fator, d.querySelector('#pe-codigo').value); d.querySelector('#pe-codigo').value = ''; passo(trocando ? 'nova' : 'escritorio') })
		d.querySelector('#pe-abrir').onclick = (ev) => ocupado(ev.target, async () => {
			ev.target.textContent = 'Abrindo…'
			try { await cli.abrir(d.querySelector('#pe-esc').value) } finally { ev.target.textContent = 'Abrir minha Central'; d.querySelector('#pe-esc').value = '' }
			if (d.querySelector('#pe-lembrar').checked) await guardarLembranca(cli.lembrar())
			d.remove(); entrou()
		})
		for (const [campo, botao] of [['#pe-senha', '#pe-entrar'], ['#pe-codigo', '#pe-confirmar'], ['#pe-esc', '#pe-abrir'], ['#pe-email2', '#pe-mandar'], ['#pe-nova2', '#pe-trocar']]) d.querySelector(campo).onkeydown = (e) => { if (e.key === 'Enter') d.querySelector(botao).click() }
	}

	/* ---------- "lembrar neste aparelho": a chave fica no navegador como objeto que não pode ser copiado ---------- */
	const bancoLocal = () => new Promise((ok, falha) => { const r = indexedDB.open('central-juridica-portal', 1); r.onupgradeneeded = () => r.result.createObjectStore('s'); r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error) })
	async function guardarLembranca(dados) { try { const db = await bancoLocal(); db.transaction('s', 'readwrite').objectStore('s').put({ dados, ate: Date.now() + 7 * 864e5 }, 'sessao') } catch {} }
	async function lerLembranca() { try { const db = await bancoLocal(); return await new Promise((ok) => { const r = db.transaction('s').objectStore('s').get('sessao'); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null) }) } catch { return null } }
	async function esquecer() { try { const db = await bancoLocal(); db.transaction('s', 'readwrite').objectStore('s').delete('sessao') } catch {} }
	async function sair() { await esquecer(); cli?.sair(); location.reload() }

	let lembrado = false
	function entrou() {
		// Gravar atendimento no celular: o áudio vai trancado para a Central (public/sustentacao.js chama isto).
		window.enviarAtendimentoLink = (pcm, extra, aoPasso) => cli.enviarAtendimento(pcm, extra, aoPasso)
		document.body.classList.add('portal')
		// Escolheu algo no menu (conversa, Escritório, Nova conversa): fecha o menu.
		document.addEventListener('click', (e) => { if (document.body.classList.contains('menu-aberto') && e.target.closest('.lateral button') && !e.target.closest('.buscar-conteudo, #ver-arquivadas, .btn-mais')) setTimeout(() => document.body.classList.remove('menu-aberto'), 0) }, true) // na captura: antes do clique redesenhar a lista (o botão sai da tela e o closest não acharia mais)
		const f = document.createElement('div'); f.id = 'portal-faixa'; document.body.append(f)
		centralLigada(true)
		// Ligada: confere a cada 20 s. Desligada: a cada 5 s, para mostrar logo quando ela ligar.
		const conferir = async () => { const l = await centralLigada(true).catch(() => ({})); setTimeout(conferir, l.ligada ? 20000 : 5000) }
		setTimeout(conferir, 5000)
		// Sem uso por 15 minutos (e sem "lembrar"), tranca: a chave some da memória.
		if (!lembrado) { let ultimo = Date.now(); for (const t of ['click', 'keydown', 'touchstart']) addEventListener(t, () => (ultimo = Date.now())); setInterval(() => { if (Date.now() - ultimo > SEM_USO_MS) sair() }, 30000) }
		liberar()
	}
	function avisoPortal(t) { const a = document.getElementById('aviso'); if (!a) return; a.textContent = t; a.classList.add('ver'); setTimeout(() => a.classList.remove('ver'), 4000) }

	addEventListener('DOMContentLoaded', async () => {
		const { criarCliente } = await import('./comum/correio-web.js')
		cli = criarCliente(CONFIG)
		// Volta do e-mail de "esqueci a senha": o acesso temporário vem no endereço; sai dele na hora.
		if (/type=recovery|error_code=/.test(location.hash)) {
			const hash = location.hash
			history.replaceState(null, '', location.pathname)
			let rec
			try { rec = await cli.recuperar(hash) } catch (e) { rec = { erro: e.message } }
			if (rec) return telaEntrar(rec)
		}
		const l = await lerLembranca()
		if (l && l.ate > Date.now()) {
			try { await cli.retomar(l.dados); lembrado = true; return entrou() } catch { await esquecer() }
		}
		telaEntrar()
	})
})()
