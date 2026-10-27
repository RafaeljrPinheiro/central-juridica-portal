// Treino de sustentação oral: gravar ou importar o áudio, transcrever no computador e pedir o retorno à skill.
// O navegador converte qualquer formato comum (gravação, MP3, M4A, WAV) para 16 kHz mono antes de enviar,
// então o servidor não precisa de conversor de áudio. Depende de app.js e quadro.js.
// A janela é uma "tribuna": cronômetro em anel contra o tempo previsto, onda do microfone ao vivo e leitura de pausas.
// Os números da tela são uma prévia feita aqui; os que vão para a análise são os do servidor (medir()).
const jobsSustentacao = new Map()
let gravador = null
let audioEscolhido = null
let somEscolhido = null // AudioBuffer já decodificado do áudio escolhido
let relogioGravacao = null
let destinoSustentacao = null // conversa onde o resultado entra (nova, ou a mesma, para comparar uma nova tentativa)
let vivo = null // { ctx, analisador, serie, inicio } durante a gravação
let ondaFinal = [] // envelope do áudio escolhido, para desenhar e tocar

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const virgula = (n) => String(n).replace('.', ',')
const PASSO_ONDA = 0.1 // cada ponto da série de volume cobre 100 ms
const ANEL_SUS = 2 * Math.PI * 52
const $$ = (s) => [...document.querySelectorAll(s)]
const cor = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim()

