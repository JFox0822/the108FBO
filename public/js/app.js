/* ═══════════════════════════════════════════════
   THE 108 FBO — CORE APP
   ═══════════════════════════════════════════════ */

// ── CONSTANTS ──────────────────────────────────
const YOU_ID = 'tbwrxqepmg6kvw0l'; // Rockwall Rhinos

const TEAM_COLORS = {
  'Rockwall Rhinos':              '#448aff',
  'Salt Lake City Sluggers':      '#00e676',
  'San Diego Dysons':             '#ffd54f',
  'Alaskan Blue Balls':           '#40c4ff',
  'Saravejo Archdukes':           '#ff9800',
  'Georgia Peaches':              '#f48fb1',
  'Albuquerque Predators':        '#b388ff',
  'Anaheim Arte\'s':              '#84ffff',
  'Athens Amish Mafia':           '#ccff90',
  'Virginia Beach VelociRaptors': '#ff5252',
  'Marco Island Mermaids':        '#7986cb',
  'Florida Easy Money':           '#a1887f',
};

const TEAM_COLORS_FALLBACK = [
  '#448aff','#00e676','#ffd54f','#40c4ff','#ff9800','#f48fb1',
  '#b388ff','#84ffff','#ccff90','#ff5252','#7986cb','#a1887f'
];

const POS_COLORS = {
  SP:'#448aff', RP:'#b388ff', C:'#f48fb1',
  '1B':'#ffd54f', '2B':'#00e676', '3B':'#ff5252',
  SS:'#40c4ff', OF:'#ff9800', UT:'#7986cb', P:'#84ffff'
};

const STATUS_COLORS = {
  ACTIVE: '#00e676',
  RESERVE: '#448aff',
  MINORS: '#8bc34a',
  INJURED_RESERVE: '#ff5252'
};

const HIT_CATS = ['R','HR','RBI','SO_bat','SB','AVG','OPS'];
const PIT_CATS = ['IP','H','K','QS','ERA','WHIP','SVH'];
const CAT_LABELS = {
  R:'R', HR:'HR', RBI:'RBI', SO_bat:'K', SB:'SB', AVG:'AVG', OPS:'OPS',
  IP:'IP', H:'H', K:'K', QS:'QS', ERA:'ERA', WHIP:'WHIP', SVH:'SV+HLD'
};

// ── STATE ───────────────────────────────────────
window.APP = {
  data: null,
  history: null,
  loaded: false,
};

// ── INIT ────────────────────────────────────────
async function initApp() {
  try {
    const [dataRes, histRes] = await Promise.all([
      fetch('data.json?t=' + Date.now()),
      fetch('history.json?t=' + Date.now())
    ]);
    APP.data = await dataRes.json();
    APP.history = await histRes.json();
    APP.loaded = true;

    // Build color map from roster order
    Object.values(APP.data.rosters || {}).forEach((t, i) => {
      if (!TEAM_COLORS[t.name]) {
        TEAM_COLORS[t.name] = TEAM_COLORS_FALLBACK[i % TEAM_COLORS_FALLBACK.length];
      }
    });

    // Update nav
    const updated = APP.data.meta?.updatedDate || 'Unknown';
    document.getElementById('updated-text').textContent = updated;

    // Render active page
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (activePage) renderPage(activePage);

  } catch (e) {
    console.error('Failed to load data:', e);
    document.getElementById('updated-text').textContent = 'Load failed';
  }
}

// ── NAVIGATION ──────────────────────────────────
function navTo(name, btn, isMobile = false) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show target
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');

  // Update top nav
  document.querySelectorAll('.ntab').forEach(b => {
    b.classList.toggle('active', b.dataset.page === name);
  });
  // Update bottom nav
  document.querySelectorAll('.bnav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === name);
  });

  window.scrollTo(0, 0);
  if (APP.loaded) renderPage(name);
}

