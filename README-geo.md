# Geography: areas, cities, talent

Where schools are and where recruits come from. The map is plain data in
`dynasty/geo.js`; pipelines are `dynasty/pipelines.js`. Every school has a
city, every player a hometown, recruiting reads the distance between them
(home / close / far) and each school's pipelines, and the Map tab shows it.

## How it plays

- **Distance.** His hometown to your campus: home (≤150 mi) +1, close (≤500)
  +0.35, far −0.75 on the proximity factor (README-recruiting). It matters
  as much as he cares about staying near home.
- **Pipelines.** A strength 0–100 per area: Developing 20+, Established 45+,
  Strong 70+. A pipeline in a kid's area is its own factor (up to the same
  size as relationship), on top of distance: a school in Maine with a strong
  NYC pipeline competes with the city's own schools there.
  - Your **home area** always counts and never drops below 50 (+0.4 per
    prestige point over 50). It doesn't use a slot.
  - Besides home, your strongest **2 areas count (3 with a 60+ recruiting
    coach, 4 with 80+)**; the rest fade fast.
  - Each offseason, **signings build** their area (2★ +8, 3★ +12, 4★ +16,
    5★ +20, a transfer +10, up to 100), then every area **fades 12%** (ones
    beyond your slots 40%).
  - A new league starts each school with its home area plus 1–2 nearby
    areas; programs at 80+ prestige also have one far-off big area.
  - Program tab: your pipelines. Recruiting board: hometowns, home/close
    tags, ▲ on kids from your pipeline areas, and a "near you / your
    pipelines" filter.
- **Where kids sign** (measured): in the Full league about 40% within 150
  miles and 80% within 500. 3★ kids mostly stay regional (16% go far), 5★
  kids go national far more (about 40%). AI staffs lean on their local edge
  (`Recruiting.CFG.ai.localPull`), less so at big programs. Crowded areas
  wash out (everyone has the home edge); in an empty one the nearby school
  has it alone, for kids at its level. Compact has only 74 schools across
  the map, so more kids travel there (about 60% sign within 500 miles).
- **Starting rosters**: about half the players grew up within 500 miles of
  the school (`CFG.rosterLocal`); walk-ons are mostly local.

## The Map tab

One map of the US with layers you switch on and off:

- **Pipelines** of the school you're looking at, shaded by level (whole-state
  areas shade the state; split areas like Houston or the DC area get a shape
  around their cities). The home area is outlined.
- **Distance rings**: 150 miles (home) and 500 (close) around the campus,
  drawn as real distances.
- **Your board**: every kid you've offered, starred or put points into, by
  status (signed with you, offered, on your board, went elsewhere). Click
  one to open his card.
- **Whole class**: every recruit, bigger dots for more stars: where the
  talent is this year.
- **Schools**: diamonds by tier, yours in gold. Click one to see its
  pipelines, rings and recruiting footprint ("Back to" returns to yours).
- **Your roster's hometowns.**
- Zoom: the whole country, or about 1,100 miles across around the campus.

The side panel shows the school's pipelines and your board by distance
(home / close / far, and how many from your pipeline areas), plus who has
signed. State outlines come from us-atlas (U.S. Census Bureau boundaries,
public domain), stored in `ui/us_map.js` so the map works offline; points are
placed with the same Albers USA projection (`Geo.project`).

Tuning: distance levels `Geo.CFG.miles`; the distance and pipeline scores
`Recruiting.CFG.prox`, `swing.pipe`, `pipeWeightFloor`, `ai.localPull`;
pipeline levels, slots, gains and fading `Pipelines.CFG`.

## The pieces

- **Areas** (66): every state, with the big ones split (Texas 4, California 4,
  Florida 3; Georgia, New York, Illinois, North Carolina, Pennsylvania, Ohio
  and Michigan 2 each), plus the DC area (DC, suburban Maryland, Northern
  Virginia) apart from the rest of Maryland and Virginia. Pipelines will be
  built per area, recruits are produced per area, and screens group by area.
- **Cities** (357): big cities, where most recruits grow up, and college
  towns, where schools are. Each has map coordinates and belongs to one area.
  Distance is measured city to city in straight-line miles.