// modo: 'sustentacao' (treino) ou 'atendimento' (conversa com o cliente → resumo e sugestões para o Escritório).
// casoId: caso do Escritório que dá contexto (opcional; o cofre nunca vai junto).
// pergunta: treinar a resposta à pergunta difícil do retorno anterior (na mesma conversa).
let modoGravacao = 'sustentacao'
async function abrirSustentacao(conversa = null, { modo = 'sustentacao', casoId = null, pergunta = '' } = {}) {
	destinoSustentacao = conversa
	modoGravacao = modo
	audioEscolhido = null
	somEscolhido = null
	ondaFinal = []
	const atend = modo === 'atendimento'
	$('#d-sustentacao h2').textContent = atend ? 'Gravar atendimento' : pergunta ? 'Responder à pergunta difícil' : 'Treinar sustentação oral'
	$('#sus-selo').textContent = atend ? 'Atendimento' : pergunta ? 'Tribuna · resposta' : 'Tribuna · treino'
	$('#sus-explica').textContent = atend
		? 'Grave a conversa com o cliente ou use um arquivo de áudio. A transcrição é feita neste computador; depois a Central resume o atendimento e sugere as tarefas combinadas, que você confirma antes de entrarem no Escritório. O áudio fica guardado neste computador, anexado ao caso. Combine com o cliente que a conversa será gravada.'
		: pergunta ? 'Responda como faria diante do julgador. O retorno compara com a tentativa anterior e diz se a pergunta foi respondida.'
		: 'Fale como na tribuna. A transcrição é feita neste computador; depois você recebe até 3 pontos fortes, 3 a melhorar e uma pergunta difícil do julgador.'
	$('#sus-pergunta').hidden = !pergunta
	$('#sus-pergunta').textContent = pergunta ? `“${pergunta}”` : ''
	$('#sus-tema-rotulo').style.display = atend ? 'none' : 'grid'
	$('#sus-tempo-rotulo').style.display = atend ? 'none' : 'flex'
	$('#sus-tema').value = pergunta ? `Resposta à pergunta difícil: "${pergunta}"` : ''
	definirTempo(pergunta ? 2 : 0)
	$('#sus-analisar').disabled = true
	$('#sus-status').textContent = conversa && !atend && !pergunta ? 'Nova tentativa: o retorno vai comparar com a anterior.' : ''
	prepararPalco()
	// Lista de casos do Escritório (se estiver aberto neste computador)
	const sel = $('#sus-caso')
	sel.innerHTML = `<option value="">${atend ? 'Cliente novo / sem caso' : 'Sem caso'}</option>`
	try {
		const e = await api('escritorio/estado')
		if (e.desbloqueado) {
			const { itens } = await api('escritorio/listar', { colecao: 'casos' })
			for (const c of itens.sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'))) sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${escapar(c.cliente)}${c.assunto ? ' · ' + escapar(c.assunto) : ''}</option>`)
		}
	} catch {}
	sel.value = casoId || ''
	$('#sus-caso-rotulo').style.display = sel.options.length < 2 ? 'none' : 'grid'
	$('#d-sustentacao').showModal()
	desenharOnda([])
}

/* ---------- a tribuna ---------- */
function passo(n) {
	$$('#sus-passos li').forEach((li, i) => { li.classList.toggle('feito', i < n - 1); li.classList.toggle('ativo', i === n - 1) })
}
function prepararPalco() {
	passo(1)
	$('#sus-palco').classList.remove('gravando')
	$('#sus-vivo').textContent = 'Microfone pronto'
	$('#sus-fala').textContent = ''
	$('#sus-gravar .rot').textContent = 'Gravar agora'
	$('#sus-pronto').hidden = true
	$('#sus-onda').hidden = false
	$('#sus-ouvir').pause()
	leituras({ pausas: 0, maior: 0, fala: 0 })
	anel(0)
}
// Tempo previsto: um dos botões (5, 10, 15) ou "outro" no campo; o campo fica vazio quando é um dos botões.
let tempoPrevisto = 0
function definirTempo(min, digitado = false) {
	tempoPrevisto = min
	const chips = $$('#sus-tempo-rotulo .chip')
	chips.forEach((c) => c.classList.toggle('escolhida', Number(c.dataset.min) === min))
	if (!digitado) $('#sus-tempo').value = min && !chips.some((c) => Number(c.dataset.min) === min) ? min : ''
	if (!gravador) anel(somEscolhido ? somEscolhido.duration : 0)
}
$$('#sus-tempo-rotulo .chip').forEach((c) => (c.onclick = () => definirTempo(tempoPrevisto === Number(c.dataset.min) ? 0 : Number(c.dataset.min))))
$('#sus-tempo').oninput = () => definirTempo(Number($('#sus-tempo').value) || 0, true)

// Anel: com tempo previsto, enche até a meta (amarelo a partir de 90%, vermelho depois); sem tempo, dá a volta a cada minuto.
function anel(seg) {
	const meta = tempoPrevisto * 60
	const p = meta ? Math.min(seg / meta, 1) : (seg % 60) / 60
	const caixa = $('#sus-anel')
	caixa.querySelector('.progresso').style.strokeDashoffset = ANEL_SUS * (1 - p)
	caixa.classList.toggle('perto', !!meta && seg >= meta * 0.9 && seg < meta)
	caixa.classList.toggle('passou', !!meta && seg >= meta)
	$('#sus-relogio').textContent = mmss(seg)
	$('#sus-meta').textContent = !meta ? (modoGravacao === 'atendimento' ? 'atendimento' : 'sem tempo previsto') : seg > meta ? `+${mmss(seg - meta)} além` : `meta ${mmss(meta)}`
}

// Pausas a partir da série de volume (um ponto a cada 100 ms): o limiar acompanha o volume da própria fala.
function lerSerie(serie) {
	const pico = serie.reduce((m, v) => Math.max(m, v), 0)
	const limiar = Math.max(0.006, pico * 0.12)
	let pausas = 0, maior = 0, corrida = 0, falou = false, falando = 0
	for (const v of serie) {
		if (v >= limiar) { falou = true; falando++; corrida = 0; continue }
		if (!falou) continue
		corrida++
		if (corrida * PASSO_ONDA >= 1.5 && (corrida - 1) * PASSO_ONDA < 1.5) pausas++
		maior = Math.max(maior, corrida * PASSO_ONDA)
	}
	return { pausas, maior, fala: serie.length ? falando / serie.length : 0, limiar }
}
function leituras({ pausas, maior, fala }) {
	$('#sus-l-pausas').textContent = pausas
	$('#sus-l-silencio').textContent = `${virgula(maior.toFixed(1))} s`
	$('#sus-l-fala').textContent = `${Math.round(fala * 100)}%`
}
function serieDe(som) {
	const dados = som.getChannelData(0)
	const passo = Math.max(1, Math.round(som.sampleRate * PASSO_ONDA))
	const serie = []
	for (let i = 0; i < dados.length; i += passo) {
		let s = 0
		const fim = Math.min(dados.length, i + passo)
		for (let j = i; j < fim; j += 4) s += dados[j] * dados[j]
		serie.push(Math.sqrt(s / Math.ceil((fim - i) / 4)))
	}
	return serie
}
// Reduz a série a n barras (o valor mais alto de cada trecho).
function barrasOnda(serie, n) {
	if (!serie.length) return []
	const out = []
	for (let i = 0; i < n; i++) {
		const a = Math.floor((i * serie.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * serie.length) / n))
		let m = 0
		for (let j = a; j < b && j < serie.length; j++) m = Math.max(m, serie[j])
		out.push(m)
	}
	return out
}

