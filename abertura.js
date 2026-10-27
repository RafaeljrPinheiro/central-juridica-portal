// Mensagem de abertura: uma vez por dia, na primeira vez que a Central abre.
// Lê o dia no Escritório (sem gastar o limite da conta) e escolhe o tom: dia difícil ontem, dia cheio, dia leve ou normal.
// Frases famosas só de fonte conferida: Rui Barbosa, "Oração aos Moços" (1921), conferido no texto da obra;
// Eduardo J. Couture, "Los mandamientos del abogado", tradução livre do espanhol (indicada na tela).
// A imagem vem de um banco público de imagens de licença livre (Openverse), sempre com o crédito.
const RUI = 'Rui Barbosa, Oração aos Moços (1921)'
const COUTURE = 'Eduardo J. Couture, Os mandamentos do advogado (tradução livre)'
const FRASES = {
	dificil: [
		['Mais pode que os seus azares a constância, a coragem e a virtude.', RUI],
		['Terminado o combate, esquece tão depressa a tua vitória quanto a tua derrota.', COUTURE],
		['O tempo se vinga das coisas que se fazem sem a sua colaboração.', COUTURE],
	],
	cheio: [
		['A advocacia é uma árdua fadiga posta a serviço da justiça.', COUTURE],
		['Mas justiça atrasada não é justiça, senão injustiça qualificada e manifesta.', RUI],
		['Com o advogado, justiça militante.', RUI],
	],
	leve: [
		['Tomai exemplo, estudantes e doutores, tomai exemplo das estrelas da manhã.', RUI],
		['O direito se transforma constantemente. Se não segues seus passos, serás a cada dia um pouco menos advogado.', COUTURE],
		['O direito se aprende estudando, mas se exerce pensando.', COUTURE],
	],
	normal: [
		['Legalidade e liberdade são as tábuas da vocação do advogado.', RUI],
		['O direito se aprende estudando, mas se exerce pensando.', COUTURE],
		['A regra da igualdade não consiste senão em quinhoar desigualmente aos desiguais, na medida em que se desigualam.', RUI],
		['Não desertar a justiça, nem cortejá-la.', RUI],
		['Tomai exemplo, estudantes e doutores, tomai exemplo das estrelas da manhã.', RUI],
	],
}
// Uma linha sobre o dia, escrita para a Central (sem autor famoso).
const LINHA_DO_DIA = {
	dificil: 'Ontem foi puxado. O que ficou pendente já está no quadro, em ordem de vencimento.',
	cheio: 'Dia cheio. Um de cada vez, começando pelo que vence primeiro.',
	leve: 'Agenda mais leve hoje: bom dia para adiantar o que costuma ficar para depois.',
	normal: 'Tudo pronto para começar.',
}
const lerPref = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const gravarPref = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch {} }

async function lerDia() {
	const d = { tom: 'normal', nome: '', vencidos: 0, prazosHoje: 0, agendaHoje: [], cobrarHoje: 0, tarefasHoje: 0 }
	try {
		const e = await api('escritorio/estado')
		d.nome = (e.eu || '').split(/\s+/)[0]
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
	const saudacao = `${hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'}${dia.nome ? ', ' + dia.nome : ''}.`
	const chips = [
		dia.vencidos ? `<span class="ab-chip critico">⚠ ${dia.vencidos} vencido${dia.vencidos > 1 ? 's' : ''}</span>` : '',
		dia.prazosHoje ? `<span class="ab-chip">${dia.prazosHoje} prazo${dia.prazosHoje > 1 ? 's' : ''} hoje</span>` : '',
		...dia.agendaHoje.map((a) => `<span class="ab-chip">${escapar(a)}</span>`),
		dia.cobrarHoje ? `<span class="ab-chip">${dia.cobrarHoje} para cobrar</span>` : '',
	].join('')
	let d = $('#d-abertura')
	if (!d) { d = document.createElement('dialog'); d.id = 'd-abertura'; document.body.append(d) }
	d.innerHTML = `<div class="ab">
		<div class="ab-imagem"><div class="ab-credito"></div></div>
		<div class="ab-texto">
			<p class="ab-saudacao">${escapar(saudacao)}</p>
			<blockquote class="ab-frase">“${escapar(frase)}”<cite>${escapar(fonte)}</cite></blockquote>
			<p class="ab-dia">${escapar(LINHA_DO_DIA[dia.tom])}</p>
			${chips ? `<div class="ab-chips">${chips}</div>` : ''}
			<div class="ab-acoes">
				<label class="ab-nao"><input type="checkbox" id="ab-nao"> Não mostrar mais</label>
				<span style="flex:1"></span>
				${dia.tarefasHoje || dia.vencidos || dia.cobrarHoje ? '<button class="opcao" id="ab-dia">Ver meu dia</button>' : ''}
				<button class="opcao principal" id="ab-comecar">Começar</button>
			</div>
			<div class="ab-marca"><span>Oferecimento</span><img src="marca-bds.png" alt="BDS Flow"></div>
		</div>
	</div>`
	const fechar = (depois) => {
		gravarPref('aberturaDia', hoje)
		if ($('#ab-nao').checked) { gravarPref('aberturaDesligada', '1'); aviso('Mensagem de abertura desligada. Dá para religar nos Ajustes.') }
		d.close()
		depois?.()
		mostrarNovidades()
	}
	$('#ab-comecar').onclick = () => fechar()
	$('#ab-dia')?.addEventListener('click', () => fechar(() => { ESC.vista = 'painel'; mostrarEscritorio() }))
	d.addEventListener('cancel', (e) => { e.preventDefault(); fechar() }, { once: true })
	d.showModal()
	// A imagem chega depois, sem segurar a abertura; sem internet fica o fundo da Central.
	api('abertura-imagem?tom=' + dia.tom).then((img) => {
		if (!img || img.erro || !img.thumb) return
		const caixa = d.querySelector('.ab-imagem')
		caixa.style.backgroundImage = `url("${img.thumb}")`
		const cred = d.querySelector('.ab-credito')
		cred.textContent = `Foto: ${img.autor} · ${img.licenca}`
		cred.title = img.titulo
		cred.onclick = () => (typeof abrirLink === 'function' ? abrirLink(img.link) : null)
	}).catch(() => {})
	return true
}

/* ---------- Ajustes: ligar e desligar a abertura e as dicas ---------- */
function prefsAjustes() {
	const caixa = $('#ajustes-prefs')
	if (!caixa) return
	caixa.innerHTML = `<label><input type="checkbox" id="pref-abertura" ${lerPref('aberturaDesligada') ? '' : 'checked'}> Mensagem de abertura do dia</label>
		<label><input type="checkbox" id="pref-dicas" ${lerPref('dicasDesligadas') ? '' : 'checked'}> Dicas de uso</label>
		<button class="opcao discreta" id="pref-ver-abertura" type="button">Ver a mensagem de hoje</button>`
	$('#pref-abertura').onchange = (e) => gravarPref('aberturaDesligada', e.target.checked ? null : '1')
	$('#pref-dicas').onchange = (e) => { gravarPref('dicasDesligadas', e.target.checked ? null : '1'); if (e.target.checked) gravarPref('dicasRecusadas', null) }
	$('#pref-ver-abertura').onclick = () => { $('#d-ajustes').close(); mostrarAbertura(true) }
}
$('#abrir-ajustes').addEventListener('click', prefsAjustes)

// Na abertura do app: primeiro a mensagem do dia; as novidades vêm depois dela (ou direto, se não houver mensagem hoje).
setTimeout(async () => { if (!(await mostrarAbertura())) mostrarNovidades() }, 900)
