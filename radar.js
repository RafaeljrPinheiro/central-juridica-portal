// Radar da Comarca: tela fixa (ocupa o lugar das conversas, como o Escritório). Briefing e temas vêm do
// servidor (scripts/radar.py da skill) sem passar pelo motor; só "Perguntar", "Vale estudar" e "Transformar em peça"
// abrem conversa, com um pedido "[RADAR] …" que a skill trata (módulo radar-comarca).
// Depende de app.js: $, api, aviso, escapar, telas, atual, novaConversa, enviar; e de escritorio.js: esconderEscritorio.

const RAD = { aberto: false, dados: null, ajustando: false, erro: '' }
const RAD_TERMO = { frio: 1, morno: 2, quente: 3, fervendo: 4 }
const RAD_ESTAGIO = { agir: 'Agir', preparar: 'Preparar', observar: 'Observar' }

const radarEstilo = document.createElement('style')
radarEstilo.textContent = `
.radar { height: 100%; overflow-y: auto; padding: 16px 24px 40px; }
.radar .r-topo { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
.radar h2 { margin: 0; font-size: 22px; }
.radar .r-sub { color: var(--tinta-suave); font-size: 14px; margin-top: 4px; }
.radar .r-acoes { display: flex; gap: 8px; flex-wrap: wrap; }
.radar .r-pergunta { display: flex; gap: 8px; margin: 16px 0 8px; }
.radar .r-pergunta input { flex: 1; min-width: 0; border: 1px solid var(--linha); border-radius: 8px; padding: 10px 12px; background: var(--superficie); color: var(--tinta); font: inherit; }
.radar h3 { font-size: 15px; margin: 24px 0 10px; color: var(--tinta-suave); text-transform: uppercase; letter-spacing: .04em; }
.radar .r-cartoes { display: grid; gap: 12px; }
.radar .r-cartao { border: 1px solid var(--linha); border-left: 4px solid var(--linha); border-radius: 10px; background: var(--superficie); padding: 14px 16px; }
.radar .r-cartao.agir { border-left-color: var(--latao); }
.radar .r-cartao.preparar { border-left-color: var(--petroleo); }
.radar .r-cab { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.radar .r-cab strong { font-size: 16px; margin-right: auto; }
.radar .r-chip { font-size: 12px; font-weight: 600; border-radius: 999px; padding: 2px 10px; border: 1px solid var(--linha); color: var(--tinta-suave); white-space: nowrap; }
.radar .r-chip.agir { background: var(--latao); border-color: var(--latao); color: #fff; }
.radar .r-chip.preparar { background: var(--petroleo-claro); border-color: var(--petroleo); color: var(--petroleo-forte); }
.radar .r-termo { display: inline-flex; gap: 3px; vertical-align: middle; margin-left: 4px; }
.radar .r-termo i { width: 6px; height: 12px; border-radius: 2px; background: var(--linha); }
.radar .r-termo i.on { background: var(--latao); }
.radar .r-area { color: var(--tinta-suave); font-size: 13px; margin-top: 2px; }
.radar .r-cartao ul { margin: 10px 0 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px; }
.radar .r-cartao a { color: var(--petroleo); overflow-wrap: anywhere; }
.radar .r-fonte { color: var(--tinta-suave); font-size: 12px; margin-top: 8px; }
.radar .r-botoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.radar .r-linha { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--linha); font-size: 14px; }
.radar .r-linha span:first-child { flex: 1; }
.radar .r-vazio { color: var(--tinta-suave); padding: 24px 0; }
.radar .r-carregando { color: var(--tinta-suave); font-size: 14px; display: flex; gap: 8px; align-items: center; margin-top: 8px; }
.radar .r-carregando::before { content: ""; width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--petroleo); border-top-color: transparent; animation: gira .8s linear infinite; }
.radar .r-aviso { border: 1px solid var(--alerta); background: var(--alerta-fundo); border-radius: 8px; padding: 8px 12px; font-size: 14px; margin-top: 12px; }
.radar form.r-config { display: grid; gap: 18px; max-width: 720px; margin-top: 16px; }
.radar fieldset { border: 1px solid var(--linha); border-radius: 10px; padding: 12px 14px; margin: 0; }
.radar legend { font-weight: 700; padding: 0 6px; }
.radar fieldset .det { color: var(--tinta-suave); font-size: 13px; margin: 0 0 8px; }
.radar .r-opcoes { display: flex; gap: 8px 18px; flex-wrap: wrap; }
.radar .r-opcoes label { display: flex; gap: 6px; align-items: center; font-size: 14px; }
.radar .r-temas { display: grid; gap: 6px; }
.radar .r-temas label { display: flex; gap: 8px; align-items: baseline; font-size: 14px; }
.radar .r-temas small { color: var(--tinta-suave); }
.radar .r-livre { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.radar .r-livre input { border: 1px solid var(--linha); border-radius: 6px; padding: 8px 10px; background: var(--fundo); color: var(--tinta); font: inherit; min-width: 0; }
@media (max-width: 640px) { .radar { padding: 12px; } .radar .r-livre { grid-template-columns: 1fr; } }
`
document.head.append(radarEstilo)

