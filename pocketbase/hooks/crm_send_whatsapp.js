/// <reference path="../pb_data/types.d.ts" />

/**
 * Route: POST /backend/v1/crm/send-whatsapp
 * Dispara mensagem calorosa personalizada no estilo Disney usando a conta do WhatsApp do usuário/dono.
 * Conector: WHATSAPP_SEND_MESSAGE via $connectors.execute / $connectors.executeAsOwner
 * Caso o conector do WhatsApp não esteja conectado ou ocorra erro retornado pela Meta,
 * responde com sucesso gracioso e expõe os detalhes REAIS da Meta (código + mensagem)
 * para que a UI ofereça o link direto de WhatsApp (wa.me) e mostre o motivo concreto.
 * Também persiste o evento na collection `journey_events` e na collection `activities`.
 */
routerAdd(
  'POST',
  '/backend/v1/crm/send-whatsapp',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação obrigatória.')

      const body = e.requestInfo().body || {}
      const contactId = typeof body.contactId === 'string' ? body.contactId.trim() : ''
      const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
      const messageText = typeof body.message === 'string' ? body.message.trim() : ''
      const momentType =
        typeof body.momentType === 'string' ? body.momentType.trim() : 'personalizado'
      // momentType: 'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado'
      const customTitle = typeof body.title === 'string' ? body.title.trim() : ''

      if (!contactId) return e.badRequestError('contactId é obrigatório.')
      if (!messageText) return e.badRequestError('Mensagem é obrigatória.')

      const contact = $app.findRecordById('contacts', contactId)
      const contactName = contact.getString('name') || 'Cliente'
      const clientPhone = phone || contact.getString('phone') || ''

      // Limpar número de telefone para formato internacional caso necessário
      // (ex.: +5511999999999 ou 5511999999999)
      let cleanedPhone = clientPhone.replace(/\D/g, '')
      if ((cleanedPhone && cleanedPhone.length === 10) || cleanedPhone.length === 11) {
        cleanedPhone = '55' + cleanedPhone
      }

      let whatsappSent = false
      let connectorWarning = null
      let metaErrorDetail = null
      let phoneMissing = false
      let usedPhoneNumberId = ''
      let sendMethod = 'none' // 'api' | 'link' | 'none'

      if (!cleanedPhone) {
        phoneMissing = true
        connectorWarning = 'O cliente não possui telefone cadastrado para disparo.'
      } else {
        try {
          if (typeof $connectors !== 'undefined') {
            // Helper para formatar o erro real retornado pela Meta / Composio
            const formatMetaError = (res, prefix) => {
              if (!res) return null
              const parts = []
              if (res.error) parts.push(String(res.error))
              if (res.data) {
                if (typeof res.data === 'string') {
                  parts.push(res.data)
                } else if (typeof res.data === 'object') {
                  if (res.data.error) {
                    if (typeof res.data.error === 'string') {
                      parts.push(res.data.error)
                    } else if (typeof res.data.error === 'object') {
                      const errObj = res.data.error
                      const code = errObj.code ? `[Código ${errObj.code}]` : ''
                      const subcode = errObj.error_subcode
                        ? ` (subcode ${errObj.error_subcode})`
                        : ''
                      const msg =
                        errObj.message || errObj.error_user_msg || errObj.error_user_title || ''
                      const combined = `${code}${subcode} ${msg}`.trim()
                      if (combined) parts.push(combined)
                    }
                  }
                  if (res.data.message) parts.push(String(res.data.message))
                }
              }
              const raw = parts.filter(Boolean).join(' - ')
              if (!raw) return null
              return prefix ? `${prefix}: ${raw}` : raw
            }

            // Helper para extrair phone_number_id de diferentes formatos de resposta
            const extractPhoneNumberId = (res) => {
              if (!res || !res.successful || !res.data) return null
              const raw = res.data
              let candidateList = []
              if (Array.isArray(raw)) {
                candidateList = raw
              } else if (raw && Array.isArray(raw.data)) {
                candidateList = raw.data
              } else if (raw && Array.isArray(raw.phone_numbers)) {
                candidateList = raw.phone_numbers
              } else if (raw && Array.isArray(raw.phoneNumbers)) {
                candidateList = raw.phoneNumbers
              } else if (raw && typeof raw === 'object') {
                if (raw.id) return String(raw.id)
                if (raw.phone_number_id) return String(raw.phone_number_id)
                if (raw.phoneNumberId) return String(raw.phoneNumberId)
              }

              for (let i = 0; i < candidateList.length; i++) {
                const item = candidateList[i]
                if (item) {
                  const id = item.id || item.phone_number_id || item.phoneNumberId
                  if (id) return String(id)
                }
              }
              return null
            }

            // Helper para extrair waba_id configurado na resposta de detalhes da conta
            const extractConfiguredWabaId = (res) => {
              if (!res || !res.successful || !res.data) return null
              const raw = res.data
              if (typeof raw === 'object' && raw !== null) {
                if (raw.id) return String(raw.id)
                if (raw.waba_id) return String(raw.waba_id)
                if (raw.wabaId) return String(raw.wabaId)
                if (raw.account_id) return String(raw.account_id)
              }
              return null
            }

            // Descobre o phone_number_id para um executor (user ou owner)
            // REGRA: Nunca enviar waba_ids arbitrários nem BM IDs em chamadas à Meta.
            // A conexão WhatsApp da Composio/Skip vincula a conexão a um WABA específico.
            // Deixar a plataforma resolver sem waba_id, ou usar o waba_id retornado pelos detalhes da conta conectada.
            const resolvePhoneForExecutor = (executeFn, label) => {
              let lastErr = null

              // 1. Tentar obter os detalhes da conta da conexão via WHATSAPP_GET_BUSINESS_ACCOUNT_DETAILS({})
              let connectionWabaId = null
              try {
                console.log(
                  `[${label}] Consultando WHATSAPP_GET_BUSINESS_ACCOUNT_DETAILS sem waba_id...`,
                )
                const detailsRes = executeFn('WHATSAPP_GET_BUSINESS_ACCOUNT_DETAILS', {})
                if (detailsRes && detailsRes.successful) {
                  connectionWabaId = extractConfiguredWabaId(detailsRes)
                  console.log(
                    `[${label}] WABA ID obtido dos detalhes da conta conectada:`,
                    connectionWabaId,
                  )
                } else {
                  console.log(
                    `[${label}] WHATSAPP_GET_BUSINESS_ACCOUNT_DETAILS retorno:`,
                    formatMetaError(detailsRes),
                  )
                }
              } catch (dErr) {
                console.log(
                  `[${label}] Exceção em WHATSAPP_GET_BUSINESS_ACCOUNT_DETAILS:`,
                  dErr.message,
                )
              }

              // 2. Se obteve o connectionWabaId legítimo da conexão, tentar listar números com ele
              if (connectionWabaId) {
                try {
                  console.log(
                    `[${label}] Tentando WHATSAPP_GET_PHONE_NUMBERS com connectionWabaId ${connectionWabaId}...`,
                  )
                  const wabaNumRes = executeFn('WHATSAPP_GET_PHONE_NUMBERS', {
                    waba_id: connectionWabaId,
                  })
                  const phoneId = extractPhoneNumberId(wabaNumRes)
                  if (phoneId) {
                    console.log(
                      `[${label}] phone_number_id encontrado com connectionWabaId ${connectionWabaId}: ${phoneId}`,
                    )
                    return { phoneId, wabaId: connectionWabaId, error: null }
                  }
                  const formatted = formatMetaError(wabaNumRes, `WABA ${connectionWabaId}`)
                  if (formatted) lastErr = formatted
                } catch (wErr) {
                  lastErr = wErr.message
                  console.log(
                    `[${label}] Exceção em WHATSAPP_GET_PHONE_NUMBERS com connectionWabaId:`,
                    wErr.message,
                  )
                }
              }

              // 3. Tentar WHATSAPP_GET_PHONE_NUMBERS({}) sem waba_id (a plataforma usa o WABA da conexão)
              try {
                console.log(`[${label}] Tentando WHATSAPP_GET_PHONE_NUMBERS sem waba_id...`)
                const res = executeFn('WHATSAPP_GET_PHONE_NUMBERS', {})
                const phoneId = extractPhoneNumberId(res)
                if (phoneId) {
                  console.log(
                    `[${label}] phone_number_id encontrado diretamente sem waba_id: ${phoneId}`,
                  )
                  return { phoneId, wabaId: connectionWabaId, error: null }
                }
                const formatted = formatMetaError(res, 'WHATSAPP_GET_PHONE_NUMBERS')
                if (formatted) lastErr = formatted
                console.log(
                  `[${label}] Retorno sem phone_number_id:`,
                  formatted || JSON.stringify(res),
                )
              } catch (err) {
                lastErr = err.message
                console.log(`[${label}] Exceção em WHATSAPP_GET_PHONE_NUMBERS:`, err.message)
              }

              return { phoneId: null, wabaId: connectionWabaId, error: lastErr }
            }

            let resolvedPhoneId = null
            let resolvedWabaId = null
            let authMode = null
            let discoveryError = null

            // Prioridade: Tentar como usuário logado ($connectors.execute(e.auth))
            if (typeof $connectors.execute === 'function' && e.auth) {
              const userExec = (tool, args) => $connectors.execute(e.auth, tool, args)
              const userRes = resolvePhoneForExecutor(userExec, 'user')
              if (userRes.phoneId) {
                resolvedPhoneId = userRes.phoneId
                resolvedWabaId = userRes.wabaId
                authMode = 'user'
              } else if (userRes.error) {
                discoveryError = userRes.error
              }
            }

            // Fallback: Tentar como proprietário ($connectors.executeAsOwner) se disponível
            if (!resolvedPhoneId && typeof $connectors.executeAsOwner === 'function') {
              try {
                const ownerExec = (tool, args) => $connectors.executeAsOwner(tool, args)
                const ownerRes = resolvePhoneForExecutor(ownerExec, 'owner')
                if (ownerRes.phoneId) {
                  resolvedPhoneId = ownerRes.phoneId
                  resolvedWabaId = ownerRes.wabaId
                  authMode = 'owner'
                } else if (ownerRes.error && !discoveryError) {
                  discoveryError = ownerRes.error
                }
              } catch (oErr) {
                console.log('[owner] Exceção ao executar como owner:', oErr.message)
              }
            }

            if (!resolvedPhoneId) {
              const metaDetail = discoveryError
                ? ` Detalhe retornado pela Meta: ${discoveryError}`
                : ''
              connectorWarning = `Nenhum número de WhatsApp Business ativo foi localizado na conta conectada.${metaDetail}`
              metaErrorDetail = discoveryError
              console.log('Aviso final de descoberta de número:', connectorWarning)
            } else {
              usedPhoneNumberId = resolvedPhoneId
              let sendResult = null

              const sendParams = {
                to_number: cleanedPhone,
                text: messageText,
                phone_number_id: resolvedPhoneId,
              }

              if (authMode === 'user' && typeof $connectors.execute === 'function' && e.auth) {
                try {
                  console.log(
                    `[user] Enviando WHATSAPP_SEND_MESSAGE para ${cleanedPhone} via phone_number_id ${resolvedPhoneId}...`,
                  )
                  sendResult = $connectors.execute(e.auth, 'WHATSAPP_SEND_MESSAGE', sendParams)
                } catch (uSendErr) {
                  console.log('Exceção ao disparar WHATSAPP_SEND_MESSAGE (user):', uSendErr.message)
                }
              } else if (authMode === 'owner' && typeof $connectors.executeAsOwner === 'function') {
                try {
                  console.log(
                    `[owner] Enviando WHATSAPP_SEND_MESSAGE para ${cleanedPhone} via phone_number_id ${resolvedPhoneId}...`,
                  )
                  sendResult = $connectors.executeAsOwner('WHATSAPP_SEND_MESSAGE', sendParams)
                } catch (oSendErr) {
                  console.log(
                    'Exceção ao disparar WHATSAPP_SEND_MESSAGE (owner):',
                    oSendErr.message,
                  )
                }
              }

              // Fallback se primário falhou (apenas se o modo alternativo tiver o mesmo phone_number_id válido)
              if (!sendResult || !sendResult.successful) {
                if (authMode !== 'user' && typeof $connectors.execute === 'function' && e.auth) {
                  try {
                    console.log('[fallback user] Tentando WHATSAPP_SEND_MESSAGE...')
                    sendResult = $connectors.execute(e.auth, 'WHATSAPP_SEND_MESSAGE', sendParams)
                  } catch (uFallbackErr) {
                    console.log('Fallback user falhou:', uFallbackErr.message)
                  }
                }
              }

              if (sendResult && sendResult.successful) {
                whatsappSent = true
                sendMethod = 'api'
              } else {
                const formattedSendErr = formatMetaError(sendResult, 'Meta Cloud API')
                connectorWarning = formattedSendErr || 'Falha no envio via WhatsApp Cloud API.'
                metaErrorDetail = formattedSendErr
                console.log('Resultado do envio WHATSAPP_SEND_MESSAGE:', JSON.stringify(sendResult))
              }
            }
          } else {
            connectorWarning = 'Conector de WhatsApp não disponível no servidor.'
          }
        } catch (connErr) {
          connectorWarning = connErr.message || 'Erro ao processar envio pelo conector de WhatsApp.'
          metaErrorDetail = connErr.message
          console.log('Erro ao executar WhatsApp via conector:', connErr.message)
        }
      }

      // Se a API não enviou com sucesso, definimos o canal / método de entrega para wa.me fallback
      if (!whatsappSent && cleanedPhone) {
        sendMethod = 'link'
      }

      // Preparar título do evento para a Linha do Tempo Disney
      let eventTitle = customTitle
      if (!eventTitle) {
        if (momentType === 'aniversario') eventTitle = '🎉 Mensagem Disney de Aniversário'
        else if (momentType === 'recorrencia')
          eventTitle = '☕ Mensagem Disney de Saudade / Reengajamento'
        else if (momentType === 'nivel_fidelidade')
          eventTitle = '⭐ Parabéns por Novo Nível de Fidelidade'
        else eventTitle = '💬 Mensagem de Encantamento WhatsApp'
      }

      const fullEventTitle = whatsappSent
        ? `${eventTitle} (Enviada via WhatsApp API)`
        : `${eventTitle} (Pendente de envio manual / wa.me)`

      // Resumir a mensagem de erro para o evento da jornada
      const cleanWarning = connectorWarning
        ? connectorWarning.replace(/^WhatsApp API error \(HTTP \d+\):\s*/i, '').trim()
        : null

      const eventDescription = whatsappSent
        ? `Mensagem disparada com sucesso via WhatsApp oficial (Número ID: ${usedPhoneNumberId || 'padrão'}).\n\n"${messageText}"`
        : `Falha no envio automático via API (${cleanWarning || 'Verificação necessária'}). Disponível para envio com um clique pelo link direto do WhatsApp Web.\n\n"${messageText}"`

      // 1. Gravar na collection journey_events
      let journeyEventId = ''
      try {
        const journeyEventsCol = $app.findCollectionByNameOrId('journey_events')
        const jRec = new Record(journeyEventsCol)
        jRec.set('contact', contactId)
        jRec.set('owner', userId)
        jRec.set('type', whatsappSent ? 'whatsapp_enviado' : 'whatsapp_falha')
        jRec.set('title', fullEventTitle)
        jRec.set('description', eventDescription)
        jRec.set('channel', 'whatsapp')
        jRec.set(
          'metadata',
          JSON.stringify({
            momentType,
            phone: cleanedPhone,
            whatsappSent,
            sendMethod,
            usedPhoneNumberId: usedPhoneNumberId || null,
            warning: cleanWarning,
            metaErrorDetail: metaErrorDetail || null,
          }),
        )
        $app.save(jRec)
        journeyEventId = jRec.id
      } catch (jErr) {
        console.log('Aviso ao registrar journey_event:', jErr.message)
      }

      // 2. Gravar no histórico de activities para compatibilidade com visão clássica
      try {
        const activitiesCol = $app.findCollectionByNameOrId('activities')
        const act = new Record(activitiesCol)
        act.set('type', 'sistema')
        act.set(
          'content',
          `📱 WhatsApp [${momentType.toUpperCase()}]: ${eventTitle} para ${contactName} (${cleanedPhone || 'sem telefone'})\nStatus: ${whatsappSent ? `Enviado com sucesso via WhatsApp API (ID: ${usedPhoneNumberId})` : `Pendente/Pronto para envio manual via WhatsApp Web (${cleanWarning || 'Link gerado'})`}\nMensagem:\n${messageText}`,
        )
        act.set('contact', contactId)
        act.set('author', userId)
        $app.save(act)
      } catch (actErr) {
        console.log('Aviso ao registrar activity:', actErr.message)
      }

      // Se foi mensagem de reengajamento e foi realmente enviada com sucesso pela API
      if (momentType === 'recorrencia' && whatsappSent) {
        try {
          contact.set('last_reengagement_date', new Date().toISOString())
          $app.save(contact)
        } catch (_) {}
      }

      // Gerar link seguro para fallback via wa.me (para abrir no WhatsApp Web/app com 1 clique)
      const encodedMsg = encodeURIComponent(messageText)
      const waFallbackUrl = cleanedPhone ? `https://wa.me/${cleanedPhone}?text=${encodedMsg}` : null

      return e.json(200, {
        success: true,
        whatsappSent,
        phoneMissing,
        sendMethod, // 'api' | 'link' | 'none'
        usedPhoneNumberId: usedPhoneNumberId || null,
        warning: cleanWarning,
        metaErrorDetail: metaErrorDetail || null,
        journeyEventId,
        cleanedPhone,
        waFallbackUrl,
        message: messageText,
      })
    } catch (err) {
      console.log('Erro geral no hook crm_send_whatsapp:', err.message)
      return e.json(500, {
        success: false,
        error: err.message || 'Falha ao processar mensagem do WhatsApp.',
      })
    }
  },
  $apis.requireAuth(),
)
