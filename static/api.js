				File:api.js

// ══════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════
let S = {
  user: null,
  attendance: [], grades: [], todos: [], urgent: [], activity: [],
  profile: { name:'', roll:'', email:'', phone:'', branch:'Computer Science', sem:'4th' }
};

// ══════════════════════════════════════════════════
// API HELPER  — talks to FastAPI backend
// ══════════════════════════════════════════════════
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

function fixBool(arr) {
  return arr.map(r => ({ ...r, done: r.done === 1 || r.done === true }));
}

// ══════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().split('T')[0];
function gradeToLetter(g){ if(g>=9)return'O';if(g>=8)return'A+';if(g>=7)return'A';if(g>=6)return'B+';if(g>=5)return'B';if(g>=4)return'C';return'F'; }
function gradeColor(g){ return g>=7?'green':g>=5?'amber':'red'; }

// ══════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════
async function doLogin() {
  const roll = $('l-user').value.trim();
  const pwd  = $('l-pass').value.trim();
  const errBox = $('login-error');
  const btn    = $('login-btn');

  errBox.style.display = 'none';
  if (!roll || !pwd) { errBox.textContent = '⚠ Please enter both username and password.'; errBox.style.display='block'; return; }

  btn.textContent = 'Signing in…';
  btn.disabled = true;

  try {
    const res = await api('POST', '/api/login', { roll_no: roll, password: pwd });
    const profile = res.profile;

    S.user    = roll;
    S.profile = {
      name:   profile.name   || roll,
      roll:   roll,
      email:  profile.email  || '',
      phone:  profile.phone  || '',
      branch: profile.branch || 'Computer Science',
      sem:    profile.semester || '4th',
    };

    const [att, grades, todos, urgent, activity] = await Promise.all([
      api('GET', `/api/attendance/${roll}`),
      api('GET', `/api/grades/${roll}`),
      api('GET', `/api/todos/${roll}`),
      api('GET', `/api/urgent/${roll}`),
      api('GET', `/api/activity/${roll}`),
    ]);

    S.attendance = att;
    S.grades     = grades;
    S.todos      = fixBool(todos);
    S.urgent     = fixBool(urgent);
    S.activity   = activity;

    $('login-page').classList.add('hidden');
    $('app').classList.add('visible');
    $('sb-username').textContent  = S.profile.name || roll;
    $('sb-roll').textContent      = 'Roll: ' + roll;
    $('sb-avatar').textContent    = (S.profile.name || roll)[0].toUpperCase();
    $('profile-av').textContent   = (S.profile.name || roll)[0].toUpperCase();
    $('profile-name').textContent = S.profile.name || roll;
    $('pf-roll').value = roll;
    renderAll();
  } catch (e) {
    errBox.textContent = '❌ ' + (e.message || 'Could not connect to server. Is it running?');
    errBox.style.display = 'block';
  } finally {
    btn.textContent = 'Sign In →';
    btn.disabled = false;
  }
}

