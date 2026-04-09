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
league_info = get('/fxea/general/getLeagueInfo')
schedule = []
for m in league_info.get('matchupList', []):
    period = m.get('period', 0)
    wk = next((w for w in schedule if w['period'] == period), None)
    if not wk:
        wk = {'period': period, 'matchupList': []}
        schedule.append(wk)
    away_id  = m.get('awayTeamId', '')
    home_id  = m.get('homeTeamId', '')
    away_meta = TEAMS.get(away_id, {})
    home_meta  = TEAMS.get(home_id, {})
    wk['matchupList'].append({
        'away': {'id': away_id, 'name': away_meta.get('name', away_id), 'shortName': away_meta.get('owner', '?')},
        'home': {'id': home_id, 'name': home_meta.get('name', home_id), 'shortName': home_meta.get('owner', '?')},
    })
schedule.sort(key=lambda w: w['period'])

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
        'updatedDate': datetime.now().strftime('%b %d, %Y %I:%M %p'),
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
