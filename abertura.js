// Mensagem de abertura: uma vez por dia, na primeira vez que a Central abre.
// Lê o dia no Escritório (sem gastar o limite da conta) e escolhe o tom: dia difícil ontem, dia cheio, dia leve ou normal.
// Frases só de fonte conferida (elas postam a tela; nunca inventar nem citar de memória):
// - Rui Barbosa, "Oração aos Moços" (1921), conferido no texto da obra (20/10/2026);
// - Eduardo J. Couture, "Los mandamientos del abogado", original em espanhol conferido em 29/10/2026 (casi.com.ar),
//   tradução livre (indicada na tela);
// - Constituição e Lei 8.906/1994: texto atualizado da Câmara dos Deputados (legin), conferido em 29/10/2026;
// - Código de Ética e Disciplina da OAB: PDF oficial da Resolução 02/2015 (oab.org.br), conferido em 29/10/2026;
// - Declaração Universal dos Direitos Humanos: texto em português publicado pelo UNICEF Brasil, conferido em 29/10/2026.
// Nas leis, só a primeira letra vira maiúscula e o fim ganha ponto; as palavras são as do texto oficial.
// À esquerda, a logo da BDS Jus (braço jurídico da BDS Flow) nas cores da Central: latão e marinho, sobre medalha branca.
const LOGO_BDS_JUS = `<svg viewBox="0 0 512 512" role="img" aria-label="BDS Jus">
	<defs>
		<mask id="ab-m1"><rect width="512" height="512" fill="#fff"/><circle cx="280" cy="246" r="222" fill="#000"/></mask>
		<mask id="ab-m2"><rect width="512" height="512" fill="#fff"/><circle cx="242" cy="262" r="222" fill="#000"/></mask>
	</defs>
	<circle cx="256" cy="256" r="250" fill="#fff"/>
	<circle cx="256" cy="256" r="244" fill="#B08D57" mask="url(#ab-m1)"/>
	<circle cx="258" cy="258" r="236" fill="#16233F" mask="url(#ab-m2)"/>
	<circle cx="256" cy="258" r="200" fill="none" stroke="#16233F" stroke-width="10"/>
	<text x="262" y="300" text-anchor="middle" font-family="'Source Serif 4', Georgia, serif" font-weight="600" font-size="150" letter-spacing="-6" fill="#16233F">BDS</text>
	<text x="352" y="350" text-anchor="middle" font-family="'Atkinson Hyperlegible', sans-serif" font-weight="700" font-size="40" letter-spacing="2" fill="#B08D57">JUS</text>
</svg>`
const RUI = 'Rui Barbosa, Oração aos Moços (1921)'
const COUTURE = 'Eduardo J. Couture, Os mandamentos do advogado (tradução livre)'
const CF = (art) => `Constituição Federal, ${art}`
const ESTATUTO = (art) => `Estatuto da Advocacia (Lei 8.906/1994), ${art}`
const CED = (art) => `Código de Ética e Disciplina da OAB, ${art}`
const DUDH = (art) => `Declaração Universal dos Direitos Humanos, ${art}`
const FRASES = {
	dificil: [
		['Mais pode que os seus azares a constância, a coragem e a virtude.', RUI],
		['Terminado o combate, esquece tão depressa a tua vitória quanto a tua derrota.', COUTURE],
		['O tempo se vinga das coisas que se fazem sem a sua colaboração.', COUTURE],
		['Nenhum receio de desagradar a magistrado ou a qualquer autoridade, nem de incorrer em impopularidade, deve deter o advogado no exercício da profissão.', ESTATUTO('art. 31, § 2º')],
		['Tem fé na liberdade, sem a qual não há direito, nem justiça, nem paz.', COUTURE],
		['Leal para com o adversário, ainda quando ele seja desleal contigo.', COUTURE],
		['O advogado, no exercício da profissão, deve manter independência em qualquer circunstância.', ESTATUTO('art. 31, § 1º')],
	],
	cheio: [
		['A advocacia é uma árdua fadiga posta a serviço da justiça.', COUTURE],
		['Mas justiça atrasada não é justiça, senão injustiça qualificada e manifesta.', RUI],
		['Com o advogado, justiça militante.', RUI],
		['A lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito.', CF('art. 5º, XXXV')],
		['No seu ministério privado, o advogado presta serviço público e exerce função social.', ESTATUTO('art. 2º, § 1º')],
		['Atuar com destemor, independência, honestidade, decoro, veracidade, lealdade, dignidade e boa-fé.', CED('art. 2º, parágrafo único, II')],
	],
	leve: [
		['Tomai exemplo, estudantes e doutores, tomai exemplo das estrelas da manhã.', RUI],
		['O direito se transforma constantemente. Se não segues seus passos, serás a cada dia um pouco menos advogado.', COUTURE],
		['O direito se aprende estudando, mas se exerce pensando.', COUTURE],
		['Empenhar-se, permanentemente, no aperfeiçoamento pessoal e profissional.', CED('art. 2º, parágrafo único, IV')],
		['Ama a tua profissão.', COUTURE],
		['Tolera a verdade alheia na mesma medida em que queres que seja tolerada a tua.', COUTURE],
	],
	normal: [
		['Legalidade e liberdade são as tábuas da vocação do advogado.', RUI],
		['O direito se aprende estudando, mas se exerce pensando.', COUTURE],
		['A regra da igualdade não consiste senão em quinhoar desigualmente aos desiguais, na medida em que se desigualam.', RUI],
		['Não desertar a justiça, nem cortejá-la.', RUI],
		['Tomai exemplo, estudantes e doutores, tomai exemplo das estrelas da manhã.', RUI],
		['O advogado é indispensável à administração da justiça, sendo inviolável por seus atos e manifestações no exercício da profissão, nos limites da lei.', CF('art. 133')],
		['Teu dever é lutar pelo direito; mas no dia em que encontrares o direito em conflito com a justiça, luta pela justiça.', COUTURE],
		['Todos os seres humanos nascem livres e iguais em dignidade e direitos.', DUDH('art. 1º')],
		['Construir uma sociedade livre, justa e solidária.', CF('art. 3º, I')],
		['Ninguém será privado da liberdade ou de seus bens sem o devido processo legal.', CF('art. 5º, LIV')],
		['Aos litigantes, em processo judicial ou administrativo, e aos acusados em geral são assegurados o contraditório e a ampla defesa, com os meios e recursos a ela inerentes.', CF('art. 5º, LV')],
		['O advogado deve proceder de forma que o torne merecedor de respeito e que contribua para o prestígio da classe e da advocacia.', ESTATUTO('art. 31')],
		['O Estado prestará assistência jurídica integral e gratuita aos que comprovarem insuficiência de recursos.', CF('art. 5º, LXXIV')],
	],
}
// Uma linha sobre o dia, escrita para a Central (sem autor famoso).
const LINHA_DO_DIA = {
	dificil: 'Ontem foi puxado. O que ficou pendente já está no quadro, em ordem de vencimento.',
	cheio: 'Dia cheio. Um de cada vez, começando pelo que vence primeiro.',
	leve: 'Agenda mais leve hoje: bom dia para adiantar o que costuma ficar para depois.',
	normal: 'Tudo pronto para começar.',
}
// Tratamento (Dr. ou Dra.): a advocacia gosta de ser chamada assim. Nunca deduzido do nome:
// vem do nome cadastrado (se já começa com Dr./Dra.) ou da escolha feita na própria abertura ou nos Ajustes.
const TRATAMENTO = /^(dra?)\.?\s+/i
const lerPref = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const gravarPref = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch {} }