function telaCanvas(canvas) {
	const r = window.devicePixelRatio || 1
	const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
	if (canvas.width !== Math.round(w * r)) { canvas.width = Math.round(w * r); canvas.height = Math.round(h * r) }
	const g = canvas.getContext('2d')
	g.setTransform(r, 0, 0, r, 0, 0)
	g.clearRect(0, 0, w, h)
	return { g, w, h }
}
// Ao vivo: as barras correm da direita para a esquerda; silêncio fica apagado.
function desenharOnda(serie) {
	const { g, w, h } = telaCanvas($('#sus-onda'))
	const n = Math.floor(w / 5)
	const ultimas = serie.slice(-n)
	const { limiar } = lerSerie(serie)
	const pico = Math.max(limiar / 0.12, 0.02)
	const latao = cor('--latao'), apagado = cor('--marinho-suave')
	for (let i = 0; i < n; i++) {
		const v = ultimas[i - (n - ultimas.length)]
		const alt = v == null ? 2 : Math.max(2, Math.min(1, v / pico) * (h - 6))
		g.fillStyle = v != null && v >= limiar ? latao : apagado
		g.globalAlpha = v != null && v >= limiar ? 1 : 0.35
		g.fillRect(i * 5, (h - alt) / 2, 3, alt)
	}
	g.globalAlpha = 1
}
// Depois de gravar: a onda inteira, com o trecho já ouvido em latão. Clicar leva àquele ponto.
function desenharFinal() {
	const { g, w, h } = telaCanvas($('#sus-onda-final'))
	const ouvir = $('#sus-ouvir')
	const n = Math.floor(w / 4)
	const bs = barrasOnda(ondaFinal, n)
	const pico = Math.max(...bs, 0.02)
	const feito = ouvir.duration ? ouvir.currentTime / ouvir.duration : 0
	const latao = cor('--latao'), apagado = cor('--marinho-suave')
	bs.forEach((v, i) => {
		const alt = Math.max(2, (v / pico) * (h - 4))
		g.fillStyle = i / n < feito ? latao : apagado
		g.fillRect(i * 4, (h - alt) / 2, 2.5, alt)
	})
}
$('#sus-onda-final').onclick = (e) => {
	const ouvir = $('#sus-ouvir')
	if (!ouvir.duration) return
	const r = e.currentTarget.getBoundingClientRect()
	ouvir.currentTime = ((e.clientX - r.left) / r.width) * ouvir.duration
	desenharFinal()
}
$('#sus-tocar').onclick = () => { const o = $('#sus-ouvir'); o.paused ? o.play() : o.pause() }
$('#sus-ouvir').onplay = () => ($('#sus-tocar').textContent = '❚❚')
$('#sus-ouvir').onpause = () => ($('#sus-tocar').textContent = '▶')
$('#sus-ouvir').ontimeupdate = () => { desenharFinal(); const o = $('#sus-ouvir'); $('#sus-relogio').textContent = mmss(o.currentTime) }
$('#sus-ouvir').onended = () => { anel(somEscolhido?.duration || 0) }

async function escolher(blob, rotulo) {
	audioEscolhido = blob
	const ctx = new AudioContext()
	try { somEscolhido = await ctx.decodeAudioData(await blob.arrayBuffer()) }
	catch { somEscolhido = null; audioEscolhido = null; $('#sus-status').textContent = 'Não consegui abrir esse arquivo de áudio. Tente MP3, M4A, WAV ou OGG.'; return }
	finally { ctx.close() }
	ondaFinal = serieDe(somEscolhido)
	const ouvir = $('#sus-ouvir')
	ouvir.src = URL.createObjectURL(blob)
	$('#sus-onda').hidden = true
	$('#sus-pronto').hidden = false
	$('#sus-vivo').textContent = 'Gravação pronta'
	$('#sus-fala').textContent = 'toque na onda para ouvir um trecho'
	leituras(lerSerie(ondaFinal))
	anel(somEscolhido.duration)
	desenharFinal()
	passo(3)
	$('#sus-status').textContent = rotulo
	$('#sus-analisar').disabled = false
}

