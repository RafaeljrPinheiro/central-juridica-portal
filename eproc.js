// "Abrir no eproc e copiar" (servidor: tribunal.mjs). A advogada entra no sistema do tribunal com o certificado dela,
// numa janela do Edge; cada página que ela copiar com o botão dourado aparece aqui, para guardar no caso (cifrado)
// ou perguntar à Central. Depende de app.js ($, api, aviso, escapar, novaConversa, enviar, telas, atual) e de
// escritorio.js (ESC, apiEsc, casoDe, carregarEscritorio, abrirCaso).
const CONSULTA = { dialogo: null, vigia: null, caso: null, processo: '', vistas: 0 }
const ENTRADAS_TRIBUNAL = { TJMG: 'https://eproc1g.tjmg.jus.br/eproc/' } // igual a tribunal.mjs
const LIMITE_PERGUNTA = 12000 // caracteres da página que vão para a conversa (economia de token)

const temEnderecoOficial = ({ link, tribunal }) => {
	try { const u = new URL(link); if (u.protocol === 'https:' && /(^|\.)jus\.br$/i.test(u.hostname)) return true } catch {}
	return !!ENTRADAS_TRIBUNAL[String(tribunal || '').toUpperCase()]
}
const nomeSistema = (link) => (/eproc/i.test(link || '') ? 'eproc' : /pje/i.test(link || '') ? 'PJe' : /esaj/i.test(link || '') ? 'e-SAJ' : 'eproc')
const numerosIguais = (a, b) => String(a || '').replace(/\D/g, '') === String(b || '').replace(/\D/g, '') && String(a || '').replace(/\D/g, '').length >= 15
const casoDoProcesso = (processo) => (typeof ESC !== 'undefined' ? ESC.dados.casos.find((c) => c.processos.some((p) => numerosIguais(p.numero, processo))) : null) || null