// allow pressing Enter key to login
$('l-pass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
$('l-user').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

function doLogout() {
  S = { user:null, attendance:[], grades:[], todos:[], urgent:[], activity:[],
        profile:{ name:'', roll:'', email:'', phone:'', branch:'Computer Science', sem:'4th' } };
  $('app').classList.remove('visible');
  setTimeout(() => { $('login-page').classList.remove('hidden'); $('l-pass').value=''; }, 200);
}

// ══════════════════════════════════════════════════
// PROFILE
// ══════════════════════════════════════════════════
async function saveProfile() {
  const body = {
    name:   $('pf-name').value.trim() || S.profile.name,
    email:  $('pf-email').value.trim(),
    phone:  $('pf-phone').value.trim(),
    branch: $('pf-branch').value,
    sem:    $('pf-sem').value,
  };
  try {
    const updated = await api('PUT', `/api/profile/${S.user}`, body);
    S.profile = { name:updated.name, roll:updated.roll, email:updated.email, phone:updated.phone, branch:updated.branch, sem:updated.semester };
    $('sb-username').textContent  = S.profile.name;
    $('profile-name').textContent = S.profile.name;
    $('sb-avatar').textContent    = S.profile.name[0].toUpperCase();
    $('profile-av').textContent   = S.profile.name[0].toUpperCase();
    S.activity = await api('GET', `/api/activity/${S.user}`);
    alert('Profile saved! ✅');
    renderProfile();
  } catch(e) { alert('Save failed: ' + e.message); }
}

// ══════════════════════════════════════════════════
// ATTENDANCE
// ══════════════════════════════════════════════════
async function addAttendance() {
  const sub = $('att-sub').value.trim(), date = $('att-date').value,
        status = $('att-status').value, session = $('att-session').value;
  if (!sub || !date) { alert('Fill subject and date!'); return; }
  try {
    const rec = await api('POST', `/api/attendance/${S.user}`, { subject:sub, date, status, session });
    S.attendance.push(rec);
    S.activity = await api('GET', `/api/activity/${S.user}`);
    $('att-sub').value = '';
    renderAttendance(); renderDashboard(); updateBadges();
  } catch(e) { alert('Error: ' + e.message); }
}

async function deleteAtt(id) {
  try {
    await api('DELETE', `/api/attendance/${S.user}/${id}`);
    S.attendance = S.attendance.filter(a => a.id !== id);
    renderAttendance();
  } catch(e) { alert('Error: ' + e.message); }
}

// ══════════════════════════════════════════════════
// GRADES
// ══════════════════════════════════════════════════
async function _addGrade(sem, sub, grade, credits) {
  if (!sem || !sub || isNaN(grade) || isNaN(credits)) { alert('Fill all fields!'); return false; }
  const rec = await api('POST', `/api/grades/${S.user}`, { sem, subject:sub, grade, credits });
  S.grades.push(rec);
  S.activity = await api('GET', `/api/activity/${S.user}`);
  renderCGPA(); renderDashboard();
  return true;
}

async function addGrade() {
  const ok = await _addGrade($('g-sem').value.trim(), $('g-sub').value.trim(), parseFloat($('g-grade').value), parseInt($('g-credits').value));
  if (ok) { $('g-sub').value=''; $('g-grade').value=''; $('g-credits').value=''; }
}

async function addGradeModal() {
  const ok = await _addGrade($('mg-sem').value.trim(), $('mg-sub').value.trim(), parseFloat($('mg-grade').value), parseInt($('mg-credits').value));
  if (ok) { closeModal('modal-add-grade'); $('mg-sem').value=''; $('mg-sub').value=''; $('mg-grade').value=''; $('mg-credits').value=''; }
}

async function deleteGrade(id) {
  try {
    await api('DELETE', `/api/grades/${S.user}/${id}`);
    S.grades = S.grades.filter(g => g.id !== id);
    renderCGPA();
  } catch(e) { alert('Error: ' + e.message); }
}

// ══════════════════════════════════════════════════
// TODOS
// ══════════════════════════════════════════════════
async function addTodo() {
  const text = $('m-todo-text').value.trim();
  if (!text) { alert('Enter task title!'); return; }
  try {
    const rec = await api('POST', `/api/todos/${S.user}`, {
      text, due:$('m-todo-due').value, priority:$('m-todo-priority').value,
      subject:$('m-todo-sub').value.trim(), notes:$('m-todo-notes').value.trim()
    });
    S.todos.push({ ...rec, done:false });
    S.activity = await api('GET', `/api/activity/${S.user}`);
    closeModal('modal-add-todo');
    $('m-todo-text').value=''; $('m-todo-due').value=''; $('m-todo-sub').value=''; $('m-todo-notes').value='';
    renderTodo(); renderDashboard();
  } catch(e) { alert('Error: ' + e.message); }
}

async function toggleTodo(id) {
  try {
    const updated = await api('PATCH', `/api/todos/${S.user}/${id}`);
    const idx = S.todos.findIndex(t => t.id === id);
    if (idx !== -1) S.todos[idx] = { ...updated, done: updated.done===1||updated.done===true };
    S.activity = await api('GET', `/api/activity/${S.user}`);
    renderTodo(); renderDashboard();
  } catch(e) { alert('Error: ' + e.message); }
}

async function deleteTodo(id) {
  try {
    await api('DELETE', `/api/todos/${S.user}/${id}`);
    S.todos = S.todos.filter(t => t.id !== id);
    renderTodo(); renderDashboard();
  } catch(e) { alert('Error: ' + e.message); }
}

// ══════════════════════════════════════════════════
// URGENT
// ══════════════════════════════════════════════════
async function addUrgent() {
  const topic = $('mu-topic').value.trim(), urgency = parseInt($('mu-urgency').value);
  if (!topic || isNaN(urgency)) { alert('Fill topic and urgency!'); return; }
  try {
    const rec = await api('POST', `/api/urgent/${S.user}`, { topic, urgency, exam:$('mu-exam').value, reason:$('mu-reason').value.trim() });
    S.urgent.push({ ...rec, done:false });
    S.activity = await api('GET', `/api/activity/${S.user}`);
    closeModal('modal-add-urgent');
    $('mu-topic').value=''; $('mu-urgency').value=''; $('mu-exam').value=''; $('mu-reason').value='';
    renderUrgent(); renderDashboard();
  } catch(e) { alert('Error: ' + e.message); }
}

async function toggleUrgent(id) {
  try {
    const updated = await api('PATCH', `/api/urgent/${S.user}/${id}`);
    const idx = S.urgent.findIndex(u => u.id === id);
    if (idx !== -1) S.urgent[idx] = { ...updated, done: updated.done===1||updated.done===true };
    S.activity = await api('GET', `/api/activity/${S.user}`);
    renderUrgent(); renderDashboard();
  } catch(e) { alert('Error: ' + e.message); }
}

async function deleteUrgent(id) {
  try {
    await api('DELETE', `/api/urgent/${S.user}/${id}`);
    S.urgent = S.urgent.filter(u => u.id !== id);
    renderUrgent(); renderDashboard();
  } catch(e) { alert('Error: ' + e.message); }
}

// ══════════════════════════════════════════════════
// NAV
// ══════════════════════════════════════════════════
const pageInfo = {
  dashboard:{title:'Dashboard',sub:'Welcome back 👋'},
  profile:{title:'My Profile',sub:'Manage your info'},
  attendance:{title:'Attendance',sub:'Track class presence'},
  cgpa:{title:'CGPA Tracker',sub:'Monitor your grades'},
  todo:{title:'To-Do List',sub:'Manage your tasks'},
  urgent:{title:'Urgent Study',sub:'Priority topics 🔥'},
};
function nav(pageId, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  $('page-'+pageId).classList.add('active');
  if(btn) btn.classList.add('active');
  const info=pageInfo[pageId]||{};
  $('topbar-title').textContent=info.title||pageId;
  $('topbar-sub').textContent=info.sub||'';
  if(pageId==='dashboard')  renderDashboard();
  if(pageId==='attendance') renderAttendance();
  if(pageId==='cgpa')       renderCGPA();
  if(pageId==='todo')       renderTodo();
  if(pageId==='urgent')     renderUrgent();
  if(pageId==='profile')    renderProfile();
}
function toggleSidebar(){ $('sidebar').classList.toggle('collapsed'); }

// ══════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════
function openModal(id){ $(id).classList.add('open'); }
function closeModal(id){ $(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('open'); });
});

