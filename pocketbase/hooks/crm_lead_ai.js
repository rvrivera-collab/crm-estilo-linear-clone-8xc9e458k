routerAdd(
  'POST',
  '/backend/v1/crm/lead-ai',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação obrigatória.')

      const reqBody = e.requestInfo().body || {}
      const dealId = typeof reqBody.dealId === 'string' ? reqBody.dealId.trim() : ''
      const action = typeof reqBody.action === 'string' ? reqBody.action.trim() : ''

      if (!dealId) return e.badRequestError('dealId é obrigatório.')
      if (!['summary', 'next_step', 'classify_temperature', 'draft_followup'].includes(action)) {
        return e.badRequestError(
          'Ação inválida. Ações permitidas: summary, next_step, classify_temperature, draft_followup.',
        )
      }

      // Load deal and its relations
      const deal = $app.findRecordById('deals', dealId)
      let contactName = 'Lead'
      let contactCompany = ''
      let contactEmail = ''
      let contactNotes = ''
      const contactId = deal.getString('contact')
      if (contactId) {
        try {
          const contact = $app.findRecordById('contacts', contactId)
          contactName = contact.getString('name')
          contactCompany = contact.getString('company')
          contactEmail = contact.getString('email')
          contactNotes = contact.getString('notes')
        } catch (_) {}
      }

      let stageName = 'Prospecção'
      const stageId = deal.getString('stage')
      if (stageId) {
        try {
          const stage = $app.findRecordById('pipeline_stages', stageId)
          stageName = stage.getString('name')
        } catch (_) {}
      }

      // Load recent activities
      const acts = $app.findRecordsByFilter('activities', `deal = "${dealId}"`, '-created', 8, 0)
      let actsContext = acts
        .map(
          (a) => `[${a.getString('type')} em ${a.getString('created')}]: ${a.getString('content')}`,
        )
        .join('\n')
      if (!actsContext) actsContext = 'Nenhuma atividade anterior registrada.'

      const daysSinceCreated = Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(deal.getString('created')).getTime()) / (1000 * 60 * 60 * 24),
        ),
      )
      const lastContactDateStr = deal.getString('last_contact_at') || deal.getString('created')
      const daysSinceContact = Math.max(
        0,
        Math.floor((Date.now() - new Date(lastContactDateStr).getTime()) / (1000 * 60 * 60 * 24)),
      )

      const dealInfo = `
NEGÓCIO:
- Código: ${deal.getString('code')}
- Título: ${deal.getString('title')}
- Valor: R$ ${deal.getInt('value')}
- Estágio atual: ${stageName}
- Status: ${deal.getString('status')}
- Temperatura atual cadastrada: ${deal.getString('temperature') || 'não definida'}
- Dias no CRM: ${daysSinceCreated} dias
- Dias sem contato/follow-up: ${daysSinceContact} dias
- Contato: ${contactName} (${contactEmail}) - Empresa: ${contactCompany}
- Observações do contato: ${contactNotes}

HISTÓRICO RECENTE DE INTERAÇÕES:
${actsContext}
`

      if (action === 'summary') {
        const reply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é um assistente de CRM executivo estilo Linear. Resuma o lead de forma direta, concisa e orientada a vendas em até 3 frases. Destaque o momento do lead, dores ou interesse demonstrado e tempo parado.',
            },
            {
              role: 'user',
              content: `Elabore um resumo conciso para este lead:\n${dealInfo}`,
            },
          ],
        })
        const text = reply.choices[0].message.content.trim()
        return e.json(200, { summary: text })
      }

      if (action === 'next_step') {
        const reply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é um especialista em vendas B2B e recuperação de leads. Sugira a próxima ação recomendada específica e pragmática (1 a 2 frases) para este lead não esfriar ou avançar de estágio.',
            },
            {
              role: 'user',
              content: `Qual deve ser o próximo passo para este lead?\n${dealInfo}`,
            },
          ],
        })
        const text = reply.choices[0].message.content.trim()
        return e.json(200, { nextStep: text })
      }

      if (action === 'classify_temperature') {
        const reply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você avalia a temperatura de oportunidades comerciais. Classifique o lead em exatamente UMA das três opções: "quente", "morno" ou "frio".\nCritérios:\n- "quente": contato recente (<3 dias), interesse ativo, proposta em análise, decisor engajado.\n- "morno": contato entre 4 e 7 dias, ou aguardando resposta sem objeção dura.\n- "frio": sem contato há 8+ dias, lead esfriando, sem resposta reiterada ou perdido.\nResponda em formato JSON com: {"temperature": "quente"|"morno"|"frio", "justification": "explicação curta em 1 frase"}.',
            },
            {
              role: 'user',
              content: `Classifique a temperatura deste lead:\n${dealInfo}`,
            },
          ],
        })

        const raw = reply.choices[0].message.content.trim()
        let resultTemp = 'morno'
        let justification = 'Classificado pela IA com base nas interações recentes.'

        try {
          const parsed = JSON.parse(
            raw
              .replace(/^```json/, '')
              .replace(/```$/, '')
              .trim(),
          )
          if (['quente', 'morno', 'frio'].includes(parsed.temperature)) {
            resultTemp = parsed.temperature
          }
          if (parsed.justification) justification = parsed.justification
        } catch (_) {
          const lower = raw.toLowerCase()
          if (lower.includes('frio')) resultTemp = 'frio'
          else if (lower.includes('quente')) resultTemp = 'quente'
          else resultTemp = 'morno'
          justification = raw
        }

        // Persist on deal
        deal.set('temperature', resultTemp)
        $app.save(deal)

        // Record activity of AI classification
        try {
          const actCol = $app.findCollectionByNameOrId('activities')
          const act = new Record(actCol)
          act.set('type', 'sistema')
          act.set(
            'content',
            `Temperatura atualizada para "${resultTemp.toUpperCase()}" via IA. Motivo: ${justification}`,
          )
          act.set('deal', deal.id)
          if (contactId) act.set('contact', contactId)
          act.set('author', userId)
          $app.save(act)
        } catch (_) {}

        return e.json(200, {
          temperature: resultTemp,
          justification: justification,
        })
      }

      if (action === 'draft_followup') {
        const reply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é um redator de vendas hiper-contextualizado e elegante (estilo Linear/SaaS moderno). Redija um e-mail de follow-up curto, educado e com gancho irresistível, adaptado exatamente ao contexto das interações e da empresa do lead. O tom deve ser profissional porém humano, sem clichês de spam.\nRetorne estritamente um JSON no formato: {"subject": "Assunto do e-mail", "body": "Texto completo do e-mail com quebras de linha"}',
            },
            {
              role: 'user',
              content: `Redija o e-mail de follow-up ideal para este lead:\n${dealInfo}`,
            },
          ],
        })

        const raw = reply.choices[0].message.content.trim()
        let subject = `Acompanhamento — ${contactCompany || deal.getString('title')}`
        let body = `Olá, ${contactName}!\n\nPassando para acompanhar nosso contato recente sobre ${deal.getString('title')}.\n\nComo estão as prioridades por aí esta semana?\n\nAbraços,`

        try {
          const parsed = JSON.parse(
            raw
              .replace(/^```json/, '')
              .replace(/```$/, '')
              .trim(),
          )
          if (parsed.subject) subject = parsed.subject
          if (parsed.body) body = parsed.body
        } catch (_) {
          body = raw
        }

        return e.json(200, {
          subject,
          body,
        })
      }

      return e.badRequestError('Ação desconhecida.')
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível.' })
      }
      return e.json(500, { error: err.message || 'Erro ao processar IA do lead.' })
    }
  },
  $apis.requireAuth(),
)
