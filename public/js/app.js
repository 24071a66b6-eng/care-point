(() => {
  const api = window.CarePointAPI;
  const appRoot = document.getElementById('app');
  const toastRegion = document.getElementById('toast-region');
  const state = {
    user: null,
    page: 'dashboard',
    patients: [],
    patient: null,
    team: [],
    appointments: [],
    diagnoses: [],
    labs: [],
    messages: [],
    activity: [],
    notifications: [],
    unread: 0,
    search: '',
    appointmentFilter: 'all',
    chartRange: 6,
    chart: null,
    notificationOpen: false,
    appointmentFilters: { patient: '', from: '', to: '', status: 'all' }
  };

  const navItems = [
    ['dashboard', 'fa-house', 'Overview'],
    ['patients', 'fa-user-group', 'Patients'],
    ['appointments', 'fa-calendar-check', 'Appointments'],
    ['diagnoses', 'fa-notes-medical', 'Diagnosis history'],
    ['labs', 'fa-flask', 'Laboratory results'],
    ['team', 'fa-user-doctor', 'Care team'],
    ['messages', 'fa-comment-dots', 'Messages']
  ];

  function node(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'className') element.className = value;
      else if (key === 'text') element.textContent = value;
      else if (key === 'dataset') Object.assign(element.dataset, value);
      else if (key === 'checked' || key === 'disabled' || key === 'required') element[key] = value;
      else element.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return element;
  }

  function icon(name) {
    return node('i', { className: `fa-solid ${name}`, 'aria-hidden': 'true' });
  }

  function initials(text = '') {
    return text.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function fullName(patient) {
    return [patient?.firstName, patient?.lastName].filter(Boolean).join(' ');
  }

  function showToast(message, isError = false) {
    const toast = node('div', { className: `toast${isError ? ' error' : ''}`, role: 'status', text: message });
    toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 3800);
  }

  function localDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, options).format(date);
  }

  function localTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  function age(dob) {
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return '—';
    const today = new Date();
    let years = today.getFullYear() - date.getFullYear();
    if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) years -= 1;
    return years;
  }

  function titleFor(page) {
    return navItems.find(([key]) => key === page)?.[2] || 'CarePoint';
  }

  function mountShell() {
    const shell = node('div', { className: 'shell' });
    shell.innerHTML = `
      <div class="mobile-overlay" data-action="close-mobile"></div>
      <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        <div class="brand"><span class="brand-mark"><i class="fa-solid fa-heart-pulse"></i></span><span>Care<em>Point</em></span></div>
        <div class="nav-caption">Workspace</div><nav class="nav-list" id="nav-list"></nav>
        <div class="nav-caption">Patient navigator</div>
        <label class="search-wrap"><i class="fa-solid fa-magnifying-glass"></i><input id="patient-search" class="search-input" type="search" placeholder="Find a patient" aria-label="Search patients"></label>
        <div class="patient-list" id="patient-quick-list"></div>
        <div class="sidebar-bottom">
          <div class="demo-note"><strong>Demonstration only</strong><br>All records and measurements are fictional. Not for real patient care.</div>
          <div class="user-mini"><span class="avatar" id="user-avatar">CP</span><span><strong id="user-name">CarePoint staff</strong><small>Workspace account</small></span><button type="button" aria-label="Sign out" data-action="logout"><i class="fa-solid fa-arrow-right-from-bracket"></i></button></div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div style="display:flex;align-items:center">
            <button type="button" class="mobile-menu" aria-label="Open navigation" data-action="open-mobile"><i class="fa-solid fa-bars"></i></button>
            <div><h1 id="page-title">Overview</h1><span class="subtitle">Your care workspace at a glance</span></div>
          </div>
          <div class="top-actions">
            <span class="date-label" id="current-date"></span>
            <div class="notification-wrap"><button type="button" class="icon-button" aria-label="Notifications" aria-expanded="false" data-action="toggle-notifications"><i class="fa-regular fa-bell"></i><span id="notification-count"></span></button><div id="notification-menu"></div></div>
          </div>
        </header>
        <div class="content" id="content" tabindex="-1"></div>
      </main>`;
    appRoot.replaceChildren(shell);
  }

  function renderLogin(errorMessage = '') {
    const wrapper = node('main', { className: 'login-screen' });
    const card = node('section', { className: 'login-card', 'aria-labelledby': 'login-heading' });
    card.innerHTML = '<div class="brand"><span class="brand-mark"><i class="fa-solid fa-heart-pulse"></i></span><span>Care<em style="color:#18a99a;font-style:normal">Point</em></span></div><h1 id="login-heading">Welcome back</h1><p>Sign in to your fictional CarePoint demonstration workspace.</p>';
    const form = node('form', { id: 'login-form' });
    form.append(
      field('Email address', node('input', { name: 'email', type: 'email', autocomplete: 'username', required: true, maxlength: 160, placeholder: 'you@example.test' })),
      field('Password', node('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true, maxlength: 200, placeholder: 'Enter your password' }))
    );
    if (errorMessage) form.append(node('div', { className: 'inline-error', role: 'alert', text: errorMessage }));
    form.append(node('button', { type: 'submit', className: 'button', text: 'Sign in' }));
    card.append(form);
    wrapper.append(card);
    appRoot.replaceChildren(wrapper);
  }

  function field(labelText, control, full = false) {
    const label = node('label', { className: `field${full ? ' full' : ''}` });
    label.append(node('span', { text: labelText }), control);
    return label;
  }

  function selectControl(name, options, selected = '', required = false) {
    const select = node('select', { name, required });
    for (const [value, label] of options) {
      const option = node('option', { value, text: label });
      if (value === selected) option.selected = true;
      select.append(option);
    }
    return select;
  }

  function renderShellContent() {
    if (!document.getElementById('sidebar')) mountShell();
    document.getElementById('current-date').textContent = localDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric' });
    document.getElementById('user-name').textContent = state.user?.name || 'CarePoint staff';
    document.getElementById('user-avatar').textContent = initials(state.user?.name || 'CP');
    document.getElementById('page-title').textContent = titleFor(state.page);
    const nav = document.getElementById('nav-list');
    nav.replaceChildren(...navItems.map(([key, fa, label]) => {
      const item = node('button', {
        type: 'button',
        className: `nav-item${state.page === key ? ' active' : ''}`,
        dataset: { action: 'navigate', page: key },
        'aria-current': state.page === key ? 'page' : null
      }, icon(fa), node('span', { text: label }));
      if (key === 'messages' && state.unread) item.append(node('span', { className: 'nav-count', text: String(state.unread) }));
      return item;
    }));
    const quick = document.getElementById('patient-quick-list');
    const filtered = state.patients.filter((patient) => fullName(patient).toLowerCase().includes(state.search.toLowerCase()) || patient.patientNumber.toLowerCase().includes(state.search.toLowerCase()));
    quick.replaceChildren(...filtered.slice(0, 10).map((patient) => node('button', {
      className: `patient-option${state.patient?._id === patient._id ? ' selected' : ''}`,
      type: 'button',
      dataset: { action: 'select-patient', id: patient._id },
      'aria-pressed': state.patient?._id === patient._id
    },
    node('span', { className: 'avatar', text: initials(fullName(patient)) }),
    node('span', {}, node('strong', { text: fullName(patient) }), node('small', { text: patient.patientNumber })))));
    document.getElementById('patient-search').value = state.search;
    renderNotifications();
    renderPage();
  }

  function renderNotifications() {
    const count = document.getElementById('notification-count');
    count.replaceChildren();
    if (state.unread > 0) count.append(node('span', { className: 'dot-count', text: String(Math.min(state.unread, 9)) }));
    const menu = document.getElementById('notification-menu');
    menu.replaceChildren();
    if (!state.notificationOpen) return;
    const dropdown = node('div', { className: 'notification-menu', role: 'region', 'aria-label': 'Notifications' });
    dropdown.append(node('div', { className: 'panel-head' }, node('h3', { text: 'Notifications' }), node('span', { className: 'badge', text: `${state.unread} new` })));
    if (!state.notifications.length) dropdown.append(emptyState('No notifications yet.'));
    for (const item of state.notifications) {
      dropdown.append(node('button', {
        type: 'button',
        className: 'notification-item',
        dataset: { action: 'read-notification', id: item._id },
        'aria-label': `${item.title}${item.read ? '' : ', unread'}`
      }, node('strong', { text: item.title }), node('p', { text: item.message }), node('small', { text: `${item.read ? 'Read' : 'Unread'} · ${localDate(item.createdAt)}` })));
    }
    menu.append(dropdown);
  }

  function emptyState(message, fa = 'fa-folder-open') {
    return node('div', { className: 'empty-state' }, icon(fa), node('p', { text: message }));
  }

  function panel(title, body, subtitle = '') {
    return node('section', { className: 'panel' },
      node('div', { className: 'panel-head' }, node('div', {}, node('h3', { text: title }), subtitle ? node('p', { text: subtitle }) : null)),
      node('div', { className: 'panel-body' }, body));
  }

  function statCard(label, value, note, fa, tint) {
    return node('article', { className: 'stat-card' },
      node('div', {}, node('span', { className: 'stat-label', text: label }), node('strong', { className: 'stat-number', text: String(value ?? '—') }), node('small', { className: 'stat-note', text: note })),
      node('span', { className: `stat-icon ${tint}` }, icon(fa)));
  }

  function table(headers, rows, emptyMessage) {
    if (!rows.length) return emptyState(emptyMessage);
    const thead = node('thead', {}, node('tr', {}, headers.map((header) => node('th', { scope: 'col', text: header }))));
    const tbody = node('tbody', {}, rows);
    return node('div', { className: 'table-wrap' }, node('table', {}, thead, tbody));
  }

  function badge(text, variant = '') {
    return node('span', { className: `badge${variant ? ` ${variant}` : ''}`, text });
  }

  function statusVariant(status) {
    if (['Active', 'Available', 'Completed', 'In range'].includes(status)) return 'green';
    if (['Scheduled', 'Monitoring', 'In clinic'].includes(status)) return 'blue';
    if (['Review', 'Pending'].includes(status)) return 'amber';
    if (['Cancelled', 'Away'].includes(status)) return 'coral';
    return '';
  }

  function renderPage() {
    const content = document.getElementById('content');
    if (!content) return;
    if (state.page === 'dashboard') content.replaceChildren(renderDashboard());
    else if (state.page === 'patients') content.replaceChildren(renderPatients());
    else if (state.page === 'appointments') content.replaceChildren(renderAppointments());
    else if (state.page === 'diagnoses') content.replaceChildren(renderDiagnoses());
    else if (state.page === 'labs') content.replaceChildren(renderLabs());
    else if (state.page === 'team') content.replaceChildren(renderTeam());
    else if (state.page === 'messages') content.replaceChildren(renderMessages());
    if (state.page === 'dashboard' || state.page === 'patients') renderChart();
  }

  function renderDashboard() {
    const summary = state.summary || {};
    const root = node('div');
    root.append(
      node('div', { className: 'welcome-row' },
        node('div', {}, node('h2', { text: `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${state.user?.name?.split(' ')[0] || 'there'}` }), node('p', { text: 'Here is an overview of your demonstration workspace.' })),
        node('button', { className: 'button', type: 'button', dataset: { action: 'open-modal', form: 'appointment' } }, icon('fa-plus'), ' New appointment')
      ),
      node('div', { className: 'stats-grid' },
        statCard('Total patients', summary.patients, 'Fictional profiles', 'fa-user-group', 'tint-teal'),
        statCard("Today's appointments", summary.todayAppointments, 'From saved records', 'fa-calendar-day', 'tint-blue'),
        statCard('Upcoming appointments', summary.upcomingAppointments, 'Scheduled or checked in', 'fa-clock', 'tint-coral'),
        statCard('Care team members', summary.teamMembers, 'Workspace directory', 'fa-user-doctor', 'tint-amber')
      )
    );
    const chart = panel(state.patient ? `${fullName(state.patient)} · blood pressure` : 'Patient blood pressure', node('div', {}, node('div', { className: 'chart-wrap' }, node('canvas', { id: 'bp-chart', role: 'img', 'aria-label': 'Demonstration systolic and diastolic blood pressure over time' }))), 'Fictional measurements for demonstration only');
    chart.querySelector('.panel-head').append(node('select', { className: 'chart-select', 'aria-label': 'Chart range', dataset: { action: 'chart-range' } },
      node('option', { value: '6', text: '6 months' }), node('option', { value: '12', text: '1 year' })));
    chart.querySelector('select').value = String(state.chartRange);
    const vitals = renderVitals();
    const mainGrid = node('div', { className: 'grid-two' },
      node('div', {}, chart, node('div', { className: 'section-spacer' }, panel('Latest health indicators', vitals, 'Most recent stored demonstration reading'))),
      node('div', {}, renderUpcomingPanel(), node('div', { className: 'section-spacer' }, renderActivityPanel()))
    );
    root.append(mainGrid);
    return root;
  }

  function renderVitals() {
    const readings = state.patient?.vitals || [];
    const latest = [...readings].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];
    if (!latest) return emptyState('No vital readings are available for this patient.');
    return node('div', { className: 'vital-row' },
      vital('Heart rate', latest.heartRate, 'bpm'),
      vital('Respiratory rate', latest.respiratoryRate, '/min'),
      vital('Temperature', latest.temperature, '°C'),
      vital('Blood pressure', latest.systolic && latest.diastolic ? `${latest.systolic}/${latest.diastolic}` : null, 'mmHg'),
      node('small', { className: 'stat-note', text: `Demo reading · ${localDate(latest.recordedAt)}` })
    );
  }

  function vital(label, value, unit) {
    return node('div', { className: 'vital' }, node('span', { text: label }), node('strong', { text: value === undefined || value === null ? '—' : String(value) }), node('small', { text: unit }));
  }

  function renderUpcomingPanel() {
    const rows = (state.summary?.nextAppointments || []).map((appointment) => {
      const date = new Date(appointment.scheduledAt);
      return node('div', { className: 'appointment-row' },
        node('div', { className: 'date-chip' }, node('strong', { text: Number.isNaN(date.getTime()) ? '—' : String(date.getDate()) }), node('small', { text: Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short' }) })),
        node('div', {}, node('strong', { text: fullName(appointment.patient) || 'Patient' }), node('small', { text: `${appointment.type} · ${localTime(appointment.scheduledAt)}` }))
      );
    });
    const body = rows.length ? node('div', {}, rows) : emptyState('No upcoming appointments.');
    return panel('Upcoming appointments', body, 'Next scheduled visits');
  }

  function renderActivityPanel() {
    const body = state.activity.length ? node('div', { className: 'activity-list' }, state.activity.map((item) => {
      const fa = item.type === 'appointment' ? 'fa-calendar-check' : item.type === 'message' ? 'fa-comment' : item.type === 'lab' ? 'fa-flask' : 'fa-user';
      return node('div', { className: 'activity-item' },
        node('span', { className: 'activity-icon' }, icon(fa)),
        node('div', {}, node('strong', { text: item.action }), node('small', { text: `${item.detail || ''}${item.detail ? ' · ' : ''}${localDate(item.createdAt)}` }))
      );
    })) : emptyState('No recent activity has been recorded.');
    return panel('Recent activity', body);
  }

  function renderPatients() {
    const root = node('div');
    root.append(node('div', { className: 'toolbar' }, node('h2', { text: 'Patient profiles' }), node('div', { className: 'toolbar-actions' },
      node('button', { className: 'button secondary', type: 'button', dataset: { action: 'export-diagnoses' } }, icon('fa-download'), ' Export diagnoses'),
      node('button', { className: 'button', type: 'button', dataset: { action: 'open-modal', form: 'patient' } }, icon('fa-plus'), ' Add patient')
    )));
    const list = node('div', { className: 'patient-list' }, state.patients.map((patient) => node('button', {
      type: 'button', className: `patient-option${state.patient?._id === patient._id ? ' selected' : ''}`,
      dataset: { action: 'select-patient', id: patient._id }, 'aria-pressed': state.patient?._id === patient._id
    }, node('span', { className: 'avatar', text: initials(fullName(patient)) }),
    node('span', {}, node('strong', { text: fullName(patient) }), node('small', { text: `${patient.patientNumber} · age ${age(patient.dateOfBirth)}` })))));
    if (!state.patients.length) list.append(emptyState('No patients found. Add a fictional patient profile.'));
    const left = node('section', { className: 'panel' }, node('div', { className: 'panel-head' }, node('div', {}, node('h3', { text: 'Patient directory' }), node('p', { text: `${state.patients.length} loaded profiles` }))), list);
    const detail = state.patient ? renderPatientDetail() : emptyState('Choose a patient from the directory.');
    root.append(node('div', { className: 'patient-layout' }, left, detail));
    return root;
  }

  function renderPatientDetail() {
    const patient = state.patient;
    const profile = node('section', { className: 'panel' });
    profile.append(node('div', { className: 'panel-head' },
      node('div', { className: 'profile-top' },
        node('span', { className: 'avatar', text: initials(fullName(patient)) }),
        node('div', {}, node('h2', { text: fullName(patient) }), node('p', { text: `${patient.patientNumber} · ${patient.gender || 'Unspecified'}` })),
        node('button', { className: 'button secondary small', type: 'button', dataset: { action: 'patient-details' } }, 'Details')
      )
    ));
    profile.append(node('div', { className: 'panel-body' },
      node('div', { className: 'profile-facts' },
        fact('Age', `${age(patient.dateOfBirth)} years`),
        fact('Date of birth', localDate(patient.dateOfBirth)),
        fact('Email', patient.email || 'Not provided'),
        fact('Phone', patient.phone || 'Not provided'),
        fact('Insurance', patient.insurance?.provider || 'Not provided'),
        fact('Member ID', patient.insurance?.memberId || 'Not provided')
      ),
      node('div', { className: 'section-spacer' }, node('div', { className: 'panel-head', style: 'padding:0 0 10px' }, node('div', {}, node('h3', { text: 'Blood pressure trend' }), node('p', { text: 'Stored demonstration measurements' })), node('select', { className: 'chart-select', 'aria-label': 'Chart range', dataset: { action: 'chart-range' } }, node('option', { value: '6', text: '6 months' }), node('option', { value: '12', text: '1 year' }))),
        node('div', { className: 'chart-wrap' }, node('canvas', { id: 'bp-chart', role: 'img', 'aria-label': 'Demonstration blood pressure trend' }))
      ),
      node('div', { className: 'section-spacer' }, panel('Latest health indicators', renderVitals(), 'Illustrative data only')),
      node('div', { className: 'section-spacer' }, panel('Diagnosis history', renderDiagnosisTable(state.diagnoses.slice(0, 4)), 'Fictional records only')),
      node('div', { className: 'section-spacer' }, panel('Laboratory results', renderLabTable(state.labs.slice(0, 4)), 'Fictional records only'))
    ));
    return profile;
  }

  function fact(label, value) {
    return node('div', { className: 'fact' }, node('label', { text: label }), node('span', { text: String(value) }));
  }

  function renderDiagnosisTable(records) {
    return table(['Diagnosis', 'Recorded', 'Status'], records.map((item) => node('tr', {},
      node('td', {}, node('strong', { text: item.name }), node('br'), node('span', { text: item.description || '' })),
      node('td', { text: localDate(item.recordedAt) }),
      node('td', {}, badge(item.status, statusVariant(item.status)))
    )), 'No diagnosis records for this patient.');
  }

  function renderLabTable(records) {
    return table(['Test', 'Result', 'Reference', 'Status'], records.map((item) => node('tr', {},
      node('td', {}, node('strong', { text: item.testName }), node('br'), node('span', { text: localDate(item.recordedAt) })),
      node('td', { text: `${item.resultValue}${item.unit && item.unit !== '—' ? ` ${item.unit}` : ''}` }),
      node('td', { text: item.referenceRange || '—' }),
      node('td', {}, badge(item.status, statusVariant(item.status)))
    )), 'No laboratory results for this patient.');
  }

  function renderAppointments() {
    const root = node('div');
    const toolbar = node('div', { className: 'toolbar' }, node('h2', { text: 'Appointments' }));
    const actions = node('div', { className: 'toolbar-actions' });
    const filter = selectControl('appointmentFilter', [['all', 'All statuses'], ['Scheduled', 'Scheduled'], ['Checked in', 'Checked in'], ['Completed', 'Completed'], ['Cancelled', 'Cancelled']], state.appointmentFilters.status);
    filter.className = 'select-control';
    filter.dataset.action = 'appointment-filter';
    const patientFilter = selectControl('appointmentPatient', [['', 'All patients'], ...state.patients.map((patient) => [patient._id, fullName(patient)])], state.appointmentFilters.patient);
    patientFilter.className = 'select-control';
    patientFilter.dataset.action = 'appointment-patient-filter';
    actions.append(
      patientFilter,
      node('input', { className: 'select-control', type: 'date', 'aria-label': 'Filter appointments from', value: state.appointmentFilters.from, dataset: { action: 'appointment-from-filter' } }),
      node('input', { className: 'select-control', type: 'date', 'aria-label': 'Filter appointments to', value: state.appointmentFilters.to, dataset: { action: 'appointment-to-filter' } }),
      filter,
      node('button', { className: 'button', type: 'button', dataset: { action: 'open-modal', form: 'appointment' } }, icon('fa-plus'), ' New appointment')
    );
    toolbar.append(actions);
    root.append(toolbar);
    const rows = state.appointments.map((item) => node('tr', {},
      node('td', {}, node('strong', { text: fullName(item.patient) || 'Unknown patient' }), node('br'), node('span', { text: item.patient?.patientNumber || '' })),
      node('td', { text: localDate(item.scheduledAt) }),
      node('td', { text: localTime(item.scheduledAt) }),
      node('td', { text: item.type }),
      node('td', { text: item.teamMember?.name || 'Unassigned' }),
      node('td', {}, badge(item.status, statusVariant(item.status))),
      node('td', {},
        node('button', { className: 'button secondary small', type: 'button', dataset: { action: 'view-appointment', id: item._id }, 'aria-label': `View ${item.type}` }, icon('fa-eye')),
        node('button', { className: 'button secondary small', type: 'button', dataset: { action: 'edit-appointment', id: item._id }, 'aria-label': `Edit ${item.type}`, style: 'margin-left:5px' }, icon('fa-pen')),
        node('button', { className: 'button danger small', type: 'button', dataset: { action: 'delete-appointment', id: item._id }, 'aria-label': `Cancel ${item.type}`, style: 'margin-left:5px' }, icon('fa-xmark')))
    ));
    root.append(node('section', { className: 'panel' }, table(['Patient', 'Date', 'Time', 'Appointment', 'Professional', 'Status', 'Actions'], rows, 'No appointments match this filter.')));
    return root;
  }

  function renderDiagnoses() {
    const root = node('div');
    const toolbar = node('div', { className: 'toolbar' }, node('h2', { text: `Diagnosis history${state.patient ? ` · ${fullName(state.patient)}` : ''}` }));
    const actions = node('div', { className: 'toolbar-actions' });
    if (!state.patient && state.patients.length) actions.append(patientSelect());
    actions.append(node('button', { className: 'button secondary', type: 'button', dataset: { action: 'export-diagnoses' } }, icon('fa-download'), ' Export CSV'));
    if (state.patient) actions.append(node('button', { className: 'button', type: 'button', dataset: { action: 'open-modal', form: 'diagnosis' } }, icon('fa-plus'), ' Add diagnosis'));
    toolbar.append(actions);
    root.append(toolbar, node('section', { className: 'panel' }, renderDiagnosisTable(state.diagnoses)));
    return root;
  }

  function renderLabs() {
    const root = node('div');
    const toolbar = node('div', { className: 'toolbar' }, node('h2', { text: `Laboratory results${state.patient ? ` · ${fullName(state.patient)}` : ''}` }));
    const actions = node('div', { className: 'toolbar-actions' });
    if (!state.patient && state.patients.length) actions.append(patientSelect());
    actions.append(node('button', { className: 'button secondary', type: 'button', dataset: { action: 'export-labs' } }, icon('fa-download'), ' Export CSV'));
    if (state.patient) actions.append(node('button', { className: 'button', type: 'button', dataset: { action: 'open-modal', form: 'lab' } }, icon('fa-plus'), ' Add result'));
    toolbar.append(actions);
    root.append(toolbar, node('section', { className: 'panel' }, renderLabTable(state.labs)));
    return root;
  }

  function patientSelect() {
    const select = selectControl('patient', [['', 'Choose patient'], ...state.patients.map((patient) => [patient._id, fullName(patient)])], state.patient?._id || '');
    select.className = 'select-control';
    select.dataset.action = 'patient-filter';
    return select;
  }

  function renderTeam() {
    const root = node('div');
    root.append(node('div', { className: 'toolbar' }, node('h2', { text: 'Care team' }), node('button', { className: 'button', type: 'button', dataset: { action: 'open-modal', form: 'team' } }, icon('fa-plus'), ' Add team member')));
    const rows = state.team.map((member) => node('tr', {},
      node('td', {}, node('div', { className: 'profile-top' }, node('span', { className: 'avatar', text: initials(member.name) }), node('div', {}, node('strong', { text: member.name }), node('p', { text: member.email })))),
      node('td', { text: member.specialty }),
      node('td', { text: member.phone || '—' }),
      node('td', {}, badge(member.status, statusVariant(member.status))),
      node('td', {}, node('button', { className: 'button secondary small', type: 'button', dataset: { action: 'edit-team', id: member._id }, 'aria-label': `Edit ${member.name}` }, icon('fa-pen')),
        node('button', { className: 'button secondary small', type: 'button', dataset: { action: 'view-team', id: member._id }, 'aria-label': `View ${member.name}`, style: 'margin-left:5px' }, icon('fa-eye')),
        node('button', { className: 'button danger small', type: 'button', dataset: { action: 'delete-team', id: member._id }, 'aria-label': `Remove ${member.name}`, style: 'margin-left:5px' }, icon('fa-trash')))
    ));
    root.append(node('section', { className: 'panel' }, table(['Team member', 'Specialty', 'Phone', 'Status', 'Actions'], rows, 'No team members have been added.')));
    return root;
  }

  function renderMessages() {
    const root = node('div');
    const toolbar = node('div', { className: 'toolbar' }, node('h2', { text: 'Patient messages' }));
    if (state.patients.length) toolbar.append(patientSelect());
    root.append(toolbar);
    if (!state.patient) {
      root.append(node('section', { className: 'panel' }, emptyState('Select a patient to open their message thread.')));
      return root;
    }
    const body = node('div', { className: 'message-box' });
    if (!state.messages.length) body.append(emptyState('No messages yet. Start a demonstration thread.'));
    else for (const message of state.messages) {
      body.append(node('article', { className: `message-item${message.senderRole === 'patient' ? ' patient' : ''}` },
        node('strong', { text: `${message.senderName} · ${message.senderRole === 'patient' ? 'Patient' : 'Care team'}` }),
        node('p', { text: message.text }),
        node('small', { text: localDate(message.createdAt, { month: 'short', day: 'numeric' }) + `, ${localTime(message.createdAt)}` })
      ));
    }
    const form = node('form', { id: 'message-form', className: 'message-form', dataset: { patientId: state.patient._id } });
    form.append(node('textarea', { name: 'text', required: true, maxlength: 2000, placeholder: 'Write a fictional demonstration message…', 'aria-label': 'Message text' }), node('button', { className: 'button', type: 'submit', text: 'Send' }));
    root.append(node('section', { className: 'panel' }, node('div', { className: 'panel-head' }, node('div', {}, node('h3', { text: `Thread · ${fullName(state.patient)}` }), node('p', { text: 'Messages are demonstration records, not a secure clinical messaging service.' }))), node('div', { className: 'panel-body' }, body, form)));
    return root;
  }

  function renderChart() {
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
    const canvas = document.getElementById('bp-chart');
    if (!canvas) return;
    if (!state.patient) {
      canvas.hidden = true;
      canvas.parentElement?.append(emptyState('Select a patient to view stored blood-pressure measurements.'));
      return;
    }
    if (!window.Chart) {
      canvas.hidden = true;
      canvas.parentElement?.append(emptyState('The chart library did not load. Check your internet connection.'));
      return;
    }
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - Number(state.chartRange));
    const records = [...(state.patient.vitals || [])]
      .filter((record) => new Date(record.recordedAt) >= cutoff)
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    if (!records.some((record) => record.systolic != null && record.diastolic != null)) {
      const parent = canvas.parentElement;
      if (parent) parent.append(emptyState('No blood-pressure history is available for this range.'));
      canvas.hidden = true;
      return;
    }
    canvas.hidden = false;
    state.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: records.map((record) => localDate(record.recordedAt, { month: 'short', year: '2-digit' })),
        datasets: [
          { label: 'Systolic', data: records.map((record) => record.systolic ?? null), borderColor: '#18a99a', backgroundColor: '#18a99a20', tension: .36, fill: true, pointRadius: 3 },
          { label: 'Diastolic', data: records.map((record) => record.diastolic ?? null), borderColor: '#6f8fe4', backgroundColor: '#6f8fe420', tension: .36, fill: false, pointRadius: 3 }
        ]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 7, font: { family: 'DM Sans', size: 10 } } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#91a0a9', font: { size: 9 } } },
          y: { grid: { color: '#edf1f3' }, ticks: { color: '#91a0a9', font: { size: 9 } }, title: { display: true, text: 'mmHg', color: '#91a0a9' } }
        }
      }
    });
  }

  async function loadAll() {
    const [summaryResult, patientsResult, teamResult, appointmentsResult, activityResult, notificationsResult] = await Promise.all([
      api.get('/dashboard/summary'),
      api.get('/patients?limit=100'),
      api.get('/teams?limit=100'),
      api.get('/appointments?limit=100'),
      api.get('/dashboard/activity'),
      api.get('/notifications?limit=20')
    ]);
    state.summary = summaryResult.data;
    state.patients = patientsResult.data;
    state.team = teamResult.data;
    state.appointments = appointmentsResult.data;
    state.activity = activityResult.data;
    state.notifications = notificationsResult.data;
    state.unread = notificationsResult.unread || 0;
    if (!state.patient && state.patients.length) state.patient = state.patients[0];
    if (state.patient) await loadPatientDetails(state.patient._id, false);
    renderShellContent();
  }

  async function loadPatientDetails(id, render = true) {
    const found = state.patients.find((patient) => patient._id === id);
    if (!found) return;
    state.patient = found;
    try {
      const [profile, diagnoses, labs, messages] = await Promise.all([
        api.get(`/patients/${id}`),
        api.get(`/patients/${id}/diagnoses?limit=100`),
        api.get(`/patients/${id}/labs?limit=100`),
        api.get(`/patients/${id}/messages?limit=100`)
      ]);
      state.patient = profile.data;
      state.diagnoses = diagnoses.data;
      state.labs = labs.data;
      state.messages = messages.data;
      if (render) renderShellContent();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function showLoginIfNeeded(message) {
    state.user = null;
    state.patient = null;
    state.chart?.destroy();
    state.chart = null;
    renderLogin(message);
  }

  async function bootstrap() {
    if (!sessionStorage.getItem(api.tokenKey)) return renderLogin();
    try {
      const response = await api.get('/auth/me');
      state.user = response.data;
      await loadAll();
    } catch (error) {
      sessionStorage.removeItem(api.tokenKey);
      renderLogin(error.message);
    }
  }

  function openModal(title, formNode) {
    closeModal();
    const backdrop = node('div', { className: 'modal-backdrop', role: 'presentation', dataset: { modalBackdrop: 'true' } });
    const dialog = node('section', { className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title' });
    dialog.append(node('header', { className: 'modal-head' }, node('h2', { id: 'modal-title', text: title }), node('button', { className: 'modal-close', type: 'button', 'aria-label': 'Close dialog', dataset: { action: 'close-modal' } }, icon('fa-xmark'))), formNode);
    backdrop.append(dialog);
    document.body.append(backdrop);
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
      if (event.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((item) => !item.disabled);
        if (focusable.length && event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault();
          focusable.at(-1).focus();
        } else if (focusable.length && !event.shiftKey && document.activeElement === focusable.at(-1)) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    });
    backdrop.querySelector('input, select, textarea, button')?.focus();
  }

  function closeModal() {
    document.querySelector('.modal-backdrop')?.remove();
  }

  function formContainer(id, ...children) {
    const form = node('form', { id });
    form.append(node('div', { className: 'form-grid' }, children));
    form.append(node('div', { className: 'form-actions' }, node('button', { className: 'button secondary', type: 'button', dataset: { action: 'close-modal' }, text: 'Cancel' }), node('button', { className: 'button', type: 'submit', text: 'Save' })));
    return form;
  }

  function openForm(kind, record = null) {
    if (kind === 'appointment') {
      const form = formContainer('record-form',
        field('Patient', selectControl('patient', [['', 'Choose a patient'], ...state.patients.map((p) => [p._id, fullName(p)])], record?.patient?._id || record?.patient || state.patient?._id || '', true)),
        field('Healthcare professional', selectControl('teamMember', [['', 'Unassigned'], ...state.team.map((member) => [member._id, `${member.name} · ${member.specialty}`])], record?.teamMember?._id || record?.teamMember || '')),
        field('Date and time', node('input', { name: 'scheduledAt', type: 'datetime-local', required: true, value: record ? new Date(new Date(record.scheduledAt).getTime() - new Date(record.scheduledAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '' })),
        field('Appointment type', node('input', { name: 'type', required: true, maxlength: 100, value: record?.type || '', placeholder: 'e.g. Routine follow-up' })),
        field('Status', selectControl('status', [['Scheduled', 'Scheduled'], ['Checked in', 'Checked in'], ['Completed', 'Completed'], ['Cancelled', 'Cancelled']], record?.status || 'Scheduled')),
        field('Notes', node('textarea', { name: 'notes', maxlength: 1000, placeholder: 'Optional demonstration notes', text: record?.notes || '' }), true));
      form.dataset.kind = 'appointment';
      form.dataset.recordId = record?._id || '';
      openModal(record ? 'Edit appointment' : 'Create appointment', form);
    } else if (kind === 'team') {
      const form = formContainer('record-form',
        field('Name', node('input', { name: 'name', required: true, maxlength: 100, value: record?.name || '' })),
        field('Specialty', node('input', { name: 'specialty', required: true, maxlength: 100, value: record?.specialty || '' })),
        field('Email', node('input', { name: 'email', type: 'email', required: true, maxlength: 160, value: record?.email || '' })),
        field('Phone', node('input', { name: 'phone', maxlength: 30, value: record?.phone || '' })),
        field('Status', selectControl('status', [['Available', 'Available'], ['In clinic', 'In clinic'], ['Away', 'Away']], record?.status || 'Available')));
      form.dataset.kind = 'team';
      form.dataset.recordId = record?._id || '';
      openModal(record ? 'Edit team member' : 'Add team member', form);
    } else if (kind === 'patient') {
      const form = formContainer('record-form',
        field('First name', node('input', { name: 'firstName', required: true, maxlength: 60 })),
        field('Last name', node('input', { name: 'lastName', required: true, maxlength: 60 })),
        field('Patient number', node('input', { name: 'patientNumber', required: true, maxlength: 30, placeholder: 'CP-DEMO-009' })),
        field('Date of birth', node('input', { name: 'dateOfBirth', type: 'date', required: true, max: new Date().toISOString().slice(0, 10) })),
        field('Gender', selectControl('gender', [['Unspecified', 'Unspecified'], ['Female', 'Female'], ['Male', 'Male'], ['Non-binary', 'Non-binary']])),
        field('Email', node('input', { name: 'email', type: 'email', maxlength: 160 })),
        field('Phone', node('input', { name: 'phone', maxlength: 30 })),
        field('Address', node('input', { name: 'address', maxlength: 240 }), true),
        field('Insurance provider', node('input', { name: 'insuranceProvider', maxlength: 100 })),
        field('Insurance member ID', node('input', { name: 'insuranceMemberId', maxlength: 80 })));
      form.dataset.kind = 'patient';
      openModal('Add fictional patient', form);
    } else if (kind === 'diagnosis') {
      const form = formContainer('record-form',
        field('Diagnosis name', node('input', { name: 'name', required: true, maxlength: 140 })),
        field('Recorded date', node('input', { name: 'recordedAt', type: 'date', required: true, value: new Date().toISOString().slice(0, 10) })),
        field('Status', selectControl('status', [['Active', 'Active'], ['Monitoring', 'Monitoring'], ['Resolved', 'Resolved']], 'Active')),
        field('Description', node('textarea', { name: 'description', maxlength: 1000 }), true));
      form.dataset.kind = 'diagnosis';
      openModal('Add fictional diagnosis', form);
    } else if (kind === 'lab') {
      const form = formContainer('record-form',
        field('Test name', node('input', { name: 'testName', required: true, maxlength: 140 })),
        field('Result value', node('input', { name: 'resultValue', required: true, maxlength: 80 })),
        field('Unit', node('input', { name: 'unit', maxlength: 40 })),
        field('Reference range', node('input', { name: 'referenceRange', maxlength: 80 })),
        field('Recorded date', node('input', { name: 'recordedAt', type: 'date', required: true, value: new Date().toISOString().slice(0, 10) })),
        field('Status', selectControl('status', [['In range', 'In range'], ['Review', 'Review'], ['Pending', 'Pending']], 'In range')));
      form.dataset.kind = 'lab';
      openModal('Add fictional laboratory result', form);
    }
  }

  function formValues(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') data[key] = value.trim();
    }
    return data;
  }

  async function submitRecord(form) {
    const kind = form.dataset.kind;
    const id = form.dataset.recordId;
    const data = formValues(form);
    try {
      if (kind === 'appointment') {
        if (!data.teamMember) delete data.teamMember;
        await (id ? api.patch(`/appointments/${id}`, data) : api.post('/appointments', data));
      } else if (kind === 'team') {
        await (id ? api.patch(`/teams/${id}`, data) : api.post('/teams', data));
      } else if (kind === 'patient') {
        data.insurance = { provider: data.insuranceProvider, memberId: data.insuranceMemberId };
        delete data.insuranceProvider;
        delete data.insuranceMemberId;
        await api.post('/patients', data);
      } else if (kind === 'diagnosis') {
        await api.post(`/patients/${state.patient._id}/diagnoses`, { ...data, recordedAt: new Date(`${data.recordedAt}T12:00:00`).toISOString() });
      } else if (kind === 'lab') {
        await api.post(`/patients/${state.patient._id}/labs`, { ...data, recordedAt: new Date(`${data.recordedAt}T12:00:00`).toISOString() });
      }
      closeModal();
      showToast('Saved successfully.');
      await loadAll();
      if (state.patient) await loadPatientDetails(state.patient._id);
    } catch (error) {
      const existing = form.querySelector('.inline-error');
      existing?.remove();
      form.prepend(node('div', { className: 'inline-error', role: 'alert', text: error.message }));
    }
  }

  function exportCSV(records, columns, filename) {
    if (!records.length) {
      showToast('There are no records to export.', true);
      return;
    }
    const quote = (value) => {
      let text = value === null || value === undefined ? '' : String(value);
      if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [columns.map(([, label]) => quote(label)).join(',')];
    for (const record of records) rows.push(columns.map(([key]) => quote(record[key])).join(','));
    const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = node('a', { href: url, download: filename });
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('CSV export started.');
  }

  function exportDiagnoses() {
    const selected = state.diagnoses.map((item) => ({
      patient: fullName(state.patient),
      diagnosis: item.name,
      description: item.description || '',
      recorded: localDate(item.recordedAt),
      status: item.status
    }));
    exportCSV(selected, [['patient', 'Patient'], ['diagnosis', 'Diagnosis'], ['description', 'Description'], ['recorded', 'Recorded'], ['status', 'Status']], `carepoint-diagnoses-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportLabs() {
    const selected = state.labs.map((item) => ({
      patient: fullName(state.patient),
      test: item.testName,
      value: `${item.resultValue}${item.unit ? ` ${item.unit}` : ''}`,
      reference: item.referenceRange || '',
      status: item.status,
      recorded: localDate(item.recordedAt)
    }));
    exportCSV(selected, [['patient', 'Patient'], ['test', 'Test'], ['value', 'Result'], ['reference', 'Reference range'], ['status', 'Status'], ['recorded', 'Recorded']], `carepoint-labs-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function confirmAction(message, callback) {
    const content = node('div', { className: 'modal-content' }, node('p', { text: message }));
    const actions = node('div', { className: 'form-actions' }, node('button', { className: 'button secondary', type: 'button', dataset: { action: 'close-modal' }, text: 'Keep' }), node('button', { className: 'button danger', type: 'button', dataset: { action: 'confirm-action', text: 'Confirm' }, text: 'Confirm' }));
    content.append(actions);
    openModal('Please confirm', content);
    document.querySelector('[data-action="confirm-action"]').addEventListener('click', async () => {
      closeModal();
      await callback();
    }, { once: true });
  }

  async function handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) {
      if (event.target.matches('[data-modal-backdrop]')) closeModal();
      return;
    }
    const action = target.dataset.action;
    try {
      if (action === 'navigate') {
        state.page = target.dataset.page;
        document.getElementById('sidebar')?.classList.remove('open');
        document.querySelector('.mobile-overlay')?.classList.remove('open');
        await reloadCurrentPage();
      } else if (action === 'select-patient') {
        await loadPatientDetails(target.dataset.id);
      } else if (action === 'open-modal') {
        openForm(target.dataset.form);
      } else if (action === 'close-modal') {
        closeModal();
      } else if (action === 'logout') {
        sessionStorage.removeItem(api.tokenKey);
        showLoginIfNeeded('');
      } else if (action === 'open-mobile') {
        document.getElementById('sidebar')?.classList.add('open');
        document.querySelector('.mobile-overlay')?.classList.add('open');
      } else if (action === 'close-mobile') {
        document.getElementById('sidebar')?.classList.remove('open');
        document.querySelector('.mobile-overlay')?.classList.remove('open');
      } else if (action === 'toggle-notifications') {
        state.notificationOpen = !state.notificationOpen;
        target.setAttribute('aria-expanded', String(state.notificationOpen));
        renderNotifications();
      } else if (action === 'read-notification') {
        const item = state.notifications.find((notification) => notification._id === target.dataset.id);
        if (item && !item.read) await api.patch(`/notifications/${item._id}/read`, {});
        state.notificationOpen = true;
        await loadAll();
      } else if (action === 'edit-appointment') {
        openForm('appointment', state.appointments.find((item) => item._id === target.dataset.id));
      } else if (action === 'view-appointment') {
        const appointment = state.appointments.find((item) => item._id === target.dataset.id);
        if (appointment) openModal('Appointment details', node('div', { className: 'modal-content' },
          fact('Patient', fullName(appointment.patient)),
          fact('Appointment type', appointment.type),
          fact('Date', localDate(appointment.scheduledAt)),
          fact('Time', localTime(appointment.scheduledAt)),
          fact('Professional', appointment.teamMember?.name || 'Unassigned'),
          fact('Status', appointment.status),
          fact('Notes', appointment.notes || 'No notes')
        ));
      } else if (action === 'delete-appointment') {
        const appointment = state.appointments.find((item) => item._id === target.dataset.id);
        await confirmAction(`Cancel and remove the ${appointment?.type || 'selected'} appointment?`, async () => {
          try {
            await api.delete(`/appointments/${target.dataset.id}`);
            showToast('Appointment removed.');
            await loadAll();
          } catch (error) { showToast(error.message, true); }
        });
      } else if (action === 'edit-team') {
        openForm('team', state.team.find((member) => member._id === target.dataset.id));
      } else if (action === 'view-team') {
        const member = state.team.find((item) => item._id === target.dataset.id);
        if (member) openModal('Care-team member', node('div', { className: 'modal-content' },
          fact('Name', member.name), fact('Specialty', member.specialty), fact('Email', member.email),
          fact('Phone', member.phone || 'Not provided'), fact('Status', member.status)
        ));
      } else if (action === 'delete-team') {
        const member = state.team.find((item) => item._id === target.dataset.id);
        await confirmAction(`Remove ${member?.name || 'this team member'} from the care team?`, async () => {
          try {
            await api.delete(`/teams/${target.dataset.id}`);
            showToast('Team member removed.');
            await loadAll();
          } catch (error) { showToast(error.message, true); }
        });
      } else if (action === 'patient-details') {
        const patient = state.patient;
        openModal('Patient details', node('div', { className: 'modal-content' },
          fact('Patient', fullName(patient)), fact('Patient number', patient.patientNumber), fact('Address', patient.address || 'Not provided'),
          fact('Insurance', patient.insurance?.provider || 'Not provided'), fact('Member ID', patient.insurance?.memberId || 'Not provided'),
          node('p', { className: 'demo-note', text: 'All profile information shown is fictional demonstration data.' })
        ));
      } else if (action === 'export-diagnoses') exportDiagnoses();
      else if (action === 'export-labs') exportLabs();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function reloadCurrentPage() {
    try {
      if (state.page === 'dashboard') {
        const [summary, activity] = await Promise.all([api.get('/dashboard/summary'), api.get('/dashboard/activity')]);
        state.summary = summary.data;
        state.activity = activity.data;
      } else if (state.page === 'appointments') {
        const filters = state.appointmentFilters;
        const params = new URLSearchParams({ limit: '100' });
        if (filters.status !== 'all') params.set('status', filters.status);
        if (filters.patient) params.set('patient', filters.patient);
        if (filters.from) params.set('from', new Date(`${filters.from}T00:00:00`).toISOString());
        if (filters.to) params.set('to', new Date(`${filters.to}T23:59:59.999`).toISOString());
        const query = params.toString();
        const response = await api.get(`/appointments?${query}`);
        state.appointments = response.data;
      } else if (state.page === 'team') {
        state.team = (await api.get('/teams?limit=100')).data;
      } else if (state.page === 'patients') {
        state.patients = (await api.get(`/patients?limit=100${state.search ? `&q=${encodeURIComponent(state.search)}` : ''}`)).data;
        if (state.patient && !state.patients.some((patient) => patient._id === state.patient._id)) state.patient = state.patients[0] || null;
        if (state.patient) await loadPatientDetails(state.patient._id, false);
      }
      renderShellContent();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  document.addEventListener('click', handleClick);
  document.addEventListener('change', async (event) => {
    if (event.target.dataset.action === 'chart-range') {
      state.chartRange = Number(event.target.value);
      renderChart();
    } else if (event.target.dataset.action === 'appointment-filter') {
      state.appointmentFilters.status = event.target.value;
      await reloadCurrentPage();
    } else if (event.target.dataset.action === 'appointment-patient-filter') {
      state.appointmentFilters.patient = event.target.value;
      await reloadCurrentPage();
    } else if (event.target.dataset.action === 'appointment-from-filter') {
      state.appointmentFilters.from = event.target.value;
      await reloadCurrentPage();
    } else if (event.target.dataset.action === 'appointment-to-filter') {
      state.appointmentFilters.to = event.target.value;
      await reloadCurrentPage();
    } else if (event.target.dataset.action === 'patient-filter') {
      if (event.target.value) await loadPatientDetails(event.target.value);
      else {
        state.patient = null;
        state.diagnoses = [];
        state.labs = [];
        state.messages = [];
        renderShellContent();
      }
    }
  });
  document.addEventListener('input', (event) => {
    if (event.target.id !== 'patient-search') return;
    state.search = event.target.value;
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(async () => {
      try {
        const response = await api.get(`/patients?limit=100${state.search ? `&q=${encodeURIComponent(state.search)}` : ''}`);
        state.patients = response.data;
        if (state.patient && !state.patients.some((item) => item._id === state.patient._id)) {
          state.patient = null;
          state.diagnoses = [];
          state.labs = [];
        }
        renderShellContent();
        document.getElementById('patient-search')?.focus();
        document.getElementById('patient-search')?.setSelectionRange(state.search.length, state.search.length);
      } catch (error) { showToast(error.message, true); }
    }, 250);
  });
  document.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    if (form.id === 'login-form') {
      const data = formValues(form);
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      button.textContent = 'Signing in…';
      try {
        const result = await api.login(data.email, data.password);
        sessionStorage.setItem(api.tokenKey, result.data.token);
        state.user = result.data.user;
        await loadAll();
      } catch (error) {
        renderLogin(error.message);
      }
    } else if (form.id === 'record-form') {
      if (!form.reportValidity()) return;
      await submitRecord(form);
    } else if (form.id === 'message-form') {
      const data = formValues(form);
      try {
        await api.post(`/patients/${form.dataset.patientId}/messages`, data);
        showToast('Message saved to the demonstration thread.');
        await loadPatientDetails(form.dataset.patientId);
      } catch (error) { showToast(error.message, true); }
    }
  });
  window.addEventListener('carepoint:unauthorized', () => showLoginIfNeeded('Your session expired. Please sign in again.'));
  window.addEventListener('resize', () => {
    if (state.chart) state.chart.resize();
  });

  bootstrap().catch((error) => {
    console.error(error);
    showLoginIfNeeded('Unable to load the workspace. Check the server and database, then sign in again.');
  });
})();
