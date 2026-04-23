import requests, json, os
from datetime import datetime

LID  = 'ai1iqnl9mg6kvw0f'
BASE = 'https://www.fantrax.com'

TEAMS = {
  'f104x6bcmg6kvw0j': {'name': 'Alaskan Blue Balls',           'owner': 'John'},
  'tjfokirzmg6kvw0p': {'name': 'Salt Lake City Sluggers',      'owner': 'Justyn'},
  '03r0gd0cmg6kvw0n': {'name': 'Saravejo Archdukes',           'owner': 'Eli'},
  'eh4rqjtxmg6kvw0q': {'name': 'Georgia Peaches',              'owner': 'Marsh'},
  'aczjpk0vmg6kvw0h': {'name': 'Albuquerque Predators',        'owner': 'Aidan'},
  'mztw702mmg6kvw0o': {'name': "Anaheim Arte's",               'owner': 'Brandon'},
  'h4bf9q45mg6kvw0i': {'name': 'San Diego Dysons',             'owner': 'Dylan'},
  'u17dw9tcmg6kvw0k': {'name': 'Athens Amish Mafia',           'owner': 'Will'},
  'plfepg6rmg6kvw0l': {'name': 'Virginia Beach VelociRaptors', 'owner': 'Chris'},
  'tbwrxqepmg6kvw0l': {'name': 'Rockwall Rhinos',              'owner': 'Jacob'},
  'finic8ommg6kvw0m': {'name': 'Marco Island Mermaids',        'owner': 'Brad'},
  's66x2h9nmg6kvw0o': {'name': 'Florida Easy Money',          'owner': 'Aaron'},
}

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'})

def get(path, params=None):
    if params is None: params = {}
    params['leagueId'] = LID
    try:
        r = s.get(BASE + path, params=params, timeout=30)
        if r.status_code == 200:
            try: return r.json()
            except: pass
        print(f'  ⚠️  {path}: HTTP {r.status_code}')
        return {}
    except Exception as e:
        print(f'  ⚠️  {path}: {e}'); return {}

# ── PLAYER ADP ────────────────────────────────────
print('Fetching player ADP...')
player_map = {}
for start in range(0, 1600, 100):
    try:
        r = s.get(f'{BASE}/fxea/general/getAdp',
                  params={'leagueId': LID, 'sport': 'MLB', 'maxResults': '100', 'startIndex': str(start)},
                  timeout=30)
        if r.status_code != 200: break
        batch = r.json()
        if not isinstance(batch, list) or not batch: break
        for p in batch:
            if isinstance(p, dict) and p.get('id'): player_map[p['id']] = p
        if len(batch) < 100: break
    except: break
print(f'  {len(player_map)} players loaded')

# ── ROSTERS ───────────────────────────────────────
print('Fetching rosters...')
rosters_raw = get('/fxea/general/getTeamRosters')
rosters = {}
roster_data = rosters_raw.get('rosters', rosters_raw.get('teamRosters', {}))
print(f'  {len(roster_data)} teams')

for team_id, team_data in roster_data.items():
    meta = TEAMS.get(team_id, {})
    players = []
    for item in team_data.get('rosterItems', team_data.get('players', [])):
        if not isinstance(item, dict): continue
        pid   = item.get('id', item.get('playerId', ''))
        pinfo = player_map.get(pid, {})
        players.append({
            'id': pid,
            'name': pinfo.get('name', item.get('name', f'ID:{pid}')),
            'pos':  item.get('position', item.get('pos', '?')),
            'status': item.get('status', '?'),
            'mlbPos': pinfo.get('pos', '?'),
            'adp': pinfo.get('ADP', 999)
        })
    players.sort(key=lambda p: p['adp'])
    rosters[team_id] = {'id': team_id, 'name': meta.get('name', team_id),
                        'owner': meta.get('owner', '?'), 'players': players}

for tid, meta in TEAMS.items():
    if tid not in rosters:
        rosters[tid] = {'id': tid, 'name': meta['name'], 'owner': meta['owner'], 'players': []}

# ── SCHEDULE & SCORES ─────────────────────────────
print('Fetching schedule & scores...')
schedule = []
league_info = get('/fxea/general/getLeagueInfo')
raw_matchups = league_info.get('matchups', [])
print(f'  {len(raw_matchups)} matchups from leagueInfo')

if raw_matchups:
    print(f'  Sample: {raw_matchups[0]}')
    period_map = {}
    for m in raw_matchups:
        if not isinstance(m, dict): continue
        period = m.get('period', m.get('scoringPeriod', m.get('week', 0)))
        if period not in period_map: period_map[period] = []

        away_id = m.get('awayTeamId', (m.get('away') or {}).get('id', ''))
        home_id = m.get('homeTeamId', (m.get('home') or {}).get('id', ''))

        def _s(row, keys):
            for k in keys:
                v = row.get(k)
                if v is not None: return v
            return None

        away_score = _s(m, ['awayScore','awayPoints','awayCatWins','team1Score'])
        home_score = _s(m, ['homeScore','homePoints','homeCatWins','team2Score'])
        if isinstance(m.get('away'), dict):
            away_score = away_score or m['away'].get('score') or m['away'].get('catWins')
        if isinstance(m.get('home'), dict):
            home_score = home_score or m['home'].get('score') or m['home'].get('catWins')

        period_map[period].append({
            'away': {'id': away_id, 'name': TEAMS.get(away_id, {}).get('name', away_id),
                     'shortName': TEAMS.get(away_id, {}).get('owner', '?')},
            'home': {'id': home_id, 'name': TEAMS.get(home_id, {}).get('name', home_id),
                     'shortName': TEAMS.get(home_id, {}).get('owner', '?')},
            'awayScore': away_score, 'homeScore': home_score,
        })

    for period in sorted(period_map.keys()):
        schedule.append({'period': period, 'matchupList': period_map[period]})