const radarEl = document.createElement('div')
radarEl.className = 'radar'
radarEl.id = 'radar'
radarEl.hidden = true
$('#conversas').append(radarEl)

/* ---------- abrir e fechar ---------- */
function mostrarRadar() {
	if (typeof esconderEscritorio === 'function') esconderEscritorio()
	if (typeof quadroAberto !== 'undefined' && quadroAberto) esconderQuadro()
	RAD.aberto = true
	for (const t of telas.values()) t.el.hidden = true
	radarEl.hidden = false
	$('#compositor').hidden = true
	$('#abrir-radar').setAttribute('aria-current', 'true')
	document.querySelectorAll('.aba.ativa').forEach((a) => a.classList.remove('ativa'))
	carregarRadar()
}
function esconderRadar() {
	if (!RAD.aberto) return
	RAD.aberto = false
	if (typeof fecharTour === 'function') fecharTour(false)
	radarEl.hidden = true
	$('#compositor').hidden = false
	$('#abrir-radar').removeAttribute('aria-current')
}
// Abrir uma conversa, o quadro, o escritório ou uma conversa nova fecha o radar.
for (const nome of ['mostrar', 'mostrarQuadro', 'novaConversa', 'mostrarEscritorio']) {
	const original = window[nome]
	if (typeof original === 'function') window[nome] = function (...a) { esconderRadar(); return original.apply(this, a) }
}
// Estes botões guardaram a função original antes do embrulho acima: fecham o radar antes (fase de captura).
// A sustentação abre por cima (janela): não esconde o radar, senão ao fechá-la sobrava a tela em branco (teste de UX, 06/11).
for (const id of ['#novo', '#abrir-quadro', '#abrir-escritorio']) $(id)?.addEventListener('click', esconderRadar, true)

async function carregarRadar() {
	if (!RAD.dados) radarEl.innerHTML = '<div class="r-carregando">Abrindo o radar…</div>'
	try {
		RAD.dados = await api('radar')
		RAD.erro = ''
	} catch (e) { RAD.erro = e.message }
	desenharRadar()
	// Sem coleta de hoje: busca sozinha, sem a advogada precisar pedir.
	const d = RAD.dados
	if (d?.config && !d.coletando && !d.coleta?.hoje) atualizarRadar()
}

async function atualizarRadar(forcar = false) {
	if (RAD.dados) RAD.dados.coletando = true
	desenharRadar()
	try {
		RAD.dados = await api('radar/atualizar', { forcar })
		RAD.erro = ''
	} catch (e) { RAD.erro = e.message; if (RAD.dados) RAD.dados.coletando = false }
	if (RAD.aberto && !RAD.ajustando) desenharRadar()
}

/* ---------- conversa a partir do radar ---------- */
async function pedirRadar(texto, titulo) {
	novaConversa()
	const t = telas.get(atual)
	t.titulo = `Radar · ${titulo}`
	$('#titulo').textContent = t.titulo
	await enviar(texto)
}

/* ---------- desenho ---------- */
const radarData = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const radarTermometro = (t) => `<span class="r-chip" title="Termômetro: ${t}">${t}<span class="r-termo" aria-hidden="true">${[1, 2, 3, 4].map((n) => `<i class="${n <= RAD_TERMO[t] ? 'on' : ''}"></i>`).join('')}</span></span>`