function pararVivo() {
	clearInterval(relogioGravacao)
	if (vivo) { vivo.ctx.close().catch(() => {}); vivo = null }
	$('#sus-palco').classList.remove('gravando')
}
$('#sus-gravar').onclick = async () => {
	if (gravador) return gravador.stop()
	let stream
	try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) }
	catch { return aviso('Não consegui usar o microfone. Confira se ele está ligado e se o Windows permite o acesso.') }
	const pedacos = []
	gravador = new MediaRecorder(stream)
	gravador.ondataavailable = (e) => e.data.size && pedacos.push(e.data)
	gravador.onstop = () => {
		pararVivo()
		stream.getTracks().forEach((t) => t.stop())
		const blob = new Blob(pedacos, { type: gravador.mimeType })
		const cancelada = gravador.cancelada
		gravador = null
		$('#sus-gravar .rot').textContent = 'Gravar de novo'
		if (!cancelada) escolher(blob, 'Ouça se quiser e clique em Analisar.')
	}
	// O mesmo áudio do microfone alimenta a onda e a leitura de pausas, sem sair do computador.
	const ctx = new AudioContext()
	const analisador = ctx.createAnalyser()
	analisador.fftSize = 2048
	ctx.createMediaStreamSource(stream).connect(analisador)
	const amostra = new Float32Array(analisador.fftSize)
	vivo = { ctx, analisador, serie: [], inicio: Date.now() }
	gravador.start(1000)
	audioEscolhido = null
	somEscolhido = null
	$('#sus-palco').classList.add('gravando')
	$('#sus-vivo').textContent = 'Gravando'
	$('#sus-fala').textContent = ''
	$('#sus-gravar .rot').textContent = 'Parar'
	$('#sus-pronto').hidden = true
	$('#sus-onda').hidden = false
	$('#sus-ouvir').pause()
	$('#sus-analisar').disabled = true
	$('#sus-status').textContent = ''
	passo(2)
	relogioGravacao = setInterval(() => {
		if (!vivo) return
		analisador.getFloatTimeDomainData(amostra)
		let s = 0
		for (const v of amostra) s += v * v
		vivo.serie.push(Math.sqrt(s / amostra.length))
		const l = lerSerie(vivo.serie)
		const ultimo = vivo.serie[vivo.serie.length - 1]
		$('#sus-fala').textContent = ultimo >= l.limiar ? 'falando' : 'pausa'
		leituras(l)
		anel((Date.now() - vivo.inicio) / 1000)
		desenharOnda(vivo.serie)
	}, PASSO_ONDA * 1000)
}
$('#sus-arquivo').onchange = (e) => {
	const f = e.target.files[0]
	if (f) escolher(f, `Arquivo: ${f.name}`)
	e.target.value = ''
}
// Fechar a janela no meio da gravação descarta a gravação.
$('#d-sustentacao').addEventListener('close', () => {
	if (gravador) { gravador.cancelada = true; gravador.stop() }
	$('#sus-ouvir').pause()
})

// Converte para 16 kHz mono (o formato que o transcritor usa) e para 16 bits, que é metade do tamanho.
async function converter(som) {
	const off = new OfflineAudioContext(1, Math.ceil(som.duration * 16000), 16000)
	const fonte = off.createBufferSource()
	fonte.buffer = som
	fonte.connect(off.destination)
	fonte.start()
	const f32 = (await off.startRendering()).getChannelData(0)
	const pcm = new Int16Array(f32.length)
	for (let i = 0; i < f32.length; i++) pcm[i] = Math.max(-1, Math.min(1, f32[i])) * 32767
	return { pcm, duracao: som.duration }
}
// 60 barras da onda num texto curto (0–9, a–z) para o painel do pedido redesenhar depois; "0" é silêncio.
function ondaCompacta(serie) {
	const { limiar } = lerSerie(serie)
	const bs = barrasOnda(serie, 60)
	const pico = Math.max(...bs, 0.02)
	return bs.map((v) => (v < limiar ? '0' : Math.max(1, Math.round((v / pico) * 35)).toString(36))).join('')
}

