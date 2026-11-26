(() => {
  const $ = selector => document.querySelector(selector);
  const date = value => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const time = value => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const percent = value => value === null || value === undefined ? 'sem base' : `${value > 0 ? '+' : ''}${Number(value).toLocaleString('pt-BR')}%`;
  const escape = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const iso = value => value.toISOString().slice(0, 10);
  const defaultPeriods = () => { const end = new Date(); end.setHours(0, 0, 0, 0); const start = new Date(end); start.setDate(start.getDate() - 29); const previousEnd = new Date(start); previousEnd.setDate(previousEnd.getDate() - 1); const previousStart = new Date(previousEnd); previousStart.setDate(previousStart.getDate() - 29); return { currentStart: iso(start), currentEnd: iso(end), previousStart: iso(previousStart), previousEnd: iso(previousEnd) }; };
  const state = { data: null, token: sessionStorage.getItem('admin_dashboard_token') || '' };

  function setPeriods(values = defaultPeriods()) { Object.entries(values).forEach(([key, value]) => { $(`#${key}`).value = value; }); }
  function currentPeriods() { return { currentStart: $('#currentStart').value, currentEnd: $('#currentEnd').value, previousStart: $('#previousStart').value, previousEnd: $('#previousEnd').value }; }
  function metric(label, value, compare, hint) { const direction = compare === null || compare === undefined ? '' : compare >= 0 ? 'delta-up' : 'delta-down'; return `<article class="metric"><p class="eyebrow">${label}</p><strong>${value}</strong><small class="${direction}">${compare === null || compare === undefined ? hint : `${percent(compare)} vs. período anterior`}</small></article>`; }

  function renderMetrics(data) {
    const { totals } = data.current;
    $('#metrics').innerHTML = [
      metric('Faturamento aprovado', money(totals.revenue), data.comparison.revenue, 'Sem comparação suficiente'),
      metric('Pedidos aprovados', totals.approved, data.comparison.approved, 'Sem comparação suficiente'),
      metric('Aprovação entre tentativas', totals.approvalRate === null ? '—' : `${totals.approvalRate}%`, null, `${totals.attempts} tentativa(s)`),
      metric('Pix pendente', money(totals.pendingValue), null, `${totals.pending} pagamento(s) aguardando`)
    ].join('');
    $('#paymentStatus').textContent = totals.attempts ? `${totals.attempts} tentativa(s)` : 'sem dados';
  }

  function renderChart(daily) {
    const max = Math.max(1, ...daily.map(item => Number(item.revenue || 0)));
    $('#chart').innerHTML = daily.map(item => { const height = item.revenue ? Math.max(4, (item.revenue / max) * 100) : 2; return `<i class="bar" style="height:${height}%" data-label="${date(`${item.date}T00:00:00Z`)} · ${money(item.revenue)}"></i>`; }).join('');
  }

  function renderPayments(data) {
    const max = Math.max(1, ...data.current.methods.map(item => Number(item.revenue || 0)));
    $('#methods').innerHTML = data.current.methods.filter(item => item.orders || item.revenue).map(item => `<div class="method-row"><span>${escape(item.method.replaceAll('_', ' '))}</span><span class="method-track"><i style="width:${(item.revenue / max) * 100}%"></i></span><b>${money(item.revenue)}</b></div>`).join('') || '<p class="muted">Sem pagamentos aprovados no período.</p>';
    $('#installments').innerHTML = data.current.installments.length ? `<strong>Parcelas aprovadas</strong>${data.current.installments.map(item => `<span>${item.installments}x · ${item.orders}</span>`).join('')}` : '';
  }

  function renderProducts(data) {
    $('#products').innerHTML = data.current.products.map(item => `<div class="method-row"><span>${escape(item.name)}<small>${item.approved} aprovado(s) · ${item.pending} pendente(s) · ${item.failed} não realizado(s)</small></span><b>${money(item.revenue)}</b></div>`).join('');
  }

  function renderCampaigns(data) {
    const campaigns = data.campaigns.current;
    if (!campaigns.connected) { $('#campaigns').innerHTML = `<p class="campaign-empty">${escape(campaigns.reason)} Este painel continuará mostrando as vendas do Mercado Pago normalmente.</p>`; return; }
    const summarize = list => list.reduce((summary, item) => ({ spend: summary.spend + Number(item.spend || 0), clicks: summary.clicks + Number(item.clicks || 0), purchases: summary.purchases + Number(item.purchases || 0) }), { spend: 0, clicks: 0, purchases: 0 });
    const current = summarize(campaigns.campaigns);
    const previous = summarize(data.campaigns.previous.campaigns || []);
    const comparison = `<div class="campaign-summary"><span><b>Atual</b>${money(current.spend)} · ${current.clicks} cliques · ${current.purchases} compras</span><span><b>Anterior</b>${money(previous.spend)} · ${previous.clicks} cliques · ${previous.purchases} compras</span></div>`;
    $('#campaigns').innerHTML = campaigns.campaigns.length ? `${comparison}<div class="table-wrap"><table class="campaign-table"><thead><tr><th>Campanha atual</th><th>Investimento</th><th>Cliques</th><th>CTR</th><th>Compras</th></tr></thead><tbody>${campaigns.campaigns.map(item => `<tr><td title="${escape(item.name)}">${escape(item.name)}</td><td>${money(item.spend)}</td><td>${item.clicks}</td><td>${item.ctr}%</td><td>${item.purchases}</td></tr>`).join('')}</tbody></table></div>` : `${comparison}<p class="campaign-empty">Nenhuma campanha retornada no período atual.</p>`;
  }

  function renderFunnel(data) {
    const funnel = data.funnel;
    if (!funnel.available) {
      $('#funnel').innerHTML = `<p class="funnel-empty">${escape(funnel.current?.reason || 'O histórico do funil ainda não está disponível.')}</p><ul class="funnel-events">${funnel.trackedEvents.map(event => `<li>${escape(event)}</li>`).join('')}</ul>`;
      return;
    }
    const events = funnel.current.events || {};
    const previousEvents = funnel.previous?.events || {};
    const labels = { PageView: 'PageView · ofertas', ViewContent: 'ViewContent · produto', AddToCart: 'AddToCart · carrinho', InitiateCheckout: 'InitiateCheckout · início do pagamento', AddPaymentInfo: 'AddPaymentInfo · dados de pagamento', Purchase: 'Purchase · CAPI' };
    const rows = funnel.trackedEvents.map((name, index, names) => {
      const item = events[name] || {};
      const previous = previousEvents[name] || {};
      const metaRate = Number(item.observed) ? `${Math.round((Number(item.metaAccepted || 0) / Number(item.observed)) * 100)}%` : '—';
      const priorCount = Number(previous.observed || 0);
      const priorRatio = Number(previousEvents[names[index - 1]]?.observed || 0);
      const stepRatio = index === 0 ? '—' : priorRatio ? `${Math.round((Number(item.observed || 0) / priorRatio) * 100)}%` : '—';
      return `<tr><td>${escape(labels[name] || name)}</td><td>${Number(item.observed || 0)}</td><td>${Number(item.metaAccepted || 0)} <small>(${metaRate})</small></td><td>${priorCount}</td><td>${Number(item.withFbc || 0)}</td><td>${stepRatio}</td></tr>`;
    }).join('');
    const recent = (funnel.current.recent || []).slice(0, 10);
    const recentHtml = recent.length ? `<h3 class="funnel-subtitle">Últimos eventos recebidos</h3><div class="table-wrap"><table class="funnel-table"><thead><tr><th>Horário</th><th>Evento</th><th>Página</th><th>Meta</th><th>FBC</th></tr></thead><tbody>${recent.map(item => `<tr><td>${time(item.eventTime)}</td><td>${escape(item.eventName)}</td><td>${escape(item.path)}</td><td><span class="badge ${item.metaAccepted ? 'badge-approved' : 'badge-rejected'}">${item.metaAccepted ? 'aceito' : 'não aceito'}</span></td><td>${item.fbc ? 'sim' : 'não'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Ainda não há eventos recentes no período salvo.</p>';
    $('#funnel').innerHTML = `<div class="funnel-kpis"><span><b>Compras aprovadas no Mercado Pago</b><strong>${Number(funnel.approvedPurchases || 0)}</strong></span><span><b>Eventos do site observados</b><strong>${Object.values(events).reduce((sum, item) => sum + Number(item.observed || 0), 0)}</strong></span><span><b>Eventos com FBC</b><strong>${Object.values(events).reduce((sum, item) => sum + Number(item.withFbc || 0), 0)}</strong></span></div><div class="table-wrap"><table class="funnel-table"><thead><tr><th>Etapa</th><th>Site recebeu</th><th>Meta aceitou</th><th>Período anterior</th><th>Com FBC</th><th>Eventos / etapa anterior</th></tr></thead><tbody>${rows}</tbody></table></div>${recentHtml}<p class="muted">“Meta aceitou” significa que a API de eventos respondeu com sucesso; isso não garante atribuição a um anúncio. FBC indica que havia identificador de clique disponível. As taxas comparam ocorrências de eventos, não pessoas únicas.</p>`;
  }

  function renderRecommendations(data) { $('#recommendations').innerHTML = data.recommendations.map(item => `<li class="priority-${item.priority}"><b>${escape(item.title)}</b><span>${escape(item.detail)}</span></li>`).join(''); }
  function renderIntegrations(data) { const labels = { mercadoPago: 'Mercado Pago', webhook: 'Webhook assinado', metaCapi: 'Meta CAPI', metaPixelMatchesBrowser: 'Pixel navegador/servidor', metaAds: 'Meta Ads Insights', firstPartyFunnelStorage: 'Banco do funil' }; $('#integrations').innerHTML = Object.entries(labels).map(([key, label]) => `<div class="integration"><span>${label}</span><b class="${data.integrations[key] ? 'ok' : 'pending'}">${data.integrations[key] ? 'Conectado' : 'Pendente'}</b></div>`).join(''); }
  function renderOrders(data) { const orders = data.current.recent; $('#orders').innerHTML = orders.length ? orders.map(item => `<tr><td>${time(item.createdAt)}</td><td>${escape(item.id)}</td><td>${escape(item.method.replaceAll('_', ' '))}</td><td>${item.installments}x</td><td><span class="badge badge-${escape(item.status)}">${escape(item.status)}</span></td><td>${money(item.amount)}</td></tr>`).join('') : '<tr><td colspan="6">Nenhuma tentativa de pagamento no período selecionado.</td></tr>'; }
  function renderContacts(data) {
    const detail = data.contacts;
    if (!detail.enabled) { $('#contactsNotice').textContent = detail.configured ? 'Informe a chave de administrador para consultar contatos.' : 'Defina ADMIN_DASHBOARD_TOKEN no ambiente da Vercel para habilitar dados de clientes com segurança.'; $('#contacts').innerHTML = '<tr><td colspan="7">Dados de contato protegidos.</td></tr>'; return; }
    $('#contactsNotice').textContent = `${detail.records.length} registro(s) no período selecionado. Dados de cartão, CPF e endereço não são armazenados neste painel.`;
    $('#contacts').innerHTML = detail.records.length ? detail.records.map(item => `<tr><td>${time(item.createdAt)}</td><td>${escape(item.product)}</td><td>${escape(item.name)}</td><td><a href="mailto:${encodeURIComponent(item.email)}">${escape(item.email)}</a></td><td>${escape(item.phone)}</td><td><span class="badge badge-${escape(item.status)}">${escape(item.status)}</span></td><td>${money(item.amount)}</td></tr>`).join('') : '<tr><td colspan="7">Nenhuma tentativa de pagamento no período selecionado.</td></tr>';
  }

  function render(data) {
    state.data = data;
    renderMetrics(data); renderChart(data.current.daily); renderPayments(data); renderProducts(data); renderCampaigns(data); renderFunnel(data); renderRecommendations(data); renderIntegrations(data); renderOrders(data); renderContacts(data);
    $('#updated').textContent = `Atualizado em ${time(data.generatedAt)} · Vendas consultadas diretamente no Mercado Pago.`;
    $('#limitations').textContent = data.limitations.join(' ');
  }

  async function load() {
    const periods = currentPeriods();
    const params = new URLSearchParams({ current_start: periods.currentStart, current_end: periods.currentEnd, previous_start: periods.previousStart, previous_end: periods.previousEnd });
    $('#refresh').disabled = true; $('#refresh').textContent = 'Atualizando…'; $('#updated').textContent = 'Consultando dados de vendas…';
    try {
      const headers = state.token ? { 'X-Admin-Token': state.token } : {};
      const response = await fetch(`/api/admin/overview?${params}`, { cache: 'no-store', headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o painel.');
      render(data);
    } catch (error) {
      $('#updated').textContent = error.message;
    } finally { $('#refresh').disabled = false; $('#refresh').textContent = 'Atualizar dados'; }
  }

  setPeriods();
  $('#periodForm').addEventListener('submit', event => { event.preventDefault(); load(); });
  $('#refresh').addEventListener('click', load);
  $('#adminToken').value = state.token;
  $('#saveAdminToken').addEventListener('click', () => { state.token = $('#adminToken').value.trim(); if (state.token) sessionStorage.setItem('admin_dashboard_token', state.token); else sessionStorage.removeItem('admin_dashboard_token'); load(); });
  $('#clearAdminToken').addEventListener('click', () => { state.token = ''; $('#adminToken').value = ''; sessionStorage.removeItem('admin_dashboard_token'); load(); });
  load();
})();