function radarCartao(e, i) {
	const linhas = []
	linhas.push(`<li><b>Por que importa aqui:</b> ${escapar(e.regiao)}</li>`)
	if (e.djen) linhas.push(`<li><b>Publicações no Diário de Justiça</b> (${escapar(e.djen.onde.join(' e '))}): ${e.djen.recentes} nas últimas 2 semanas, ${e.djen.anteriores} nas 2 anteriores.</li>`)
	if (e.aviso) linhas.push(`<li>${escapar(e.aviso)}</li>`)
	for (const p of e.projetos.slice(0, 2)) linhas.push(`<li><b>${escapar(p.sigla)}</b> — ${escapar(p.ementa.slice(0, 180))}… <i>${escapar(p.situacao || p.nivel_texto)}</i>${p.data_ultimo_ato ? `, último ato em ${radarData(p.data_ultimo_ato)}` : ''}. <a href="${escapar(p.link)}" target="_blank" rel="noopener">Ver na Câmara</a></li>`)
	linhas.push(`<li><b>Leitura do termômetro:</b> ${escapar(e.motivos.join('; '))}.</li>`)
	return `<article class="r-cartao ${e.estagio}">
		<div class="r-cab"><strong>${escapar(e.titulo)}</strong><span class="r-chip ${e.estagio}">${RAD_ESTAGIO[e.estagio]}</span>${radarTermometro(e.termometro)}</div>
		<div class="r-area">${escapar(e.areas.join(', '))} · firmeza ${escapar(e.firmeza.split(' — ')[0])}</div>
		<ul>${linhas.join('')}</ul>
		<div class="r-fonte">Fontes: ${escapar([...new Set(e.fontes.map((f) => f.split(' — ')[0]))].join(' · ') || '—')}</div>
		<div class="r-botoes">
			<button class="opcao" data-r-acao="perguntar" data-i="${i}">Perguntar sobre isso</button>
			<button class="opcao discreta" data-r-acao="estudar" data-i="${i}">Vale estudar</button>
			${e.estagio !== 'observar' ? `<button class="opcao discreta" data-r-acao="peca" data-i="${i}">Transformar em peça ou conteúdo</button>` : ''}
		</div></article>`
}

