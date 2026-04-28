import json, os, sys
from datetime import datetime, date as _date

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

# ── PART 1: requests-based fetches (public endpoints) ───────────────────────
import requests
s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://www.fantrax.com',
    'Referer': 'https://www.fantrax.com/',
})

def get(path, params=None):
    if params is None: params = {}
    params['leagueId'] = LID
    try:
        r = s.get(BASE + path, params=params, timeout=30)
        if r.status_code == 200:
            try: return r.json()
            except: return {}
        return {}
    except: return {}

# Player ADP
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

# Rosters
print('Fetching rosters...')
rosters_raw = get('/fxea/general/getTeamRosters')
rosters = {}
for team_id, team_data in rosters_raw.get('rosters', {}).items():
    meta = TEAMS.get(team_id, {})
    players = []
    for item in team_data.get('rosterItems', []):
        if not isinstance(item, dict): continue
        pid = item.get('id', '')
        pinfo = player_map.get(pid, {})
        players.append({
            'id': pid,
            'name': pinfo.get('name', f'ID:{pid}'),
            'pos': item.get('position', '?'),
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
print(f'  {len(rosters)} teams')

# Schedule from leagueInfo
print('Fetching schedule...')
league_info = get('/fxea/general/getLeagueInfo')
raw_matchups = league_info.get('matchups', [])
schedule = []
current_period = 5

start_date_str = league_info.get('startDate', '')
if start_date_str:
    try:
        if isinstance(start_date_str, (int, float)):
            from datetime import datetime as _dt
            start = _dt.utcfromtimestamp(int(start_date_str) / 1000).date()
        else:
            start = _date.fromisoformat(str(start_date_str)[:10])
        days_in = (_date.today() - start).days
        current_period = max(1, min(26, (days_in // 7) + 1))
    except: pass

for period_obj in raw_matchups:
    if not isinstance(period_obj, dict): continue
    period = period_obj.get('period', 0)
    period_matchups = []
    for m in period_obj.get('matchupList', []):
        if not isinstance(m, dict): continue
        away = m.get('away', {}); home = m.get('home', {})
        away_id = away.get('id', ''); home_id = home.get('id', '')
        if not away_id or not home_id: continue
        am = TEAMS.get(away_id, {}); hm = TEAMS.get(home_id, {})
        period_matchups.append({
            'away': {'id': away_id, 'name': am.get('name', away.get('name', away_id)),
                     'shortName': am.get('owner', away.get('shortName', '?'))},
            'home': {'id': home_id, 'name': hm.get('name', home.get('name', home_id)),
                     'shortName': hm.get('owner', home.get('shortName', '?'))},
            'awayScore': None, 'homeScore': None, 'categories': {}
        })
    if period_matchups:
        schedule.append({'period': period, 'matchupList': period_matchups})
print(f'  {len(schedule)} weeks built')

# Standings
print('Fetching standings...')
standings = []
rows = []
for params in [{'season': 2026}, {}]:
    raw = get('/fxea/general/getStandings', params)
    rows = raw if isinstance(raw, list) else raw.get('standings', [])
    if isinstance(rows, dict): rows = list(rows.values())
    if rows: break
for row in rows:
    if not isinstance(row, dict): continue
    w = l = t = 0
    pts = row.get('points', '')
    if isinstance(pts, str) and '-' in pts:
        parts = pts.split('-')
        try: w, l, t = int(parts[0]), int(parts[1]), (int(parts[2]) if len(parts) > 2 else 0)
        except: pass
    total = w + l + t
    standings.append({
        'teamId': row.get('teamId', ''), 'teamName': row.get('teamName', ''),
        'points': f'{w}-{l}-{t}', 'wins': w, 'losses': l, 'ties': t,
        'winPercentage': round(w/total, 4) if total else 0.0,
        'gamesBack': row.get('gamesBack', 0), 'streak': row.get('streak', ''),
        'rank': row.get('rank', 0),
    })
standings.sort(key=lambda r: (-r['wins'], r['losses']))
print(f'  {len(standings)} teams')

# Past seasons
print('Fetching past seasons...')
past = {}
for season in ['2022', '2023', '2024', '2025']:
    raw = get('/fxea/general/getStandings', {'season': season})
    rows2 = raw if isinstance(raw, list) else raw.get('standings', [])
    if isinstance(rows2, dict): rows2 = list(rows2.values())
    past[season] = rows2

player_map_out = {pid: {'name': p.get('name',''), 'pos': p.get('pos','?'), 'adp': p.get('ADP', 999)}
                  for pid, p in player_map.items()}
named = sum(1 for p in player_map_out.values() if p['name'] and not p['name'].startswith('ID:'))

# ── PART 2: Playwright headless browser for scores ──────────────────────────
print('Fetching scores via headless browser...')

async def fetch_scores_playwright():
    return []

captured = []

# ── FETCH SCORES: try getTeamStats per period ────
print('Fetching scores...')
scores_filled = 0

for wk in schedule:
    period = wk['period']
    for ep, params in [
        ('/fxea/general/getTeamStats', {'scoringPeriod': period, 'timeframeType': 'BY_PERIOD', 'teamId': 'ALL'}),
        ('/fxea/general/getTeamStats', {'period': period, 'timeframeType': 'BY_PERIOD'}),
        ('/fxea/general/getTeamStats', {'scoringPeriod': period, 'statsType': 'STATS'}),
        ('/fxea/general/getScoreboard', {'scoringPeriod': period, 'timeframeType': 'BY_PERIOD'}),
        ('/fxea/general/getScoreboard', {'period': period}),
    ]:
        raw = get(ep, params)
        if not raw or list(raw.keys()) == ['error']: continue
        # Log what we get for period 4 (known to have scores)
        if period == 4:
            print(f'  Period 4 hit: {ep} → keys: {list(raw.keys())[:10]}')
            print(f'  Sample: {json.dumps(raw)[:400]}')
        rows = raw if isinstance(raw, list) else raw.get(
            'matchupList', raw.get('matchups', raw.get('teamStatsList', raw.get('stats', []))))
        if not rows: continue
        found_any = False
        for row in rows:
            if not isinstance(row, dict): continue
            aid = (row.get('awayTeamId') or (row.get('away') or {}).get('id', ''))
            hid = (row.get('homeTeamId') or (row.get('home') or {}).get('id', ''))
            if not aid or not hid: continue
            for m in wk['matchupList']:
                if m['away']['id'] == aid and m['home']['id'] == hid:
                    away_obj = row.get('away', {}) or {}
                    home_obj = row.get('home', {}) or {}
                    away_s = (row.get('awayScore') or row.get('awayCatWins') or
                              away_obj.get('score') or away_obj.get('catWins'))
                    home_s = (row.get('homeScore') or row.get('homeCatWins') or
                              home_obj.get('score') or home_obj.get('catWins'))
                    if away_s is not None or home_s is not None:
                        m['awayScore'] = away_s
                        m['homeScore'] = home_s
                        scores_filled += 1
                        found_any = True
                    a_stats = away_obj.get('stats') or away_obj.get('categoryStats') or {}
                    h_stats = home_obj.get('stats') or home_obj.get('categoryStats') or {}
                    if a_stats or h_stats:
                        m['categories'] = {k: {'away': a_stats.get(k), 'home': h_stats.get(k)}
                                           for k in set(list(a_stats.keys()) + list(h_stats.keys()))}
                    break
        if found_any:
            break

print(f'  {len(schedule)} weeks · {scores_filled} scores filled')

# ── OUTPUT ───────────────────────────────────────────────────────────────────
out_path = 'data.json' if (os.path.isdir('.git') or not os.path.exists(os.path.expanduser('~/the108fbo/public'))) \
           else os.path.expanduser('~/the108fbo/public/data.json')

with open(out_path, 'w') as f:
    json.dump({
        'meta': {'season': 2026, 'updatedDate': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
                 'leagueId': LID, 'currentPeriod': current_period},
        'rosters': rosters, 'schedule': schedule, 'standings': standings,
        'leagueHistory': past, 'playerMap': player_map_out,
        'teams': {tid: {'owner': meta['owner']} for tid, meta in TEAMS.items()},
    }, f)

print(f'\n✅  Done! → {out_path}')
print(f'👥  {len(rosters)} rosters · {named}/{len(player_map_out)} players named')
print(f'📅  {len(schedule)} weeks · 📊 {len(standings)} teams · 🎯 {scores_filled} scores')
