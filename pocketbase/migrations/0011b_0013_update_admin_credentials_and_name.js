/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    let user
    try {
      // Tenta localizar pelo e-mail antigo
      user = app.findAuthRecordByEmail('users', 'felipe.lemos@adapta.org')
    } catch (_) {
      try {
        // Tenta localizar pelo e-mail novo se já tiver sido atualizado
        user = app.findAuthRecordByEmail('users', 'teste@direto.app')
      } catch (_) {
        const users = app.findCollectionByNameOrId('users')
        user = new Record(users)
      }
    }

    user.setEmail('teste@direto.app')
    user.setPassword('Direto@2026')
    user.setVerified(true)
    user.set('name', 'Adapta')
    user.set('role', 'admin')
    app.save(user)
  },
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('users', 'teste@direto.app')
      user.setEmail('felipe.lemos@adapta.org')
      user.setPassword('Skip@Pass')
      user.set('name', 'Felipe Lemos')
      user.set('role', 'admin')
      app.save(user)
    } catch (_) {}
  },
)