$('#sus-analisar').onclick = async () => {
	if (!audioEscolhido || !somEscolhido) return
	const contexto = $('#sus-tema').value.trim()
	const tempo = tempoPrevisto
	const casoId = $('#sus-caso').value || null
	const modo = modoGravacao
	const som = somEscolhido
	const onda = ondaCompacta(ondaFinal)
	const nomeCaso = casoId ? $('#sus-caso').selectedOptions[0].textContent.split(' · ')[0] : ''
	$('#d-sustentacao').close()
	if (modo === 'atendimento' && typeof enviarAtendimentoLink === 'function') return atendimentoPeloLink(som, casoId, nomeCaso, audioEscolhido)
	let t = destinoSustentacao && telas.get(destinoSustentacao)
	if (t) mostrar(t.id)
	else {
		novaConversa()
		t = telas.get(atual)
		t.titulo = modo === 'atendimento' ? `Atendimento · ${nomeCaso || new Date().toLocaleDateString('pt-BR')}` : `Sustentação oral · ${nomeCaso || new Date().toLocaleDateString('pt-BR')}`
		t.vazia = false
		$('#titulo').textContent = t.titulo
		t.el.innerHTML = ''
	}
	const card = document.createElement('div')
	card.className = 'msg ela'
	card.innerHTML = `<div class="pedido sus-proc"><div class="tit">${modo === 'atendimento' ? 'Preparando o atendimento' : 'Preparando a sustentação'}</div>
		<ol class="sus-etapas"><li class="agora">Preparar o áudio</li><li>Transcrever neste computador</li><li>${modo === 'atendimento' ? 'Resumo da Central' : 'Retorno da Central'}</li></ol>
		<div class="sus-progresso"><i></i></div><div class="det"></div></div>`
	t.el.append(card); rolar(t)
	const etapa = (n) => card.querySelectorAll('.sus-etapas li').forEach((li, i) => { li.classList.toggle('feito', i < n); li.classList.toggle('agora', i === n) })
	try {
		const { pcm, duracao } = await converter(som)
		// Atendimento: o servidor guarda o áudio neste computador e anexa ao caso.
		const extra = modo === 'atendimento' ? `?atendimento=1&caso=${encodeURIComponent(casoId || '')}&nome=${encodeURIComponent(nomeCaso)}` : ''
		const r = await fetch('/api/sustentacao' + extra, { method: 'POST', headers: { 'x-token': token }, body: pcm.buffer })
		const j = await r.json()
		if (!r.ok) throw new Error(j.erro || 'Falha ao enviar o áudio.')
		const info = { t, card, contexto, tempo, duracao, inicio: Date.now(), modo, casoId, onda }
		etapa(1)
		info.relogio = setInterval(() => {
			const passou = (Date.now() - info.inicio) / 1000
			// costuma levar menos que a duração do áudio: a barra anda contra ela e para em 95%
			card.querySelector('.sus-progresso i').style.width = `${Math.min(95, (passou / Math.max(duracao, 1)) * 100)}%`
			card.querySelector('.det').textContent = `Áudio de ${mmss(duracao)} · transcrevendo há ${mmss(passou)}. Pode usar outras conversas enquanto isso.`
		}, 1000)
		jobsSustentacao.set(j.job, info)
		card.querySelector('.tit').textContent = modo === 'atendimento' ? 'Transcrevendo o atendimento' : 'Transcrevendo a sustentação'
	} catch (e) {
		card.querySelector('.pedido').classList.add('alerta')
		card.querySelector('.tit').textContent = e.message
	}
}

// Atendimento gravado no celular (link): o áudio vai trancado para a Central, que transcreve e abre sozinha a
// conversa com o resumo. O celular só acompanha; pode fechar depois do envio.
async function atendimentoPeloLink(som, casoId, nomeCaso, original = null) {
	novaConversa()
	const t = telas.get(atual)
	t.titulo = 'Enviando atendimento'; t.vazia = false
	$('#titulo').textContent = t.titulo
	t.el.innerHTML = ''
	const card = document.createElement('div')
	card.className = 'msg ela'
	card.innerHTML = `<div class="pedido sus-proc"><div class="tit">Atendimento${nomeCaso ? ' · ' + escapar(nomeCaso) : ''}</div>
		<ol class="sus-etapas"><li class="agora">Enviar o áudio, trancado</li><li>Transcrever no computador</li><li>Resumo e tarefas numa conversa nova</li></ol>
		<div class="det"></div></div>`
	t.el.append(card)
	const etapa = (n) => card.querySelectorAll('.sus-etapas li').forEach((li, i) => { li.classList.toggle('feito', i < n); li.classList.toggle('agora', i === n) })
	const det = (x) => (card.querySelector('.det').textContent = x)
	const tit = `Atendimento${nomeCaso ? ' · ' + escapar(nomeCaso) : ''}`
	// Se a internet cair no envio, a gravação não se perde: fica aqui para tentar de novo ou salvar no celular.
	const enviar = async () => {
		card.querySelector('.pedido').classList.remove('alerta')
		card.querySelector('.tit').innerHTML = tit
		card.querySelector('.opcoes')?.remove()
		etapa(0)
		try {
			const { pcm, duracao } = await converter(som)
			const caso = casoId && typeof resumoCasoPorId === 'function' ? await resumoCasoPorId(casoId) : ''
			const r = await enviarAtendimentoLink(pcm, { caso, casoId, nomeCaso }, det)
			etapa(1)
			det(`Áudio de ${mmss(duracao)} na Central. Pode fechar o celular: quando terminar, a conversa "Atendimento${nomeCaso ? ' · ' + nomeCaso : ''}" aparece na lista com o resumo.`)
			jobsSustentacao.set(r.job, { t, card, modo: 'link', etapa })
		} catch (e) {
			card.querySelector('.pedido').classList.add('alerta')
			card.querySelector('.tit').textContent = 'Não consegui enviar: ' + e.message
			det('A gravação continua guardada nesta tela. Não feche esta aba antes de enviar ou salvar.')
			card.querySelector('.pedido').insertAdjacentHTML('beforeend', `<div class="opcoes"><button class="opcao principal" data-de-novo>Tentar de novo</button>${original ? '<button class="opcao" data-salvar>Salvar o áudio no celular</button>' : ''}</div>`)
			card.querySelector('[data-de-novo]').onclick = enviar
			card.querySelector('[data-salvar]')?.addEventListener('click', () => {
				const a = document.createElement('a')
				a.href = URL.createObjectURL(original)
				a.download = `Atendimento${nomeCaso ? ' - ' + nomeCaso.replace(/[<>:"/\\|?*]/g, '_') : ''}.${/mp4|m4a|aac/.test(original.type) ? 'm4a' : /ogg/.test(original.type) ? 'ogg' : /wav/.test(original.type) ? 'wav' : 'webm'}`
				a.click()
			})
		}
	}
	await enviar()
}

