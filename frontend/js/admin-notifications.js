const EVENT_LABELS = {
  orderCreated: 'New order placed',
  orderConfirmed: 'Order confirmed',
  paymentConfirmed: 'Payment confirmed',
  orderProcessing: 'Order processing',
  orderShipped: 'Order shipped',
  orderDelivered: 'Order delivered',
  orderCancelled: 'Order cancelled',
  refundUpdated: 'Refund updated',
};

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

const historyState = { page: 1, limit: 15 };
let settingsCache = null;

const alertBox = (type, message) => {
  const box = document.getElementById('settingsAlert');
  if (!box) return;
  box.innerHTML = message ? `<div class="alert alert-${type}" style="margin-bottom:1rem">${esc(message)}</div>` : '';
};

const setBusy = (btn, busy, label) => {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;vertical-align:-2px"></span>';
  } else {
    btn.disabled = false;
    btn.textContent = label || btn.dataset.label || 'Send';
  }
};

const renderTimezones = (selected) => {
  const select = document.getElementById('storeTimezone');
  const list = TIMEZONES.includes(selected) ? TIMEZONES : [selected, ...TIMEZONES];
  select.innerHTML = list
    .map((tz) => `<option value="${esc(tz)}" ${tz === selected ? 'selected' : ''}>${esc(tz)}</option>`)
    .join('');
};

const renderForm = (settings, capabilities) => {
  settingsCache = settings;
  document.getElementById('discordEnabled').checked = settings.discord.enabled;
  document.getElementById('discordWebhook').placeholder =
    settings.discord.webhookUrl || 'https://discord.com/api/webhooks/…';
  document.getElementById('discordStatusWebhook').placeholder =
    settings.discord.statusWebhookUrl || 'Defaults to the order channel';
  document.getElementById('discordPublicWebhook').placeholder =
    settings.discord.publicWebhookUrl || 'Not configured (public channel disabled)';
  document.getElementById('discordWebhook').value = '';
  document.getElementById('discordStatusWebhook').value = '';
  document.getElementById('discordPublicWebhook').value = '';
  qsa('[data-clear]').forEach((b) => delete b.previousElementSibling.dataset.clear);

  document.getElementById('discordState').textContent = settings.discord.enabled
    ? settings.discord.configured
      ? 'Configured'
      : 'No webhook'
    : 'Disabled';

  document.getElementById('emailEnabled').checked = settings.email.enabled;
  document.getElementById('recipientEmail').value = settings.email.recipientEmail || '';
  document.getElementById('recipientEmail').placeholder = capabilities.envRecipient || 'owner@gmail.com';
  document.getElementById('senderName').value = settings.email.senderName || 'ShopX Store';
  document.getElementById('customerEmails').checked = settings.email.customerConfirmationEnabled;
  document.getElementById('emailState').textContent = settings.email.enabled
    ? capabilities.emailConfigured
      ? 'Configured'
      : 'SMTP missing'
    : 'Disabled';
  document.getElementById('recipientHint').textContent = capabilities.emailConfigured
    ? 'Receives the NEW SHOPX ORDER email.'
    : 'SMTP credentials are not set on the server yet (.env SMTP_HOST / SMTP_USER / SMTP_PASS).';

  renderTimezones(settings.storeTimezone);

  const tbody = qs('#eventsTable tbody');
  tbody.innerHTML = Object.keys(EVENT_LABELS)
    .filter((key) => settings.events[key])
    .map((key) => {
      const ev = settings.events[key];
      return `
        <tr>
          <td><b>${esc(EVENT_LABELS[key])}</b></td>
          <td><input type="checkbox" data-event="${key}" data-ch="discord" ${ev.discord ? 'checked' : ''} ${settings.discord.enabled ? '' : 'disabled'} aria-label="Discord for ${esc(EVENT_LABELS[key])}" /></td>
          <td><input type="checkbox" data-event="${key}" data-ch="email" ${ev.email ? 'checked' : ''} ${settings.email.enabled ? '' : 'disabled'} aria-label="Email for ${esc(EVENT_LABELS[key])}" /></td>
          </tr>`;
    })
    .join('');

  syncChannelAvailability();
};

