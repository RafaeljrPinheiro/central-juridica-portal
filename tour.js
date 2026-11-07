// Tour guiado: o alvo brilha, o resto da tela escurece e um balão explica o que é e o que fazer.
// Passo: { alvo: 'seletor' (sem alvo = balão no centro), titulo, texto, clicar: 'click'|'change' (avança quando a
// advogada usa o alvo; sem isso, botão Próximo) }. Reutilizável em qualquer tela. Depende de app.js: $, escapar.

const TOUR = { passos: null, i: 0, aoFim: null, partes: [], ouvinte: null }

const tourEstilo = document.createElement('style')
tourEstilo.textContent = `
.tour-veu { position: fixed; background: rgba(11,19,34,.55); z-index: 900; }
.tour-brilho { position: fixed; z-index: 901; pointer-events: none; border-radius: 10px; border: 2px solid var(--latao);
	animation: tour-pulsa 1.6s ease-in-out infinite; }
@keyframes tour-pulsa { 0%, 100% { box-shadow: 0 0 0 0 rgba(176,141,87,.75); } 50% { box-shadow: 0 0 0 10px rgba(176,141,87,0); } }
.tour-balao { position: fixed; z-index: 902; width: min(360px, calc(100vw - 32px)); background: var(--superficie); color: var(--tinta);
	border: 1px solid var(--latao); border-radius: 12px; padding: 16px 18px 14px; box-shadow: 0 12px 32px rgba(11,19,34,.35); display: grid; gap: 8px; }
.tour-balao.centro { width: min(520px, calc(100vw - 32px)); }
.tour-balao::before { content: ""; position: absolute; width: 12px; height: 12px; background: var(--superficie); border: 1px solid var(--latao);
	transform: rotate(45deg); left: var(--seta, 50%); margin-left: -6px; }
.tour-balao.embaixo::before { top: -7px; border-right: 0; border-bottom: 0; }
.tour-balao.emcima::before { bottom: -7px; border-left: 0; border-top: 0; }
.tour-balao.centro::before { display: none; }
.tour-balao .tour-chapeu { color: var(--latao); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.tour-balao strong { font-size: 16px; }
.tour-balao p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--tinta-suave); }
.tour-balao .tour-dica { color: var(--latao); font-size: 13px; font-weight: 600; }
.tour-balao .tour-pe { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.tour-balao .tour-pe small { color: var(--tinta-suave); margin-right: auto; }
`
document.head.append(tourEstilo)

function tourAtivo() { return !!TOUR.passos }

function tourGuiado(passos, { aoFim } = {}) {
	fecharTour(false)
	TOUR.passos = passos; TOUR.i = 0; TOUR.aoFim = aoFim
	// Véu com o essencial no próprio elemento: escurece e bloqueia mesmo que a folha de estilo demore a valer.
	TOUR.partes = ['cima', 'baixo', 'esq', 'dir'].map(() => {
		const v = Object.assign(document.createElement('div'), { className: 'tour-veu' })
		Object.assign(v.style, { position: 'fixed', background: 'rgba(11,19,34,.55)', zIndex: '900' })
		return document.body.appendChild(v)
	})
	TOUR.brilho = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tour-brilho' }))
	TOUR.balao = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tour-balao', role: 'dialog' }))
	addEventListener('resize', posicionarTour)
	addEventListener('scroll', posicionarTour, true)
	addEventListener('keydown', teclaTour)
	mostrarPassoTour()
}

function fecharTour(concluido = true) {
	if (!TOUR.passos) return
	const aoFim = TOUR.aoFim
	soltarAlvoTour()
	for (const el of [...TOUR.partes, TOUR.brilho, TOUR.balao]) el?.remove()
	removeEventListener('resize', posicionarTour)
	removeEventListener('scroll', posicionarTour, true)
	removeEventListener('keydown', teclaTour)
	Object.assign(TOUR, { passos: null, partes: [], brilho: null, balao: null, aoFim: null })
	if (concluido) aoFim?.()
}

function teclaTour(e) { if (e.key === 'Escape') fecharTour() }

const alvoTour = () => { const p = TOUR.passos?.[TOUR.i]; return p?.alvo ? document.querySelector(p.alvo) : null }

function soltarAlvoTour() {
	if (TOUR.ouvinte) { TOUR.ouvinte.el.removeEventListener(TOUR.ouvinte.tipo, TOUR.ouvinte.fn, true); TOUR.ouvinte = null }
}

function irPassoTour(i) {
	if (i >= TOUR.passos.length) return fecharTour()
	TOUR.i = Math.max(0, i)
	mostrarPassoTour()
}

