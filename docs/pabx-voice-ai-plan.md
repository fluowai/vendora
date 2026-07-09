# PABX Voice AI Plan

## Objetivo

Permitir que uma chamada WhatsApp seja atendida por IA quando nenhum operador aceitar dentro do tempo limite.

## Implementado nesta etapa

- Evento de chamada recebida preparado para `callerPn`, `pushName` e `avatarUrl`.
- Frontend exibe telefone real quando `callerPn` estiver disponivel, evitando mostrar LID.
- Chamada perdida sem operador cria/atualiza conversa e envia uma mensagem automatica por agente IA ativo quando existir.
- Historico de chamadas exibe o usuario (`ownerName`) que iniciou/atendeu quando o WaCalls recebe `X-Client-Id`.

## Voz IA gratuita/local

Arquitetura recomendada para primeira versao local:

1. Audio da ligacao chega pelo WebRTC/DataChannel do WaCalls.
2. Um worker de voz recebe PCM da chamada.
3. STT local transforma audio em texto.
4. O agente IA atual gera resposta em texto.
5. TTS local gera audio.
6. O audio volta para a chamada pelo mesmo caminho PCM.

Opcoes gratuitas/open-source estudadas:

- STT: `whisper.cpp` ou `Vosk`.
- TTS: `Piper`.
- LLM: manter o provedor atual do agente; para 100% local, usar `llama.cpp`/Ollama depois.

## Recomendacao

Comecar com fallback por mensagem, que ja fica operacional sem mexer no media pipeline. Depois adicionar voz IA em modo beta:

- Fase 1: mensagem automatica em chamada perdida.
- Fase 2: botao "Atender com IA" manual.
- Fase 3: atendimento automatico com timeout.
- Fase 4: fila com operador humano podendo assumir a chamada da IA.

## Pontos tecnicos pendentes

- WaCalls precisa expor ou resolver `pushName` e foto de perfil por JID/telefone.
- O media bridge precisa permitir injetar audio TTS gerado no fluxo da chamada.
- STT/TTS local precisa de binarios/modelos instalados no ambiente.