// Eventos do servidor sobre a transcrição (chamado por app.js).
async function eventoSustentacao(ev) {
	const info = jobsSustentacao.get(ev.job)
	if (!info) return
	if (info.modo === 'link') {
		if (ev.fase === 'erro') { info.card.querySelector('.pedido').classList.add('alerta'); info.card.querySelector('.tit').textContent = 'Não consegui transcrever: ' + ev.erro }
		if (ev.fase === 'pronto') { info.etapa(2); info.card.querySelector('.det').textContent = 'Transcrito. A Central abriu a conversa do atendimento e está escrevendo o resumo: ela aparece na lista em instantes.'; setTimeout(() => typeof carregarLista === 'function' && carregarLista(), 6000) }
		if (ev.fase === 'erro' || ev.fase === 'pronto') jobsSustentacao.delete(ev.job)
		return
	}
	if (ev.fase === 'erro') {
		clearInterval(info.relogio)
		info.card.querySelector('.pedido').classList.add('alerta')
		info.card.querySelector('.tit').textContent = 'Não consegui transcrever: ' + ev.erro
		jobsSustentacao.delete(ev.job)
		return
	}
	if (ev.fase !== 'pronto') return
	clearInterval(info.relogio)
	info.card.remove()
	jobsSustentacao.delete(ev.job)
	const m = ev.metricas
	const casoTexto = info.casoId && typeof resumoCasoPorId === 'function' ? await resumoCasoPorId(info.casoId) : ''
	if (info.modo === 'atendimento') {
		return enviarEm(info.t, [
			'[ATENDIMENTO]',
			`Duração: ${mmss(m.duracao)}`,
			...(casoTexto ? ['', 'Caso do escritório:', casoTexto] : ['Cliente novo ou sem caso no Escritório.']),
			'',
			'Transcrição automática (pode ter erros de palavra):',
			ev.texto,
		].join('\n'))
	}
	const muletas = m.muletas.length ? m.muletas.map(([p, n]) => `${p} (${n})`).join(', ') : 'nenhuma contada'
	const reps = m.repeticoes.length ? m.repeticoes.map(([p, n]) => `"${p}" (${n}x)`).join(', ') : 'nenhuma'
	const prompt = [
		'[SUSTENTAÇÃO ORAL]',
		`Contexto: ${info.contexto || 'não informado'}`,
		...(casoTexto ? ['', 'Caso do escritório:', casoTexto] : []),
		`Tempo previsto: ${info.tempo ? info.tempo + ' min' : 'não informado'}`,
		'',
		'Números medidos pelo app (do próprio áudio):',
		`- Duração: ${mmss(m.duracao)}`,
		`- Palavras: ${m.palavras} (cerca de ${m.ppm} por minuto)`,
		`- Pausas de 1,5 s ou mais: ${m.pausasLongas}; maior silêncio: ${virgula(m.maiorSilencio)} s`,
		`- Muletas na transcrição: ${muletas}`,
		`- Expressões repetidas: ${reps}`,
		`Métricas (JSON): ${JSON.stringify({ ...m, tempoPrevisto: info.tempo || null, onda: info.onda || undefined })}`,
		'',
		'Transcrição automática (pode ter erros de palavra):',
		ev.texto,
	].join('\n')
	enviarEm(info.t, prompt)
}

