/* ═══════════════════════════════════════════════
   POWER RANKINGS — Dynasty-aware
   ═══════════════════════════════════════════════ */

function renderPower() {
  const D = APP.data;
  if (!D) return;

  const teams = allTeams();
  const scored = teams.map(team => {
    const s = rosterScore(team);
    const histPts = allTimeWinPct(team.name) * 20; // historical bonus
    const champBonus = champCount(team.name) * 5;
    const dynastyScore = Math.round(s.score + histPts + champBonus);

    return { ...team, ...s, dynastyScore };
  }).sort((a, b) => b.dynastyScore - a.dynastyScore);

  const list = document.getElementById('power-list');
  list.innerHTML = '';

  scored.forEach((team, i) => {
    const rkColor = i === 0 ? 'var(--accent)' : i < 4 ? 'var(--green)' : i < 8 ? 'var(--blue)' : 'var(--text3)';
    const tier = i === 0 ? '🔥 Elite' : i < 4 ? '💪 Contender' : i < 8 ? '📈 Fringe' : '🔧 Rebuild';
    const tierClass = i === 0 ? 'tier-elite' : i < 4 ? 'tier-contender' : i < 8 ? 'tier-fringe' : 'tier-rebuild';
    const you = team.id === YOU_ID;

    // Prospect highlight — find top minor leaguers
    const topProspect = (team.players || [])
      .filter(p => p.status === 'MINORS' && p.adp < 350)
      .sort((a, b) => a.adp - b.adp)[0];

    const cats = [
      { l: 'Hitters', v: team.hitCount, g: 8, b: 5 },
      { l: 'SP', v: team.spCount, g: 4, b: 2 },
      { l: 'RP', v: team.rpCount, g: 3, b: 1 },
      { l: '⭐ Elite', v: team.elite, g: 3, b: 1 },
      { l: '🌱 Prospects', v: team.prospectValue > 0 ? Math.round(team.prospectValue / 3) : 0, g: 3, b: 1 },
      { l: 'IL', v: team.il, g: 0, b: 2, inv: true },
    ];

    const catHtml = cats.map(c => {
      const cls = c.inv
        ? (c.v <= c.g ? 'good' : c.v <= c.b ? 'ok' : 'bad')
        : (c.v >= c.g ? 'good' : c.v >= c.b ? 'ok' : 'bad');
      return `<div class="pr-cat">
        <span class="pr-cat-label">${c.l}</span>
        <span class="pr-cat-val ${cls}">${c.v}</span>
      </div>`;
    }).join('');

    list.innerHTML += `
      <div class="pr-card${you ? ' is-you' : ''}">
        <div class="pr-rank" style="color:${rkColor}">${i + 1}</div>
        <div class="pr-body">
          <div class="pr-team-name">${teamAvatarHtml(team.name, 22)} ${team.name}${you ? ' ★' : ''}</div>
          <div class="pr-owner">${team.owner}${champCount(team.name) > 0 ? ' · 🏆'.repeat(champCount(team.name)) : ''}</div>
          <div class="pr-cats">${catHtml}</div>
          ${topProspect ? `<div style="margin-top:6px;font-size:11px;color:var(--purple)">🌱 Top prospect: ${topProspect.name} (ADP ${topProspect.adp.toFixed(0)})</div>` : ''}
          <span class="pr-tier ${tierClass}" style="margin-top:6px">${tier}</span>
        </div>
        <div class="pr-score-block">
          <div class="pr-score">${team.dynastyScore}</div>
          <div style="font-size:10px;color:var(--text3)">Dynasty</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">ADP avg ${team.avgAdp.toFixed(0)}</div>
          ${team.il > 0 ? `<div style="font-size:10px;color:var(--red);margin-top:2px">${team.il} IL</div>` : ''}
        </div>
      </div>`;
  });

  // Scoring note
  document.getElementById('power-cats-note').innerHTML = `
    Scoring: <strong>R · HR · RBI · K · SB · AVG · OPS</strong> (hitting) &nbsp;|&nbsp;
    <strong>IP · H · K · QS · ERA · WHIP · SV+HLD</strong> (pitching) &nbsp;|&nbsp;
    Dynasty bonus: prospects, history, championships
  `;
}

/* ═══════════════════════════════════════════════
   LEGACY RANKINGS
   ═══════════════════════════════════════════════ */

