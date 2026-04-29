import requests, json, os, pickle, time
from datetime import datetime, date as _date

EMAIL    = os.environ.get('FANTRAX_EMAIL', 'jacob.g.fox5@gmail.com')
PASSWORD = os.environ.get('FANTRAX_PASSWORD', '..Rubygirl01')
LID      = 'ai1iqnl9mg6kvw0f'
BASE     = 'https://www.fantrax.com'
COOKIE_FILE = '/tmp/fantrax.cookie'

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

CAT_LOWER = {'SO', 'H', 'ERA', 'WHIP'}
ALL_CATS  = ['R','HR','RBI','SO','SB','AVG','OPS','IP','H','K','QS','ERA','WHIP','SVH']

# ── SESSION ───────────────────────────────────────
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

# ── SELENIUM LOGIN ────────────────────────────────
def selenium_login():
    """Login via headless Chrome and return session cookies."""
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver import Keys

    print('Logging in via Selenium...')
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

    try:
        driver = webdriver.Chrome(options=options)
        driver.get('https://www.fantrax.com/login')

        # Fill credentials
        email_box = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.XPATH, "//input[@formcontrolname='email']"))
        )
        email_box.send_keys(EMAIL)

        pass_box = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//input[@formcontrolname='password']"))
        )
        pass_box.send_keys(PASSWORD)
        pass_box.send_keys(Keys.ENTER)

        time.sleep(6)  # Wait for login to complete

        cookies = driver.get_cookies()
        driver.quit()

        # Save cookies
        with open(COOKIE_FILE, 'wb') as f:
            pickle.dump(cookies, f)

        # Load into requests session
        for c in cookies:
            s.cookies.set(c['name'], c['value'], domain=c.get('domain', '.fantrax.com'))

        print(f'  ✅ Logged in, got {len(cookies)} cookies')
        return True
    except Exception as e:
        print(f'  ❌ Selenium login failed: {e}')
        try: driver.quit()
        except: pass
        return False

def load_saved_cookies():
    """Load previously saved cookies into session."""
    if os.path.exists(COOKIE_FILE):
        with open(COOKIE_FILE, 'rb') as f:
            for c in pickle.load(f):
                s.cookies.set(c['name'], c['value'], domain=c.get('domain', '.fantrax.com'))
        return True
    return False

# Try saved cookies first, then login
if not load_saved_cookies():
    selenium_login()
else:
    print('Using saved cookies')

# Test auth
test = get('/fxea/general/getScoreboard', {'scoringPeriod': 1, 'timeframeType': 'BY_PERIOD'})
if not test or list(test.keys()) == ['error']:
    print('Saved cookies expired — re-logging in')
    selenium_login()
    test = get('/fxea/general/getScoreboard', {'scoringPeriod': 1, 'timeframeType': 'BY_PERIOD'})

print(f'Auth test: {list(test.keys())[:6] if test else "failed"}')