// Envia numa conversa específica (a da sustentação), mesmo que outra esteja aberta na tela.
function enviarEm(t, msg) {
	t.vazia = false
	if (t.trabalhando) return enfileirar(t, msg)
	desenhar(t, { tipo: 'eu', texto: msg })
	despachar(t, msg)
}

/* ---------- desenho: o pedido (painel de métricas) e o retorno (uma tela) ---------- */
// Medidor de ritmo: meia-lua de 80 a 200 palavras por minuto, com a faixa de referência 120–160 marcada.
function medidor(ppm) {
	const ponto = (v, r = 48) => {
		const a = Math.PI * (1 - (Math.max(80, Math.min(200, v)) - 80) / 120)
		return `${(60 + r * Math.cos(a)).toFixed(1)} ${(60 - r * Math.sin(a)).toFixed(1)}`
	}
	const arco = (a, b) => `M ${ponto(a)} A 48 48 0 0 1 ${ponto(b)}`
	return `<svg class="sus-medidor" viewBox="0 0 120 66" aria-hidden="true"><path class="arco" d="${arco(80, 200)}"/><path class="faixa" d="${arco(120, 160)}"/>
		${ppm ? `<line class="agulha" x1="60" y1="60" x2="${ponto(ppm, 40).split(' ')[0]}" y2="${ponto(ppm, 40).split(' ')[1]}"/><circle cx="60" cy="60" r="3.5" fill="var(--tinta)"/>` : ''}</svg>`
}
function ondaSvg(onda) {
	if (!onda) return ''
	const v = [...onda].map((c) => parseInt(c, 36) || 0)
	return `<svg class="sus-onda" viewBox="0 0 ${v.length * 4} 34" preserveAspectRatio="none" aria-hidden="true">${v.map((x, i) => {
		const h = x ? Math.max(3, (x / 35) * 32) : 2
		return `<rect${x ? '' : ' class="mudo"'} x="${i * 4}" y="${((34 - h) / 2).toFixed(1)}" width="2.6" height="${h.toFixed(1)}" rx="1"/>`
	}).join('')}</svg>`
}
function sustentacaoEu(texto) {
	const d = document.createElement('div')
	d.className = 'msg eu sus-eu'
	let m = {}
	try { m = JSON.parse(texto.match(/^Métricas \(JSON\): (.+)$/m)?.[1] || '{}') } catch {}
	const contexto = texto.match(/^Contexto: (.+)$/m)?.[1]
	const transcricao = texto.split('Transcrição automática (pode ter erros de palavra):\n')[1] || ''
	const muletas = (m.muletas || []).reduce((s, [, n]) => s + n, 0)
	const meta = (m.tempoPrevisto || 0) * 60
	d.dataset.m = JSON.stringify({ ppm: m.ppm, pausas: m.pausasLongas, muletas, duracao: m.duracao })
	d.innerHTML = `<div class="sus-cab"><div class="sus-tit">Sustentação enviada para análise</div><span class="sus-selo" data-tentativa></span></div>
		${contexto && contexto !== 'não informado' ? `<div class="sus-ctx">${escapar(contexto)}</div>` : ''}
		${ondaSvg(m.onda)}
		<div class="sus-tiles">
			<div data-k="duracao"><span>Tempo</span><strong>${m.duracao != null ? mmss(m.duracao) : '–'}</strong>
				${meta ? `<div class="sus-barra-tempo${m.duracao > meta ? ' passou' : ''}"><i style="width:${Math.min(100, (m.duracao / meta) * 100).toFixed(0)}%"></i></div><span>${m.duracao > meta ? `${mmss(m.duracao - meta)} além dos ${m.tempoPrevisto} min` : `de ${m.tempoPrevisto} min previstos`}</span>` : '<span>sem tempo previsto</span>'}<em class="delta"></em></div>
			<div data-k="ppm"><span>Ritmo</span>${medidor(m.ppm)}<strong>${m.ppm ?? '–'}</strong><span>palavras/min · ref. 120–160</span><em class="delta"></em></div>
			<div data-k="pausas"><span>Pausas longas</span><strong>${m.pausasLongas ?? '–'}</strong><span>${m.maiorSilencio != null ? `maior silêncio ${virgula(m.maiorSilencio)} s` : ''}</span><em class="delta"></em></div>
			<div data-k="muletas"><span>Muletas</span><strong>${muletas}</strong><div class="sus-chips">${(m.muletas || []).slice(0, 3).map(([p, n]) => `<em>${escapar(p)} ×${n}</em>`).join('')}</div><em class="delta"></em></div>
		</div>
		<details><summary>Ver transcrição</summary><p>${escapar(transcricao)}</p></details>`
	// Depois de entrar na conversa: compara com a tentativa anterior da mesma conversa.
	requestAnimationFrame(() => {
		const todas = [...(d.parentElement?.querySelectorAll('.sus-eu[data-m]') || [])]
		const i = todas.indexOf(d)
		if (i < 1) return
		d.querySelector('[data-tentativa]').textContent = `Tentativa ${i + 1}`
		const antes = JSON.parse(todas[i - 1].dataset.m), agora = JSON.parse(d.dataset.m)
		const marcar = (k, menorMelhor, fmt = (x) => x) => {
			if (antes[k] == null || agora[k] == null) return
			const dif = agora[k] - antes[k]
			const el = d.querySelector(`[data-k="${k}"] .delta`)
			el.textContent = dif === 0 ? '= anterior' : `${dif > 0 ? '▲' : '▼'} ${fmt(Math.abs(dif))} vs. anterior`
			if (menorMelhor && dif) el.classList.add(dif < 0 ? 'bom' : 'ruim')
		}
		marcar('duracao', false, mmss)
		marcar('ppm', false)
		marcar('pausas', true)
		marcar('muletas', true)
	})
	return d
}