function renderPage(name) {
  switch (name) {
    case 'standings':    renderStandings();    break;
    case 'rosters':      renderRosters();      break;
    case 'matchups':     renderMatchups();     break;
    case 'power':        renderPower();        break;
    case 'legacy':       renderLegacy();       break;
    case 'waiver':       renderWaiver();       break;
    case 'trade':        initTrade();          break;
    case 'awards':       renderAwards();       break;
    case 'articles':     renderArticles();     break;
    case 'resumes':      renderResumes();      break;
    case 'championships':renderChampionships();break;
    case 'records':      renderRecords();      break;
    case 'h2h':          renderH2H();          break;
    case 'luck':         renderLuck();         break;
    case 'stats':        renderStats();        break;
    case 'outliers':     renderOutliers();     break;
    case 'catking':      renderCatKing();      break;
  }
}

// ── SHARED UTILITIES ────────────────────────────

function ini(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function teamColor(name) {
  return TEAM_COLORS[name] || '#448aff';
}

function teamAvatarHtml(name, size = 28) {
  const color = teamColor(name);
  return `<div class="team-avatar" style="background:${color};width:${size}px;height:${size}px">${ini(name)}</div>`;
}

function posTagHtml(pos) {
  const color = POS_COLORS[pos] || '#888';
  return `<span class="pos-tag" style="background:${color}22;color:${color};border:0.5px solid ${color}44">${pos}</span>`;
}

function badgeHtml(text, type = 'green') {
  return `<span class="badge badge-${type}">${text}</span>`;
}

function fmtAdp(adp) {
  return adp && adp < 500 ? adp.toFixed(1) : '—';
}

function fmtPct(pct) {
  return typeof pct === 'number' ? pct.toFixed(3) : '.000';
}

function fmtNum(n) {
  return typeof n === 'number' ? n.toLocaleString() : (n || '—');
}

function avgAdp(team) {
  const ps = (team.players || []).filter(p => p.status === 'ACTIVE' && p.adp < 500);
  return ps.length ? ps.reduce((s, p) => s + p.adp, 0) / ps.length : 999;
}

function getTeamById(id) {
  return APP.data?.rosters?.[id] || null;
}

function getTeamByName(name) {
  return Object.values(APP.data?.rosters || {}).find(t => t.name === name) || null;
}

function allTeams() {
  return Object.values(APP.data?.rosters || {});
}

function isYou(teamId) {
  return teamId === YOU_ID;
}

function youTeam() {
  return APP.data?.rosters?.[YOU_ID] || null;
}

// ── SEASON RECORD FROM HISTORY ──────────────────
function getTeamSeasonRecord(teamName, year) {
  const standings = APP.history?.seasons?.[year]?.standings || [];
  return standings.find(s => s.team === teamName) || null;
}

function getTeamAllTimeRecord(teamName) {
  return APP.history?.allTimeStandings?.[teamName] || null;
}

function getTeamChampionships(teamName) {
  const champs = APP.history?.championships || [];
  return champs.filter(c => c.champion === teamName);
}

function champCount(teamName) {
  return getTeamChampionships(teamName).length;
}

function allTimeWinPct(teamName) {
  const rec = getTeamAllTimeRecord(teamName);
  if (!rec) return 0;
  const total = rec.w + rec.l + rec.t;
  return total ? rec.w / total : 0;
}

// ── SCORING UTILS ───────────────────────────────
// Higher = better for: R, HR, RBI, SB, AVG, OPS, QS, K_pit, SVH, IP
// Lower = better for: SO_bat (strikeouts as batter), H_allowed, ERA, WHIP
function isLowerBetter(cat) {
  return ['SO_bat','H','H_allowed','ERA','WHIP'].includes(cat);
}

// Score a team's roster for power rankings
function rosterScore(team) {
  const active = (team.players || []).filter(p => p.status === 'ACTIVE');
  const pitchers = active.filter(p => ['SP','RP','P'].includes(p.pos));
  const hitters = active.filter(p => !['SP','RP','P'].includes(p.pos));
  const adps = active.filter(p => p.adp < 500).map(p => p.adp);
  const avg = adps.length ? adps.reduce((s, a) => s + a, 0) / adps.length : 999;
  const best = adps.length ? Math.min(...adps) : 999;
  const elite = active.filter(p => p.adp < 50).length;
  const solid = active.filter(p => p.adp >= 50 && p.adp < 150).length;
  const depth = active.filter(p => p.adp < 250).length;
  const il = (team.players || []).filter(p => p.status === 'INJURED_RESERVE').length;
  const minors = (team.players || []).filter(p => p.status === 'MINORS');
  // Prospect value: top minor league players with low ADP = future assets
  const prospectValue = minors.filter(p => p.adp < 350).length * 3;

  return {
    score: Math.round(750 - avg * 0.75 + elite * 30 + solid * 10 + depth * 2 - il * 25 + prospectValue),
    avgAdp: avg, topAdp: best, elite, solid, depth, il,
    spCount: active.filter(p => p.pos === 'SP').length,
    rpCount: active.filter(p => ['RP','P'].includes(p.pos)).length,
    hitCount: hitters.length,
    pitchCount: pitchers.length,
    prospectValue,
    minorCount: minors.length
  };
}

// Legacy score from history
function legacyScore(teamName) {
  const atRec = getTeamAllTimeRecord(teamName);
  if (!atRec) return { total: 0, breakdown: {} };

  const champs = champCount(teamName);
  const seasons = APP.history?.seasons || {};
  const yearCount = Object.keys(seasons).length || 1;

  // Championships: 15 pts each (uncapped)
  const champPts = champs * 15;

  // Sustained winning (25 pts max): based on all-time win pct
  const pct = allTimeWinPct(teamName);
  const sustainedPts = Math.round(Math.min(25, pct * 35));

  // Dominance (20 pts): based on regular season finishes
  let domPts = 0;
  Object.values(seasons).forEach(season => {
    const rec = (season.standings || []).find(s => s.team === teamName);
    if (rec) {
      if (rec.rank === 1) domPts += 5;
      else if (rec.rank <= 3) domPts += 3;
      else if (rec.rank <= 6) domPts += 1;
    }
  });
  domPts = Math.min(20, domPts);

  // Consistency (15 pts): no terrible seasons (rank > 9 = 0, rank 7-9 = 0.5, else 1)
  let conPts = 0;
  Object.values(seasons).forEach(season => {
    const rec = (season.standings || []).find(s => s.team === teamName);
    if (rec) {
      if (rec.rank <= 6) conPts += 2.5;
      else if (rec.rank <= 9) conPts += 1;
    }
  });
  conPts = Math.min(15, conPts);

  // Acumen (10 pts): playoff appearances + category king seasons
  let acumenPts = 0;
  Object.values(seasons).forEach(season => {
    const po = (season.playoffs || []).find(p => p.team === teamName);
    if (po) acumenPts += 2;
  });
  acumenPts = Math.min(10, acumenPts);

  const total = champPts + sustainedPts + domPts + conPts + acumenPts;

  return {
    total: Math.round(total),
    breakdown: {
      championships: champPts,
      sustained: sustainedPts,
      dominance: domPts,
      consistency: conPts,
      acumen: acumenPts
    }
  };
}

// ── LOADING TEMPLATE ────────────────────────────
function loadingHtml(msg = 'Loading...') {
  return `<div class="loading-state"><div class="loading-spinner"></div><div>${msg}</div></div>`;
}

function emptyHtml(msg = 'No data available yet.') {
  return `<div class="empty-state">${msg}</div>`;
}

// ── KICK OFF ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Wire top nav buttons
  document.querySelectorAll('.ntab').forEach(btn => {
    btn.addEventListener('click', () => navTo(btn.dataset.page, btn, false));
  });
  // Wire bottom nav buttons
  document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => navTo(btn.dataset.page, btn, true));
  });

  initApp();
});
