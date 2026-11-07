// Guia das novidades: na primeira abertura depois de atualizar, mostra só o que mudou desde a última versão vista.
// A primeira versão da lista TEM de ser a do package.json (instalador/gerar-patch.mjs confere).
// "abrir" leva direto à função: escritorio, quadro, motor, ajustes, sustentacao, radar.
const NOVIDADES = [
	{ versao: '1.0.29', itens: [
		['O BDS Jus busca os autos por você', 'Quando precisa ver um processo, ele mesmo consulta o tribunal. No TJMG, você só digita o código da imagem, ali na conversa. Para documentos que só aparecem com você logada, ela entra no eproc com o seu certificado: com A1 ou certificado em nuvem, sem abrir janela (ligue em Ajustes › Tribunais). Ela só lê: não peticiona, não assina e não dá ciência de nada.', 'ajustes'],
		['Intimação chegou, já está na agenda', 'Intimação com prazo ou audiência entra sozinha na agenda do Escritório, no caso certo, marcada "a conferir". Prazos de hoje, amanhã e depois de amanhã aparecem no topo dos Avisos do dia.', 'quadro'],
		['Resumo do dia', 'Uma vez por dia, numa aba nova, o BDS Jus junta o que importa: intimações novas com o que fazer e o prazo, mensagens de clientes no WhatsApp com uma resposta pronta para você copiar, e as peças que você editou. Dá para desligar em Avisos do dia › Minhas OABs.', 'quadro'],
		['Mais tempo de intimações', 'A busca agora olha os últimos 90 dias (antes eram 30), e você pode escolher até 1 ano. As que você marcou como vistas ficam em "Já vistas", no fim dos Avisos do dia, com busca.', 'quadro'],
	] },
	{ versao: '1.0.28', itens: [
		['Consultar o processo do TJMG sem abrir navegador', 'Na ficha do caso e nas intimações, processos do TJMG agora têm o botão "Consultar o processo". O BDS Jus busca a consulta pública do tribunal e mostra aqui a imagem do código de confirmação: você digita as letras e o processo aparece na própria Central, pronto para guardar no caso ou perguntar. Errou o código? Vem outra imagem. Nos tribunais que não aceitam consulta por programa (como o TRF6), o botão continua abrindo o site, agora numa janela privada (sem entrar na sua conta Microsoft e sem guardar histórico), com os passos mais claros e sem repetir a mesma página.', 'escritorio'],
	] },
	{ versao: '1.0.27', itens: [
		['Radar na sua cidade', 'O Radar da Comarca agora funciona em qualquer cidade. Em "Ajustar meu radar", escreva a cidade do escritório e o estado (se o fórum que atende a cidade fica em outra, escreva a comarca). O BDS Jus confere o nome no IBGE, lê as publicações do Diário de Justiça dessa comarca e sugere as varas federais mais próximas para os processos contra o INSS. Trocou de cidade? O radar busca de novo, sem misturar números de outro lugar.', 'radar'],
		['Ajuda para conseguir clientes, dentro das regras da OAB', 'Pergunte na conversa "como conseguir clientes?" ou "quero divulgar o escritório". O BDS Jus faz um diagnóstico rápido e monta um plano passo a passo: para quem está começando, as primeiras 12 semanas, uma tarefa por vez; para quem já tem carteira, onde estão os clientes que se perdem. Inclui perguntas de triagem para o WhatsApp, o que procurar nos clientes que você já tem, parcerias com contadores, sindicatos e clínicas, e palestras sobre vários benefícios do INSS. Tudo dentro do Provimento 205/2021 da OAB: sem promessa de resultado, sem casos concretos, sem pagar indicação.', null],
	] },
	{ versao: '1.0.26', itens: [
		['Abrir no eproc e copiar', 'Na ficha do caso (processos do TJMG) e nas intimações com link do tribunal, o botão "Abrir no eproc" abre o sistema numa janela do Edge, já com o número do processo copiado (é só colar com Ctrl+V na busca). Você entra com o seu certificado, como sempre; o BDS Jus não vê nem guarda o certificado nem o PIN. Em cada página que interessar (eventos, decisão, documento), clique no botão dourado "Copiar esta página para o BDS Jus": ela aparece no BDS Jus para guardar na ficha do caso (fica cifrada, em "Cópias do eproc") ou para "Perguntar sobre isso", que leva à conversa só aquela página.', 'escritorio'],
	] },
	// A 1.0.24 saiu sem dois arquivos e nenhuma Central a instalou (voltaram sozinhas à 1.0.23): estas novidades são da 1.0.25.
	{ versao: '1.0.25', itens: [
		['Publicações de todos os tribunais, sem faltar nenhuma', 'As intimações já vinham do Diário de Justiça Eletrônico Nacional pelo número da OAB, que reúne todos os tribunais (TJMG, TJSP, TRF6, TRTs e os demais). Agora o BDS Jus traz todas, mesmo quando chegam centenas de uma vez (antes, passando de 100 no mês, as demais ficavam de fora), e guarda tudo neste computador: se o Diário sair do ar, você continua vendo o que já tinha chegado. No quadro de avisos, o novo cartão "De onde vêm suas publicações" mostra quantas chegaram de cada tribunal nos últimos 30 dias. Na primeira vez, um passo a passo guiado mostra onde olhar. Tem OAB suplementar em outro estado? Cadastre também em "Minhas OABs".', 'quadro'],
		['Avisos separados pelo que pedem', 'As intimações agora vêm em três grupos: Audiências marcadas, Pedem providência (prazo, citação, decisão) e Só para saber (edital, pauta, despacho sem prazo), que fica recolhido e pode ser marcado como visto de uma vez. Cada processo é uma linha só, com data, tribunal, de quem é o caso, o que aconteceu e o prazo; clicando, abre o cartão completo. O texto inteiro só é carregado quando você pede, e "Perguntar sobre isso" leva para a conversa só a intimação escolhida (as anteriores vão resumidas): gasta menos do seu limite do Claude e abre mais rápido, também no celular.', 'quadro'],
		['Agenda em PDF', 'No Escritório, o botão "Agenda em PDF" gera a agenda para mandar no WhatsApp ou no e-mail. Já vem com os filtros que estão na tela (pessoa, tipo, busca), e dá para escolher o período (esta semana, próxima, 7 ou 30 dias, o mês ou as datas que quiser), os tipos e se mostra o nome do cliente e o número do processo. Vai compartilhar fora do escritório? Desmarque o cliente. O PDF fica em Documentos › Central Juridica - Agendas e a pasta abre com ele selecionado. O cofre nunca entra.', 'escritorio'],
		['Ajustes › Tribunais', 'Nova seção nos Ajustes. Cole a chave pública do DataJud (o botão abre a página do CNJ onde ela está) para o BDS Jus consultar a capa e os movimentos de um processo pelo número, e teste o seu certificado digital: o BDS Jus abre a entrada do eproc e você conta se o Windows mostrou a janela do certificado. O BDS Jus não vê nem guarda o certificado nem o PIN.', 'ajustes'],
	] },
	{ versao: '1.0.23', itens: [
		['Radar da Comarca', 'Novo item na lateral: o que está mudando na sua região antes de virar processo. Na primeira vez, um passo a passo guiado acende cada lugar onde clicar e explica num balão o que você está escolhendo: vara federal, áreas e temas. Depois a tela mostra o briefing da semana com estágio (observar, preparar, agir), termômetro e a fonte oficial de cada assunto. Atualiza sozinha com as publicações do dia do Diário de Justiça (comarca e vara federal) e os projetos da Câmara, sempre somadas por assunto, nunca com nomes de pessoas. "Perguntar sobre isso" e "Transformar em peça" abrem a conversa já com o assunto.', 'radar'],
		['Perguntas com botões', 'Quando o BDS Jus precisa de respostas antes de redigir, cada pergunta vem num cartão numerado com as opções para clicar; a recomendada vem marcada. Se nenhuma servir, "Outra resposta" deixa escrever do seu jeito. Dá para mudar de ideia até clicar em "Enviar respostas".', null],
		['Menos pedidos de permissão', 'Ler um contrato chegava a pedir 8 permissões. Agora o trabalho interno do BDS Jus (arquivos temporários e a leitura e geração de documentos) segue sem perguntar. O BDS Jus continua perguntando antes de apagar algo, de rodar outro programa, de usar a internet e de salvar nas suas pastas (aí, "Permitir sempre" vale para a pasta e as subpastas).', null],
		['Mais espaço para a conversa', 'O botão no canto de cima, à esquerda, esconde o menu lateral e a conversa ocupa a tela toda (atalho: Ctrl+B). Os botões de anexar, WhatsApp e ditar agora são só símbolos; parando o mouse em cima, aparece o nome.', null],
	] },
	{ versao: '1.0.22', itens: [
		['Nova abertura do dia', 'O BDS Jus abre com a marca nova e a sua semana em números: prazos, audiências e perícias, e o que venceu. Sem nome de cliente, dá para printar e compartilhar. Os botões levam direto à agenda da semana e aos prazos. E ela chama você de Dr. ou Dra.: na primeira vez pergunta como prefere; dá para trocar nos Ajustes.', 'ajustes'],
		['Mais frases', 'A frase do dia agora varia mais: além de Rui Barbosa e Couture, entram a Constituição, o Estatuto da Advocacia, o Código de Ética da OAB e a Declaração Universal dos Direitos Humanos. Todas conferidas no texto oficial.', null],
		['O link não cai, nem na bateria', 'Com o BDS Jus aberto, o computador não entra em suspensão, esteja na tomada ou na bateria. Deixe o notebook com a tampa aberta (a tela pode apagar) e, se puder, na tomada: na bateria a carga acaba mais rápido.', 'ajustes'],
		['Sincronização mais firme', 'Depois de o notebook ficar parado, a agenda voltava a sincronizar só alguns minutos depois. Agora volta na hora.', null],
	] },
	{ versao: '1.0.21', itens: [
		['Motor automático', 'O BDS Jus escolhe o motor quando a conversa começa: Opus para peças, casos, documentos e análises; Sonnet só em pedido curto e simples, ou quando o limite de 5 horas da conta passa de 70%. Peça é sempre no Opus. Cada conversa fica no mesmo motor até o fim. Se uma conversa no Sonnet virar peça, o BDS Jus avisa e aconselha "Continuar no Opus": ele recebe a conversa inteira, sem perder nada. O topo mostra o motor da conversa aberta; para escolher "Sempre Opus" ou "Sempre Sonnet", clique nele.', 'motor'],
	] },
	{ versao: '1.0.20', itens: [
		['O link não cai quando você sai', 'Com o computador na tomada, o BDS Jus não deixa o Windows entrar em suspensão: o link do celular continua funcionando. Ao sair, aperte Windows + L para bloquear (só abre com a sua senha) e deixe o notebook com a tampa aberta; a tela pode apagar. Na bateria, ele suspende normalmente.', 'ajustes'],
	] },
	{ versao: '1.0.19', itens: [
		['Celular mais esperto', 'Pelo link, quando algo demora, aparece o aviso de que o seu BDS Jus está fazendo isso no computador do escritório. E o link mostra "Seu BDS Jus está ligado" logo que você entra no escritório aqui, sem esperar meio minuto.', null],
	] },
	{ versao: '1.0.18', itens: [
		['Opus como padrão', 'O BDS Jus abre sempre no Opus, o motor mais completo. Para poupar o limite da conta, clique em "Opus · profundo" no topo e troque para o Sonnet: vale até você fechar o BDS Jus.', 'motor'],
		['Se a internet cair no envio', 'No atendimento gravado pelo celular, se o envio falhar, a gravação fica na tela com "Tentar de novo" e "Salvar o áudio no celular".', null],
	] },
	{ versao: '1.0.17', itens: [
		['Áudio do atendimento guardado', 'O áudio de cada atendimento gravado fica neste computador e aparece na ficha do caso, em "Áudios dos atendimentos", com Ouvir e Mostrar na pasta.', 'escritorio'],
		['Prazo calculado', 'Nas intimações do DJEN, o BDS Jus calcula a data em que o prazo vence (dias úteis, feriados nacionais e o recesso de 20/12 a 20/01) e mostra a conta. "Criar prazo" já põe a data na tarefa, marcada para conferir. Feriados locais e suspensões do tribunal não entram: se houver, o prazo vai além.', 'quadro'],
		['Sustentação oral de cara nova', 'O treino virou uma tribuna: cronômetro em anel contra o tempo previsto, a onda da sua voz ao vivo e as pausas contadas enquanto você fala. O retorno mostra o ritmo num medidor, compara com a tentativa anterior e traz a pergunta do julgador com o botão "Treinar a resposta".', 'sustentacao'],
		['Gravar atendimento pelo celular', 'Pelo link, em Escritório > + Atendimento: grave a conversa com o cliente no celular. O áudio vai trancado para o seu BDS Jus, que transcreve, abre sozinho a conversa com o resumo e as tarefas e guarda o áudio no computador, anexado ao caso. Na nuvem ele não fica. Pode fechar o celular depois do envio.', null],
		['Pesquisa instantânea', 'Procurar dentro das conversas (Enter) ficou imediato. Para procurar também nos documentos que o BDS Jus leu, use o botão no fim da lista.', null],
		['Primeiros passos e esqueci a senha', 'Uma lista mostra o que falta para o BDS Jus ficar completa (fica também nos Ajustes). Esqueceu a senha do login do escritório? Use "Esqueci minha senha": chega um e-mail para criar outra.', 'ajustes'],
	] },
	{ versao: '1.0.16', itens: [
		['Melhor no celular', 'No celular (e em janelas estreitas), tudo ficou do tamanho certo: o quadro de tarefas e a semana mostram uma coluna por vez, os casos viram cartões e nada fica cortado.', null],
	] },
	{ versao: '1.0.15', itens: [
		['Pesquisa mais leve', 'Procurar dentro das conversas não trava mais o BDS Jus (nem o acesso pelo celular). Se houver muitas conversas, ele mostra o que achou em até 25 segundos.', null],
	] },
	{ versao: '1.0.14', itens: [
		['Demandas concluídas', 'No Escritório, o quadradinho "Concluídas" do Painel (e "Ver todas as concluídas" na coluna Feito) mostra tudo o que foi feito: últimos 7 dias, 30 dias, este mês ou tudo, por pessoa e com busca.', 'escritorio'],
		['Seu BDS Jus no celular', 'Abra o link que está em Ajustes > Acesso pelo celular: conversas e mensagens que rodam aqui no computador, a agenda (ver, criar, marcar feito), fotos de documentos para o BDS Jus ler e as peças prontas para baixar. Tudo vai trancado com a senha do escritório; o cofre de senhas fica só no computador.', 'ajustes'],
		['Manter o BDS Jus ligado', 'Em Ajustes, ligue "Manter o BDS Jus ligado" para o link funcionar mesmo com a janela fechada.', 'ajustes'],
	] },
	{ versao: '1.0.13', itens: [
		['Tela cheia sempre', 'O BDS Jus abre maximizado também depois de uma atualização ou quando já havia uma janela aberta.', null],
	] },
	{ versao: '1.0.12', itens: [
		['Sem barras de rolagem', 'As barras de rolagem sumiram: listas e conversas longas continuam rolando com a rodinha do mouse.', null],
		['Versão à vista','Nos Ajustes, a primeira linha mostra a versão do seu BDS Jus e se ele está em dia (ou se já baixou uma versão nova, que instala quando você fechar).', 'ajustes'],
	] },
	{ versao: '1.0.11', itens: [
		['Sugestão para o Rafael', 'Nos Ajustes, escreva uma ideia ou algo que incomodou: vai direto para o Rafael. Não escreva nomes de clientes.', 'ajustes'],
		['Pesquisa de desembargador', 'Peça as decisões de um relator do TJMG: o BDS Jus mostra em quais processos ele é o relator e guia você na pesquisa das decisões no site do tribunal.', null],
	] },
	{ versao: '1.0.10', itens: [
		['Atualização automática', 'Daqui para a frente, as versões novas chegam sozinhas: o BDS Jus baixa em segundo plano e instala quando você fecha (ou quando não há conversa trabalhando). Suas conversas e dados não mudam.', null],
		['Mensagens de erro mais claras', 'Se a internet cair, a conta do Claude sair ou o limite de uso acabar, o BDS Jus diz o que aconteceu e o que fazer. Os erros vão para o Rafael (sem nada dos seus casos), para ele corrigir mais rápido.', null],
		['Manutenção pelo Rafael', 'Quando o Rafael precisar ajustar seu BDS Jus, ele mostra o aviso e volta sozinho quando ele terminar.', null],
	] },
	{ versao: '1.0.0-beta.9', itens: [
		['Pesquisar conversas', 'No campo com a lupa, acima da lista: digite o nome do cliente ou da peça. Com Enter, o BDS Jus procura também dentro das conversas e mostra o trecho.', null],
		['Renomear, arquivar e apagar', 'Passe o mouse sobre uma conversa e clique em "⋯" (ou use o botão direito). Arquivadas ficam no fim da lista; apagadas ficam 30 dias na lixeira antes de sair de vez.', null],
		['Ditar a mensagem', 'Clique em "Ditar" no campo de mensagem, fale e clique em "Parar". O áudio é transcrito neste computador e o texto aparece para você conferir antes de enviar.', null],
	] },
	{ versao: '1.0.0-beta.8', itens: [
		['Um escritório para cada uma', 'Agora cada advogada tem o próprio Escritório: casos, tarefas, agenda e cofre só seus. Entre com o seu e-mail e crie a senha do seu escritório. O escritório antigo, que era compartilhado, foi zerado.', 'escritorio'],
	] },
	{ versao: '1.0.0-beta.7', itens: [
		['Mensagem do dia', 'Na primeira abertura do dia: uma frase de quem entende do ofício e o resumo do seu dia (vencidos, prazos, perícias). Dá para desligar nos Ajustes.', 'ajustes'],
		['Dicas de uso', 'Quando houver um jeito mais rápido de fazer algo, o BDS Jus sugere no fim da resposta. No máximo uma por conversa; dá para desligar.', null],
		['Gravar atendimento', 'Na ficha do caso ou em "+ Atendimento": a conversa com o cliente vira resumo no caso e tarefas sugeridas.', 'escritorio'],
		['Sugestões para o Escritório', 'Quando a resposta trouxer prazos ou tarefas, aparece um cartão para você marcar o que entra no Escritório.', null],
		['Sustentação com o caso', 'Escolha o caso no treino: o retorno confere se você cobriu os pontos e faz a pergunta difícil do próprio caso.', 'sustentacao'],
		['Mensagens em sequência', 'O que você manda enquanto o BDS Jus trabalha vai junto, e ele lê tudo antes de agir. "Interromper e mandar agora" para na hora.', null],
	] },
	{ versao: '1.0.0-beta.6', itens: [
		['Janela de tarefa sem barras de rolagem', 'O essencial fica à vista e o resto em "Mais detalhes". Salvar e Cancelar ficam sempre no rodapé.', 'escritorio'],
		['"Abrir o caso" nos avisos', 'Cada intimação abre a ficha do caso pelo número do processo. Se o caso não existir, o BDS Jus oferece criar.', 'quadro'],
		['Motor de escrita explicado', 'Clique em "Sonnet · econômico" no topo para ver as opções. A escolha vale para todas as conversas até você trocar.', 'motor'],
		['Tentar de novo', 'Se uma resposta der erro, o botão "Tentar de novo" reenvia a última mensagem.', null],
		['Conversas muito longas', 'O BDS Jus avisa e oferece continuar num chat novo, já com o resumo do que foi feito.', null],
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
	// Instalação nova: para quem nunca usou nada é novidade. Ela começa pelos Primeiros passos; as novidades ficam
	// em Ajustes › Ver novidades. (Teste de UX, 06/11: eram duas janelas seguidas na primeira abertura.)
	if (!forcar && !vista) { try { localStorage.setItem('novidadesVistas', atual) } catch {} return }
	// Depois: tudo o que veio desde a última vista (forçado sem histórico: só a versão atual).
	const ate = vista ? NOVIDADES.findIndex((n) => n.versao === vista) : 1
	const lista = NOVIDADES.slice(0, ate < 0 ? NOVIDADES.length : Math.max(ate, 1))
	let d = $('#d-novidades')
	if (!d) { d = document.createElement('dialog'); d.id = 'd-novidades'; document.body.append(d) }
	d.innerHTML = `<div class="janela"><h2>Novidades do BDS Jus</h2>
		${lista.map((n) => n.itens.map(([tit, txt, abrir]) => `<div class="novidade"><div><strong>${escapar(tit)}</strong><p>${escapar(txt)}</p></div>${abrir ? `<button class="opcao" data-abrir="${abrir}">Mostrar</button>` : ''}</div>`).join('')).join('')}
		<div class="fim"><button class="opcao principal" data-fechar>Entendi</button></div></div>`
	const fechar = () => { try { localStorage.setItem('novidadesVistas', atual) } catch {} d.close() }
	d.querySelector('[data-fechar]').onclick = fechar
	d.querySelectorAll('[data-abrir]').forEach((b) => (b.onclick = () => {
		fechar()
		;({ escritorio: () => mostrarEscritorio(), quadro: () => mostrarQuadro(), motor: () => $('#pilula-modelo').click(), ajustes: () => $('#abrir-ajustes').click(), sustentacao: () => $('#abrir-sustentacao').click(), radar: () => $('#abrir-radar').click() })[b.dataset.abrir]?.()
	}))
	d.showModal()
}
// Quem chama na abertura do app é abertura.js (depois da mensagem do dia).
