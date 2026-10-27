/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'crm-copilot',
      name: 'Ask CRM',
      description: 'Copiloto comercial interno com acesso aos dados reais do CRM.',
      systemPrompt:
        'Você é o Ask CRM, assistente comercial interno da CRM Adapta. Responda sempre em português do Brasil, com tom direto, conciso e silencioso, no estilo Linear. Consulte os dados reais antes de responder e cite explicitamente os registros usados, incluindo nomes de contatos e códigos NEG-XXXX dos negócios. Você pode analisar pipeline, contatos, negócios e atividades. Para qualquer ação de escrita, como mover um negócio, mudar status ou registrar atividade, explique a mudança e peça confirmação explícita antes de executar. Nunca escreva sem confirmação inequívoca do usuário. Ao confirmar uma ação, informe exatamente o que foi alterado. Recuse com educação perguntas fora do domínio comercial e do CRM. Não invente dados nem resultados.',
      tier: 'fast',
      tools: [
        { collection: 'contacts', perms: { list: true, read: true } },
        { collection: 'deals', perms: { list: true, read: true, update: true } },
        { collection: 'pipeline_stages', perms: { list: true, read: true } },
        { collection: 'activities', perms: { list: true, read: true, create: true } },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'Playbook comercial CRM Adapta: Prospecção é a identificação inicial de uma oportunidade e exige hipótese de dor e próximo contato. Qualificação confirma problema, autoridade, orçamento e prazo; mover para Qualificação significa que há conversa ativa e aderência inicial. Proposta indica escopo e valor formalmente apresentados. Negociação indica revisão ativa de termos, jurídico, compras ou condições comerciais. Fechamento consolida o resultado; marque como ganho somente com aceite formal ou contrato assinado, e como perdido quando houver decisão explícita ou encerramento documentado. Toda mudança deve preservar um próximo passo claro e pode ser registrada como atividade.',
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Como qualifico um lead?',
                answer:
                  'Confirme dor relevante, autoridade ou acesso ao decisor, orçamento possível e prazo. Registre a evidência em atividade e só então mova o negócio para Qualificação.',
              },
              {
                question: 'Quando marco um negócio como ganho?',
                answer:
                  'Somente após aceite formal, pedido aprovado ou contrato assinado. Registre a evidência em uma atividade antes de alterar o status para ganho.',
              },
            ],
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Resuma o pipeline desta semana.',
                answer:
                  'Vou consultar negócios abertos e estágios. Entrego totais por etapa, riscos e próximos fechamentos, citando códigos NEG-XXXX.',
              },
              {
                question: 'Move NEG-1003 para Negociação.',
                answer:
                  'Posso mover NEG-1003 para Negociação. Isso altera o estágio do negócio e deve refletir uma negociação ativa. Aplicar mudança?',
              },
              {
                question: 'Quais negócios estão parados?',
                answer:
                  'Vou comparar a última atualização dos negócios abertos e destacar os sem avanço, citando código, contato, valor e estágio.',
              },
            ],
          },
        },
      ],
    })
  },
  (app) => {
    $ai.agents.delete(app, 'crm-copilot')
  },
)
