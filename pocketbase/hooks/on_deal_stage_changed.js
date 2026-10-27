onRecordAfterUpdateSuccess((e) => {
  try {
    const oldStage = e.record.original().getString('stage')
    const newStage = e.record.getString('stage')

    // If stage changed, automatically record a system activity on timeline
    if (oldStage && newStage && oldStage !== newStage) {
      let oldStageName = 'anterior'
      let newStageName = 'novo estágio'
      try {
        const oldStageRec = $app.findRecordById('pipeline_stages', oldStage)
        oldStageName = oldStageRec.getString('name')
      } catch (_) {}
      try {
        const newStageRec = $app.findRecordById('pipeline_stages', newStage)
        newStageName = newStageRec.getString('name')
      } catch (_) {}

      const dealCode = e.record.getString('code') || 'Negócio'
      const dealTitle = e.record.getString('title') || ''
      const authorId = e.record.getString('owner') || ''
      const contactId = e.record.getString('contact') || ''

      const activitiesCol = $app.findCollectionByNameOrId('activities')
      const actRecord = new Record(activitiesCol)
      actRecord.set('type', 'sistema')
      actRecord.set(
        'content',
        `Negócio ${dealCode} (${dealTitle}) movido de "${oldStageName}" para "${newStageName}".`,
      )
      actRecord.set('deal', e.record.id)
      if (contactId) actRecord.set('contact', contactId)
      if (authorId) actRecord.set('author', authorId)

      $app.save(actRecord)
    }
  } catch (err) {
    console.log('Error recording deal stage change activity:', err)
  }
  e.next()
}, 'deals')

onRecordAfterCreateSuccess((e) => {
  try {
    const stageId = e.record.getString('stage')
    let stageName = ''
    if (stageId) {
      try {
        const stageRec = $app.findRecordById('pipeline_stages', stageId)
        stageName = stageRec.getString('name')
      } catch (_) {}
    }

    const dealCode = e.record.getString('code') || 'Negócio'
    const dealTitle = e.record.getString('title') || ''
    const authorId = e.record.getString('owner') || ''
    const contactId = e.record.getString('contact') || ''

    const activitiesCol = $app.findCollectionByNameOrId('activities')
    const actRecord = new Record(activitiesCol)
    actRecord.set('type', 'sistema')
    actRecord.set(
      'content',
      stageName
        ? `Negócio ${dealCode} (${dealTitle}) criado no estágio "${stageName}".`
        : `Negócio ${dealCode} (${dealTitle}) criado no funil.`,
    )
    actRecord.set('deal', e.record.id)
    if (contactId) actRecord.set('contact', contactId)
    if (authorId) actRecord.set('author', authorId)

    $app.save(actRecord)
  } catch (err) {
    console.log('Error recording deal stage change activity:', err)
  }
  e.next()
}, 'deals')
