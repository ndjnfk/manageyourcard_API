import app from '@adonisjs/core/services/app'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { randomBytes } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Profile photos on disk.
 *
 * Kept outside the database on purpose: images in MongoDB documents bloat
 * every query that reads a shop, and the shop record is read on every
 * authenticated request.
 */

/** What a browser will actually render, and nothing it will execute. */
export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

/** 2MB. A profile photo has no business being larger, and phones shoot big. */
export const MAX_PHOTO_SIZE = '2mb'

/**
 * Filenames are 32 random hex characters plus an allowed extension, and
 * nothing else is ever served. This is both the guard against path traversal —
 * "../../.env" cannot match — and what makes the files safe to serve without
 * authentication, since a name cannot be guessed.
 */
const FILENAME_PATTERN = new RegExp(`^[a-f0-9]{32}\\.(${ALLOWED_EXTENSIONS.join('|')})$`)

/** Where the files live. Outside `public`, so only the photo route reaches them. */
function storageDirectory(): string {
  return app.makePath('storage/uploads/avatars')
}

/** Absolute path of a stored photo, or null if the name isn't one we wrote. */
export function photoPathFor(filename: string): string | null {
  if (!FILENAME_PATTERN.test(filename)) return null

  return join(storageDirectory(), filename)
}

/**
 * Moves an uploaded file into storage under a fresh random name and returns
 * that name.
 *
 * The client's own filename is discarded entirely rather than sanitised.
 * Sanitising is a game of catching every case; not using it at all has no
 * cases to catch.
 */
export async function storePhoto(file: MultipartFile): Promise<string> {
  const extension = (file.extname ?? '').toLowerCase()
  const name = `${randomBytes(16).toString('hex')}.${extension}`

  await file.move(storageDirectory(), { name })

  return name
}

/**
 * Deletes a stored photo. Never throws: a leftover file is untidy, but failing
 * a profile save because an old image could not be removed would be worse.
 */
export async function deletePhoto(filename: string | null): Promise<void> {
  if (!filename) return

  const path = photoPathFor(filename)
  if (!path) return

  try {
    await unlink(path)
  } catch {
    // Already gone, or not ours to remove. Either way there is nothing to do.
  }
}