// ══════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════
let dashAttChart, dashCgpaChart;
function renderDashboard(){
  const attSummary=getAttSummary();
  const avgAtt=attSummary.length?Math.round(attSummary.reduce((s,x)=>s+x.pct,0)/attSummary.length):0;
  const cgpaVal=calcCGPA(), pending=S.todos.filter(t=>!t.done).length, urgentCnt=S.urgent.filter(u=>!u.done).length;

  $('dash-stats').innerHTML=[
    {icon:'📅',label:'Avg Attendance',value:avgAtt+'%',change:avgAtt>=75?'🟢 On track':'🔴 Below 75%',color:'#4f46e5'},
    {icon:'🎓',label:'Current CGPA',value:cgpaVal,change:S.grades.length+' subjects',color:'#10b981'},
    {icon:'✅',label:'Pending Tasks',value:pending,change:S.todos.length+' total',color:'#f59e0b'},
    {icon:'🔥',label:'Urgent Topics',value:urgentCnt,change:'Need attention',color:'#ef4444'},
  ].map(t=>`<div class="stat-tile"><div class="stat-tile-accent" style="background:${t.color}"></div>
    <div class="stat-tile-icon">${t.icon}</div>
    <div class="stat-tile-value" style="color:${t.color}">${t.value}</div>
    <div class="stat-tile-label">${t.label}</div>
    <div class="stat-tile-change" style="color:${t.color}">${t.change}</div></div>`).join('');

  if(dashAttChart) dashAttChart.destroy();
  dashAttChart=new Chart($('dash-att-chart').getContext('2d'),{type:'bar',
    data:{labels:attSummary.map(s=>s.subject.length>8?s.subject.substring(0,8)+'…':s.subject),
      datasets:[{label:'Present',data:attSummary.map(s=>s.present),backgroundColor:'rgba(16,185,129,.7)',borderRadius:6},
               {label:'Absent',data:attSummary.map(s=>s.absent),backgroundColor:'rgba(239,68,68,.55)',borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#8a90a8',font:{size:11}}}},
      scales:{x:{ticks:{color:'#8a90a8'},grid:{color:'#e4e7f0'}},y:{ticks:{color:'#8a90a8'},grid:{color:'#e4e7f0'}}}}});

  if(dashCgpaChart) dashCgpaChart.destroy();
  const sgpa=getSemSGPA();
  dashCgpaChart=new Chart($('dash-cgpa-chart').getContext('2d'),{type:'line',
    data:{labels:sgpa.map(s=>s.sem),datasets:[{label:'SGPA',data:sgpa.map(s=>parseFloat(s.sgpa)),
      borderColor:'#4f46e5',backgroundColor:'rgba(79,70,229,.12)',fill:true,tension:.4,pointBackgroundColor:'#4f46e5',pointRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#8a90a8',font:{size:11}}}},
      scales:{x:{ticks:{color:'#8a90a8'},grid:{color:'#e4e7f0'}},y:{min:0,max:10,ticks:{color:'#8a90a8'},grid:{color:'#e4e7f0'}}}}});

  $('dash-activity').innerHTML=S.activity.length
    ?S.activity.slice(0,6).map(a=>`<div class="activity-item"><div class="activity-dot" style="background:var(--${a.color||'blue'})"></div><div class="activity-text">${a.text}</div><div class="activity-time">${a.time}</div></div>`).join('')
    :'<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No activity yet</div></div>';

  const upcoming=S.todos.filter(t=>!t.done).sort((a,b)=>({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority])).slice(0,4);
  $('dash-upcoming').innerHTML=upcoming.length
    ?upcoming.map(t=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
      <div class="task-check ${t.done?'checked':''}" onclick="toggleTodo(${t.id})">${t.done?'✓':''}</div>
      <div style="flex:1;font-size:.85rem;font-weight:600">${t.text}</div>
      <span class="badge ${t.priority==='high'?'red':t.priority==='medium'?'amber':'green'}">${t.priority}</span></div>`).join('')
    :'<div class="empty-state"><div class="empty-state-icon">🎉</div><div class="empty-state-text">All clear!</div></div>';
  updateBadges();
}

// ══════════════════════════════════════════════════
// ATTENDANCE RENDER
// ══════════════════════════════════════════════════
let attPieChart;
function getAttSummary(){
  const map={};
  S.attendance.forEach(a=>{ if(!map[a.subject]) map[a.subject]={present:0,absent:0}; map[a.subject][a.status]++; });
  return Object.entries(map).map(([subject,v])=>({subject,present:v.present,absent:v.absent,total:v.present+v.absent,pct:Math.round((v.present/(v.present+v.absent))*100)}));
}
function renderAttendance(){
  const summary=getAttSummary();
  const low=summary.filter(s=>s.pct<75);
  $('att-alert').innerHTML=low.length?`<div class="alert-banner">⚠ Low attendance (&lt;75%) in: <strong>${low.map(s=>s.subject).join(', ')}</strong></div>`:'';
  $('att-subject-cards').innerHTML=summary.length
    ?summary.map(s=>{ const c=s.pct>=75?'#10b981':s.pct>=60?'#f59e0b':'#ef4444',r=30,circ=2*Math.PI*r,off=circ-(s.pct/100)*circ;
      return `<div class="att-subject-card"><div class="att-ring-wrap"><div class="progress-ring">
        <svg width="76" height="76"><circle cx="38" cy="38" r="${r}" fill="none" stroke="#e4e7f0" stroke-width="6"/>
        <circle cx="38" cy="38" r="${r}" fill="none" stroke="${c}" stroke-width="6" stroke-dasharray="${circ}" stroke-dashoffset="${off}" stroke-linecap="round"/></svg>
        <div class="progress-ring-val" style="color:${c}">${s.pct}%</div></div></div>
        <div class="att-subject-name">${s.subject}</div><div class="att-subject-stat">${s.present}P · ${s.absent}A · ${s.total} total</div></div>`; }).join('')
    :'<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📅</div><div>No records yet. Log your first attendance!</div></div>';

  if(attPieChart) attPieChart.destroy();
  if(summary.length) attPieChart=new Chart($('att-pie').getContext('2d'),{type:'doughnut',
    data:{labels:summary.map(s=>s.subject),datasets:[{data:summary.map(s=>s.pct),
      backgroundColor:summary.map(s=>s.pct>=75?'rgba(16,185,129,.75)':s.pct>=60?'rgba(245,158,11,.75)':'rgba(239,68,68,.75)'),borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8a90a8',font:{size:11}}}}}});

  const subs=[...new Set(S.attendance.map(a=>a.subject))], curSub=$('att-filter-sub').value;
  $('att-filter-sub').innerHTML='<option value="">All Subjects</option>'+subs.map(s=>`<option value="${s}" ${s===curSub?'selected':''}>${s}</option>`).join('');
  renderAttTable();
}
function renderAttTable(){
  const fs=$('att-filter-sub').value, fst=$('att-filter-status').value;
  let data=[...S.attendance].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(fs) data=data.filter(a=>a.subject===fs);
  if(fst) data=data.filter(a=>a.status===fst);
  $('att-table').innerHTML=data.length
    ?data.map(a=>`<tr><td><strong>${a.subject}</strong></td><td>${a.date}</td><td>${a.session||'—'}</td>
      <td><span class="badge ${a.status==='present'?'green':'red'}">${a.status}</span></td>
      <td><button class="btn danger small" onclick="deleteAtt(${a.id})">✕</button></td></tr>`).join('')
    :'<tr><td colspan="5" class="empty-state">No records found</td></tr>';
}

// ══════════════════════════════════════════════════
// CGPA RENDER
// ══════════════════════════════════════════════════
let sgpaBarChart, cgpaFilterSem='all';
function calcCGPA(){
  if(!S.grades.length) return '—';
  const pts=S.grades.reduce((s,g)=>s+g.grade*g.credits,0), cr=S.grades.reduce((s,g)=>s+g.credits,0);
  return cr?(pts/cr).toFixed(2):'—';
}
function getSemSGPA(){
  const map={};
  S.grades.forEach(g=>{ if(!map[g.sem]) map[g.sem]=[]; map[g.sem].push(g); });
  return Object.entries(map).map(([sem,list])=>{
    const pts=list.reduce((s,g)=>s+g.grade*g.credits,0), cr=list.reduce((s,g)=>s+g.credits,0);
    return{sem,sgpa:cr?(pts/cr).toFixed(2):0};
  }).sort((a,b)=>a.sem.localeCompare(b.sem));
}
function renderCGPA(){
  const cgpa=calcCGPA(), sgpa=getSemSGPA();
  $('cgpa-hero').innerHTML=`<div><div style="font-size:.8rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Overall CGPA</div>
    <div class="cgpa-big">${cgpa}<span>/10</span></div></div>
    <div class="cgpa-meta"><h3>Academic Performance</h3><p>${S.grades.length} subjects across ${sgpa.length} semester(s)</p>
    <div class="cgpa-grades-grid" style="margin-top:16px">
    ${['O (≥9)','A+ (≥8)','A (≥7)','B+ (≥6)'].map((l,i)=>{
      const thresh=[9,8,7,6][i],cnt=S.grades.filter(g=>g.grade>=thresh&&(i===0||g.grade<[Infinity,9,8,7][i])).length;
      return `<div class="grade-chip" style="background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.1)"><div class="grade-chip-val" style="color:#fff">${cnt}</div><div class="grade-chip-label" style="color:rgba(255,255,255,.5)">${l}</div></div>`;
    }).join('')}</div></div>`;

  const sems=['all',...new Set(S.grades.map(g=>g.sem))].sort();
  $('sem-tabs').innerHTML=sems.map(s=>`<button class="sem-tab ${cgpaFilterSem===s?'active':''}" onclick="setCGPAFilter('${s}')">${s==='all'?'All Semesters':s}</button>`).join('');
  $('cgpa-tbl-title').textContent=cgpaFilterSem==='all'?'All Grades':'Grades — '+cgpaFilterSem;

  const rows=cgpaFilterSem==='all'?S.grades:S.grades.filter(g=>g.sem===cgpaFilterSem);
  $('cgpa-table').innerHTML=rows.length
    ?rows.map(g=>`<tr><td>${g.sem}</td><td><strong>${g.subject}</strong></td><td>${g.grade}</td><td>${g.credits}</td>
      <td><span class="badge ${gradeColor(g.grade)}">${gradeToLetter(g.grade)}</span></td>
      <td><button class="btn danger small" onclick="deleteGrade(${g.id})">✕</button></td></tr>`).join('')
    :'<tr><td colspan="6" class="empty-state">No grades yet</td></tr>';

  if(sgpaBarChart) sgpaBarChart.destroy();
  if(sgpa.length) sgpaBarChart=new Chart($('sgpa-bar').getContext('2d'),{type:'bar',
    data:{labels:sgpa.map(s=>s.sem),datasets:[{label:'SGPA',data:sgpa.map(s=>parseFloat(s.sgpa)),
      backgroundColor:sgpa.map(s=>s.sgpa>=7?'rgba(16,185,129,.75)':s.sgpa>=5?'rgba(245,158,11,.75)':'rgba(239,68,68,.75)'),borderRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{ticks:{color:'#8a90a8'},grid:{color:'#e4e7f0'}},y:{min:0,max:10,ticks:{color:'#8a90a8'},grid:{color:'#e4e7f0'}}}}});
}
function setCGPAFilter(sem){ cgpaFilterSem=sem; renderCGPA(); }
function exportCGPA(){
  let csv='Semester,Subject,Grade,Credits,Letter\n';
  S.grades.forEach(g=>{ csv+=`${g.sem},${g.subject},${g.grade},${g.credits},${gradeToLetter(g.grade)}\n`; });
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='cgpa_report.csv'; a.click();
}

// ══════════════════════════════════════════════════
// TODO RENDER
// ══════════════════════════════════════════════════
let todoFilter='all';
function setTodoFilter(f){
  todoFilter=f;
  ['all','pending','done'].forEach(x=>{ $('tf-'+x).style.background=x===f?'var(--accent)':''; $('tf-'+x).style.color=x===f?'#fff':''; });
  renderTodo();
}
function renderTodo(){
  const t=today(), prio={high:0,medium:1,low:2};
  let data=[...S.todos].sort((a,b)=>prio[a.priority]-prio[b.priority]);
  if(todoFilter==='pending') data=data.filter(t=>!t.done);
  if(todoFilter==='done') data=data.filter(t=>t.done);
  const high=data.filter(t=>t.priority==='high'), med=data.filter(t=>t.priority==='medium'), low=data.filter(t=>t.priority==='low');
  function taskCard(tk){
    const overdue=tk.due&&tk.due<t&&!tk.done;
    return `<div class="task-card ${tk.done?'done':''}"><div style="display:flex;gap:8px;align-items:flex-start">
      <div class="task-check ${tk.done?'checked':''}" onclick="toggleTodo(${tk.id})">${tk.done?'✓':''}</div>
      <div style="flex:1"><div class="task-title">${tk.text}</div><div class="task-meta">
        ${tk.subject?`<span class="badge blue">${tk.subject}</span>`:''}
        ${tk.due?`<span class="task-due ${overdue?'overdue':''}">${overdue?'⚠ Overdue: ':'📅 '}${tk.due}</span>`:''}
      </div>${tk.notes?`<div style="font-size:.75rem;color:var(--muted);margin-top:6px">${tk.notes}</div>`:''}</div>
      <button class="btn danger small" onclick="deleteTodo(${tk.id})">✕</button></div></div>`;
  }
  const col=(title,dot,items)=>`<div class="kanban-col"><div class="kanban-col-header">
    <span style="width:10px;height:10px;border-radius:50%;background:${dot};display:inline-block"></span>
    <span class="kanban-col-title">${title}</span><span class="kanban-count">${items.length}</span></div>
    ${items.map(taskCard).join('')||`<div class="empty-state" style="padding:24px"><div class="empty-state-icon">✨</div><div>No tasks</div></div>`}</div>`;
  $('todo-kanban').innerHTML=col('High Priority','var(--red)',high)+col('Medium Priority','var(--amber)',med)+col('Low Priority','var(--green)',low);
  updateBadges();
}

// ══════════════════════════════════════════════════
// URGENT RENDER
// ══════════════════════════════════════════════════
function renderUrgent(){
  const sorted=[...S.urgent].sort((a,b)=>b.urgency-a.urgency);
  $('urgent-list').innerHTML=sorted.length
    ?sorted.map((u,i)=>{ const colors=['#ef4444','#f97316','#f59e0b','#eab308','#84cc16'],c=colors[Math.min(i,4)],fires='🔥'.repeat(Math.max(1,Math.round(u.urgency/3)));
      return `<div class="urgent-item ${u.done?'task-card done':''}">
        <div class="urgent-rank" style="background:${c}22;color:${c}">#${i+1}</div>
        <div style="font-size:1.2rem">${fires}</div>
        <div class="urgent-item-body">
          <div class="urgent-item-title" style="${u.done?'text-decoration:line-through;color:var(--muted)':''}">${u.topic}</div>
          <div class="urgent-item-sub">Urgency: <strong style="color:${c}">${u.urgency}/10</strong>${u.exam?' · Exam: '+u.exam:''}${u.reason?' · '+u.reason:''}</div>
        </div>
        <div class="urgent-actions">
          <button class="btn ${u.done?'secondary':'green'} small" onclick="toggleUrgent(${u.id})">${u.done?'↩ Undo':'✓ Done'}</button>
          <button class="btn danger small" onclick="deleteUrgent(${u.id})">✕</button>
        </div></div>`;}).join('')
    :'<div class="empty-state"><div class="empty-state-icon">🎉</div><div class="empty-state-text">No urgent topics! You\'re all caught up.</div></div>';
  updateBadges();
}

// ══════════════════════════════════════════════════
// PROFILE RENDER
// ══════════════════════════════════════════════════
function renderProfile(){
  $('pf-name').value=S.profile.name||''; $('pf-roll').value=S.profile.roll||'';
  $('pf-email').value=S.profile.email||''; $('pf-phone').value=S.profile.phone||'';
  $('pf-branch').value=S.profile.branch||'Computer Science'; $('pf-sem').value=S.profile.sem||'4th';
  const attS=getAttSummary(), avgAtt=attS.length?Math.round(attS.reduce((s,x)=>s+x.pct,0)/attS.length):0;
  $('profile-stats').innerHTML=`<div style="display:grid;gap:10px">
    ${[['🎓','CGPA',calcCGPA()],['📅','Avg Attendance',avgAtt+'%'],
       ['✅','Tasks Done',S.todos.filter(t=>t.done).length+'/'+S.todos.length],
       ['📚','Subjects',new Set(S.attendance.map(a=>a.subject)).size]]
    .map(([icon,label,val])=>`<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--card2);border-radius:10px;border:1px solid var(--border)">
      <span style="font-size:1.2rem">${icon}</span><div style="flex:1"><div style="font-size:.75rem;color:var(--muted);font-weight:600">${label}</div></div>
      <div style="font-size:1rem;font-weight:800;color:var(--accent)">${val}</div></div>`).join('')}</div>`;
}

// ══════════════════════════════════════════════════
// BADGES & DATE & INIT
// ══════════════════════════════════════════════════
function updateBadges(){
  const p=S.todos.filter(t=>!t.done).length, u=S.urgent.filter(u=>!u.done).length;
  const tb=$('todo-badge'), ub=$('urgent-badge');
  p>0?(tb.style.display='',tb.textContent=p):tb.style.display='none';
  u>0?(ub.style.display='',ub.textContent=u):ub.style.display='none';
}

$('topbar-date').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
$('att-date').value=today();
$('m-todo-due').value=today();

function renderAll(){
  renderDashboard(); renderAttendance(); renderCGPA();
  renderTodo(); renderUrgent(); renderProfile(); updateBadges();
}

