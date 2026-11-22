'use strict'

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { promisify } = require('node:util')
const { DatabaseSync } = require('node:sqlite')

const scrypt = promisify(crypto.scrypt)
const root = __dirname
const dataDirectory = path.join(root, 'data')
const databasePath = process.env.KEYCAP_DB_PATH || path.join(dataDirectory, 'keycap-store.sqlite')
const keycapImageDirectory = path.join(root, 'uploads', 'keycaps')
const port = Number(process.env.PORT) || 3000
const host = process.env.HOST || '127.0.0.1'
const sessionDurationSeconds = 7 * 24 * 60 * 60
const maximumRequestBytes = 16 * 1024
const maximumImageBytes = 5 * 1024 * 1024
const loginAttempts = new Map()
const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : ''
const adminPassword = process.env.ADMIN_PASSWORD || ''

fs.mkdirSync(path.dirname(databasePath), { recursive: true })

const database = new DatabaseSync(databasePath)
database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    image_path TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash BLOB NOT NULL,
    password_salt BLOB NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'confirmed', 'shipping', 'completed', 'cancelled')),
    total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL CHECK (unit_price >= 0)
  );

  CREATE INDEX IF NOT EXISTS orders_user_created_idx
    ON orders (user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS order_items_order_idx
    ON order_items (order_id);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx
    ON sessions (expires_at);
  CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx
    ON admin_sessions (expires_at);
`)

if (!database.prepare('PRAGMA table_info(products)').all().some((column) => column.name === 'image_path')) {
  database.exec("ALTER TABLE products ADD COLUMN image_path TEXT NOT NULL DEFAULT ''")
}
if (!database.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'role')) {
  database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin'))")
}

function runTransaction(callback) {
  database.exec('BEGIN IMMEDIATE')
  try {
    const result = callback()
    database.exec('COMMIT')
    return result
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

const productCount = database.prepare('SELECT COUNT(*) AS count FROM products').get().count
if (productCount === 0) {
  const insertProduct = database.prepare(`
    INSERT INTO products (id, name, description, price, stock)
    VALUES (?, ?, ?, ?, ?)
  `)
  const seedProducts = () => runTransaction(() => {
    insertProduct.run(
      'pastel-dream',
      'Pastel Dream',
      'Tông màu pastel nhẹ nhàng, tạo điểm nhấn tươi mới cho góc làm việc',
      350000,
      10,
    )
    insertProduct.run(
      'berry-artisan',
      'Berry Artisan',
      'Sắc đỏ nổi bật cùng kiểu dáng độc đáo cho chiếc phím yêu thích của bạn',
      220000,
      8,
    )
    insertProduct.run(
      'cloud-white',
      'Cloud White',
      'Thiết kế tối giản, dễ phối với nhiều layout và màu bàn phím khác nhau',
      290000,
      12,
    )
  })
  seedProducts()
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

function sendJson(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  response.end(JSON.stringify(body))
}

function parseCookies(request) {
  const cookies = {}
  for (const part of (request.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    cookies[part.slice(0, separator).trim()] = part.slice(separator + 1).trim()
  }
  return cookies
}

function createSessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `keycap_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationSeconds}${secure}`
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `keycap_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
}

function createAdminSessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `keycap_admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationSeconds}${secure}`
}

function clearAdminSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `keycap_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
}

function getAuthenticatedAdmin(request) {
  const token = parseCookies(request).keycap_admin_session
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const row = database.prepare(`
    SELECT expires_at
    FROM admin_sessions
    WHERE token_hash = ? AND expires_at > ?
  `).get(tokenHash, Math.floor(Date.now() / 1000))
  return row ? { email: adminEmail } : null
}

function requireAdmin(request) {
  const admin = getAuthenticatedAdmin(request)
  if (!admin) throw new HttpError(401, 'Vui lòng đăng nhập bằng tài khoản admin.')
  return admin
}

function getAuthenticatedUser(request) {
  const token = parseCookies(request).keycap_session
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const row = database.prepare(`
    SELECT users.id, users.email, profiles.full_name, profiles.phone, profiles.address
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    JOIN profiles ON profiles.user_id = users.id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, Math.floor(Date.now() / 1000))

  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    profile: {
      full_name: row.full_name,
      phone: row.phone,
      address: row.address,
    },
  }
}