# ── USE FANTRAXAPI LIBRARY FOR SCORES ────────────
print('Fetching scores via fantraxapi library...')
scores_filled = 0
try:
    from fantraxapi import League
    from fantraxapi import api as fxapi

    fan_session = __import__('requests').Session()
    for name, value in s.cookies.items():
        fan_session.cookies.set(name, value, domain='.fantrax.com')

    original_request = fxapi.request
    captured_raw = []
    def capturing_request(league, methods):
        result = original_request(league, methods)
        captured_raw.append(result)
        return result
    fxapi.request = capturing_request
    league = League(LID, session=fan_session)
    try: league.scoring_period_results()
    except: pass
    fxapi.request = original_request

    table_data = next((r for r in captured_raw if isinstance(r, dict) and 'tableList' in r), None)
    if not table_data:
        print('  No tableList found')
    else:
        table_list   = table_data['tableList']
        fantasy_info = table_data.get('fantasyTeamInfo', {})

        # Build teamId lookup from fantasyTeamInfo
        # fantasyTeamInfo maps teamId -> {name, ...}
        print(f'  fantasyTeamInfo sample: {json.dumps(dict(list(fantasy_info.items())[:2]))[:300]}')

        for table in table_list:
            caption = table.get('caption', '')  # e.g. "Scoring Period 1"
            # Extract period number from caption
            import re as _re
            m = _re.search(r'Scoring Period (\d+)', caption)
            if not m: continue
            period = int(m.group(1))

            wk = next((w for w in schedule if w['period'] == period), None)
            if not wk: continue

            rows = table.get('rows', [])
            fixed_rows = table.get('fixedRows', {})
            if not isinstance(fixed_rows, dict):
                fixed_rows = {}

            # Header order: W,L,T,Pts,R,HR,RBI,SO,SB,AVG,OPS,IP,QS,H,K,ERA,WHIP,SVH
            header = [c.get('shortName', '') for c in table.get('header', {}).get('cells', [])]
            cat_keys = header[4:]  # skip W,L,T,Pts

            # Fixed rows has team info keyed by row index
            # rows come in pairs: away (even) then home (odd)
            for i in range(0, len(rows) - 1, 2):
                away_row = rows[i]
                home_row = rows[i + 1]

                # Get team IDs from fixedRows
                away_fixed = fixed_rows.get(str(i), fixed_rows.get(i, {}))
                home_fixed = fixed_rows.get(str(i+1), fixed_rows.get(i+1, {}))

                away_tid = (away_fixed.get('cells', [{}])[0].get('teamId', '') if isinstance(away_fixed, dict)
                            else '')
                home_tid = (home_fixed.get('cells', [{}])[0].get('teamId', '') if isinstance(home_fixed, dict)
                            else '')

                def parse_cells(row_data):
                    cells = row_data.get('cells', [])
                    vals = [c.get('toolTip', c.get('content', '')) for c in cells]
                    return vals

                away_vals = parse_cells(away_row)
                home_vals = parse_cells(home_row)

                # W,L,T,Pts = first 4
                away_score = float(away_vals[3]) if len(away_vals) > 3 else None
                home_score = float(home_vals[3]) if len(home_vals) > 3 else None

                # Categories
                cats = {}
                for j, cat in enumerate(cat_keys):
                    idx = j + 4
                    av = away_vals[idx] if idx < len(away_vals) else None
                    hv = home_vals[idx] if idx < len(home_vals) else None
                    try: av = float(av)
                    except: pass
                    try: hv = float(hv)
                    except: pass
                    cats[cat] = {'away': av, 'home': hv}

                # Match to schedule matchup
                matched = False
                for mm in wk['matchupList']:
                    aid, hid = mm['away']['id'], mm['home']['id']
                    # Try by team ID from fixedRows
                    if away_tid and home_tid:
                        if aid == away_tid and hid == home_tid:
                            matched = True
                    # Fallback: match by position if only 2 rows (1 matchup per table view)
                    if not matched and len(rows) == 2 and i == 0:
                        matched = True
                    if matched:
                        mm['awayScore'] = away_score
                        mm['homeScore'] = home_score
                        mm['categories'] = cats
                        scores_filled += 1
                        if period == 1:
                            print(f'  P1 matchup: {mm["away"]["name"]} {away_score} vs {mm["home"]["name"]} {home_score}')
                            print(f'  cats sample: R={cats.get("R")}, HR={cats.get("HR")}, ERA={cats.get("ERA")}')
                        break

        print(f'  ✅ {scores_filled} matchups parsed from tableList')

except Exception as e:
    print(f'  Error: {e}')
    import traceback; traceback.print_exc()

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

# ── SCHEDULE ──────────────────────────────────────
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
            start = _dt.utcfromtimestamp(int(start_date_str)/1000).date()
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
print(f'  {len(schedule)} weeks')