function desenharRadar() {
	const d = RAD.dados
	if (!d) { radarEl.innerHTML = `<div class="r-vazio">${escapar(RAD.erro || 'Abrindo o radar…')}</div>`; return }
	if (!d.config || RAD.ajustando) return desenharAjustes()
	const c = d.coleta
	const sub = c ? `${escapar(d.regiao)} · publicações até ${radarData(c.mais_recente)} · atualizado em ${radarData(c.gerado_em)} às ${c.gerado_em.slice(11, 16)}` : escapar(d.regiao)
	const top = d.itens.slice(0, 5), resto = d.itens.slice(5)
	radarEl.innerHTML = `
		<div class="r-topo"><div><h2>Radar da Comarca</h2><div class="r-sub">${sub}</div></div>
			<div class="r-acoes" id="r-topo-acoes"><button class="opcao discreta" id="r-atualizar" ${d.coletando ? 'disabled' : ''}>Atualizar agora</button><button class="opcao discreta" id="r-ajustar">Ajustar meu radar</button><button class="opcao discreta" id="r-como">Como funciona</button></div></div>
		${d.coletando ? '<div class="r-carregando">Buscando as publicações de hoje no Diário de Justiça e os projetos na Câmara (cerca de 1 minuto)…</div>' : ''}
		${RAD.erro ? `<div class="r-aviso">${escapar(RAD.erro)}</div>` : ''}
		${c && Object.keys(c.falhas || {}).length ? `<div class="r-aviso">Fonte fora do ar nesta busca: ${escapar(Object.keys(c.falhas).join(', '))}. O resto foi atualizado.</div>` : ''}
		<form class="r-pergunta" id="r-f-pergunta"><input name="q" placeholder="Pergunte ao radar: o que mudou em consignado este mês?" autocomplete="off"><button class="opcao">Perguntar</button></form>
		<h3>Briefing da semana</h3>
		<div class="r-cartoes">${top.length ? top.map(radarCartao).join('') : `<div class="r-vazio">${c ? 'Nenhum dos seus temas pede preparo ou ação nesta semana.' : 'Ainda sem busca. Clique em "Atualizar agora".'}</div>`}</div>
		${resto.length ? `<h3>Outros temas que você acompanha</h3>${resto.map((e, j) => `<div class="r-linha"><span>${escapar(e.titulo)}</span><span class="r-chip ${e.estagio}">${RAD_ESTAGIO[e.estagio]}</span>${radarTermometro(e.termometro)}<button class="opcao discreta" data-r-acao="perguntar" data-i="${j + 5}">Perguntar</button></div>`).join('')}` : ''}
		<p class="r-fonte">Só fontes oficiais, sempre somadas por assunto: nunca nomes de pessoas. Barulho na imprensa sem andamento oficial fica em "Observar". Confira a norma ou a tese na fonte oficial antes de citar.</p>`
	$('#r-atualizar').onclick = () => atualizarRadar(true)
	$('#r-ajustar').onclick = () => { RAD.ajustando = true; desenharRadar() }
	$('#r-como').onclick = () => tourBriefing()
	$('#r-f-pergunta').onsubmit = (ev) => {
		ev.preventDefault()
		const q = ev.target.q.value.trim()
		if (q) pedirRadar(`[RADAR] ${q}`, q.slice(0, 40))
	}
	if (top.length && !d.coletando && !tourVisto('briefing') && !tourAtivo()) setTimeout(() => { if (RAD.aberto && !RAD.ajustando && !tourAtivo()) tourBriefing() }, 400)
	radarEl.querySelectorAll('[data-r-acao]').forEach((b) => (b.onclick = () => {
		const e = d.itens[+b.dataset.i]
		if (b.dataset.rAcao === 'perguntar') pedirRadar(`[RADAR] O que mudou em ${e.titulo} (tema ${e.tema})? Explique os números e os projetos.`, e.titulo)
		if (b.dataset.rAcao === 'estudar') pedirRadar(`[RADAR] Vale estudar: ${e.titulo} (tema ${e.tema}).`, `Estudar · ${e.titulo}`)
		if (b.dataset.rAcao === 'peca') pedirRadar(`[RADAR] Transformar em peça ou conteúdo: ${e.titulo} (tema ${e.tema}, estágio ${e.estagio}).`, `Peça · ${e.titulo}`)
	}))
}

/* ---------- tours guiados: o que brilha é onde clicar; o balão explica o que é e o que configura ---------- */
function tourVisto(nome) { try { return localStorage.getItem('cj-radar-tour-' + nome) === '1' } catch { return false } }
function marcarTour(nome) { try { localStorage.setItem('cj-radar-tour-' + nome, '1') } catch {} }

