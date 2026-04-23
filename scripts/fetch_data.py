import requests, json, os, sys
from datetime import datetime

# ── CREDENTIALS ─────────────────────────────────────────────────────────────
EMAIL    = os.environ.get('FANTRAX_EMAIL',    'jacob.g.fox5@gmail.com')
PASSWORD = os.environ.get('FANTRAX_PASSWORD', '..Rubygirl01')

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

# ── SESSION SETUP ────────────────────────────────────────────────────────────
s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://www.fantrax.com',
    'Referer': 'https://www.fantrax.com/',
})

# ── LOGIN ────────────────────────────────────────────────────────────────────
# Fantrax API login — JSON POST to /fxea/general/login (NOT the HTML /login page)
print('Logging in to Fantrax...')
try:
    login_r = s.post(
        f'{BASE}/fxea/general/login',
        json={'login': EMAIL, 'password': PASSWORD},
        timeout=30
    )
    print(f'  Login status: {login_r.status_code}')
    if login_r.status_code == 200:
        body = login_r.json()
        # Fantrax returns {"status": "success"} or {"status": "error", "msg": "..."}
        if body.get('status') == 'success' or 'token' in body or body.get('userId'):
            print('  ✅ Logged in successfully')
        else:
            print(f'  ⚠️  Login response: {body}')
    else:
        print(f'  ❌ Login failed — HTTP {login_r.status_code}')
        print(f'  Response: {login_r.text[:300]}')
        sys.exit(1)
except Exception as e:
    print(f'  ❌ Login exception: {e}')
    sys.exit(1)

# ── HELPERS ──────────────────────────────────────────────────────────────────
def get(path, params=None, label=''):
    if params is None:
        params = {}
    params['leagueId'] = LID
    try:
        r = s.get(BASE + path, params=params, timeout=30)
        if r.status_code == 200:
            try:
                return r.json()
            except Exception:
                print(f'  ⚠️  {label or path}: non-JSON response ({len(r.text)} chars)')
                return {}
        else:
            print(f'  ⚠️  {label or path}: HTTP {r.status_code}')
            return {}
    except Exception as e:
        print(f'  ⚠️  {label or path} exception: {e}')
        return {}

def post_api(path, payload, label=''):
    payload['leagueId'] = LID
    try:
        r = s.post(BASE + path, json=payload, timeout=30)
        if r.status_code == 200:
            try:
                return r.json()
            except Exception:
                return {}
        return {}
    except Exception as e:
        print(f'  ⚠️  {label or path} exception: {e}')
        return {}

# ── PLAYER MAP (ADP) ─────────────────────────────────────────────────────────
print('Fetching player ADP...')
player_map = {}
for start in range(0, 1600, 100):
    try:
        r = s.get(f'{BASE}/fxea/general/getAdp',
                  params={'leagueId': LID, 'sport': 'MLB',
                          'maxResults': '100', 'startIndex': str(start)},
                  timeout=30)
        if r.status_code != 200:
            break
        batch = r.json()
        if not isinstance(batch, list) or not batch:
            break
        for p in batch:
            if isinstance(p, dict) and p.get('id'):
                player_map[p['id']] = p
        if len(batch) < 100:
            break
    except Exception as e:
        print(f'  ADP batch {start} error: {e}')
        break
print(f'  {len(player_map)} players loaded')

# ── ROSTERS ──────────────────────────────────────────────────────────────────
print('Fetching rosters...')
rosters_raw = get('/fxea/general/getTeamRosters', label='rosters')
rosters = {}

roster_data = rosters_raw.get('rosters', {})
if not roster_data:
    # Sometimes returns under different key
    roster_data = rosters_raw.get('teamRosters', {})

if roster_data:
    print(f'  Got roster data for {len(roster_data)} teams')
else:
    print(f'  ⚠️  No roster data — raw keys: {list(rosters_raw.keys())[:10]}')

for team_id, team_data in roster_data.items():
    meta = TEAMS.get(team_id, {})
    players = []
    items = team_data.get('rosterItems', team_data.get('players', []))
    for item in items:
        if not isinstance(item, dict):
            continue
        pid   = item.get('id', item.get('playerId', ''))
        pinfo = player_map.get(pid, {})
        players.append({
            'id':     pid,
            'name':   pinfo.get('name', item.get('name', f'ID:{pid}')),
            'pos':    item.get('position', item.get('pos', '?')),
            'status': item.get('status', item.get('statusId', '?')),
            'mlbPos': pinfo.get('pos', item.get('primaryPosition', '?')),
            'adp':    pinfo.get('ADP', pinfo.get('adp', 999))
        })
    players.sort(key=lambda p: p['adp'])
    rosters[team_id] = {
        'id':      team_id,
        'name':    meta.get('name', team_data.get('name', team_id)),
        'owner':   meta.get('owner', '?'),
        'players': players
    }

