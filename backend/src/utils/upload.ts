import multer, { type FileFilterCallback } from 'multer'
import path from 'path'
import crypto from 'crypto'
import type { Request } from 'express'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.resolve(__dirname, '../../uploads')
const MAX_SIZE   = 5 * 1024 * 1024  // 5 MB

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
])

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
}

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const MIME_ALLOWED_EXTENSIONS: Record<string, Set<string>> = {
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/png': new Set(['.png']),
  'image/webp': new Set(['.webp']),
  'image/avif': new Set(['.avif']),
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = MIME_EXTENSION[file.mimetype]
    if (!ext) {
      cb(new Error('不支援的檔案格式'), '')
      return
    }
    const name = crypto.randomBytes(16).toString('hex')
    cb(null, `${name}${ext}`)
  },
})

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  const ext = path.extname(file.originalname).toLowerCase()
  const expectedExt = MIME_EXTENSION[file.mimetype]
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new Error('副檔名必須為 .jpg、.jpeg、.png、.webp、.avif'))
    return
  }

  const mimeMatchedExt = MIME_ALLOWED_EXTENSIONS[file.mimetype]
  if (ALLOWED_MIME.has(file.mimetype) && expectedExt && mimeMatchedExt?.has(ext)) {
    cb(null, true)
  } else {
    cb(new Error('只接受 JPG、PNG、WebP、AVIF 格式的圖片'))
  }
}

/** Single-file upload for product images — field name: `image` */
export const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).single('image')

/** Wrap multer in a promise so routes can use async/await */
export function handleUpload(
  req: Request,
  res: Parameters<typeof uploadProductImage>[1],
): Promise<void> {
  return new Promise((resolve, reject) => {
    uploadProductImage(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? `檔案大小超過 ${MAX_SIZE / 1024 / 1024}MB 上限`
          : err.message
        reject(Object.assign(new Error(msg), { statusCode: 400 }))
      } else if (err) {
        reject(Object.assign(err, { statusCode: 400 }))
      } else {
        resolve()
      }
    })
  })
}
