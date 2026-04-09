import requests, json, os
from datetime import datetime

# Credentials from environment (GitHub Actions) or fallback to local
EMAIL    = os.environ.get('FANTRAX_EMAIL',    'jacob.g.fox5@gmail.com')
PASSWORD = os.environ.get('FANTRAX_PASSWORD', '..Rubygirl01')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'})
s.post('https://www.fantrax.com/login', data={'email': EMAIL, 'password': PASSWORD})

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

def get(path, params={}):
    params['leagueId'] = LID
    r = s.get(BASE + path, params=params, timeout=20)
    return r.json() if r.status_code == 200 else {}

print('Fetching player names via ADP...')
player_map = {}
for start in range(0, 1600, 100):
    r = s.get(f'{BASE}/fxea/general/getAdp',
              params={'leagueId': LID, 'sport': 'MLB', 'maxResults': '100', 'startIndex': str(start)},
              timeout=20)
    if r.status_code == 200:
        batch = r.json()
        if not isinstance(batch, list) or not batch: break
        for p in batch:
            player_map[p['id']] = p
        if len(batch) < 100: break
print(f'  {len(player_map)} players loaded')

print('Fetching rosters...')
rosters_raw = get('/fxea/general/getTeamRosters')
rosters = {}
for team_id, team_data in rosters_raw.get('rosters', {}).items():
    meta = TEAMS.get(team_id, {})
    players = []
    for item in team_data.get('rosterItems', []):
        pid   = item.get('id', '')
        pinfo = player_map.get(pid, {})
        players.append({
            'id':     pid,
            'name':   pinfo.get('name', f'ID:{pid}'),
            'pos':    item.get('position', '?'),
            'status': item.get('status', '?'),
            'mlbPos': pinfo.get('pos', '?'),
            'adp':    pinfo.get('ADP', 999)
        })
    players.sort(key=lambda p: p['adp'])
    rosters[team_id] = {
        'id':      team_id,
        'name':    meta.get('name', team_id),
        'owner':   meta.get('owner', '?'),
        'players': players
    }

print('Fetching schedule...')
schedule = []
matchup_list = []

# Debug: print raw response from first successful matchup endpoint
_debug_printed = False

# Try multiple endpoints to get the schedule
for endpoint, params in [
    ('/fxea/general/getMatchups', {'season': 2026}),
    ('/fxea/general/getLeagueInfo', {}),
    ('/fxea/general/getSchedule', {'season': 2026}),
]:
    raw = get(endpoint, params)
    if isinstance(raw, list):
        matchup_list = raw
    elif isinstance(raw, dict):
        for key in ['matchupList', 'matchups', 'schedule']:
            val = raw.get(key)
            if isinstance(val, list) and val:
                matchup_list = val
                break
            elif isinstance(val, dict):
                inner = val.get('matchupList', [])
                if inner:
                    matchup_list = inner
                    break
    if matchup_list:
        print(f'  Got {len(matchup_list)} matchups from {endpoint}')
        if not _debug_printed and matchup_list:
            print(f'  DEBUG first matchup keys: {list(matchup_list[0].keys()) if isinstance(matchup_list[0], dict) else matchup_list[0]}')
            _debug_printed = True
        break

for m in matchup_list:
    if not isinstance(m, dict): continue
    period = m.get('period', m.get('scoringPeriod', m.get('week', 0)))
    wk = next((w for w in schedule if w['period'] == period), None)
    if not wk:
        wk = {'period': period, 'matchupList': []}
        schedule.append(wk)
    away_id  = m.get('awayTeamId', m.get('away', {}).get('id', '') if isinstance(m.get('away'), dict) else '')
    home_id  = m.get('homeTeamId', m.get('home', {}).get('id', '') if isinstance(m.get('home'), dict) else '')
    away_meta = TEAMS.get(away_id, {})
    home_meta  = TEAMS.get(home_id, {})
    away_score = m.get('awayScore', m.get('awayPoints', m.get('awayCatWins', None)))
    home_score = m.get('homeScore', m.get('homePoints', m.get('homeCatWins', None)))
    wk['matchupList'].append({
        'away': {'id': away_id, 'name': away_meta.get('name', away_id), 'shortName': away_meta.get('owner', '?')},
        'home': {'id': home_id, 'name': home_meta.get('name', home_id), 'shortName': home_meta.get('owner', '?')},
        'awayScore': away_score,
        'homeScore': home_score,
    })
schedule.sort(key=lambda w: w['period'])
print(f'  Schedule: {len(schedule)} weeks built')