- **Distance levels:** up to 150 miles is **home**, up to 500 is **close**,
  beyond is **far** (`Geo.CFG.miles`). Chapel Hill → Charlotte 111 mi (home),
  Portland ME → Brooklyn 279 (close), Laramie → Denver 113 (home), Dallas →
  El Paso 570 (far).

## Tuning

Everything is in `dynasty/geo.js`, as two lists:

```js
{ id: "TX-DFW", name: "Dallas–Fort Worth", talent: 40 },     // an area
["Dallas", "TX", "TX-DFW", 32.78, -96.80, 10],                 // a city: name, state, area, latitude, longitude, weight
```

- **More or fewer recruits from an area:** change its `talent`. Only the
  ratios matter: a 40 area makes twice what a 20 does. The size of a whole
  class is separate (`Recruiting.CFG.poolPerTeam`, 3.2 recruits per school).
- **Where inside an area:** a city's `weight` is its share of its area's
  recruits (relative inside the area). College towns are 1–2: they hold
  schools more than they make players.
- **Add a city:** add a row (coordinates from any map; two decimals is
  plenty). **Remove one:** delete its row. **Move one:** change its area.
- **Add an area:** add it to the area list, then give it cities. **Split a
  state:** add the new areas and move its cities between them.
- **Change the levels:** `CFG.miles` (`home`, `close`).

Then run `node tests/geo_check.js`. It checks the data (missing areas, cities
listed twice, coordinates outside the US, a city far from the rest of its
area, which is usually a typo) and prints every area's share of a class and
how many recruits that is a year in each league. `node tests/run.js league`
includes the check. Mark a genuinely spread-out area `spread: true` so the
check doesn't flag its distant cities (Alaska, Montana, West Texas and so on
already are).

## Talent today

By state: TX 11.8% · CA 9.8% · FL 6.9% · GA 5.4% · NY 5.2% · IL 4.2% ·
NC 3.6% · VA 3.4% · OH 3.4% · PA 3.3% · MI 3.0% · MD 2.7% · NJ 2.6% ·
IN 2.6% · TN 2.4%. Weights are a first pass, from population and where
college players tend to come from; tune freely.

