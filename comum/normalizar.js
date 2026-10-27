// Regras dos registros do Escritório: o que entra em cada coleção (casos, itens, equipe, cofre).
// Usado pela Central (escritorio.mjs) e pelo Portal no celular (portal.js): os dois gravam exatamente o mesmo formato.
export const COLECOES = ['casos', 'itens', 'equipe', 'cofre']
export const ETAPAS = ['atendimento', 'demanda', 'administrativo', 'judicial', 'encerrado']
export const COLUNAS = ['afazer', 'fazendo', 'aguardando', 'feito']
export const TIPOS_ITEM = ['prazo', 'audiencia', 'pericia', 'tarefa', 'cobranca']
export const TURNOS = ['manha', 'tarde', 'noite']

const texto = (v, max = 4000) => (v == null ? '' : String(v).slice(0, max).trim())
const umDe = (v, lista, padrao) => (lista.includes(v) ? v : padrao)
const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null)
export { texto }

export function normalizar(colecao, o) {
	const base = { id: o.id || globalThis.crypto.randomUUID(), criadoEm: o.criadoEm || Date.now() }
	if (colecao === 'casos') return {
		...base,
		cliente: texto(o.cliente, 200),
		outrasPartes: (o.outrasPartes || []).map((p) => texto(p, 200)).filter(Boolean),
		processos: (o.processos || []).map((p) => ({ numero: texto(p.numero, 40), tribunal: texto(p.tribunal, 40), orgao: texto(p.orgao, 200) })).filter((p) => p.numero),
		assunto: texto(o.assunto, 300),
		etapa: umDe(o.etapa, ETAPAS, 'demanda'),
		origem: texto(o.origem, 60),
		responsavel: texto(o.responsavel, 100),
		notas: texto(o.notas, 20000),
		atendimentos: (o.atendimentos || []).map((a) => ({ quando: a.quando, resumo: texto(a.resumo, 20000) })),
		// Áudios gravados nos atendimentos: só o nome do arquivo; o áudio fica no computador onde foi recebido.
		audios: (o.audios || []).map((a) => ({ quando: a.quando, arquivo: texto(a.arquivo, 200), duracao: Number(a.duracao) || 0 })).filter((a) => a.arquivo),
	}
	if (colecao === 'itens') return {
		...base,
		tipo: umDe(o.tipo, TIPOS_ITEM, 'tarefa'),
		titulo: texto(o.titulo, 300),
		descricao: texto(o.descricao, 8000),
		casoId: o.casoId || null,
		data: data(o.data),
		turno: o.turno ? umDe(o.turno, TURNOS, null) : null,
		hora: /^\d{2}:\d{2}$/.test(o.hora || '') ? o.hora : null,
		responsavel: texto(o.responsavel, 100),
		origem: texto(o.origem, 60),
		coluna: umDe(o.coluna, COLUNAS, 'afazer'),
		aConferir: !!o.aConferir, // prazo sugerido (DJEN, atendimento): só vale depois que a advogada confirmar
		critico: !!o.critico,
		faltando: texto(o.faltando, 1000), // coluna "aguardando": o que falta e quando cobrar
		proximaCobranca: data(o.proximaCobranca),
		fonte: o.fonte && typeof o.fonte === 'object' ? { tipo: texto(o.fonte.tipo, 30), id: texto(o.fonte.id, 100) } : null,
	}
	if (colecao === 'equipe') return { ...base, nome: texto(o.nome, 100), cor: texto(o.cor, 20), ativo: o.ativo !== false }
	if (colecao === 'cofre') return { ...base, casoId: o.casoId || null, sistema: texto(o.sistema, 60) || 'gov.br', usuario: texto(o.usuario, 100), senha: texto(o.senha, 200), obs: texto(o.obs, 500) }
	throw new Error('Coleção desconhecida.')
}
