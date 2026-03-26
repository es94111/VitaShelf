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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const name = crypto.randomBytes(16).toString('hex')
    cb(null, `${name}${ext}`)
  },
})

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if (ALLOWED_MIME.has(file.mimetype)) {
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