// Consulta DENTRO da Central (consulta-publica.mjs): tribunais que aceitam, pelo J.TR do número CNJ ou pela sigla.
const CONSULTA_DENTRO = { '8.13': 'TJMG' }
function tribunalConsultaDentro({ processo = '', tribunal = '' }) {
	const sigla = String(tribunal || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
	if (Object.values(CONSULTA_DENTRO).includes(sigla)) return sigla
	const d = String(processo || '').replace(/\D/g, '')
	return d.length === 20 ? CONSULTA_DENTRO[`${d[13]}.${d.slice(14, 16)}`] || null : null
}
// Nome do botão nas telas (quadro e ficha do caso).
const rotuloConsulta = (p) => (tribunalConsultaDentro(p) ? 'Consultar o processo' : `Abrir no ${nomeSistema(p.link)} e copiar`)

async function abrirNoTribunal({ processo = '', tribunal = '', link = '', caso = null, forcarSite = false, naConversa = null }) {
	CONSULTA.naConversa = naConversa // aberta de uma resposta: o resultado volta para a mesma conversa
	CONSULTA.caso = caso || casoDoProcesso(processo)
	CONSULTA.processo = processo
	CONSULTA.vistas = 0
	const dentro = !forcarSite && processo && tribunalConsultaDentro({ processo, tribunal })
	if (dentro) return consultarDentro({ processo, tribunal: dentro, link })
	// O número vai para a área de transferência: lá no sistema é só colar (Ctrl+V) na busca.
	let copiado = false
	if (processo) { try { await navigator.clipboard.writeText(processo); copiado = true } catch {} }
	try { await api('tribunal/abrir', { processo, tribunal, link, sistema: nomeSistema(link) }) } catch (e) { return aviso(e.message) }
	mostrarDialogoTribunal(copiado)
}

function mostrarDialogoTribunal(copiado) {
	let d = $('#d-tribunal')
	if (!d) { d = document.createElement('dialog'); d.id = 'd-tribunal'; document.body.append(d) }
	CONSULTA.dialogo = d
	d.innerHTML = `<div class="janela esc-janela trib-janela">
		<h2>Consulta no site do tribunal</h2>
		<p class="det">Este tribunal não aceita consulta feita pelo BDS Jus, então abri o site dele numa janela à parte. Siga os passos:</p>
		<ol class="trib-instrucoes">
			<li><b>Entre com o seu certificado.</b> O Windows mostra a janela para escolher o certificado; no token ou cartão, digite o PIN. A janela é privada: nada fica salvo nela, e o BDS Jus não vê o certificado nem o PIN.</li>
			<li><b>Procure o processo.</b> ${CONSULTA.processo ? `${copiado ? 'O número já está copiado' : 'Copie o número'} (<b>${escapar(CONSULTA.processo)}</b>): na busca do site, cole com <b>Ctrl+V</b>.` : 'Busque como você sempre faz.'}</li>
			<li><b>Traga o que importa.</b> Com os eventos, a decisão ou o documento aberto na tela, clique no botão dourado <b>"Copiar esta página para o BDS Jus"</b>, no canto de baixo da janela.</li>
			<li><b>Use aqui.</b> A página aparece logo abaixo: guarde no caso ou pergunte sobre ela.</li>
		</ol>
		${CONSULTA.caso ? `<p class="det">Caso: <b>${escapar(CONSULTA.caso.cliente)}</b>. As cópias podem ser guardadas na ficha dele.</p>` : ''}
		<div id="trib-copias" class="esc-lista"><p class="esc-vazio">Nenhuma página copiada ainda.</p></div>
		<div class="fim"><span id="trib-situacao" class="det" style="flex:1"></span><button type="button" class="opcao discreta" id="trib-fechar-nav">Fechar a janela do tribunal</button><button type="button" class="opcao" id="trib-sair">Fechar</button></div>
	</div>`
	if (!d.open) d.showModal()
	d.querySelector('#trib-fechar-nav').onclick = async () => { try { await api('tribunal/fechar', {}) } catch {} ; atualizarTribunal() }
	d.querySelector('#trib-sair').onclick = () => fecharDialogoTribunal()
	d.onclose = () => { clearInterval(CONSULTA.vigia); CONSULTA.vigia = null }
	clearInterval(CONSULTA.vigia)
	CONSULTA.vigia = setInterval(atualizarTribunal, 1500)
	atualizarTribunal()
}

function fecharDialogoTribunal() {
	clearInterval(CONSULTA.vigia); CONSULTA.vigia = null
	CONSULTA.dialogo?.close()
}

async function atualizarTribunal() {
	const d = CONSULTA.dialogo
	if (!d?.open) return
	let e
	try { e = await api('tribunal/estado') } catch { return }
	d.querySelector('#trib-situacao').textContent = e.aberta ? `Janela aberta${e.host ? ' em ' + e.host : ''}.` : 'A janela do tribunal foi fechada.'
	d.querySelector('#trib-fechar-nav').hidden = !e.aberta
	if (e.copias.length === CONSULTA.vistas && d.querySelector('.trib-copia, .esc-vazio')) return
	CONSULTA.vistas = e.copias.length
	const lista = d.querySelector('#trib-copias')
	if (!e.copias.length) { lista.innerHTML = '<p class="esc-vazio">Nenhuma página copiada ainda.</p>'; return }
	lista.innerHTML = ''
	for (const c of [...e.copias].reverse()) {
		const el = document.createElement('div')
		el.className = 'trib-copia'
		el.innerHTML = `<div class="cab"><b>${escapar(c.titulo || 'Página copiada')}</b><small>${horaBR(c.quando)} · ${Math.round(c.tamanho / 100) / 10} mil caracteres${c.cortado ? ' (página longa: guardei o começo)' : ''}</small></div>
			<div class="previa-texto">${escapar(c.previa)}${c.tamanho > c.previa.length ? '…' : ''}</div>
			<div class="opcoes">
				<button class="opcao principal" data-a="guardar">${CONSULTA.caso ? 'Guardar no caso' : 'Guardar num caso…'}</button>
				<button class="opcao" data-a="perguntar">Perguntar sobre isso</button>
				<button class="opcao discreta" data-a="descartar">Descartar</button>
			</div>`
		el.querySelector('[data-a=guardar]').onclick = (ev) => guardarCopia(c.quando, ev.target)
		el.querySelector('[data-a=perguntar]').onclick = () => perguntarSobreCopia(c.quando)
		el.querySelector('[data-a=descartar]').onclick = async () => { await api('tribunal/descartar', { quando: c.quando }); CONSULTA.vistas = -1; atualizarTribunal() }
		lista.append(el)
	}
}

async function textoDaCopia(quando) { return api('tribunal/copia?quando=' + encodeURIComponent(quando)) }

/* ---------- consulta dentro da Central: ela digita o código da imagem, a Central traz o processo ---------- */
async function consultarDentro({ processo, tribunal, link }) {
	let d = $('#d-tribunal')
	if (!d) { d = document.createElement('dialog'); d.id = 'd-tribunal'; document.body.append(d) }
	CONSULTA.dialogo = d
	clearInterval(CONSULTA.vigia); CONSULTA.vigia = null
	d.innerHTML = `<div class="janela esc-janela trib-janela">
		<h2>Consultar o processo no ${escapar(tribunal)}</h2>
		<p class="det">Processo <b>${escapar(processo)}</b>${CONSULTA.caso ? ` · caso de <b>${escapar(CONSULTA.caso.cliente)}</b>` : ''}. O tribunal pede um código de confirmação: digite as letras e números da imagem e o BDS Jus traz o processo para cá, sem abrir navegador.</p>
		<form id="cp-form" class="cp-form">
			<div class="cp-imagem" id="cp-imagem"><span class="det">Buscando a imagem no tribunal…</span></div>
			<input id="cp-codigo" name="codigo" autocomplete="off" spellcheck="false" maxlength="8" placeholder="Código da imagem" required disabled>
			<button class="opcao principal" id="cp-consultar" disabled>Consultar</button>
			<button type="button" class="opcao discreta" id="cp-nova">Nova imagem</button>
		</form>
		<p id="cp-msg" class="det cp-msg" hidden></p>
		<div id="cp-resultado" class="esc-lista"></div>
		<div class="fim"><button type="button" class="opcao discreta" id="cp-site">Abrir no site do tribunal</button><span style="flex:1"></span><button type="button" class="opcao" id="trib-sair">Fechar</button></div>
	</div>`
	if (!d.open) d.showModal()
	const f = d.querySelector('#cp-form'), msg = d.querySelector('#cp-msg')
	let sessao = null
	const mostrarMsg = (t) => { msg.textContent = t || ''; msg.hidden = !t }
	const porImagem = (src) => {
		d.querySelector('#cp-imagem').innerHTML = `<img alt="Código de confirmação do tribunal" src="${src}">`
		f.codigo.disabled = false; f.codigo.value = ''; d.querySelector('#cp-consultar').disabled = false; f.codigo.focus()
	}
	async function novaImagem() {
		d.querySelector('#cp-imagem').innerHTML = '<span class="det">Buscando a imagem no tribunal…</span>'
		f.codigo.disabled = true; d.querySelector('#cp-consultar').disabled = true
		try { sessao = await api('consulta-publica/iniciar', { tribunal }); porImagem(sessao.imagem) }
		catch (e) { d.querySelector('#cp-imagem').innerHTML = ''; mostrarMsg(e.message + ' Se continuar, use "Abrir no site do tribunal".') }
	}
	f.onsubmit = async (ev) => {
		ev.preventDefault()
		if (!sessao) return
		const botao = d.querySelector('#cp-consultar')
		botao.disabled = true; botao.textContent = 'Consultando…'; mostrarMsg('')
		try {
			const r = await api('consulta-publica/consultar', { id: sessao.id, processo, codigo: f.codigo.value })
			if (!r.ok) { mostrarMsg(r.mensagem); if (r.imagem) porImagem(r.imagem); else await novaImagem(); return }
			f.hidden = true
			mostrarMsg('')
			mostrarResultadoConsulta(r.copia)
		} catch (e) { mostrarMsg(e.message); await novaImagem() }
		finally { botao.textContent = 'Consultar'; if (!f.hidden) botao.disabled = false }
	}
	d.querySelector('#cp-nova').onclick = () => { mostrarMsg(''); novaImagem() }
	d.querySelector('#cp-site').onclick = () => abrirNoTribunal({ processo, tribunal, link, caso: CONSULTA.caso, forcarSite: true, naConversa: CONSULTA.naConversa })
	d.querySelector('#trib-sair').onclick = () => fecharDialogoTribunal()
	novaImagem()
}

function mostrarResultadoConsulta(c) {
	const lista = CONSULTA.dialogo.querySelector('#cp-resultado')
	const el = document.createElement('div')
	el.className = 'trib-copia'
	el.innerHTML = `<div class="cab"><b>${escapar(c.titulo)}</b><small>${horaBR(c.quando)} · ${Math.round(c.texto.length / 100) / 10} mil caracteres${c.cortado ? ' (processo longo: trouxe o começo)' : ''}</small></div>
		<div class="previa-texto cp-texto">${escapar(c.texto.slice(0, 1500))}${c.texto.length > 1500 ? '…' : ''}</div>
		<div class="opcoes">${CONSULTA.naConversa
			? `<button class="opcao principal" data-a="perguntar">Mandar para a conversa</button>
			<button class="opcao" data-a="guardar">${CONSULTA.caso ? 'Guardar no caso' : 'Guardar num caso…'}</button>`
			: `<button class="opcao principal" data-a="guardar">${CONSULTA.caso ? 'Guardar no caso' : 'Guardar num caso…'}</button>
			<button class="opcao" data-a="perguntar">Perguntar sobre isso</button>`}
		</div>`
	el.querySelector('[data-a=guardar]').onclick = (ev) => guardarCopia(c.quando, ev.target, c)
	el.querySelector('[data-a=perguntar]').onclick = () => perguntarSobreCopia(c.quando, c)
	lista.replaceChildren(el)
}

async function guardarCopia(quando, botao, copiaPronta = null) {
	try { ESC.estado = await api('escritorio/estado') } catch {}
	if (!ESC.estado?.desbloqueado) return aviso('Para guardar no caso, abra o Escritório e entre com a senha dele primeiro.')
	if (!ESC.dados.casos.length) await carregarEscritorio()
	let caso = CONSULTA.caso && ESC.dados.casos.find((c) => c.id === CONSULTA.caso.id)
	if (!caso) {
		const nomes = ESC.dados.casos.map((c, k) => `${k + 1}. ${c.cliente}${c.assunto ? ' · ' + c.assunto : ''}`).join('\n')
		const n = Number(prompt(`Em qual caso guardar? Digite o número:\n\n${nomes}`))
		caso = ESC.dados.casos[n - 1]
		if (!caso) return
		CONSULTA.caso = caso
	}
	botao.disabled = true
	try {
		const c = copiaPronta || await textoDaCopia(quando)
		if ((caso.copias || []).some((x) => x.texto === c.texto)) { botao.textContent = '✓ Já estava no caso'; return }
		const r = await apiEsc('salvar', { colecao: 'casos', item: { ...caso, copias: [...(caso.copias || []), { quando: c.quando, sistema: c.sistema, processo: c.processo, titulo: c.titulo, url: c.url, texto: c.texto }] } })
		const k = ESC.dados.casos.findIndex((x) => x.id === caso.id); if (k >= 0) ESC.dados.casos[k] = r.item
		CONSULTA.caso = r.item
		botao.textContent = '✓ Guardado no caso'
		aviso(`Página guardada na ficha de ${caso.cliente} (fica cifrada, como o resto do caso).`)
	} catch (e) { aviso(e.message); botao.disabled = false }
}

// Economia de token: vai a página (até 12 mil caracteres), não o processo inteiro; a pergunta é objetiva.
async function perguntarSobreCopia(quando, copiaPronta = null) {
	let c = copiaPronta
	try { c = c || await textoDaCopia(quando) } catch (e) { return aviso(e.message) }
	const corpo = c.texto.length > LIMITE_PERGUNTA ? c.texto.slice(0, LIMITE_PERGUNTA) + '\n[…a página continua; se precisar do resto, me diga]' : c.texto
	// Veio de um botão numa resposta e ela continua nessa conversa: o resultado vai para lá (a conversa já tem o contexto).
	const mesma = CONSULTA.naConversa && CONSULTA.naConversa === atual && telas.has(atual)
	fecharDialogoTribunal()
	if (typeof esconderQuadro === 'function' && typeof quadroAberto !== 'undefined' && quadroAberto) esconderQuadro()
	if (typeof esconderEscritorio === 'function' && typeof ESC !== 'undefined' && ESC.aberto) esconderEscritorio()
	if (mesma) return enviar(`Consultei o processo ${c.processo || ''} na consulta pública do ${c.sistema || 'tribunal'} em ${dataBR(c.quando)} (pelo botão do BDS Jus):\n\n${corpo}\n\nSiga com o que você precisava. Se ainda faltar algo que só eu consigo ver logada, diga exatamente o quê.`)
	novaConversa()
	const t = telas.get(atual)
	t.titulo = `${c.sistema || 'eproc'} · ${c.processo || c.titulo || 'página copiada'}`
	$('#titulo').textContent = t.titulo
	await enviar(`Copiei esta página do ${c.sistema || 'sistema do tribunal'}${c.processo ? ` (processo ${c.processo})` : ''} em ${dataBR(c.quando)}, "${c.titulo || ''}":\n\n${corpo}\n\nO que há de importante aqui, o que mudou e o que preciso providenciar (com prazo, se houver)?`)
}
