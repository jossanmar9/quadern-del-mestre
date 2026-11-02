/*
 * Quadern del Mestre — regles de la partida: cada partida tria com es juga (unitats, diagonals, PG en pujar
 * de nivell, iniciativa, crítics, concentració, què veuen els jugadors…). Es guarden a campaign/main.rules.
 * Sense regles guardades, es juga com fins ara (Estàndard 2024).
 * Llicència GPL-3.0 o posterior.
 */
const RULE_DEFAULTS = {units: 'm', diag: 'one', fog: 'manual', vision: 18, hpLevel: 'choose', insp: true, weight: false,
  init: 'each', crit: 'double', conc: true, monsterHp: 'words', deathSaves: 'public', rolls: 'all'};
const RULE_PRESETS = [
  ['std', L('Estàndard 2024'), L('Les regles bàsiques de 2024, tal com venen al SRD.'), {}],
  ['nous', L('Per a principiants'), L('Menys coses a recordar: PG fixos en pujar de nivell, els monstres iguals tiren la iniciativa junts, els PG dels monstres amb números i boira automàtica.'),
    {hpLevel: 'fixed', init: 'group', monsterHp: 'numbers', fog: 'auto'}],
  ['dur', L('Exigent'), L('Més misteri i més perill: diagonals variants, PG tirats, sense saber la vida dels monstres, salvacions contra la mort secretes, cadascú veu només les seues tirades, càrrega i boira automàtica.'),
    {diag: 'alt', hpLevel: 'roll', monsterHp: 'none', deathSaves: 'dm', rolls: 'own', weight: true, fog: 'auto'}],
];
// [grup, [[clau, etiqueta, opcions | 'bool' | 'number', ajuda?]]]
const RULE_OPTS = [
  [L('Mapa'), [
    ['units', L('Unitats de distància'), [['m', L('Metres (1,5 m per casella)')], ['ft', L('Peus (5 peus per casella)')]]],
    ['diag', L('Diagonals'), [['one', L('Cada diagonal compta com una casella (2024)')], ['alt', L('Alternes: la primera diagonal compta 1, la segona 2… (variant)')]]],
    ['fog', L('Boira dels mapes nous'), [['manual', L('Manual: el màster revela les zones')], ['auto', L('Automàtica: es revela el que veuen els personatges')]]],
    ['vision', L('Distància de visió de la boira automàtica'), 'number'],
  ]],
  [L('Personatges'), [
    ['hpLevel', L('PG en pujar de nivell'), [['choose', L('Que trie el jugador')], ['fixed', L('Sempre el valor fix')], ['roll', L('Sempre tirant el dau')]]],
    ['insp', L('Inspiració heroica'), 'bool'],
    ['weight', L('Controlar la càrrega (pes que pot portar cada personatge)'), 'bool'],
  ]],
  [L('Combat'), [
    ['init', L('Iniciativa dels monstres'), [['each', L('Una tirada per criatura')], ['group', L('Els monstres iguals tiren junts')]]],
    ['crit', L('Colps crítics'), [['double', L('Doblar els daus de dany (2024)')], ['max', L('El màxim dels daus més una tirada (variant)')]]],
    ['conc', L('Tirar sola la salvació de concentració quan es rep dany'), 'bool'],
  ]],
  [L('Què veuen els jugadors'), [
    ['monsterHp', L('Vida dels monstres'), [['words', L('Amb paraules: ferit, malferit…')], ['numbers', L('Els punts de colp exactes')], ['none', L('Res')]]],
    ['deathSaves', L('Salvacions contra la mort'), [['public', L('Les veu tothom')], ['dm', L('Només el màster i el jugador')]]],
    ['rolls', L('Tirades dels altres jugadors'), [['all', L('Les veu tothom')], ['own', L('Cadascú veu les seues i les del màster')]]],
  ]],
];
const rules = () => ({...RULE_DEFAULTS, ...(camp().rules || {})});
const presetOf = r => {const full = {...RULE_DEFAULTS, ...r}; const p = RULE_PRESETS.find(([, , , v]) => Object.keys(RULE_DEFAULTS).every(k => ({...RULE_DEFAULTS, ...v})[k] === full[k])); return p ? p[1] : L('Personalitzades')};

