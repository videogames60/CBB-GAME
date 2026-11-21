/* =====================================================================
   HOOPS DYNASTY — GEOGRAPHY
   Where schools are and where recruits come from.

   AREAS are the recruiting map: every state, the big ones split, plus the
   DC area. Pipelines are built per area, recruits are produced per area,
   and screens group by area.

     { id, name, talent, spread? }
       id      "TX-DFW" — the state code, plus a part for split states
       name    what the screens show
       spread  (optional) true for a big, spread-out area: the check
               doesn't flag cities far apart inside it
       talent  how many recruits the area produces, relative to the others.
               Only the ratios matter (a 40 area makes twice what a 20 does).
               The class size itself is Recruiting.CFG.poolPerTeam.

   CITIES are the points on the map: big cities (where most recruits grow up)
   and college towns (where schools are). Distance is measured city to city.

     [name, state, area, latitude, longitude, weight]
       weight  this city's share of its area's recruits (relative inside the
               area: a 10 makes ten times what a 1 does). College towns are
               usually 1–2: they hold schools more than they make players.

   To tune: change a talent number, add or remove a city row, move a city to
   another area, or add an area (then give it cities). `node tests/geo_check.js`
   checks the data and prints every area's share of a recruiting class.

   DISTANCE: straight-line miles between two cities. Recruiting reads it in
   three levels (CFG.miles): home, close, far.
   ===================================================================== */