# ── SCORES & CATEGORIES ───────────────────────────
print('Fetching scores...')
scores_filled = 0
for wk in schedule:
    period = wk['period']
    for ep, params in [
        ('/fxea/general/getScoreboard',      {'scoringPeriod': period, 'timeframeType': 'BY_PERIOD'}),
        ('/fxea/general/getScoreboard',      {'period': period}),
        ('/fxea/general/getMatchupResults',  {'scoringPeriod': period}),
        ('/fxea/general/getTeamMatchupInfo', {'scoringPeriod': period}),
        ('/fxea/general/getLiveScoring',     {'scoringPeriod': period}),
    ]:
        raw = get(ep, params)
        if not raw or (isinstance(raw, dict) and list(raw.keys()) == ['error']): continue
        rows = raw if isinstance(raw, list) else raw.get('matchupList', raw.get('matchups', []))
        if not rows: continue
        if period <= 2:
            print(f'  Period {period} hit via {ep}: keys={list(rows[0].keys())[:10] if rows and isinstance(rows[0],dict) else "?"}')
            if rows and isinstance(rows[0], dict):
                print(f'  sample: {json.dumps(rows[0])[:400]}')
        found = False
        for row in rows:
            if not isinstance(row, dict): continue
            aid = (row.get('awayTeamId') or (row.get('away') or {}).get('id',''))
            hid = (row.get('homeTeamId') or (row.get('home') or {}).get('id',''))
            if not aid or not hid: continue
            for m in wk['matchupList']:
                if m['away']['id'] == aid and m['home']['id'] == hid:
                    away_obj = row.get('away', {}) or {}
                    home_obj  = row.get('home', {}) or {}
                    away_s = (row.get('awayScore') or row.get('awayCatWins') or
                              away_obj.get('score') or away_obj.get('catWins'))
                    home_s = (row.get('homeScore') or row.get('homeCatWins') or
                              home_obj.get('score') or home_obj.get('catWins'))
                    if away_s is not None: m['awayScore'] = away_s
                    if home_s is not None: m['homeScore'] = home_s
                    a_stats = away_obj.get('stats') or away_obj.get('categoryStats') or {}
                    h_stats  = home_obj.get('stats') or home_obj.get('categoryStats') or {}
                    if a_stats or h_stats:
                        m['categories'] = {k: {'away': a_stats.get(k), 'home': h_stats.get(k)}
                                           for k in set(list(a_stats)+list(h_stats))}
                        scores_filled += 1
                    found = True; break
        if found: break
print(f'  {len(schedule)} weeks · {scores_filled} scores filled')

# ── STANDINGS ─────────────────────────────────────
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
        try: w, l, t = int(parts[0]), int(parts[1]), (int(parts[2]) if len(parts)>2 else 0)
        except: pass
    total = w+l+t
    standings.append({
        'teamId': row.get('teamId',''), 'teamName': row.get('teamName',''),
        'points': f'{w}-{l}-{t}', 'wins': w, 'losses': l, 'ties': t,
        'winPercentage': round(w/total,4) if total else 0.0,
        'gamesBack': row.get('gamesBack',0), 'streak': row.get('streak',''),
        'rank': row.get('rank',0),
    })
standings.sort(key=lambda r: (-r['wins'], r['losses']))
print(f'  {len(standings)} teams')

# ── PAST SEASONS ──────────────────────────────────
print('Fetching past seasons...')
past = {}
for season in ['2022','2023','2024','2025']:
    raw = get('/fxea/general/getStandings', {'season': season})
    rows2 = raw if isinstance(raw, list) else raw.get('standings', [])
    if isinstance(rows2, dict): rows2 = list(rows2.values())
    past[season] = rows2

# ── OUTPUT ────────────────────────────────────────
player_map_out = {pid: {'name': p.get('name',''), 'pos': p.get('pos','?'), 'adp': p.get('ADP',999)}
                  for pid, p in player_map.items()}
named = sum(1 for p in player_map_out.values() if p['name'] and not p['name'].startswith('ID:'))

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
