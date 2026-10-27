migrate(
  (app) => {
    try {
      const dealsCol = app.findCollectionByNameOrId('deals')
      const campaignsCol = app.findCollectionByNameOrId('campaigns')
      const formsCol = app.findCollectionByNameOrId('capture_forms')

      // 1. Ensure at least 3 distinct campaigns exist to demonstrate the campaign comparison feature nicely
      let defaultFormId = ''
      try {
        const defaultForm = formsCol
          ? app.findRecordsByFilter('capture_forms', '', '+created', 1, 0)
          : []
        if (defaultForm.length > 0) defaultFormId = defaultForm[0].id
      } catch (_) {}

      const campaignsToSeed = [
        {
          name: 'Campanha Inbound Orgânico',
          description:
            'Captação contínua através do formulário institucional no site principal e landing pages.',
          status: 'ativa',
        },
        {
          name: 'Google Ads - Fundo de Funil',
          description: 'Campanha de tráfego pago para palavras-chave de alta intenção comercial.',
          status: 'ativa',
        },
        {
          name: 'Outbound & SDR Tech',
          description: 'Prospecção ativa direcionada para contas de médio e grande porte.',
          status: 'ativa',
        },
      ]

      const createdCampaigns = []

      for (const cData of campaignsToSeed) {
        let record
        try {
          record = app.findFirstRecordByData('campaigns', 'name', cData.name)
        } catch (_) {
          record = new Record(campaignsCol)
          record.set('name', cData.name)
          record.set('description', cData.description)
          record.set('status', cData.status)
          if (defaultFormId) record.set('form', defaultFormId)
          app.save(record)
        }
        createdCampaigns.push(record)
      }

      // 2. Link some existing deals to campaigns if they have empty campaign
      const allDeals = app.findRecordsByFilter('deals', '', '+created', 50, 0)
      if (createdCampaigns.length > 0 && allDeals.length > 0) {
        for (let i = 0; i < allDeals.length; i++) {
          const deal = allDeals[i]
          const currentCamp = deal.getString('campaign')
          if (!currentCamp) {
            // Distribute across campaigns
            const assignedCamp = createdCampaigns[i % createdCampaigns.length]
            deal.set('campaign', assignedCamp.id)
            app.save(deal)
          }
        }
      }
    } catch (err) {
      console.log('Error in 0011_seed_campaigns_and_deal_links migration:', err)
    }
  },
  (app) => {
    // rollback
  },
)