function renderLegacy() {
  const teams = allTeams();
  if (!teams.length) return;

  const scored = teams.map(team => {
    const ls = legacyScore(team.name);
    return { ...team, ...ls };
  }).sort((a, b) => b.total - a.total);

  const list = document.getElementById('legacy-list');
  list.innerHTML = '';

  const maxScore = scored[0]?.total || 1;

  scored.forEach((team, i) => {
    const rkColor = i === 0 ? 'var(--accent)' : i < 3 ? 'var(--purple)' : 'var(--text3)';
    const you = team.id === YOU_ID;
    const bd = team.breakdown || {};

    list.innerHTML += `
      <div class="legacy-card${you ? ' is-you' : ''}">
        <div class="legacy-rank" style="color:${rkColor}">${i + 1}</div>
        <div class="legacy-body">
          <div class="legacy-team">${teamAvatarHtml(team.name, 22)} ${team.name}${you ? ' ★' : ''}</div>
          <div class="legacy-owner">${team.owner}${champCount(team.name) > 0 ? ' · ' + '🏆'.repeat(champCount(team.name)) : ''}</div>
          <div class="legacy-breakdown">
            <div class="legacy-component" style="color:var(--accent)">🏆 Champs: ${bd.championships || 0}</div>
            <div class="legacy-component" style="color:var(--green)">📈 Sustained: ${bd.sustained || 0}/25</div>
            <div class="legacy-component" style="color:var(--blue)">💪 Dominance: ${bd.dominance || 0}/20</div>
            <div class="legacy-component" style="color:var(--purple)">🎯 Consistency: ${bd.consistency || 0}/15</div>
            <div class="legacy-component" style="color:var(--orange)">🧠 Acumen: ${bd.acumen || 0}/10</div>
          </div>
          <div class="progress-bar" style="margin-top:8px">
            <div class="progress-fill" style="width:${Math.round((team.total/Math.max(maxScore,1))*100)}%;background:var(--purple)"></div>
          </div>
        </div>
        <div class="legacy-score-block">
          <div class="legacy-score">${team.total}</div>
          <div class="legacy-max">pts</div>
        </div>
      </div>`;
  });
}

/* ═══════════════════════════════════════════════
   WAIVER WIRE
   ═══════════════════════════════════════════════ */

function renderWaiver() {
  const D = APP.data;
  if (!D) return;

  // Populate team selector
  const sel = document.getElementById('waiver-team');
  if (sel && !sel.children.length) {
    allTeams().sort((a, b) => a.name.localeCompare(b.name)).forEach(t => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = `${t.name} (${t.owner})`;
      if (t.id === YOU_ID) o.selected = true;
      sel.appendChild(o);
    });
  }

  const teamId = sel?.value || YOU_ID;
  const myTeam = D.rosters?.[teamId];
  if (!myTeam) return;

  // Build rostered set
  const rostered = new Set();
  allTeams().forEach(t => (t.players || []).forEach(p => rostered.add(p.id)));

  // Available players sorted by ADP
  const avail = Object.entries(D.playerMap || {})
    .filter(([id]) => !rostered.has(id))
    .map(([id, p]) => ({ id, ...p }))
    .filter(p => p.adp && p.adp < 400)
    .sort((a, b) => a.adp - b.adp);

  // Weak spots
  const myActive = (myTeam.players || []).filter(p => p.status === 'ACTIVE');
  const weakHit = myActive.filter(p => !['SP', 'RP', 'P'].includes(p.pos) && p.adp > 250)
    .sort((a, b) => b.adp - a.adp);
  const weakPit = myActive.filter(p => ['SP', 'RP', 'P'].includes(p.pos) && p.adp > 280)
    .sort((a, b) => b.adp - a.adp);

  const container = document.getElementById('waiver-container');
  container.innerHTML = '';

  // Best available by group
  const groups = [
    { title: '🔥 Top Available Hitters', players: avail.filter(p => !['SP', 'RP', 'P'].includes(p.pos || '')).slice(0, 8), drops: weakHit },
    { title: '⚾ Top Available SP', players: avail.filter(p => p.pos === 'SP').slice(0, 6), drops: weakPit },
    { title: '🔒 Top Available RP', players: avail.filter(p => p.pos === 'RP').slice(0, 6), drops: [] },
  ];

  groups.forEach(group => {
    if (!group.players.length) return;

    const rows = group.players.map((p, i) => {
      const drop = group.drops[i];
      const catImpact = buildCatImpact(p);
      return `
        <div class="waiver-player-card">
          <div>
            <div class="waiver-player-name">${posTagHtml(p.pos || '?')} ${p.name}</div>
            <div class="waiver-player-info">ADP ${fmtAdp(p.adp)} · ${catImpact}</div>
            ${drop ? `<div style="font-size:10px;margin-top:3px">Drop candidate: <span class="badge badge-red">− ${drop.name} (ADP ${fmtAdp(drop.adp)})</span></div>` : ''}
          </div>
          <span class="badge waiver-add">+ ADD</span>
        </div>`;
    }).join('');

    container.innerHTML += `
      <div class="card" style="margin-bottom:12px">
        <div class="waiver-section-title">${group.title}</div>
        ${rows}
      </div>`;
  });

  if (!container.innerHTML) container.innerHTML = emptyHtml('No waiver data available.');
}