# Fallback: scoreboard per period
if not schedule:
    print('  Trying scoreboard fallback...')
    empty = 0
    for period in range(1, 27):
        found = False
        for ep, params in [
            ('/fxea/general/getScoreboard', {'scoringPeriod': period, 'timeframeType': 'BY_PERIOD'}),
            ('/fxea/general/getScoreboard', {'period': period}),
        ]:
            raw = get(ep, params)
            rows = raw if isinstance(raw, list) else raw.get('matchupList', raw.get('matchups', []))
            if not rows: continue
            pm = []
            for row in rows:
                if not isinstance(row, dict): continue
                aid, hid = row.get('awayTeamId',''), row.get('homeTeamId','')
                if not aid or not hid: continue
                pm.append({
                    'away': {'id': aid, 'name': TEAMS.get(aid,{}).get('name',aid),
                             'shortName': TEAMS.get(aid,{}).get('owner','?')},
                    'home': {'id': hid, 'name': TEAMS.get(hid,{}).get('name',hid),
                             'shortName': TEAMS.get(hid,{}).get('owner','?')},
                    'awayScore': row.get('awayScore'), 'homeScore': row.get('homeScore'),
                })
            if pm:
                schedule.append({'period': period, 'matchupList': pm})
                found = True; empty = 0; break
        if not found:
            empty += 1
            if empty >= 3 and period > 3: break

print(f'  {len(schedule)} weeks in schedule')

# ── STANDINGS ─────────────────────────────────────
print('Fetching standings...')
rows = []
for params in [{'season': 2026}, {}]:
    raw = get('/fxea/general/getStandings', params)
    rows = raw if isinstance(raw, list) else raw.get('standings', raw.get('teams', []))
    if isinstance(rows, dict): rows = list(rows.values())
    if rows:
        print(f'  {len(rows)} rows · keys: {list(rows[0].keys())[:8]}')
        break

standings = []
for row in rows:
    if not isinstance(row, dict): continue
    w = l = t = 0
    pts = row.get('points', row.get('record', ''))
    if isinstance(pts, str) and '-' in pts:
        parts = pts.split('-')
        try: w, l, t = int(parts[0]), int(parts[1]), (int(parts[2]) if len(parts) > 2 else 0)
        except: pass
    else:
        w = int(row.get('wins', 0) or 0)
        l = int(row.get('losses', 0) or 0)
        t = int(row.get('ties', 0) or 0)
    total = w + l + t
    standings.append({
        'teamId': row.get('teamId',''), 'teamName': row.get('teamName',''),
        'points': f'{w}-{l}-{t}', 'wins': w, 'losses': l, 'ties': t,
        'winPercentage': round(w/total, 4) if total else 0.0,
        'gamesBack': row.get('gamesBack', 0), 'streak': row.get('streak',''),
        'rank': row.get('rank', 0),
    })
standings.sort(key=lambda r: (-r['wins'], r['losses']))
print(f'  {len(standings)} teams')

# ── PAST SEASONS ──────────────────────────────────
print('Fetching past seasons...')
past = {}
for season in ['2022', '2023', '2024', '2025']:
    raw = get('/fxea/general/getStandings', {'season': season})
    rows2 = raw if isinstance(raw, list) else raw.get('standings', [])
    if isinstance(rows2, dict): rows2 = list(rows2.values())
    past[season] = rows2
    print(f'  {season}: {len(past[season])} rows')

# ── OUTPUT ────────────────────────────────────────
player_map_out = {pid: {'name': p.get('name',''), 'pos': p.get('pos','?'), 'adp': p.get('ADP', 999)}
                  for pid, p in player_map.items()}
named = sum(1 for p in player_map_out.values() if p['name'] and not p['name'].startswith('ID:'))

out_path = 'data.json' if (os.path.isdir('.git') or not os.path.exists(os.path.expanduser('~/the108fbo/public'))) \
           else os.path.expanduser('~/the108fbo/public/data.json')

with open(out_path, 'w') as f:
    json.dump({
        'meta': {'season': 2026, 'updatedDate': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'), 'leagueId': LID},
        'rosters': rosters, 'schedule': schedule, 'standings': standings,
        'leagueHistory': past, 'playerMap': player_map_out,
        'teams': {tid: {'owner': meta['owner']} for tid, meta in TEAMS.items()},
    }, f)

print(f'\n✅  Done! → {out_path}')
print(f'👥  {len(rosters)} rosters · {named}/{len(player_map_out)} players named')
print(f'📅  {len(schedule)} weeks · 📊 {len(standings)} teams')
