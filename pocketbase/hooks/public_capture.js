routerAdd('POST', '/backend/v1/public/capture', (e) => {
  try {
    const body = e.requestInfo().body || {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const company = typeof body.company === 'string' ? body.company.trim() : ''
    const position = typeof body.position === 'string' ? body.position.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const honeypot = typeof body.website === 'string' ? body.website.trim() : ''
    const formId = typeof body.form_id === 'string' ? body.form_id.trim() : ''
    const campaignParam =
      typeof body.campaign_id === 'string'
        ? body.campaign_id.trim()
        : typeof body.campaign === 'string'
          ? body.campaign.trim()
          : ''
    const rawCustomFields = body.custom_fields

    // Honeypot check
    if (honeypot) {
      return e.json(200, { success: true, message: 'Lead recebido com sucesso.' })
    }

    // Always require name and email
    if (!name) {
      return e.badRequestError('O nome é obrigatório.')
    }
    if (!email || !email.includes('@')) {
      return e.badRequestError('E-mail válido é obrigatório.')
    }

    // Check form configuration if provided or find the active/first one
    let formConfig = null
    try {
      if (formId) {
        formConfig = $app.findRecordById('capture_forms', formId)
      } else {
        const forms = $app.findRecordsByFilter('capture_forms', '', '+created', 1, 0)
        if (forms.length > 0) formConfig = forms[0]
      }
    } catch (_) {
      // If formId was passed as a name or invalid ID, fallback to first form
      try {
        if (formId) {
          const formsByName = $app.findRecordsByFilter(
            'capture_forms',
            `name = "${formId.replace(/"/g, '\\"')}"`,
            '+created',
            1,
            0,
          )
          if (formsByName.length > 0) formConfig = formsByName[0]
        }
        if (!formConfig) {
          const forms = $app.findRecordsByFilter('capture_forms', '', '+created', 1, 0)
          if (forms.length > 0) formConfig = forms[0]
        }
      } catch (_) {}
    }

    if (formConfig) {
      if (formConfig.getBool('show_phone') && formConfig.getBool('require_phone') && !phone) {
        return e.badRequestError('O telefone / WhatsApp é obrigatório.')
      }
      if (formConfig.getBool('show_company') && formConfig.getBool('require_company') && !company) {
        return e.badRequestError('O nome da empresa é obrigatório.')
      }
      if (
        formConfig.getBool('show_position') &&
        formConfig.getBool('require_position') &&
        !position
      ) {
        return e.badRequestError('O cargo é obrigatório.')
      }
      if (formConfig.getBool('show_message') && formConfig.getBool('require_message') && !message) {
        return e.badRequestError('A mensagem / necessidade é obrigatória.')
      }
    }

    // Process and validate custom fields
    let customFieldsConfig = []
    if (formConfig) {
      try {
        const rawCfg = formConfig.get('custom_fields')
        if (Array.isArray(rawCfg)) {
          customFieldsConfig = rawCfg
        } else if (typeof rawCfg === 'string' && rawCfg.trim()) {
          customFieldsConfig = JSON.parse(rawCfg)
        }
      } catch (_) {}
    }

    const validatedCustomAnswers = {}
    const customSummaryList = []

    // submittedAnswers could be parsed object or JSON string
    let submittedAnswers = {}
    if (rawCustomFields && typeof rawCustomFields === 'object') {
      submittedAnswers = rawCustomFields
    } else if (typeof rawCustomFields === 'string' && rawCustomFields.trim()) {
      try {
        submittedAnswers = JSON.parse(rawCustomFields)
      } catch (_) {}
    }

    if (Array.isArray(customFieldsConfig) && customFieldsConfig.length > 0) {
      for (let i = 0; i < customFieldsConfig.length; i++) {
        const field = customFieldsConfig[i]
        if (!field || !field.id || !field.label) continue

        const val = submittedAnswers[field.id]
        const label = field.label.trim()
        const isRequired = Boolean(field.required)
        const type = field.type || 'text'

        if (type === 'checkbox') {
          const checked = Boolean(val)
          if (isRequired && !checked) {
            return e.badRequestError(`O campo "${label}" precisa ser marcado.`)
          }
          validatedCustomAnswers[label] = checked
          customSummaryList.push(`${label}: ${checked ? 'Sim' : 'Não'}`)
        } else if (type === 'number') {
          if (val === undefined || val === null || val === '') {
            if (isRequired) {
              return e.badRequestError(`O campo "${label}" é obrigatório.`)
            }
          } else {
            const num = Number(val)
            if (isNaN(num)) {
              return e.badRequestError(`O campo "${label}" deve ser um número válido.`)
            }
            validatedCustomAnswers[label] = num
            customSummaryList.push(`${label}: ${num}`)
          }
        } else if (type === 'select') {
          const strVal = typeof val === 'string' ? val.trim() : ''
          if (isRequired && !strVal) {
            return e.badRequestError(`Selecione uma opção para "${label}".`)
          }
          if (strVal) {
            const options = Array.isArray(field.options) ? field.options : []
            if (options.length > 0 && !options.includes(strVal)) {
              return e.badRequestError(`Opção inválida selecionada para "${label}".`)
            }
            validatedCustomAnswers[label] = strVal
            customSummaryList.push(`${label}: ${strVal}`)
          }
        } else if (type === 'email') {
          const strVal = typeof val === 'string' ? val.trim() : ''
          if (isRequired && !strVal) {
            return e.badRequestError(`O campo "${label}" é obrigatório.`)
          }
          if (strVal) {
            if (!strVal.includes('@')) {
              return e.badRequestError(`Informe um e-mail válido para "${label}".`)
            }
            validatedCustomAnswers[label] = strVal
            customSummaryList.push(`${label}: ${strVal}`)
          }
        } else {
          // text, textarea, phone
          const strVal = typeof val === 'string' ? val.trim() : val ? String(val).trim() : ''
          if (isRequired && !strVal) {
            return e.badRequestError(`O campo "${label}" é obrigatório.`)
          }
          if (strVal) {
            validatedCustomAnswers[label] = strVal
            customSummaryList.push(`${label}: ${strVal}`)
          }
        }
      }
    }

    // Resolve an owner:
    // Prioridade 1: owner configurado no capture_forms (se o formulário pertence a um usuário)
    // Prioridade 2: usuário admin demo teste@direto.app
    // Prioridade 3: qualquer admin ou usuário cadastrado
    let ownerRecord = null
    let ownerId = ''

    if (formConfig) {
      const formOwner = formConfig.getString('owner')
      if (formOwner) {
        try {
          ownerRecord = $app.findRecordById('users', formOwner)
          ownerId = ownerRecord.id
        } catch (_) {}
      }
    }

    if (!ownerId) {
      try {
        ownerRecord = $app.findFirstRecordByData('users', 'email', 'teste@direto.app')
        ownerId = ownerRecord.id
      } catch (_) {
        try {
          ownerRecord = $app.findFirstRecordByData('users', 'role', 'admin')
          ownerId = ownerRecord.id
        } catch (_) {
          try {
            const anyUser = $app.findRecordsByFilter('users', '', '+created', 1, 0)
            if (anyUser.length > 0) {
              ownerRecord = anyUser[0]
              ownerId = ownerRecord.id
            }
          } catch (_) {}
        }
      }
    }

    if (!ownerId) {
      return e.json(500, { error: 'Nenhum usuário configurado no CRM para receber o lead.' })
    }

    // 1. Obter ou criar registro na coleção empresas (contato -> empresa -> negócio)
    let empresaRecord = null
    const companyClean = company ? company.trim() : ''
    if (companyClean) {
      try {
        const empresasList = $app.findRecordsByFilter(
          'empresas',
          `name ~ "${companyClean.replace(/"/g, '\\"')}" || name = "${companyClean.replace(/"/g, '\\"')}"`,
          '-created',
          1,
          0,
        )
        if (empresasList.length > 0) {
          empresaRecord = empresasList[0]
        } else {
          const empresasCol = $app.findCollectionByNameOrId('empresas')
          empresaRecord = new Record(empresasCol)
          empresaRecord.set('name', companyClean)
          empresaRecord.set('owner', ownerId)
          if (phone) empresaRecord.set('phone', phone)
          empresaRecord.set('notes', `Criada automaticamente na captura do lead ${name} (${email})`)
          $app.save(empresaRecord)
        }
      } catch (e) {
        console.log('Aviso ao resolver empresa na captura:', e)
      }
    }

    // 2. Create or update contact
    const contactsCol = $app.findCollectionByNameOrId('contacts')
    let contactRecord
    try {
      contactRecord = $app.findFirstRecordByData('contacts', 'email', email)
      if (name) contactRecord.set('name', name)
      if (phone) contactRecord.set('phone', phone)
      if (companyClean) contactRecord.set('company', companyClean)
      if (position) contactRecord.set('position', position)
      if (empresaRecord && !contactRecord.getString('empresa')) {
        contactRecord.set('empresa', empresaRecord.id)
      }
      if (message) {
        const prevNotes = contactRecord.getString('notes')
        contactRecord.set(
          'notes',
          prevNotes
            ? `${prevNotes}\n---\n[Nova mensagem do formulário]: ${message}`
            : `[Mensagem do formulário]: ${message}`,
        )
      }

      // Merge custom_fields
      if (Object.keys(validatedCustomAnswers).length > 0) {
        let existingAnswers = {}
        try {
          const raw = contactRecord.get('custom_fields')
          if (raw && typeof raw === 'object') {
            existingAnswers = raw
          } else if (typeof raw === 'string' && raw.trim()) {
            existingAnswers = JSON.parse(raw)
          }
        } catch (_) {}
        const merged = Object.assign({}, existingAnswers, validatedCustomAnswers)
        contactRecord.set('custom_fields', merged)
      }

      $app.save(contactRecord)
    } catch (_) {
      contactRecord = new Record(contactsCol)
      contactRecord.set('name', name)
      contactRecord.set('email', email)
      contactRecord.set('phone', phone)
      contactRecord.set('company', companyClean || 'Particular')
      if (empresaRecord) {
        contactRecord.set('empresa', empresaRecord.id)
      }
      contactRecord.set('position', position || 'Lead')
      contactRecord.set('status', 'lead')
      contactRecord.set('owner', ownerId)
      contactRecord.set(
        'notes',
        message ? `[Mensagem do formulário]: ${message}` : 'Captado via formulário público',
      )
      if (Object.keys(validatedCustomAnswers).length > 0) {
        contactRecord.set('custom_fields', validatedCustomAnswers)
      }
      $app.save(contactRecord)
    }

    // 3. Find first stage: 'Prospecção' or order 1
    let stageId = ''
    try {
      const firstStage = $app.findFirstRecordByData('pipeline_stages', 'name', 'Prospecção')
      stageId = firstStage.id
    } catch (_) {
      const stages = $app.findRecordsByFilter('pipeline_stages', '', '+order', 1, 0)
      if (stages.length > 0) stageId = stages[0].id
    }

    // 4. Generate sequential code NEG-XXXX
    let nextCode = 'NEG-1001'
    try {
      const dealsList = $app.findRecordsByFilter('deals', '', '-code', 50, 0)
      let highestNum = 1000
      for (const d of dealsList) {
        const c = d.getString('code') || ''
        const match = c.match(/NEG-(\d+)/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > highestNum) highestNum = num
        }
      }
      nextCode = 'NEG-' + (highestNum + 1)
    } catch (_) {}

    // 5. Resolve campaign if explicitly provided OR formConfig is linked to a campaign
    let campaignId = ''
    let campaignName = ''
    if (campaignParam) {
      try {
        const campRec = $app.findRecordById('campaigns', campaignParam)
        campaignId = campRec.id
        campaignName = campRec.getString('name')
      } catch (_) {
        try {
          const campByName = $app.findRecordsByFilter(
            'campaigns',
            `name = "${campaignParam.replace(/"/g, '\\"')}"`,
            '-created',
            1,
            0,
          )
          if (campByName.length > 0) {
            campaignId = campByName[0].id
            campaignName = campByName[0].getString('name')
          }
        } catch (_) {}
      }
    }

    if (!campaignId && formConfig) {
      try {
        const camps = $app.findRecordsByFilter(
          'campaigns',
          `form = "${formConfig.id}"`,
          '-created',
          1,
          0,
        )
        if (camps.length > 0) {
          campaignId = camps[0].id
          campaignName = camps[0].getString('name')
        }
      } catch (_) {}
    }

    // 6. Create Deal in Prospecção
    const dealsCol = $app.findCollectionByNameOrId('deals')
    const dealRecord = new Record(dealsCol)
    dealRecord.set('code', nextCode)
    dealRecord.set('title', company ? `Oportunidade - ${company}` : `Lead - ${name}`)
    dealRecord.set('value', 0)
    dealRecord.set('stage', stageId)
    dealRecord.set('status', 'aberto')
    dealRecord.set('contact', contactRecord.id)
    if (empresaRecord) {
      dealRecord.set('empresa', empresaRecord.id)
    } else if (contactRecord.getString('empresa')) {
      dealRecord.set('empresa', contactRecord.getString('empresa'))
    }
    dealRecord.set('owner', ownerId)
    dealRecord.set('position', 1)
    dealRecord.set('temperature', 'quente') // New inbound lead is warm/hot!
    dealRecord.set('last_contact_at', new Date().toISOString())
    if (campaignId) {
      dealRecord.set('campaign', campaignId)
    }
    $app.save(dealRecord)

    // 7. Register activity
    const activitiesCol = $app.findCollectionByNameOrId('activities')
    const actRecord = new Record(activitiesCol)
    actRecord.set('type', 'sistema')
    const formLabel = formConfig ? formConfig.getString('name') : 'padrão'

    let activityContent = `Lead captado via formulário (${formLabel})${campaignName ? ` na campanha "${campaignName}"` : ''}.`
    if (message) {
      activityContent += ` Mensagem: "${message}".`
    }
    if (customSummaryList.length > 0) {
      activityContent += `\nCampos personalizados:\n• ` + customSummaryList.join('\n• ')
    }

    actRecord.set('content', activityContent)
    actRecord.set('contact', contactRecord.id)
    actRecord.set('deal', dealRecord.id)
    actRecord.set('author', ownerId)
    $app.save(actRecord)

    // 8. Envio de e-mail transacional nativo do Skip Cloud (PocketBase)
    // Redeploy marker: keep backend hook synchronized with the committed capture flow.
    // Notificação para o time (novo lead recebido) e confirmação para o lead.
    // Falha de e-mail NÃO PODE abortar o fluxo da submissão (best-effort).
    let teamEmailSent = false
    let leadEmailSent = false

    const senderAddress = $app.settings().meta.senderAddress || 'no-reply@goskip.dev'
    const senderName = $app.settings().meta.senderName || 'CRM Adapta'

    // 8a. Enviar e-mail de confirmação / boas-vindas para o LEAD
    try {
      const customHtmlBlock =
        customSummaryList.length > 0
          ? `<div style="margin-top:16px; padding:12px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0; font-size:13px; color:#475569;">
              <strong style="color:#0f172a; display:block; margin-bottom:6px;">Informações recebidas:</strong>
              <ul style="margin:0; padding-left:18px;">
                ${customSummaryList.map((item) => `<li>${item}</li>`).join('')}
              </ul>
            </div>`
          : ''

      const leadSubject = `Recebemos sua mensagem — Protocolo ${nextCode}`
      const leadHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1c1c1e; max-width: 580px; margin: 0 auto; padding: 24px 16px;">
          <div style="margin-bottom: 20px;">
            <span style="display:inline-block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#f59e0b; background:#fef3c7; padding:2px 8px; border-radius:4px;">
              Confirmação de Atendimento
            </span>
          </div>
          <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">
            Olá, ${name}!
          </h2>
          <p style="font-size: 15px; color: #475569; margin: 0 0 16px 0;">
            Muito obrigado pelo seu contato. Recebemos sua mensagem com sucesso através do nosso formulário de captação.
          </p>
          <div style="background: #f1f5f9; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; color: #0f172a;">
              <strong>Protocolo de Atendimento:</strong> <span style="font-family: monospace; font-weight: 700; color: #b45309;">${nextCode}</span>
            </p>
            ${companyClean ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;"><strong>Empresa:</strong> ${companyClean}</p>` : ''}
            ${message ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #334155; font-style: italic;">"${message}"</p>` : ''}
          </div>
          ${customHtmlBlock}
          <p style="font-size: 14px; color: #64748b; margin-top: 20px;">
            Nossa equipe comercial já está analisando suas informações e entrará em contato em breve.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            ${senderName} · Atendimento Comercial Automatizado
          </p>
        </div>
      `

      const leadMsg = new MailerMessage({
        from: {
          address: senderAddress,
          name: senderName,
        },
        to: [{ address: email }],
        subject: leadSubject,
        html: leadHtml,
      })
      $app.newMailClient().send(leadMsg)
      leadEmailSent = true
    } catch (leadMailErr) {
      console.log('Aviso ao enviar e-mail nativo para o lead:', leadMailErr.message || leadMailErr)
    }

    // 8b. Enviar e-mail de notificação para o TIME (responsável / admin)
    const teamRecipientEmail = ownerRecord ? ownerRecord.getString('email') : ''
    if (teamRecipientEmail && teamRecipientEmail.includes('@') && teamRecipientEmail !== email) {
      try {
        const teamSubject = `[Novo Lead Inbound] ${name}${companyClean ? ` (${companyClean})` : ''} — ${nextCode}`
        const teamHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1c1c1e; max-width: 580px; margin: 0 auto; padding: 24px 16px;">
            <div style="margin-bottom: 16px;">
              <span style="display:inline-block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#047857; background:#d1fae5; padding:2px 8px; border-radius:4px;">
                Novo Lead Recebido
              </span>
            </div>
            <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">
              Oportunidade criada no estágio Prospecção
            </h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; width: 130px;"><strong>Código:</strong></td>
                <td style="padding: 8px 0; font-family: monospace; font-weight: 700; color: #0f172a;">${nextCode}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;"><strong>Nome:</strong></td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;"><strong>E-mail:</strong></td>
                <td style="padding: 8px 0; color: #2563eb;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td>
              </tr>
              ${phone ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>Telefone:</strong></td><td style="padding: 8px 0; color: #0f172a;">${phone}</td></tr>` : ''}
              ${companyClean ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>Empresa:</strong></td><td style="padding: 8px 0; color: #0f172a;">${companyClean}</td></tr>` : ''}
              ${position ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>Cargo:</strong></td><td style="padding: 8px 0; color: #0f172a;">${position}</td></tr>` : ''}
              ${campaignName ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>Campanha:</strong></td><td style="padding: 8px 0; color: #b45309; font-weight: 600;">${campaignName}</td></tr>` : ''}
              <tr>
                <td style="padding: 8px 0; color: #64748b;"><strong>Formulário:</strong></td>
                <td style="padding: 8px 0; color: #0f172a;">${formLabel}</td>
              </tr>
            </table>
            ${
              message
                ? `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
                <strong style="font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Mensagem do Lead:</strong>
                <p style="margin: 0; font-size: 14px; color: #1e293b; white-space: pre-wrap;">${message}</p>
              </div>
            `
                : ''
            }
            ${
              customSummaryList.length > 0
                ? `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
                <strong style="font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Campos Personalizados:</strong>
                <ul style="margin: 6px 0 0 0; padding-left: 18px; font-size: 13px; color: #334155;">
                  ${customSummaryList.map((item) => `<li>${item}</li>`).join('')}
                </ul>
              </div>
            `
                : ''
            }
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">
              Alerta gerado automaticamente pelo CRM Adapta
            </p>
          </div>
        `

        const teamMsg = new MailerMessage({
          from: {
            address: senderAddress,
            name: senderName,
          },
          to: [{ address: teamRecipientEmail }],
          subject: teamSubject,
          html: teamHtml,
        })
        $app.newMailClient().send(teamMsg)
        teamEmailSent = true
      } catch (teamMailErr) {
        console.log(
          'Aviso ao enviar notificação de lead para a equipe:',
          teamMailErr.message || teamMailErr,
        )
      }
    }

    const successMsg = formConfig
      ? formConfig.getString('success_message')
      : 'Muito obrigado pelo contato. Seu atendimento já foi registrado em nossa esteira comercial.'

    return e.json(200, {
      success: true,
      message:
        successMsg ||
        'Recebemos seu contato com sucesso! Nossa equipe entrará em contato em breve.',
      deal: {
        id: dealRecord.id,
        code: nextCode,
        title: dealRecord.getString('title'),
      },
      contact: {
        id: contactRecord.id,
        name: contactRecord.getString('name'),
        email: contactRecord.getString('email'),
      },
      emails: {
        leadEmailSent,
        teamEmailSent,
      },
    })
  } catch (err) {
    return e.json(500, { error: err.message || 'Erro ao processar formulário de captura.' })
  }
})
