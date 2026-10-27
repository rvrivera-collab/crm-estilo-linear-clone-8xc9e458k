/// <reference path="../pb_data/types.d.ts" />

/**
 * Route: POST /backend/v1/crm/send-whatsapp
 * Dispara mensagem calorosa personalizada no estilo Disney usando a conta do WhatsApp do dono.
 * Conector: WHATSAPP_SEND_MESSAGE via $connectors.executeAsOwner
 * Caso o conector do WhatsApp não esteja conectado no Conectores do dono ou ocorra erro,
 * responde com sucesso gracioso (warning informativo) para que a UI ofereça o link direto de WhatsApp / cópia do texto sem erro técnico bruto.
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
      let phoneMissing = false
      let usedPhoneNumberId = ''
      let sendMethod = 'none' // 'api' | 'link' | 'none'

      if (!cleanedPhone) {
        phoneMissing = true
        connectorWarning = 'O cliente não possui telefone cadastrado para disparo.'
      } else {
        // Tentar enviar via WhatsApp Cloud API
        // Primeiro tenta com a conta conectada do usuário logado ($connectors.execute(e.auth))
        // Depois, se disponível e habilitado, tenta com a conta do proprietário ($connectors.executeAsOwner)
        try {
          if (typeof $connectors !== 'undefined') {
            // Helper para extrair o phone_number_id de diferentes formatos de resposta do WHATSAPP_GET_PHONE_NUMBERS
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

            // 1. Tentar resolver phone_number_id com a conta do usuário logado
            let resolvedPhoneId = null
            let authMode = null

            if (typeof $connectors.execute === 'function' && e.auth) {
              try {
                const userNumbersRes = $connectors.execute(e.auth, 'WHATSAPP_GET_PHONE_NUMBERS', {})
                resolvedPhoneId = extractPhoneNumberId(userNumbersRes)
                if (resolvedPhoneId) {
                  authMode = 'user'
                } else if (userNumbersRes && !userNumbersRes.successful) {
                  console.log(
                    'WHATSAPP_GET_PHONE_NUMBERS via conta de usuário falhou:',
                    userNumbersRes.error || JSON.stringify(userNumbersRes),
                  )
                }
              } catch (userNumErr) {
                console.log(
                  'Erro ao obter phone_number_id via conta de usuário:',
                  userNumErr.message,
                )
              }
            }

            // 2. Fallback: se não resolveu com o usuário, tentar como owner
            if (!resolvedPhoneId && typeof $connectors.executeAsOwner === 'function') {
              try {
                const ownerNumbersRes = $connectors.executeAsOwner('WHATSAPP_GET_PHONE_NUMBERS', {})
                resolvedPhoneId = extractPhoneNumberId(ownerNumbersRes)
                if (resolvedPhoneId) {
                  authMode = 'owner'
                } else if (ownerNumbersRes && !ownerNumbersRes.successful) {
                  console.log(
                    'WHATSAPP_GET_PHONE_NUMBERS via conta do dono falhou:',
                    ownerNumbersRes.error || JSON.stringify(ownerNumbersRes),
                  )
                }
              } catch (ownerNumErr) {
                console.log('Erro ao obter phone_number_id via conta do dono:', ownerNumErr.message)
              }
            }

            // Se não encontrou nenhum phone_number_id real, NÃO enviar com 'default' nem id inválido,
            // pois a Graph API rejeita com HTTP 400 "Object with ID 'default' does not exist".
            if (!resolvedPhoneId) {
              connectorWarning =
                'Nenhum número de WhatsApp Business ativo foi encontrado na conta conectada. Verifique se sua conta do WhatsApp Business possui um número verificado ou use o link direto wa.me.'
              console.log('Aviso: nenhum phone_number_id retornado por WHATSAPP_GET_PHONE_NUMBERS.')
            } else {
              usedPhoneNumberId = resolvedPhoneId
              let sendResult = null

              // Disparo com a conta resolvida
              if (authMode === 'user' && typeof $connectors.execute === 'function' && e.auth) {
                try {
                  sendResult = $connectors.execute(e.auth, 'WHATSAPP_SEND_MESSAGE', {
                    to_number: cleanedPhone,
                    text: messageText,
                    phone_number_id: resolvedPhoneId,
                  })
                } catch (uSendErr) {
                  console.log('Exceção ao disparar WHATSAPP_SEND_MESSAGE (user):', uSendErr.message)
                }
              }

              // Se não enviou ou falhou e temos executeAsOwner como alternativa
              if (
                (!sendResult || !sendResult.successful) &&
                typeof $connectors.executeAsOwner === 'function' &&
                authMode !== 'user'
              ) {
                try {
                  sendResult = $connectors.executeAsOwner('WHATSAPP_SEND_MESSAGE', {
                    to_number: cleanedPhone,
                    text: messageText,
                    phone_number_id: resolvedPhoneId,
                  })
                } catch (oSendErr) {
                  console.log(
                    'Exceção ao disparar WHATSAPP_SEND_MESSAGE (owner):',
                    oSendErr.message,
                  )
                }
              }

              if (sendResult && sendResult.successful) {
                whatsappSent = true
                sendMethod = 'api'
              } else {
                const rawError =
                  sendResult?.error ||
                  (sendResult?.data && (sendResult.data.message || sendResult.data.error)) ||
                  'Falha no envio via WhatsApp Cloud API.'
                connectorWarning = String(rawError)
                console.log('execute WHATSAPP_SEND_MESSAGE result:', JSON.stringify(sendResult))
              }
            }
          } else {
            connectorWarning = 'Conector de WhatsApp não disponível no servidor.'
          }
        } catch (connErr) {
          connectorWarning = connErr.message || 'Erro ao processar envio pelo conector de WhatsApp.'
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

      // Resumir a mensagem de erro para não poluir
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