function requireUser(request) {
  const user = getAuthenticatedUser(request)
  if (!user) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.')
  return user
}

function checkRequestOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return

  let originUrl
  try {
    originUrl = new URL(origin)
  } catch {
    throw new HttpError(403, 'Nguồn yêu cầu không hợp lệ.')
  }

  if (originUrl.host !== request.headers.host) {
    throw new HttpError(403, 'Nguồn yêu cầu không được phép.')
  }
}

async function readJson(request) {
  const contentType = request.headers['content-type'] || ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Yêu cầu phải gửi dữ liệu JSON.')
  }

  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > maximumRequestBytes) {
      throw new HttpError(413, 'Dữ liệu gửi lên quá lớn.')
    }
    chunks.push(chunk)
  }

  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Body phải là một object JSON.')
    }
    return body
  } catch {
    throw new HttpError(400, 'Dữ liệu JSON không hợp lệ.')
  }
}

function checkRateLimit(request, response, route) {
  const now = Date.now()
  const key = `${route}:${request.socket.remoteAddress || 'unknown'}`
  const windowMs = 15 * 60 * 1000
  const maximumAttempts = 10
  const recentAttempts = (loginAttempts.get(key) || []).filter(
    (timestamp) => now - timestamp < windowMs,
  )

  if (recentAttempts.length >= maximumAttempts) {
    const retryAfter = Math.ceil((windowMs - (now - recentAttempts[0])) / 1000)
    sendJson(response, 429, { error: 'Thử lại quá nhiều lần. Vui lòng đợi trước khi tiếp tục.' }, {
      'Retry-After': String(retryAfter),
    })
    return false
  }

  recentAttempts.push(now)
  loginAttempts.set(key, recentAttempts)
  return true
}

function createAdminSession() {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const now = Math.floor(Date.now() / 1000)
  database.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(now)
  database.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)')
    .run(tokenHash, now + sessionDurationSeconds)
  return token
}

async function hashPassword(password, salt = crypto.randomBytes(16)) {
  const hash = await scrypt(password, salt, 64)
  return { hash: Buffer.from(hash), salt }
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationSeconds
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Math.floor(Date.now() / 1000))
  database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, expiresAt)
  return token
}

async function ensureAdminUser() {
  if (!adminEmail || !adminPassword) return

  const email = adminEmail.trim().toLowerCase()
  const existing = database.prepare(`
    SELECT id, role, password_hash, password_salt
    FROM users
    WHERE email = ? COLLATE NOCASE
  `).get(email)

  const { hash, salt } = await hashPassword(adminPassword)
  if (!existing) {
    const adminId = crypto.randomUUID()
    runTransaction(() => {
      database.prepare(`
        INSERT INTO users (id, email, password_hash, password_salt, role)
        VALUES (?, ?, ?, ?, 'admin')
      `).run(adminId, email, hash, salt)
      database.prepare(`
        INSERT OR IGNORE INTO profiles (user_id, full_name, phone, address)
        VALUES (?, 'Admin', '', '')
      `).run(adminId)
    })
    return
  }

  runTransaction(() => {
    database.prepare(`
      UPDATE users
      SET password_hash = ?, password_salt = ?, role = 'admin'
      WHERE id = ?
    `).run(hash, salt, existing.id)
    database.prepare(`
      INSERT OR IGNORE INTO profiles (user_id, full_name, phone, address)
      VALUES (?, 'Admin', '', '')
    `).run(existing.id)
  })
}

