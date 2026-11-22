// ---
const hamMenuBtn = document.querySelector('.header__main-ham-menu-cont')
const smallMenu = document.querySelector('.header__sm-menu')
const headerHamMenuBtn = document.querySelector('.header__main-ham-menu')
const headerHamMenuCloseBtn = document.querySelector(
  '.header__main-ham-menu-close'
)
const headerSmallMenuLinks = document.querySelectorAll('.header__sm-menu-link')

hamMenuBtn.addEventListener('click', () => {
  if (smallMenu.classList.contains('header__sm-menu--active')) {
    smallMenu.classList.remove('header__sm-menu--active')
  } else {
    smallMenu.classList.add('header__sm-menu--active')
  }
  if (headerHamMenuBtn.classList.contains('d-none')) {
    headerHamMenuBtn.classList.remove('d-none')
    headerHamMenuCloseBtn.classList.add('d-none')
  } else {
    headerHamMenuBtn.classList.add('d-none')
    headerHamMenuCloseBtn.classList.remove('d-none')
  }
})

for (let i = 0; i < headerSmallMenuLinks.length; i++) {
  headerSmallMenuLinks[i].addEventListener('click', () => {
    smallMenu.classList.remove('header__sm-menu--active')
    headerHamMenuBtn.classList.remove('d-none')
    headerHamMenuCloseBtn.classList.add('d-none')
  })
}

// ---
const headerLogoConatiner = document.querySelector('.header__logo-container')

headerLogoConatiner.addEventListener('click', () => {
  location.href = 'index.html'
})

document.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const password = document.getElementById(toggle.getAttribute('aria-controls'))
    if (!password) return

    const visible = password.type === 'password'
    password.type = visible ? 'text' : 'password'
    toggle.setAttribute('aria-pressed', String(visible))
    toggle.setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu')
  })
})

function csvCell(value) {
  let text = String(value ?? '').replace(/\r\n?/g, '\n')
  if (/^[\t ]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

document.querySelector('[data-export-csv="skills"]')?.addEventListener('click', () => {
  const skills = [...document.querySelectorAll('.about__content-skills .skills__skill')]
    .map((skill) => skill.textContent.trim())
  downloadCsv('mobeiemi-skills.csv', ['Kỹ năng'], skills.map((skill) => [skill]))
})

document.querySelector('[data-export-csv="projects"]')?.addEventListener('click', () => {
  const projects = [...document.querySelectorAll('.projects__row')].map((project) => [
    project.querySelector('.projects__row-content-title')?.textContent.trim() || '',
    project.querySelector('.projects__row-content-desc')?.textContent.trim() || '',
    project.querySelector('.projects__row-content a')?.getAttribute('href') || '',
  ])
  downloadCsv(
    'mobeiemi-projects.csv',
    ['Tên dự án', 'Mô tả', 'Đường dẫn case study'],
    projects,
  )
})
