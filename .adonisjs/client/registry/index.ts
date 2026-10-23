/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'auth.registration.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/register',
    tokens: [{"old":"/api/v1/auth/register","type":0,"val":"api","end":""},{"old":"/api/v1/auth/register","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/register","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/register","type":0,"val":"register","end":""}],
    types: placeholder as Registry['auth.registration.store']['types'],
  },
  'auth.sessions.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [{"old":"/api/v1/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.sessions.store']['types'],
  },
  'auth.new_account.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/signup',
    tokens: [{"old":"/api/v1/auth/signup","type":0,"val":"api","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['auth.new_account.store']['types'],
  },
  'session.sessions.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/session',
    tokens: [{"old":"/api/v1/auth/session","type":0,"val":"api","end":""},{"old":"/api/v1/auth/session","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/session","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/session","type":0,"val":"session","end":""}],
    types: placeholder as Registry['session.sessions.show']['types'],
  },
  'session.sessions.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/auth/session',
    tokens: [{"old":"/api/v1/auth/session","type":0,"val":"api","end":""},{"old":"/api/v1/auth/session","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/session","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/session","type":0,"val":"session","end":""}],
    types: placeholder as Registry['session.sessions.destroy']['types'],
  },
  'cards.cards.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/cards',
    tokens: [{"old":"/api/v1/cards","type":0,"val":"api","end":""},{"old":"/api/v1/cards","type":0,"val":"v1","end":""},{"old":"/api/v1/cards","type":0,"val":"cards","end":""}],
    types: placeholder as Registry['cards.cards.index']['types'],
  },
  'cards.cards.store': {
    methods: ["POST"],
    pattern: '/api/v1/cards',
    tokens: [{"old":"/api/v1/cards","type":0,"val":"api","end":""},{"old":"/api/v1/cards","type":0,"val":"v1","end":""},{"old":"/api/v1/cards","type":0,"val":"cards","end":""}],
    types: placeholder as Registry['cards.cards.store']['types'],
  },
  'cards.cards.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/cards/:cardId',
    tokens: [{"old":"/api/v1/cards/:cardId","type":0,"val":"api","end":""},{"old":"/api/v1/cards/:cardId","type":0,"val":"v1","end":""},{"old":"/api/v1/cards/:cardId","type":0,"val":"cards","end":""},{"old":"/api/v1/cards/:cardId","type":1,"val":"cardId","end":""}],
    types: placeholder as Registry['cards.cards.show']['types'],
  },
  'cards.cards.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/cards/:cardId',
    tokens: [{"old":"/api/v1/cards/:cardId","type":0,"val":"api","end":""},{"old":"/api/v1/cards/:cardId","type":0,"val":"v1","end":""},{"old":"/api/v1/cards/:cardId","type":0,"val":"cards","end":""},{"old":"/api/v1/cards/:cardId","type":1,"val":"cardId","end":""}],
    types: placeholder as Registry['cards.cards.update']['types'],
  },
  'account.shop_profile.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/account/profile',
    tokens: [{"old":"/api/v1/account/profile","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['account.shop_profile.show']['types'],
  },
  'account.shop_profile.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/account/profile',
    tokens: [{"old":"/api/v1/account/profile","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['account.shop_profile.update']['types'],
  },
  'account.shop_profile.upload_photo': {
    methods: ["PUT"],
    pattern: '/api/v1/account/profile/photo',
    tokens: [{"old":"/api/v1/account/profile/photo","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile/photo","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile/photo","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile/photo","type":0,"val":"profile","end":""},{"old":"/api/v1/account/profile/photo","type":0,"val":"photo","end":""}],
    types: placeholder as Registry['account.shop_profile.upload_photo']['types'],
  },
  'account.shop_profile.remove_photo': {
    methods: ["DELETE"],
    pattern: '/api/v1/account/profile/photo',
    tokens: [{"old":"/api/v1/account/profile/photo","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile/photo","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile/photo","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile/photo","type":0,"val":"profile","end":""},{"old":"/api/v1/account/profile/photo","type":0,"val":"photo","end":""}],
    types: placeholder as Registry['account.shop_profile.remove_photo']['types'],
  },
  'account.notifications.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/account/notifications',
    tokens: [{"old":"/api/v1/account/notifications","type":0,"val":"api","end":""},{"old":"/api/v1/account/notifications","type":0,"val":"v1","end":""},{"old":"/api/v1/account/notifications","type":0,"val":"account","end":""},{"old":"/api/v1/account/notifications","type":0,"val":"notifications","end":""}],
    types: placeholder as Registry['account.notifications.show']['types'],
  },
  'account.notifications.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/account/notifications',
    tokens: [{"old":"/api/v1/account/notifications","type":0,"val":"api","end":""},{"old":"/api/v1/account/notifications","type":0,"val":"v1","end":""},{"old":"/api/v1/account/notifications","type":0,"val":"account","end":""},{"old":"/api/v1/account/notifications","type":0,"val":"notifications","end":""}],
    types: placeholder as Registry['account.notifications.update']['types'],
  },
  'account.notifications.register_device': {
    methods: ["POST"],
    pattern: '/api/v1/account/notifications/devices',
    tokens: [{"old":"/api/v1/account/notifications/devices","type":0,"val":"api","end":""},{"old":"/api/v1/account/notifications/devices","type":0,"val":"v1","end":""},{"old":"/api/v1/account/notifications/devices","type":0,"val":"account","end":""},{"old":"/api/v1/account/notifications/devices","type":0,"val":"notifications","end":""},{"old":"/api/v1/account/notifications/devices","type":0,"val":"devices","end":""}],
    types: placeholder as Registry['account.notifications.register_device']['types'],
  },
  'account.notifications.revoke_device': {
    methods: ["DELETE"],
    pattern: '/api/v1/account/notifications/devices',
    tokens: [{"old":"/api/v1/account/notifications/devices","type":0,"val":"api","end":""},{"old":"/api/v1/account/notifications/devices","type":0,"val":"v1","end":""},{"old":"/api/v1/account/notifications/devices","type":0,"val":"account","end":""},{"old":"/api/v1/account/notifications/devices","type":0,"val":"notifications","end":""},{"old":"/api/v1/account/notifications/devices","type":0,"val":"devices","end":""}],
    types: placeholder as Registry['account.notifications.revoke_device']['types'],
  },
  'account.notifications.test': {
    methods: ["POST"],
    pattern: '/api/v1/account/notifications/test',
    tokens: [{"old":"/api/v1/account/notifications/test","type":0,"val":"api","end":""},{"old":"/api/v1/account/notifications/test","type":0,"val":"v1","end":""},{"old":"/api/v1/account/notifications/test","type":0,"val":"account","end":""},{"old":"/api/v1/account/notifications/test","type":0,"val":"notifications","end":""},{"old":"/api/v1/account/notifications/test","type":0,"val":"test","end":""}],
    types: placeholder as Registry['account.notifications.test']['types'],
  },
  'account.notifications.inbox': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/account/notifications/inbox',
    tokens: [{"old":"/api/v1/account/notifications/inbox","type":0,"val":"api","end":""},{"old":"/api/v1/account/notifications/inbox","type":0,"val":"v1","end":""},{"old":"/api/v1/account/notifications/inbox","type":0,"val":"account","end":""},{"old":"/api/v1/account/notifications/inbox","type":0,"val":"notifications","end":""},{"old":"/api/v1/account/notifications/inbox","type":0,"val":"inbox","end":""}],
    types: placeholder as Registry['account.notifications.inbox']['types'],
  },
  'account.notifications.unread_count': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/account/notifications/inbox/unread',
    tokens: [{"old":"/api/v1/account/notifications/inbox/unread","type":0,"val":"api","end":""},{"old":"/api/v1/account/notifications/inbox/unread","type":0,"val":"v1","end":""},{"old":"/api/v1/account/notifications/inbox/unread","type":0,"val":"account","end":""},{"old":"/api/v1/account/notifications/inbox/unread","type":0,"val":"notifications","end":""},{"old":"/api/v1/account/notifications/inbox/unread","type":0,"val":"inbox","end":""},{"old":"/api/v1/account/notifications/inbox/unread","type":0,"val":"unread","end":""}],
    types: placeholder as Registry['account.notifications.unread_count']['types'],
  },
  'account.notifications.mark_all_read': {
    methods: ["POST"],
    pattern: '/api/v1/account/notifications/inbox/read',
    tokens: [{"old":"/api/v1/account/notifications/inbox/read","type":0,"val":"api","end":""},{"old":"/api/v1/account/notifications/inbox/read","type":0,"val":"v1","end":""},{"old":"/api/v1/account/notifications/inbox/read","type":0,"val":"account","end":""},{"old":"/api/v1/account/notifications/inbox/read","type":0,"val":"notifications","end":""},{"old":"/api/v1/account/notifications/inbox/read","type":0,"val":"inbox","end":""},{"old":"/api/v1/account/notifications/inbox/read","type":0,"val":"read","end":""}],
    types: placeholder as Registry['account.notifications.mark_all_read']['types'],
  },
  'account.notifications.mark_read': {
    methods: ["POST"],
    pattern: '/api/v1/account/notifications/inbox/:id/read',
    tokens: [{"old":"/api/v1/account/notifications/inbox/:id/read","type":0,"val":"api","end":""},{"old":"/api/v1/account/notifications/inbox/:id/read","type":0,"val":"v1","end":""},{"old":"/api/v1/account/notifications/inbox/:id/read","type":0,"val":"account","end":""},{"old":"/api/v1/account/notifications/inbox/:id/read","type":0,"val":"notifications","end":""},{"old":"/api/v1/account/notifications/inbox/:id/read","type":0,"val":"inbox","end":""},{"old":"/api/v1/account/notifications/inbox/:id/read","type":1,"val":"id","end":""},{"old":"/api/v1/account/notifications/inbox/:id/read","type":0,"val":"read","end":""}],
    types: placeholder as Registry['account.notifications.mark_read']['types'],
  },
  'adminAuth.auth.store': {
    methods: ["POST"],
    pattern: '/api/v1/admin/login',
    tokens: [{"old":"/api/v1/admin/login","type":0,"val":"api","end":""},{"old":"/api/v1/admin/login","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/login","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['adminAuth.auth.store']['types'],
  },
  'admin.auth.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/session',
    tokens: [{"old":"/api/v1/admin/session","type":0,"val":"api","end":""},{"old":"/api/v1/admin/session","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/session","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/session","type":0,"val":"session","end":""}],
    types: placeholder as Registry['admin.auth.show']['types'],
  },
  'admin.auth.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/admin/session',
    tokens: [{"old":"/api/v1/admin/session","type":0,"val":"api","end":""},{"old":"/api/v1/admin/session","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/session","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/session","type":0,"val":"session","end":""}],
    types: placeholder as Registry['admin.auth.destroy']['types'],
  },
  'admin.maintenance.stats': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/stats',
    tokens: [{"old":"/api/v1/admin/stats","type":0,"val":"api","end":""},{"old":"/api/v1/admin/stats","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/stats","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/stats","type":0,"val":"stats","end":""}],
    types: placeholder as Registry['admin.maintenance.stats']['types'],
  },
  'admin.shopkeepers.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/shopkeepers',
    tokens: [{"old":"/api/v1/admin/shopkeepers","type":0,"val":"api","end":""},{"old":"/api/v1/admin/shopkeepers","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/shopkeepers","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/shopkeepers","type":0,"val":"shopkeepers","end":""}],
    types: placeholder as Registry['admin.shopkeepers.index']['types'],
  },
  'admin.shopkeepers.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/shopkeepers/:shopkeeperId',
    tokens: [{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"shopkeepers","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":1,"val":"shopkeeperId","end":""}],
    types: placeholder as Registry['admin.shopkeepers.show']['types'],
  },
  'admin.shopkeepers.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/admin/shopkeepers/:shopkeeperId',
    tokens: [{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"shopkeepers","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":1,"val":"shopkeeperId","end":""}],
    types: placeholder as Registry['admin.shopkeepers.update']['types'],
  },
  'admin.shopkeepers.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/admin/shopkeepers/:shopkeeperId',
    tokens: [{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":0,"val":"shopkeepers","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId","type":1,"val":"shopkeeperId","end":""}],
    types: placeholder as Registry['admin.shopkeepers.destroy']['types'],
  },
  'admin.shopkeepers.cards': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/shopkeepers/:shopkeeperId/cards',
    tokens: [{"old":"/api/v1/admin/shopkeepers/:shopkeeperId/cards","type":0,"val":"api","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId/cards","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId/cards","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId/cards","type":0,"val":"shopkeepers","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId/cards","type":1,"val":"shopkeeperId","end":""},{"old":"/api/v1/admin/shopkeepers/:shopkeeperId/cards","type":0,"val":"cards","end":""}],
    types: placeholder as Registry['admin.shopkeepers.cards']['types'],
  },
  'admin.maintenance.log_out_shopkeepers': {
    methods: ["POST"],
    pattern: '/api/v1/admin/maintenance/logout-shopkeepers',
    tokens: [{"old":"/api/v1/admin/maintenance/logout-shopkeepers","type":0,"val":"api","end":""},{"old":"/api/v1/admin/maintenance/logout-shopkeepers","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/maintenance/logout-shopkeepers","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/maintenance/logout-shopkeepers","type":0,"val":"maintenance","end":""},{"old":"/api/v1/admin/maintenance/logout-shopkeepers","type":0,"val":"logout-shopkeepers","end":""}],
    types: placeholder as Registry['admin.maintenance.log_out_shopkeepers']['types'],
  },
  'admin.maintenance.clear_redis': {
    methods: ["POST"],
    pattern: '/api/v1/admin/maintenance/clear-redis',
    tokens: [{"old":"/api/v1/admin/maintenance/clear-redis","type":0,"val":"api","end":""},{"old":"/api/v1/admin/maintenance/clear-redis","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/maintenance/clear-redis","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/maintenance/clear-redis","type":0,"val":"maintenance","end":""},{"old":"/api/v1/admin/maintenance/clear-redis","type":0,"val":"clear-redis","end":""}],
    types: placeholder as Registry['admin.maintenance.clear_redis']['types'],
  },
  'admin.maintenance.clear_data': {
    methods: ["POST"],
    pattern: '/api/v1/admin/maintenance/clear-data',
    tokens: [{"old":"/api/v1/admin/maintenance/clear-data","type":0,"val":"api","end":""},{"old":"/api/v1/admin/maintenance/clear-data","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/maintenance/clear-data","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/maintenance/clear-data","type":0,"val":"maintenance","end":""},{"old":"/api/v1/admin/maintenance/clear-data","type":0,"val":"clear-data","end":""}],
    types: placeholder as Registry['admin.maintenance.clear_data']['types'],
  },
  'shop_profile.serve_photo': {
    methods: ["GET","HEAD"],
    pattern: '/uploads/avatars/:file',
    tokens: [{"old":"/uploads/avatars/:file","type":0,"val":"uploads","end":""},{"old":"/uploads/avatars/:file","type":0,"val":"avatars","end":""},{"old":"/uploads/avatars/:file","type":1,"val":"file","end":""}],
    types: placeholder as Registry['shop_profile.serve_photo']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
