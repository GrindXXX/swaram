// Ported from "Newspaper app design scope/civic-terrain.html" — the one file
// in that design deck that was a real working prototype (D3 + topojson)
// rather than a static mock, so it's ported close to verbatim rather than
// rebuilt. Two things worth knowing before trusting what's on screen:
//
//   1. Geometry is real (fetched live from a public India-boundaries CDN),
//      but every number layered on top — issues, pressure, resolution rate —
//      is generated from a hash of the region's name (see metrics() below).
//      The original file stamped "SAMPLE FIGURES" on itself for exactly this
//      reason, and this port keeps that stamp rather than hiding it.
//   2. It only goes state -> district. There is no ward-level geometry to
//      descend into (that's the same gap noted in the design review: LGD
//      data bottoms out at the ULB, no boundary files in the repo), so
//      "click a district" opens a ward *ledger* with invented body names,
//      not real ward boundaries.
//
// initCivicTerrain(root) builds the whole thing inside `root` and returns a
// cleanup function (cancels the animation loop, removes window listeners,
// clears the subtree) so React can call it from a useEffect.

import * as d3 from 'd3';
import { merge as topojsonMerge } from 'topojson-client';

const CDN = 'https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@2884453/';

const MODES = [
  { id: 'issues', label: 'ISSUES RAISED', fmt: (v) => fmtN(v) },
  { id: 'pending', label: 'PENDING ISSUES', fmt: (v) => fmtN(v) },
  { id: 'pressure', label: 'CIVIC PRESSURE', fmt: (v) => v + ' / 100' },
  { id: 'affected', label: 'PEOPLE AFFECTED', fmt: (v) => fmtM(v) },
  { id: 'rate', label: 'RESOLUTION RATE', fmt: (v) => v + '%' },
  { id: 'days', label: 'AVG RESOLUTION TIME', fmt: (v) => v + ' days' },
];

const SLUG = {
  'Dadra and Nagar Haveli and Daman and Diu': 'dnh-and-dd',
  'Dadra & Nagar Haveli and Daman & Diu': 'dnh-and-dd',
  'NCT of Delhi': 'delhi',
  Delhi: 'delhi',
  'Jammu & Kashmir': 'jammu-and-kashmir',
  'Andaman & Nicobar Island': 'andaman-and-nicobar-islands',
  'Andaman and Nicobar': 'andaman-and-nicobar-islands',
  'Arunanchal Pradesh': 'arunachal-pradesh',
  Orissa: 'odisha',
  Uttaranchal: 'uttarakhand',
};

const NAMEKEYS = ['district', 'DISTRICT', 'dtname', 'dt_name', 'DISTRICT_N', 'NAME_2', 'st_nm', 'ST_NM', 'state', 'STATE', 'NAME_1', 'name', 'NAME', 'Name'];

