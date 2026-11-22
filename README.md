# Mobeiemi Portfolio & Keycap Store


Website gồm hai phần:

- **Portfolio**: trang giới thiệu, kỹ năng và dự án.
- **Keycap Store**: cửa hàng demo có đăng ký/đăng nhập, hồ sơ khách hàng, đặt hàng và trang quản trị sản phẩm.

Frontend dùng HTML, CSS, Sass và JavaScript thuần. Backend dùng Node.js tích hợp sẵn HTTP server và SQLite; không cần cài MySQL/PostgreSQL hay chạy một dịch vụ database riêng.

## Yêu cầu

- Node.js **22.5.0 trở lên** (dự án dùng `node:sqlite`).
- npm đi kèm Node.js.

Kiểm tra phiên bản:

```powershell
node --version
npm --version
```

## Cài đặt và chạy

Mở PowerShell tại thư mục dự án:

```powershell
npm install
npm start
```

Mở <http://127.0.0.1:3000>. Không mở HTML trực tiếp bằng `file://`: các trang cửa hàng cần gọi API từ server và server mới kết nối database.

Mặc định server chỉ nghe trên `127.0.0.1:3000`. Có thể cấu hình host/cổng bằng `HOST` và `PORT`.

### Tài khoản quản trị

Đặt email và mật khẩu admin trong môi trường của terminal trước khi chạy server. Ví dụ PowerShell:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "dung-dat-mat-khau-nay-trong-ma-nguon"
npm start
```

Truy cập <http://127.0.0.1:3000/login-admin.html>. Nếu hai biến chưa được đặt, chức năng admin không được cấu hình. Không ghi mật khẩu thật vào mã nguồn hoặc đưa file chứa bí mật lên Git.

## Bản đồ dự án

### Thư mục gốc

| File | Vai trò |
| --- | --- |
| `README.md` | Tài liệu cài đặt, sử dụng, cấu trúc mã nguồn và SQLite. |
| `package.json` | Tên dự án, yêu cầu phiên bản Node.js và các lệnh npm. |
| `package-lock.json` | Khóa phiên bản dependency để các lần cài đặt nhất quán. |
| `.gitignore` | Loại `node_modules`, database, file WAL, ảnh tải lên, log và cấu hình môi trường khỏi Git. |
| `server.js` | Backend chính: tạo schema SQLite, khởi tạo dữ liệu mẫu, xử lý API, phiên đăng nhập, phục vụ file web và đóng database. |
| `manage-products.js` | Tiện ích dòng lệnh để liệt kê, thêm, cập nhật hoặc ẩn sản phẩm trong SQLite. |
| `manage-orders.js` | Tiện ích dòng lệnh để xem đơn và thay đổi trạng thái đơn. |
| `index.html` | Trang portfolio chính: giới thiệu, kỹ năng, dự án và liên hệ. |
| `index.js` | Menu responsive, nút hiện/ẩn mật khẩu và xuất danh sách kỹ năng/dự án ra CSV. |
| `project-1.html` | Trang case study dự án 1 (Cybersecurity Learning Lab). |
| `project-2.html` | Trang case study dự án 2 (Growth & Ads Project). |
| `account.html` | Giao diện đăng ký/đăng nhập và thông tin tài khoản khách hàng. |
| `keycap-store.html` | Giao diện cửa hàng, danh sách sản phẩm, đặt hàng và lịch sử đơn. |
| `keycap-store.js` | JavaScript cửa hàng: gọi API, hiển thị sản phẩm/đơn hàng và xử lý xác thực, hồ sơ, đặt hàng. |
| `login-admin.html` | Trang đăng nhập admin và giao diện quản lý sản phẩm sau khi đăng nhập. |
| `admin.js` | JavaScript admin: kiểm tra phiên, đăng nhập/đăng xuất, cập nhật giá và tải ảnh sản phẩm. |
| `admin.html` | Đường dẫn tương thích cũ; tự chuyển hướng sang `login-admin.html`. |
| `404.html` | Trang báo lỗi khi đường dẫn không tồn tại. |

### Giao diện và tài nguyên

| Đường dẫn | Vai trò |
| --- | --- |
| `css/style.css` | CSS chính được các trang portfolio và cửa hàng dùng. Đây là CSS sinh từ Sass; sửa Sass rồi biên dịch nếu muốn thay đổi có thể tái tạo. |
| `css/admin.css` | Kiểu riêng cho khu vực đăng nhập/quản trị. |
| `css/404.css` | Kiểu riêng cho trang 404. |
| `sass/main.scss` | Điểm vào Sass; nhập các biến, mixin, base, component và style trang. |
| `sass/abstracts/_variables.scss` | Biến dùng chung như màu sắc, kích thước và breakpoint. |
| `sass/abstracts/_mixins.scss` | Mixin Sass dùng để tái sử dụng các quy tắc style. |
| `sass/abstracts/_utilities.scss` | Các class tiện ích dùng chung. |
| `sass/base/_base.scss` | Reset và style nền tảng cho phần tử HTML. |
| `sass/components/_header.scss` | Header và menu điều hướng. |
| `sass/components/_footer.scss` | Footer. |
| `sass/components/_mouse-scroll.scss` | Chỉ báo cuộn trang. |
| `sass/components/_skills.scss` | Thành phần hiển thị kỹ năng. |
| `sass/pages/_home.scss` | Bố cục và style trang chủ/portfolio. |
| `sass/pages/_project-case-study.scss` | Style các trang case study dự án. |
| `assets/jpeg/mobeiemi.jpg` | Ảnh đại diện/chân dung trên portfolio. |
| `assets/jpeg/project-mockup-example.jpeg` | Ảnh mockup dùng trong nội dung dự án. |
| `assets/png/github-ico.png` | Biểu tượng GitHub. |
| `assets/png/insta-ico.png` | Biểu tượng Instagram. |
| `assets/png/pj1.png`, `assets/png/pj2.png` | Ảnh minh họa dự án 1 và 2. |
| `assets/svg/common-bg.svg` | Hình nền SVG dùng trong giao diện. |
| `assets/svg/ham-menu.svg`, `assets/svg/ham-menu-close.svg` | Biểu tượng mở/đóng menu trên màn hình nhỏ. |

### Thư mục dữ liệu được tạo khi chạy

- `data/keycap-store.sqlite`: database cửa hàng mặc định. Server tự tạo thư mục, bảng và ba sản phẩm mẫu khi khởi động lần đầu.
- `data/keycap-store.sqlite-wal`, `data/keycap-store.sqlite-shm`: file phụ SQLite dùng bởi chế độ WAL; SQLite tự quản lý chúng. Không xóa hoặc di chuyển các file này khi server đang chạy.
- `uploads/keycaps/`: ảnh JPEG, PNG hoặc WebP admin tải lên; giới hạn 5 MB mỗi ảnh.
- `node_modules/`: dependency cài từ npm.

Các dữ liệu runtime này không được commit lên Git. Hãy sao lưu database và ảnh tải lên riêng nếu cần giữ dữ liệu cửa hàng.

### Những phần chính trong `server.js`

- **Cấu hình đầu file**: đọc `HOST`, `PORT`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `KEYCAP_DB_PATH`; đặt giới hạn kích thước request/ảnh.
- **Khởi tạo database**: mở file SQLite, bật foreign key/WAL, tạo bảng và index; bổ sung cột cho database cũ nếu thiếu; tạo sản phẩm mẫu nếu chưa có sản phẩm.
- **Hàm dùng chung**: giao dịch, trả JSON, đọc cookie, kiểm tra phiên và quyền admin/khách, kiểm tra dữ liệu, giới hạn đăng nhập và đọc đơn hàng.
- **Phục vụ file tĩnh**: trả HTML/CSS/JS/ảnh và trang 404; không cho truy cập thư mục riêng như `data` và `node_modules`.
- **API**: xử lý đăng nhập, tài khoản, hồ sơ, sản phẩm, admin và đơn hàng.
- **Khởi động/tắt**: tạo HTTP server, in địa chỉ và đường dẫn database ra terminal; đóng kết nối database khi nhận tín hiệu tắt.

### Các API chính

| Phương thức | Đường dẫn | Chức năng |
| --- | --- | --- |
| `GET` | `/api/products` | Lấy sản phẩm đang bán. |
| `GET` | `/api/auth/me` | Kiểm tra phiên khách hiện tại. |
| `POST` | `/api/auth/register` | Tạo tài khoản khách. |
| `POST` | `/api/auth/login` | Đăng nhập khách hoặc admin. |
| `POST` | `/api/auth/logout` | Đăng xuất khách. |
| `GET`, `PUT` | `/api/profile` | Đọc hoặc lưu hồ sơ khách đã đăng nhập. |
| `GET`, `POST` | `/api/orders` | Xem đơn hoặc tạo đơn hàng; khi tạo đơn, server kiểm tra tồn kho và cập nhật đơn/sản phẩm trong một giao dịch. |
| `GET` | `/api/admin/me` | Kiểm tra phiên admin. |
| `POST` | `/api/admin/login`, `/api/admin/logout` | Đăng nhập hoặc đăng xuất admin. |
| `GET` | `/api/admin/products` | Lấy danh sách sản phẩm cho admin. |
| `PUT` | `/api/admin/products/:id` | Cập nhật giá sản phẩm. |
| `POST` | `/api/admin/products/:id/image` | Tải ảnh sản phẩm lên. |

## SQLite trong dự án

**SQLite** là cơ sở dữ liệu quan hệ lưu trong một file. Ở dự án này, Node.js mở file `data/keycap-store.sqlite` bằng module tích hợp `node:sqlite` (`DatabaseSync`); không có dịch vụ database riêng, host database, cổng database hay tài khoản database để cấu hình.

Khi `server.js` khởi động, ứng dụng:

1. Dùng `KEYCAP_DB_PATH` nếu biến này đã được đặt; nếu không, dùng `data/keycap-store.sqlite` trong thư mục dự án.
2. Tạo thư mục chứa database nếu chưa có.
3. Tạo các bảng và index nếu chưa tồn tại, bật khóa ngoại và chế độ WAL.
4. Thêm ba sản phẩm mẫu nếu bảng `products` chưa có sản phẩm.

Để lưu database ở vị trí khác trên Windows, đặt biến `KEYCAP_DB_PATH` trước khi chạy server. Ví dụ:

```powershell
$env:KEYCAP_DB_PATH = "D:\keycap-data\keycap-store.sqlite"
npm start
```

Giữ nguyên biến này trong terminal khi chạy các lệnh `npm run products` hoặc `npm run orders`; nếu không, các script sẽ mở database mặc định thay vì file tùy chỉnh.

Các bảng chính:

| Bảng | Dữ liệu |
| --- | --- |
| `products` | Sản phẩm: mã, tên, mô tả, giá VND, tồn kho, trạng thái đang bán và đường dẫn ảnh. |
| `users` | Tài khoản khách: email duy nhất, hash và salt mật khẩu, vai trò. Mật khẩu gốc không được lưu. |
| `profiles` | Họ tên, số điện thoại và địa chỉ; liên kết với `users`. |
| `sessions` | Phiên đăng nhập khách; lưu hash token và thời điểm hết hạn. |
| `admin_sessions` | Phiên đăng nhập admin; lưu hash token và thời điểm hết hạn. |
| `orders` | Đơn hàng, thông tin nhận hàng tại thời điểm đặt, trạng thái và tổng tiền. |
| `order_items` | Các dòng sản phẩm trong đơn; lưu tên và giá tại thời điểm mua. |

Quan hệ quan trọng: `profiles.user_id` và `sessions.user_id` tham chiếu `users`; `orders.user_id` tham chiếu `users`; `order_items.order_id` tham chiếu `orders`, còn `order_items.product_id` tham chiếu `products`. Khóa ngoại và giao dịch giúp tránh đơn hàng ghi dở hoặc tồn kho âm.

Trạng thái đơn hàng có thể là `pending`, `confirmed`, `shipping`, `completed` hoặc `cancelled`. Thanh toán trực tuyến và gửi email xác nhận chưa được tích hợp.

## Kết nối và xem SQLite

### Dùng DB Browser for SQLite (giao diện)

1. Cài DB Browser for SQLite từ trang chính thức của dự án đó.
2. Khởi động ứng dụng bằng `npm start` ít nhất một lần để database được tạo.
3. Trong DB Browser, chọn **Open Database...** và mở file `data\keycap-store.sqlite` ở thư mục dự án (hoặc file ở vị trí `KEYCAP_DB_PATH` nếu đã cấu hình).
4. Vào **Browse Data** để chọn bảng như `products`, `users`, `orders` hoặc `order_items`; dùng **Execute SQL** để chạy truy vấn.
5. Nếu chỉ cần xem, không sửa dữ liệu. Nếu cần chỉnh sửa bằng DB Browser, dừng server trước để tránh xung đột với tiến trình đang ghi database.

Không chia sẻ file database công khai: nó có email, hồ sơ khách hàng, địa chỉ nhận hàng và dữ liệu phiên. Nếu chỉnh sửa trực tiếp, hãy sao lưu trước. Không xóa các file `-wal`/`-shm` trong lúc server đang hoạt động.

### Kết nối từ Node.js

Ứng dụng và các script quản lý đã kết nối theo mẫu dưới đây:

```js
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const databasePath = path.join(__dirname, 'data', 'keycap-store.sqlite')
const database = new DatabaseSync(databasePath)

