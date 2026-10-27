// Primeiros passos: o que falta para a Central ficar pronta (conta, login, senha do escritório, backup, celular),
// cada etapa marcada pelo estado real do computador. Aparece como cartão na conversa nova enquanto faltar algo,
// e sempre nos Ajustes. Depende de app.js e escritorio.js.
async function lerPassos() {
	const [e, esc, bkp, rem] = await Promise.all([
		api('estado').catch(() => ({})),
		api('escritorio/estado').catch(() => ({})),
		api('escritorio/backup/estado', {}).catch(() => ({})),
		api('remoto').catch(() => ({})),
	])
	const nuvem = esc.nuvem
	const naNuvem = /onedrive|google ?drive|meu drive|my drive|dropbox|icloud/i.test(bkp.pasta || '')
	const passos = [
		{ feito: !!e.logado, titulo: 'Conta do Claude conectada', texto: e.logado ? e.email || '' : 'É o motor que escreve as peças. Sem ela a Central não responde.', acao: 'conta' },
		...(nuvem ? [{ feito: !!nuvem.conectado, titulo: 'Login do escritório', texto: nuvem.conectado ? nuvem.email || '' : 'Seu e-mail e a sua senha de acesso. Esqueceu? Há o botão "Esqueci minha senha".', acao: 'escritorio' }] : []),
		{ feito: !!(esc.configurado && esc.desbloqueado), titulo: 'Senha do escritório', texto: 'Tranca casos, agenda e cofre. Anote num lugar seguro: ninguém recupera, nem o suporte.', acao: 'escritorio' },
		{ feito: naNuvem, titulo: 'Backup fora do computador', texto: naNuvem ? 'Cópia diária numa pasta que sobe para a nuvem.' : 'Escolha uma pasta do OneDrive ou do Google Drive para a cópia diária sair do computador.', acao: 'ajustes' },
		...(rem.disponivel ? [{ feito: !!rem.sempreLigada, titulo: 'Central no celular', texto: rem.sempreLigada ? rem.link : 'Ligue "Manter a Central ligada" e abra o link no celular. Entre com o login e depois a senha do escritório.', acao: 'ajustes' }] : []),
	]
	return { passos, feitos: passos.filter((p) => p.feito).length }
}

function irPara(acao) {
	$('#d-passos')?.close()
	if (acao === 'escritorio') return mostrarEscritorio()
	$('#abrir-ajustes').click()
	setTimeout(() => $(acao === 'conta' ? '#ajustes-conta' : '#ajustes-backup')?.scrollIntoView({ block: 'start' }), 200)
}

async function mostrarPassos() {
	const { passos, feitos } = await lerPassos()
	let d = $('#d-passos')
	if (!d) { d = document.createElement('dialog'); d.id = 'd-passos'; document.body.append(d) }
	d.innerHTML = `<div class="janela"><h2>Primeiros passos</h2>
		<p class="det">${feitos === passos.length ? 'Tudo pronto. Sua Central está completa.' : `${feitos} de ${passos.length} prontos. Cada etapa se marca sozinha quando estiver feita.`}</p>
		<ol class="pp-lista">${passos.map((p, i) => `<li class="${p.feito ? 'feito' : ''}"><span class="num">${p.feito ? '✓' : i + 1}</span>
			<div><strong>${escapar(p.titulo)}</strong><small>${escapar(p.texto)}</small></div>
			${p.feito ? '' : `<button class="opcao" data-ir="${p.acao}">Fazer agora</button>`}</li>`).join('')}</ol>
		<div class="fim"><button class="opcao discreta" data-fechar>Fechar</button></div></div>`
	d.querySelectorAll('[data-ir]').forEach((b) => (b.onclick = () => irPara(b.dataset.ir)))
	d.showModal()
}

// Na conversa nova: um cartão curto enquanto faltar algo (no link do celular, não).
async function cartaoPassos(el) {
	if (document.body.classList.contains('portal')) return
	const { passos, feitos } = await lerPassos()
	if (feitos === passos.length || !el.isConnected) return
	const falta = passos.find((p) => !p.feito)
	const c = document.createElement('button')
	c.className = 'cartao-passos'
	c.innerHTML = `<span class="anel-passos" style="--p:${feitos / passos.length}"><b>${feitos}/${passos.length}</b></span>
		<span><strong>Primeiros passos</strong><small>Próximo: ${escapar(falta.titulo)}</small></span><span class="seta">›</span>`
	c.onclick = mostrarPassos
	el.prepend(c)
}