async function readProductImage(request) {
  const contentType = (request.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase()
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const extension = extensions[contentType]
  if (!extension) throw new HttpError(415, 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.')

  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > maximumImageBytes) {
      throw new HttpError(413, 'Ảnh tải lên không được vượt quá 5 MB.')
    }
    chunks.push(chunk)
  }

  const image = Buffer.concat(chunks)
  const isJpeg = extension === 'jpg'
    && image.length >= 3
    && image[0] === 0xff
    && image[1] === 0xd8
    && image[2] === 0xff
  const isPng = extension === 'png'
    && image.length >= 8
    && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isWebp = extension === 'webp'
    && image.length >= 12
    && image.toString('ascii', 0, 4) === 'RIFF'
    && image.toString('ascii', 8, 12) === 'WEBP'
  if (!isJpeg && !isPng && !isWebp) {
    throw new HttpError(400, 'Nội dung ảnh không hợp lệ.')
  }

  return { image, extension }
}

function validateEmail(email) {
  return typeof email === 'string'
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateProfile(profile) {
  if (
    typeof profile.full_name !== 'string'
    || profile.full_name.trim().length < 2
    || profile.full_name.trim().length > 100
  ) {
    throw new HttpError(400, 'Họ tên phải dài từ 2 đến 100 ký tự.')
  }

  if (
    typeof profile.phone !== 'string'
    || !/^[+\d()\-\s]{8,20}$/.test(profile.phone.trim())
  ) {
    throw new HttpError(400, 'Số điện thoại không hợp lệ.')
  }

  if (
    typeof profile.address !== 'string'
    || profile.address.trim().length < 8
    || profile.address.trim().length > 500
  ) {
    throw new HttpError(400, 'Địa chỉ phải dài từ 8 đến 500 ký tự.')
  }

  return {
    full_name: profile.full_name.trim(),
    phone: profile.phone.trim(),
    address: profile.address.trim(),
  }
}

function loadOrders(userId) {
  const orders = database.prepare(`
    SELECT id, status, total_amount, created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 20
  `).all(userId)
  const getItems = database.prepare(`
    SELECT product_name, quantity
    FROM order_items
    WHERE order_id = ?
    ORDER BY id
  `)

  return orders.map((order) => ({
    ...order,
    order_items: getItems.all(order.id),
  }))
}

function serveStatic(request, response, pathname) {
  function sendNotFoundPage() {
    fs.readFile(path.join(root, '404.html'), (error, content) => {
      if (error) {
        console.error('Unable to read the custom 404 page:', error)
        sendJson(response, 500, { error: 'Đã xảy ra lỗi máy chủ.' })
        return
      }

      response.writeHead(404, {
        'Cache-Control': 'no-store',
        'Content-Length': content.length,
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      })
      response.end(request.method === 'HEAD' ? undefined : content)
    })
  }

  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    throw new HttpError(400, 'Đường dẫn không hợp lệ.')
  }

  if (
    decodedPath.includes('\0')
    || decodedPath.split('/').some((part) => part.startsWith('.'))
    || /^\/(data|node_modules)(\/|$)/i.test(decodedPath)
  ) {
    sendNotFoundPage()
    return
  }

  let filePath = path.resolve(root, `.${decodedPath}`)
  if (decodedPath === '/') filePath = path.join(root, 'index.html')
  const relativePath = path.relative(root, filePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    sendNotFoundPage()
    return
  }

  const extension = path.extname(filePath).toLowerCase()
  const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  }

  if (
    !mimeTypes[extension]
    || ['server.js', 'manage-products.js'].includes(path.basename(filePath))
  ) {
    sendNotFoundPage()
    return
  }

  fs.stat(filePath, (error, fileStats) => {
    if (error || !fileStats.isFile()) {
      sendNotFoundPage()
      return
    }

    response.writeHead(200, {
      'Cache-Control': ['.html', '.js'].includes(extension) ? 'no-cache' : 'public, max-age=3600',
      'Content-Length': fileStats.size,
      'Content-Type': mimeTypes[extension],
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    })
    fs.createReadStream(filePath).pipe(response)
  })
}