async function lerDia() {
	const d = { tom: 'normal', nome: '', escritorio: false, vencidos: 0, prazosHoje: 0, agendaHoje: [], cobrarHoje: 0, tarefasHoje: 0, prazosSemana: 0, agendaSemana: 0 }
	try {
		const e = await api('escritorio/estado')
		const cheio = (e.eu || '').trim(), t = cheio.match(TRATAMENTO)
		d.tratamento = t ? (t[1].toLowerCase() === 'dra' ? 'Dra.' : 'Dr.') : ''
		d.nome = cheio.replace(TRATAMENTO, '').split(/\s+/)[0]
		if (!e.desbloqueado) return d
		const { itens } = await api('escritorio/listar', { colecao: 'itens' })
		const h = hojeISO(), ontem = somaDias(h, -1)
		const inicioOntem = new Date(ontem + 'T00:00:00').getTime(), inicioHoje = new Date(h + 'T00:00:00').getTime()
		const abertos = itens.filter((i) => i.coluna !== 'feito')
		d.vencidos = abertos.filter((i) => i.data && i.data < h).length
		d.prazosHoje = abertos.filter((i) => i.data === h && i.tipo === 'prazo').length
		d.tarefasHoje = abertos.filter((i) => i.data === h).length
		d.agendaHoje = abertos.filter((i) => i.data === h && ['audiencia', 'pericia'].includes(i.tipo)).map((i) => `${NOMES.tipo[i.tipo]}${i.hora ? ' às ' + i.hora : ''}`)
		d.cobrarHoje = abertos.filter((i) => i.coluna === 'aguardando' && i.proximaCobranca && i.proximaCobranca <= h).length
		// A semana (hoje + 7 dias), só em números: a tela é para ser printada sem nome de cliente.
		const sete = somaDias(h, 7), naSemana = (i) => i.data && i.data >= h && i.data <= sete
		d.prazosSemana = abertos.filter((i) => naSemana(i) && i.tipo === 'prazo').length
		d.agendaSemana = abertos.filter((i) => naSemana(i) && ['audiencia', 'pericia'].includes(i.tipo)).length
		d.escritorio = true
		const feitosOntem = itens.filter((i) => i.coluna === 'feito' && i._versao >= inicioOntem && i._versao < inicioHoje).length
		d.tom = feitosOntem >= 6 || d.vencidos >= 2 ? 'dificil' : d.tarefasHoje + d.vencidos >= 5 ? 'cheio' : d.tarefasHoje <= 1 ? 'leve' : 'normal'
	} catch {}
	return d
}