function tourConfig() {
	if (!$('#r-f-config')) return
	tourGuiado([
		{ chapeu: 'Radar da Comarca', titulo: 'Saiba o que vai chegar ao seu escritório antes de chegar.', botao: 'Vamos montar',
			texto: 'Toda demanda nasce antes de virar consulta: um projeto que anda em Brasília, uma medida provisória, uma onda de ações no fórum da comarca. O Radar acompanha isso por você, todos os dias, só em fontes oficiais, e mostra o que importa para a sua região e as suas áreas. Assim você estuda a tese e prepara o modelo <b>antes</b> de o cliente chegar. Vamos montar o seu em 1 minuto.' },
		{ alvo: '#r-f-config fieldset:nth-of-type(1)', chapeu: 'Passo 1 · Cidade', titulo: 'Onde fica o seu escritório?',
			texto: 'Escreva a cidade e o estado. Se o fórum que atende a cidade fica em outra, escreva a comarca no último campo. É dessa comarca que o Radar lê as publicações.' },
		{ alvo: '#r-f-config fieldset:nth-of-type(2)', chapeu: 'Passo 2 · Vara federal', titulo: 'Onde correm os seus processos contra o INSS?',
			texto: 'Escreva a cidade da vara federal (ao clicar no campo aparecem sugestões). É de lá que o Radar lê as publicações de aposentadoria rural, BPC, auxílio por incapacidade e salário-maternidade.' },
		{ alvo: '#r-f-config fieldset:nth-of-type(3)', chapeu: 'Passo 3 · Áreas', titulo: 'Em que áreas você atua?',
			texto: 'Marque ou desmarque as áreas. Os temas de cada área entram ou saem juntos, logo abaixo.' },
		{ alvo: '#r-temas', chapeu: 'Passo 4 · Temas', titulo: 'Escolha o que quer acompanhar.',
			texto: 'Cada linha é um assunto que o Radar vigia na comarca e em Brasília. Desmarque o que não interessa: só o que ficar marcado aparece no seu briefing.' },
		{ alvo: '#r-f-config fieldset:nth-of-type(5)', chapeu: 'Passo 5 · Assunto seu', titulo: 'Quer vigiar algo que não está na lista?',
			texto: 'Escreva o assunto (por exemplo, "Golpe do Pix") e algumas palavras que aparecem nas publicações sobre ele. É opcional: dá para deixar em branco.' },
		{ alvo: '#r-f-config fieldset:nth-of-type(6)', chapeu: 'Passo 6 · O que mostrar', titulo: 'Tudo ou só o que pede ação?',
			texto: '"Tudo" inclui o que ainda é só possibilidade. "Só o que pede preparo ou ação" deixa o briefing mais curto.' },
		{ alvo: '#r-f-config fieldset:nth-of-type(7)', chapeu: 'Passo 7 · Briefing', titulo: 'Quando você quer ver?',
			texto: 'O Radar se atualiza sozinho quando você abre esta tela. Escolha se o seu hábito vai ser toda segunda-feira ou só quando quiser.' },
		{ alvo: '#r-f-config .r-acoes button.opcao', clicar: 'click', chapeu: 'Último passo', titulo: 'Agora é só montar.',
			texto: 'Clique em <b>Montar meu radar</b>. A primeira busca leva cerca de 1 minuto; depois eu mostro como ler o briefing.', dica: 'Clique no botão que está brilhando.' },
	], { aoFim: () => marcarTour('config') })
}

function tourBriefing() {
	if (!$('.r-cartao')) return
	tourGuiado([
		{ alvo: '.r-cartao', chapeu: 'Seu briefing', titulo: 'Cada cartão é um assunto se movendo na sua região.',
			texto: 'O briefing traz até 5 assuntos, do mais urgente para o menos. Em 2 ou 3 minutos você sabe o que mudou na semana.' },
		{ alvo: '.r-cartao .r-cab .r-chip', chapeu: 'Estágio', titulo: 'Observar, Preparar ou Agir.',
			texto: '<b>Observar</b>: é possibilidade. <b>Preparar</b>: indícios fortes, hora de estudar. <b>Agir</b>: a demanda já está chegando ou a norma já vale, hora de ter o modelo pronto.' },
		{ alvo: '.r-cartao .r-cab .r-chip:last-child', chapeu: 'Termômetro', titulo: 'A pressão do assunto.',
			texto: 'De frio a fervendo. Andamento oficial (projeto com relator, urgência, medida provisória) pesa mais; volume e velocidade das publicações somam. Barulho na imprensa sem andamento oficial não esquenta o termômetro.' },
		{ alvo: '.r-cartao ul', chapeu: 'Por que importa', titulo: 'Os fatos, com a fonte.',
			texto: 'Por que o assunto importa aqui, quantas publicações saíram no Diário de Justiça e quais projetos andaram, com o link oficial. Tudo somado por assunto: nunca nomes de pessoas.' },
		{ alvo: '.r-cartao [data-r-acao="perguntar"]', chapeu: 'Ação', titulo: 'Perguntar sobre isso.',
			texto: 'Abre uma conversa já com o assunto: o que mudou, o que a norma diz, o que esperar. Responde com a fonte oficial.' },
		{ alvo: '.r-cartao [data-r-acao="estudar"]', chapeu: 'Ação', titulo: 'Vale estudar.',
			texto: 'A tese ou a norma nova em um parágrafo, explicada em linguagem de colega, com a fonte oficial para você conferir.' },
		{ alvo: '.r-cartao .r-botoes', chapeu: 'Ação', titulo: 'Transformar em peça ou conteúdo.',
			texto: 'Nos assuntos em Preparar ou Agir, o BDS Jus prepara um modelo de peça no seu estilo, ou um texto informativo para o escritório. Sem dados de cliente e sem promessa de resultado.' },
		{ alvo: '#r-f-pergunta', chapeu: 'Pergunte ao radar', titulo: 'Qualquer assunto, a qualquer hora.',
			texto: 'Escreva aqui, por exemplo, "o que mudou em consignado este mês?".' },
		{ alvo: '#r-topo-acoes', chapeu: 'Sempre à mão', titulo: 'Atualizar, ajustar e rever este guia.',
			texto: '<b>Atualizar agora</b> busca as publicações do dia. <b>Ajustar meu radar</b> muda vara, áreas e temas. <b>Como funciona</b> mostra este guia de novo.' },
	], { aoFim: () => marcarTour('briefing') })
}

