// Guia das novidades: na primeira abertura depois de atualizar, mostra só o que mudou desde a última versão vista.
// A primeira versão da lista TEM de ser a do package.json (instalador/gerar-patch.mjs confere).
// "abrir" leva direto à função: escritorio, quadro, motor, ajustes, sustentacao.
const NOVIDADES = [
	{ versao: '1.0.19', itens: [
		['Celular mais esperto', 'Pelo link, quando algo demora, aparece o aviso de que a sua Central está fazendo isso no computador do escritório. E o link mostra "Sua Central está ligada" logo que você entra no escritório aqui, sem esperar meio minuto.', null],
	] },
	{ versao: '1.0.18', itens: [
		['Opus como padrão', 'A Central abre sempre no Opus, o motor mais completo. Para poupar o limite da conta, clique em "Opus · profundo" no topo e troque para o Sonnet: vale até você fechar a Central.', 'motor'],
		['Se a internet cair no envio', 'No atendimento gravado pelo celular, se o envio falhar, a gravação fica na tela com "Tentar de novo" e "Salvar o áudio no celular".', null],
	] },
	{ versao: '1.0.17', itens: [
		['Áudio do atendimento guardado', 'O áudio de cada atendimento gravado fica neste computador e aparece na ficha do caso, em "Áudios dos atendimentos", com Ouvir e Mostrar na pasta.', 'escritorio'],
		['Prazo calculado', 'Nas intimações do DJEN, a Central calcula a data em que o prazo vence (dias úteis, feriados nacionais e o recesso de 20/12 a 20/01) e mostra a conta. "Criar prazo" já põe a data na tarefa, marcada para conferir. Feriados locais e suspensões do tribunal não entram: se houver, o prazo vai além.', 'quadro'],
		['Sustentação oral de cara nova', 'O treino virou uma tribuna: cronômetro em anel contra o tempo previsto, a onda da sua voz ao vivo e as pausas contadas enquanto você fala. O retorno mostra o ritmo num medidor, compara com a tentativa anterior e traz a pergunta do julgador com o botão "Treinar a resposta".', 'sustentacao'],
		['Gravar atendimento pelo celular', 'Pelo link, em Escritório > + Atendimento: grave a conversa com o cliente no celular. O áudio vai trancado para a sua Central, que transcreve, abre sozinha a conversa com o resumo e as tarefas e guarda o áudio no computador, anexado ao caso. Na nuvem ele não fica. Pode fechar o celular depois do envio.', null],
		['Pesquisa instantânea', 'Procurar dentro das conversas (Enter) ficou imediato. Para procurar também nos documentos que a Central leu, use o botão no fim da lista.', null],
		['Primeiros passos e esqueci a senha', 'Uma lista mostra o que falta para a Central ficar completa (fica também nos Ajustes). Esqueceu a senha do login do escritório? Use "Esqueci minha senha": chega um e-mail para criar outra.', 'ajustes'],
	] },
	{ versao: '1.0.16', itens: [
		['Melhor no celular', 'No celular (e em janelas estreitas), tudo ficou do tamanho certo: o quadro de tarefas e a semana mostram uma coluna por vez, os casos viram cartões e nada fica cortado.', null],
	] },
	{ versao: '1.0.15', itens: [
		['Pesquisa mais leve', 'Procurar dentro das conversas não trava mais a Central (nem o acesso pelo celular). Se houver muitas conversas, ela mostra o que achou em até 25 segundos.', null],
	] },
	{ versao: '1.0.14', itens: [
		['Demandas concluídas', 'No Escritório, o quadradinho "Concluídas" do Painel (e "Ver todas as concluídas" na coluna Feito) mostra tudo o que foi feito: últimos 7 dias, 30 dias, este mês ou tudo, por pessoa e com busca.', 'escritorio'],
		['Sua Central no celular', 'Abra o link que está em Ajustes > Acesso pelo celular: conversas e mensagens que rodam aqui no computador, a agenda (ver, criar, marcar feito), fotos de documentos para a Central ler e as peças prontas para baixar. Tudo vai trancado com a senha do escritório; o cofre de senhas fica só no computador.', 'ajustes'],
		['Manter a Central ligada', 'Em Ajustes, ligue "Manter a Central ligada" para o link funcionar mesmo com a janela fechada.', 'ajustes'],
	] },
	{ versao: '1.0.13', itens: [
		['Tela cheia sempre', 'A Central abre maximizada também depois de uma atualização ou quando já havia uma janela aberta.', null],
	] },
	{ versao: '1.0.12', itens: [
		['Sem barras de rolagem', 'As barras de rolagem sumiram: listas e conversas longas continuam rolando com a rodinha do mouse.', null],
		['Versão à vista','Nos Ajustes, a primeira linha mostra a versão da sua Central e se ela está em dia (ou se já baixou uma versão nova, que instala quando você fechar).', 'ajustes'],
	] },
	{ versao: '1.0.11', itens: [
		['Sugestão para o Rafael', 'Nos Ajustes, escreva uma ideia ou algo que incomodou: vai direto para o Rafael. Não escreva nomes de clientes.', 'ajustes'],
		['Pesquisa de desembargador', 'Peça as decisões de um relator do TJMG: a Central mostra em quais processos ele é o relator e guia você na pesquisa das decisões no site do tribunal.', null],
	] },
	{ versao: '1.0.10', itens: [
		['Atualização automática', 'Daqui para a frente, as versões novas chegam sozinhas: a Central baixa em segundo plano e instala quando você fecha (ou quando não há conversa trabalhando). Suas conversas e dados não mudam.', null],
		['Mensagens de erro mais claras', 'Se a internet cair, a conta do Claude sair ou o limite de uso acabar, a Central diz o que aconteceu e o que fazer. Os erros vão para o Rafael (sem nada dos seus casos), para ele corrigir mais rápido.', null],
		['Manutenção pelo Rafael', 'Quando o Rafael precisar ajustar sua Central, ela mostra o aviso dele e volta sozinha quando ele terminar.', null],
	] },
	{ versao: '1.0.0-beta.9', itens: [
		['Pesquisar conversas', 'No campo com a lupa, acima da lista: digite o nome do cliente ou da peça. Com Enter, a Central procura também dentro das conversas e mostra o trecho.', null],
		['Renomear, arquivar e apagar', 'Passe o mouse sobre uma conversa e clique em "⋯" (ou use o botão direito). Arquivadas ficam no fim da lista; apagadas ficam 30 dias na lixeira antes de sair de vez.', null],
		['Ditar a mensagem', 'Clique em "Ditar" no campo de mensagem, fale e clique em "Parar". O áudio é transcrito neste computador e o texto aparece para você conferir antes de enviar.', null],
	] },
	{ versao: '1.0.0-beta.8', itens: [
		['Um escritório para cada uma', 'Agora cada advogada tem o próprio Escritório: casos, tarefas, agenda e cofre só seus. Entre com o seu e-mail e crie a senha do seu escritório. O escritório antigo, que era compartilhado, foi zerado.', 'escritorio'],
	] },
	{ versao: '1.0.0-beta.7', itens: [
		['Mensagem do dia', 'Na primeira abertura do dia: uma frase de quem entende do ofício e o resumo do seu dia (vencidos, prazos, perícias). Dá para desligar nos Ajustes.', 'ajustes'],
		['Dicas de uso', 'Quando houver um jeito mais rápido de fazer algo, a Central sugere no fim da resposta. No máximo uma por conversa; dá para desligar.', null],
		['Gravar atendimento', 'Na ficha do caso ou em "+ Atendimento": a conversa com o cliente vira resumo no caso e tarefas sugeridas.', 'escritorio'],
		['Sugestões para o Escritório', 'Quando a resposta trouxer prazos ou tarefas, aparece um cartão para você marcar o que entra no Escritório.', null],
		['Sustentação com o caso', 'Escolha o caso no treino: o retorno confere se você cobriu os pontos e faz a pergunta difícil do próprio caso.', 'sustentacao'],
		['Mensagens em sequência', 'O que você manda enquanto a Central trabalha vai junto, e ela lê tudo antes de agir. "Interromper e mandar agora" para na hora.', null],
	] },
	{ versao: '1.0.0-beta.6', itens: [
		['Janela de tarefa sem barras de rolagem', 'O essencial fica à vista e o resto em "Mais detalhes". Salvar e Cancelar ficam sempre no rodapé.', 'escritorio'],
		['"Abrir o caso" nos avisos', 'Cada intimação abre a ficha do caso pelo número do processo. Se o caso não existir, a Central oferece criar.', 'quadro'],
		['Motor de escrita explicado', 'Clique em "Sonnet · econômico" no topo para ver as opções. A escolha vale para todas as conversas até você trocar.', 'motor'],
		['Tentar de novo', 'Se uma resposta der erro, o botão "Tentar de novo" reenvia a última mensagem.', null],
		['Conversas muito longas', 'A Central avisa e oferece continuar num chat novo, já com o resumo do que foi feito.', null],
	] },
	{ versao: '1.0.0-beta.5', itens: [
		['Escritório', 'Painel, tarefas em quadro, semana por turno, casos, cofre de senhas. Protegido pela senha do escritório.', 'escritorio'],
		['Avisos mais claros', '"Atualização no caso de Fulano", com o que aconteceu e o prazo mencionado em destaque. Botão "Criar prazo".', 'quadro'],
		['Backup do escritório', 'Uma cópia protegida por dia. A pasta fica nos Ajustes.', 'ajustes'],
	] },
]

