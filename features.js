/* ═══════════════════════════════════════════════
   ASSHOLE OF THE WEEK
   ═══════════════════════════════════════════════ */

function renderAwards() {
  const H = APP.history;
  if (!H) return;

  const aotw = H.asshole_of_the_week || [];

  // Count by team
  const counts = {};
  aotw.forEach(entry => {
    (entry.teams || []).forEach(team => {
      counts[team] = (counts[team] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const worstOffender = sorted[0];

  // Leaderboard
  document.getElementById('aotw-leaderboard').innerHTML = sorted.map(([team, count], i) => `
    <div class="award-card" style="margin-bottom:8px">
      <div class="award-icon">${i === 0 ? '💩' : '😤'}</div>
      <div class="award-body">
        <div class="award-title" style="${i === 0 ? '' : 'color:var(--orange)'}">${team}</div>
        <div class="award-reason">Exceeded SP max ${count} time${count > 1 ? 's' : ''} — automatic loss${count > 1 ? 'es' : ''}</div>
      </div>
      <div style="text-align:right">
        <div class="award-count" style="${i === 0 ? '' : 'color:var(--orange)'}">${count}</div>
        <div class="award-count-label">offense${count > 1 ? 's' : ''}</div>
      </div>
    </div>`).join('');

  // Weekly history
  const weeks = [...aotw].reverse();
  document.getElementById('aotw-history').innerHTML = weeks.map(entry => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
      <div style="font-family:var(--mono);color:var(--text3);min-width:80px">2025 Wk ${entry.week}</div>
      <div style="flex:1">
        ${(entry.teams || []).map(t => `<span class="badge badge-red" style="margin-right:4px">💩 ${t}</span>`).join('')}
      </div>
    </div>`).join('');

  // Perfect matchups
  const perfect = H.perfect_matchups || [];
  document.getElementById('perfect-matchups').innerHTML = perfect.length
    ? perfect.map(m => `
      <div class="award-card" style="margin-bottom:8px">
        <div class="award-icon">🏆</div>
        <div class="award-body">
          <div style="font-weight:700;color:var(--green)">${m.winner}</div>
          <div style="font-size:13px;color:var(--text2)">def ${m.loser} — ${m.score}</div>
          <div style="font-size:11px;color:var(--text3)">Week ${m.week}, ${m.year}</div>
        </div>
        <div style="font-family:var(--display);font-size:36px;color:var(--green)">14-0</div>
      </div>`).join('')
    : emptyHtml('No perfect matchups yet.');
}

/* ═══════════════════════════════════════════════
   WEEKLY ARTICLES (AI-powered)
   ═══════════════════════════════════════════════ */

function renderArticles() {
  const D = APP.data;
  if (!D?.schedule?.length) return;

  const sel = document.getElementById('article-week');
  if (sel && !sel.children.length) {
    D.schedule.forEach(w => {
      const o = document.createElement('option');
      o.value = w.period;
      o.textContent = `Week ${w.period}`;
      sel.appendChild(o);
    });
  }
}

async function generateArticles() {
  const D = APP.data;
  if (!D) return;

  const period = parseInt(document.getElementById('article-week')?.value) || 1;
  const week = D.schedule?.find(w => w.period === period);
  const apiKey = document.getElementById('article-api-key')?.value?.trim();
  const container = document.getElementById('articles-container');

  if (!week) { container.innerHTML = emptyHtml('No matchup data for this week.'); return; }

  container.innerHTML = `<div class="article-loading"><div class="ai-spinner"></div>Generating Week ${period} matchup articles...</div>`;

  const matchupSummaries = week.matchupList.map(m => {
    const away = D.rosters?.[m.away.id];
    const home = D.rosters?.[m.home.id];
    const awayTop = (away?.players || []).filter(p => p.status === 'ACTIVE').sort((a, b) => a.adp - b.adp).slice(0, 5).map(p => `${p.name}(${p.pos},ADP:${p.adp.toFixed(0)})`).join(', ');
    const homeTop = (home?.players || []).filter(p => p.status === 'ACTIVE').sort((a, b) => a.adp - b.adp).slice(0, 5).map(p => `${p.name}(${p.pos},ADP:${p.adp.toFixed(0)})`).join(', ');
    return `MATCHUP: ${m.away.name} (${m.away.shortName}) vs ${m.home.name} (${m.home.shortName})
Away key players: ${awayTop}
Home key players: ${homeTop}`;
  }).join('\n\n');

  const prompt = `You are the FBO Insider, the media personality covering The 108 FBO fantasy baseball league. Write a compelling Week ${period} matchup preview for each of the 6 matchups below.

For each matchup include:
1. A fun headline
2. Key players to watch for each team
3. Strength/weakness breakdown based on scoring categories (R,HR,RBI,K,SB,AVG,OPS / IP,H,K,QS,ERA,WHIP,SV+HLD)
4. Prediction with score (e.g. "8-6 in favor of...")
5. One trash talk line

Keep each matchup to ~100 words. Be fun, opinionated, and use real player names. This is a friend group — be bold.

${matchupSummaries}`;

  if (!apiKey) {
    // Fallback without AI
    container.innerHTML = week.matchupList.map(m => `
      <div class="article-card">
        <div class="article-header">
          <div class="article-matchup">${m.away.name} vs ${m.home.name}</div>
          <div class="article-week">Week ${period}</div>
        </div>
        <div class="article-body" style="color:var(--text3)">
          Add a Claude API key to generate AI-written matchup articles with player analysis, predictions, and trash talk.
          
          ${m.away.name} (${m.away.shortName}) faces off against ${m.home.name} (${m.home.shortName}) in Week ${period}.
        </div>
      </div>`).join('');
    return;
  }

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
        model: 'claude-sonnet-4-20250514', max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const d = await res.json();
    const text = d.content?.[0]?.text || '';

    // Split by matchup and render
    const sections = text.split(/MATCHUP:|---|\n\n(?=[A-Z].*vs)/i).filter(s => s.trim());
    container.innerHTML = sections.map((section, i) => {
      const m = week.matchupList[i];
      return `
        <div class="article-card">
          <div class="article-header">
            <div class="article-matchup">${m ? `${m.away.name} vs ${m.home.name}` : `Matchup ${i + 1}`}</div>
            <div class="article-week">Week ${period} · FBO Insider</div>
          </div>
          <div class="article-body">${section.trim()}</div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="article-card"><div class="article-body" style="color:var(--red)">Error generating articles. Check your API key.</div></div>`;
  }
}

/* ═══════════════════════════════════════════════
   OWNER RESUMES
   ═══════════════════════════════════════════════ */

function renderResumes() {
  const H = APP.history;
  const D = APP.data;
  if (!H || !D) return;

  const sel = document.getElementById('resume-team');
  const teams = allTeams().sort((a, b) => a.name.localeCompare(b.name));

  if (sel && !sel.children.length) {
    teams.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = `${t.name} (${t.owner})`;
      if (t.id === YOU_ID) o.selected = true;
      sel.appendChild(o);
    });
  }

  const teamId = sel?.value || YOU_ID;
  renderResumeFor(teamId);
}

function renderResumeFor(teamId) {
  const H = APP.history;
  const D = APP.data;
  const team = D?.rosters?.[teamId];
  if (!team) return;

  const name = team.name;
  const owner = team.owner;
  const color = teamColor(name);
  const atRec = getTeamAllTimeRecord(name);
  const champs = getTeamChampionships(name);
  const allPct = allTimeWinPct(name);
  const champN = champs.length;
  const seasons = H?.seasons || {};
  const yearCount = Object.keys(seasons).length;

  // Season results
  const seasonResults = Object.entries(seasons).map(([yr, s]) => {
    const rec = (s.standings || []).find(r => r.team === name);
    return rec ? { year: yr, rank: rec.rank, w: rec.w, l: rec.l, t: rec.t, pct: rec.pct } : null;
  }).filter(Boolean).sort((a, b) => a.year - b.year);

  const bestYear = seasonResults.length ? seasonResults.reduce((best, r) => r.pct > best.pct ? r : best) : null;
  const worstYear = seasonResults.length ? seasonResults.reduce((worst, r) => r.pct < worst.pct ? r : worst) : null;

  // Playoff appearances
  const playoffApps = Object.values(seasons).filter(s =>
    (s.playoffs || []).some(p => p.team === name)
  ).length;

  // Winning seasons (> .500)
  const winSeasons = seasonResults.filter(r => r.pct > 0.5).length;

  // Current roster analysis
  const active = (team.players || []).filter(p => p.status === 'ACTIVE');
  const pitchers = active.filter(p => ['SP', 'RP', 'P'].includes(p.pos));
  const hitters = active.filter(p => !['SP', 'RP', 'P'].includes(p.pos));
  const topPit = pitchers.sort((a, b) => a.adp - b.adp).slice(0, 3).map(p => p.name).join(', ');
  const topHit = hitters.sort((a, b) => a.adp - b.adp).slice(0, 3).map(p => p.name).join(', ');
  const prospects = (team.players || []).filter(p => p.status === 'MINORS').sort((a, b) => a.adp - b.adp).slice(0, 3);

  // 2025 season context
  const cur25 = (seasons['2025']?.standings || []).find(r => r.team === name);
  const cur24 = (seasons['2024']?.standings || []).find(r => r.team === name);

  // Trajectory
  let trajectory = '📊 Holding steady';
  if (cur25 && cur24) {
    if (cur25.rank < cur24.rank) trajectory = '📈 Rising — improved from 2024';
    else if (cur25.rank > cur24.rank) trajectory = '📉 Trending down from 2024';
  }

  // 2026 outlook
  const outlook = buildOutlook(name, team, prospects);

  document.getElementById('resume-container').innerHTML = `
    <div class="resume-card">
      <div class="resume-hero">
        <div class="resume-avatar" style="background:${color};width:64px;height:64px;border-radius:12px">${ini(name)}</div>
        <div>
          <div class="resume-name">${name}</div>
          <div class="resume-team">Owner: ${owner} · ${yearCount} season${yearCount !== 1 ? 's' : ''} in the 108 FBO</div>
          ${champs.length ? `<div style="margin-top:4px">${champs.map(c => `🏆 ${c.year} Champion`).join(' · ')}</div>` : ''}
        </div>
      </div>

      <div class="resume-stats">
        <div class="resume-stat"><div class="resume-stat-val">${atRec ? (atRec.w || 0) : '—'}</div><div class="resume-stat-label">All-Time W</div></div>
        <div class="resume-stat"><div class="resume-stat-val">${atRec ? (atRec.l || 0) : '—'}</div><div class="resume-stat-label">All-Time L</div></div>
        <div class="resume-stat"><div class="resume-stat-val">${(allPct * 100).toFixed(0)}%</div><div class="resume-stat-label">Win %</div></div>
        <div class="resume-stat"><div class="resume-stat-val">${champN}</div><div class="resume-stat-label">Titles</div></div>
        <div class="resume-stat"><div class="resume-stat-val">${playoffApps}</div><div class="resume-stat-label">Playoffs</div></div>
        <div class="resume-stat"><div class="resume-stat-val">${winSeasons}</div><div class="resume-stat-label">Win Seas.</div></div>
      </div>

      <div class="resume-sections" style="grid-template-columns:1fr 1fr">
        <div>
          <div class="resume-section-title">Season by Season</div>
          ${seasonResults.map(r => `
            <div class="matchup-item">
              <span style="font-family:var(--mono);color:var(--text3)">${r.year}</span>
              <span>Rank #${r.rank} — ${r.w}-${r.l}-${r.t}</span>
              <span style="font-family:var(--mono);font-size:11px;color:${r.pct > .55 ? 'var(--green)' : r.pct < .4 ? 'var(--red)' : 'var(--text3)'}">${(r.pct * 100).toFixed(0)}%</span>
            </div>`).join('')}
        </div>
        <div>
          <div class="resume-section-title">Milestones</div>
          <div class="resume-section-body">
            ${bestYear ? `🏆 Peak season: ${bestYear.year} (Rank #${bestYear.rank}, ${(bestYear.pct * 100).toFixed(0)}%)` : ''}
            ${worstYear && worstYear.year !== bestYear?.year ? `<br>📉 Toughest season: ${worstYear.year} (Rank #${worstYear.rank})` : ''}
            ${champs.length ? `<br>🥇 Champion: ${champs.map(c => c.year).join(', ')}` : '<br>🏆 Still chasing first title'}
            <br>📊 Trajectory: ${trajectory}
          </div>
        </div>
        <div>
          <div class="resume-section-title">Current Roster Strengths</div>
          <div class="resume-section-body">
            <strong>Pitching core:</strong> ${topPit || 'N/A'}<br>
            <strong>Hitting core:</strong> ${topHit || 'N/A'}<br>
            ${prospects.length ? `<strong>Top prospects:</strong> ${prospects.map(p => p.name).join(', ')}` : ''}
          </div>
        </div>
        <div>
          <div class="resume-section-title">2026 Outlook</div>
          <div class="resume-section-body">${outlook}</div>
        </div>
      </div>
    </div>`;
}

function buildOutlook(name, team, prospects) {
  const active = (team.players || []).filter(p => p.status === 'ACTIVE');
  const avgA = avgAdp(team);
  const elite = active.filter(p => p.adp < 50).length;
  const il = team.players.filter(p => p.status === 'INJURED_RESERVE').length;
  const pCount = prospects.length;

  if (elite >= 3 && avgA < 150 && il === 0) {
    return `🔥 <strong>Championship window is OPEN.</strong> Elite talent, healthy roster, no excuses. This is the year to win it all.`;
  } else if (pCount >= 3 && avgA > 200) {
    return `🌱 <strong>Dynasty build in progress.</strong> Heavy prospect investment signals a long-term strategy. ${prospects[0]?.name || 'Top prospect'} could be a franchise cornerstone.`;
  } else if (il > 2) {
    return `🏥 <strong>Health is the key.</strong> Talent is there but ${il} players on IL creates uncertainty. A healthy roster could surprise — watch the wire closely.`;
  } else if (elite >= 2 && pCount >= 2) {
    return `⚡ <strong>Balanced approach</strong> — elite stars plus prospect depth. Competitive now while building for the future. Playoff contention is realistic.`;
  } else {
    return `📊 <strong>Steady contender.</strong> Consistent roster construction. Finding one elite upgrade could push this team over the top in a competitive league.`;
  }
}

/* ═══════════════════════════════════════════════
   CHAMPIONSHIP HISTORY
   ═══════════════════════════════════════════════ */

function renderChampionships() {
  const H = APP.history;
  if (!H) return;

  const champs = H.championships || [];

  // Year-by-year
  document.getElementById('champ-history').innerHTML = [...champs].reverse().map(c => `
    <div class="champ-card">
      <div class="champ-year">${c.year}</div>
      <div class="champ-trophy">🏆</div>
      <div>
        <div class="champ-team">${c.champion}</div>
        <div class="champ-owner">Owner: ${c.owner}</div>
        ${c.score ? `<div class="champ-score">def ${c.runnerUp} · ${c.score}</div>` : ''}
        ${c.note ? `<div class="champ-score" style="color:var(--blue)">${c.note}</div>` : ''}
      </div>
      <div style="margin-left:auto">
        ${teamAvatarHtml(c.champion, 48)}
      </div>
    </div>`).join('');

  // Drought tracker
  const allTeamNames = Object.keys(H.allTimeStandings || {});
  const lastWon = {};
  champs.forEach(c => { if (!lastWon[c.champion]) lastWon[c.champion] = c.year; });
  const currentYear = 2025;

  const droughts = allTeamNames.map(t => ({
    team: t,
    lastWin: lastWon[t] || null,
    drought: lastWon[t] ? currentYear - lastWon[t] : currentYear - 2023, // league started 2024
    hasWon: !!lastWon[t]
  })).sort((a, b) => b.drought - a.drought);

  document.getElementById('champ-drought').innerHTML = droughts.map((d, i) => `
    <div class="champ-bar">
      <div class="champ-bar-team">${teamAvatarHtml(d.team, 22)} ${d.team}</div>
      <div class="champ-bar-track">
        <div class="champ-bar-fill" style="width:${d.hasWon ? 100 : 60}%;background:${d.hasWon ? 'var(--green)' : 'var(--red)'}">
          ${d.hasWon ? `Won ${d.lastWin}` : 'Still waiting...'}
        </div>
      </div>
      <div class="champ-bar-count" style="color:${d.hasWon ? 'var(--green)' : 'var(--text3)'}">
        ${d.hasWon ? '🏆' : d.drought + 'y'}
      </div>
    </div>`).join('');

  // Championship count
  const champCounts = {};
  champs.forEach(c => { champCounts[c.champion] = (champCounts[c.champion] || 0) + 1; });
  const sorted = Object.entries(champCounts).sort((a, b) => b[1] - a[1]);

  document.getElementById('champ-count').innerHTML = sorted.length
    ? sorted.map(([team, count]) => `
      <div class="champ-bar">
        <div class="champ-bar-team">${teamAvatarHtml(team, 22)} ${team}</div>
        <div class="champ-bar-track">
          <div class="champ-bar-fill" style="width:${count * 50}%;background:var(--accent)">
            ${'🏆'.repeat(count)}
          </div>
        </div>
        <div class="champ-bar-count">${count}</div>
      </div>`).join('')
    : emptyHtml('Season history building...');
}

/* ═══════════════════════════════════════════════
   LEAGUE RECORDS
   ═══════════════════════════════════════════════ */

const CAT_DISPLAY = {
  R: 'Runs', HR: 'Home Runs', RBI: 'RBI', K_bat: 'Batter K',
  SB: 'Stolen Bases', AVG: 'Avg', OPS: 'OPS',
  IP: 'Innings', QS: 'Quality Starts', H: 'Hits Allowed',
  K_pit: 'Pitcher K', ERA: 'ERA', WHIP: 'WHIP', SVH: 'SV+HLD'
};

function renderRecords() {
  const H = APP.history;
  if (!H) return;

  const view = document.getElementById('records-view')?.value || 'single';
  const type = view === 'single' ? H.allTimeRecords?.singleWeek : H.allTimeRecords?.extendedMatchup;
  if (!type) { document.getElementById('records-grid').innerHTML = emptyHtml('Record data loading...'); return; }

  const cats = Object.keys(CAT_DISPLAY);
  const grid = document.getElementById('records-grid');

  grid.innerHTML = cats.map(cat => {
    const best = type.best?.[cat];
    const worst = type.worst?.[cat];
    const label = CAT_DISPLAY[cat];
    const lowerBetter = ['ERA', 'WHIP', 'H'].includes(cat);

    if (!best && !worst) return '';

    return `
      <div class="record-cat-card">
        <div class="record-cat-header">
          <span>${label}</span>
          ${lowerBetter ? `<span style="font-size:11px;color:var(--text3);font-family:var(--mono)">lower=better</span>` : ''}
        </div>
        ${best ? `
        <div class="record-row">
          <span class="record-value best-badge" style="color:var(--green)">✅ ${best.value}</span>
          <span class="record-team">${best.team}</span>
          <span class="record-meta">Wk ${best.week} · ${best.year}</span>
        </div>` : ''}
        ${worst ? `
        <div class="record-row">
          <span class="record-value worst-badge" style="color:var(--red)">❌ ${worst.value}</span>
          <span class="record-team">${worst.team}</span>
          <span class="record-meta">Wk ${worst.week} · ${worst.year}</span>
        </div>` : ''}
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════
   HEAD TO HEAD
   ═══════════════════════════════════════════════ */

function renderH2H() {
  const H = APP.history;
  const D = APP.data;
  if (!H || !D) return;

  const teamNames = Object.keys(H.allTimeStandings || {});
  if (!teamNames.length) { document.getElementById('h2h-container').innerHTML = emptyHtml('H2H data will populate as seasons complete.'); return; }

  // For now, show what we know — can be expanded with full schedule data
  // Build from weekly scores if available
  const h2hMatrix = buildH2HFromWeekly(H);

  const container = document.getElementById('h2h-container');

  if (!Object.keys(h2hMatrix).length) {
    container.innerHTML = `
      <div class="card">
        <div class="card-body">
          <p style="color:var(--text3);font-size:13px;margin-bottom:12px">Head-to-head records require full matchup data. As each season's schedule data is added, this will populate automatically.</p>
          <p style="font-size:12px;color:var(--text3)">Currently tracking: 2024 and 2025 season outcomes. Export your matchup history from Fantrax → Other → Matchups to add H2H data.</p>
        </div>
      </div>`;
    return;
  }

  // Render matrix
  const html = `<div class="h2h-table tbl-wrap"><table>
    <thead><tr>
      <th>Team</th>
      ${teamNames.map(t => `<th class="tc h2h-label" title="${t}">${ini(t)}</th>`).join('')}
      <th class="tc">Total W</th>
      <th class="tc">Total L</th>
    </tr></thead>
    <tbody>
      ${teamNames.map(team => {
        const row = h2hMatrix[team] || {};
        const totalW = teamNames.reduce((s, opp) => s + (row[opp]?.w || 0), 0);
        const totalL = teamNames.reduce((s, opp) => s + (row[opp]?.l || 0), 0);
        return `<tr>
          <td><div class="team-cell">${teamAvatarHtml(team, 22)} <span style="font-size:12px">${team}</span></div></td>
          ${teamNames.map(opp => {
            if (opp === team) return `<td class="h2h-cell" style="background:rgba(255,255,255,.04)">—</td>`;
            const rec = row[opp];
            if (!rec) return `<td class="h2h-cell" style="color:var(--text3)">—</td>`;
            return `<td class="h2h-cell">
              <span class="h2h-win">${rec.w}</span>-<span class="h2h-loss">${rec.l}</span>
            </td>`;
          }).join('')}
          <td class="h2h-cell h2h-win">${totalW}</td>
          <td class="h2h-cell h2h-loss">${totalL}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;

  container.innerHTML = html;
}

function buildH2HFromWeekly(H) {
  // Placeholder — will be populated when full schedule data available
  return {};
}

/* ═══════════════════════════════════════════════
   LUCK INDEX / STRENGTH OF SCHEDULE
   ═══════════════════════════════════════════════ */

function renderLuck() {
  const H = APP.history;
  if (!H) return;

  const year = document.getElementById('luck-year')?.value || '2025';
  const weekly = H.weeklyScores?.[year];
  const standings = H.seasons?.[year]?.standings || [];

  if (!weekly || !standings.length) {
    document.getElementById('luck-container').innerHTML = emptyHtml(`Full schedule data needed for ${year} luck calculations.`);
    return;
  }

  // Calculate "expected W-L" based on how each team would fare against every other team each week
  const teamNames = standings.map(s => s.team);
  const weeklyPts = {}; // teamName -> [pts per week]

  Object.entries(weekly).forEach(([wk, rows]) => {
    rows.forEach(row => {
      if (!weeklyPts[row.team]) weeklyPts[row.team] = [];
      weeklyPts[row.team].push(row.Pts || 0);
    });
  });

  const luckData = standings.map(s => {
    const actual = { w: s.w || 0, l: s.l || 0, t: s.t || 0 };
    const pct = actual.w / Math.max(1, actual.w + actual.l + actual.t);
    const atRec = getTeamAllTimeRecord(s.team);
    return {
      team: s.team,
      actualRank: s.rank,
      actualPct: pct,
      pts: weeklyPts[s.team] || [],
    };
  });

  // Simple luck metric: if actual rank > 6 and avg pts is top half, they're unlucky
  const avgPtsAll = luckData.map(d => d.pts.reduce((s, p) => s + p, 0) / Math.max(1, d.pts.length));
  const medianPts = [...avgPtsAll].sort((a, b) => a - b)[Math.floor(avgPtsAll.length / 2)];

  const luckScored = luckData.map((d, i) => {
    const avgPts = avgPtsAll[i];
    // Luck score: positive = lucky (ranked higher than scoring suggests), negative = unlucky
    const ptRank = avgPtsAll.filter(p => p > avgPts).length + 1;
    const luckDelta = d.actualRank - ptRank; // positive = lucky (ranked better than pts suggest)
    return { ...d, avgPts, ptRank, luckDelta,
      luckLabel: luckDelta > 2 ? '🍀 Lucky' : luckDelta < -2 ? '😤 Unlucky' : '⚖️ Fair',
      luckColor: luckDelta > 2 ? 'var(--green)' : luckDelta < -2 ? 'var(--red)' : 'var(--text3)'
    };
  }).sort((a, b) => a.luckDelta - b.luckDelta); // most unlucky first

  document.getElementById('luck-container').innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div>Luck Index — ${year}</div></div>
      <div class="card-body">
        <p style="font-size:12px;color:var(--text3);margin-bottom:14px">
          Compares actual record rank vs expected rank based on total points scored.
          Teams above the line got lucky; teams below were unlucky.
        </p>
        <div class="luck-bar-wrap">
          ${luckScored.map((d, i) => `
            <div class="luck-row">
              <div class="luck-rank">${d.actualRank}</div>
              <div class="luck-team">
                ${teamAvatarHtml(d.team, 22)}
                <span style="font-size:13px;font-weight:500;margin-left:6px">${d.team}</span>
              </div>
              <div style="flex:1;font-size:12px;color:${d.luckColor};text-align:center">${d.luckLabel}</div>
              <div style="font-size:11px;color:var(--text3);text-align:right;min-width:100px">
                Actual #${d.actualRank} · Pts rank #${d.ptRank}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════
   ALL-TIME STATS
   ═══════════════════════════════════════════════ */

function renderStats() {
  const H = APP.history;
  if (!H) return;

  const year = document.getElementById('stats-year')?.value || '2025';
  const totals = H.seasonTotals?.[year];

  if (!totals || !Object.keys(totals).length) {
    document.getElementById('stats-container').innerHTML = emptyHtml(`No stats data for ${year}.`);
    return;
  }

  const cats = [
    { key: 'R', label: 'R', low: false },
    { key: 'HR', label: 'HR', low: false },
    { key: 'RBI', label: 'RBI', low: false },
    { key: 'SB', label: 'SB', low: false },
    { key: 'AVG', label: 'AVG', low: false },
    { key: 'OPS', label: 'OPS', low: false },
    { key: 'SO_bat', label: 'K (bat)', low: true },
    { key: 'QS', label: 'QS', low: false },
    { key: 'H_allowed', label: 'H (allowed)', low: true },
    { key: 'ERA', label: 'ERA', low: true },
    { key: 'WHIP', label: 'WHIP', low: true },
    { key: 'K', label: 'K (pit)', low: false },
    { key: 'SVH', label: 'SV+HLD', low: false },
  ];

  const teams = Object.keys(totals);

  document.getElementById('stats-container').innerHTML = `
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Team</th>
            ${cats.map(c => `<th class="tc">${c.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${teams.sort().map(team => {
            const d = totals[team];
            return `<tr>
              <td>
                <div class="team-cell">
                  ${teamAvatarHtml(team, 22)}
                  <div>
                    <div class="team-name">${team}</div>
                  </div>
                </div>
              </td>
              ${cats.map(c => {
                const val = d[c.key];
                if (val === undefined || val === null) return `<td class="tc" style="color:var(--text3)">—</td>`;
                const fmt = typeof val === 'number' && val < 1 && val > 0 ? val.toFixed(3) : (typeof val === 'number' ? val.toLocaleString() : val);
                // Rank this value
                const vals = teams.map(t => totals[t]?.[c.key]).filter(v => v !== undefined && v !== null);
                const rank = c.low
                  ? vals.filter(v => v < val).length + 1
                  : vals.filter(v => v > val).length + 1;
                const color = rank === 1 ? 'var(--green)' : rank <= 3 ? 'var(--accent)' : rank >= teams.length - 1 ? 'var(--red)' : 'var(--text)';
                return `<td class="tc" style="color:${color};font-family:var(--mono);font-size:12px">${fmt}</td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ═══════════════════════════════════════════════
   OUTLIERS
   ═══════════════════════════════════════════════ */

function renderOutliers() {
  const H = APP.history;
  if (!H) return;

  // Build top weeks from all weekly data
  const allWeeks = [];
  Object.entries(H.weeklyScores || {}).forEach(([yr, weeks]) => {
    Object.entries(weeks).forEach(([wk, rows]) => {
      rows.forEach(row => {
        allWeeks.push({ ...row, year: yr, week: wk });
      });
    });
  });

  if (!allWeeks.length) {
    document.getElementById('outliers-container').innerHTML = emptyHtml('Outlier data loading...');
    return;
  }

  const metrics = [
    { key: 'Pts', label: 'Total Points', low: false },
    { key: 'R', label: 'Runs', low: false },
    { key: 'HR', label: 'Home Runs', low: false },
    { key: 'RBI', label: 'RBI', low: false },
    { key: 'K', label: 'Pitcher K', low: false },
    { key: 'ERA', label: 'ERA', low: true },
    { key: 'WHIP', label: 'WHIP', low: true },
    { key: 'SVH', label: 'SV+HLD', low: false },
  ];

  const container = document.getElementById('outliers-container');

  const bestHtml = metrics.map(m => {
    const sorted = [...allWeeks].filter(w => w[m.key] > 0)
      .sort((a, b) => m.low ? a[m.key] - b[m.key] : b[m.key] - a[m.key]);
    const top5 = sorted.slice(0, 5);

    return `
      <div class="outlier-card">
        <div class="outlier-title">${m.label} — ${m.low ? 'Best (Lowest)' : 'Best (Highest)'}</div>
        ${top5.map((w, i) => `
          <div class="outlier-row">
            <div class="outlier-rank" style="color:${i === 0 ? 'var(--accent)' : 'var(--text3)'}">${i + 1}</div>
            <div class="outlier-team">${teamAvatarHtml(w.team, 20)} ${w.team}</div>
            <div class="outlier-val" style="color:${i === 0 ? 'var(--green)' : 'var(--text2)'}">${typeof w[m.key] === 'number' && w[m.key] < 10 ? w[m.key].toFixed(2) : w[m.key]}</div>
            <div class="outlier-meta">Wk ${w.week} · ${w.year}</div>
          </div>`).join('')}
      </div>`;
  }).join('');

  const worstHtml = metrics.map(m => {
    const sorted = [...allWeeks].filter(w => w[m.key] > 0)
      .sort((a, b) => m.low ? b[m.key] - a[m.key] : a[m.key] - b[m.key]);
    const top5 = sorted.slice(0, 5);

    return `
      <div class="outlier-card">
        <div class="outlier-title">${m.label} — ${m.low ? 'Worst (Highest)' : 'Worst (Lowest)'}</div>
        ${top5.map((w, i) => `
          <div class="outlier-row">
            <div class="outlier-rank" style="color:${i === 0 ? 'var(--red)' : 'var(--text3)'}">${i + 1}</div>
            <div class="outlier-team">${teamAvatarHtml(w.team, 20)} ${w.team}</div>
            <div class="outlier-val" style="color:${i === 0 ? 'var(--red)' : 'var(--text2)'}">${typeof w[m.key] === 'number' && w[m.key] < 10 ? w[m.key].toFixed(2) : w[m.key]}</div>
            <div class="outlier-meta">Wk ${w.week} · ${w.year}</div>
          </div>`).join('')}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-family:var(--display);font-size:20px;letter-spacing:1px;margin-bottom:14px;color:#fff">🏆 Best Weeks Ever</div>
      <div class="record-cat-grid">${bestHtml}</div>
    </div>
    <div>
      <div style="font-family:var(--display);font-size:20px;letter-spacing:1px;margin-bottom:14px;color:#fff">💀 Worst Weeks Ever</div>
      <div class="record-cat-grid">${worstHtml}</div>
    </div>`;
}

/* ═══════════════════════════════════════════════
   CATEGORY KINGS
   ═══════════════════════════════════════════════ */

function renderCatKing() {
  const H = APP.history;
  if (!H) return;

  const container = document.getElementById('catking-container');
  const catKings = H.categoryKings || {};
  const years = Object.keys(catKings).sort().reverse();

  if (!years.length) { container.innerHTML = emptyHtml('Category king data loading...'); return; }

  const catLabels = {
    R: 'Runs', HR: 'Home Runs', RBI: 'RBI', SB: 'Stolen Bases',
    AVG: 'Batting Average', OPS: 'OPS', SO_bat: 'Fewest Strikeouts',
    IP: 'Innings Pitched', QS: 'Quality Starts', H: 'Fewest H Allowed',
    ERA: 'ERA', WHIP: 'WHIP', K_pit: 'Pitcher Strikeouts',
    K: 'Pitcher Strikeouts', SVH: 'Saves+Holds', WHIP_pit: 'WHIP',
  };

  const catEmoji = {
    R: '🏃', HR: '💣', RBI: '🎯', SB: '💨', AVG: '🎨', OPS: '📊',
    SO_bat: '🤫', IP: '⚾', QS: '✅', H: '🛡️', ERA: '👑', WHIP: '🔒',
    K_pit: '🔥', K: '🔥', SVH: '💾'
  };

  let html = '';

  years.forEach(year => {
    const kings = catKings[year];
    const cats = Object.entries(kings).filter(([_, d]) => d && d.team);

    html += `
      <div style="margin-bottom:28px">
        <div style="font-family:var(--display);font-size:22px;letter-spacing:1px;margin-bottom:14px;color:var(--accent)">${year} SEASON</div>
        <div class="record-cat-grid">
          ${cats.map(([cat, d]) => `
            <div class="cat-king-card">
              <div class="cat-king-crown">${catEmoji[cat] || '👑'}</div>
              <div class="cat-king-cat">${cat.replace('_pit','').replace('_bat','')}</div>
              <div>
                <div class="cat-king-team">${d.team}</div>
                <div class="cat-king-owner">${catLabels[cat] || cat}</div>
                <div class="cat-king-val">${typeof d.value === 'number' && d.value < 10 && d.value > 0 ? d.value.toFixed(3) : fmtNum(d.value)}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  });

  // Dynasty cat king summary
  const catKingCounts = {};
  years.forEach(year => {
    Object.values(catKings[year] || {}).forEach(d => {
      if (d?.team) catKingCounts[d.team] = (catKingCounts[d.team] || 0) + 1;
    });
  });

  const sorted = Object.entries(catKingCounts).sort((a, b) => b[1] - a[1]);
  html += `
    <div style="margin-bottom:28px">
      <div style="font-family:var(--display);font-size:22px;letter-spacing:1px;margin-bottom:14px;color:var(--purple)">ALL-TIME CATEGORY KING COUNTS</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Team</th><th class="tc">Categories Led</th></tr></thead>
          <tbody>
            ${sorted.map(([team, count]) => `
              <tr>
                <td><div class="team-cell">${teamAvatarHtml(team)} <span>${team}</span></div></td>
                <td class="tc">
                  <span style="font-family:var(--display);font-size:20px;color:var(--accent)">${count}</span>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  container.innerHTML = html;
}
