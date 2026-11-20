// RentPadi website: small enhancements only. Every page works without this file.
;(function () {
  'use strict'

  // Plans as in docs/PRICING.md. Fee on Padi Free: 1% of each rent bill, capped at ₦2,000 per bill.
  // (Declared before ready() runs: with `defer`, the DOM is already parsed and ready() runs at once.)
  var PLANS = [
    { name: 'Padi Free', max: 5, yearly: 0 },
    { name: 'Padi', max: 10, yearly: 24000 },
    { name: 'Padi Plus', max: 25, yearly: 50000 },
    { name: 'Padi Pro', max: Infinity, yearly: 100000 },
  ]
  var BILLS_PER_YEAR = { yearly: 1, sixmonthly: 2, monthly: 12 }

  var naira = function (n) {
    return '₦' + Math.round(n).toLocaleString('en-NG')
  }
  var short = function (n) {
    if (n >= 1e6) return '₦' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
    if (n >= 1e3) return '₦' + Math.round(n / 1e3) + 'k'
    return naira(n)
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn()
    else document.addEventListener('DOMContentLoaded', fn)
  }

  ready(function () {
    // ----- Header: border once scrolled -----
    var header = document.querySelector('[data-header]')
    if (header) {
      var onScroll = function () {
        header.classList.toggle('is-scrolled', window.scrollY > 8)
      }
      onScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
    }

    // ----- Mobile menu -----
    var menuBtn = document.querySelector('[data-menu]')
    var nav = document.getElementById('site-nav')
    if (menuBtn && nav) {
      var setOpen = function (open) {
        menuBtn.setAttribute('aria-expanded', String(open))
        menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
        nav.classList.toggle('is-open', open)
      }
      menuBtn.addEventListener('click', function () {
        setOpen(menuBtn.getAttribute('aria-expanded') !== 'true')
      })
      nav.addEventListener('click', function (e) {
        if (e.target.closest('a')) setOpen(false)
      })
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) {
          setOpen(false)
          menuBtn.focus()
        }
      })
      window.matchMedia('(min-width: 901px)').addEventListener('change', function () {
        setOpen(false)
      })
    }

    // ----- Reveal on scroll -----
    var revealEls = document.querySelectorAll('[data-reveal]')
    if ('IntersectionObserver' in window && revealEls.length) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible')
              io.unobserve(entry.target)
            }
          })
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
      )
      revealEls.forEach(function (el) {
        io.observe(el)
      })
    } else {
      revealEls.forEach(function (el) {
        el.classList.add('is-visible')
      })
    }

    // ----- Pricing: yearly / monthly -----
    var toggles = document.querySelectorAll('[data-billing]')
    if (toggles.length) {
      var setBilling = function (mode) {
        toggles.forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-billing') === mode))
        })
        document.querySelectorAll('[data-yearly]').forEach(function (el) {
          el.textContent = el.getAttribute('data-' + mode)
        })
      }
      toggles.forEach(function (b) {
        b.addEventListener('click', function () {
          setBilling(b.getAttribute('data-billing'))
        })
      })
    }

    // ----- Pricing: fee calculator -----
    var calc = document.querySelector('[data-calc]')
    if (calc) initCalculator(calc)

    // ----- Contact form: compose an email (the site has no server) -----
    var form = document.querySelector('[data-contact-form]')
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault()
        var data = new FormData(form)
        var topic = data.get('topic') || 'Question'
        var lines = [
          String(data.get('message') || ''),
          '',
          '—',
          'Name: ' + (data.get('name') || ''),
          'Phone: ' + (data.get('phone') || ''),
          'Units: ' + (data.get('units') || ''),
          'City: ' + (data.get('city') || ''),
        ]
        var to = form.getAttribute('data-to')
        window.location.href =
          'mailto:' +
          to +
          '?subject=' +
          encodeURIComponent('RentPadi: ' + topic) +
          '&body=' +
          encodeURIComponent(lines.join('\n'))
      })
    }
  })

  function initCalculator(root) {
    var units = root.querySelector('#calc-units')
    var unitsRange = root.querySelector('#calc-units-range')
    var rent = root.querySelector('#calc-rent')
    var out = function (name) {
      return root.querySelector('[data-out="' + name + '"]')
    }

    var update = function () {
      var u = Math.max(1, Math.min(200, parseInt(units.value, 10) || 1))
      var r = Math.max(0, parseInt(String(rent.value).replace(/[^\d]/g, ''), 10) || 0)
      var periodEl = root.querySelector('input[name="period"]:checked')
      var period = periodEl ? periodEl.value : 'yearly'
      var bills = BILLS_PER_YEAR[period]

      var rentRoll = u * r * bills
      var feePerBill = Math.min(r * 0.01, 2000)
      var freeCost = u * bills * feePerBill

      var paid = PLANS.filter(function (p) {
        return p.yearly > 0 && u <= p.max
      })[0]
      var paidCost = paid.yearly + (paid.name === 'Padi Pro' ? Math.max(0, u - 50) * 200 * 12 : 0)

      out('free').textContent = u <= 5 ? naira(freeCost) + ' / year' : 'Up to 5 units'
      out('free').classList.toggle('muted', u > 5)
      out('free-note').textContent = u <= 5 ? naira(feePerBill) + ' per rent bill, if every tenant pays online' : 'You have ' + u + ' units'
      out('paid-name').textContent = paid.name
      out('paid').textContent = naira(paidCost) + ' / year'
      out('paid-note').textContent =
        paid.name === 'Padi Pro' && u > 50
          ? '₦100,000 + ₦200 a month for each unit over 50'
          : 'Flat price, up to ' + paid.max + ' units'
      out('agent').textContent = naira(rentRoll * 0.1)
      out('roll').textContent = short(rentRoll)

      var best
      if (u <= 5 && freeCost <= paidCost) {
        best =
          '<b>Padi Free</b> is cheapest for you: about ' +
          (rentRoll ? ((freeCost / rentRoll) * 100).toFixed(2) : '0') +
          '% of your rent. Move to Padi any time for WhatsApp reminders and room to grow.'
      } else {
        var saved = u <= 5 ? freeCost - paidCost : 0
        best =
          '<b>' +
          paid.name +
          '</b> is best for you: ' +
          (rentRoll ? ((paidCost / rentRoll) * 100).toFixed(2) : '0') +
          '% of your rent' +
          (saved > 0 ? ', and ' + naira(saved) + ' a year less than Padi Free.' : '.')
      }
      out('best').innerHTML = best
    }

    units.addEventListener('input', function () {
      unitsRange.value = units.value
      update()
    })
    unitsRange.addEventListener('input', function () {
      units.value = unitsRange.value
      update()
    })
    rent.addEventListener('input', function () {
      var digits = rent.value.replace(/[^\d]/g, '')
      rent.value = digits ? Number(digits).toLocaleString('en-NG') : ''
      update()
    })
    root.querySelectorAll('input[name="period"]').forEach(function (el) {
      el.addEventListener('change', update)
    })
    update()
  }
})()