function buildCatImpact(p) {
  const isPit = ['SP', 'RP', 'P'].includes(p.pos || '');
  if (isPit) {
    const isRP = p.pos === 'RP';
    return `Adds: IP, K, ERA, WHIP${isRP ? ', SV+HLD' : ', QS'}`;
  }
  const pos = p.pos || '';
  const hasSB = ['OF', 'SS', '2B', 'UT'].includes(pos);
  return `Adds: R, HR, RBI, AVG, OPS${hasSB ? ', SB' : ''}`;
}

/* ═══════════════════════════════════════════════
   TRADE ANALYZER
   ═══════════════════════════════════════════════ */

let tradePlayers = { give: [], get: [] };

function initTrade() {
  // Only init once
  if (document.getElementById('give-chips')?.dataset.init) return;
  document.getElementById('give-chips').dataset.init = '1';
  renderChips('give');
  renderChips('get');
}

function searchTrade(side) {
  const q = document.getElementById(side + '-input')?.value?.toLowerCase();
  const drop = document.getElementById(side + '-drop');
  if (!q || q.length < 2 || !APP.data) { drop.classList.remove('open'); return; }

  const res = [];
  allTeams().forEach(team =>
    (team.players || []).forEach(p => {
      if ((p.name || '').toLowerCase().includes(q)) res.push({ ...p, teamName: team.name });
    })
  );

  if (!res.length) { drop.classList.remove('open'); return; }
  drop.innerHTML = res.slice(0, 8).map(p => `
    <div class="drop-item" onclick="addTradePlayer('${side}','${p.name.replace(/'/g, "\\'")}','${p.pos}',${p.adp},'${p.teamName}')">
      ${posTagHtml(p.pos)} ${p.name}
      <div class="drop-meta">${p.teamName} · ADP ${fmtAdp(p.adp)}</div>
    </div>`).join('');
  drop.classList.add('open');
}

function addTradePlayer(side, name, pos, adp, team) {
  tradePlayers[side].push({ name, pos, adp, team });
  document.getElementById(side + '-input').value = '';
  document.getElementById(side + '-drop').classList.remove('open');
  renderChips(side);
}

function removeTradePlayer(side, i) {
  tradePlayers[side].splice(i, 1);
  renderChips(side);
}

function renderChips(side) {
  const el = document.getElementById(side + '-chips');
  if (!el) return;
  el.innerHTML = tradePlayers[side].map((p, i) => `
    <div class="player-chip">
      <span class="chip-pos" style="background:${(POS_COLORS[p.pos]||'#888')}22;color:${POS_COLORS[p.pos]||'#888'}">${p.pos}</span>
      <span class="chip-name">${p.name}</span>
      <span class="chip-adp">${fmtAdp(p.adp)}</span>
      <span class="chip-remove" onclick="removeTradePlayer('${side}',${i})">×</span>
    </div>`).join('');
}

