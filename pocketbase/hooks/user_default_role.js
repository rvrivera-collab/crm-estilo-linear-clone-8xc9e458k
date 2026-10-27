onRecordCreateRequest((e) => {
  e.record.set('role', 'member')
  e.next()
}, 'users')
