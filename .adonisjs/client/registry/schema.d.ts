/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'auth.registration.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/register'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/shopkeeper').registerShopkeeperValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/shopkeeper').registerShopkeeperValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/registration_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/registration_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.sessions.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/shopkeeper').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/shopkeeper').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.new_account.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'session.sessions.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/session'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['show']>>>
    }
  }
  'session.sessions.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/auth/session'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['destroy']>>>
    }
  }
  'cards.cards.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/cards'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/cards_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/cards_controller').default['index']>>>
    }
  }
  'cards.cards.store': {
    methods: ["POST"]
    pattern: '/api/v1/cards'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/card').createCardValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/card').createCardValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/cards_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/cards_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'cards.cards.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/cards/:cardId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { cardId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/cards_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/cards_controller').default['show']>>>
    }
  }
  'cards.cards.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/cards/:cardId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/card').updateCardValidator)>>
      paramsTuple: [ParamValue]
      params: { cardId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/card').updateCardValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/cards_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/cards_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.shop_profile.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/account/profile'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shop_profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shop_profile_controller').default['show']>>>
    }
  }
  'account.shop_profile.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/account/profile'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/shopkeeper').updateProfileValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/shopkeeper').updateProfileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shop_profile_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shop_profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.shop_profile.upload_photo': {
    methods: ["PUT"]
    pattern: '/api/v1/account/profile/photo'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shop_profile_controller').default['uploadPhoto']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shop_profile_controller').default['uploadPhoto']>>>
    }
  }
  'account.shop_profile.remove_photo': {
    methods: ["DELETE"]
    pattern: '/api/v1/account/profile/photo'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shop_profile_controller').default['removePhoto']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shop_profile_controller').default['removePhoto']>>>
    }
  }
  'account.notifications.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/account/notifications'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['show']>>>
    }
  }
  'account.notifications.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/account/notifications'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/notification').notificationPreferencesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/notification').notificationPreferencesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.notifications.register_device': {
    methods: ["POST"]
    pattern: '/api/v1/account/notifications/devices'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/notification').registerDeviceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/notification').registerDeviceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['registerDevice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['registerDevice']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.notifications.revoke_device': {
    methods: ["DELETE"]
    pattern: '/api/v1/account/notifications/devices'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/notification').revokeDeviceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/notification').revokeDeviceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['revokeDevice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['revokeDevice']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.notifications.test': {
    methods: ["POST"]
    pattern: '/api/v1/account/notifications/test'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['test']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['test']>>>
    }
  }
  'account.notifications.inbox': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/account/notifications/inbox'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['inbox']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['inbox']>>>
    }
  }
  'account.notifications.unread_count': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/account/notifications/inbox/unread'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['unreadCount']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['unreadCount']>>>
    }
  }
  'account.notifications.mark_all_read': {
    methods: ["POST"]
    pattern: '/api/v1/account/notifications/inbox/read'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['markAllRead']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['markAllRead']>>>
    }
  }
  'account.notifications.mark_read': {
    methods: ["POST"]
    pattern: '/api/v1/account/notifications/inbox/:id/read'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['markRead']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['markRead']>>>
    }
  }
  'adminAuth.auth.store': {
    methods: ["POST"]
    pattern: '/api/v1/admin/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/auth').adminLoginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/auth').adminLoginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/auth_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/auth_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.auth.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/session'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/auth_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/auth_controller').default['show']>>>
    }
  }
  'admin.auth.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/admin/session'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/auth_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/auth_controller').default['destroy']>>>
    }
  }
  'admin.maintenance.stats': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/stats'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/maintenance_controller').default['stats']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/maintenance_controller').default['stats']>>>
    }
  }
  'admin.shopkeepers.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/shopkeepers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/shopkeepers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/shopkeepers_controller').default['index']>>>
    }
  }
  'admin.shopkeepers.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/shopkeepers/:shopkeeperId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { shopkeeperId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/shopkeepers_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/shopkeepers_controller').default['show']>>>
    }
  }
  'admin.shopkeepers.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/admin/shopkeepers/:shopkeeperId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/shopkeeper').adminUpdateShopkeeperValidator)>>
      paramsTuple: [ParamValue]
      params: { shopkeeperId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/shopkeeper').adminUpdateShopkeeperValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/shopkeepers_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/shopkeepers_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.shopkeepers.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/admin/shopkeepers/:shopkeeperId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/shopkeeper').adminDeleteShopkeeperValidator)>>
      paramsTuple: [ParamValue]
      params: { shopkeeperId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/shopkeeper').adminDeleteShopkeeperValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/shopkeepers_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/shopkeepers_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.shopkeepers.cards': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/shopkeepers/:shopkeeperId/cards'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { shopkeeperId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/shopkeepers_controller').default['cards']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/shopkeepers_controller').default['cards']>>>
    }
  }
  'admin.maintenance.log_out_shopkeepers': {
    methods: ["POST"]
    pattern: '/api/v1/admin/maintenance/logout-shopkeepers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/maintenance').maintenanceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/maintenance').maintenanceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/maintenance_controller').default['logOutShopkeepers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/maintenance_controller').default['logOutShopkeepers']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.maintenance.clear_redis': {
    methods: ["POST"]
    pattern: '/api/v1/admin/maintenance/clear-redis'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/maintenance').maintenanceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/maintenance').maintenanceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/maintenance_controller').default['clearRedis']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/maintenance_controller').default['clearRedis']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.maintenance.clear_data': {
    methods: ["POST"]
    pattern: '/api/v1/admin/maintenance/clear-data'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin/maintenance').maintenanceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin/maintenance').maintenanceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/maintenance_controller').default['clearData']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/maintenance_controller').default['clearData']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'shop_profile.serve_photo': {
    methods: ["GET","HEAD"]
    pattern: '/uploads/avatars/:file'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { file: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/shop_profile_controller').default['servePhoto']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/shop_profile_controller').default['servePhoto']>>>
    }
  }
}
