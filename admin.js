;(function () {
  const loginPanel = document.querySelector('#admin-login-panel')
  const dashboard = document.querySelector('#admin-dashboard')
  if (!loginPanel || !dashboard) return

  const status = document.querySelector('#admin-status')
  const productsGrid = document.querySelector('#admin-products')
  const maximumImageBytes = 5 * 1024 * 1024

  function showStatus(message, isError = false) {
    status.textContent = message
    status.classList.toggle('keycap-shop__status--error', isError)
  }

  async function requestApi(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body && typeof options.body === 'string'
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(options.headers || {}),
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

  function showDashboard(admin) {
    loginPanel.hidden = Boolean(admin)
    dashboard.hidden = !admin
    document.querySelector('#admin-email-label').textContent = admin ? admin.email : ''
  }

  function renderProducts(products) {
    productsGrid.replaceChildren()
    if (products.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'keycap-shop__loading'
      empty.textContent = 'Chưa có sản phẩm.'
      productsGrid.append(empty)
      return
    }

    products.forEach((product) => {
      const card = document.createElement('article')
      card.className = 'admin-product'

      const preview = product.image_path
        ? document.createElement('img')
        : document.createElement('div')
      preview.className = 'admin-product__preview'
      if (product.image_path) {
        preview.src = product.image_path
        preview.alt = `Ảnh ${product.name}`
      } else {
        preview.textContent = 'Chưa có ảnh'
        preview.setAttribute('aria-label', 'Sản phẩm chưa có ảnh')
      }

      const content = document.createElement('div')
      content.className = 'admin-product__content'
      const title = document.createElement('h2')
      title.textContent = product.name
      const description = document.createElement('p')
      description.textContent = `${product.id} · Tồn kho: ${product.stock} · ${product.is_active ? 'Đang bán' : 'Đã ẩn'}`
      content.append(title, description)

      const priceForm = document.createElement('form')
      priceForm.className = 'admin-product__price-form keycap-shop__form'
      const priceField = document.createElement('div')
      priceField.className = 'keycap-shop__field'
      const priceLabel = document.createElement('label')
      priceLabel.textContent = 'Giá bán (VND)'
      const priceInput = document.createElement('input')
      priceInput.type = 'number'
      priceInput.name = 'price'
      priceInput.min = '0'
      priceInput.step = '1'
      priceInput.value = String(product.price)
      priceInput.required = true
      priceLabel.htmlFor = `price-${product.id}`
      priceInput.id = priceLabel.htmlFor
      priceField.append(priceLabel, priceInput)
      const savePrice = document.createElement('button')
      savePrice.className = 'btn btn--med btn--theme keycap-shop__button'
      savePrice.type = 'submit'
      savePrice.textContent = 'Lưu giá'
      priceForm.append(priceField, savePrice)
      priceForm.addEventListener('submit', async (event) => {
        event.preventDefault()
        setBusy(priceForm, true)
        try {
          await requestApi(`/api/admin/products/${encodeURIComponent(product.id)}`, {
            method: 'PUT',
            body: JSON.stringify({ price: Number(priceInput.value) }),
          })
          showStatus(`Đã cập nhật giá cho "${product.name}".`)
        } catch (error) {
          showStatus(error.message || 'Không thể cập nhật giá.', true)
        } finally {
          setBusy(priceForm, false)
        }
      })

      const imageForm = document.createElement('form')
      imageForm.className = 'admin-product__image-form'
      const imageInput = document.createElement('input')
      imageInput.type = 'file'
      imageInput.accept = 'image/jpeg,image/png,image/webp'
      imageInput.setAttribute('aria-label', `Chọn ảnh cho ${product.name}`)
      const uploadButton = document.createElement('button')
      uploadButton.className = 'btn btn--med btn--theme-inv'
      uploadButton.type = 'submit'
      uploadButton.textContent = 'Tải ảnh lên'
      imageForm.append(imageInput, uploadButton)
      imageForm.addEventListener('submit', async (event) => {
        event.preventDefault()
        const image = imageInput.files[0]
        if (!image) {
          showStatus('Hãy chọn ảnh trước khi tải lên.', true)
          return
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
          showStatus('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.', true)
          return
        }
        if (image.size > maximumImageBytes) {
          showStatus('Ảnh tải lên không được vượt quá 5 MB.', true)
          return
        }

        setBusy(imageForm, true)
        try {
          await requestApi(`/api/admin/products/${encodeURIComponent(product.id)}/image`, {
            method: 'POST',
            body: image,
            headers: { 'Content-Type': image.type },
          })
          showStatus(`Đã cập nhật ảnh cho "${product.name}".`)
          await loadProducts()
        } catch (error) {
          showStatus(error.message || 'Không thể tải ảnh lên.', true)
        } finally {
          setBusy(imageForm, false)
        }
      })

      card.append(preview, content, priceForm, imageForm)
      productsGrid.append(card)
    })
  }

  async function loadProducts() {
    const { products } = await requestApi('/api/admin/products')
    renderProducts(products)
  }

  async function initialize() {
    try {
      const { admin } = await requestApi('/api/admin/me')
      showDashboard(admin)
      if (admin) await loadProducts()
    } catch (error) {
      showStatus(error.message || 'Không thể kiểm tra phiên admin.', true)
    }
  }

  document.querySelector('#admin-login-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(form, true)
    try {
      const { admin } = await requestApi('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          email: values.get('email').trim(),
          password: values.get('password'),
        }),
      })
      showDashboard(admin)
      form.reset()
      showStatus('Đăng nhập admin thành công.')
      await loadProducts()
    } catch (error) {
      showStatus(error.message || 'Không thể đăng nhập admin.', true)
    } finally {
      setBusy(form, false)
    }
  })

  document.querySelector('#admin-logout').addEventListener('click', async () => {
    try {
      await requestApi('/api/admin/logout', { method: 'POST', body: '{}' })
      showDashboard(null)
      productsGrid.replaceChildren()
      showStatus('Đã đăng xuất admin.')
    } catch (error) {
      showStatus(error.message || 'Không thể đăng xuất admin.', true)
    }
  })

  initialize()
})()
