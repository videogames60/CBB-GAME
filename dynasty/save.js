/* =====================================================================
   HOOPS DYNASTY — SAVES

   Packing: the live game keeps direct references to team objects all
   over the place (every ranking row carries its team). Written to JSON
   naively, each reference becomes a full copy of the team and its
   roster — that alone was ~3MB of a 6MB save. pack() writes a team
   reference as {$t: id} and unpack() links it back to the real team.

   Storage: IndexedDB (built into every browser, no setup), with numbered
   slots. localStorage is capped at ~5MB per site; IndexedDB allows a
   share of the disk. A save can also be downloaded as a file and loaded
   back, which has no size limit at all and doubles as a backup.

   Compression: slots and downloaded files are gzipped with the browser's
   built-in CompressionStream (about 7× smaller: a 50-season Full league
   save goes from ~25MB to ~4MB). Saves from before, plain JSON, still load:
   a slot says whether it's compressed, and a file is recognized by gzip's
   first two bytes. Browsers without CompressionStream save plain JSON.
   ===================================================================== */
(function (root) {
  const DB_NAME = "hoopsDynasty", STORE = "saves", VERSION = 1;
  const SLOTS = 5;
  const LEGACY_KEY = "hoopsDynasty";       // the old single localStorage save

  /* ---------------- pack / unpack ---------------- */
  function pack(lg, se, extra = {}) {
    const teamSet = new Set(lg.teams);
    const sameReport = lg.pendingReport && lg.pendingReport === lg.lastOffseason;
    const state = {
      v: 2,
      lg: { ...lg, byId: undefined, pendingReport: sameReport ? "$last" : lg.pendingReport },
      se: { ...se, byDay: undefined },
      ...extra,
    };
    return JSON.stringify(state, function (key, value) {
      // the league's own team list is the one real copy; every other reference is an id
      if (value && typeof value === "object" && teamSet.has(value) && this !== state.lg.teams) return { $t: value.id };
      return value;
    });
  }

  function unpack(json) {
    const d = typeof json === "string" ? JSON.parse(json) : json;
    const lg = d.lg;
    lg.byId = Object.fromEntries(lg.teams.map(t => [t.id, t]));
    const relink = (o) => {
      if (!o || typeof o !== "object") return o;
      if (o.$t && Object.keys(o).length === 1) return lg.byId[o.$t] || o;
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) o[i] = relink(o[i]); return o; }
      for (const k in o) o[k] = relink(o[k]);
      return o;
    };
    // teams themselves never hold team references, so only walk the rest
    for (const k in lg) if (k !== "teams" && k !== "byId") lg[k] = relink(lg[k]);
    d.se = relink(d.se);
    if (lg.pendingReport === "$last") lg.pendingReport = lg.lastOffseason;
    return d;
  }

  /* ---------------- gzip (the browser's own) ---------------- */
  const canZip = () => typeof CompressionStream !== "undefined" && typeof Blob !== "undefined" && typeof Response !== "undefined";
  async function gzip(str) {
    if (!canZip()) return null;
    const s = new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function gunzip(bytes) {
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(s).text();
  }
  const isGzip = (b) => b && b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;
  const sizeOf = (d) => d == null ? 0 : (d.byteLength != null ? d.byteLength : d.length);

  /* ---------------- IndexedDB, promise-wrapped ---------------- */
  function openDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("This browser has no IndexedDB."));
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "slot" }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function tx(mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode), st = t.objectStore(STORE);
      let out;
      Promise.resolve(fn(st, (v) => { out = v; })).catch(reject);
      t.oncomplete = () => { db.close(); resolve(out); };
      t.onerror = () => { db.close(); reject(t.error); };
      t.onabort = () => { db.close(); reject(t.error || new Error("Save aborted (storage full?)")); };
    }));
  }
  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  /* meta is what the slot list shows without loading the whole save */
  function metaOf(lg, se) {
    const t = lg.teams.find(x => x.isUser) || lg.teams[0];
    return { team: t.name, mascot: t.mascot, color: t.color, abbr: t.abbr, year: lg.season,
             record: `${t.record.w}-${t.record.l}`, day: se ? se.day : 0, savedAt: Date.now() };
  }

  async function listSlots() {
    const rows = await tx("readonly", (st, set) => reqP(st.getAll()).then(set));
    const bySlot = Object.fromEntries((rows || []).map(r => [r.slot, r]));
    return Array.from({ length: SLOTS }, (_, i) => {
      const r = bySlot[i + 1];
      return r ? { slot: i + 1, meta: r.meta, size: sizeOf(r.data), raw: r.raw || sizeOf(r.data) } : { slot: i + 1, empty: true };
    });
  }
  async function saveSlot(slot, lg, se, extra) {
    const data = pack(lg, se, extra);
    const z = await gzip(data);
    await tx("readwrite", (st) => reqP(st.put({ slot, meta: metaOf(lg, se), data: z || data, z: !!z, raw: data.length })));
    return { size: z ? z.length : data.length, raw: data.length };
  }
  async function loadSlot(slot) {
    const r = await tx("readonly", (st, set) => reqP(st.get(slot)).then(set));
    if (!r) throw new Error(`Slot ${slot} is empty.`);
    return unpack(r.z || isGzip(r.data) ? await gunzip(r.data) : r.data);
  }
  async function deleteSlot(slot) { await tx("readwrite", (st) => reqP(st.delete(slot))); }

  /* the old localStorage save moves into the first empty slot, once */
  async function migrateLegacy() {
    let raw = null;
    try { raw = localStorage.getItem(LEGACY_KEY); } catch (e) { return null; }
    if (!raw) return null;
    const slots = await listSlots();
    const free = slots.find(s => s.empty);
    if (!free) return null;
    const d = unpack(raw);                       // old format: plain JSON, same shape
    await saveSlot(free.slot, d.lg, d.se, { log: d.log, tab: d.tab });
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) {}
    return free.slot;
  }

  /* ---------------- files ---------------- */
  async function download(lg, se, extra) {
    const json = pack(lg, se, extra);
    const z = await gzip(json), data = z || json;
    const t = lg.teams.find(x => x.isUser) || lg.teams[0];
    const name = `${(t.name || "dynasty").replace(/[^A-Za-z0-9]+/g, "-")}-${lg.season}-day${se ? se.day : 0}.hoops${z ? "" : ".json"}`;
    const url = URL.createObjectURL(new Blob([data], { type: z ? "application/gzip" : "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { size: data.length, name };
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = async () => {
        try {
          const bytes = new Uint8Array(fr.result);
          const text = isGzip(bytes) ? await gunzip(bytes) : new TextDecoder().decode(bytes);   // compressed (new) or plain JSON (older saves)
          resolve(unpack(text));
        } catch (e) { reject(new Error("That file isn't a Hoops Dynasty save.")); }
      };
      fr.onerror = () => reject(fr.error);
      fr.readAsArrayBuffer(file);
    });
  }

  const fmtSize = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`;

  const Save = { SLOTS, pack, unpack, gzip, gunzip, isGzip, listSlots, saveSlot, loadSlot, deleteSlot, migrateLegacy, download, readFile, metaOf, fmtSize };
  if (typeof module !== "undefined") module.exports = Save;
  else root.Save = Save;
})(typeof window !== "undefined" ? window : globalThis);