(function (root) {
  const CFG = {
    miles: { home: 150, close: 500 },   // up to 150 miles = home, up to 500 = close, beyond = far
    rosterLocal: 0.55,                  // a generated roster player grew up within "close" range of the school this often (else anywhere)
    walkOnLocal: 0.85,                  // walk-ons are mostly local kids
  };

  /* Where a conference's made-up schools are placed when it doesn't list its
     own states (a conference in a league file can give "states": [...]).
     Only placement uses this: recruiting reads each school's own city. */
  const REGION_STATES = {
    Northeast: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "DE", "MD", "DC"],
    Southeast: ["VA", "NC", "SC", "GA", "FL", "WV"],
    Midwest: ["OH", "MI", "IN", "IL", "WI", "MN", "IA", "MO", "KS", "NE", "ND", "SD"],
    South: ["TX", "OK", "AR", "LA", "MS", "AL", "TN", "KY"],
    West: ["WA", "OR", "CA", "NV", "AZ", "UT", "CO", "NM", "ID", "MT", "WY", "AK", "HI"],
  };

  const AREAS = [
    // ---- split states ----
    { id: "TX-DFW", name: "Dallas–Fort Worth", talent: 40 },
    { id: "TX-HOU", name: "Houston", talent: 38 },
    { id: "TX-CTX", name: "Central & South Texas", talent: 24 },
    { id: "TX-WTX", name: "West Texas", talent: 7, spread: true },
    { id: "CA-LA", name: "Los Angeles", talent: 45 },
    { id: "CA-SD", name: "San Diego & Inland Empire", talent: 15 },
    { id: "CA-BAY", name: "Bay Area", talent: 18 },
    { id: "CA-CEN", name: "Central & Northern California", talent: 12, spread: true },
    { id: "FL-SFL", name: "South Florida", talent: 28 },
    { id: "FL-CFL", name: "Central Florida", talent: 22 },
    { id: "FL-NFL", name: "North Florida", talent: 14 },
    { id: "GA-ATL", name: "Atlanta", talent: 40 },
    { id: "GA-SGA", name: "South & East Georgia", talent: 10 },
    { id: "NY-NYC", name: "New York City", talent: 38 },
    { id: "NY-UNY", name: "Upstate New York", talent: 10 },
    { id: "IL-CHI", name: "Chicago", talent: 32 },
    { id: "IL-DIL", name: "Downstate Illinois", talent: 7 },
    { id: "NC-TRI", name: "Triangle & Eastern NC", talent: 18 },
    { id: "NC-CLT", name: "Charlotte & Western NC", talent: 15 },
    { id: "PA-PHL", name: "Philadelphia & Eastern PA", talent: 20 },
    { id: "PA-WPA", name: "Pittsburgh & Western PA", talent: 10 },
    { id: "OH-NOH", name: "Northern Ohio", talent: 14 },
    { id: "OH-SOH", name: "Central & Southern Ohio", talent: 17 },
    { id: "MI-DET", name: "Detroit", talent: 20 },
    { id: "MI-WMI", name: "Western & Northern Michigan", talent: 8, spread: true },
    { id: "DMV", name: "DC area (DC, suburban MD & NoVA)", talent: 35 },
    // ---- one area per state ----
    { id: "AL", name: "Alabama", talent: 17 },
    { id: "AK", name: "Alaska", talent: 1, spread: true },
    { id: "AZ", name: "Arizona", talent: 15 },
    { id: "AR", name: "Arkansas", talent: 9 },
    { id: "CO", name: "Colorado", talent: 10 },
    { id: "CT", name: "Connecticut", talent: 9 },
    { id: "DE", name: "Delaware", talent: 3 },
    { id: "HI", name: "Hawaii", talent: 3, spread: true },
    { id: "ID", name: "Idaho", talent: 3, spread: true },
    { id: "IN", name: "Indiana", talent: 24 },
    { id: "IA", name: "Iowa", talent: 7 },
    { id: "KS", name: "Kansas", talent: 8 },
    { id: "KY", name: "Kentucky", talent: 12 },
    { id: "LA", name: "Louisiana", talent: 18 },
    { id: "ME", name: "Maine", talent: 2 },
    { id: "MD", name: "Maryland (Baltimore & beyond)", talent: 12 },
    { id: "MA", name: "Massachusetts", talent: 11 },
    { id: "MN", name: "Minnesota", talent: 13 },
    { id: "MS", name: "Mississippi", talent: 13 },
    { id: "MO", name: "Missouri", talent: 15 },
    { id: "MT", name: "Montana", talent: 2, spread: true },
    { id: "NE", name: "Nebraska", talent: 4 },
    { id: "NV", name: "Nevada", talent: 9, spread: true },
    { id: "NH", name: "New Hampshire", talent: 2 },
    { id: "NJ", name: "New Jersey", talent: 24 },
    { id: "NM", name: "New Mexico", talent: 4 },
    { id: "ND", name: "North Dakota", talent: 2 },
    { id: "OK", name: "Oklahoma", talent: 9 },
    { id: "OR", name: "Oregon", talent: 7 },
    { id: "RI", name: "Rhode Island", talent: 3 },
    { id: "SC", name: "South Carolina", talent: 13 },
    { id: "SD", name: "South Dakota", talent: 2, spread: true },
    { id: "TN", name: "Tennessee", talent: 22 },
    { id: "UT", name: "Utah", talent: 7 },
    { id: "VT", name: "Vermont", talent: 1 },
    { id: "VA", name: "Virginia (outside NoVA)", talent: 20 },
    { id: "WA", name: "Washington", talent: 13 },
    { id: "WV", name: "West Virginia", talent: 4 },
    { id: "WI", name: "Wisconsin", talent: 10 },
    { id: "WY", name: "Wyoming", talent: 1, spread: true },
  ];

  /* [name, state, area, lat, lon, weight] */
  const CITIES = [
    // Texas
    ["Dallas", "TX", "TX-DFW", 32.78, -96.80, 10], ["Fort Worth", "TX", "TX-DFW", 32.76, -97.33, 8], ["Arlington", "TX", "TX-DFW", 32.74, -97.11, 5],
    ["Plano", "TX", "TX-DFW", 33.02, -96.70, 4], ["Garland", "TX", "TX-DFW", 32.91, -96.64, 4], ["Denton", "TX", "TX-DFW", 33.21, -97.13, 2],
    ["Houston", "TX", "TX-HOU", 29.76, -95.37, 10], ["Pasadena", "TX", "TX-HOU", 29.69, -95.21, 4], ["Sugar Land", "TX", "TX-HOU", 29.62, -95.63, 3],
    ["The Woodlands", "TX", "TX-HOU", 30.17, -95.46, 3], ["Beaumont", "TX", "TX-HOU", 30.08, -94.13, 4], ["Galveston", "TX", "TX-HOU", 29.30, -94.80, 2],
    ["Huntsville", "TX", "TX-HOU", 30.72, -95.55, 1], ["Prairie View", "TX", "TX-HOU", 30.09, -95.99, 1],
    ["San Antonio", "TX", "TX-CTX", 29.42, -98.49, 10], ["Austin", "TX", "TX-CTX", 30.27, -97.74, 9], ["Waco", "TX", "TX-CTX", 31.55, -97.15, 4],
    ["Corpus Christi", "TX", "TX-CTX", 27.80, -97.40, 5], ["McAllen", "TX", "TX-CTX", 26.20, -98.23, 4], ["Killeen", "TX", "TX-CTX", 31.12, -97.73, 4],
    ["San Marcos", "TX", "TX-CTX", 29.88, -97.94, 1], ["College Station", "TX", "TX-CTX", 30.63, -96.33, 2], ["Laredo", "TX", "TX-CTX", 27.53, -99.49, 3],
    ["El Paso", "TX", "TX-WTX", 31.76, -106.49, 10], ["Lubbock", "TX", "TX-WTX", 33.58, -101.86, 5], ["Amarillo", "TX", "TX-WTX", 35.22, -101.83, 4],
    ["Midland", "TX", "TX-WTX", 32.00, -102.08, 3], ["Odessa", "TX", "TX-WTX", 31.85, -102.37, 3], ["Abilene", "TX", "TX-WTX", 32.45, -99.73, 3],
    // California
    ["Los Angeles", "CA", "CA-LA", 34.05, -118.24, 10], ["Long Beach", "CA", "CA-LA", 33.77, -118.19, 5], ["Inglewood", "CA", "CA-LA", 33.96, -118.35, 4],
    ["Santa Ana", "CA", "CA-LA", 33.75, -117.87, 4], ["Pasadena", "CA", "CA-LA", 34.15, -118.14, 2], ["Northridge", "CA", "CA-LA", 34.23, -118.54, 2],
    ["Malibu", "CA", "CA-LA", 34.03, -118.78, 1],
    ["San Diego", "CA", "CA-SD", 32.72, -117.16, 10], ["Riverside", "CA", "CA-SD", 33.95, -117.40, 5], ["San Bernardino", "CA", "CA-SD", 34.11, -117.29, 4],
    ["San Francisco", "CA", "CA-BAY", 37.77, -122.42, 7], ["Oakland", "CA", "CA-BAY", 37.80, -122.27, 8], ["San Jose", "CA", "CA-BAY", 37.34, -121.89, 7],
    ["Berkeley", "CA", "CA-BAY", 37.87, -122.27, 2], ["Palo Alto", "CA", "CA-BAY", 37.44, -122.14, 1], ["Santa Clara", "CA", "CA-BAY", 37.35, -121.95, 2],
    ["Vallejo", "CA", "CA-BAY", 38.10, -122.26, 2],
    ["Sacramento", "CA", "CA-CEN", 38.58, -121.49, 8], ["Fresno", "CA", "CA-CEN", 36.74, -119.79, 6], ["Bakersfield", "CA", "CA-CEN", 35.37, -119.02, 4],
    ["Stockton", "CA", "CA-CEN", 37.96, -121.29, 4], ["Davis", "CA", "CA-CEN", 38.54, -121.74, 1], ["Chico", "CA", "CA-CEN", 39.73, -121.84, 1],
    ["San Luis Obispo", "CA", "CA-CEN", 35.28, -120.66, 1], ["Santa Barbara", "CA", "CA-CEN", 34.42, -119.70, 2],
    // Florida
    ["Miami", "FL", "FL-SFL", 25.76, -80.19, 10], ["Fort Lauderdale", "FL", "FL-SFL", 26.12, -80.14, 6], ["West Palm Beach", "FL", "FL-SFL", 26.72, -80.05, 4],
    ["Boca Raton", "FL", "FL-SFL", 26.37, -80.13, 2], ["Fort Myers", "FL", "FL-SFL", 26.64, -81.87, 3],
    ["Orlando", "FL", "FL-CFL", 28.54, -81.38, 10], ["Tampa", "FL", "FL-CFL", 27.95, -82.46, 9], ["St. Petersburg", "FL", "FL-CFL", 27.77, -82.64, 4],
    ["Lakeland", "FL", "FL-CFL", 28.04, -81.95, 3], ["Daytona Beach", "FL", "FL-CFL", 29.21, -81.02, 2],
    ["Jacksonville", "FL", "FL-NFL", 30.33, -81.66, 10], ["Tallahassee", "FL", "FL-NFL", 30.44, -84.28, 4], ["Gainesville", "FL", "FL-NFL", 29.65, -82.32, 3],
    ["Pensacola", "FL", "FL-NFL", 30.42, -87.22, 4],
    // Georgia
    ["Atlanta", "GA", "GA-ATL", 33.75, -84.39, 10], ["Marietta", "GA", "GA-ATL", 33.95, -84.55, 4], ["Decatur", "GA", "GA-ATL", 33.77, -84.30, 3],
    ["Lawrenceville", "GA", "GA-ATL", 33.96, -83.99, 3], ["Athens", "GA", "GA-ATL", 33.96, -83.38, 2],
    ["Savannah", "GA", "GA-SGA", 32.08, -81.09, 5], ["Macon", "GA", "GA-SGA", 32.84, -83.63, 4], ["Augusta", "GA", "GA-SGA", 33.47, -81.97, 5],
    ["Columbus", "GA", "GA-SGA", 32.46, -84.99, 4], ["Albany", "GA", "GA-SGA", 31.58, -84.16, 3], ["Statesboro", "GA", "GA-SGA", 32.45, -81.78, 1],
    ["Valdosta", "GA", "GA-SGA", 30.83, -83.28, 2],
    // New York
    ["Manhattan", "NY", "NY-NYC", 40.78, -73.97, 6], ["Brooklyn", "NY", "NY-NYC", 40.68, -73.94, 10], ["Bronx", "NY", "NY-NYC", 40.84, -73.86, 8],
    ["Queens", "NY", "NY-NYC", 40.73, -73.79, 8], ["Hempstead", "NY", "NY-NYC", 40.71, -73.62, 5], ["Yonkers", "NY", "NY-NYC", 40.93, -73.90, 3],
    ["Mount Vernon", "NY", "NY-NYC", 40.91, -73.84, 2],
    ["Buffalo", "NY", "NY-UNY", 42.89, -78.88, 8], ["Rochester", "NY", "NY-UNY", 43.16, -77.61, 6], ["Syracuse", "NY", "NY-UNY", 43.05, -76.15, 5],
    ["Albany", "NY", "NY-UNY", 42.65, -73.76, 4], ["Binghamton", "NY", "NY-UNY", 42.10, -75.92, 2], ["Ithaca", "NY", "NY-UNY", 42.44, -76.50, 1],
    ["Utica", "NY", "NY-UNY", 43.10, -75.23, 2],
    // Illinois
    ["Chicago", "IL", "IL-CHI", 41.88, -87.63, 10], ["Evanston", "IL", "IL-CHI", 42.05, -87.69, 2], ["Aurora", "IL", "IL-CHI", 41.76, -88.32, 3],
    ["Joliet", "IL", "IL-CHI", 41.53, -88.08, 3], ["Naperville", "IL", "IL-CHI", 41.75, -88.15, 2], ["Waukegan", "IL", "IL-CHI", 42.36, -87.84, 2],
    ["DeKalb", "IL", "IL-CHI", 41.93, -88.75, 1],
    ["Peoria", "IL", "IL-DIL", 40.69, -89.59, 5], ["Springfield", "IL", "IL-DIL", 39.78, -89.65, 4], ["Champaign", "IL", "IL-DIL", 40.12, -88.24, 3],
    ["Rockford", "IL", "IL-DIL", 42.27, -89.09, 4], ["Normal", "IL", "IL-DIL", 40.51, -88.99, 1], ["Carbondale", "IL", "IL-DIL", 37.73, -89.22, 1],
    ["Macomb", "IL", "IL-DIL", 40.46, -90.67, 1], ["Charleston", "IL", "IL-DIL", 39.50, -88.18, 1], ["Edwardsville", "IL", "IL-DIL", 38.81, -89.95, 1],
    // North Carolina
    ["Raleigh", "NC", "NC-TRI", 35.78, -78.64, 9], ["Durham", "NC", "NC-TRI", 35.99, -78.90, 6], ["Chapel Hill", "NC", "NC-TRI", 35.91, -79.06, 2],
    ["Greensboro", "NC", "NC-TRI", 36.07, -79.79, 6], ["Fayetteville", "NC", "NC-TRI", 35.05, -78.88, 4], ["Wilmington", "NC", "NC-TRI", 34.23, -77.94, 3],
    ["Greenville", "NC", "NC-TRI", 35.61, -77.37, 2],
    ["Charlotte", "NC", "NC-CLT", 35.23, -80.84, 10], ["Winston-Salem", "NC", "NC-CLT", 36.10, -80.24, 5], ["Asheville", "NC", "NC-CLT", 35.60, -82.55, 3],
    ["Boone", "NC", "NC-CLT", 36.22, -81.67, 1], ["Gastonia", "NC", "NC-CLT", 35.26, -81.19, 2], ["Hickory", "NC", "NC-CLT", 35.73, -81.34, 2],
    // Pennsylvania
    ["Philadelphia", "PA", "PA-PHL", 39.95, -75.17, 10], ["Chester", "PA", "PA-PHL", 39.85, -75.36, 3], ["Allentown", "PA", "PA-PHL", 40.60, -75.49, 4],
    ["Reading", "PA", "PA-PHL", 40.34, -75.93, 3], ["Villanova", "PA", "PA-PHL", 40.04, -75.35, 1], ["Bethlehem", "PA", "PA-PHL", 40.63, -75.37, 2],
    ["Scranton", "PA", "PA-PHL", 41.41, -75.66, 3],
    ["Pittsburgh", "PA", "PA-WPA", 40.44, -80.00, 10], ["Erie", "PA", "PA-WPA", 42.13, -80.09, 3], ["Harrisburg", "PA", "PA-WPA", 40.27, -76.88, 4],
    ["State College", "PA", "PA-WPA", 40.79, -77.86, 1], ["Johnstown", "PA", "PA-WPA", 40.33, -78.92, 2],
    // Ohio
    ["Cleveland", "OH", "OH-NOH", 41.50, -81.69, 10], ["Akron", "OH", "OH-NOH", 41.08, -81.52, 5], ["Toledo", "OH", "OH-NOH", 41.66, -83.56, 5],
    ["Youngstown", "OH", "OH-NOH", 41.10, -80.65, 3], ["Kent", "OH", "OH-NOH", 41.15, -81.36, 1], ["Bowling Green", "OH", "OH-NOH", 41.37, -83.65, 1],
    ["Columbus", "OH", "OH-SOH", 39.96, -83.00, 10], ["Cincinnati", "OH", "OH-SOH", 39.10, -84.51, 9], ["Dayton", "OH", "OH-SOH", 39.76, -84.19, 6],
    ["Athens", "OH", "OH-SOH", 39.33, -82.10, 1], ["Oxford", "OH", "OH-SOH", 39.51, -84.75, 1], ["Springfield", "OH", "OH-SOH", 39.92, -83.81, 2],
    // Michigan
    ["Detroit", "MI", "MI-DET", 42.33, -83.05, 10], ["Flint", "MI", "MI-DET", 43.01, -83.69, 4], ["Ann Arbor", "MI", "MI-DET", 42.28, -83.74, 2],
    ["Pontiac", "MI", "MI-DET", 42.64, -83.29, 3], ["Ypsilanti", "MI", "MI-DET", 42.24, -83.61, 1], ["Saginaw", "MI", "MI-DET", 43.42, -83.95, 3],
    ["Grand Rapids", "MI", "MI-WMI", 42.96, -85.67, 8], ["Lansing", "MI", "MI-WMI", 42.73, -84.56, 5], ["Kalamazoo", "MI", "MI-WMI", 42.29, -85.59, 4],
    ["Mount Pleasant", "MI", "MI-WMI", 43.60, -84.77, 1], ["Marquette", "MI", "MI-WMI", 46.54, -87.40, 1], ["East Lansing", "MI", "MI-WMI", 42.74, -84.48, 1],
    // DC area
    ["Washington", "DC", "DMV", 38.91, -77.04, 10], ["Silver Spring", "MD", "DMV", 38.99, -77.03, 5], ["Hyattsville", "MD", "DMV", 38.96, -76.95, 4],
    ["College Park", "MD", "DMV", 38.99, -76.94, 2], ["Alexandria", "VA", "DMV", 38.80, -77.05, 4], ["Arlington", "VA", "DMV", 38.88, -77.10, 3],
    ["Fairfax", "VA", "DMV", 38.85, -77.31, 3],
    // one-area states
    ["Birmingham", "AL", "AL", 33.52, -86.81, 10], ["Montgomery", "AL", "AL", 32.37, -86.30, 5], ["Mobile", "AL", "AL", 30.69, -88.04, 5],
    ["Huntsville", "AL", "AL", 34.73, -86.59, 5], ["Tuscaloosa", "AL", "AL", 33.21, -87.57, 2], ["Auburn", "AL", "AL", 32.61, -85.48, 1],
    ["Anchorage", "AK", "AK", 61.22, -149.90, 5], ["Fairbanks", "AK", "AK", 64.84, -147.72, 1],
    ["Phoenix", "AZ", "AZ", 33.45, -112.07, 10], ["Tucson", "AZ", "AZ", 32.22, -110.97, 5], ["Mesa", "AZ", "AZ", 33.42, -111.83, 4],
    ["Tempe", "AZ", "AZ", 33.43, -111.94, 2], ["Flagstaff", "AZ", "AZ", 35.20, -111.65, 1],
    ["Little Rock", "AR", "AR", 34.75, -92.29, 8], ["Fayetteville", "AR", "AR", 36.06, -94.16, 3], ["Jonesboro", "AR", "AR", 35.84, -90.70, 2],
    ["Pine Bluff", "AR", "AR", 34.23, -92.00, 2],
    ["Denver", "CO", "CO", 39.74, -104.99, 10], ["Colorado Springs", "CO", "CO", 38.83, -104.82, 5], ["Boulder", "CO", "CO", 40.01, -105.27, 2],
    ["Fort Collins", "CO", "CO", 40.59, -105.08, 2], ["Pueblo", "CO", "CO", 38.25, -104.61, 2], ["Greeley", "CO", "CO", 40.42, -104.71, 1],
    ["Hartford", "CT", "CT", 41.76, -72.68, 6], ["New Haven", "CT", "CT", 41.31, -72.92, 5], ["Bridgeport", "CT", "CT", 41.19, -73.20, 5],
    ["Storrs", "CT", "CT", 41.81, -72.25, 1], ["Fairfield", "CT", "CT", 41.14, -73.26, 1],
    ["Wilmington", "DE", "DE", 39.74, -75.55, 6], ["Dover", "DE", "DE", 39.16, -75.52, 3], ["Newark", "DE", "DE", 39.68, -75.75, 1],
    ["Honolulu", "HI", "HI", 21.31, -157.86, 8], ["Hilo", "HI", "HI", 19.72, -155.08, 2],
    ["Boise", "ID", "ID", 43.62, -116.20, 8], ["Pocatello", "ID", "ID", 42.86, -112.45, 2], ["Moscow", "ID", "ID", 46.73, -117.00, 1],
    ["Indianapolis", "IN", "IN", 39.77, -86.16, 10], ["Fort Wayne", "IN", "IN", 41.08, -85.14, 5], ["Evansville", "IN", "IN", 37.97, -87.57, 4],
    ["South Bend", "IN", "IN", 41.68, -86.25, 4], ["Gary", "IN", "IN", 41.59, -87.35, 4], ["Bloomington", "IN", "IN", 39.17, -86.53, 1],
    ["West Lafayette", "IN", "IN", 40.43, -86.91, 1], ["Muncie", "IN", "IN", 40.19, -85.39, 2], ["Terre Haute", "IN", "IN", 39.47, -87.41, 2],
    ["Des Moines", "IA", "IA", 41.59, -93.62, 8], ["Cedar Rapids", "IA", "IA", 41.98, -91.67, 4], ["Davenport", "IA", "IA", 41.52, -90.58, 4],
    ["Iowa City", "IA", "IA", 41.66, -91.53, 1], ["Ames", "IA", "IA", 42.03, -93.62, 1], ["Cedar Falls", "IA", "IA", 42.53, -92.45, 1],
    ["Sioux City", "IA", "IA", 42.50, -96.40, 2],
    ["Wichita", "KS", "KS", 37.69, -97.34, 8], ["Kansas City", "KS", "KS", 39.11, -94.63, 5], ["Topeka", "KS", "KS", 39.05, -95.68, 3],
    ["Lawrence", "KS", "KS", 38.97, -95.24, 1], ["Manhattan", "KS", "KS", 39.18, -96.57, 1],
    ["Louisville", "KY", "KY", 38.25, -85.76, 10], ["Lexington", "KY", "KY", 38.04, -84.50, 6], ["Bowling Green", "KY", "KY", 36.99, -86.44, 2],
    ["Owensboro", "KY", "KY", 37.77, -87.11, 2], ["Richmond", "KY", "KY", 37.75, -84.29, 1], ["Murray", "KY", "KY", 36.61, -88.31, 1],
    ["Morehead", "KY", "KY", 38.18, -83.43, 1],
    ["New Orleans", "LA", "LA", 29.95, -90.07, 10], ["Baton Rouge", "LA", "LA", 30.45, -91.15, 7], ["Shreveport", "LA", "LA", 32.53, -93.75, 5],
    ["Lafayette", "LA", "LA", 30.22, -92.02, 4], ["Monroe", "LA", "LA", 32.51, -92.12, 3], ["Ruston", "LA", "LA", 32.52, -92.64, 1],
    ["Lake Charles", "LA", "LA", 30.23, -93.22, 2],
    ["Portland", "ME", "ME", 43.66, -70.26, 5], ["Bangor", "ME", "ME", 44.80, -68.77, 3], ["Orono", "ME", "ME", 44.88, -68.67, 1],
    ["Baltimore", "MD", "MD", 39.29, -76.61, 10], ["Annapolis", "MD", "MD", 38.98, -76.49, 2], ["Towson", "MD", "MD", 39.40, -76.60, 2],
    ["Frederick", "MD", "MD", 39.41, -77.41, 2], ["Salisbury", "MD", "MD", 38.36, -75.60, 1],
    ["Boston", "MA", "MA", 42.36, -71.06, 10], ["Worcester", "MA", "MA", 42.26, -71.80, 4], ["Springfield", "MA", "MA", 42.10, -72.59, 4],
    ["Lowell", "MA", "MA", 42.63, -71.32, 3], ["Amherst", "MA", "MA", 42.37, -72.52, 1], ["Chestnut Hill", "MA", "MA", 42.33, -71.17, 1],
    ["Minneapolis", "MN", "MN", 44.98, -93.27, 10], ["St. Paul", "MN", "MN", 44.95, -93.09, 6], ["Rochester", "MN", "MN", 44.02, -92.47, 3],
    ["Duluth", "MN", "MN", 46.79, -92.10, 2], ["Mankato", "MN", "MN", 44.16, -94.00, 1],
    ["Jackson", "MS", "MS", 32.30, -90.18, 8], ["Gulfport", "MS", "MS", 30.37, -89.09, 4], ["Hattiesburg", "MS", "MS", 31.33, -89.29, 3],
    ["Starkville", "MS", "MS", 33.45, -88.82, 1], ["Oxford", "MS", "MS", 34.37, -89.52, 1], ["Tupelo", "MS", "MS", 34.26, -88.70, 3],
    ["Greenville", "MS", "MS", 33.41, -91.06, 2],
    ["St. Louis", "MO", "MO", 38.63, -90.20, 10], ["Kansas City", "MO", "MO", 39.10, -94.58, 9], ["Springfield", "MO", "MO", 37.21, -93.29, 4],
    ["Columbia", "MO", "MO", 38.95, -92.33, 2], ["Cape Girardeau", "MO", "MO", 37.31, -89.52, 1],
    ["Billings", "MT", "MT", 45.78, -108.50, 5], ["Missoula", "MT", "MT", 46.87, -113.99, 3], ["Bozeman", "MT", "MT", 45.68, -111.04, 2],
    ["Omaha", "NE", "NE", 41.26, -95.94, 10], ["Lincoln", "NE", "NE", 40.81, -96.68, 5], ["Kearney", "NE", "NE", 40.70, -99.08, 1],
    ["Las Vegas", "NV", "NV", 36.17, -115.14, 10], ["Reno", "NV", "NV", 39.53, -119.81, 5],
    ["Manchester", "NH", "NH", 42.99, -71.46, 6], ["Durham", "NH", "NH", 43.13, -70.93, 1], ["Hanover", "NH", "NH", 43.70, -72.29, 1],
    ["Newark", "NJ", "NJ", 40.74, -74.17, 10], ["Jersey City", "NJ", "NJ", 40.73, -74.08, 6], ["Paterson", "NJ", "NJ", 40.92, -74.17, 5],
    ["Trenton", "NJ", "NJ", 40.22, -74.76, 4], ["Camden", "NJ", "NJ", 39.93, -75.12, 4], ["Piscataway", "NJ", "NJ", 40.55, -74.46, 2],
    ["South Orange", "NJ", "NJ", 40.75, -74.26, 2], ["Princeton", "NJ", "NJ", 40.36, -74.67, 1],
    ["Albuquerque", "NM", "NM", 35.08, -106.65, 10], ["Las Cruces", "NM", "NM", 32.32, -106.76, 3], ["Santa Fe", "NM", "NM", 35.69, -105.94, 2],
    ["Fargo", "ND", "ND", 46.88, -96.79, 6], ["Bismarck", "ND", "ND", 46.81, -100.78, 3], ["Grand Forks", "ND", "ND", 47.93, -97.03, 2],
    ["Oklahoma City", "OK", "OK", 35.47, -97.52, 10], ["Tulsa", "OK", "OK", 36.15, -95.99, 8], ["Norman", "OK", "OK", 35.22, -97.44, 2],
    ["Stillwater", "OK", "OK", 36.12, -97.06, 1], ["Lawton", "OK", "OK", 34.61, -98.39, 2],
    ["Portland", "OR", "OR", 45.52, -122.68, 10], ["Eugene", "OR", "OR", 44.05, -123.09, 3], ["Salem", "OR", "OR", 44.94, -123.04, 3],
    ["Corvallis", "OR", "OR", 44.56, -123.26, 1],
    ["Providence", "RI", "RI", 41.82, -71.41, 8], ["Kingston", "RI", "RI", 41.48, -71.52, 1],
    ["Columbia", "SC", "SC", 34.00, -81.03, 8], ["Charleston", "SC", "SC", 32.78, -79.93, 6], ["Greenville", "SC", "SC", 34.85, -82.39, 6],
    ["Clemson", "SC", "SC", 34.68, -82.84, 1], ["Myrtle Beach", "SC", "SC", 33.69, -78.89, 2], ["Rock Hill", "SC", "SC", 34.92, -81.03, 2],
    ["Orangeburg", "SC", "SC", 33.49, -80.86, 2],
    ["Sioux Falls", "SD", "SD", 43.54, -96.73, 7], ["Rapid City", "SD", "SD", 44.08, -103.23, 3], ["Brookings", "SD", "SD", 44.31, -96.80, 1],
    ["Vermillion", "SD", "SD", 42.78, -96.93, 1],
    ["Memphis", "TN", "TN", 35.15, -90.05, 10], ["Nashville", "TN", "TN", 36.16, -86.78, 9], ["Knoxville", "TN", "TN", 35.96, -83.92, 5],
    ["Chattanooga", "TN", "TN", 35.05, -85.31, 4], ["Murfreesboro", "TN", "TN", 35.85, -86.39, 2], ["Clarksville", "TN", "TN", 36.53, -87.36, 3],
    ["Johnson City", "TN", "TN", 36.31, -82.35, 2], ["Cookeville", "TN", "TN", 36.16, -85.50, 1],
    ["Salt Lake City", "UT", "UT", 40.76, -111.89, 10], ["Provo", "UT", "UT", 40.23, -111.66, 4], ["Ogden", "UT", "UT", 41.22, -111.97, 4],
    ["Logan", "UT", "UT", 41.74, -111.83, 1], ["St. George", "UT", "UT", 37.10, -113.58, 2],
    ["Burlington", "VT", "VT", 44.48, -73.21, 5],
    ["Richmond", "VA", "VA", 37.54, -77.44, 9], ["Norfolk", "VA", "VA", 36.85, -76.29, 8], ["Virginia Beach", "VA", "VA", 36.85, -75.98, 6],
    ["Newport News", "VA", "VA", 37.09, -76.47, 4], ["Hampton", "VA", "VA", 37.03, -76.35, 3], ["Charlottesville", "VA", "VA", 38.03, -78.48, 2],
    ["Blacksburg", "VA", "VA", 37.23, -80.41, 1], ["Roanoke", "VA", "VA", 37.27, -79.94, 3], ["Lynchburg", "VA", "VA", 37.41, -79.14, 2],
    ["Harrisonburg", "VA", "VA", 38.45, -78.87, 1],
    ["Seattle", "WA", "WA", 47.61, -122.33, 10], ["Tacoma", "WA", "WA", 47.25, -122.44, 6], ["Spokane", "WA", "WA", 47.66, -117.43, 5],
    ["Pullman", "WA", "WA", 46.73, -117.18, 1], ["Bellingham", "WA", "WA", 48.75, -122.48, 2], ["Everett", "WA", "WA", 47.98, -122.20, 3],
    ["Charleston", "WV", "WV", 38.35, -81.63, 6], ["Huntington", "WV", "WV", 38.42, -82.45, 4], ["Morgantown", "WV", "WV", 39.63, -79.96, 2],
    ["Wheeling", "WV", "WV", 40.06, -80.72, 2],
    ["Milwaukee", "WI", "WI", 43.04, -87.91, 10], ["Madison", "WI", "WI", 43.07, -89.40, 5], ["Green Bay", "WI", "WI", 44.52, -88.02, 4],
    ["Racine", "WI", "WI", 42.73, -87.78, 2], ["La Crosse", "WI", "WI", 43.80, -91.24, 1],
    ["Cheyenne", "WY", "WY", 41.14, -104.82, 5], ["Casper", "WY", "WY", 42.87, -106.31, 4], ["Laramie", "WY", "WY", 41.31, -105.59, 2],
  ];

  /* ---------------- lookups ---------------- */
  /* a city is known by "Name, ST" (there are several Springfields) */
  const keyOf = (name, state) => `${name}, ${state}`;
  const CITY = {}, AREA = {}, CITIES_IN = {}, nearCache = {};
  function index() {
    for (const k in nearCache) delete nearCache[k];
    for (const k in CITY) delete CITY[k];
    for (const k in AREA) delete AREA[k];
    for (const k in CITIES_IN) delete CITIES_IN[k];
    for (const a of AREAS) { AREA[a.id] = a; CITIES_IN[a.id] = []; }
    for (const [name, state, area, lat, lon, w] of CITIES) {
      const c = { key: keyOf(name, state), name, state, area, lat, lon, w: w || 1 };
      CITY[c.key] = c;
      if (CITIES_IN[area]) CITIES_IN[area].push(c);
    }
    // each area's center (weighted by where its recruits come from) and each city's share of a whole class
    const total = AREAS.reduce((s, a) => s + (CITIES_IN[a.id].length ? a.talent : 0), 0) || 1;
    for (const a of AREAS) {
      const list = CITIES_IN[a.id], wsum = list.reduce((s, c) => s + c.w, 0) || 1;
      a.lat = list.reduce((s, c) => s + c.lat * c.w, 0) / wsum;
      a.lon = list.reduce((s, c) => s + c.lon * c.w, 0) / wsum;
      for (const c of list) c.share = (a.talent / total) * (c.w / wsum);
    }
  }
  index();
  const city = (key) => CITY[key] || null;
  const area = (id) => AREA[id] || null;

  /* ---------------- distance ---------------- */
  /* straight-line ("great circle") miles between two cities, or two {lat, lon} points */
  const R_MILES = 3958.8, rad = (d) => d * Math.PI / 180;
  function miles(a, b) {
    a = typeof a === "string" ? CITY[a] : a; b = typeof b === "string" ? CITY[b] : b;
    if (!a || !b) return null;
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /* "home" / "close" / "far" */
  function level(m) { return m == null ? "far" : m <= CFG.miles.home ? "home" : m <= CFG.miles.close ? "close" : "far"; }

  /* ---------------- drawing a hometown ---------------- */
  /* an area by talent, then a city inside it by weight */
  function pickWeighted(rand, list, w) {
    let total = 0; for (const x of list) total += w(x);
    let r = rand() * total;
    for (const x of list) { if ((r -= w(x)) <= 0) return x; }
    return list[list.length - 1];
  }
  function randomArea(rand) { return pickWeighted(rand, AREAS.filter(a => CITIES_IN[a.id].length), a => a.talent); }
  function randomCity(rand, areaId) {
    const list = CITIES_IN[areaId || randomArea(rand).id];
    return list && list.length ? pickWeighted(rand, list, c => c.w) : null;
  }
  /* a hometown: within "close" range of a city this share of the time (by
     where talent is), otherwise anywhere in the country */
  function hometown(rand, nearKey, localShare = 0.5) {
    const near = CITY[nearKey];
    if (near && rand() < localShare) {
      const list = nearCache[nearKey] || (nearCache[nearKey] = Object.values(CITY).filter(c => miles(near, c) <= CFG.miles.close));
      if (list.length) return pickWeighted(rand, list, c => c.share);
    }
    return randomCity(rand);
  }
  /* a city for a new school inside a set of states: spread over the cities
     (college towns as likely as big ones), leaning a little toward populous
     areas, avoiding cities that already have a school while any are left */
  function placeSchool(rand, states, used = new Set()) {
    const inStates = Object.values(CITY).filter(c => states.includes(c.state));
    const pool = inStates.length ? inStates : Object.values(CITY);
    const fresh = pool.filter(c => !used.has(c.key));
    const list = fresh.length ? fresh : pool;
    const c = pickWeighted(rand, list, c => (1 + 0.15 * c.w) * Math.sqrt(AREA[c.area].talent || 1));
    used.add(c.key);
    return c.key;
  }
  const statesOf = (conf) => (conf && conf.states && conf.states.length ? conf.states : REGION_STATES[conf && conf.region] || REGION_STATES.Midwest);
  const STATES = () => [...new Set(Object.values(CITY).map(c => c.state))].sort();

  /* each area's share of a recruiting class (0–1) */
  function talentShares() {
    const live = AREAS.filter(a => CITIES_IN[a.id].length), total = live.reduce((s, a) => s + a.talent, 0);
    return Object.fromEntries(live.map(a => [a.id, a.talent / total]));
  }

  /* ---------------- drawing ---------------- */
  /* latitude/longitude → x, y on the 975 × 610 US map (ui/us_map.js): the
     Albers USA projection, Alaska and Hawaii as insets, same as the outlines */
  const project = (() => {
    function conic(par0, par1, rotate, center, k, tx, ty) {
      const sy0 = Math.sin(rad(par0)), n = (sy0 + Math.sin(rad(par1))) / 2, c = 1 + sy0 * (2 * n - sy0), r0 = Math.sqrt(c) / n;
      const raw = (l, p) => { const r = Math.sqrt(c - 2 * n * Math.sin(p)) / n; return [r * Math.sin(l * n), r0 - r * Math.cos(l * n)]; };
      const [cx, cy] = raw(rad(center[0]), rad(center[1]));
      return (lat, lon) => {
        let l = rad(lon + rotate); if (l > Math.PI) l -= 2 * Math.PI; if (l < -Math.PI) l += 2 * Math.PI;
        const [px, py] = raw(l, rad(lat));
        return [tx + k * (px - cx), ty - k * (py - cy)];
      };
    }
    const k = 1300, x = 487.5, y = 305;
    const lower48 = conic(29.5, 45.5, 96, [-0.6, 38.7], k, x, y);
    const alaska = conic(55, 65, 154, [-2, 58.5], k * 0.35, x - 0.307 * k, y + 0.201 * k);
    const hawaii = conic(8, 18, 157, [-3, 19.9], k, x - 0.205 * k, y + 0.212 * k);
    return (lat, lon) => lat > 50 && lon < -129 ? alaska(lat, lon) : lat < 23 && lon < -150 ? hawaii(lat, lon) : lower48(lat, lon);
  })();
  /* the point this many miles from a city along a compass bearing (for distance rings) */
  function destination(c, milesOut, bearingDeg) {
    const d = milesOut / R_MILES, b = rad(bearingDeg), la = rad(c.lat), lo = rad(c.lon);
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return { lat: la2 * 180 / Math.PI, lon: lo2 * 180 / Math.PI };
  }

  const areaOf = (key) => (CITY[key] || {}).area || null;
  const label = (key) => { const c = CITY[key]; return c ? `${c.name}, ${c.state}` : (key || "?"); };

  const Geo = { CFG, AREAS, CITIES, CITY, AREA, CITIES_IN, REGION_STATES, STATES, keyOf, city, area, areaOf, label, miles, level,
    randomArea, randomCity, hometown, placeSchool, statesOf, talentShares, project, destination, reindex: index };
  if (typeof module !== "undefined") module.exports = Geo;
  else root.Geo = Geo;
})(typeof window !== "undefined" ? window : globalThis);
