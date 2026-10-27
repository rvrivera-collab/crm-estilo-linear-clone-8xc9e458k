routerAdd(
  'POST',
  '/backend/v1/crm/send-email',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação obrigatória.')

      const body = e.requestInfo().body || {}
      const to = typeof body.to === 'string' ? body.to.trim() : ''
      const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
      const htmlOrText = typeof body.body === 'string' ? body.body.trim() : ''
      const dealId = typeof body.dealId === 'string' ? body.dealId.trim() : ''
      const contactId = typeof body.contactId === 'string' ? body.contactId.trim() : ''

      if (!to || !to.includes('@'))
        return e.badRequestError('E-mail destinatário é obrigatório e deve ser válido.')
      if (!subject) return e.badRequestError('Assunto é obrigatório.')
      if (!htmlOrText) return e.badRequestError('O corpo do e-mail é obrigatório.')

      // Prepare sender from PB settings or logged-in user
      const currentUser = $app.findRecordById('users', userId)
      const senderName =
        currentUser.getString('name') || $app.settings().meta.senderName || 'CRM Adapta'
      const senderAddress = $app.settings().meta.senderAddress || 'no-reply@goskip.dev'

      // Convert plain text breaks to html
      const formattedHtml = htmlOrText.replace(/\n/g, '<br/>')

      // Send email via native PocketBase mail client
      let emailSent = false
      let sendErrorMsg = ''
      try {
        const message = new MailerMessage({
          from: {
            address: senderAddress,
            name: senderName,
          },
          to: [{ address: to }],
          subject: subject,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1c1e;">${formattedHtml}</div>`,
        })
        $app.newMailClient().send(message)
        emailSent = true
      } catch (mailErr) {
        sendErrorMsg = mailErr.message || 'Falha ao enviar e-mail nativo'
        console.log('crm/send-email native mail error:', sendErrorMsg)
      }

      // Record activity regardless, logging the send and subject
      const activitiesCol = $app.findCollectionByNameOrId('activities')
      const act = new Record(activitiesCol)
      act.set('type', 'email')
      act.set('content', `E-mail enviado para ${to}\nAssunto: ${subject}\n\n${htmlOrText}`)
      if (contactId) act.set('contact', contactId)
      if (dealId) act.set('deal', dealId)
      act.set('author', userId)
      $app.save(act)

      // Update deal's last_contact_at and reset cooling
      if (dealId) {
        try {
          const deal = $app.findRecordById('deals', dealId)
          deal.set('last_contact_at', new Date().toISOString())
          // If deal was cold, update to warm after email is dispatched
          if (deal.getString('temperature') === 'frio') {
            deal.set('temperature', 'morno')
          }
          $app.save(deal)
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        emailSent: emailSent,
        warning: emailSent ? null : sendErrorMsg,
        activityId: act.id,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Falha ao processar envio de e-mail.' })
    }
  },
  $apis.requireAuth(),
)
