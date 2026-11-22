;(function () {
  const store = document.querySelector('.keycap-shop')
  if (!store) return

  const status = document.querySelector('#shop-status')
  let user = null
  let authMode = 'login'
  let authLoadToken = 0

  const artByProduct = {
    'pastel-dream': { theme: 'mint', key: 'ESC', caption: 'SOFT COLORS' },
    'berry-artisan': { theme: 'berry', key: '♡', caption: 'ARTISAN STYLE' },
    'cloud-white': { theme: 'sky', key: 'W', caption: 'CLEAN LOOK' },
  }
  const orderStatusLabels = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    shipping: 'Đang giao',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  }
  const formatPrice = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  })

  function showStatus(message, isError) {
    if (!status) return
    status.textContent = message
    status.classList.toggle('keycap-shop__status--error', Boolean(isError))
  }

  async function requestApi(url, options) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options && options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options && options.headers ? options.headers : {}),
      },
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Yêu cầu không thành công.')
    return result
  }

  function setBusy(form, busy) {
    form.querySelectorAll('button').forEach((button) => {
      button.disabled = busy
    })
  }

  function renderProducts(products) {
    const grid = document.querySelector('#keycap-products')
    grid.replaceChildren()

    if (products.length === 0) {
      const emptyMessage = document.createElement('p')
      emptyMessage.className = 'keycap-shop__loading'
      emptyMessage.textContent = 'Hiện chưa có sản phẩm đang bán.'
      grid.append(emptyMessage)
      return
    }

    products.forEach((product) => {
      const art = artByProduct[product.id] || {
        theme: 'sky',
        key: '⌨',
        caption: 'KEYCAP',
      }
      const card = document.createElement('article')
      card.className = 'keycap-shop__card'

      const illustration = document.createElement('div')
      illustration.className = `keycap-shop__art keycap-shop__art--${art.theme}`
      illustration.setAttribute('aria-hidden', 'true')

      if (product.image_path) {
        illustration.classList.add('keycap-shop__art--with-image')
        const image = document.createElement('img')
        image.className = 'keycap-shop__product-image'
        image.src = product.image_path
        image.alt = product.name
        illustration.append(image)
      } else {
        const key = document.createElement('span')
        key.className = 'keycap-shop__key'
        key.textContent = art.key
        illustration.append(key)

        const caption = document.createElement('span')
        caption.className = 'keycap-shop__caption'
        caption.textContent = art.caption
        illustration.append(caption)
      }

      const details = document.createElement('div')
      details.className = 'keycap-shop__details'

      const name = document.createElement('h3')
      name.className = 'keycap-shop__name'
      name.textContent = product.name

      const description = document.createElement('p')
      description.className = 'keycap-shop__description'
      description.textContent = product.description

      const price = document.createElement('p')
      price.className = 'keycap-shop__price'
      price.textContent = formatPrice.format(product.price)

      const stock = document.createElement('p')
      stock.className = 'keycap-shop__stock'
      stock.textContent = product.stock > 0
        ? `Còn ${product.stock} sản phẩm`
        : 'Tạm hết hàng'

      const orderButton = document.createElement('button')
      orderButton.type = 'button'
      orderButton.className = 'btn btn--med btn--theme keycap-shop__button'
      orderButton.textContent = product.stock > 0 ? 'Đặt mua' : 'Hết hàng'
      orderButton.disabled = product.stock < 1
      orderButton.addEventListener('click', () => placeOrder(product, orderButton))

      details.append(name, description, price, stock, orderButton)
      card.append(illustration, details)
      grid.append(card)
    })
  }

  function renderOrders(orders) {
    const list = document.querySelector('#shop-orders')
    if (!list) return
    list.replaceChildren()

    if (orders.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'keycap-shop__empty'
      empty.textContent = 'Bạn chưa có đơn hàng nào.'
      list.append(empty)
      return
    }

    orders.forEach((order) => {
      const item = document.createElement('article')
      item.className = 'keycap-shop__order'

      const heading = document.createElement('div')
      heading.className = 'keycap-shop__order-heading'

      const orderNumber = document.createElement('strong')
      orderNumber.textContent = `Đơn #${order.id.slice(0, 8).toUpperCase()}`

      const orderStatus = document.createElement('span')
      orderStatus.textContent = orderStatusLabels[order.status] || order.status
      heading.append(orderNumber, orderStatus)

      const summary = document.createElement('p')
      const productNames = order.order_items
        .map((line) => `${line.product_name} × ${line.quantity}`)
        .join(', ')
      summary.textContent = `${productNames} · ${formatPrice.format(order.total_amount)}`

      const date = document.createElement('time')
      date.dateTime = `${order.created_at.replace(' ', 'T')}Z`
      date.textContent = new Date(`${order.created_at.replace(' ', 'T')}Z`).toLocaleString('vi-VN')
      item.append(heading, summary, date)
      list.append(item)
    })
  }

  function setAuthenticatedView(authenticated) {
    const authPanel = document.querySelector('#shop-auth-panel')
    const loginRequired = document.querySelector('#shop-login-required')
    const userPanel = document.querySelector('#shop-user-panel')
    const userEmail = document.querySelector('#shop-user-email')
    if (authPanel) authPanel.hidden = authenticated
    if (loginRequired) loginRequired.hidden = authenticated
    if (userPanel) userPanel.hidden = !authenticated
    if (userEmail) userEmail.textContent = user ? user.email : ''
  }

  async function loadProducts() {
    if (!document.querySelector('#keycap-products')) return
    const { products } = await requestApi('/api/products')
    renderProducts(products)
  }

  async function loadOrders(customerId) {
    if (!document.querySelector('#shop-orders')) return
    const { orders } = await requestApi('/api/orders')
    if (user && user.id === customerId) renderOrders(orders)
  }

  async function refreshCustomerData() {
    if (!user || !document.querySelector('#shop-profile-form')) return
    const customerId = user.id
    const { profile } = await requestApi('/api/profile')

    if (!user || user.id !== customerId) return
    document.querySelector('#shop-profile-name').value = profile.full_name
    document.querySelector('#shop-profile-phone').value = profile.phone
    document.querySelector('#shop-profile-address').value = profile.address
    await loadOrders(customerId)
  }

  function setAuthMode(mode, updateUrl = true) {
    if (!document.querySelector('#shop-auth-form')) return
    authMode = mode
    const signingUp = mode === 'signup'
    const nameField = document.querySelector('#shop-name-field')
    const nameInput = document.querySelector('#shop-name')
    const password = document.querySelector('#shop-password')

    nameField.hidden = !signingUp
    nameInput.required = signingUp
    password.autocomplete = signingUp ? 'new-password' : 'current-password'
    document.querySelector('#shop-auth-submit').textContent = signingUp ? 'Tạo tài khoản' : 'Đăng nhập'
    document.querySelector('#shop-login-tab').classList.toggle('keycap-shop__tab--active', !signingUp)
    document.querySelector('#shop-signup-tab').classList.toggle('keycap-shop__tab--active', signingUp)
    if (updateUrl) {
      const url = new URL(window.location.href)
      url.searchParams.set('mode', mode)
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
      document.title = `${signingUp ? 'Đăng ký' : 'Đăng nhập'} | Mobeiemi`
    }
  }

  async function loadCurrentUser() {
    const { user: currentUser, profile } = await requestApi('/api/auth/me')
    user = currentUser
    const loadToken = ++authLoadToken
    setAuthenticatedView(Boolean(user))

    if (user && document.querySelector('#shop-auth-form')) {
      window.location.assign('./keycap-store.html')
      return
    }

    if (!user) {
      const profileForm = document.querySelector('#shop-profile-form')
      if (profileForm) profileForm.reset()
      renderOrders([])
      return
    }

    if (profile && document.querySelector('#shop-profile-name')) {
      document.querySelector('#shop-profile-name').value = profile.full_name
      document.querySelector('#shop-profile-phone').value = profile.phone
      document.querySelector('#shop-profile-address').value = profile.address
    }
    await Promise.resolve()
    if (user && loadToken === authLoadToken) await loadOrders(user.id)
  }

  async function handleAuth(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const body = {
      email: values.get('email').trim(),
      password: values.get('password'),
    }
    if (authMode === 'signup') body.fullName = values.get('full_name').trim()
    setBusy(form, true)

    try {
      const result = await requestApi(authMode === 'signup' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (result && result.admin) {
        showStatus('Đăng nhập admin thành công.')
        window.location.assign('./login-admin.html')
        return
      }

      showStatus(authMode === 'signup' ? 'Tạo tài khoản thành công.' : 'Đăng nhập thành công.')
      window.location.assign('./keycap-store.html')
      return result
    } catch (error) {
      showStatus(error.message || 'Không thể xác thực tài khoản. Vui lòng thử lại.', true)
    } finally {
      setBusy(form, false)
    }
  }

  async function saveProfile() {
    const form = document.querySelector('#shop-profile-form')
    const values = new FormData(form)
    const profile = {
      full_name: values.get('full_name').trim(),
      phone: values.get('phone').trim(),
      address: values.get('address').trim(),
    }

    const { profile: savedProfile } = await requestApi('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    })
    return savedProfile
  }

  async function handleProfileSave(event) {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(form, true)
    try {
      await saveProfile()
      showStatus('Đã lưu thông tin nhận hàng.')
    } catch (error) {
      showStatus(error.message || 'Không thể lưu thông tin nhận hàng.', true)
    } finally {
      setBusy(form, false)
    }
  }

  async function placeOrder(product, button) {
    if (!user) {
      window.location.assign('./account.html')
      return
    }

    button.disabled = true
    try {
      await saveProfile()
      const { orderId } = await requestApi('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id }),
      })
      showStatus(`Đặt hàng thành công! Mã đơn: ${orderId.slice(0, 8).toUpperCase()}. Đơn đang chờ xác nhận.`)
      try {
        await Promise.all([loadProducts(), loadOrders(user.id)])
      } catch (refreshError) {
        showStatus(`Đơn đã được ghi nhận, nhưng chưa cập nhật được dữ liệu hiển thị: ${refreshError.message}`, true)
      }
    } catch (error) {
      showStatus(error.message || 'Không thể đặt hàng. Vui lòng thử lại.', true)
    } finally {
      button.disabled = false
    }
  }

  async function signOut() {
    try {
      await requestApi('/api/auth/logout', { method: 'POST', body: '{}' })
      user = null
      await loadCurrentUser()
      showStatus('Bạn đã đăng xuất.')
    } catch (error) {
      showStatus(error.message || 'Không thể đăng xuất.', true)
    }
  }

  const loginTab = document.querySelector('#shop-login-tab')
  const signupTab = document.querySelector('#shop-signup-tab')
  const authForm = document.querySelector('#shop-auth-form')
  const profileForm = document.querySelector('#shop-profile-form')
  const logoutButton = document.querySelector('#shop-logout')
  if (loginTab) loginTab.addEventListener('click', () => setAuthMode('login'))
  if (signupTab) signupTab.addEventListener('click', () => setAuthMode('signup'))
  if (authForm) authForm.addEventListener('submit', handleAuth)
  if (profileForm) profileForm.addEventListener('submit', handleProfileSave)
  if (logoutButton) logoutButton.addEventListener('click', signOut)
  if (authForm) {
    const requestedMode = new URLSearchParams(window.location.search).get('mode')
    setAuthMode(requestedMode === 'signup' ? 'signup' : 'login')
  }

  Promise.all([loadProducts(), loadCurrentUser()]).catch((error) => {
    showStatus(error.message || 'Không thể kết nối máy chủ cửa hàng.', true)
    const productGrid = document.querySelector('#keycap-products')
    if (productGrid && !productGrid.children.length) {
      const message = document.createElement('p')
      message.className = 'keycap-shop__loading'
      message.textContent = 'Không thể tải sản phẩm. Hãy kiểm tra máy chủ cửa hàng.'
      productGrid.replaceChildren(message)
    }
  })
})()