function mostrarNovidades(forcar = false) {
	const atual = NOVIDADES[0].versao
	let vista = null
	try { vista = localStorage.getItem('novidadesVistas') } catch {}
	if (!forcar && vista === atual) return
	// Primeira vez neste computador: só a versão atual. Depois: tudo o que veio desde a última vista.
	const ate = vista ? NOVIDADES.findIndex((n) => n.versao === vista) : 1
	const lista = NOVIDADES.slice(0, ate < 0 ? NOVIDADES.length : Math.max(ate, 1))
	let d = $('#d-novidades')
	if (!d) { d = document.createElement('dialog'); d.id = 'd-novidades'; document.body.append(d) }
	d.innerHTML = `<div class="janela"><h2>Novidades da Central</h2>
		${lista.map((n) => n.itens.map(([tit, txt, abrir]) => `<div class="novidade"><div><strong>${escapar(tit)}</strong><p>${escapar(txt)}</p></div>${abrir ? `<button class="opcao" data-abrir="${abrir}">Mostrar</button>` : ''}</div>`).join('')).join('')}
		<div class="fim"><button class="opcao principal" data-fechar>Entendi</button></div></div>`
	const fechar = () => { try { localStorage.setItem('novidadesVistas', atual) } catch {} d.close() }
	d.querySelector('[data-fechar]').onclick = fechar
	d.querySelectorAll('[data-abrir]').forEach((b) => (b.onclick = () => {
		fechar()
		;({ escritorio: () => mostrarEscritorio(), quadro: () => mostrarQuadro(), motor: () => $('#pilula-modelo').click(), ajustes: () => $('#abrir-ajustes').click(), sustentacao: () => $('#abrir-sustentacao').click() })[b.dataset.abrir]?.()
	}))
	d.showModal()
}
// Quem chama na abertura do app é abertura.js (depois da mensagem do dia).