async function mostrarAbertura(forcar = false) {
	const hoje = new Date().toISOString().slice(0, 10)
	if (!forcar && (lerPref('aberturaDesligada') || lerPref('aberturaDia') === hoje)) return false
	const dia = await lerDia()
	const lista = FRASES[dia.tom]
	const [frase, fonte] = lista[Math.floor(Date.now() / 864e5) % lista.length]
	const hora = new Date().getHours()
	const tratamento = lerPref('tratamento') || dia.tratamento
	const saudar = (t) => `${hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'}${dia.nome ? ', ' + (t ? t + ' ' : '') + dia.nome : ''}.`
	const saudacao = saudar(tratamento)
	const chips = [
		!dia.escritorio && dia.vencidos ? `<span class="ab-chip critico">⚠ ${dia.vencidos} vencido${dia.vencidos > 1 ? 's' : ''}</span>` : '',
		dia.prazosHoje ? `<span class="ab-chip">${dia.prazosHoje} prazo${dia.prazosHoje > 1 ? 's' : ''} hoje</span>` : '',
		...dia.agendaHoje.map((a) => `<span class="ab-chip">${escapar(a)}</span>`),
		dia.cobrarHoje ? `<span class="ab-chip">${dia.cobrarHoje} para cobrar</span>` : '',
	].join('')
	let d = $('#d-abertura')
	if (!d) { d = document.createElement('dialog'); d.id = 'd-abertura'; document.body.append(d) }
	const numero = (n, um, varios, alvo, critico) => `<button class="ab-num${critico && n ? ' critico' : ''}" data-alvo="${alvo}"><b>${n}</b><span>${n === 1 ? um : varios}</span></button>`
	d.innerHTML = `<div class="ab">
		<div class="ab-logo">${LOGO_BDS_JUS}<div class="ab-nome"><strong>BDS Jus</strong><span>uma marca BDS Flow</span></div></div>
		<div class="ab-texto">
			<p class="ab-saudacao">${escapar(saudacao)}</p>
			${dia.nome && !tratamento ? `<div class="ab-tratamento">Como o BDS Jus deve te chamar?
				<button class="opcao discreta" data-trat="Dra.">Dra. ${escapar(dia.nome)}</button>
				<button class="opcao discreta" data-trat="Dr.">Dr. ${escapar(dia.nome)}</button></div>` : ''}
			<blockquote class="ab-frase">“${escapar(frase)}”<cite>${escapar(fonte)}</cite></blockquote>
			${dia.escritorio ? `<div class="ab-semana"><p>Sua semana</p><div class="ab-nums">
				${numero(dia.prazosSemana, 'prazo', 'prazos', 'prazos')}
				${numero(dia.agendaSemana, 'audiência ou perícia', 'audiências e perícias', 'agenda')}
				${numero(dia.vencidos, 'vencido', 'vencidos', 'vencidos', true)}
			</div></div>` : ''}
			<p class="ab-dia">${escapar(LINHA_DO_DIA[dia.tom])}</p>
			${chips ? `<div class="ab-chips">${chips}</div>` : ''}
			<div class="ab-acoes">
				${dia.escritorio ? '<button class="opcao" data-alvo="agenda">Ver agenda da semana</button><button class="opcao" data-alvo="prazos">Ver prazos</button>' : ''}
				<span style="flex:1"></span>
				<button class="opcao principal" id="ab-comecar" autofocus>Começar</button>
			</div>
			<label class="ab-nao"><input type="checkbox" id="ab-nao"> Não mostrar mais</label>
		</div>
	</div>`
	const fechar = (depois) => {
		gravarPref('aberturaDia', hoje)
		if ($('#ab-nao').checked) { gravarPref('aberturaDesligada', '1'); aviso('Mensagem de abertura desligada. Dá para religar nos Ajustes.') }
		d.close()
		depois?.()
		mostrarNovidades()
	}
	d.querySelectorAll('[data-trat]').forEach((b) => (b.onclick = () => {
		gravarPref('tratamento', b.dataset.trat)
		d.querySelector('.ab-saudacao').textContent = saudar(b.dataset.trat)
		d.querySelector('.ab-tratamento').remove()
	}))
	$('#ab-comecar').onclick = () => fechar()
	// Números e botões levam direto ao Escritório: agenda = Semana; prazos e vencidos = Tarefas filtradas.
	const destinos = {
		agenda: () => { ESC.vista = 'semana'; ESC.semana = 0 },
		prazos: () => { ESC.vista = 'kanban'; ESC.filtro = { ...ESC.filtro, tipo: 'prazo', rapido: '' } },
		vencidos: () => { ESC.vista = 'kanban'; ESC.filtro = { ...ESC.filtro, tipo: '', rapido: 'vencidos' } },
	}
	d.querySelectorAll('[data-alvo]').forEach((b) => (b.onclick = () => fechar(() => { destinos[b.dataset.alvo](); mostrarEscritorio() })))
	d.addEventListener('cancel', (e) => { e.preventDefault(); fechar() }, { once: true })
	d.showModal()
	return true
}