async function analyzeTrade() {
  if (!tradePlayers.give.length || !tradePlayers.get.length) {
    alert('Add at least one player to each side!'); return;
  }
  const btn = document.getElementById('trade-btn');
  const out = document.getElementById('trade-output');
  btn.disabled = true; btn.textContent = 'Analyzing...';
  out.classList.add('visible');
  out.innerHTML = '<div class="ai-thinking"><div class="ai-spinner"></div>Analyzing trade using your scoring categories (R·HR·RBI·K·SB·AVG·OPS / IP·H·K·QS·ERA·WHIP·SV+HLD)...</div>';

  const give = tradePlayers.give, get = tradePlayers.get;
  const gAdp = give.reduce((s, p) => s + (p.adp < 500 ? p.adp : 400), 0) / give.length;
  const gtAdp = get.reduce((s, p) => s + (p.adp < 500 ? p.adp : 400), 0) / get.length;
  const diff = gAdp - gtAdp;

  const verdict = diff > 60 ? '✅ WIN — Clear value in your favor'
    : diff > 20 ? '👍 SLIGHT WIN — Lean your way'
    : diff > -20 ? '⚖️ FAIR — Roughly even value'
    : diff > -60 ? '⚠️ SLIGHT LOSS — You overpay'
    : '❌ BAD DEAL — Significant overpay';

  const giveImpact = give.map(p => {
    const pit = ['SP', 'RP', 'P'].includes(p.pos);
    return `Losing ${p.pos} (${p.name}): affects ${pit ? 'IP, K, ERA, WHIP' + (p.pos === 'RP' ? ', SV+HLD' : ', QS') : 'R, HR, RBI, AVG, OPS'}`;
  });
  const getImpact = get.map(p => {
    const pit = ['SP', 'RP', 'P'].includes(p.pos);
    return `Gaining ${p.pos} (${p.name}): helps ${pit ? 'IP, K, ERA, WHIP' + (p.pos === 'RP' ? ', SV+HLD' : ', QS') : 'R, HR, RBI, AVG, OPS'}`;
  });

  const apiKey = document.getElementById('trade-api-key')?.value?.trim();
  if (apiKey) {
    const myActive = (youTeam()?.players || []).filter(p => p.status === 'ACTIVE')
      .sort((a, b) => a.adp - b.adp).slice(0, 12)
      .map(p => `${p.name}(${p.pos},ADP:${p.adp.toFixed(1)})`).join(', ');

    const prompt = `Fantasy baseball trade analysis for The 108 FBO league (H2H categories: Hitters: R,HR,RBI,K,SB,AVG,OPS | Pitchers: IP,H,K,QS,ERA,WHIP,SV+HLD).

My team (Rockwall Rhinos, managed by Jacob): ${myActive}

Trade proposal:
GIVING: ${give.map(p => `${p.name} (${p.pos}, ADP ${p.adp.toFixed(1)}, from ${p.team})`).join(', ')}
GETTING: ${get.map(p => `${p.name} (${p.pos}, ADP ${p.adp.toFixed(1)}, from ${p.team})`).join(', ')}

Provide: 1) Verdict (win/loss/fair) 2) ADP value analysis 3) Category impact for each scoring category affected 4) Final recommendation. Be direct, specific, and use the actual scoring categories. ~150 words.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const d = await res.json();
      const txt = d.content?.[0]?.text;
      if (txt) { out.textContent = txt; btn.disabled = false; btn.textContent = 'Analyze Trade'; return; }
    } catch (e) {}
  }

  // Math fallback
  out.textContent = `${verdict}

ADP Analysis:
  You give: avg ADP ${gAdp.toFixed(1)}
  You get:  avg ADP ${gtAdp.toFixed(1)}
  Gap: ${Math.abs(diff).toFixed(1)} pts ${diff > 0 ? 'in your favor' : 'against you'}

Category Impact:
${[...giveImpact, ...getImpact].map(x => '  • ' + x).join('\n')}

Players:
  GIVE: ${give.map(p => `${p.name} (${p.pos}, ADP ${fmtAdp(p.adp)})`).join(', ')}
  GET:  ${get.map(p => `${p.name} (${p.pos}, ADP ${fmtAdp(p.adp)})`).join(', ')}

💡 Add your Claude API key above for full AI narrative analysis.`;

  btn.disabled = false; btn.textContent = 'Analyze Trade';
}

// Close dropdowns on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('#give-input')) document.getElementById('give-drop')?.classList.remove('open');
  if (!e.target.closest('#get-input')) document.getElementById('get-drop')?.classList.remove('open');
});
