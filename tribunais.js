// Ajustes › Tribunais: chave pública do DataJud e teste do certificado digital (servidor: tribunais.mjs).
// Depende de app.js: $, api, aviso, dataBR, horaBR.
let TRIB = null

async function carregarTribunais() {
	try { TRIB = await api('tribunais') } catch (e) { $('#trib-chave-estado').textContent = e.message; return }
	desenharTribunais()
}

function desenharTribunais() {
	const d = TRIB.datajud, c = TRIB.certificado
	const t = d.teste
	const quando = (ms) => `${dataBR(ms)} às ${horaBR(ms)}`
	let texto = d.configurada ? `Configurada (termina em …${d.final})` : 'Não configurada: a consulta de processo pelo número fica desligada'
	if (d.configurada && t) {
		texto += t.ok ? ` · testada em ${quando(t.quando)}: funcionando`
			: t.tipo === 'FonteIndisponivel' ? ` · teste de ${quando(t.quando)}: o DataJud estava sobrecarregado (isso não quer dizer que a chave esteja errada). Tente mais tarde.`
			: ` · teste de ${quando(t.quando)}: ${t.mensagem}`
	}
	$('#trib-chave-estado').textContent = texto
	$('#trib-tirar').hidden = !d.configurada
	$('#trib-testar').disabled = !d.configurada || !TRIB.pacote
	$('#trib-testar').title = TRIB.pacote ? '' : 'Chega com a próxima atualização da skill'
	const nomes = { apareceu: 'funciona neste computador', 'nao-apareceu': 'a janela do certificado não apareceu: confira se o programa do token (ou o certificado A1) está instalado', 'sem-certificado': 'sem certificado neste computador' }
	$('#trib-cert-estado').textContent = c.teste ? `Testado em ${quando(c.teste.quando)}: ${nomes[c.teste.resultado]}` : 'Ainda não testado'
	const a = c.automatico
	$('#trib-auto-estado').textContent = a ? `Ligado com ${a.cn} (${a.emissor}, válido até ${a.validade.split('-').reverse().join('/')})` : 'Desligado: para entrar, o BDS Jus abre uma janela'
	$('#trib-auto-desligar').hidden = !a
	$('#trib-auto-ligar').textContent = a ? 'Trocar o certificado' : 'Ligar'
}

// Certificados com chave privada e válidos deste computador (A1 e os de nuvem que o programa do fornecedor instala).
async function carregarCertificados() {
	const sel = $('#trib-auto-cert')
	sel.innerHTML = '<option value="">Procurando certificados…</option>'
	let lista = []
	try { lista = (await api('tribunais/certificados')).certificados || [] } catch {}
	sel.innerHTML = lista.length
		? lista.map((c) => `<option value="${escapar(c.digital)}"${TRIB?.certificado.automatico?.digital === c.digital ? ' selected' : ''}>${escapar(c.cn)} · ${escapar(c.emissor)} · até ${c.validade.split('-').reverse().join('/')}</option>`).join('')
		: '<option value="">Nenhum certificado com chave neste computador (A1 instalado ou programa do certificado em nuvem)</option>'
	$('#trib-auto-ligar').disabled = !lista.length
}
$('#trib-auto-ligar').onclick = async (ev) => {
	const digital = $('#trib-auto-cert').value
	if (!digital) return aviso('Escolha o certificado.')
	const b = ev.target
	b.disabled = true; b.textContent = 'Aguardando a permissão do Windows…'
	try { TRIB = await api('tribunais/login-automatico', { digital }); desenharTribunais(); aviso('Pronto: o BDS Jus entra sozinho com esse certificado.') } catch (e) { aviso(e.message) }
	b.disabled = false; desenharTribunais()
}
$('#trib-auto-desligar').onclick = async () => {
	if (!confirm('Desligar o login automático? O Windows vai pedir permissão de administrador de novo.')) return
	try { TRIB = await api('tribunais/login-automatico', { ligar: false }); desenharTribunais() } catch (e) { aviso(e.message) }
}

$('#abrir-ajustes').addEventListener('click', () => carregarTribunais().then(carregarCertificados))
$('#trib-wiki').onclick = () => api('link', { url: TRIB?.datajud.wiki || 'https://datajud-wiki.cnj.jus.br/api-publica/acesso' }).catch((e) => aviso(e.message))
$('#trib-salvar').onclick = async () => {
	const k = $('#trib-chave').value.trim()
	if (!k) return aviso('Cole a chave antes de salvar.')
	try { TRIB = await api('tribunais/chave', { chave: k }); $('#trib-chave').value = ''; desenharTribunais(); aviso('Chave salva. Clique em "Testar a chave" para conferir.') } catch (e) { aviso(e.message) }
}
$('#trib-tirar').onclick = async () => {
	if (!confirm('Tirar a chave do DataJud? A consulta de processo pelo número fica desligada.')) return
	try { TRIB = await api('tribunais/chave', { chave: '' }); desenharTribunais() } catch (e) { aviso(e.message) }
}
$('#trib-testar').onclick = async (ev) => {
	const b = ev.target
	b.disabled = true; b.textContent = 'Testando… (pode levar até 3 minutos)'
	try { TRIB = await api('tribunais/testar', {}); desenharTribunais(); if (TRIB.erro) aviso(TRIB.erro) } catch (e) { aviso(e.message) }
	b.textContent = 'Testar a chave'; b.disabled = false
}
$('#trib-cert-abrir').onclick = async () => {
	try { await api('link', { url: TRIB?.certificado.login || 'https://eproc1g.tjmg.jus.br/eproc/' }) } catch (e) { return aviso(e.message) }
	$('#trib-cert-passo2').hidden = false
}
document.querySelectorAll('#trib-cert-passo2 [data-cert]').forEach((b) => (b.onclick = async () => {
	try { TRIB = await api('tribunais/certificado', { resultado: b.dataset.cert }); desenharTribunais(); $('#trib-cert-passo2').hidden = true } catch (e) { aviso(e.message) }
}))
