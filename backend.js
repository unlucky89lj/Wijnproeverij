/* Wijnproeverij — backend voor de GitHub-versie (map wijn/).
   Biedt dezelfde window.claude.use(...) als op claude.ai, zodat de app ongewijzigd draait.
   - Met firebase-config.js (window.FIREBASE_CONFIG): echte gedeelde database, inloggen, meerdere proeverijen.
   - Zonder: voorbeeldmodus, alles blijft op dit apparaat (localStorage). */
(function () {
  "use strict";
  const SHARED = new Set(["catalog_extra", "prijzen"]); // gedeeld door alle proeverijen
  const PFX = "wijn_"; // eigen verzamelingen, zodat bier en wijn één Firebase-project kunnen delen
  const qs = new URLSearchParams(location.search);
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch (e) { return d } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } } };
  const rid = (n = 6) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
  const BP = window.BP = { mode: "", group: null, groups: [], uid: null, name: "", listeners: [] };

  /* ---------- kleine helpers voor het startscherm ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function gate(html) {
    let g = document.getElementById("bp-gate");
    if (!g) { g = document.createElement("div"); g.id = "bp-gate"; document.body.appendChild(g) }
    g.innerHTML = `<div class="bp-card"><div class="bp-brand">WIJN<span>PROEVERIJ</span></div>${html}</div>`; g.hidden = false; return g;
  }
  function closeGate() { const g = document.getElementById("bp-gate"); if (g) g.hidden = true }
  const css = document.createElement("style");
  css.textContent = `#bp-gate{position:fixed;inset:0;z-index:100;background:var(--bg,#F2EFF0);display:grid;place-items:center;padding:16px;overflow:auto}
  #bp-gate[hidden]{display:none}.bp-card{width:100%;max-width:420px;background:var(--surface,#fff);border:1px solid var(--line,#D6CCD1);border-radius:14px;padding:22px;display:flex;flex-direction:column;gap:12px;font-family:"Public Sans",system-ui,sans-serif;color:var(--ink,#1E1519)}
  .bp-brand{font:800 30px "Cormorant Garamond",Georgia,serif;letter-spacing:.02em}.bp-brand span{color:var(--amber,#8E1630)}
  .bp-card h2{margin:4px 0 0;font:800 20px "Cormorant Garamond",Georgia,serif;text-transform:uppercase}.bp-card p{margin:0;color:var(--muted,#6C5F66);font-size:14px}
  .bp-btn{appearance:none;border:0;border-radius:999px;padding:11px 16px;font:600 15px inherit;cursor:pointer;background:var(--amber,#8E1630);color:#fff}
  .bp-btn.ghost{background:transparent;color:var(--ink,#1E1519);border:1px solid var(--line,#D6CCD1)}
  .bp-row{display:flex;gap:8px;flex-wrap:wrap}.bp-in{flex:1;min-width:0;padding:10px 12px;border:1px solid var(--line,#D6CCD1);border-radius:10px;font:15px inherit;background:var(--bg,#F2EFF0);color:inherit}
  .bp-g{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;padding:12px 14px;border:1px solid var(--line,#D6CCD1);border-radius:10px;background:var(--bg,#F2EFF0);cursor:pointer;font:inherit;color:inherit}
  .bp-g b{font-size:15px}.bp-g small{color:var(--muted,#6C5F66)}.bp-err{color:#A6352A;font-size:13px}
  .bp-banner{position:relative;z-index:1;background:#F3DCE2;color:#5a1022;font:600 12px "Public Sans",system-ui,sans-serif;padding:6px 12px;text-align:center}`;
  document.head.appendChild(css);

  /* ================================================================
     VOORBEELDMODUS (geen Firebase): Firestore-achtige opslag op dit apparaat
     ================================================================ */
  function demoBackend() {
    BP.mode = "demo";
    const KEY = "wp-demo-v1";
    let store = LS.get(KEY, { groups: {}, root: {} });
    if (!Object.keys(store.groups).length) {
      const gid = "demo";
      store.groups[gid] = { naam: "Mijn proeverij (voorbeeld)", owner: "demo-jij", admins: ["demo-jij"], members: ["demo-jij"], code: rid(), at: Date.now(), data: {} };
      LS.set(KEY, store);
    }
    const save = () => LS.set(KEY, store);
    const subs = new Set();
    const notify = () => setTimeout(() => subs.forEach(f => f()), 0);
    const cur = () => store.groups[BP.group.id];
    function bucket(col) { const b = SHARED.has(col) ? store.root : cur().data; return b[col] || (b[col] = {}) }
    const snapDoc = (col, id) => { const v = bucket(col)[id]; return { id, exists: !!v, data: () => v ? JSON.parse(JSON.stringify(v)) : undefined } };
    function collection(col) {
      let ord = null, lim = 1e9;
      const run = () => { let ids = Object.keys(bucket(col)); let docs = ids.map(id => snapDoc(col, id)); if (ord) docs.sort((a, b) => { const x = a.data()[ord[0]], y = b.data()[ord[0]]; return (x > y ? 1 : x < y ? -1 : 0) * (ord[1] === "desc" ? -1 : 1) }); docs = docs.slice(0, lim); return { docs, size: docs.length, empty: !docs.length } };
      const q = { orderBy(f, d) { ord = [f, d || "asc"]; return q }, limit(n) { lim = n; return q }, where() { return q }, get: async () => run(), doc: id => docRef(col + "/" + id),
        onSnapshot(cb) { const f = () => { try { cb(run()) } catch (e) { } }; subs.add(f); setTimeout(f, 0); return () => subs.delete(f) } };
      return q;
    }
    function docRef(path) {
      const [col, id] = path.split("/");
      return { id, path, get: async () => snapDoc(col, id),
        set: async v => { bucket(col)[id] = JSON.parse(JSON.stringify(v)); save(); notify() },
        update: async v => { const o = bucket(col)[id]; if (!o) throw Object.assign(new Error("not-found"), { code: "not-found" }); Object.assign(o, JSON.parse(JSON.stringify(v))); save(); notify() },
        delete: async () => { delete bucket(col)[id]; save(); notify() },
        onSnapshot(cb) { const f = () => { try { cb(snapDoc(col, id)) } catch (e) { } }; subs.add(f); setTimeout(f, 0); return () => subs.delete(f) } };
    }
    BP.uid = "demo-jij"; BP.name = "Jij";
    BP.listGroups = async () => Object.entries(store.groups).map(([id, g]) => ({ id, naam: g.naam, owner: g.owner, admins: g.admins, members: g.members, code: g.code }));
    BP.createGroup = async naam => { const id = "g" + rid(8).toLowerCase(); store.groups[id] = { naam, owner: BP.uid, admins: [BP.uid], members: [BP.uid], code: rid(), at: Date.now(), data: {} }; save(); return id };
    BP.joinByCode = async code => { const e = Object.entries(store.groups).find(([, g]) => g.code === code.trim().toUpperCase()); if (!e) throw new Error("Code niet gevonden"); return { id: e[0], pending: false } };
    BP.readGroup = async (gid, col) => { const g = store.groups[gid]; const b = g && g.data[col] || {}; return Object.entries(b).map(([id, v]) => ({ id, ...v })) };
    BP.requests = async () => [];
    BP.signOut = async () => { };
    return {
      db: { collection, doc: docRef },
      user: { id: async () => BP.uid, can: async () => true, name: async () => "", isOwner: async () => cur().owner === BP.uid, profiles: async ids => Object.fromEntries(ids.map(i => [i, { id: i, name: "", avatarUrl: "" }])) },
      room: null, sample: null, downloads: null
    };
  }

  /* ================================================================
     FIREBASE: echte gedeelde database met inloggen en meerdere proeverijen
     ================================================================ */
  async function firebaseBackend() {
    BP.mode = "firebase";
    const app = firebase.initializeApp(window.FIREBASE_CONFIG);
    const auth = firebase.auth(), fs = firebase.firestore();
    const user = await new Promise(res => { const off = auth.onAuthStateChanged(u => { off(); res(u) }) });
    if (!user) {
      await new Promise(() => {
        gate(`<h2>Inloggen</h2><p>Log in om met je groep te proeven. Je naam en profielfoto zie je straks bij de uitslagen.</p>
          <button class="bp-btn" id="bp-google">Inloggen met Google</button>
          <div class="bp-row"><input class="bp-in" id="bp-mail" type="email" placeholder="of je e-mailadres"><button class="bp-btn ghost" id="bp-link">Stuur inloglink</button></div>
          <p class="bp-err" id="bp-err"></p>`);
        document.getElementById("bp-google").onclick = async () => { try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); location.reload() } catch (e) { try { await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()) } catch (x) { document.getElementById("bp-err").textContent = "Inloggen mislukt: " + (x.message || x) } } };
        document.getElementById("bp-link").onclick = async () => { const m = document.getElementById("bp-mail").value.trim(); if (!m) return; try { await auth.sendSignInLinkToEmail(m, { url: location.origin + location.pathname, handleCodeInApp: true }); LS.set("bp-mail", m); document.getElementById("bp-err").textContent = "Check je mail en tik op de link." } catch (e) { document.getElementById("bp-err").textContent = "Versturen mislukt: " + (e.message || e) } };
      });
    }
    BP.uid = user.uid; BP.name = user.displayName || (user.email || "").split("@")[0];
    await fs.doc("users/" + user.uid).set({ naam: BP.name, foto: user.photoURL || "", at: Date.now() }, { merge: true });
    const G = id => fs.doc(PFX + "groups/" + id);
    BP.listGroups = async () => { const s = await fs.collection(PFX + "groups").where("members", "array-contains", BP.uid).get(); return s.docs.map(d => ({ id: d.id, ...d.data() })) };
    BP.createGroup = async naam => { const ref = fs.collection(PFX + "groups").doc(); await ref.set({ naam, owner: BP.uid, admins: [BP.uid], members: [BP.uid], code: rid(), at: Date.now() }); await fs.doc(PFX + "codes/" + (await ref.get()).data().code).set({ gid: ref.id }); return ref.id };
    BP.joinByCode = async code => { const c = await fs.doc(PFX + "codes/" + code.trim().toUpperCase()).get(); if (!c.exists) throw new Error("Code niet gevonden"); const gid = c.data().gid; await fs.doc(`${PFX}groups/${gid}/requests/${BP.uid}`).set({ naam: BP.name, foto: user.photoURL || "", at: Date.now() }); return { id: gid, pending: true } };
    BP.requests = async () => { if (!BP.group || !(BP.group.admins || []).includes(BP.uid)) return []; const s = await fs.collection(`${PFX}groups/${BP.group.id}/requests`).get(); return s.docs.map(d => ({ uid: d.id, ...d.data() })) };
    BP.approve = async uid => { await G(BP.group.id).update({ members: firebase.firestore.FieldValue.arrayUnion(uid) }); await fs.doc(`${PFX}groups/${BP.group.id}/requests/${uid}`).delete() };
    BP.reject = async uid => fs.doc(`${PFX}groups/${BP.group.id}/requests/${uid}`).delete();
    BP.removeMember = async uid => G(BP.group.id).update({ members: firebase.firestore.FieldValue.arrayRemove(uid), admins: firebase.firestore.FieldValue.arrayRemove(uid) });
    BP.readGroup = async (gid, col) => { const s = await fs.collection(`${PFX}groups/${gid}/${col}`).limit(1000).get(); return s.docs.map(d => ({ id: d.id, ...d.data() })) };
    BP.signOut = async () => { await auth.signOut(); location.reload() };
    const P = path => { const col = path.split("/")[0]; return SHARED.has(col) ? PFX + path : `${PFX}groups/${BP.group.id}/${path}` };
    const evRef = () => fs.collection(`${PFX}groups/${BP.group.id}/events`);
    const t0 = Date.now();
    return {
      db: { collection: c => fs.collection(P(c)), doc: p => fs.doc(P(p)) },
      user: { id: async () => BP.uid, can: async () => true, name: async () => BP.name, isOwner: async () => BP.group.owner === BP.uid,
        profiles: async ids => { const o = {}; await Promise.all(ids.slice(0, 64).map(async i => { try { const d = await fs.doc("users/" + i).get(); if (d.exists) o[i] = { id: i, name: d.data().naam || "", avatarUrl: d.data().foto || "" } } catch (e) { } })); return o } },
      room: { emit: (type, data) => evRef().add({ type, data: data || {}, by: BP.uid, at: Date.now() }).catch(() => { }),
        on: (type, cb) => evRef().where("at", ">", t0).onSnapshot(s => s.docChanges().forEach(ch => { const v = ch.doc.data(); if (ch.type === "added" && v.type === type && v.by !== BP.uid) cb(v.data, { from: v.by }) }), () => { }) },
      sample: null, downloads: null
    };
  }

  /* ---------- proeverij kiezen (startscherm) ---------- */
  async function chooseGroup() {
    const want = qs.get("g") || LS.get("wp-group", "");
    let list = await BP.listGroups();
    BP.groups = list;
    const hit = list.find(g => g.id === want) || (list.length === 1 ? list[0] : null);
    if (hit && !qs.has("kies")) return hit;
    return await new Promise(res => {
      const draw = (msg) => {
        gate(`<h2>Mijn proeverijen</h2><p>Kies een proeverij, maak een nieuwe aan of doe mee met een code.</p>
          ${list.map(g => `<button class="bp-g" data-g="${esc(g.id)}"><span><b>${esc(g.naam)}</b><br><small>${(g.members || []).length} leden${g.owner === BP.uid ? " · jij bent beheerder" : ""}</small></span><span>→</span></button>`).join("") || `<p>Je zit nog in geen enkele proeverij.</p>`}
          <div class="bp-row"><input class="bp-in" id="bp-new" maxlength="40" placeholder="Naam nieuwe proeverij"><button class="bp-btn" id="bp-create">Aanmaken</button></div>
          <div class="bp-row"><input class="bp-in" id="bp-code" maxlength="8" placeholder="Code van een vriend"><button class="bp-btn ghost" id="bp-join">Meedoen</button></div>
          <p class="bp-err">${esc(msg || "")}</p>${BP.mode === "firebase" ? `<button class="bp-btn ghost" id="bp-out">Uitloggen</button>` : ""}`);
        document.querySelectorAll("[data-g]").forEach(b => b.onclick = () => res(list.find(g => g.id === b.dataset.g)));
        document.getElementById("bp-create").onclick = async () => { const n = document.getElementById("bp-new").value.trim(); if (!n) return; const id = await BP.createGroup(n); list = await BP.listGroups(); BP.groups = list; res(list.find(g => g.id === id)) };
        document.getElementById("bp-join").onclick = async () => { const c = document.getElementById("bp-code").value; if (!c.trim()) return; try { const r = await BP.joinByCode(c); if (r.pending) draw("Aanvraag verstuurd. Zodra de beheerder je goedkeurt, staat de proeverij in deze lijst."); else { list = await BP.listGroups(); res(list.find(g => g.id === r.id)) } } catch (e) { draw(e.message || "Meedoen mislukt") } };
        const o = document.getElementById("bp-out"); if (o) o.onclick = BP.signOut;
      };
      draw();
    });
  }
  BP.switchTo = gid => { LS.set("wp-group", gid); const u = new URL(location.href); u.searchParams.delete("kies"); u.searchParams.set("g", gid); location.href = u.toString() };
  BP.chooser = () => { const u = new URL(location.href); u.searchParams.set("kies", "1"); location.href = u.toString() };

  /* ---------- opstarten: de app wacht op window.claude ---------- */
  let resolveCaps; const caps = new Promise(r => resolveCaps = r);
  window.claude = { use: async n => { const c = await caps; if (!(n in c)) throw Object.assign(new Error("unavailable"), { code: "unavailable" }); return c[n] } };
  (async () => {
    try {
      let c;
      if (window.FIREBASE_CONFIG && window.firebase) c = await firebaseBackend(); else c = demoBackend();
      BP.group = await chooseGroup(); LS.set("wp-group", BP.group.id); closeGate();
      if (BP.mode === "demo") { const b = document.createElement("div"); b.className = "bp-banner"; b.textContent = "Voorbeeldmodus: alles blijft op dit apparaat tot de database gekoppeld is."; document.body.prepend(b) }
      document.title = "Wijnproeverij · " + BP.group.naam;
      resolveCaps(c);
    } catch (e) { gate(`<h2>Er ging iets mis</h2><p>${esc(e.message || e)}</p><button class="bp-btn" onclick="location.reload()">Opnieuw</button>`) }
  })();
})();