const fmtN = (n) => Math.round(n).toLocaleString('en-IN');
const fmtM = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : n);
const cssEsc = (s) => s.replace(/"/g, '\\"');

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function metrics(name, scale) {
  const a = hash(name);
  const b = hash(name + '·b');
  const c = hash(name + '·c');
  const issues = Math.round((300 + a * 11700) * scale);
  const rate = Math.round(38 + b * 52);
  const resolved = Math.round((issues * rate) / 100);
  const pending = issues - resolved;
  const pressure = Math.max(12, Math.min(97, Math.round(28 + c * 62 + (pending / Math.max(issues, 1)) * 22)));
  return { name, issues, pending, resolved, pressure, affected: Math.round(issues * (60 + a * 260)), rate, days: +(1.6 + b * 9.4).toFixed(1) };
}

const valueOf = (m, mode) => ({ issues: m.issues, pending: m.pending, pressure: m.pressure, affected: m.affected, rate: m.rate, days: m.days })[mode];

const SKELETON = `
<div id="sheet">
  <aside id="rail">
    <div class="ct-masthead">
      <div class="t">SWARAM</div>
      <div class="s">THE CIVIC TERRAIN</div>
      <div class="d">SURVEY OF CIVIC RECORDS · 15 AUG 2026</div>
    </div>
    <div class="ct-lbl" id="pulseLbl">INDIA'S CIVIC PULSE</div>
    <div class="ct-pulse-grid" id="pulse"></div>
    <div class="ct-lbl">COLUMNS SHOW</div>
    <div class="ct-modes" id="modes"></div>
    <div class="ct-legend">
      <div style="font:400 8px 'Courier Prime',monospace;letter-spacing:.22em;color:var(--ct-faded)">HOW TO READ THIS SHEET</div>
      <div class="row"><span style="width:56px;flex:none">MAP</span><span>Flat printed geography</span></div>
      <div class="row"><span style="width:56px;flex:none">COLUMN</span><span id="legHeight">Issues raised</span></div>
      <div class="row"><span style="width:56px;flex:none">INK</span><div class="ct-ramp"></div></div>
      <div class="row" style="margin-top:2px"><span style="width:56px;flex:none"></span><span style="font-size:8px">LOW PRESSURE → HIGH PRESSURE</span></div>
      <div class="row"><span style="width:56px;flex:none">CLICK</span><span>Descend a level · drag to pan</span></div>
    </div>
    <div class="ct-lbl" id="rankLbl">RANKED</div>
    <div id="ranks"></div>
    <div class="ct-colophon">
      GEOMETRY: PUBLIC ADMINISTRATIVE BOUNDARIES, INDIA.<br>
      FIGURES ARE ILLUSTRATIVE SAMPLE DATA FOR DESIGN REVIEW.<br>
      SET IN COURIER PRIME &amp; SPECIAL ELITE.
    </div>
  </aside>

  <main id="stage">
    <div class="ct-crumb" id="crumb"></div>
    <div id="ct-title"><div class="h">THE REPUBLIC<br>IN COLUMNS</div><div class="k">CLICK ANY STATE TO DESCEND</div></div>
    <svg id="map"></svg>
    <div id="ct-tip"></div>
    <div id="ct-ward"><span class="close" id="wardClose">✕</span><div class="n"></div><div class="k"></div><div class="rows"></div></div>
    <div id="ct-sample">SAMPLE FIGURES</div>
    <div id="ct-scalestamp">SURVEY SHEET № 33</div>
    <div id="ct-loading">DRAWING THE REPUBLIC…</div>
  </main>
</div>`;

export function initCivicTerrain(root) {
  root.innerHTML = SKELETON;

  let NKEY = null;
  function pickNameKey(feats) {
    let best = null;
    let bestN = 0;
    for (const k of NAMEKEYS) {
      const vals = new Set();
      feats.forEach((f) => {
        const v = f.properties && f.properties[k];
        if (v) vals.add(String(v));
      });
      if (vals.size > bestN) {
        bestN = vals.size;
        best = k;
      }
    }
    NKEY = bestN > 1 ? best : null;
  }
  const nameOf = (p) => {
    if (NKEY && p && p[NKEY]) return String(p[NKEY]);
    for (const k of NAMEKEYS) {
      if (p && p[k]) return String(p[k]);
    }
    return 'UNNAMED';
  };
  const slugify = (n) => SLUG[n] || n.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  let mode = 'issues';
  let level = 'india';
  let current = null;
  let features = [];
  let data = new Map();
  let bars = [];
  let heights = new Map();
  let targets = new Map();
  let raf = null;
  const tilt = 0.56;
  let pan = { x: 0, y: 0 };
  let drag = null;
  let off = { x: 0, y: 0 };
  let BW = 9;
  let cap = 120;
  let destroyed = false;

  const svg = d3.select(root.querySelector('#map'));
  const gMap = svg.append('g').attr('id', 'mapLayer');
  const gBars = svg.append('g').attr('id', 'barLayer');
  const tip = root.querySelector('#ct-tip');
  const stage = root.querySelector('#stage');

  const modesEl = root.querySelector('#modes');
  MODES.forEach((m) => {
    const b = document.createElement('button');
    b.className = 'ct-mode';
    b.setAttribute('aria-pressed', String(m.id === mode));
    b.dataset.id = m.id;
    b.innerHTML = '<span>' + m.label + '</span><span class="m">' + (m.id === mode ? '●' : '○') + '</span>';
    b.onclick = () => setMode(m.id);
    modesEl.appendChild(b);
  });

  function setMode(id) {
    mode = id;
    [...modesEl.children].forEach((b) => {
      const on = b.dataset.id === id;
      b.setAttribute('aria-pressed', String(on));
      b.lastChild.textContent = on ? '●' : '○';
    });
    root.querySelector('#legHeight').textContent = MODES.find((m) => m.id === id).label.toLowerCase().replace(/^./, (c) => c.toUpperCase());
    computeTargets();
    animate();
    renderRanks();
  }

  function simplePath(f, proj, tol) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let d = '';
    for (const poly of polys)
      for (const ring of poly) {
        let out = [];
        let last = null;
        for (const c of ring) {
          const p = proj(c);
          if (!p || !isFinite(p[0])) continue;
          if (!last || Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) > tol) {
            out.push(p);
            last = p;
          }
        }
        if (out.length < 4) continue;
        let minx = 1e9,
          maxx = -1e9,
          miny = 1e9,
          maxy = -1e9;
        out.forEach((p) => {
          minx = Math.min(minx, p[0]);
          maxx = Math.max(maxx, p[0]);
          miny = Math.min(miny, p[1]);
          maxy = Math.max(maxy, p[1]);
        });
        if (maxx - minx < 2 && maxy - miny < 2) continue;
        d += 'M' + out.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z';
      }
    return d;
  }
  function applyMapTransform() {
    gMap.attr('transform', 'translate(' + (off.x + pan.x) + ',' + (off.y + pan.y) + ') scale(1,' + tilt + ')');
    gBars.attr('transform', 'translate(' + (off.x + pan.x) + ',' + (off.y + pan.y) + ')');
  }

  async function load(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url);
    return r.json();
  }

  async function showIndia() {
    loading(true, 'DRAWING THE REPUBLIC…');
    const topo = await load(CDN + 'topojson/india.json');
    const objName = Object.keys(topo.objects)[0];
    const geoms = topo.objects[objName].geometries;
    const sk = ['st_nm', 'ST_NM', 'state', 'STATE', 'STATE_NAME', 'NAME_1'].find((k) => geoms[0].properties && geoms[0].properties[k]) || 'st_nm';
    const groups = new Map();
    geoms.forEach((g) => {
      const n = (g.properties && g.properties[sk]) || 'UNNAMED';
      (groups.get(n) || groups.set(n, []).get(n)).push(g);
    });
    if (destroyed) return;
    const fc = {
      type: 'FeatureCollection',
      features: [...groups].map(([n, gs]) => ({ type: 'Feature', properties: { st_nm: n }, geometry: topojsonMerge(topo, gs) })),
    };
    level = 'india';
    current = null;
    BW = 8;
    draw(fc, 1);
    setTitle('THE REPUBLIC<br>IN COLUMNS', 'CLICK ANY STATE TO DESCEND');
    crumbs(fc.features.length);
    loading(false);
  }

  async function showState(name) {
    loading(true, 'SURVEYING ' + name.toUpperCase() + '…');
    try {
      const fc = await load(CDN + 'geojson/states/' + slugify(name) + '.geojson');
      if (destroyed) return;
      level = 'state';
      current = name;
      BW = 6;
      draw(fc, 0.16);
      setTitle(name.toUpperCase(), 'DISTRICT COLUMNS · CLICK ONE FOR ITS WARD LEDGER');
      crumbs(fc.features.length);
    } catch (e) {
      loading(true, 'NO DISTRICT SHEET FILED FOR ' + name.toUpperCase());
      setTimeout(() => loading(false), 1500);
      return;
    }
    loading(false);
  }

  function draw(fc, scale) {
    pan = { x: 0, y: 0 };
    features = fc.features.filter((f) => f.geometry);
    pickNameKey(features);
    data = new Map();
    features.forEach((f) => {
      const n = nameOf(f.properties);
      data.set(n, metrics(n, scale));
    });

    const w = stage.clientWidth;
    const h = stage.clientHeight;
    svg.attr('viewBox', [0, 0, w, h]);
    const boxW = w * 0.72;
    const boxH = (h / tilt) * 0.7;
    const proj = d3.geoMercator().fitExtent(
      [
        [0, 0],
        [boxW, boxH],
      ],
      fc,
    );
    off = { x: (w - boxW) / 2 + w * 0.11, y: (h - boxH * tilt) / 2 + h * 0.17 };
    applyMapTransform();

    const geoPath = d3.geoPath(proj);
    gMap.selectAll('*').remove();
    gBars.selectAll('*').remove();
    heights = new Map();
    bars = [];

    const ps = [...data.values()].map((m) => m.pressure);
    const land = d3.scaleLinear().domain([d3.min(ps), d3.max(ps)]).range(['#DEC69A', '#C9A470']).clamp(true);
    const regions = gMap
      .selectAll('g.reg')
      .data(features, (f) => nameOf(f.properties))
      .join('g')
      .attr('class', 'reg')
      .attr('data-n', (f) => nameOf(f.properties));
    regions
      .append('path')
      .attr('d', (f) => simplePath(f, proj, 1.0))
      .attr('fill', (f) => land(data.get(nameOf(f.properties)).pressure));

    computeTargets();
    const rows = features
      .map((f) => {
        const n = nameOf(f.properties);
        let c = geoPath.centroid(f);
        if (!isFinite(c[0])) c = [boxW / 2, boxH / 2];
        return { n, x: c[0], y: c[1] * tilt, m: data.get(n) };
      })
      .sort((a, b) => a.y - b.y);
    const topY = off.y + d3.min(rows, (r) => r.y);
    cap = Math.max(60, topY - 26);
    computeTargets();

    rows.forEach((r) => {
      const g = gBars.append('g').attr('class', 'barGroup').attr('transform', 'translate(' + r.x + ',' + r.y + ')');
      g.append('ellipse').attr('rx', BW * 0.62).attr('ry', BW * 0.28).attr('fill', 'rgba(74,58,34,.28)');
      g.append('line').attr('class', 'stem').attr('y1', 0).attr('y2', 0);
      const body = g.append('rect').attr('x', -BW / 2).attr('width', BW).attr('height', 0).attr('y', 0).attr('stroke', '#3b2f1c').attr('stroke-width', 0.8);
      const capPath = g
        .append('path')
        .attr('d', 'M' + -BW / 2 + ',0 L0,' + -BW * 0.34 + ' L' + BW / 2 + ',0 L0,' + BW * 0.34 + ' Z')
        .attr('stroke', '#3b2f1c')
        .attr('stroke-width', 0.8);
      const val = g
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -6)
        .attr('font-family', "'Courier Prime',monospace")
        .attr('font-size', 8)
        .attr('fill', '#3b2f1c')
        .attr('letter-spacing', '.06em')
        .attr('opacity', 0);
      heights.set(r.n, 0);
      bars.push({ ...r, g: g.node(), body: body.node(), cap: capPath.node(), stem: g.select('line').node(), val: val.node() });
      g.attr('pointer-events', 'none');
    });

    regions
      .on('mousemove', (e, f) => {
        highlight(nameOf(f.properties), true);
        showTip(e, nameOf(f.properties));
      })
      .on('mouseleave', (e, f) => {
        highlight(nameOf(f.properties), false);
        hideTip();
      })
      .on('click', (e, f) => {
        const n = nameOf(f.properties);
        level === 'india' ? showState(n) : openWard(n);
      });

    paintBars();
    animate();
    renderPulse();
    renderRanks();
  }

  function computeTargets() {
    const vals = [...data.values()].map((m) => valueOf(m, mode));
    const lo = d3.min(vals);
    const hi = d3.max(vals);
    const s = d3.scaleSqrt().domain([lo * 0.85, hi || 1]).range([8, Math.min(cap || 120, stage.clientHeight * 0.19)]).clamp(true);
    targets = new Map();
    data.forEach((m, n) => targets.set(n, s(valueOf(m, mode))));
  }

  function paintBars() {
    const ps = [...data.values()].map((m) => m.pressure);
    const col = d3
      .scaleLinear()
      .domain([d3.min(ps), (d3.min(ps) + d3.max(ps)) / 2, d3.max(ps)])
      .range(['#7a6a4e', '#C4703A', '#9E351B'])
      .clamp(true);
    bars.forEach((b) => {
      const c = col(b.m.pressure);
      b.body.setAttribute('fill', c);
      b.cap.setAttribute('fill', d3.color(c).brighter(0.55).formatHex());
    });
  }

  function animate() {
    if (raf) return;
    const step = () => {
      if (destroyed) {
        raf = null;
        return;
      }
      let moving = false;
      const top = [...targets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);
      bars.forEach((b) => {
        const t = targets.get(b.n) || 0;
        const h0 = heights.get(b.n) || 0;
        const h = h0 + (t - h0) * 0.13;
        if (Math.abs(t - h) > 0.2) moving = true;
        heights.set(b.n, h);
        b.body.setAttribute('y', -h);
        b.body.setAttribute('height', Math.max(h, 0.1));
        b.cap.setAttribute('transform', 'translate(0,' + -h + ')');
        b.stem.setAttribute('y2', -h);
        b.val.setAttribute('y', -h - 8);
        b.val.setAttribute('opacity', top.includes(b.n) ? 0.85 : 0);
        if (top.includes(b.n)) b.val.textContent = MODES.find((m) => m.id === mode).fmt(valueOf(b.m, mode));
      });
      raf = moving ? requestAnimationFrame(step) : null;
    };
    raf = requestAnimationFrame(step);
  }

  function highlight(n, on) {
    const g = gMap.select('g.reg[data-n="' + cssEsc(n) + '"]');
    if (!g.empty()) g.classed('on', on);
    const b = bars.find((x) => x.n === n);
    if (b) b.val.setAttribute('opacity', on ? 1 : b.val.getAttribute('opacity'));
  }

  const row = (k, v, hi) => '<div class="r' + (hi ? ' hi' : '') + '"><span>' + k + '</span><span>' + v + '</span></div>';
  function showTip(e, n) {
    const m = data.get(n);
    if (!m) return;
    const mo = MODES.find((x) => x.id === mode);
    tip.innerHTML =
      '<div class="n">' + n.toUpperCase() + '</div>' +
      '<div class="sub">' + (level === 'india' ? 'STATE / UT' : 'DISTRICT') + ' · COLUMN: ' + mo.label + '</div>' +
      row('ISSUES', fmtN(m.issues), mode === 'issues') + row('PENDING', fmtN(m.pending), mode === 'pending') +
      row('RESOLVED', fmtN(m.resolved)) + row('AFFECTED', fmtM(m.affected), mode === 'affected') +
      row('RESOLUTION RATE', m.rate + '%', mode === 'rate') + row('MEDIAN TIME', m.days + 'd', mode === 'days') +
      '<div class="bar"><i style="width:' + m.pressure + '%"></i></div>' +
      '<div class="r" style="margin-top:5px"><span>RAGE METER</span><span style="color:var(--ct-rage);font-weight:700">' + m.pressure + '</span></div>';
    const r = stage.getBoundingClientRect();
    let x = e.clientX - r.left + 18;
    let y = e.clientY - r.top + 14;
    if (x + 230 > r.width) x = e.clientX - r.left - 228;
    if (y + 230 > r.height) y = r.height - 236;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.style.opacity = 1;
  }
  function hideTip() {
    tip.style.opacity = 0;
  }

  const wardEl = root.querySelector('#ct-ward');
  root.querySelector('#wardClose').onclick = () => wardEl.classList.remove('on');
  function openWard(n) {
    const m = data.get(n);
    if (!m) return;
    wardEl.querySelector('.n').textContent = n.toUpperCase();
    wardEl.querySelector('.k').textContent = 'MUNICIPAL BODIES · WARD LEDGER';
    const bodies = ['CITY CORPORATION', 'TOWN PANCHAYAT', 'MUNICIPAL COUNCIL', 'CANTONMENT BOARD'];
    wardEl.querySelector('.rows').innerHTML =
      bodies
        .map((b) => {
          const mm = metrics(n + b, 0.03);
          return '<div class="row"><span>' + b + '</span><span>' + fmtN(mm.issues) + ' · ' + mm.pressure + '</span></div>';
        })
        .join('') +
      '<div style="font:400 8px/1.6 \'Courier Prime\',monospace;color:var(--ct-faded);margin-top:9px">DRAWN FROM 4,814 URBAN LOCAL BODIES IN THE NATIONAL JURISDICTION REGISTER.</div>';
    wardEl.classList.add('on');
  }

  function renderPulse() {
    const all = [...data.values()];
    const sum = (k) => all.reduce((a, m) => a + m[k], 0);
    root.querySelector('#pulseLbl').textContent = (current ? current.toUpperCase() : 'INDIA') + "'S CIVIC PULSE";
    root.querySelector('#pulse').innerHTML =
      cell(fmtN(sum('issues')), 'ISSUES THIS WEEK') +
      cell(fmtN(sum('pending')), 'STILL PENDING', 'var(--ct-rage)') +
      cell(fmtN(sum('resolved')), 'RESOLVED', 'var(--ct-resolved)') +
      cell(fmtM(sum('affected')), 'PEOPLE AFFECTED') +
      cell(all.filter((m) => m.pressure >= 80).length, 'HIGH-PRESSURE ZONES', 'var(--ct-rage)') +
      cell((all.reduce((a, m) => a + m.days, 0) / all.length).toFixed(1) + 'd', 'MEDIAN RESOLUTION');
  }
  const cell = (n, k, c) => '<div><div class="n"' + (c ? ' style="color:' + c + '"' : '') + '>' + n + '</div><div class="k">' + k + '</div></div>';

  function renderRanks() {
    const m = MODES.find((x) => x.id === mode);
    const arr = [...data.values()].sort((a, b) => valueOf(b, mode) - valueOf(a, mode)).slice(0, 6);
    root.querySelector('#rankLbl').textContent = 'TALLEST COLUMNS · ' + m.label;
    root.querySelector('#ranks').innerHTML = arr
      .map(
        (x, i) =>
          '<div class="ct-rank" data-n="' + x.name + '"><span class="ri">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="rn">' + x.name.toUpperCase() + '</span><span class="rv">' + m.fmt(valueOf(x, mode)) + '</span></div>',
      )
      .join('');
    [...root.querySelectorAll('.ct-rank')].forEach((el) => {
      el.onclick = () => {
        level === 'india' ? showState(el.dataset.n) : openWard(el.dataset.n);
      };
    });
  }

  function crumbs(n) {
    const c = root.querySelector('#crumb');
    c.innerHTML =
      level === 'india'
        ? '<b>INDIA</b> · ' + (n || 36) + ' STATES &amp; UNION TERRITORIES'
        : '<button id="back">← INDIA</button><b>' + current.toUpperCase() + '</b> · ' + (n || '') + ' DISTRICTS';
    const b = root.querySelector('#back');
    if (b)
      b.onclick = () => {
        wardEl.classList.remove('on');
        showIndia();
      };
  }
  function setTitle(h, k) {
    root.querySelector('#ct-title').innerHTML = '<div class="h">' + h + '</div><div class="k">' + k + '</div>';
  }
  function loading(on, txt) {
    const l = root.querySelector('#ct-loading');
    if (txt) l.textContent = txt;
    l.style.opacity = on ? 1 : 0;
    l.style.pointerEvents = on ? 'auto' : 'none';
  }

  const onMouseDown = (e) => {
    drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseUp = () => {
    drag = null;
  };
  const onMouseMove = (e) => {
    if (!drag) return;
    pan.x = drag.px + (e.clientX - drag.x);
    pan.y = drag.py + (e.clientY - drag.y);
    applyMapTransform();
  };
  svg.node().addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);

  let rz;
  const onResize = () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (destroyed) return;
      if (features.length) (level === 'india' ? showIndia() : showState(current));
    }, 350);
  };
  window.addEventListener('resize', onResize);

  showIndia().catch(() => {
    if (!destroyed) loading(true, 'THE SURVEY SHEET COULD NOT BE FETCHED — CHECK THE CONNECTION.');
  });

  return function destroy() {
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(rz);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('resize', onResize);
    root.innerHTML = '';
  };
}
