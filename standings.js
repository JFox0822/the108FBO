/* ═══════════════════════════════════════════════
   STANDINGS
   ═══════════════════════════════════════════════ */

function renderStandings() {
  const D = APP.data;
  if (!D) return;

  const rows = Array.isArray(D.standings) ? D.standings : [];
  const rosters = Object.values(D.rosters || {});
  const totalIL = rosters.reduce((s, t) => s + (t.players || []).filter(p => p.status === 'INJURED_RESERVE').length, 0);

  // Stat strip
  document.getElementById('standings-stats').innerHTML = `
    <div class="stat-tile"><div class="sv">${rows.length || 12}</div><div class="sl">Teams</div></div>
    <div class="stat-tile"><div class="sv">${D.meta?.season || 2026}</div><div class="sl">Season</div></div>
    <div class="stat-tile"><div class="sv">${D.schedule?.length || 23}</div><div class="sl">Weeks</div></div>
    <div class="stat-tile"><div class="sv">${totalIL}</div><div class="sl">On IL</div></div>
  `;

  // Table
  const tbody = document.getElementById('standings-tbody');
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="8">${emptyHtml('Season not yet started — check back Opening Day!')}</td></tr>`; return; }

  tbody.innerHTML = rows.map((row, i) => {
    const name = row.teamName || row.name || '?';
    const [w, l, t] = (row.points || '0-0-0').split('-').map(Number);
    const pct = fmtPct(row.winPercentage);
    const gb = i === 0 ? '—' : (row.gamesBack || '—');
    const streak = row.streak || '';
    const tid = row.teamId || '';
    const owner = D.teams?.[tid]?.owner || '';
    const rk = i === 0 ? 'g1' : i === 1 ? 'g2' : i === 2 ? 'g3' : '';
    const strHtml = streak
      ? `<span class="badge ${streak.startsWith('W') ? 'streak-w badge-green' : 'streak-l badge-red'}">${streak}</span>`
      : '—';
    const ilCount = (D.rosters?.[tid]?.players || []).filter(p => p.status === 'INJURED_RESERVE').length;
    const youClass = tid === YOU_ID ? 'style="background:rgba(68,138,255,.04)"' : '';

    return `<tr ${youClass}>
      <td><div class="rk ${rk}">${i + 1}</div></td>
      <td>
        <div class="team-cell">
          ${teamAvatarHtml(name)}
          <div>
            <div class="team-name">${name}${tid === YOU_ID ? ' <span style="color:var(--blue);font-size:10px">★ You</span>' : ''}</div>
            <div class="team-owner">${owner}</div>
          </div>
        </div>
      </td>
      <td class="tc">${w || 0}</td>
      <td class="tc">${l || 0}</td>
      <td class="tc">${t || 0}</td>
      <td class="tc" style="color:var(--green);font-family:var(--mono);font-weight:700">${pct}</td>
      <td class="tc" style="color:var(--text3);font-family:var(--mono);font-size:11px">${gb}</td>
      <td class="tc">${strHtml}${ilCount > 0 ? ` <span class="badge badge-red">${ilCount} IL</span>` : ''}</td>
    </tr>`;
  }).join('');
}

/* ═══════════════════════════════════════════════
   ROSTERS
   ═══════════════════════════════════════════════ */

function renderRosters() {
  const D = APP.data;
  if (!D) return;

  const sortBy = document.getElementById('r-sort')?.value || 'name';
  const stF = document.getElementById('r-status')?.value || 'all';
  const posF = document.getElementById('r-pos')?.value || 'all';
  const q = (document.getElementById('r-search')?.value || '').toLowerCase();

  let teams = Object.values(D.rosters || {});

  if (sortBy === 'adp') teams.sort((a, b) => avgAdp(a) - avgAdp(b));
  else if (sortBy === 'il') teams.sort((a, b) =>
    b.players.filter(p => p.status === 'INJURED_RESERVE').length -
    a.players.filter(p => p.status === 'INJURED_RESERVE').length);
  else if (sortBy === 'score') teams.sort((a, b) => rosterScore(b).score - rosterScore(a).score);
  else teams.sort((a, b) => a.name.localeCompare(b.name));

  const grid = document.getElementById('roster-grid');
  grid.innerHTML = '';

  teams.forEach(team => {
    let ps = [...(team.players || [])];
    if (stF !== 'all') ps = ps.filter(p => p.status === stF);
    if (posF !== 'all') ps = ps.filter(p => p.pos === posF);
    if (q) ps = ps.filter(p => (p.name || '').toLowerCase().includes(q));
    if (!ps.length && (posF !== 'all' || q)) return;

    const il = team.players.filter(p => p.status === 'INJURED_RESERVE').length;
    const aAdp = avgAdp(team);
    const you = team.id === YOU_ID;

    const groups = { ACTIVE: [], RESERVE: [], MINORS: [], INJURED_RESERVE: [] };
    ps.forEach(p => { if (groups[p.status]) groups[p.status].push(p); });

    const lbl = { ACTIVE: 'Active', RESERVE: 'Reserve', MINORS: 'Minors', INJURED_RESERVE: 'IL' };
    let rows = '';
    Object.entries(groups).forEach(([st, gps]) => {
      if (!gps.length) return;
      if (stF === 'all') rows += `<div class="group-label">${lbl[st]}</div>`;
      gps.forEach(p => {
        rows += `<div class="player-row">
          <div class="status-dot" style="background:${STATUS_COLORS[p.status] || '#888'}"></div>
          ${posTagHtml(p.pos)}
          <span class="player-name">${p.name}</span>
          <span class="player-adp">${fmtAdp(p.adp)}</span>
        </div>`;
      });
    });

    grid.innerHTML += `
      <div class="roster-card${you ? ' is-you' : ''}">
        <div class="roster-card-head">
          <div class="team-cell">
            ${teamAvatarHtml(team.name)}
            <div>
              <div class="team-name">${team.name}${you ? ' ★' : ''}</div>
              <div class="team-owner">${team.owner}</div>
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${you ? badgeHtml('You', 'blue') : ''}
            ${il > 0 ? badgeHtml(il + ' IL', 'red') : ''}
            ${aAdp < 500 ? badgeHtml('ADP ' + aAdp.toFixed(0), 'green') : ''}
          </div>
        </div>
        <div class="roster-card-body">
          ${rows || emptyHtml('No players match')}
        </div>
      </div>`;
  });
}

/* ═══════════════════════════════════════════════
   MATCHUPS
   ═══════════════════════════════════════════════ */

function renderMatchups() {
  const D = APP.data;
  if (!D?.schedule?.length) return;

  // Populate week selector if empty
  const sel = document.getElementById('matchup-week');
  if (sel && !sel.children.length) {
    D.schedule.forEach(w => {
      const o = document.createElement('option');
      o.value = w.period;
      o.textContent = `Week ${w.period}`;
      sel.appendChild(o);
    });
  }

  const period = parseInt(sel?.value) || 1;
  const week = D.schedule.find(w => w.period === period);
  const grid = document.getElementById('matchup-grid');
  if (!grid) return;

  grid.innerHTML = '';
  if (!week) { grid.innerHTML = emptyHtml(); return; }

  week.matchupList.forEach(m => {
    const awayYou = m.away.id === YOU_ID;
    const homeYou = m.home.id === YOU_ID;
    const you = awayYou || homeYou;

    // Try to get live score from scoreboard
    const sbPeriod = D.scoreboard?.[String(period)];
    let awayScore = '—', homeScore = '—';
    if (sbPeriod?.matchups) {
      const sb = sbPeriod.matchups.find(x =>
        (x.away?.id === m.away.id || x.awayTeam?.id === m.away.id));
      if (sb) { awayScore = sb.awayScore ?? '—'; homeScore = sb.homeScore ?? '—'; }
    }

    grid.innerHTML += `
      <div class="matchup-card${you ? ' is-you' : ''}">
        <div class="matchup-teams">
          <div class="mt-away">
            <div class="mt-name">${m.away.name}${awayYou ? ' ★' : ''}</div>
            <div class="mt-owner">${m.away.shortName}</div>
          </div>
          <div>
            ${awayScore !== '—' || homeScore !== '—'
              ? `<div class="mt-score">${awayScore}–${homeScore}</div>`
              : `<div class="mt-vs">VS</div>`}
            <div class="mt-week">WK ${period}</div>
          </div>
          <div class="mt-home">
            <div class="mt-name">${m.home.name}${homeYou ? ' ★' : ''}</div>
            <div class="mt-owner">${m.home.shortName}</div>
          </div>
        </div>
      </div>`;
  });

  // Matchup preview for your game
  renderMatchupPreview(week, period);
}

function renderMatchupPreview(week, period) {
  const preview = document.getElementById('matchup-preview');
  if (!preview) return;

  const myMatchup = week.matchupList.find(m => m.away.id === YOU_ID || m.home.id === YOU_ID);
  if (!myMatchup) { preview.innerHTML = ''; return; }

  const oppId = myMatchup.away.id === YOU_ID ? myMatchup.home.id : myMatchup.away.id;
  const oppName = myMatchup.away.id === YOU_ID ? myMatchup.home.name : myMatchup.away.name;
  const myTeam = youTeam();
  const oppTeam = APP.data.rosters?.[oppId];

  if (!myTeam || !oppTeam) return;

  const myActive = myTeam.players.filter(p => p.status === 'ACTIVE').sort((a, b) => a.adp - b.adp);
  const oppActive = oppTeam.players.filter(p => p.status === 'ACTIVE').sort((a, b) => a.adp - b.adp);
  const myTop3 = myActive.slice(0, 3).map(p => p.name).join(', ');
  const oppTop3 = oppActive.slice(0, 3).map(p => p.name).join(', ');

  preview.innerHTML = `
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div style="font-family:var(--display);font-size:18px;letter-spacing:1px">
          Week ${period} — Your Matchup
        </div>
        ${badgeHtml('Rockwall Rhinos vs ' + oppName, 'blue')}
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:11px;color:var(--text3);font-family:var(--cond);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Your Key Players</div>
            <div style="font-size:13px;color:var(--text2)">${myTop3}</div>
            <div style="margin-top:8px;font-size:11px;color:var(--text3)">Avg ADP: ${avgAdp(myTeam).toFixed(0)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text3);font-family:var(--cond);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${oppName} Key Players</div>
            <div style="font-size:13px;color:var(--text2)">${oppTop3}</div>
            <div style="margin-top:8px;font-size:11px;color:var(--text3)">Avg ADP: ${avgAdp(oppTeam).toFixed(0)}</div>
          </div>
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:12px;color:var(--text3)">
          Remember: 10 SP minimum, 10 SP maximum per week. Exceeding the max = automatic loss.
        </div>
      </div>
    </div>`;
}