const UFS_RADAR = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ')
const normalizarRadar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function desenharAjustes() {
	const d = RAD.dados, cfg = d.config || {}
	const novo = !d.config
	const areasCfg = new Set(cfg.areas || [])
	const temasCfg = new Set(cfg.temas || d.catalogo.map((t) => t.id))
	const radio = (nome, valor, rot, marcado) => `<label><input type="radio" name="${nome}" value="${escapar(valor)}" ${marcado ? 'checked' : ''} required> ${escapar(rot)}</label>`
	radarEl.innerHTML = `
		<div class="r-topo"><div><h2>${novo ? 'Vamos montar o seu radar' : 'Ajustar meu radar'}</h2>
			<div class="r-sub">${novo ? 'Uma vez só. Depois o radar traz apenas o que você escolher aqui, e você muda quando quiser.' : escapar(d.regiao)}</div></div></div>
		<form class="r-config" id="r-f-config">
			<fieldset><legend>Cidade do escritório</legend>
				<p class="det">A cidade onde você atende. Se o fórum que atende a cidade fica em outra (a comarca), escreva o nome dela; se não, deixe em branco.</p>
				<div class="r-livre"><input name="cidade" required placeholder="ex.: Carmópolis de Minas" value="${novo ? '' : escapar(d.local.cidade)}">
					<select name="uf">${UFS_RADAR.map((u) => `<option ${u === (novo ? 'MG' : d.local.uf) ? 'selected' : ''}>${u}</option>`).join('')}</select>
					<input name="comarca" placeholder="comarca, se for outra cidade" value="${!novo && d.local.comarca !== d.local.cidade ? escapar(d.local.comarca) : ''}"></div></fieldset>
			<fieldset><legend>Vara federal da região</legend>
				<p class="det">A cidade da vara federal onde correm hoje os seus processos contra o INSS. É de lá que vêm os temas previdenciários.</p>
				<div class="r-livre"><input name="vara" required list="r-varas" placeholder="ex.: Divinópolis" value="${escapar(cfg.vara_federal || '')}">
					<datalist id="r-varas">${novo ? '' : d.federal.opcoes.map((v) => `<option value="${escapar(v)}">`).join('')}</datalist></div>
				${!novo && d.federal.opcoes.length ? `<p class="det">Perto de ${escapar(d.local.cidade)}: ${d.federal.opcoes.map(escapar).join(', ')}.</p>` : ''}</fieldset>
			<fieldset><legend>Áreas</legend>
				<div class="r-opcoes">${d.areas.map((a) => `<label><input type="checkbox" name="area" value="${escapar(a)}" ${novo || areasCfg.has(a) ? 'checked' : ''}> ${escapar(a)}</label>`).join('')}</div></fieldset>
			<fieldset><legend>Temas</legend>
				<p class="det">Os temas das áreas marcadas. Desmarque o que não interessa.</p>
				<div class="r-temas" id="r-temas">${d.catalogo.map((t) => `<label data-areas="${escapar(t.areas.join('|'))}"><input type="checkbox" name="tema" value="${t.id}" ${temasCfg.has(t.id) ? 'checked' : ''}> ${escapar(t.titulo)} <small>${escapar(t.areas.join(', '))}</small></label>`).join('')}
				${(cfg.temas_livres || []).map((t) => `<label><input type="checkbox" name="livre" value="${escapar(t.id)}" checked> ${escapar(t.titulo)} <small>tema seu · ${escapar(t.palavras.join(', '))}</small></label>`).join('')}</div></fieldset>
			<fieldset><legend>Acompanhar outro assunto</legend>
				<p class="det">Um assunto que não está na lista. Palavras que aparecem nas publicações sobre ele, separadas por vírgula.</p>
				<div class="r-livre"><input name="livreTitulo" placeholder="ex.: Golpe do Pix"><input name="livrePalavras" placeholder="ex.: pix, golpe, fraude bancária"></div></fieldset>
			<fieldset><legend>O que mostrar</legend>
				<div class="r-opcoes">${radio('mostrar', 'todos', 'Tudo, inclusive o que ainda é possibilidade', (cfg.mostrar || 'todos') === 'todos')}${radio('mostrar', 'preparar-agir', 'Só o que pede preparo ou ação', cfg.mostrar === 'preparar-agir')}</div></fieldset>
			<fieldset><legend>Briefing</legend>
				<p class="det">O radar se atualiza sozinho quando você abre esta tela.</p>
				<div class="r-opcoes">${radio('frequencia', 'segunda', 'Vejo toda segunda-feira', cfg.frequencia === 'segunda')}${radio('frequencia', 'quando-pedir', 'Só quando eu abrir', (cfg.frequencia || 'quando-pedir') === 'quando-pedir')}</div></fieldset>
			<div class="r-acoes"><button class="opcao">${novo ? 'Montar meu radar' : 'Salvar'}</button>${novo ? '' : '<button type="button" class="opcao discreta" id="r-cancelar">Cancelar</button>'}</div>
		</form>`
	const f = $('#r-f-config')
	// Marcar ou desmarcar uma área marca ou desmarca os temas dela.
	f.querySelectorAll('[name=area]').forEach((a) => (a.onchange = () => {
		f.querySelectorAll('#r-temas label[data-areas]').forEach((l) => {
			if (l.dataset.areas.split('|').includes(a.value)) {
				const outras = l.dataset.areas.split('|').some((x) => x !== a.value && f.querySelector(`[name=area][value="${CSS.escape(x)}"]`)?.checked)
				l.querySelector('input').checked = a.checked || outras
			}
		})
	}))
	if (!novo) $('#r-cancelar').onclick = () => { RAD.ajustando = false; desenharRadar() }
	// Confere de novo na hora: se ela saiu do radar nesse intervalo, o tour fica para a próxima vez.
	if (novo && !tourVisto('config') && !tourAtivo()) setTimeout(() => { if (RAD.aberto && !radarEl.hidden && !tourAtivo()) tourConfig() }, 300)
	f.onsubmit = async (ev) => {
		ev.preventDefault()
		const marcados = (n) => [...f.querySelectorAll(`[name=${n}]:checked`)].map((x) => x.value)
		const livresTirar = [...f.querySelectorAll('[name=livre]:not(:checked)')].map((x) => x.value)
		const local = { cidade: f.cidade.value.trim(), uf: f.uf.value, comarca: f.comarca.value.trim() }
		const mudouCidade = novo || normalizarRadar(local.cidade) !== normalizarRadar(d.local.cidade) || local.uf !== d.local.uf
			|| normalizarRadar(local.comarca || local.cidade) !== normalizarRadar(d.local.comarca)
		const dados = { local: mudouCidade ? local : null, varaFederal: f.vara.value.trim(), areas: marcados('area'), temas: marcados('tema'), mostrar: f.mostrar.value, frequencia: f.frequencia.value, livresTirar }
		if (f.livreTitulo.value.trim() && f.livrePalavras.value.trim()) dados.livre = { titulo: f.livreTitulo.value.trim(), palavras: f.livrePalavras.value.trim() }
		if (!dados.temas.length && !dados.livre && !(cfg.temas_livres || []).length) return aviso('Escolha pelo menos um tema.')
		f.querySelector('button').disabled = true
		try {
			RAD.dados = await api('radar/config', dados)
			RAD.ajustando = false
			aviso('Radar ajustado.')
			atualizarRadar(true)
		} catch (e) { aviso(e.message); f.querySelector('button').disabled = false }
	}
}

$('#abrir-radar').onclick = mostrarRadar