| Area | Name | Talent | Share | Recruits a year (Compact / Full) | Cities |
|---|---|---|---|---|---|
| CA-LA | Los Angeles | 45 | 4.9% | 11.6 / 55 | Los Angeles, Long Beach, Inglewood, Santa Ana, Pasadena, Northridge, Malibu |
| TX-DFW | Dallas–Fort Worth | 40 | 4.3% | 10.3 / 49 | Dallas, Fort Worth, Arlington, Plano, Garland, Denton |
| GA-ATL | Atlanta | 40 | 4.3% | 10.3 / 49 | Atlanta, Marietta, Decatur, Lawrenceville, Athens |
| TX-HOU | Houston | 38 | 4.1% | 9.8 / 46 | Houston, Pasadena, Sugar Land, The Woodlands, Beaumont, Galveston, Huntsville, Prairie View |
| NY-NYC | New York City | 38 | 4.1% | 9.8 / 46 | Manhattan, Brooklyn, Bronx, Queens, Hempstead, Yonkers, Mount Vernon |
| DMV | DC area (DC, suburban MD & NoVA) | 35 | 3.8% | 9.0 / 43 | Washington, Silver Spring, Hyattsville, College Park, Alexandria, Arlington, Fairfax |
| IL-CHI | Chicago | 32 | 3.5% | 8.2 / 39 | Chicago, Evanston, Aurora, Joliet, Naperville, Waukegan, DeKalb |
| FL-SFL | South Florida | 28 | 3.0% | 7.2 / 34 | Miami, Fort Lauderdale, West Palm Beach, Boca Raton, Fort Myers |
| TX-CTX | Central & South Texas | 24 | 2.6% | 6.2 / 29 | San Antonio, Austin, Waco, Corpus Christi, McAllen, Killeen, San Marcos, College Station, Laredo |
| IN | Indiana | 24 | 2.6% | 6.2 / 29 | Indianapolis, Fort Wayne, Evansville, South Bend, Gary, Bloomington, West Lafayette, Muncie, Terre Haute |
| NJ | New Jersey | 24 | 2.6% | 6.2 / 29 | Newark, Jersey City, Paterson, Trenton, Camden, Piscataway, South Orange, Princeton |
| FL-CFL | Central Florida | 22 | 2.4% | 5.7 / 27 | Orlando, Tampa, St. Petersburg, Lakeland, Daytona Beach |
| TN | Tennessee | 22 | 2.4% | 5.7 / 27 | Memphis, Nashville, Knoxville, Chattanooga, Murfreesboro, Clarksville, Johnson City, Cookeville |
| PA-PHL | Philadelphia & Eastern PA | 20 | 2.2% | 5.1 / 24 | Philadelphia, Chester, Allentown, Reading, Villanova, Bethlehem, Scranton |
| MI-DET | Detroit | 20 | 2.2% | 5.1 / 24 | Detroit, Flint, Ann Arbor, Pontiac, Ypsilanti, Saginaw |
| VA | Virginia (outside NoVA) | 20 | 2.2% | 5.1 / 24 | Richmond, Norfolk, Virginia Beach, Newport News, Hampton, Charlottesville, Blacksburg, Roanoke, Lynchburg, Harrisonburg |
| CA-BAY | Bay Area | 18 | 2.0% | 4.6 / 22 | San Francisco, Oakland, San Jose, Berkeley, Palo Alto, Santa Clara, Vallejo |
| NC-TRI | Triangle & Eastern NC | 18 | 2.0% | 4.6 / 22 | Raleigh, Durham, Chapel Hill, Greensboro, Fayetteville, Wilmington, Greenville |
| LA | Louisiana | 18 | 2.0% | 4.6 / 22 | New Orleans, Baton Rouge, Shreveport, Lafayette, Monroe, Ruston, Lake Charles |
| OH-SOH | Central & Southern Ohio | 17 | 1.8% | 4.4 / 21 | Columbus, Cincinnati, Dayton, Athens, Oxford, Springfield |
| AL | Alabama | 17 | 1.8% | 4.4 / 21 | Birmingham, Montgomery, Mobile, Huntsville, Tuscaloosa, Auburn |
| CA-SD | San Diego & Inland Empire | 15 | 1.6% | 3.9 / 18 | San Diego, Riverside, San Bernardino |
| NC-CLT | Charlotte & Western NC | 15 | 1.6% | 3.9 / 18 | Charlotte, Winston-Salem, Asheville, Boone, Gastonia, Hickory |
| AZ | Arizona | 15 | 1.6% | 3.9 / 18 | Phoenix, Tucson, Mesa, Tempe, Flagstaff |
| MO | Missouri | 15 | 1.6% | 3.9 / 18 | St. Louis, Kansas City, Springfield, Columbia, Cape Girardeau |
| FL-NFL | North Florida | 14 | 1.5% | 3.6 / 17 | Jacksonville, Tallahassee, Gainesville, Pensacola |
| OH-NOH | Northern Ohio | 14 | 1.5% | 3.6 / 17 | Cleveland, Akron, Toledo, Youngstown, Kent, Bowling Green |
| MN | Minnesota | 13 | 1.4% | 3.3 / 16 | Minneapolis, St. Paul, Rochester, Duluth, Mankato |
| MS | Mississippi | 13 | 1.4% | 3.3 / 16 | Jackson, Gulfport, Hattiesburg, Starkville, Oxford, Tupelo, Greenville |
| SC | South Carolina | 13 | 1.4% | 3.3 / 16 | Columbia, Charleston, Greenville, Clemson, Myrtle Beach, Rock Hill, Orangeburg |
| WA | Washington | 13 | 1.4% | 3.3 / 16 | Seattle, Tacoma, Spokane, Pullman, Bellingham, Everett |
| CA-CEN | Central & Northern California | 12 | 1.3% | 3.1 / 15 | Sacramento, Fresno, Bakersfield, Stockton, Davis, Chico, San Luis Obispo, Santa Barbara |
| KY | Kentucky | 12 | 1.3% | 3.1 / 15 | Louisville, Lexington, Bowling Green, Owensboro, Richmond, Murray, Morehead |
| MD | Maryland (Baltimore & beyond) | 12 | 1.3% | 3.1 / 15 | Baltimore, Annapolis, Towson, Frederick, Salisbury |
| MA | Massachusetts | 11 | 1.2% | 2.8 / 13 | Boston, Worcester, Springfield, Lowell, Amherst, Chestnut Hill |
| GA-SGA | South & East Georgia | 10 | 1.1% | 2.6 / 12 | Savannah, Macon, Augusta, Columbus, Albany, Statesboro, Valdosta |
| NY-UNY | Upstate New York | 10 | 1.1% | 2.6 / 12 | Buffalo, Rochester, Syracuse, Albany, Binghamton, Ithaca, Utica |
| PA-WPA | Pittsburgh & Western PA | 10 | 1.1% | 2.6 / 12 | Pittsburgh, Erie, Harrisburg, State College, Johnstown |
| CO | Colorado | 10 | 1.1% | 2.6 / 12 | Denver, Colorado Springs, Boulder, Fort Collins, Pueblo, Greeley |
| WI | Wisconsin | 10 | 1.1% | 2.6 / 12 | Milwaukee, Madison, Green Bay, Racine, La Crosse |
| AR | Arkansas | 9 | 1.0% | 2.3 / 11 | Little Rock, Fayetteville, Jonesboro, Pine Bluff |
| CT | Connecticut | 9 | 1.0% | 2.3 / 11 | Hartford, New Haven, Bridgeport, Storrs, Fairfield |
| NV | Nevada | 9 | 1.0% | 2.3 / 11 | Las Vegas, Reno |
| OK | Oklahoma | 9 | 1.0% | 2.3 / 11 | Oklahoma City, Tulsa, Norman, Stillwater, Lawton |
| MI-WMI | Western & Northern Michigan | 8 | 0.9% | 2.1 / 10 | Grand Rapids, Lansing, Kalamazoo, Mount Pleasant, Marquette, East Lansing |
| KS | Kansas | 8 | 0.9% | 2.1 / 10 | Wichita, Kansas City, Topeka, Lawrence, Manhattan |
| TX-WTX | West Texas | 7 | 0.8% | 1.8 / 9 | El Paso, Lubbock, Amarillo, Midland, Odessa, Abilene |
| IL-DIL | Downstate Illinois | 7 | 0.8% | 1.8 / 9 | Peoria, Springfield, Champaign, Rockford, Normal, Carbondale, Macomb, Charleston, Edwardsville |
| IA | Iowa | 7 | 0.8% | 1.8 / 9 | Des Moines, Cedar Rapids, Davenport, Iowa City, Ames, Cedar Falls, Sioux City |
| OR | Oregon | 7 | 0.8% | 1.8 / 9 | Portland, Eugene, Salem, Corvallis |
| UT | Utah | 7 | 0.8% | 1.8 / 9 | Salt Lake City, Provo, Ogden, Logan, St. George |
| NE | Nebraska | 4 | 0.4% | 1.0 / 5 | Omaha, Lincoln, Kearney |
| NM | New Mexico | 4 | 0.4% | 1.0 / 5 | Albuquerque, Las Cruces, Santa Fe |
| WV | West Virginia | 4 | 0.4% | 1.0 / 5 | Charleston, Huntington, Morgantown, Wheeling |
| DE | Delaware | 3 | 0.3% | 0.8 / 4 | Wilmington, Dover, Newark |
| HI | Hawaii | 3 | 0.3% | 0.8 / 4 | Honolulu, Hilo |
| ID | Idaho | 3 | 0.3% | 0.8 / 4 | Boise, Pocatello, Moscow |
| RI | Rhode Island | 3 | 0.3% | 0.8 / 4 | Providence, Kingston |
| ME | Maine | 2 | 0.2% | 0.5 / 2 | Portland, Bangor, Orono |
| MT | Montana | 2 | 0.2% | 0.5 / 2 | Billings, Missoula, Bozeman |
| NH | New Hampshire | 2 | 0.2% | 0.5 / 2 | Manchester, Durham, Hanover |
| ND | North Dakota | 2 | 0.2% | 0.5 / 2 | Fargo, Bismarck, Grand Forks |
| SD | South Dakota | 2 | 0.2% | 0.5 / 2 | Sioux Falls, Rapid City, Brookings, Vermillion |
| AK | Alaska | 1 | 0.1% | 0.3 / 1 | Anchorage, Fairbanks |
| VT | Vermont | 1 | 0.1% | 0.3 / 1 | Burlington |
| WY | Wyoming | 1 | 0.1% | 0.3 / 1 | Cheyenne, Casper, Laramie |