async function handleApi(request, response, pathname) {
  const method = request.method
  if (!pathname.startsWith('/api/')) return false

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    checkRequestOrigin(request)
  }

  if (pathname === '/api/admin/me' && method === 'GET') {
    const admin = getAuthenticatedAdmin(request)
    sendJson(response, 200, { admin })
    return true
  }

  if (pathname === '/api/admin/login' && method === 'POST') {
    if (!adminEmail || !adminPassword) {
      throw new HttpError(503, 'Admin chưa được cấu hình trên máy chủ.')
    }
    if (!checkRateLimit(request, response, 'admin-login')) return true
    const body = await readJson(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const emailMatches = crypto.timingSafeEqual(
      crypto.createHash('sha256').update(email).digest(),
      crypto.createHash('sha256').update(adminEmail).digest(),
    )
    const passwordMatches = crypto.timingSafeEqual(
      crypto.createHash('sha256').update(password).digest(),
      crypto.createHash('sha256').update(adminPassword).digest(),
    )
    if (!emailMatches || !passwordMatches) {
      throw new HttpError(401, 'Email hoặc mật khẩu admin không chính xác.')
    }

    const token = createAdminSession()
    sendJson(response, 200, { admin: { email: adminEmail } }, {
      'Set-Cookie': createAdminSessionCookie(token),
    })
    return true
  }

  if (pathname === '/api/admin/logout' && method === 'POST') {
    const token = parseCookies(request).keycap_admin_session
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash)
    }
    sendJson(response, 200, { success: true }, { 'Set-Cookie': clearAdminSessionCookie() })
    return true
  }

  if (pathname === '/api/admin/products' && method === 'GET') {
    requireAdmin(request)
    const products = database.prepare(`
      SELECT id, name, description, price, stock, is_active, image_path
      FROM products
      ORDER BY created_at, id
    `).all()
    sendJson(response, 200, { products })
    return true
  }

  const adminImageMatch = pathname.match(/^\/api\/admin\/products\/([a-z0-9-]{2,100})\/image$/)
  if (adminImageMatch && method === 'POST') {
    requireAdmin(request)
    const product = database.prepare('SELECT image_path FROM products WHERE id = ?').get(adminImageMatch[1])
    if (!product) throw new HttpError(404, 'Không tìm thấy sản phẩm.')

    const { image, extension } = await readProductImage(request)
    const fileName = `${crypto.randomUUID()}.${extension}`
    const imagePath = path.join(keycapImageDirectory, fileName)
    const publicPath = `/uploads/keycaps/${fileName}`
    fs.mkdirSync(keycapImageDirectory, { recursive: true })
    fs.writeFileSync(imagePath, image, { flag: 'wx' })
    try {
      database.prepare('UPDATE products SET image_path = ? WHERE id = ?')
        .run(publicPath, adminImageMatch[1])
    } catch (error) {
      fs.unlinkSync(imagePath)
      throw error
    }

    const previousUpload = typeof product.image_path === 'string'
      ? product.image_path.match(/^\/uploads\/keycaps\/[a-f0-9-]+\.(?:jpg|png|webp)$/)
      : null
    if (previousUpload) {
      const oldPath = path.join(root, previousUpload[0].slice(1).replaceAll('/', path.sep))
      if (oldPath !== imagePath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }
    sendJson(response, 200, { image_path: publicPath })
    return true
  }

  const adminProductMatch = pathname.match(/^\/api\/admin\/products\/([a-z0-9-]{2,100})$/)
  if (adminProductMatch && method === 'PUT') {
    requireAdmin(request)
    const body = await readJson(request)
    if (!Number.isSafeInteger(body.price) || body.price < 0) {
      throw new HttpError(400, 'Giá phải là số nguyên VND không âm.')
    }
    const result = database.prepare('UPDATE products SET price = ? WHERE id = ?')
      .run(body.price, adminProductMatch[1])
    if (result.changes === 0) throw new HttpError(404, 'Không tìm thấy sản phẩm.')
    sendJson(response, 200, { success: true })
    return true
  }

  if (pathname === '/api/products' && method === 'GET') {
    const products = database.prepare(`
      SELECT id, name, description, price, stock, image_path
      FROM products
      WHERE is_active = 1
      ORDER BY created_at, id
    `).all()
    sendJson(response, 200, { products })
    return true
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = getAuthenticatedUser(request)
    sendJson(response, 200, {
      user: user ? { id: user.id, email: user.email } : null,
      profile: user ? user.profile : null,
    })
    return true
  }

  if (pathname === '/api/auth/register' && method === 'POST') {
    if (!checkRateLimit(request, response, 'register')) return true
    const body = await readJson(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!validateEmail(email)) throw new HttpError(400, 'Vui lòng nhập email hợp lệ.')
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
      throw new HttpError(400, 'Mật khẩu phải dài từ 8 đến 128 ký tự.')
    }
    if (
      typeof body.fullName !== 'string'
      || body.fullName.trim().length < 2
      || body.fullName.trim().length > 100
    ) {
      throw new HttpError(400, 'Họ tên phải dài từ 2 đến 100 ký tự.')
    }

    if (adminEmail && email === adminEmail.trim().toLowerCase()) {
      throw new HttpError(409, 'Email admin đã được giữ riêng cho quản trị viên.')
    }

    const { hash, salt } = await hashPassword(body.password)
    const id = crypto.randomUUID()
    try {
      runTransaction(() => {
        database.prepare(`
          INSERT INTO users (id, email, password_hash, password_salt, role)
          VALUES (?, ?, ?, ?, 'customer')
        `).run(id, email, hash, salt)
        database.prepare(`
          INSERT INTO profiles (user_id, full_name)
          VALUES (?, ?)
        `).run(id, body.fullName.trim())
      })
    } catch (error) {
      if (error.errcode === 2067 || String(error.code).includes('CONSTRAINT')) {
        throw new HttpError(409, 'Email này đã được đăng ký.')
      }
      throw error
    }

    const token = await createSession(id)
    sendJson(response, 201, {
      user: { id, email },
      profile: { full_name: body.fullName.trim(), phone: '', address: '' },
    }, { 'Set-Cookie': createSessionCookie(token) })
    return true
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    if (!checkRateLimit(request, response, 'login')) return true
    const body = await readJson(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!validateEmail(email) || typeof body.password !== 'string' || body.password.length > 128) {
      throw new HttpError(400, 'Email hoặc mật khẩu không hợp lệ.')
    }

    const account = database.prepare(`
      SELECT id, email, password_hash, password_salt, role
      FROM users
      WHERE email = ? COLLATE NOCASE
    `).get(email)

    if (account && account.role === 'admin') {
      const { hash } = await hashPassword(body.password, account.password_salt)
      const passwordMatches = crypto.timingSafeEqual(hash, Buffer.from(account.password_hash))
      if (!passwordMatches) {
        throw new HttpError(401, 'Email hoặc mật khẩu không chính xác.')
      }

      const token = createAdminSession()
      sendJson(response, 200, { admin: { email: account.email }, role: 'admin' }, {
        'Set-Cookie': createAdminSessionCookie(token),
      })
      return true
    }

    if (!account && adminEmail && email === adminEmail.toLowerCase()) {
      const emailMatches = crypto.timingSafeEqual(
        crypto.createHash('sha256').update(email).digest(),
        crypto.createHash('sha256').update(adminEmail).digest(),
      )
      const passwordMatches = crypto.timingSafeEqual(
        crypto.createHash('sha256').update(body.password).digest(),
        crypto.createHash('sha256').update(adminPassword).digest(),
      )

      if (emailMatches && passwordMatches) {
        const token = createAdminSession()
        sendJson(response, 200, { admin: { email: adminEmail }, role: 'admin' }, {
          'Set-Cookie': createAdminSessionCookie(token),
        })
        return true
      }
    }

    const customerAccount = account && account.role === 'customer' ? account : null
    const salt = customerAccount ? customerAccount.password_salt : Buffer.alloc(16)
    const { hash } = await hashPassword(body.password, salt)
    const passwordMatches = customerAccount
      && crypto.timingSafeEqual(hash, Buffer.from(customerAccount.password_hash))

    if (!passwordMatches) throw new HttpError(401, 'Email hoặc mật khẩu không chính xác.')

    const token = await createSession(customerAccount.id)
    const user = getAuthenticatedUser({
      headers: { cookie: `keycap_session=${token}` },
    })
    sendJson(response, 200, {
      user: { id: user.id, email: user.email },
      profile: user.profile,
    }, { 'Set-Cookie': createSessionCookie(token) })
    return true
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = parseCookies(request).keycap_session
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
    }
    sendJson(response, 200, { success: true }, { 'Set-Cookie': clearSessionCookie() })
    return true
  }

  if (pathname === '/api/profile' && method === 'GET') {
    const user = requireUser(request)
    sendJson(response, 200, { profile: user.profile })
    return true
  }

  if (pathname === '/api/profile' && method === 'PUT') {
    const user = requireUser(request)
    const profile = validateProfile(await readJson(request))
    database.prepare(`
      UPDATE profiles
      SET full_name = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(profile.full_name, profile.phone, profile.address, user.id)
    sendJson(response, 200, { profile })
    return true
  }

  if (pathname === '/api/orders' && method === 'GET') {
    const user = requireUser(request)
    sendJson(response, 200, { orders: loadOrders(user.id) })
    return true
  }

  if (pathname === '/api/orders' && method === 'POST') {
    const user = requireUser(request)
    const body = await readJson(request)
    if (typeof body.productId !== 'string' || body.productId.length > 100) {
      throw new HttpError(400, 'Sản phẩm không hợp lệ.')
    }

    const transaction = () => runTransaction(() => {
      const profile = database.prepare(`
        SELECT full_name, phone, address
        FROM profiles
        WHERE user_id = ?
      `).get(user.id)
      if (!profile) throw new HttpError(400, 'Vui lòng lưu thông tin nhận hàng trước khi đặt.')

      const validatedProfile = validateProfile(profile)
      const product = database.prepare(`
        SELECT id, name, price, stock
        FROM products
        WHERE id = ? AND is_active = 1
      `).get(body.productId)
      if (!product) throw new HttpError(404, 'Sản phẩm không tồn tại hoặc đã ngừng bán.')
      if (product.stock < 1) throw new HttpError(409, 'Sản phẩm hiện đã hết hàng.')

      const orderId = crypto.randomUUID()
      database.prepare(`
        INSERT INTO orders (id, user_id, full_name, phone, address, total_amount)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        user.id,
        validatedProfile.full_name,
        validatedProfile.phone,
        validatedProfile.address,
        product.price,
      )
      database.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
        VALUES (?, ?, ?, 1, ?)
      `).run(orderId, product.id, product.name, product.price)
      database.prepare(`
        UPDATE products
        SET stock = stock - 1
        WHERE id = ? AND stock > 0
      `).run(product.id)
      return orderId
    })

    sendJson(response, 201, { orderId: transaction() })
    return true
  }

  if (method !== 'GET' && method !== 'HEAD') {
    sendJson(response, 405, { error: 'Phương thức không được hỗ trợ.' }, { Allow: 'GET, HEAD' })
    return true
  }

  sendJson(response, 404, { error: 'Không tìm thấy API.' })
  return true
}

ensureAdminUser().catch((error) => {
  console.error('Unable to initialize admin user:', error)
})

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
    if (await handleApi(request, response, requestUrl.pathname)) return
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Phương thức không được hỗ trợ.' }, { Allow: 'GET, HEAD' })
      return
    }
    serveStatic(request, response, requestUrl.pathname)
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    if (statusCode === 500) console.error(error)
    if (!response.headersSent) {
      sendJson(response, statusCode, {
        error: statusCode === 500 ? 'Đã xảy ra lỗi máy chủ.' : error.message,
      })
    } else {
      response.destroy()
    }
  }
})

server.listen(port, host, () => {
  console.log(`Keycap store running at http://${host}:${port}`)
  console.log(`SQLite database: ${databasePath}`)
})

function closeDatabase() {
  server.close(() => {
    database.close()
    process.exit(0)
  })
}

process.on('SIGINT', closeDatabase)
process.on('SIGTERM', closeDatabase)