function resposta(texto) {
	const m = texto.match(/```json sustentacao-oral\s*([\s\S]*?)```/)
	if (!m) return md(texto)
	let r
	try { r = JSON.parse(m[1]) } catch { return md(texto) }
	const caixa = document.createElement('div')
	const antes = texto.slice(0, m.index).trim()
	const depois = texto.slice(m.index + m[0].length).trim()
	if (antes) caixa.append(md(antes))
	const lista = (itens) => (itens || []).slice(0, 3).map((x) => `<li><span>${escapar(x)}</span></li>`).join('')
	const c = document.createElement('div')
	c.className = 'cartao sus-resultado'
	c.innerHTML = `<div><div class="sus-selo">Retorno do treino</div>${r.resumo ? `<p class="sus-resumo">${escapar(r.resumo)}</p>` : ''}</div>
		<div class="sus-colunas">
			<div><div class="sus-sub">Pontos fortes</div><ol class="sus-fortes">${lista(r.fortes)}</ol></div>
			<div><div class="sus-sub">Para melhorar</div><ol class="sus-melhorias">${lista(r.melhorias)}</ol></div>
		</div>
		${r.pergunta ? `<div class="sus-pergunta"><div class="sus-selo">Pergunta do julgador</div><p>${escapar(r.pergunta)}</p>
			<div class="opcoes"><button class="opcao principal" data-sus="resposta">Treinar a resposta</button><button class="opcao" data-sus="nova">Gravar nova tentativa</button></div></div>`
			: '<div class="opcoes"><button class="opcao principal" data-sus="nova">Gravar nova tentativa</button></div>'}
		${r.observacoes ? `<p class="sus-obs">${escapar(r.observacoes)}</p>` : ''}`
	const conversa = (el) => [...telas.values()].find((x) => x.el.contains(el))?.id || atual
	c.querySelectorAll('[data-sus]').forEach((b) => (b.onclick = () => abrirSustentacao(conversa(b), b.dataset.sus === 'resposta' ? { pergunta: r.pergunta } : {})))
	caixa.append(c)
	if (depois) caixa.append(md(depois))
	return caixa
}

$('#abrir-sustentacao').onclick = () => abrirSustentacao()

// O pedido de análise de um atendimento aparece compacto: título, caso e a transcrição recolhida.
function atendimentoEu(texto) {
	const d = document.createElement('div')
	d.className = 'msg eu sus-eu'
	const duracao = texto.match(/^Duração: (.+)$/m)?.[1]
	const caso = texto.match(/^Caso do escritório: (.+)$/m)?.[1]
	const transcricao = texto.split('Transcrição automática (pode ter erros de palavra):\n')[1] || ''
	d.innerHTML = `<div class="sus-tit">Atendimento enviado para análise${duracao ? ` · ${escapar(duracao)}` : ''}</div>${caso ? `<div class="sus-ctx">${escapar(caso)}</div>` : ''}
		<details><summary>Ver transcrição</summary><p>${escapar(transcricao)}</p></details>`
	return d
}
