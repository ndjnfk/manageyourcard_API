import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.registration.store': { paramsTuple?: []; params?: {} }
    'auth.sessions.store': { paramsTuple?: []; params?: {} }
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'session.sessions.show': { paramsTuple?: []; params?: {} }
    'session.sessions.destroy': { paramsTuple?: []; params?: {} }
    'cards.cards.index': { paramsTuple?: []; params?: {} }
    'cards.cards.store': { paramsTuple?: []; params?: {} }
    'cards.cards.show': { paramsTuple: [ParamValue]; params: {'cardId': ParamValue} }
    'cards.cards.update': { paramsTuple: [ParamValue]; params: {'cardId': ParamValue} }
    'account.shop_profile.show': { paramsTuple?: []; params?: {} }
    'account.shop_profile.update': { paramsTuple?: []; params?: {} }
    'account.shop_profile.upload_photo': { paramsTuple?: []; params?: {} }
    'account.shop_profile.remove_photo': { paramsTuple?: []; params?: {} }
    'account.notifications.show': { paramsTuple?: []; params?: {} }
    'account.notifications.update': { paramsTuple?: []; params?: {} }
    'account.notifications.register_device': { paramsTuple?: []; params?: {} }
    'account.notifications.revoke_device': { paramsTuple?: []; params?: {} }
    'account.notifications.test': { paramsTuple?: []; params?: {} }
    'account.notifications.inbox': { paramsTuple?: []; params?: {} }
    'account.notifications.unread_count': { paramsTuple?: []; params?: {} }
    'account.notifications.mark_all_read': { paramsTuple?: []; params?: {} }
    'account.notifications.mark_read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'adminAuth.auth.store': { paramsTuple?: []; params?: {} }
    'admin.auth.show': { paramsTuple?: []; params?: {} }
    'admin.auth.destroy': { paramsTuple?: []; params?: {} }
    'admin.maintenance.stats': { paramsTuple?: []; params?: {} }
    'admin.shopkeepers.index': { paramsTuple?: []; params?: {} }
    'admin.shopkeepers.show': { paramsTuple: [ParamValue]; params: {'shopkeeperId': ParamValue} }
    'admin.shopkeepers.update': { paramsTuple: [ParamValue]; params: {'shopkeeperId': ParamValue} }
    'admin.shopkeepers.destroy': { paramsTuple: [ParamValue]; params: {'shopkeeperId': ParamValue} }
    'admin.shopkeepers.cards': { paramsTuple: [ParamValue]; params: {'shopkeeperId': ParamValue} }
    'admin.maintenance.log_out_shopkeepers': { paramsTuple?: []; params?: {} }
    'admin.maintenance.clear_redis': { paramsTuple?: []; params?: {} }
    'admin.maintenance.clear_data': { paramsTuple?: []; params?: {} }
    'shop_profile.serve_photo': { paramsTuple: [ParamValue]; params: {'file': ParamValue} }
  }
  GET: {
    'session.sessions.show': { paramsTuple?: []; params?: {} }
    'cards.cards.index': { paramsTuple?: []; params?: {} }
    'cards.cards.show': { paramsTuple: [ParamValue]; params: {'cardId': ParamValue} }
    'account.shop_profile.show': { paramsTuple?: []; params?: {} }
    'account.notifications.show': { paramsTuple?: []; params?: {} }
    'account.notifications.inbox': { paramsTuple?: []; params?: {} }
    'account.notifications.unread_count': { paramsTuple?: []; params?: {} }
    'admin.auth.show': { paramsTuple?: []; params?: {} }
    'admin.maintenance.stats': { paramsTuple?: []; params?: {} }
    'admin.shopkeepers.index': { paramsTuple?: []; params?: {} }
    'admin.shopkeepers.show': { paramsTuple: [ParamValue]; params: {'shopkeeperId': ParamValue} }
    'admin.shopkeepers.cards': { paramsTuple: [ParamValue]; params: {'shopkeeperId': ParamValue} }
    'shop_profile.serve_photo': { paramsTuple: [ParamValue]; params: {'file': ParamValue} }
  }
  HEAD: {
    'session.sessions.show': { paramsTuple?: []; params?: {} }
    'cards.cards.index': { paramsTuple?: []; params?: {} }
    'cards.cards.show': { paramsTuple: [ParamValue]; params: {'cardId': ParamValue} }
    'account.shop_profile.show': { paramsTuple?: []; params?: {} }
    'account.notifications.show': { paramsTuple?: []; params?: {} }
    'account.notifications.inbox': { paramsTuple?: []; params?: {} }
    'account.notifications.unread_count': { paramsTuple?: []; params?: {} }
    'admin.auth.show': { paramsTuple?: []; params?: {} }
    'admin.maintenance.stats': { paramsTuple?: []; params?: {} }
    'admin.shopkeepers.index': { paramsTuple?: []; params?: {} }
    'admin.shopkeepers.show': { paramsTuple: [ParamValue]; params: {'shopkeeperId': ParamValue} }
    'admin.shopkeepers.cards': { paramsTuple: [ParamValue]; params: {'shopkeeperId': ParamValue} }
    'shop_profile.serve_photo': { paramsTuple: [ParamValue]; params: {'file': ParamValue} }
  }
  POST: {
    'auth.registration.store': { paramsTuple?: []; params?: {} }
    'auth.sessions.store': { paramsTuple?: []; params?: {} }
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'cards.cards.store': { paramsTuple?: []; params?: {} }
    'account.notifications.register_device': { paramsTuple?: []; params?: {} }
    'account.notifications.test': { paramsTuple?: []; params?: {} }
    'account.notifications.mark_all_read': { paramsTuple?: []; params?: {} }
    'account.notifications.mark_read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'adminAuth.auth.store': { paramsTuple?: []; params?: {} }
    'admin.maintenance.log_out_shopkeepers': { paramsTuple?: []; params?: {} }
    'admin.maintenance.clear_redis': { paramsTuple?: []; params?: {} }
    'admin.maintenance.clear_data': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'session.sessions.destroy': { paramsTuple?: []; params?: {} }
    'account.shop_profile.remove_photo': { paramsTuple?: []; params?: {} }
    'account.notifications.revoke_device': { paramsTuple?: []; params?: {} }
    'admin.auth.destroy': { paramsTuple?: []; params?: {} }
    'admin.shopkeepers.destroy': { paramsTuple: [ParamValue]; params: {'shopkeeperId': ParamValue} }
  }
  PATCH: {
    'cards.cards.update': { paramsTuple: [ParamValue]; params: {'cardId': ParamValue} }
    'account.shop_profile.update': { paramsTuple?: []; params?: {} }
    'account.notifications.update': { paramsTuple?: []; params?: {} }
    'admin.shopkeepers.update': { paramsTuple: [ParamValue]; params: {'shopkeeperId': ParamValue} }
  }
  PUT: {
    'account.shop_profile.upload_photo': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}