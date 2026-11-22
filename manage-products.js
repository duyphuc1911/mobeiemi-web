'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const databasePath = process.env.KEYCAP_DB_PATH || path.join(__dirname, 'data', 'keycap-store.sqlite')

if (!fs.existsSync(databasePath)) {
  console.error('Chưa có database. Hãy chạy npm start ít nhất một lần trước.')
  process.exitCode = 1
} else {
  const database = new DatabaseSync(databasePath)
  const [command, ...args] = process.argv.slice(2)

  try {
    if (command === 'list') {
      const products = database.prepare(`
        SELECT id, name, price, stock, is_active
        FROM products
        ORDER BY created_at, id
      `).all()
      if (products.length === 0) {
        console.log('Chưa có sản phẩm.')
      } else {
        console.table(products)
      }
    } else if (command === 'add') {
      const [id, name, priceValue, stockValue, ...descriptionParts] = args
      const price = Number(priceValue)
      const stock = Number(stockValue)
      const description = descriptionParts.join(' ').trim()
      if (
        !id
        || !/^[a-z0-9-]{2,100}$/.test(id)
        || !name
        || name.length > 200
        || !Number.isSafeInteger(price)
        || price < 0
        || !Number.isSafeInteger(stock)
        || stock < 0
      ) {
        throw new Error('Cú pháp: npm run products -- add <id> <tên> <giá-VND> <tồn-kho> <mô-tả>')
      }
      database.prepare(`
        INSERT INTO products (id, name, description, price, stock)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, name, description, price, stock)
      console.log(`Đã thêm sản phẩm "${name}".`)
    } else if (command === 'update') {
      const [id, priceValue, stockValue] = args
      const price = Number(priceValue)
      const stock = Number(stockValue)
      if (!id || !Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(stock) || stock < 0) {
        throw new Error('Cú pháp: npm run products -- update <id> <giá-VND> <tồn-kho>')
      }
      const result = database.prepare(`
        UPDATE products
        SET price = ?, stock = ?
        WHERE id = ?
      `).run(price, stock, id)
      if (result.changes === 0) throw new Error(`Không tìm thấy sản phẩm "${id}".`)
      console.log(`Đã cập nhật giá và tồn kho cho "${id}".`)
    } else if (command === 'deactivate') {
      const [id] = args
      if (!id) throw new Error('Cú pháp: npm run products -- deactivate <id>')
      const result = database.prepare(`
        UPDATE products
        SET is_active = 0
        WHERE id = ?
      `).run(id)
      if (result.changes === 0) throw new Error(`Không tìm thấy sản phẩm "${id}".`)
      console.log(`Đã ngừng hiển thị sản phẩm "${id}".`)
    } else {
      console.log('Quản lý sản phẩm keycap:')
      console.log('  npm run products -- list')
      console.log('  npm run products -- add <id> <tên> <giá-VND> <tồn-kho> <mô-tả>')
      console.log('  npm run products -- update <id> <giá-VND> <tồn-kho>')
      console.log('  npm run products -- deactivate <id>')
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    database.close()
  }
}