function mostrarPassoTour() {
	soltarAlvoTour()
	const p = TOUR.passos[TOUR.i], n = TOUR.passos.length, ultimo = TOUR.i === n - 1
	const alvo = alvoTour()
	// Alvo numa tela escondida: não há o que brilhar; fecha sem marcar como visto, volta na próxima vez.
	if (alvo?.closest('[hidden]')) return fecharTour(false)
	TOUR.balao.innerHTML = `${p.chapeu ? `<span class="tour-chapeu">${escapar(p.chapeu)}</span>` : ''}<strong>${escapar(p.titulo)}</strong><p>${p.texto}</p>
		${p.clicar && alvo ? `<span class="tour-dica">${escapar(p.dica || 'Clique no que está brilhando.')}</span>` : ''}
		<div class="tour-pe"><small>${TOUR.i + 1} de ${n}</small>
			<button class="opcao discreta" data-tour="pular">${ultimo ? 'Fechar' : 'Pular'}</button>
			${TOUR.i ? '<button class="opcao discreta" data-tour="voltar">Voltar</button>' : ''}
			${p.clicar && alvo ? '' : `<button class="opcao" data-tour="proximo">${p.botao || (ultimo ? 'Entendi' : 'Próximo')}</button>`}</div>`
	TOUR.balao.querySelector('[data-tour="pular"]').onclick = () => fecharTour()
	TOUR.balao.querySelector('[data-tour="voltar"]')?.addEventListener('click', () => irPassoTour(TOUR.i - 1))
	TOUR.balao.querySelector('[data-tour="proximo"]')?.addEventListener('click', () => irPassoTour(TOUR.i + 1))
	if (alvo) {
		alvo.scrollIntoView({ block: 'center', behavior: 'smooth' })
		if (p.clicar) {
			// Ouve na página e confere o alvo do momento: se a tela se redesenhar, o elemento novo continua valendo.
			const fn = (e) => {
				if (!alvoTour()?.contains(e.target)) return
				setTimeout(() => { if (TOUR.passos && TOUR.passos[TOUR.i] === p) irPassoTour(TOUR.i + 1) }, 0)
			}
			document.addEventListener(p.clicar, fn, true)
			TOUR.ouvinte = { el: document, tipo: p.clicar, fn }
		}
	}
	posicionarTour()
	setTimeout(posicionarTour, 350) // depois da rolagem suave
	TOUR.balao.querySelector('[data-tour="proximo"]')?.focus({ preventScroll: true })
}

// Véu em 4 partes em volta do alvo: o alvo continua clicável; o resto da tela fica escuro e não recebe clique.
function posicionarTour() {
	if (!TOUR.passos) return
	const alvo = alvoTour(), W = innerWidth, H = innerHeight, b = TOUR.balao
	if (alvo?.closest('[hidden]')) return fecharTour(false) // ela saiu da tela do tour (ex.: rolagem depois de trocar)
	const [cima, baixo, esq, dir] = TOUR.partes
	const pos = (el, x, y, w, h) => Object.assign(el.style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' })
	if (!alvo) {
		pos(cima, 0, 0, W, H); for (const el of [baixo, esq, dir]) pos(el, 0, 0, 0, 0)
		TOUR.brilho.style.display = 'none'
		b.className = 'tour-balao centro'
		Object.assign(b.style, { left: (W - b.offsetWidth) / 2 + 'px', top: Math.max(16, (H - b.offsetHeight) / 2) + 'px' })
		return
	}
	const r = alvo.getBoundingClientRect(), m = 6
	const x = r.left - m, y = r.top - m, w = r.width + 2 * m, h = r.height + 2 * m
	pos(cima, 0, 0, W, y); pos(baixo, 0, y + h, W, H - y - h); pos(esq, 0, y, x, h); pos(dir, x + w, y, W - x - w, h)
	TOUR.brilho.style.display = 'block'
	pos(TOUR.brilho, x, y, w, h)
	const bw = b.offsetWidth, bh = b.offsetHeight
	const embaixo = y + h + 14 + bh <= H || y < bh + 14
	const left = Math.min(Math.max(16, r.left + r.width / 2 - bw / 2), W - bw - 16)
	b.className = 'tour-balao ' + (embaixo ? 'embaixo' : 'emcima')
	b.style.left = left + 'px'
	b.style.top = (embaixo ? Math.min(y + h + 14, H - bh - 8) : y - bh - 14) + 'px'
	b.style.setProperty('--seta', Math.min(Math.max(18, r.left + r.width / 2 - left), bw - 18) + 'px')
}