const collectSettings = () => {
  const body = {
    discord: { enabled: document.getElementById('discordEnabled').checked },
    email: {
      enabled: document.getElementById('emailEnabled').checked,
      recipientEmail: document.getElementById('recipientEmail').value.trim(),
      senderName: document.getElementById('senderName').value.trim(),
      customerConfirmationEnabled: document.getElementById('customerEmails').checked,
    },
    storeTimezone: document.getElementById('storeTimezone').value,
    events: {},
  };

  [
    ['discordWebhook', 'webhookUrl'],
    ['discordStatusWebhook', 'statusWebhookUrl'],
    ['discordPublicWebhook', 'publicWebhookUrl'],
  ].forEach(([id, field]) => {
    const input = document.getElementById(id);
    const value = input.value.trim();
    if (input.dataset.clear === '1') {
      body.discord[field] = '';
      delete input.dataset.clear;
      input.value = '';
    } else if (value) {
      body.discord[field] = value;
    }
  });

  qsa('#eventsTable input[type="checkbox"]').forEach((box) => {
    const key = box.dataset.event;
    if (!body.events[key]) body.events[key] = {};
    body.events[key][box.dataset.ch] = box.checked;
  });

  return body;
};

const syncChannelAvailability = () => {
  const discordOn = document.getElementById('discordEnabled').checked;
  const emailOn = document.getElementById('emailEnabled').checked;
  qsa('#eventsTable input[type="checkbox"]').forEach((box) => {
    box.disabled = box.dataset.ch === 'discord' ? !discordOn : !emailOn;
  });
  document.getElementById('discordState').textContent = discordOn
    ? settingsCache && settingsCache.discord.configured
      ? 'Configured'
      : 'No webhook'
    : 'Disabled';
  document.getElementById('emailState').textContent = emailOn
    ? settingsCache && settingsCache.email.recipientEmail
      ? 'Configured'
      : 'Needs recipient'
    : 'Disabled';
};

async function loadSettings() {
  const res = await api.get('/admin/notifications/settings');
  renderForm(res.data.settings, res.data.capabilities);
}

