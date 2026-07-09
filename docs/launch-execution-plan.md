# Plano de execucao para lancamento

## Posicionamento recomendado

Lancar como uma plataforma de atendimento omnicanal com agentes de IA, CRM, WhatsApp e chamadas em beta. A promessa publica deve ser forte, mas controlada:

- Produto principal: inbox, IA, CRM, automacoes, WhatsApp e gestao de atendimento.
- Beta controlado: chamadas WhatsApp, PABX, discadora e voz IA.
- Roadmap comercial: gateway VOIP/SIP com Telnyx, Twilio ou Asterisk depois da estabilizacao do core.

## Estado atual confirmado

- Typecheck passa com `npm run lint`.
- Build de producao passa com `npm run build`.
- Testes passam com `npm.cmd run test`.
- Ja existem Socket.IO, BullMQ, rotas de chamadas, PABX, campanhas de discagem e agentes de IA.
- A base de voz agora tem uma interface `VoiceGateway` em `server/lib/voice-gateway.ts`, mantendo WaCalls como gateway inicial.

## Fase 1 - Lancamento controlado

Objetivo: vender e operar o atendimento texto/IA com seguranca.

Prioridade maxima:

- Revisar RBAC em todas as rotas sensiveis.
- Fechar fluxo de inbox: meus atendimentos, nao atribuidos, aguardando humano, encerrados.
- Garantir handoff humano da IA com status, responsavel e departamento.
- Criar checklist de setup por tenant: canal, agentes, equipe, permissoes e base de conhecimento.
- Conferir migracoes Prisma em ambiente limpo.
- Executar teste manual completo: login, conectar canal, receber mensagem, IA responder, humano assumir, encerrar.

Criterio de pronto:

- Um cliente piloto consegue operar atendimento diario sem acesso indevido entre usuarios.
- Uma falha de LLM ou canal nao derruba a conversa.
- O time consegue auditar quem fez o que.

## Fase 2 - Voz WhatsApp beta

Objetivo: transformar chamadas WhatsApp em recurso demonstravel, nao em dependencia critica.

Prioridade maxima:

- Sessao WaCalls por tenant ou por instancia de canal.
- Chamada recebida cria evento global e registro historico confiavel.
- Chamada perdida cria ou atualiza conversa.
- Operador consegue aceitar, rejeitar e encerrar chamada.
- Historico mostra responsavel, numero, duracao e status.
- Registrar limitacoes conhecidas do WaCalls na tela/admin.

Criterio de pronto:

- Chamadas funcionam em ambiente piloto com um numero real.
- Quando falha, o atendimento cai para conversa/mensagem sem travar operador.

## Fase 3 - Discadora segura

Objetivo: liberar discadora em modo preview/progressive antes de qualquer preditivo agressivo.

Prioridade maxima:

- Validar mailing e deduplicar telefones.
- Limitar chamadas por minuto, horario e tenant.
- Registrar tentativa, resultado, duracao, erro e gravacao quando houver.
- Pausar campanha automaticamente fora do horario.
- Adicionar opt-out/DNC antes de campanhas reais.
- Dashboard por campanha: total, chamados, atendidos, falhas e taxa de sucesso.

Criterio de pronto:

- Campanha pode ser pausada sem perda de estado.
- Reprocessamento nao duplica contatos indevidamente.
- Relatorios batem com o historico de tentativas.

## Fase 4 - Gateway VOIP/SIP

Objetivo: adicionar telefonia comercial sem reescrever chamadas.

Arquitetura:

- Manter `VoiceGateway` como contrato unico.
- Implementar `TelnyxGateway` para chamadas PSTN e media streaming.
- Implementar `TwilioGateway` para SIP trunking/Voice API quando a prioridade for estabilidade gerenciada.
- Avaliar `AsteriskGateway` quando o produto exigir PABX proprio, ramais SIP e controle total de URA/fila.

Contrato minimo por provedor:

- iniciar chamada;
- aceitar chamada;
- encerrar chamada;
- transferir chamada;
- iniciar/parar gravacao;
- emitir eventos normalizados;
- enviar/receber audio para IA quando suportado.

Criterio de pronto:

- O frontend nao precisa saber se a chamada vem de WhatsApp, Telnyx, Twilio ou Asterisk.
- Eventos de chamada entram no mesmo historico e nos mesmos relatorios.

## Fase 5 - Voz IA

Objetivo: atender chamadas com IA sem prometer autonomia total cedo demais.

Ordem recomendada:

1. Resposta automatica por mensagem quando chamada for perdida.
2. Botao "Atender com IA" iniciado por humano.
3. IA atende apos timeout configuravel.
4. Humano assume chamada da IA.
5. Relatorio com transcricao, resumo, motivo e resultado.

Stack possivel:

- STT local: Whisper.cpp ou Vosk.
- TTS local: Piper.
- Provedor gerenciado: Telnyx media streaming + LLM atual.
- LLM local futuro: Ollama/llama.cpp.

## Bloqueadores antes de venda ampla

- Termos de uso e consentimento de gravacao.
- Politica de opt-out para campanhas.
- Backup e restore testado.
- Observabilidade: logs por tenant, metricas de fila, falha de canal e custo de LLM.
- Limites por plano: usuarios, canais, agentes, mensagens, chamadas e campanhas.
- Processo de onboarding documentado para suporte interno.
