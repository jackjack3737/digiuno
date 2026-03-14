const API_BASE = '';

// Elementi UI principali
const registerForm = document.getElementById('register-form');
const usernameInput = document.getElementById('username');
const userPanel = document.getElementById('user-panel');
const currentUsernameSpan = document.getElementById('current-username');
const timerLabel = document.getElementById('timer-label');
const timerHours = document.getElementById('timer-hours');
const timerMinutes = document.getElementById('timer-minutes');
const timerSeconds = document.getElementById('timer-seconds');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const cancelBtn = document.getElementById('cancel-btn');
const deleteUserBtn = document.getElementById('delete-user-btn');
const clearTimeBtn = document.getElementById('clear-time-btn');
const userError = document.getElementById('user-error');
const leaderboardBody = document.getElementById('leaderboard-body');
const lastUpdated = document.getElementById('last-updated');
const leaderboardAdminEl = document.getElementById('leaderboard-admin');

// Sezione Supabase (storico digiuni di gruppo)
const myGroupResultsList = document.getElementById('my-group-results');
const bestOverallBox = document.getElementById('best-overall');
const bestPerUserList = document.getElementById('best-per-user');
const top3List = document.getElementById('top3-alltime');

// Sintomi e rimedi
const symptomSelect = document.getElementById('symptom-select');
const symptomDetail = document.getElementById('symptom-detail');
const symptomSearch = document.getElementById('symptom-search');

let currentUser = null;
let pollingInterval = null;
let timerInterval = null;
let activeStartTime = null;
let leaderboardRows = [];
let leaderboardSnapshotTime = null;
let leaderboardTickInterval = null;
let isAdmin = false;

function formatTwoDigits(n) {
  return String(n).padStart(2, '0');
}