# Fill in any teams missing from the API response with empty rosters
for tid, meta in TEAMS.items():
    if tid not in rosters:
        rosters[tid] = {'id': tid, 'name': meta['name'], 'owner': meta['owner'], 'players': []}

# ── SCHEDULE & SCORES ────────────────────────────────────────────────────────
print('Fetching schedule & scores...')
schedule = []

# The most reliable Fantrax endpoint for H2H matchup scores is getScoreboard.
# It returns one period at a time; we loop scoring periods 1-26.
# getLeagueInfo often has the schedule structure we can use to find valid periods.

# Step 1: get league info to find total periods / current period
league_info = get('/fxea/general/getLeagueInfo', label='leagueInfo')
total_periods = 26  # default full season
current_period = None

if league_info:
    print(f'  League info keys: {list(league_info.keys())[:15]}')
    # Try to find scoring period info
    for key in ['currentScoringPeriod', 'currentPeriod', 'scoringPeriod', 'period']:
        if league_info.get(key):
            current_period = league_info[key]
            break
    for key in ['totalScoringPeriods', 'numPeriods', 'totalPeriods']:
        if league_info.get(key):
            total_periods = int(league_info[key])
            break
    print(f'  Current period: {current_period}, Total: {total_periods}')

# Step 2: pull scoreboard for each period (stop when we hit empty results)
scores_found = 0
empty_streak = 0

for period in range(1, total_periods + 1):
    period_matchups = []

    # Try scoreboard endpoints in order
    for ep, params in [
        ('/fxea/general/getScoreboard',    {'scoringPeriod': period, 'timeframeType': 'BY_PERIOD'}),
        ('/fxea/general/getScoreboard',    {'period': period, 'season': 2026}),
        ('/fxea/general/getMatchupResults',{'period': period, 'season': 2026}),
        ('/fxea/general/getMatchups',      {'period': period, 'season': 2026}),
    ]:
        raw = get(ep, params, label=f'period-{period}')
        if not raw:
            continue

        # Extract list of matchup rows
        rows = []
        if isinstance(raw, list):
            rows = raw
        elif isinstance(raw, dict):
            for key in ['matchupList', 'matchups', 'scoreboard', 'results', 'data']:
                v = raw.get(key)
                if isinstance(v, list) and v:
                    rows = v
                    break

        if not rows:
            continue

        # Parse each matchup row
        for row in rows:
            if not isinstance(row, dict):
                continue

            # Find team IDs
            away_id = (row.get('awayTeamId') or row.get('team1Id') or
                       (row.get('away', {}).get('id') if isinstance(row.get('away'), dict) else None))
            home_id = (row.get('homeTeamId') or row.get('team2Id') or
                       (row.get('home', {}).get('id') if isinstance(row.get('home'), dict) else None))

            if not away_id and not home_id:
                # Try team-keyed format
                teams_in_row = [k for k in row if k in TEAMS]
                if len(teams_in_row) == 2:
                    away_id, home_id = teams_in_row[0], teams_in_row[1]

            if not away_id or not home_id:
                continue

            away_meta = TEAMS.get(away_id, {})
            home_meta  = TEAMS.get(home_id, {})

            # Score — could be category wins or points
            def _score(row, keys):
                for k in keys:
                    v = row.get(k)
                    if v is not None:
                        return v
                return None

            away_score = _score(row, ['awayScore','awayPoints','awayCatWins','team1Score','team1CatWins']) or \
                         (row.get('away', {}).get('score') if isinstance(row.get('away'), dict) else None) or \
                         (row.get('away', {}).get('catWins') if isinstance(row.get('away'), dict) else None)
            home_score = _score(row, ['homeScore','homePoints','homeCatWins','team2Score','team2CatWins']) or \
                         (row.get('home', {}).get('score') if isinstance(row.get('home'), dict) else None) or \
                         (row.get('home', {}).get('catWins') if isinstance(row.get('home'), dict) else None)

            period_matchups.append({
                'away': {
                    'id':        away_id,
                    'name':      away_meta.get('name', away_id),
                    'shortName': away_meta.get('owner', '?'),
                },
                'home': {
                    'id':        home_id,
                    'name':      home_meta.get('name', home_id),
                    'shortName': home_meta.get('owner', '?'),
                },
                'awayScore': away_score,
                'homeScore': home_score,
            })
            if away_score is not None or home_score is not None:
                scores_found += 1

        if period_matchups:
            print(f'  Period {period}: {len(period_matchups)} matchups via {ep}')
            break  # got what we need for this period

    if period_matchups:
        schedule.append({'period': period, 'matchupList': period_matchups})
        empty_streak = 0
    else:
        empty_streak += 1
        if empty_streak >= 4 and period > 3:
            # 4 consecutive empty periods past week 3 = we've hit the end of available data
            break

