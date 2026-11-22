'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const databasePath = process.env.KEYCAP_DB_PATH || path.join(__dirname, 'data', 'keycap-store.sqlite')
const validStatuses = new Set(['pending', 'confirmed', 'shipping', 'completed', 'cancelled'])

if (!fs.existsSync(databasePath)) {
  console.error('Chưa có database. Hãy chạy npm start ít nhất một lần trước.')
  process.exitCode = 1
} else {
  const database = new DatabaseSync(databasePath)
  const [command, ...args] = process.argv.slice(2)

  try {
    if (command === 'list') {
      const orders = database.prepare(`
        SELECT
          orders.id,
          users.email,
          orders.full_name,
          orders.phone,
          orders.address,
          orders.status,
          orders.total_amount,
          orders.created_at,
          GROUP_CONCAT(order_items.product_name || ' x' || order_items.quantity, ', ') AS items
        FROM orders
        JOIN users ON users.id = orders.user_id
        JOIN order_items ON order_items.order_id = orders.id
        GROUP BY orders.id
        ORDER BY orders.created_at DESC
      `).all()
      if (orders.length === 0) {
        console.log('Chưa có đơn hàng.')
      } else {
        console.table(orders)
      }
    } else if (command === 'status') {
      const [orderPrefix, nextStatus] = args
      if (!orderPrefix || !/^[a-f0-9-]{4,36}$/i.test(orderPrefix)) {
        throw new Error('Cú pháp: npm run orders -- status <mã-đơn-hoặc-tiền-tố> <pending|confirmed|shipping|completed|cancelled>')
      }
      if (!validStatuses.has(nextStatus)) {
        throw new Error('Trạng thái hợp lệ: pending, confirmed, shipping, completed, cancelled.')
      }

      const matches = database.prepare(`
        SELECT id
        FROM orders
        WHERE lower(id) LIKE lower(?) || '%'
      `).all(orderPrefix)

      if (matches.length === 0) throw new Error(`Không tìm thấy đơn "${orderPrefix}".`)
      if (matches.length > 1) throw new Error('Mã đơn chưa đủ dài và khớp nhiều đơn; hãy nhập thêm ký tự.')

      database.prepare('UPDATE orders SET status = ? WHERE id = ?')
        .run(nextStatus, matches[0].id)
      console.log(`Đã cập nhật đơn ${matches[0].id} thành "${nextStatus}".`)
    } else {
      console.log('Quản lý đơn hàng keycap:')
      console.log('  npm run orders -- list')
      console.log('  npm run orders -- status <mã-đơn-hoặc-tiền-tố> <pending|confirmed|shipping|completed|cancelled>')
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    database.close()
  }
}
