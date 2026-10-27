routerAdd(
  'POST',
  '/backend/v1/ask/chat',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação obrigatória.')
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (!message) return e.badRequestError('A mensagem é obrigatória.')

      const agent = $ai.agent('crm-copilot')
      const conv = agent.getOrCreateConversation({
        user_id: userId,
        id: body.conversationId || null,
        title: message.length > 54 ? message.slice(0, 51) + '...' : message,
      })

      let crmConversation
      try {
        crmConversation = $app.findRecordById('ask_conversations', conv.id)
      } catch (_) {
        crmConversation = new Record($app.findCollectionByNameOrId('ask_conversations'))
        crmConversation.set('id', conv.id)
        crmConversation.set('title', message.length > 54 ? message.slice(0, 51) + '...' : message)
        crmConversation.set('user', userId)
        $app.save(crmConversation)
      }

      const messageCollection = $app.findCollectionByNameOrId('ask_messages')
      const userMessage = new Record(messageCollection)
      userMessage.set('conversation', crmConversation.id)
      userMessage.set('role', 'user')
      userMessage.set('content', message)
      $app.save(userMessage)

      const result = agent.chat({
        user_id: userId,
        conversation_id: conv.id,
        message,
      })
      const content = result.content || 'O agente concluiu sem retornar texto.'

      const assistantMessage = new Record(messageCollection)
      assistantMessage.set('conversation', crmConversation.id)
      assistantMessage.set('role', 'assistant')
      assistantMessage.set('content', content)
      $app.save(assistantMessage)

      return e.json(200, {
        conversation_id: result.conversation_id || conv.id,
        message_id: result.message_id,
        content,
        citations: result.citations,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError)
        return e.json(503, { error: 'Agente temporariamente indisponível.' })
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha ao consultar o agente.' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'Agente temporariamente indisponível.' : err.message,
        })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)