print(f'  Schedule: {len(schedule)} weeks, {scores_found} scores found')

# ── STANDINGS ────────────────────────────────────────────────────────────────
print('Fetching standings...')
standings = []

for ep, params in [
    ('/fxea/general/getStandings', {'season': 2026}),
    ('/fxea/general/getStandings', {}),
]:
    raw = get(ep, params, label='standings')
    if not raw:
        continue

    rows = []
    if isinstance(raw, list):
        rows = raw
    elif isinstance(raw, dict):
        for key in ['standings', 'teams', 'data']:
            v = raw.get(key)
            if isinstance(v, list) and v:
                rows = v
                break
            elif isinstance(v, dict) and v:
                rows = list(v.values())
                break

    if rows:
        print(f'  Got {len(rows)} standing rows via {ep}')
        print(f'  Sample row keys: {list(rows[0].keys())[:12] if rows else []}')
        break

for row in rows:
    if not isinstance(row, dict):
        continue
    # Parse W-L-T — Fantrax returns either a "record" string or separate fields
    w = l = t = 0
    record_str = row.get('record', row.get('wlt', ''))
    if isinstance(record_str, str) and '-' in record_str:
        parts = record_str.split('-')
        try:
            w = int(parts[0]); l = int(parts[1])
            t = int(parts[2]) if len(parts) > 2 else 0
        except (ValueError, IndexError):
            pass
    else:
        w = int(row.get('wins', row.get('w', 0)) or 0)
        l = int(row.get('losses', row.get('l', 0)) or 0)
        t = int(row.get('ties', row.get('t', 0)) or 0)

    total = w + l + t
    pct = round(w / total, 4) if total else 0.0

    standings.append({
        'teamId':        row.get('teamId', row.get('id', '')),
        'teamName':      row.get('teamName', row.get('name', '')),
        'points':        f'{w}-{l}-{t}',
        'wins':          w,
        'losses':        l,
        'ties':          t,
        'winPercentage': row.get('winPercentage', row.get('pct', pct)),
        'gamesBack':     row.get('gamesBack', row.get('gb', 0)),
        'streak':        row.get('streak', ''),
    })

# Sort standings by wins desc
standings.sort(key=lambda r: (-r['wins'], r['losses']))
print(f'  {len(standings)} teams in standings')

# ── HISTORICAL SEASONS ───────────────────────────────────────────────────────
print('Fetching past seasons...')
past = {}
for season in ['2022', '2023', '2024', '2025']:
    raw = get('/fxea/general/getStandings', {'season': season}, label=f'standings-{season}')
    if isinstance(raw, list):
        past[season] = raw
    elif isinstance(raw, dict):
        val = raw.get('standings', raw.get('teams', []))
        past[season] = list(val.values()) if isinstance(val, dict) else (val or [])
    else:
        past[season] = []
    print(f'  {season}: {len(past[season])} rows')

# ── PLAYER MAP OUTPUT ────────────────────────────────────────────────────────
player_map_out = {}
for pid, p in player_map.items():
    player_map_out[pid] = {
        'name': p.get('name', ''),
        'pos':  p.get('pos', p.get('primaryPosition', '?')),
        'adp':  p.get('ADP', p.get('adp', 999)),
    }

named = sum(1 for p in player_map_out.values()
            if p['name'] and not p['name'].startswith('ID:'))

# ── OUTPUT PATH ──────────────────────────────────────────────────────────────
if os.path.isdir('.git') or not os.path.exists(os.path.expanduser('~/the108fbo/public')):
    out_path = 'data.json'
else:
    out_path = os.path.expanduser('~/the108fbo/public/data.json')

# ── WRITE OUTPUT ─────────────────────────────────────────────────────────────
data = {
    'meta': {
        'season':      2026,
        'updatedDate': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'leagueId':    LID,
    },
    'rosters':       rosters,
    'schedule':      schedule,
    'standings':     standings,
    'leagueHistory': past,
    'playerMap':     player_map_out,
    'teams':         {tid: {'owner': meta['owner']} for tid, meta in TEAMS.items()},
}

with open(out_path, 'w') as f:
    json.dump(data, f)

print(f'\n✅  Done!')
print(f'📁  Saved to {out_path}')
print(f'👥  {len(rosters)} rosters · {named}/{len(player_map_out)} players named')
print(f'📅  {len(schedule)} weeks in schedule')
print(f'📊  {len(standings)} teams in standings')