/* ---- distàncies en metres o en peus (tot es guarda en metres) ---- */
const FT = .3;   // 1,5 m = 5 peus
const feet = () => rules().units === 'ft';
const unitLbl = () => feet() ? t('peus') : 'm';
const toUnit = m => feet() ? Math.round(m / FT) : Math.round(m * 10) / 10;
const fromUnit = v => feet() ? Math.round(v * FT * 100) / 100 : +v;
const unitStep = () => feet() ? 5 : 1.5;
const distTxt = m => `${String(toUnit(m)).replace('.', ',')} ${unitLbl()}`;
/** Caselles recorregudes entre dos punts: diagonals d'una casella, o alternes 1-2-1… */
function gridCells(dx, dy) {const a = Math.abs(dx), b = Math.abs(dy); return rules().diag === 'alt' ? Math.max(a, b) + Math.floor(Math.min(a, b) / 2) : Math.max(a, b)}

/* ---- finestra de regles ---- */
function rulesForm(r) {
  return RULE_OPTS.map(([grp, opts]) => `<fieldset class="rules-grp"><legend>${esc(t(grp))}</legend>${opts.map(([k, lb, o]) => {
    if (o === 'bool') return `<label class="check"><input type="checkbox" data-rule="${k}" ${r[k] ? 'checked' : ''}> ${esc(t(lb))}</label>`;
    if (o === 'number') return `<label class="field"><span>${esc(t(lb))} (m)</span><input class="in" type="number" min="1.5" max="45" step="1.5" data-rule="${k}" value="${esc(r[k])}" style="width:110px"></label>`;
    return `<label class="field"><span>${esc(t(lb))}</span><select class="in" data-rule="${k}">${o.map(([v, nm]) => `<option value="${v}" ${r[k] === v ? 'selected' : ''}>${esc(t(nm))}</option>`).join('')}</select></label>`;
  }).join('')}</fieldset>`).join('');
}
function readRules(m) {
  const r = {};
  $$('[data-rule]', m).forEach(el => {const k = el.dataset.rule; r[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? clamp(+el.value || RULE_DEFAULTS[k], 1.5, 45) : el.value});
  return r;
}
function rulesModal() {
  if (!dm()) return;
  const cur = rules();
  openModal(`<h2>${esc(t('Regles de la partida'))}</h2><p class="muted" style="margin:0">${esc(t('Tria com es juga en aquesta partida. Es pot canviar quan vulgues; cada partida té les seues regles.'))}</p>
    <div class="rules-presets">${RULE_PRESETS.map(([id, nm, ds]) => `<button class="rules-preset" data-preset="${id}"><b>${esc(t(nm))}</b><span>${esc(t(ds))}</span></button>`).join('')}</div>
    <div class="rules-form" id="rules-form">${rulesForm(cur)}</div>
    <p class="small muted" style="margin:0">${esc(t('El text del compendi està en metres; en peus, 1,5 m són 5 peus.'))}</p>
    <div class="foot"><button class="btn" id="ru-x">${esc(t('Cancel·lar'))}</button><button class="btn pri" id="ru-ok">${esc(t('Guardar les regles'))}</button></div>`, (m, close) => {
    const mark = () => {const nm = presetOf(readRules(m)); $$('[data-preset]', m).forEach(b => b.setAttribute('aria-pressed', t(RULE_PRESETS.find(p => p[0] === b.dataset.preset)[1]) === t(nm)))};
    m.addEventListener('click', e => {const p = e.target.closest('[data-preset]'); if (!p) return; const v = {...RULE_DEFAULTS, ...RULE_PRESETS.find(x => x[0] === p.dataset.preset)[3]}; $('#rules-form', m).innerHTML = rulesForm(v); mark()});
    m.addEventListener('change', mark); mark();
    $('#ru-x', m).onclick = close;
    $('#ru-ok', m).onclick = () => {const r = readRules(m); write('campaign/main', {rules: r}, 'update'); close(); toast(t('Regles guardades: {x}.', {x: t(presetOf(r))}), 5000); setTimeout(() => {if (st.tab === 'partides') renderCamps()}, 60)};
  }, {wide: true});
}
