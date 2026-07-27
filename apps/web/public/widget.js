/* Flowcraft embeddable widget loader.
 * Usage: <script src="https://<host>/widget.js" data-widget="WIDGET_ID" async></script>
 * Renders a Shadow-DOM-isolated widget that submits to the linked workflow.
 */
(function () {
  'use strict';

  function init() {
    var scripts = document.querySelectorAll('script[data-widget]');
    for (var i = 0; i < scripts.length; i++) {
      (function (script) {
        var id = script.getAttribute('data-widget');
        if (!id || script.__fcDone) return;
        script.__fcDone = true;
        var base;
        try {
          base = new URL(script.src, location.href).origin;
        } catch (e) {
          base = '';
        }
        fetch(base + '/api/widgets/' + id + '/config')
          .then(function (r) {
            return r.json();
          })
          .then(function (cfg) {
            if (!cfg || cfg.error) return;
            render(script, base, id, cfg);
          })
          .catch(function () {});
      })(scripts[i]);
    }
  }

  function render(script, base, id, cfg) {
    if (cfg.placement === 'floating') renderFloating(base, id, cfg);
    else renderInline(script, base, id, cfg);
  }

  // ── mounts ──────────────────────────────────────────────────────────────
  function renderInline(script, base, id, cfg) {
    var host = document.createElement('div');
    host.setAttribute('data-flowcraft-widget', id);
    script.parentNode.insertBefore(host, script.nextSibling);
    var shadow = host.attachShadow({ mode: 'open' });
    shadow.appendChild(styleEl(cfg.theme));
    var card = buildCard(base, id, cfg);
    card.style.maxWidth = (cfg.theme.width || 380) + 'px';
    shadow.appendChild(card);
  }

  function renderFloating(base, id, cfg) {
    var host = document.createElement('div');
    host.setAttribute('data-flowcraft-widget', id);
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: 'open' });
    shadow.appendChild(styleEl(cfg.theme));

    var wrap = document.createElement('div');
    wrap.className = 'fc-float';

    var panel = document.createElement('div');
    panel.className = 'fc-panel';
    panel.style.display = 'none';
    panel.style.width = (cfg.theme.width || 380) + 'px';
    panel.appendChild(buildCard(base, id, cfg));

    var launcher = document.createElement('button');
    launcher.className = 'fc-launcher';
    launcher.textContent = cfg.launcherLabel || 'Contact';
    launcher.addEventListener('click', function () {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    wrap.appendChild(panel);
    wrap.appendChild(launcher);
    shadow.appendChild(wrap);
  }

  // ── card (title + fields + submit) ──────────────────────────────────────
  function buildCard(base, id, cfg) {
    var card = document.createElement('div');
    card.className = 'fc-card';
    var renderedAt = Date.now();

    if (cfg.title) card.appendChild(elText('h3', 'fc-title', cfg.title));
    if (cfg.description) card.appendChild(elText('p', 'fc-desc', cfg.description));

    var form = document.createElement('form');
    var inputs = {};

    (cfg.fields || []).forEach(function (f) {
      var group = document.createElement('label');
      group.className = 'fc-group';
      if (f.type !== 'rating') group.appendChild(elText('span', 'fc-label', f.label + (f.required ? ' *' : '')));

      var input;
      if (f.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else if (f.type === 'select') {
        input = document.createElement('select');
        (f.options || []).forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = o;
          opt.textContent = o;
          input.appendChild(opt);
        });
      } else if (f.type === 'rating') {
        group.appendChild(elText('span', 'fc-label', f.label + (f.required ? ' *' : '')));
        input = ratingControl(f);
      } else {
        input = document.createElement('input');
        input.type = f.type === 'email' ? 'email' : 'text';
      }
      if (f.type !== 'rating') {
        input.className = 'fc-input';
        if (f.placeholder) input.placeholder = f.placeholder;
        if (f.required) input.required = true;
      }
      inputs[f.key] = input;
      group.appendChild(input.__control || input);
      form.appendChild(group);
    });

    // Honeypot (visually hidden; bots fill it)
    var hp = document.createElement('input');
    hp.type = 'text';
    hp.name = 'company';
    hp.className = 'fc-hp';
    hp.tabIndex = -1;
    hp.setAttribute('autocomplete', 'off');
    hp.setAttribute('aria-hidden', 'true');
    form.appendChild(hp);

    var err = elText('div', 'fc-err', '');
    err.style.display = 'none';
    form.appendChild(err);

    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'fc-btn';
    btn.textContent = cfg.submitLabel || 'Submit';
    form.appendChild(btn);

    if (cfg.branding) {
      var brand = document.createElement('a');
      brand.className = 'fc-brand';
      brand.href = base;
      brand.target = '_blank';
      brand.rel = 'noopener';
      brand.textContent = '⚡ Powered by Flowcraft';
      form.appendChild(brand);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.style.display = 'none';
      var payload = { _hp: hp.value, _t: renderedAt };
      var missing = false;
      (cfg.fields || []).forEach(function (f) {
        var v = inputs[f.key].__value ? inputs[f.key].__value() : inputs[f.key].value;
        if (f.required && (v === '' || v == null)) missing = true;
        payload[f.key] = v;
      });
      if (missing) {
        err.textContent = 'Please fill in the required fields.';
        err.style.display = 'block';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sending…';
      fetch(base + '/api/widgets/' + id + '/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (d) {
            return { ok: r.ok, d: d };
          });
        })
        .then(function (res) {
          if (res.ok && res.d.ok) {
            card.innerHTML = '';
            card.appendChild(elText('div', 'fc-success', cfg.successMessage || 'Thanks!'));
          } else {
            err.textContent = (res.d && res.d.error) || 'Something went wrong. Please try again.';
            err.style.display = 'block';
            btn.disabled = false;
            btn.textContent = cfg.submitLabel || 'Submit';
          }
        })
        .catch(function () {
          err.textContent = 'Network error. Please try again.';
          err.style.display = 'block';
          btn.disabled = false;
          btn.textContent = cfg.submitLabel || 'Submit';
        });
    });

    card.appendChild(form);
    return card;
  }

  function ratingControl(f) {
    var variant = f.ratingVariant || 'stars';
    var wrap = document.createElement('div');
    wrap.className = 'fc-rating';
    var value = '';
    var buttons = [];
    var opts =
      variant === 'nps'
        ? ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
        : variant === 'thumbs'
        ? ['up', 'down']
        : ['1', '2', '3', '4', '5'];

    opts.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fc-rate';
      b.textContent = variant === 'stars' ? '★' : variant === 'thumbs' ? (o === 'up' ? '👍' : '👎') : o;
      b.addEventListener('click', function () {
        value = o;
        buttons.forEach(function (bb, idx) {
          var on = variant === 'stars' ? idx <= opts.indexOf(o) : bb === b;
          bb.classList.toggle('on', on);
        });
      });
      buttons.push(b);
      wrap.appendChild(b);
    });
    wrap.__control = wrap;
    wrap.__value = function () {
      return value;
    };
    return wrap;
  }

  // ── helpers ─────────────────────────────────────────────────────────────
  function elText(tag, cls, text) {
    var e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    return e;
  }

  function styleEl(t) {
    t = t || {};
    var s = document.createElement('style');
    s.textContent = [
      ':host{all:initial}',
      '*{box-sizing:border-box;font-family:' + (t.fontFamily || 'system-ui,sans-serif') + '}',
      '.fc-card{background:' + (t.bgColor || '#fff') + ';color:' + (t.textColor || '#0f1729') +
        ';border:1px solid ' + (t.borderColor || '#e2e6ee') + ';border-radius:' + (t.radius || 10) +
        'px;padding:18px;box-shadow:0 6px 24px -8px rgba(2,6,23,.18)}',
      '.fc-title{margin:0 0 4px;font-size:17px;font-weight:700}',
      '.fc-desc{margin:0 0 12px;font-size:13px;opacity:.7}',
      '.fc-group{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}',
      '.fc-label{font-size:12px;opacity:.8}',
      '.fc-input{width:100%;padding:9px 10px;font-size:14px;border:1px solid ' +
        (t.borderColor || '#e2e6ee') + ';border-radius:' + Math.max(4, (t.radius || 10) - 4) +
        'px;background:' + (t.bgColor || '#fff') + ';color:' + (t.textColor || '#0f1729') + ';outline:none}',
      '.fc-input:focus{border-color:' + (t.primaryColor || '#6d28d9') + '}',
      'textarea.fc-input{resize:vertical}',
      '.fc-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}',
      '.fc-btn{width:100%;margin-top:4px;padding:10px;font-size:14px;font-weight:600;border:0;cursor:pointer;border-radius:' +
        Math.max(4, (t.radius || 10) - 4) + 'px;background:' + (t.primaryColor || '#6d28d9') +
        ';color:' + (t.buttonTextColor || '#fff') + '}',
      '.fc-btn:disabled{opacity:.6;cursor:default}',
      '.fc-rating{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}',
      '.fc-rate{cursor:pointer;border:1px solid ' + (t.borderColor || '#e2e6ee') +
        ';background:transparent;color:' + (t.textColor || '#0f1729') +
        ';border-radius:8px;min-width:34px;height:34px;font-size:16px}',
      '.fc-rate.on{background:' + (t.primaryColor || '#6d28d9') + ';color:' + (t.buttonTextColor || '#fff') +
        ';border-color:' + (t.primaryColor || '#6d28d9') + '}',
      '.fc-err{color:#dc2626;font-size:12px;margin-bottom:8px}',
      '.fc-success{padding:14px 4px;text-align:center;font-size:15px;font-weight:600}',
      '.fc-brand{display:block;margin-top:10px;text-align:center;font-size:11px;opacity:.5;text-decoration:none;color:inherit}',
      '.fc-float{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:10px}',
      '.fc-panel{max-width:calc(100vw - 40px)}',
      '.fc-launcher{cursor:pointer;border:0;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:600;background:' +
        (t.primaryColor || '#6d28d9') + ';color:' + (t.buttonTextColor || '#fff') +
        ';box-shadow:0 8px 24px -6px rgba(2,6,23,.35)}',
    ].join('');
    return s;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