async function loadHistory() {
  const tbody = qs('#historyTable tbody');
  const query = {
    page: historyState.page,
    limit: historyState.limit,
    orderId: document.getElementById('filterOrderId').value.trim(),
    channel: document.getElementById('filterChannel').value,
    status: document.getElementById('filterStatus').value,
    from: document.getElementById('filterFrom').value,
    to: document.getElementById('filterTo').value,
  };
  Object.keys(query).forEach((k) => query[k] === '' && delete query[k]);

  try {
    const [history, stats] = await Promise.all([
      api.get('/admin/notifications/history', query),
      api.get('/admin/notifications/stats'),
    ]);
    const jobs = history.data || [];
    const pg = history.pagination || { page: 1, pages: 1, total: 0 };

    const s = stats.data || { byStatus: {}, failed: 0 };
    document.getElementById('historyStats').textContent = `${pg.total} job(s) • ${s.failed || 0} failed`;

    if (!jobs.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:1.5rem">No notification jobs yet.</td></tr>';
    } else {
      tbody.innerHTML = jobs
        .map((job) => {
          const canRetry = job.status === 'failed' || job.status === 'retrying' || job.status === 'pending';
          return `
          <tr>
            <td class="text-sm">${esc(new Date(job.createdAt).toLocaleString('en-IN'))}</td>
            <td>${job.orderNumber ? `<a href="/admin/orders.html?id=${encodeURIComponent(job.orderNumber)}"><b>${esc(job.orderNumber)}</b></a>` : '—'}</td>
            <td><span class="admin-badge">${esc(job.channel)}</span></td>
            <td class="text-sm">${esc(job.eventType)}${job.publicCopy ? ' <span class="text-xs muted">(public)</span>' : ''}</td>
            <td class="text-xs muted">${esc(job.recipient || '—')}</td>
            <td><span class="status-badge st-${esc(job.status)}">${esc(job.status)}</span>${job.errorCategory ? `<br><span class="text-xs muted">${esc(job.errorCategory)}</span>` : ''}</td>
            <td class="text-sm">${job.attempts}${job.attempts > 1 ? ` / ${job.maxAttempts}` : ''}</td>
            <td class="row-actions">${canRetry ? `<button class="btn btn-sm btn-outline" data-retry="${job._id}">Retry</button>` : ''}</td>
          </tr>`;
        })
        .join('');
    }

    const pager = document.getElementById('historyPager');
    if (pg.pages > 1) {
      const btns = [`<button data-p="${pg.page - 1}" ${pg.page === 1 ? 'disabled' : ''}><</button>`];
      for (let i = 1; i <= pg.pages; i++) {
        if (i === 1 || i === pg.pages || Math.abs(i - pg.page) <= 1) {
          btns.push(`<button data-p="${i}" class="${i === pg.page ? 'active' : ''}">${i}</button>`);
        } else if (btns[btns.length - 1] !== '<button disabled>.</button>') {
          btns.push('<button disabled>.</button>');
        }
      }
      btns.push(`<button data-p="${pg.page + 1}" ${pg.page >= pg.pages ? 'disabled' : ''}>></button>`);
      pager.innerHTML = btns.join('');
      pager.onclick = (e) => {
        const b = e.target.closest('[data-p]');
        if (b && !b.disabled) {
          historyState.page = parseInt(b.dataset.p, 10);
          loadHistory();
        }
      };
    } else {
      pager.innerHTML = '';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:1.5rem">${esc(err.message)}</td></tr>`;
  }
}

document.addEventListener('admin:ready', async () => {
  const loading = document.getElementById('notifLoading');
  const content = document.getElementById('notifContent');

  try {
    await loadSettings();
    loading.classList.add('hidden');
    content.classList.remove('hidden');
  } catch (err) {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    alertBox('error', err.message);
  }

  await loadHistory();

  document.getElementById('saveSettingsBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    setBusy(btn, true);
    try {
      await api.patch('/admin/notifications/settings', collectSettings());
      await loadSettings();
      alertBox('success', 'Notification settings saved.');
      showToast('Notification settings saved.', 'success');
    } catch (err) {
      alertBox('error', err.message);
    } finally {
      setBusy(btn, false, 'Save settings');
    }
  });

  document.getElementById('testDiscordBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    setBusy(btn, true);
    try {
      const res = await api.post('/admin/notifications/test/discord', { message: 'ShopX Discord notification test — order alerts are connected.' });
      showToast(`Discord test delivered to ${res.data.target || 'webhook'}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(btn, false, 'Send Discord test');
    }
  });

  document.getElementById('testEmailBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    setBusy(btn, true);
    try {
      const res = await api.post('/admin/notifications/test/email', {});
      showToast(`Test email delivered to ${res.data.target || 'recipient'}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(btn, false, 'Send email test');
    }
  });

  document.getElementById('refreshHistoryBtn').addEventListener('click', loadHistory);

  ['filterChannel', 'filterStatus', 'filterFrom', 'filterTo'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
      historyState.page = 1;
      loadHistory();
    });
  });
  document.getElementById('filterOrderId').addEventListener(
    'input',
    debounce(() => {
      historyState.page = 1;
      loadHistory();
    }, 350)
  );

  document.getElementById('historyTable').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-retry]');
    if (!btn) return;
    btn.disabled = true;
    try {
      await api.post(`/admin/notifications/jobs/${btn.dataset.retry}/retry`, {});
      showToast('Notification queued for retry.', 'success');
      await loadHistory();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
    }
  });

  document.getElementById('discordEnabled').addEventListener('change', syncChannelAvailability);
  document.getElementById('emailEnabled').addEventListener('change', syncChannelAvailability);

  qsa('[data-clear]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.clear);
      input.value = '';
      input.dataset.clear = '1';
      showToast('Webhook will be removed when you save.', 'info');
    });
  });
});
