/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/', () => {
  return { hello: 'world' }
})

router
  .group(() => {
    router
      .group(() => {
        // Shop registration. Creates the Shopkeeper record in the `users`
        // collection and assigns its ShopkeeperID.
        router.post('register', [controllers.Registration, 'store'])

        // Sign in. Opens a Redis session that lasts until it is signed out.
        router.post('login', [controllers.Sessions, 'store'])

        router.post('signup', [controllers.NewAccount, 'store'])
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        // Who the current token belongs to. The app calls this on startup to
        // decide between the dashboard and the landing page.
        router.get('session', [controllers.Sessions, 'show'])

        // Sign out. The only thing that ends a session.
        router.delete('session', [controllers.Sessions, 'destroy'])
      })
      .prefix('auth')
      .as('session')
      .use(middleware.shopkeeper())

    // The signed-in shop's card register. Scoped to their ShopkeeperID by the
    // controller — never by anything the request can set.
    router
      .group(() => {
        router.get('/', [controllers.Cards, 'index'])
        router.post('/', [controllers.Cards, 'store'])
        // Edits the name, the notes, and whether the card is closed. The
        // dates and the card number are not editable — see the validator.
        router.patch(':cardId', [controllers.Cards, 'update'])
      })
      .prefix('cards')
      .as('cards')
      .use(middleware.shopkeeper())

    // The signed-in shop's own profile. Nothing here takes a shop identifier —
    // it always works on whoever the session resolved.
    router
      .group(() => {
        router.get('profile', [controllers.ShopProfile, 'show'])
        router.patch('profile', [controllers.ShopProfile, 'update'])
        router.put('profile/photo', [controllers.ShopProfile, 'uploadPhoto'])
        router.delete('profile/photo', [controllers.ShopProfile, 'removePhoto'])
      })
      .prefix('account')
      .as('account')
      .use(middleware.shopkeeper())

    /*
    |--------------------------------------------------------------------------
    | Admin panel
    |--------------------------------------------------------------------------
    |
    | The only routes in the app that are not scoped to a single shop. They sit
    | behind their own middleware, reading their own Redis namespace — not a
    | role flag on a shopkeeper session, which would be one wrong branch away
    | from a shop reaching them.
    |
    | There is no admin sign-up. Admins are made with `node ace admin:create`.
    */
    router
      .group(() => {
        router.post('login', [controllers.admin.Auth, 'store'])
      })
      .prefix('admin')
      .as('adminAuth')

    router
      .group(() => {
        router.get('session', [controllers.admin.Auth, 'show'])
        router.delete('session', [controllers.admin.Auth, 'destroy'])

        router.get('stats', [controllers.admin.Maintenance, 'stats'])

        router.get('shopkeepers', [controllers.admin.Shopkeepers, 'index'])
        router.get('shopkeepers/:shopkeeperId', [controllers.admin.Shopkeepers, 'show'])
        router.patch('shopkeepers/:shopkeeperId', [controllers.admin.Shopkeepers, 'update'])
        // Cascades: the shop's cards, sessions, counters and photo go with it.
        // The body must carry the shop's own ID as confirmation.
        router.delete('shopkeepers/:shopkeeperId', [controllers.admin.Shopkeepers, 'destroy'])
        router.get('shopkeepers/:shopkeeperId/cards', [controllers.admin.Shopkeepers, 'cards'])

        // Destructive. Each demands a typed confirmation in the body.
        router.post('maintenance/logout-shopkeepers', [
          controllers.admin.Maintenance,
          'logOutShopkeepers',
        ])
        router.post('maintenance/clear-redis', [controllers.admin.Maintenance, 'clearRedis'])
        router.post('maintenance/clear-data', [controllers.admin.Maintenance, 'clearData'])
      })
      .prefix('admin')
      .as('admin')
      .use(middleware.admin())
  })
  .prefix('/api/v1')

/**
 * Profile photos.
 *
 * Outside /api/v1 and outside the session middleware on purpose: an <img src>
 * cannot send an Authorization header, so a photo behind auth would never
 * render. The filename is 32 random hex characters and the controller serves
 * nothing that doesn't match that shape, which is what stands in for a
 * credential and what makes path traversal impossible.
 */
router.get('/uploads/avatars/:file', [controllers.ShopProfile, 'servePhoto'])