const products = database.prepare(
  'SELECT id, name, price, stock FROM products WHERE is_active = 1',
).all()

console.table(products)
database.close()
```

`DatabaseSync` là API đồng bộ: `prepare()` tạo câu lệnh, `.all()` lấy nhiều dòng, `.get()` lấy một dòng, `.run()` chạy lệnh thêm/sửa/xóa. Dùng dấu `?` và tham số `.run(...)`/`.get(...)` cho dữ liệu đầu vào thay vì nối chuỗi SQL; đóng kết nối bằng `database.close()` khi xong.

### Truy vấn mẫu

```sql
SELECT id, name, price, stock, is_active
FROM products
ORDER BY name;

SELECT id, full_name, phone, address
FROM profiles;

SELECT id, user_id, status, total_amount, created_at
FROM orders
ORDER BY created_at DESC;

SELECT order_id, product_name, quantity, unit_price
FROM order_items
ORDER BY order_id;
```

## Quản lý cửa hàng

Tắt server trước khi chạy script quản lý SQLite để tránh ghi đồng thời.

Liệt kê sản phẩm:

```powershell
npm run products -- list
```

Thêm sản phẩm (giá tính theo VND, tồn kho là số nguyên không âm):

```powershell
npm run products -- add artisan-mau-do "Artisan Màu Đỏ" 250000 5 "Keycap artisan thủ công"
```

Cập nhật giá/tồn kho hoặc ẩn sản phẩm:

```powershell
npm run products -- update artisan-mau-do 270000 8
npm run products -- deactivate artisan-mau-do
```

Liệt kê đơn hàng và cập nhật trạng thái bằng toàn bộ mã hoặc tiền tố đủ phân biệt:

```powershell
npm run orders -- list
npm run orders -- status <ma-don-hoac-tien-to> confirmed
```

Admin cũng có thể cập nhật giá và ảnh ở `login-admin.html`. Sản phẩm ẩn và đơn hàng cũ vẫn được giữ trong database.

## Các lệnh npm

| Lệnh | Tác dụng |
| --- | --- |
| `npm start` | Chạy backend và website tại host/cổng cấu hình. |
| `npm run products -- ...` | Chạy tiện ích quản lý sản phẩm. |
| `npm run orders -- ...` | Chạy tiện ích quản lý đơn hàng. |
| `npm run compile:scss` | Biên dịch Sass sang CSS ở chế độ theo dõi thay đổi. |
| `npm run prefix:css` | Thêm vendor prefix cho `css/style.css`. |
| `npm run compress:css` | Nén CSS. |
| `npm run build` | Chạy prefix và nén CSS. |

## Ghi chú triển khai

Để đưa website lên mạng công khai, cấu hình thông tin admin an toàn, đặt `NODE_ENV=production`, bật HTTPS và triển khai sau reverse proxy đáng tin cậy. Cookie phiên chỉ thêm cờ `Secure` khi `NODE_ENV=production`. Hãy thiết lập backup có kiểm soát quyền truy cập cho database và thư mục ảnh; không commit dữ liệu cửa hàng lên repository.