# ── SCORES: hit the scoreboard endpoint for each period that exists ──
print('Fetching scores from scoreboard...')
scores_found = 0
for wk in schedule:
    period = wk['period']
    # Fantrax scoreboard endpoint — returns category wins per team per period
    for score_endpoint, score_params in [
        ('/fxea/general/getScoreboard', {'period': period, 'season': 2026}),
        ('/fxea/general/getMatchupResults', {'period': period, 'season': 2026}),
        ('/fxea/general/getTeamMatchupInfo', {'period': period, 'season': 2026}),
    ]:
        raw = get(score_endpoint, score_params)
        if not raw:
            continue
        # Fantrax scoreboard typically returns a list of matchup objects or a dict with matchupList
        rows = []
        if isinstance(raw, list):
            rows = raw
        elif isinstance(raw, dict):
            for k in ['matchupList', 'matchups', 'scoreboard', 'results']:
                v = raw.get(k)
                if isinstance(v, list) and v:
                    rows = v
                    break
        if not rows:
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            # Try to identify away/home team ids
            away_id = (row.get('awayTeamId') or
                       (row.get('away', {}).get('id') if isinstance(row.get('away'), dict) else None))
            home_id = (row.get('homeTeamId') or
                       (row.get('home', {}).get('id') if isinstance(row.get('home'), dict) else None))
            if not away_id or not home_id:
                continue
            # Score could be category wins or total points — grab whichever is available
            away_score = (row.get('awayScore') or row.get('awayPoints') or
                          row.get('awayCatWins') or
                          (row.get('away', {}).get('score') if isinstance(row.get('away'), dict) else None) or
                          (row.get('away', {}).get('catWins') if isinstance(row.get('away'), dict) else None))
            home_score = (row.get('homeScore') or row.get('homePoints') or
                          row.get('homeCatWins') or
                          (row.get('home', {}).get('score') if isinstance(row.get('home'), dict) else None) or
                          (row.get('home', {}).get('catWins') if isinstance(row.get('home'), dict) else None))
            if away_score is None and home_score is None:
                continue
            # Find matching matchup in this week and update scores
            for m in wk['matchupList']:
                if m['away']['id'] == away_id and m['home']['id'] == home_id:
                    m['awayScore'] = away_score
                    m['homeScore'] = home_score
                    scores_found += 1
                    break
        if scores_found > 0:
            print(f'  Period {period}: scores found via {score_endpoint}')
            break  # Got what we need for this period

print(f'  Total scores filled: {scores_found}')

print('Fetching standings...')
standings_raw = get('/fxea/general/getStandings')
standings = []
# API can return a dict with 'standings' key, or a list directly
if isinstance(standings_raw, list):
    rows = standings_raw
elif isinstance(standings_raw, dict):
    rows = standings_raw.get('standings', [])
    if isinstance(rows, dict):
        rows = list(rows.values())
else:
    rows = []
for row in rows:
    if not isinstance(row, dict): continue
    # Try multiple field name formats that Fantrax API might use
    record = row.get('record') or row.get('points') or '0-0-0'
    w = row.get('wins') or row.get('w') or 0
    l = row.get('losses') or row.get('l') or 0
    t = row.get('ties') or row.get('t') or 0
    # If record string provided, parse it
    if isinstance(record, str) and '-' in record:
        parts = record.split('-')
        if len(parts) >= 2:
            try:
                w = int(parts[0])
                l = int(parts[1])
                t = int(parts[2]) if len(parts) > 2 else 0
            except: pass
    standings.append({
        'teamId':        row.get('teamId', ''),
        'teamName':      row.get('teamName', ''),
        'points':        f'{w}-{l}-{t}',
        'wins':          w,
        'losses':        l,
        'ties':          t,
        'winPercentage': row.get('winPercentage', 0),
        'gamesBack':     row.get('gamesBack', 0),
        'streak':        row.get('streak', ''),
    })

print('Fetching past seasons...')
past = {}
for season in ['2022', '2023', '2024']:
    r = get('/fxea/general/getStandings', {'season': season})
    if isinstance(r, list):
        past[season] = r
    elif isinstance(r, dict):
        val = r.get('standings', [])
        past[season] = list(val.values()) if isinstance(val, dict) else val
    else:
        past[season] = []

# Build player map for waiver wire
player_map_out = {}
for pid, p in player_map.items():
    player_map_out[pid] = {
        'name': p.get('name', ''),
        'pos':  p.get('pos', '?'),
        'adp':  p.get('ADP', 999),
    }

named = sum(1 for p in player_map_out.values() if p['name'] and not p['name'].startswith('ID:'))

# Output path:
# - GitHub Actions: runs from repo root -> save to data.json (repo root)
# - Local Mac:      save to ~/the108fbo/public/data.json
if os.path.isdir('.git') or not os.path.exists(os.path.expanduser('~/the108fbo/public')):
    out_path = 'data.json'
else:
    out_path = os.path.expanduser('~/the108fbo/public/data.json')

data = {
    'meta': {
        'season':      2026,
        'updatedDate': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'leagueId':    LID,
    },
    'rosters':      rosters,
    'schedule':     schedule,
    'standings':    standings,
    'leagueHistory': past,
    'playerMap':    player_map_out,
    'teams': {tid: {'owner': meta['owner']} for tid, meta in TEAMS.items()},
}

with open(out_path, 'w') as f:
    json.dump(data, f)

print(f'\n✅ Done! {named}/{len(player_map_out)} players named')
print(f'📁 Saved to {out_path}')
print(f'📅 Schedule: {len(schedule)} weeks')