/* ---------- Ajustes: ligar e desligar a abertura e as dicas ---------- */
function prefsAjustes() {
	const caixa = $('#ajustes-prefs')
	if (!caixa) return
	const trat = lerPref('tratamento') || ''
	caixa.innerHTML = `<label>Tratamento na abertura <select id="pref-tratamento">
			<option value="" ${trat ? '' : 'selected'}>perguntar</option>
			<option ${trat === 'Dra.' ? 'selected' : ''}>Dra.</option>
			<option ${trat === 'Dr.' ? 'selected' : ''}>Dr.</option></select></label>
		<label><input type="checkbox" id="pref-abertura" ${lerPref('aberturaDesligada') ? '' : 'checked'}> Mensagem de abertura do dia</label>
		<label><input type="checkbox" id="pref-dicas" ${lerPref('dicasDesligadas') ? '' : 'checked'}> Dicas de uso</label>
		<button class="opcao discreta" id="pref-ver-abertura" type="button">Ver a mensagem de hoje</button>`
	$('#pref-tratamento').onchange = (e) => gravarPref('tratamento', e.target.value || null)
	$('#pref-abertura').onchange = (e) => gravarPref('aberturaDesligada', e.target.checked ? null : '1')
	$('#pref-dicas').onchange = (e) => { gravarPref('dicasDesligadas', e.target.checked ? null : '1'); if (e.target.checked) gravarPref('dicasRecusadas', null) }
	$('#pref-ver-abertura').onclick = () => { $('#d-ajustes').close(); mostrarAbertura(true) }
}
$('#abrir-ajustes').addEventListener('click', prefsAjustes)

// Na abertura do app: primeiro a mensagem do dia; as novidades vêm depois dela (ou direto, se não houver mensagem hoje).
setTimeout(async () => { if (!(await mostrarAbertura())) mostrarNovidades() }, 900)
