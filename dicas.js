// Dicas de uso: o app percebe, sem gastar o limite da conta, quando há um jeito mais rápido de fazer algo na Central.
// Tom de colega, no máximo uma por conversa, nunca no meio de uma resposta; dica recusada não volta; dá para desligar todas.
// A contagem de dicas mostradas/aceitas/recusadas fica só neste computador (base para o registro de uso, P7).
const DICAS = {
	whatsapp: { texto: 'Parece uma conversa do WhatsApp colada à mão. O botão WhatsApp, ao lado do campo, traz a conversa direto, com os áudios já transcritos.', acao: 'Mostrar', fazer: () => $('#whats').click() },
	intimacao: { texto: 'Esta intimação já chegou nos Avisos do dia. Lá, "Criar prazo" e "Perguntar sobre isso" fazem isso com um clique.', acao: 'Abrir os avisos', fazer: () => mostrarQuadro() },
	caso: { texto: 'Esse processo já tem caso no Escritório. "Conversar sobre o caso", na ficha dele, traz o contexto sem precisar digitar.', acao: 'Abrir o caso', fazer: (ctx) => abrirCasoDoAviso({ processo: ctx.processo }) },
	escritorio: { texto: 'O Escritório organiza prazos, tarefas e casos de vocês três num lugar só, a partir das intimações.', acao: 'Conhecer', fazer: () => mostrarEscritorio() },
}
const PROC = /\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}\b/
const contar = (k) => { try { const c = JSON.parse(localStorage.getItem('dicasContagem') || '{}'); c[k] = (c[k] || 0) + 1; localStorage.setItem('dicasContagem', JSON.stringify(c)) } catch {} }
const recusadas = () => { try { return JSON.parse(localStorage.getItem('dicasRecusadas') || '[]') } catch { return [] } }

// Chamado depois de cada envio: decide se vale uma dica para esta mensagem.
async function avaliarDica(t, msg) {
	if (lerPref('dicasDesligadas') || t.dicaMostrada) return
	const fora = recusadas()
	const pode = (k) => !fora.includes(k)
	let escolhida = null, ctx = {}
	if (pode('whatsapp') && (msg.match(/^\[?\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}\]? ?[-–]? ?[^:\n]{2,40}:/gm) || []).length >= 2) escolhida = 'whatsapp'
	else if (pode('intimacao') && /PODER JUDICI[ÁA]RIO|Fica[m]? .{0,20}intimad/i.test(msg) && PROC.test(msg) && (typeof quadroItens !== 'undefined') && quadroItens.some((i) => i.tipo === 'intimacao' && String(i.processo).replace(/\D/g, '') === msg.match(PROC)[0].replace(/\D/g, ''))) escolhida = 'intimacao'
	else if (pode('caso') && PROC.test(msg) && !/^Caso do escritório:/.test(msg)) {
		try {
			const e = await api('escritorio/estado')
			if (e.desbloqueado) {
				const num = msg.match(PROC)[0].replace(/\D/g, '')
				const { itens } = await api('escritorio/listar', { colecao: 'casos' })
				if (itens.some((c) => c.processos.some((p) => p.numero.replace(/\D/g, '') === num))) { escolhida = 'caso'; ctx.processo = num }
			}
		} catch {}
	} else if (pode('escritorio') && !lerPref('escritorioVisto')) {
		try { const n = Number(localStorage.getItem('mensagensSemEscritorio') || 0) + 1; localStorage.setItem('mensagensSemEscritorio', n); if (n >= 15) escolhida = 'escritorio' } catch {}
	}
	if (escolhida) mostrarDica(t, escolhida, ctx)
}

function mostrarDica(t, k, ctx) {
	const dica = DICAS[k]
	t.dicaMostrada = true
	contar('mostrada:' + k)
	const d = document.createElement('div')
	d.className = 'dica-uso'
	d.innerHTML = `<span>💡 ${escapar(dica.texto)}</span><span class="dica-acoes"><button class="opcao">${escapar(dica.acao)}</button><button class="opcao discreta" data-nao>Não mostrar esta dica</button><button class="opcao discreta" data-desligar>Desligar dicas</button></span>`
	d.querySelector('.opcao').onclick = () => { contar('aceita:' + k); d.remove(); dica.fazer(ctx) }
	d.querySelector('[data-nao]').onclick = () => { contar('recusada:' + k); try { localStorage.setItem('dicasRecusadas', JSON.stringify([...recusadas(), k])) } catch {} d.remove() }
	d.querySelector('[data-desligar]').onclick = () => { gravarPref('dicasDesligadas', '1'); d.remove(); aviso('Dicas desligadas. Dá para religar nos Ajustes.') }
	// Aparece no fim da conversa, depois da resposta (não interrompe o trabalho).
	t.dicaPendente = d
}
// A dica entra quando a resposta termina.
function soltarDica(t) { if (t.dicaPendente) { t.el.append(t.dicaPendente); t.dicaPendente = null; rolar(t) } }

$('#abrir-escritorio').addEventListener('click', () => gravarPref('escritorioVisto', '1'))
