/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    registration: {
      store: typeof routes['auth.registration.store']
    }
    sessions: {
      store: typeof routes['auth.sessions.store']
    }
    newAccount: {
      store: typeof routes['auth.new_account.store']
    }
  }
  session: {
    sessions: {
      show: typeof routes['session.sessions.show']
      destroy: typeof routes['session.sessions.destroy']
    }
  }
  cards: {
    cards: {
      index: typeof routes['cards.cards.index']
      store: typeof routes['cards.cards.store']
      show: typeof routes['cards.cards.show']
      update: typeof routes['cards.cards.update']
    }
  }
  account: {
    shopProfile: {
      show: typeof routes['account.shop_profile.show']
      update: typeof routes['account.shop_profile.update']
      uploadPhoto: typeof routes['account.shop_profile.upload_photo']
      removePhoto: typeof routes['account.shop_profile.remove_photo']
    }
    notifications: {
      show: typeof routes['account.notifications.show']
      update: typeof routes['account.notifications.update']
      registerDevice: typeof routes['account.notifications.register_device']
      revokeDevice: typeof routes['account.notifications.revoke_device']
      test: typeof routes['account.notifications.test']
      inbox: typeof routes['account.notifications.inbox']
      unreadCount: typeof routes['account.notifications.unread_count']
      markAllRead: typeof routes['account.notifications.mark_all_read']
      markRead: typeof routes['account.notifications.mark_read']
    }
  }
  adminAuth: {
    auth: {
      store: typeof routes['adminAuth.auth.store']
    }
  }
  admin: {
    auth: {
      show: typeof routes['admin.auth.show']
      destroy: typeof routes['admin.auth.destroy']
    }
    maintenance: {
      stats: typeof routes['admin.maintenance.stats']
      logOutShopkeepers: typeof routes['admin.maintenance.log_out_shopkeepers']
      clearRedis: typeof routes['admin.maintenance.clear_redis']
      clearData: typeof routes['admin.maintenance.clear_data']
    }
    shopkeepers: {
      index: typeof routes['admin.shopkeepers.index']
      show: typeof routes['admin.shopkeepers.show']
      update: typeof routes['admin.shopkeepers.update']
      destroy: typeof routes['admin.shopkeepers.destroy']
      cards: typeof routes['admin.shopkeepers.cards']
    }
  }
  shopProfile: {
    servePhoto: typeof routes['shop_profile.serve_photo']
  }
}
