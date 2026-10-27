// Portal da advogada (BACKLOG I13): o lado do link. Funciona no navegador e no Node (testes).
// - Entra no Supabase com o e-mail dela (e o código do celular, se ela tiver ligado).
// - Abre o escritório com a senha do escritório (a chave nunca sai do aparelho; o banco só vê embaralhado).
// - Lê casos e agenda direto do banco (funciona com o computador desligado). O cofre de senhas NUNCA vem para o link.
// - Fala com a Central dela pelo "correio": pedido cifrado → a Central executa → resposta cifrada.
import { abrirEscritorio, decifrar, cifrar, cifrarBytes, decifrarBytes } from './escritorio-web.js'
import { normalizar } from './normalizar.js'
import { codificar } from './mulaw.js'

const COLECOES_LINK = ['casos', 'itens', 'equipe'] // sem 'cofre'

export function criarCliente({ url, chave: chaveApi, buscar = (...a) => fetch(...a) }) {
	let sessao = null // { token, refresh, expira, email, dono }
	let chave = null // CryptoKey do escritório (não exportável)

	async function pedir(caminho, { metodo = 'GET', corpo, prefer, semToken = false } = {}) {
		if (!semToken && sessao && sessao.expira < Date.now()) await renovar()
		const r = await buscar(url + caminho, {
			method: metodo,
			headers: { apikey: chaveApi, 'content-type': 'application/json', ...(!semToken && sessao ? { authorization: 'Bearer ' + sessao.token } : {}), ...(prefer ? { prefer } : {}) },
			body: corpo ? JSON.stringify(corpo) : undefined,
		})
		const t = await r.text()
		const j = t ? JSON.parse(t) : null
		if (!r.ok) {
			const m = j?.msg || j?.message || j?.error_description || `erro ${r.status}`
			throw new Error(/invalid login|credentials/i.test(m) ? 'E-mail ou senha incorretos.' : /totp|code/i.test(m) ? 'Código incorreto ou vencido.' : /limite de pedidos/i.test(m) ? 'Limite de pedidos do dia atingido.' : m)
		}
		return j
	}
	const guardar = (s) => { sessao = { token: s.access_token, refresh: s.refresh_token, expira: Date.now() + (s.expires_in - 60) * 1000, email: s.user?.email || sessao?.email, dono: s.user?.id || sessao?.dono } }
	async function renovar() { const r = sessao.refresh; sessao = null; guardar(await pedir('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', corpo: { refresh_token: r }, semToken: true })) }
	const rest = (c, op) => pedir('/rest/v1/' + c, op)
	const novoId = () => globalThis.crypto.randomUUID()

	const api = {
		get email() { return sessao?.email },
		get entrou() { return !!sessao },
		get aberto() { return !!chave },
		// Para "lembrar neste aparelho": guarda a chave (objeto não exportável) e a renovação do login.
		lembrar: () => (sessao && chave ? { refresh: sessao.refresh, email: sessao.email, dono: sessao.dono, chave } : null),
		async retomar({ refresh, email, dono, chave: k }) { sessao = { refresh, expira: 0, email, dono }; await renovar(); chave = k },
		async entrar(email, senha) {
			guardar(await pedir('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email: String(email).trim().toLowerCase(), password: senha }, semToken: true }))
			const u = await pedir('/auth/v1/user')
			const fator = (u.factors || []).find((f) => f.factor_type === 'totp' && f.status === 'verified')
			return { precisaCodigo: !!fator, fator: fator?.id }
		},
		async confirmarCodigo(fator, codigo) {
			const d = await pedir(`/auth/v1/factors/${fator}/challenge`, { metodo: 'POST', corpo: {} })
			guardar(await pedir(`/auth/v1/factors/${fator}/verify`, { metodo: 'POST', corpo: { challenge_id: d.id, code: String(codigo).replace(/\D/g, '') } }))
		},
		// Esqueci a senha do login: o e-mail traz um link que volta para esta página (voltar) com um acesso temporário.
		async esqueci(email, voltar) {
			const e = String(email || '').trim().toLowerCase()
			if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Digite o seu e-mail.')
			try { await pedir(`/auth/v1/recover?redirect_to=${encodeURIComponent(voltar)}`, { metodo: 'POST', corpo: { email: e }, semToken: true }) }
			catch (er) { throw new Error(/rate|429|seconds/i.test(er.message) ? 'Muitos pedidos seguidos. Espere um pouco e peça de novo.' : er.message) }
		},
		// Volta do e-mail: #access_token=…&type=recovery (ou #error=… se o link venceu). null se não é uma volta do e-mail.
		async recuperar(hash) {
			const p = new URLSearchParams(String(hash || '').replace(/^#/, ''))
			if (p.get('error_code') || p.get('error')) throw new Error(/expired/i.test(p.get('error_code') + p.get('error_description')) ? 'Este link já venceu ou já foi usado. Peça outro em "Esqueci a senha".' : 'Este link não vale mais. Peça outro em "Esqueci a senha".')
			if (p.get('type') !== 'recovery' || !p.get('access_token')) return null
			guardar({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: Number(p.get('expires_in')) || 3600 })
			const u = await pedir('/auth/v1/user')
			sessao.email = u.email; sessao.dono = u.id
			const fator = (u.factors || []).find((f) => f.factor_type === 'totp' && f.status === 'verified')
			return { email: u.email, precisaCodigo: !!fator, fator: fator?.id }
		},
		// Com o código do celular ligado, o banco só deixa trocar a senha depois do código (confirmarCodigo).
		async trocarSenha(nova) {
			if (String(nova || '').length < 10) throw new Error('Use uma senha com pelo menos 10 caracteres.')
			await pedir('/auth/v1/user', { metodo: 'PUT', corpo: { password: nova } })
			sessao = null
		},
		async abrir(senhaEscritorio) {
			const [cfg] = await rest('registros?select=cifra&colecao=eq.config&limit=1')
			if (!cfg) throw new Error('Seu escritório ainda não foi criado na Central do computador.')
			chave = await abrirEscritorio(JSON.parse(cfg.cifra), senhaEscritorio)
		},
		sair() { sessao = null; chave = null },

		/* ---------- escritório: direto do banco, só leitura (fase 1) ---------- */
		async listar(colecao) {
			if (!COLECOES_LINK.includes(colecao)) return []
			const linhas = await rest(`registros?select=id,versao,autor,cifra&colecao=eq.${colecao}&apagado=eq.false&limit=5000`)
			const r = []
			for (const l of linhas) { try { r.push({ ...(await decifrar(chave, l.cifra, `${colecao}:${l.id}`)), _versao: Number(l.versao), _autor: l.autor }) } catch {} }
			return r
		},

		// Fase 2: grava no banco do mesmo jeito que a Central (mesmas regras, mesma cifra). Vale o registro mais novo,
		// como na sincronização entre computadores. O cofre de senhas continua fora do link.
		async obter(colecao, id) {
			const [l] = await rest(`registros?select=id,cifra,apagado&colecao=eq.${colecao}&id=eq.${encodeURIComponent(id)}&limit=1`)
			return l && !l.apagado ? decifrar(chave, l.cifra, `${colecao}:${l.id}`) : null
		},
		async salvar(colecao, item, autor = '') {
			if (!COLECOES_LINK.includes(colecao)) throw new Error('Pelo link isto não pode ser alterado.')
			const { _versao, _autor, ...novo } = item
			const atual = novo.id ? await api.obter(colecao, novo.id) : null
			const limpo = normalizar(colecao, { ...atual, ...novo })
			const versao = Date.now()
			await rest('registros?on_conflict=dono,colecao,id', { metodo: 'POST', corpo: [{ dono: sessao.dono, id: limpo.id, colecao, versao, autor, apagado: false, cifra: await cifrar(chave, limpo, `${colecao}:${limpo.id}`) }], prefer: 'resolution=merge-duplicates,return=minimal' })
			return { ...limpo, _versao: versao, _autor: autor }
		},
		async apagar(colecao, id, autor = '') {
			if (!COLECOES_LINK.includes(colecao)) throw new Error('Pelo link isto não pode ser alterado.')
			await rest('registros?on_conflict=dono,colecao,id', { metodo: 'POST', corpo: [{ dono: sessao.dono, id, colecao, versao: Date.now(), autor, apagado: true, cifra: null }], prefer: 'resolution=merge-duplicates,return=minimal' })
		},

		/* ---------- Central: ligada? e o correio ---------- */
		async centralLigada() {
			const [a] = await rest('central_ativa?select=visto_em,versao,sempre_ligada&limit=1')
			const ha = a ? Date.now() - new Date(a.visto_em).getTime() : Infinity
			return { ligada: ha < 75 * 1000, visto: a?.visto_em || null, versao: a?.versao || null, sempreLigada: !!a?.sempre_ligada }
		},
		// Manda um pedido à Central e espera a resposta (por padrão até 60 s). esperar: false só deixa na fila.
		async pedir(rota, metodo = 'GET', corpo, { esperar = true, limite = 60000 } = {}) {
			const id = novoId()
			await rest('correio', { metodo: 'POST', corpo: { id, tipo: 'pedido', cifra: await cifrar(chave, { rota, metodo, corpo }, `correio:pedido:${id}`) }, prefer: 'return=minimal' })
			if (!esperar) return { status: 202, corpo: { ok: true, naFila: true } }
			const fim = Date.now() + limite
			while (Date.now() < fim) {
				await new Promise((ok) => setTimeout(ok, 700))
				const [r] = await rest(`correio?select=id,cifra&tipo=eq.resposta&ref=eq.${id}&limit=1`)
				if (!r) continue
				await rest(`correio?id=eq.${r.id}`, { metodo: 'DELETE' }).catch(() => {})
				return decifrar(chave, r.cifra, `correio:resposta:${id}`)
			}
			await rest(`correio?id=eq.${id}`, { metodo: 'DELETE' }).catch(() => {}) // a Central não respondeu: desiste do pedido
			throw new Error('Sua Central não respondeu. Ela pode estar desligada ou sem internet.')
		},
		/* ---------- fase 3: arquivos (depósito do Supabase, cifrados, pasta só dela, apagados ao receber) ---------- */
		async deposito(caminho, { metodo = 'GET', corpo } = {}) {
			if (sessao.expira < Date.now()) await renovar()
			const r = await buscar(`${url}/storage/v1/object/${caminho}`, { method: metodo, headers: { apikey: chaveApi, authorization: 'Bearer ' + sessao.token, ...(corpo ? { 'content-type': 'application/octet-stream', 'x-upsert': 'true' } : {}) }, body: corpo })
			if (!r.ok) throw new Error(r.status === 413 ? 'Arquivo grande demais (máximo 20 MB).' : 'Não consegui passar o arquivo agora. Tente de novo.')
			return r
		},
		// Foto ou documento do celular → Central. Devolve o caminho onde a Central guardou (para anexar à mensagem).
		async enviarArquivo(nome, bytes) {
			if (bytes.length > 20 * 1024 * 1024) throw new Error('Arquivo grande demais para o link (máximo 20 MB).')
			const id = novoId()
			await api.deposito(`correio-arquivos/${sessao.dono}/${id}`, { metodo: 'POST', corpo: await cifrarBytes(chave, bytes, `arquivo:${id}`) })
			const r = await api.pedir('anexo-link', 'POST', { arquivo: { id, nome } }, { limite: 120000 })
			if (r.status !== 200) { await api.deposito(`correio-arquivos/${sessao.dono}/${id}`, { metodo: 'DELETE' }).catch(() => {}); throw new Error(r.corpo?.erro || 'A Central não recebeu o arquivo.') }
			return r.corpo.caminho
		},
		// Atendimento gravado no celular (PCM 16 kHz, 16 bits): vai em μ-law, trancado, em partes de até 15 MB (o limite
		// por arquivo do plano grátis é 50 MB). A Central baixa, apaga do depósito, transcreve e abre a conversa sozinha.
		// aoPasso(texto) mostra o andamento; devolve { job } para acompanhar pelos eventos.
		async enviarAtendimento(pcm16, { caso = '', casoId = null, nomeCaso = '' } = {}, aoPasso = () => {}) {
			const bytes = codificar(pcm16)
			const PARTE = 15 * 1024 * 1024, total = Math.ceil(bytes.length / PARTE), ids = []
			const apagar = () => Promise.all(ids.map((id) => api.deposito(`correio-arquivos/${sessao.dono}/${id}`, { metodo: 'DELETE' }).catch(() => {})))
			const inicio = Date.now()
			try {
				for (let i = 0; i < total; i++) {
					aoPasso(`Enviando o áudio${total > 1 ? ` (parte ${i + 1} de ${total})` : ''}, trancado com a senha do escritório…`)
					const id = novoId()
					await api.deposito(`correio-arquivos/${sessao.dono}/${id}`, { metodo: 'POST', corpo: await cifrarBytes(chave, bytes.subarray(i * PARTE, (i + 1) * PARTE), `arquivo:${id}`) })
					ids.push(id)
				}
				aoPasso('Áudio enviado. A Central está buscando…')
				const r = await api.pedir('atendimento-link', 'POST', { partes: ids, caso, casoId, nomeCaso, envioSeg: Math.round((Date.now() - inicio) / 1000) }, { limite: 180000 })
				if (r.status !== 200) throw new Error(r.corpo?.erro || 'A Central não recebeu o áudio.')
				return r.corpo
			} catch (e) { await apagar(); throw e }
		},
		// Peça gerada numa conversa → celular. Devolve { nome, bytes } já aberto.
		async baixarArquivo(caminho) {
			const r = await api.pedir('arquivo-para-link', 'POST', { caminho }, { limite: 120000 })
			if (r.status !== 200) throw new Error(r.corpo?.erro || 'A Central não mandou o arquivo.')
			const { id, nome } = r.corpo
			const cifra = new Uint8Array(await (await api.deposito(`authenticated/correio-arquivos/${sessao.dono}/${id}`)).arrayBuffer())
			await api.deposito(`correio-arquivos/${sessao.dono}/${id}`, { metodo: 'DELETE' }).catch(() => {})
			return { nome, bytes: await decifrarBytes(chave, cifra, `arquivo:${id}`) }
		},

		// Eventos da tela (texto chegando, permissões...): assina e entrega cada lote a quem pediu.
		assinarEventos(entregar, { intervalo = 1000 } = {}) {
			let ativo = true, ultimaAssinatura = 0
			;(async () => {
				while (ativo) {
					try {
						if (Date.now() - ultimaAssinatura > 45000) { ultimaAssinatura = Date.now(); await api.pedir('eventos', 'POST', {}, { esperar: false }) }
						const linhas = await rest('correio?select=id,cifra,seq,criado_em&tipo=eq.evento&order=criado_em.asc,seq.asc&limit=50')
						for (const l of linhas) {
							await rest(`correio?id=eq.${l.id}`, { metodo: 'DELETE' }).catch(() => {})
							try { entregar(await decifrar(chave, l.cifra, `correio:evento:${l.id}`)) } catch {}
						}
					} catch {}
					await new Promise((ok) => setTimeout(ok, intervalo))
				}
			})()
			return () => { ativo = false }
		},
	}
	return api
}