function formatDurationFromHours(hoursFloat) {
  const totalSeconds = Math.max(0, Math.floor(hoursFloat * 3600));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${formatTwoDigits(hours)}:${formatTwoDigits(minutes)}:${formatTwoDigits(seconds)}`;
}

async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Errore di rete');
  }
  return res.json();
}

function saveUserLocal(user) {
  localStorage.setItem('digiunoUser', JSON.stringify(user));
}

function loadUserLocal() {
  const raw = localStorage.getItem('digiunoUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setFastingState(isFasting) {
  if (isFasting) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    timerLabel.textContent = 'Digiuno in corso';
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    timerLabel.textContent = 'Nessun digiuno attivo';
    const el = getTimerEls();
    if (el.hours) el.hours.textContent = '00';
    if (el.minutes) el.minutes.textContent = '00';
    if (el.seconds) el.seconds.textContent = '00';
  }
}

function stopTimer() {
  activeStartTime = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function getTimerEls() {
  return {
    hours: document.getElementById('timer-hours'),
    minutes: document.getElementById('timer-minutes'),
    seconds: document.getElementById('timer-seconds'),
  };
}

function updateTimer() {
  try {
    if (!activeStartTime || !Number.isFinite(activeStartTime)) return;
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - activeStartTime) / 1000));

    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;

    const el = getTimerEls();
    const h = el.hours || timerHours;
    const m = el.minutes || timerMinutes;
    const s = el.seconds || timerSeconds;
    if (h) h.textContent = formatTwoDigits(hours);
    if (m) m.textContent = formatTwoDigits(minutes);
    if (s) s.textContent = formatTwoDigits(seconds);
  } catch (e) {
    console.error('updateTimer', e);
  }
}

function startTimerFrom(startIsoString) {
  const now = Date.now();
  if (!startIsoString) {
    activeStartTime = now;
  } else {
    const parsed = new Date(startIsoString).getTime();
    if (Number.isFinite(parsed) && parsed <= now) {
      activeStartTime = parsed;
    } else {
      activeStartTime = now;
    }
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  updateTimer();
  setTimeout(updateTimer, 100);
  timerInterval = setInterval(updateTimer, 1000);
}

async function handleRegister(e) {
  e.preventDefault();
  userError.textContent = '';
  const username = usernameInput.value.trim();
  if (!username) return;

  try {
    const user = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    currentUser = user;
    saveUserLocal(user);
    currentUsernameSpan.textContent = user.username;
    userPanel.classList.remove('hidden');
    setFastingState(user.isFasting);
    stopTimer();
    if (user.isFasting && user.startTime) {
      startTimerFrom(user.startTime);
    } else if (user.isFasting) {
      startTimerFrom(null);
    }
    await checkAdmin(user.username);
    updateLeaderboardAdminButton();
  } catch (err) {
    userError.textContent = err.message;
  }
}

async function handleStart() {
  if (!currentUser) return;
  userError.textContent = '';
  try {
    const data = await api('/api/start', {
      method: 'POST',
      body: JSON.stringify({ userId: currentUser.id }),
    });
    currentUser.isFasting = true;
    currentUser.startTime = data.startTime || new Date().toISOString();
    saveUserLocal(currentUser);
    setFastingState(true);
    startTimerFrom(null);
    await refreshLeaderboard();
  } catch (err) {
    userError.textContent = err.message;
  }
}

async function handleStop() {
  if (!currentUser) return;
  userError.textContent = '';
  try {
    await api('/api/stop', {
      method: 'POST',
      body: JSON.stringify({ userId: currentUser.id }),
    });
    currentUser.isFasting = false;
    currentUser.startTime = null;
    saveUserLocal(currentUser);
    setFastingState(false);
    stopTimer();
    await refreshLeaderboard();
  } catch (err) {
    userError.textContent = err.message;
  }
}

async function handleCancel() {
  if (!currentUser) return;
  userError.textContent = '';
  try {
    await api('/api/cancel', {
      method: 'POST',
      body: JSON.stringify({ userId: currentUser.id }),
    });
    currentUser.isFasting = false;
    currentUser.startTime = null;
    saveUserLocal(currentUser);
    setFastingState(false);
    stopTimer();
    await refreshLeaderboard();
  } catch (err) {
    userError.textContent = err.message;
  }
}

async function handleDeleteUser() {
  if (!currentUser) return;
  const confirmed = window.confirm(
    'Vuoi davvero eliminare il tuo username e tutti i dati di digiuno associati?'
  );
  if (!confirmed) return;

  userError.textContent = '';
  try {
    await api('/api/user', {
      method: 'DELETE',
      body: JSON.stringify({ userId: currentUser.id }),
    });

    currentUser = null;
    stopTimer();
    localStorage.removeItem('digiunoUser');
    userPanel.classList.add('hidden');
    usernameInput.value = '';
    setFastingState(false);
    await refreshLeaderboard();
  } catch (err) {
    userError.textContent = err.message;
  }
}

async function handleClearTime() {
  if (!currentUser) return;
  const confirmed = window.confirm(
    'Vuoi azzerare tutte le tue ore di digiuno dalla classifica?'
  );
  if (!confirmed) return;

  userError.textContent = '';
  try {
    await api('/api/clear-time', {
      method: 'POST',
      body: JSON.stringify({ userId: currentUser.id }),
    });

    currentUser.isFasting = false;
    saveUserLocal(currentUser);
    setFastingState(false);
    stopTimer();
    await refreshLeaderboard();
  } catch (err) {
    userError.textContent = err.message;
  }
}

function renderLeaderboard() {
  leaderboardBody.innerHTML = '';
  if (!leaderboardRows || leaderboardRows.length === 0) {
    return;
  }

  const now = Date.now();
  const elapsedSec =
    leaderboardSnapshotTime != null ? Math.max(0, (now - leaderboardSnapshotTime) / 1000) : 0;

  leaderboardRows.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.className =
      index === 0 ? 'leader first' : index === 1 ? 'leader second' : index === 2 ? 'leader third' : '';

    const posTd = document.createElement('td');
    posTd.textContent = index + 1;

    const nameTd = document.createElement('td');
    nameTd.textContent = row.username;

    const hoursTd = document.createElement('td');
    let displayHours = row.total_hours;
    if (
      row.is_fasting &&
      elapsedSec > 0 &&
      (!currentUser || row.username !== currentUser.username)
    ) {
      displayHours += elapsedSec / 3600;
    } else if (
      row.is_fasting &&
      currentUser &&
      row.username === currentUser.username &&
      activeStartTime
    ) {
      const diffSecSelf = Math.max(0, (now - activeStartTime) / 1000);
      displayHours = diffSecSelf / 3600;
    }
    hoursTd.textContent = formatDurationFromHours(displayHours);

    const statusTd = document.createElement('td');
    statusTd.textContent = row.is_fasting ? 'In digiuno' : 'Fermo';

    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions-cell';

    if (currentUser && row.username === currentUser.username) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'clear-time-btn';
      btn.textContent = '×';
      btn.title = 'Azzera il mio tempo';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleClearTime();
      });
      actionsTd.appendChild(btn);
    }

    tr.appendChild(posTd);
    tr.appendChild(nameTd);
    tr.appendChild(hoursTd);
    tr.appendChild(statusTd);
    tr.appendChild(actionsTd);

    leaderboardBody.appendChild(tr);
  });
}

function startLeaderboardTick() {
  if (leaderboardTickInterval) return;
  leaderboardTickInterval = setInterval(() => {
    renderLeaderboard();
  }, 1000);
}

async function refreshLeaderboard() {
  try {
    const rows = await api('/api/leaderboard');
    leaderboardRows = rows || [];
    leaderboardSnapshotTime = Date.now();
    renderLeaderboard();
    startLeaderboardTick();
    lastUpdated.textContent = 'Aggiornato alle ' + new Date().toLocaleTimeString();
  } catch {
    lastUpdated.textContent = 'Errore di aggiornamento';
  }
}

async function checkAdmin(username) {
  if (!username) {
    isAdmin = false;
    return;
  }
  try {
    const data = await api(`/api/admin/check?username=${encodeURIComponent(username)}`);
    isAdmin = !!data.admin;
  } catch {
    isAdmin = false;
  }
}

function updateLeaderboardAdminButton() {
  if (!leaderboardAdminEl) return;
  leaderboardAdminEl.innerHTML = '';
  if (currentUser) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ghost small';
    btn.textContent = 'Azzera classifica';
    btn.title = 'Solo admin: azzera i punteggi in classifica (i tempi restano salvati)';
    btn.addEventListener('click', handleResetLeaderboard);
    leaderboardAdminEl.appendChild(btn);
  }
}

async function handleResetLeaderboard() {
  if (!currentUser) return;
  const ok = window.confirm(
    'Azzera la classifica per tutti? I tempi restano salvati nel database.'
  );
  if (!ok) return;
  userError.textContent = '';
  try {
    await api('/api/admin/reset-leaderboard', {
      method: 'POST',
      body: JSON.stringify({ username: currentUser.username }),
    });
    await refreshLeaderboard();
  } catch (err) {
    userError.textContent = err.message || 'Errore azzeramento classifica';
  }
}

async function loadRecords() {
  if (!bestOverallBox || !bestPerUserList) return;

  bestOverallBox.textContent = 'Caricamento record...';
  bestPerUserList.innerHTML = '';
  if (myGroupResultsList) myGroupResultsList.innerHTML = '';
  if (top3List) top3List.innerHTML = '';

  try {
    const data = await api('/api/group-records');

    if (!data.bestOverall) {
      bestOverallBox.textContent = 'Ancora nessun record salvato.';
    } else {
      const { username, total_hours, fast_date, group_name } = data.bestOverall;
      const parts = [];
      parts.push(`${username} – ${Number(total_hours).toFixed(2)} ore`);
      if (group_name) parts.push(group_name);
      if (fast_date) parts.push(new Date(fast_date).toLocaleDateString());
      bestOverallBox.textContent = parts.join(' • ');
    }

    if (data.bestPerUser && data.bestPerUser.length > 0 && top3List) {
      data.bestPerUser.slice(0, 3).forEach((row, idx) => {
        const li = document.createElement('li');
        li.textContent = `${idx + 1}. ${row.username}: ${Number(row.total_hours).toFixed(2)} h`;
        top3List.appendChild(li);
      });
    }

    if (currentUser) {
      const myData = await api(
        `/api/my-group-records?username=${encodeURIComponent(currentUser.username)}`
      ).catch(() => []);

      if (myData && myData.length > 0) {
        // Colonna "I tuoi digiuni di gruppo" (sinistra)
        if (myGroupResultsList) {
          myData.forEach((row) => {
            const li = document.createElement('li');
            const parts = [];
            parts.push(`${Number(row.total_hours).toFixed(2)} h`);
            if (row.group_name) parts.push(row.group_name);
            if (row.fast_date) parts.push(new Date(row.fast_date).toLocaleDateString());
            li.textContent = parts.join(' • ');
            myGroupResultsList.appendChild(li);
          });
        }

        // "I tuoi migliori risultati" (destra) – primi 5
        myData.slice(0, 5).forEach((row) => {
          const li = document.createElement('li');
          const labelParts = [];
          labelParts.push(`${Number(row.total_hours).toFixed(2)} h`);
          if (row.group_name) labelParts.push(row.group_name);
          if (row.fast_date) labelParts.push(new Date(row.fast_date).toLocaleDateString());
          li.textContent = labelParts.join(' • ');
          bestPerUserList.appendChild(li);
        });
      } else {
        const msg = 'Non hai ancora record nei digiuni di gruppo.';
        if (myGroupResultsList) {
          const li = document.createElement('li');
          li.textContent = msg;
          myGroupResultsList.appendChild(li);
        }
        const li2 = document.createElement('li');
        li2.textContent = msg;
        bestPerUserList.appendChild(li2);
      }
    } else {
      const msg = 'Accedi con il tuo username per vedere i tuoi record.';
      if (myGroupResultsList) {
        const li = document.createElement('li');
        li.textContent = msg;
        myGroupResultsList.appendChild(li);
      }
      const li2 = document.createElement('li');
      li2.textContent = msg;
      bestPerUserList.appendChild(li2);
    }
  } catch (err) {
    bestOverallBox.textContent = err.message;
  }
}

// Sintomi e rimedi
function filterSymptomOptions() {
  if (!symptomSearch || !symptomSelect) return;
  const q = symptomSearch.value.trim().toLowerCase();
  const options = symptomSelect.querySelectorAll('option');
  options.forEach((opt, i) => {
    if (i === 0) return; // placeholder
    opt.hidden = q ? !opt.textContent.toLowerCase().includes(q) : false;
  });
}

async function loadSymptoms() {
  if (!symptomSelect || !symptomDetail) return;
  try {
    const list = await api('/api/symptoms');
    symptomSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Scegli un sintomo...';
    symptomSelect.appendChild(placeholder);

    list.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${item.fase} – ${item.sintomo}`;
      symptomSelect.appendChild(opt);
    });

    filterSymptomOptions();

    symptomDetail.innerHTML =
      '<p class="helper-text">Dopo aver scelto un sintomo, qui vedrai il rimedio naturale consigliato.</p>';
  } catch (err) {
    symptomDetail.textContent = 'Impossibile caricare i sintomi dal server.';
  }
}

