import vine from '@vinejs/vine'

/**
 * A destructive maintenance action.
 *
 * The typed confirmation is the point: these wipe every shop's data, and a
 * misplaced click should not be enough. The panel asks the admin to type the
 * phrase, and the API refuses anything else — so the guard holds for a request
 * sent by hand as well as one sent by the panel.
 */
export const maintenanceValidator = vine.create({
  confirm: vine.literal('CONFIRM'),
})