async function handleSymptomChange() {
  if (!symptomSelect || !symptomDetail) return;
  const id = symptomSelect.value;
  if (!id) {
    symptomDetail.innerHTML =
      '<p class="helper-text">Dopo aver scelto un sintomo, qui vedrai il rimedio naturale consigliato.</p>';
    return;
  }

  symptomDetail.innerHTML = '<p class="helper-text">Caricamento rimedio...</p>';
  try {
    const data = await api(`/api/symptom?id=${encodeURIComponent(id)}`);

    const fase = data.fase || '';
    const sintomo = data.sintomo || '';
    const rimedio = data.rimedio || '';
    const note = data.note || '';

    const parts = [];
    if (fase) parts.push(`<div class="fase-label">${fase}</div>`);
    if (sintomo) parts.push(`<h3>${sintomo}</h3>`);
    if (rimedio) parts.push(`<p><strong>Rimedio:</strong> ${rimedio}</p>`);
    if (note) parts.push(`<p><strong>Note:</strong> ${note}</p>`);

    symptomDetail.innerHTML = parts.join('');
  } catch (err) {
    symptomDetail.innerHTML = `<p class="helper-text">${err.message}</p>`;
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(refreshLeaderboard, 15000);
}

async function initFromLocal() {
  const saved = loadUserLocal();
  if (saved) {
    currentUser = saved;
    currentUsernameSpan.textContent = saved.username;
    userPanel.classList.remove('hidden');
    setFastingState(saved.isFasting);
    if (saved.isFasting) {
      if (saved.startTime) {
        startTimerFrom(saved.startTime);
      }
      api(`/api/active?userId=${encodeURIComponent(saved.id)}`)
        .then((data) => {
          if (data.isFasting && data.startTime) {
            startTimerFrom(data.startTime);
            currentUser.startTime = data.startTime;
            saveUserLocal(currentUser);
          }
        })
        .catch(() => {});
    }
    await checkAdmin(saved.username);
    updateLeaderboardAdminButton();
  }
}

// Event listeners
registerForm.addEventListener('submit', handleRegister);
startBtn.addEventListener('click', handleStart);
stopBtn.addEventListener('click', handleStop);
if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
if (deleteUserBtn) deleteUserBtn.addEventListener('click', handleDeleteUser);
if (clearTimeBtn) clearTimeBtn.addEventListener('click', handleClearTime);
if (symptomSelect) symptomSelect.addEventListener('change', handleSymptomChange);
if (symptomSearch) symptomSearch.addEventListener('input', filterSymptomOptions);

// Avvio
initFromLocal();
refreshLeaderboard();
startPolling();
loadRecords();
loadSymptoms();

