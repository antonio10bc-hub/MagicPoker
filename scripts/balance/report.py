#!/usr/bin/env python3
"""Informe de balanceo de Magic Poker (PDF).

Uso: python3 report.py <carpeta_resultados> <salida.pdf> [texto.json]
Lee full-*.json (run.mjs) y extra-*.json (extra.mjs), dibuja las gráficas y monta el PDF.
El texto de análisis (resumen, conclusiones) va en texto.json, escrito tras ver los números.
"""
import glob, json, os, sys, math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, KeepTogether)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

SRC, OUT = sys.argv[1], sys.argv[2]
TEXT = json.load(open(sys.argv[3])) if len(sys.argv) > 3 and os.path.exists(sys.argv[3]) else {}
FIG = os.path.join(SRC, 'fig'); os.makedirs(FIG, exist_ok=True)

# --- Datos ---
R = {}
for f in sorted(glob.glob(os.path.join(SRC, 'full-*.json'))):
    R.update(json.load(open(f))['results'])
X = {}
for f in sorted(glob.glob(os.path.join(SRC, 'extra*.json'))):
    X.update(json.load(open(f)))
SEALX = json.load(open(os.path.join(SRC, 'seals.json'))) if os.path.exists(os.path.join(SRC, 'seals.json')) else {}
REAL = json.load(open(os.path.join(SRC, 'real.json'))) if os.path.exists(os.path.join(SRC, 'real.json')) else {}
def d(key): return R[key]['data'] if key in R else None

PERSONAS = ['novato', 'casual', 'agresivo', 'prudente', 'experto', 'vidente']
PNAME = {'novato': 'Novato', 'casual': 'Casual', 'agresivo': 'Agresivo', 'prudente': 'Prudente', 'experto': 'Experto', 'vidente': 'Omnisciente'}
PDESC = {
    'novato': 'Pone su primera carta en un hueco cualquiera y los sellos sin pensar (la IA «fácil»). Aguanta 8 derrotas seguidas contra un jefe antes de dejarlo.',
    'casual': 'Piensa la jugada con el motor de la IA, pero a menudo no elige la mejor (la IA «normal»). Paciencia: 12.',
    'agresivo': 'Siempre pone la mejor carta que puede y nunca se planta mientras pueda jugar. En el Castillo acepta pactos. Paciencia: 15.',
    'prudente': 'Solo juega si mejora claramente la mesa; gastar cartas le cuesta el doble. Prioriza curarse. Paciencia: 15.',
    'experto': 'La mejor jugada cada turno y se planta cuando le conviene (la IA «difícil», la misma que usan los jefes). Paciencia: 25.',
    'vidente': 'Como el Experto, pero ve las cartas ocultas del rival. No es jugable para un humano: marca el techo de lo que permite el juego. Paciencia: 40.',
}
PCOL = {'novato': '#2a78d6', 'casual': '#eb6834', 'agresivo': '#1baf7a', 'prudente': '#eda100', 'experto': '#e87ba4', 'vidente': '#008300'}
BOSSES = ['drifter', 'wall', 'duelist', 'trickster', 'thief', 'matriarch', 'mirrorist', 'poisoner', 'bard', 'sailor', 'seer', 'sovereign']
BNAME = {'drifter': 'El Forastero', 'wall': 'El Muro', 'duelist': 'La Duelista', 'trickster': 'El Trilero', 'thief': 'La Ladrona', 'matriarch': 'La Matriarca',
         'mirrorist': 'El Espejista', 'poisoner': 'La Tóxica', 'bard': 'El Bardo', 'sailor': 'El Marinero', 'seer': 'La Vidente', 'sovereign': 'El Soberano'}
BSHORT = {'drifter': 'Forastero', 'wall': 'Muro', 'duelist': 'Duelista', 'trickster': 'Trilero', 'thief': 'Ladrona', 'matriarch': 'Matriarca',
          'mirrorist': 'Espejista', 'poisoner': 'Tóxica', 'bard': 'Bardo', 'sailor': 'Marinero', 'seer': 'Vidente', 'sovereign': 'Soberano'}
BSEAL = {'drifter': '—', 'wall': 'defensa', 'duelist': 'ataque', 'trickster': 'cambio', 'thief': 'robo', 'matriarch': 'vida', 'mirrorist': 'espejo',
         'poisoner': 'veneno', 'bard': 'eco', 'sailor': 'ancla', 'seer': 'revelar', 'sovereign': 'todos'}
BLIVES = [4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 6, 7]
FOREST = [('woodcutter', 'El Leñador', 'normal'), ('shepherd', 'El Pastor', 'normal'), ('huntress', 'La Cazadora', 'normal'), ('goblin', 'El Trasgo', 'normal'),
          ('hermit', 'El Ermitaño', 'hard'), ('bandit', 'El Salteador', 'hard'), ('executioner', 'El Verdugo', 'hard'), ('witch', 'La Bruja', 'hard'),
          ('gravedigger', 'El Sepulturero', 'nightmare'), ('wolf', 'El Lobo', 'nightmare'), ('scarecrow', 'El Espantapájaros', 'nightmare'), ('mourner', 'La Plañidera', 'nightmare'),
          ('prince', 'El Príncipe', 'unique'), ('queen', 'La Reina', 'unique'), ('king', 'El Rey', 'unique'), ('anchorite', 'El Anacoreta', 'renegade')]
TNAME = {'normal': 'Normal', 'hard': 'Difícil', 'nightmare': 'Pesadilla', 'unique': 'Único', 'renegade': 'Renegado'}
TWEIGHT = {'normal': 52, 'hard': 28, 'nightmare': 10, 'unique': 5, 'renegade': 5}
CHAL = [('noHeal', 'Sin curas'), ('fierce', 'Jefes feroces'), ('sealed', 'Jefes sellados'), ('short', 'Mazo corto'), ('fragile', 'Frágil'), ('all', 'Los 5 a la vez')]
SEALS = [('shield', 'defensa'), ('double', 'ataque'), ('shift', 'cambio'), ('swap', 'robo'), ('life', 'vida'), ('mirror', 'espejo'), ('poison', 'veneno'), ('echo', 'eco'), ('anchor', 'ancla'), ('reveal', 'revelar')]

def wr(a): return a['win'] / a['n'] if a and a['n'] else float('nan')
def pct(x, dec=0): return '—' if x is None or (isinstance(x, float) and math.isnan(x)) else f'{100 * x:.{dec}f} %'

# --- Estilo de las gráficas (claro, tinta neutra, rejilla tenue) ---
fpath = os.path.join(os.path.dirname(matplotlib.__file__), 'mpl-data/fonts/ttf')
plt.rcParams.update({
    'font.family': 'DejaVu Sans', 'font.size': 8.5, 'axes.edgecolor': '#898781', 'axes.labelcolor': '#52514e', 'xtick.color': '#52514e', 'ytick.color': '#52514e',
    'axes.grid': True, 'grid.color': '#e1e0d9', 'grid.linewidth': 0.6, 'axes.spines.top': False, 'axes.spines.right': False, 'axes.facecolor': '#fcfcfb',
    'figure.facecolor': '#fcfcfb', 'axes.titlesize': 9.5, 'axes.titleweight': 'bold', 'axes.titlecolor': '#0b0b0b', 'legend.frameon': False, 'lines.linewidth': 2,
})
BLUES = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b']
from matplotlib.colors import LinearSegmentedColormap
SEQ = LinearSegmentedColormap.from_list('seq', BLUES)

def save(fig, name):
    p = os.path.join(FIG, name); fig.savefig(p, dpi=200, bbox_inches='tight'); plt.close(fig); return p

def heat(rows, cols, M, title, name, w=7.2, h=2.6, fmt=lambda v: f'{100*v:.0f}', vmax=1.0):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.grid(False)
    im = ax.imshow(M, cmap=SEQ, vmin=0, vmax=vmax, aspect='auto')
    ax.set_xticks(range(len(cols))); ax.set_xticklabels(cols, rotation=35, ha='right')
    ax.set_yticks(range(len(rows))); ax.set_yticklabels(rows)
    for i in range(len(rows)):
        for j in range(len(cols)):
            v = M[i][j]
            if v is None or (isinstance(v, float) and math.isnan(v)): continue
            ax.text(j, i, fmt(v), ha='center', va='center', fontsize=7.5, color='#ffffff' if v / vmax > 0.55 else '#0b0b0b')
    ax.set_title(title, loc='left')
    for s in ax.spines.values(): s.set_visible(False)
    return save(fig, name)

figs = {}

# 1) Jefes por primera vez: % de victorias
M = [[wr(d(f'boss:{p}:{b}:0')) for b in range(12)] for p in PERSONAS]
figs['boss_heat'] = heat([PNAME[p] for p in PERSONAS], [f'{i+1}. {BSHORT[b]}' for i, b in enumerate(BOSSES)], M,
                         'Victorias contra cada jefe la primera vez (%)', 'boss_heat.png', h=2.0)
fig, ax = plt.subplots(figsize=(7.2, 2.25))
for p in PERSONAS:
    ys = [wr(d(f'boss:{p}:{b}:0')) * 100 for b in range(12)]
    ax.plot(range(1, 13), ys, color=PCOL[p], marker='o', markersize=3.5, label=PNAME[p])
ax.set_xticks(range(1, 13)); ax.set_xticklabels([BSHORT[b] for b in BOSSES], rotation=35, ha='right')
ax.set_ylabel('% de victorias'); ax.set_ylim(0, 100); ax.set_title('Curva de dificultad de los jefes (primera vez)', loc='left')
ax.axvspan(4.5, 12.5, color='#f0efec', zorder=-1); ax.text(4.6, 95, 'IA difícil →', fontsize=7, color='#52514e')
ax.legend(ncol=6, loc='upper center', bbox_to_anchor=(0.5, -0.32), fontsize=7.5)
figs['boss_curve'] = save(fig, 'boss_curve.png')

# 2) Revanchas: media de victorias por nivel y persona; mapa del Experto
fig, ax = plt.subplots(figsize=(7.2, 2.6))
for p in PERSONAS:
    ys = [sum(wr(d(f'boss:{p}:{b}:{lv}')) for b in range(12)) / 12 * 100 for lv in range(5)]
    ax.plot(range(5), ys, color=PCOL[p], marker='o', markersize=3.5, label=PNAME[p])
ax.set_xticks(range(5)); ax.set_xticklabels(['1.ª vez', 'Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4'])
ax.set_ylabel('% de victorias (media de los 12)'); ax.set_ylim(0, 100); ax.set_title('Revanchas: victorias según el nivel', loc='left')
ax.legend(ncol=6, loc='upper center', bbox_to_anchor=(0.5, -0.14), fontsize=7.5)
figs['rematch_curve'] = save(fig, 'rematch_curve.png')
M = [[wr(d(f'boss:experto:{b}:{lv}')) for b in range(12)] for lv in range(5)]
figs['rematch_heat'] = heat(['1.ª vez', 'Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4'], [BSHORT[b] for b in BOSSES], M,
                            'Experto: victorias por jefe y nivel de revancha (%)', 'rematch_heat.png', h=2.3)

# 3) Castillo: supervivencia por piso
fig, ax = plt.subplots(figsize=(7.2, 3.0))
for p in PERSONAS:
    c = d(f'castle:{p}:none')
    if not c: continue
    n = c['n']; ys = [100 * sum(c['floors'][k:]) / n for k in range(13)]
    ax.plot(range(13), ys, color=PCOL[p], marker='o', markersize=3, label=PNAME[p])
ax.set_xticks(range(13)); ax.set_xticklabels(['Inicio'] + [f'{i+1}' for i in range(12)])
ax.set_xlabel('Pisos vencidos'); ax.set_ylabel('% de subidas que llegan')
ax.set_yscale('log'); ax.set_ylim(0.01, 110)
ax.set_yticks([0.01, 0.1, 1, 10, 100]); ax.set_yticklabels(['0,01 %', '0,1 %', '1 %', '10 %', '100 %'])
ax.set_title('El Castillo: cuántas subidas superan cada piso (escala logarítmica)', loc='left')
ax.legend(ncol=6, loc='upper center', bbox_to_anchor=(0.5, -0.2), fontsize=7.5)
figs['castle_surv'] = save(fig, 'castle_surv.png')

# Riesgo de caer en cada piso (para quien llega)
fig, ax = plt.subplots(figsize=(7.2, 2.5))
w = 0.38
for k, p in enumerate(['experto', 'vidente']):
    c = d(f'castle:{p}:none')
    if not c: continue
    ys = [100 * c['deaths'][i] / c['reach'][i] if c['reach'][i] >= 20 else float('nan') for i in range(12)]
    xs = [i + (k - 0.5) * w for i in range(12)]
    ax.bar(xs, ys, width=w - 0.04, color=PCOL[p], label=PNAME[p])
ax.set_xticks(range(12)); ax.set_xticklabels([f'{i+1}. {BSHORT[b]}' for i, b in enumerate(BOSSES)], rotation=35, ha='right')
ax.set_ylabel('% de caer (de quien llega)'); ax.set_ylim(0, 100)
ax.set_title('El Castillo: probabilidad de caer en cada piso', loc='left'); ax.legend(loc='upper right', fontsize=7.5)
figs['castle_hazard'] = save(fig, 'castle_hazard.png')

# Desafíos: pisos medios
fig, ax = plt.subplots(figsize=(7.2, 2.5))
ps = ['prudente', 'experto', 'vidente']
opts = [('none', 'Sin desafíos')] + CHAL
w = 0.26
for k, p in enumerate(ps):
    ys = []
    for cid, _ in opts:
        c = d(f'castle:{p}:{cid}')
        ys.append(sum(i * v for i, v in enumerate(c['floors'])) / c['n'] if c else float('nan'))
    ax.bar([i + (k - 1) * w for i in range(len(opts))], ys, width=w - 0.03, color=PCOL[p], label=PNAME[p])
ax.set_xticks(range(len(opts))); ax.set_xticklabels([n for _, n in opts], rotation=20, ha='right')
ax.set_ylabel('Pisos vencidos (media)'); ax.set_title('Desafíos del Castillo: hasta dónde se llega', loc='left'); ax.legend(fontsize=7.5)
figs['castle_chal'] = save(fig, 'castle_chal.png')

# 4) Bosque
M = [[wr(d(f'forest:{p}:{a}')) for a, _, _ in FOREST] for p in PERSONAS]
figs['forest_heat'] = heat([PNAME[p] for p in PERSONAS], [f'{n} ({TNAME[t][0]})' for _, n, t in FOREST], M,
                           'El Bosque: victorias contra cada personaje (%)', 'forest_heat.png', h=2.8)

# 5) Mazos y sellos
decks = ['sin_sellos', 'defecto', 'sin_flojas'] + [f'solo_{s}' for s, _ in SEALS]
dname = {'sin_sellos': 'Sin sellos', 'defecto': 'Por defecto', 'sin_flojas': 'Sin 2, 3 y 4', **{f'solo_{s}': f'2× {n}' for s, n in SEALS}}
vs_sov = [wr(d(f'deck:experto:{k}')['vsSov']) * 100 if d(f'deck:experto:{k}') else float('nan') for k in decks]
vs_for = [wr(d(f'deck:experto:{k}')['vsForest']) * 100 if d(f'deck:experto:{k}') else float('nan') for k in decks]
fig, ax = plt.subplots(figsize=(7.2, 2.7))
w = 0.38
ax.bar([i - w / 2 for i in range(len(decks))], vs_sov, width=w - 0.04, color='#2a78d6', label='contra el Soberano')
ax.bar([i + w / 2 for i in range(len(decks))], vs_for, width=w - 0.04, color='#eb6834', label='contra el Bosque difícil y pesadilla')
ax.set_xticks(range(len(decks))); ax.set_xticklabels([dname[k] for k in decks], rotation=30, ha='right')
ax.set_ylabel('% de victorias (Experto)'); ax.set_ylim(0, 100); ax.set_title('Qué vale cada mazo: el mismo jugador con mazos distintos', loc='left'); ax.legend(fontsize=7.5, ncol=2, loc='upper left')
figs['decks'] = save(fig, 'decks.png')

# 6) Campaña: embudo
fig, ax = plt.subplots(figsize=(7.2, 2.4))
labels = [BSHORT[b] for b in BOSSES] + ['Castillo']
for p in PERSONAS:
    c = d(f'campaign:{p}')
    if not c: continue
    pl = c['players']; n = len(pl)
    ys = [100 * sum(1 for x in pl if x['bossTries'][i] is not None) / n for i in range(12)] + [100 * sum(1 for x in pl if x['castleConquered']) / n]
    ax.plot(range(13), ys, color=PCOL[p], marker='o', markersize=3, label=PNAME[p])
ax.set_xticks(range(13)); ax.set_xticklabels(labels, rotation=35, ha='right'); ax.set_ylim(0, 103)
ax.set_ylabel('% de jugadores que lo superan'); ax.set_title('La campaña entera: hasta dónde llega cada tipo de jugador', loc='left')
ax.legend(ncol=6, loc='upper center', bbox_to_anchor=(0.5, -0.3), fontsize=7.5)
figs['funnel'] = save(fig, 'funnel.png')

# 7) ¿Y si...? del Castillo
WI = [('actual', 'Como ahora'), ('jefes_menos1vida', 'Jefes −1 vida'), ('cura1_por_piso', 'Curar 1 por piso'), ('jefes_menos1nivel', 'Jefes −1 nivel'),
      ('menos1vida_y_cura1', '−1 vida y curar 1'), ('cura2_por_piso', 'Curar 2 por piso'), ('empiezas_6_vidas', 'Empezar con 6'),
      ('ocho_pisos', 'Solo 8 pisos'), ('ia_normal_hasta_8', 'IA normal hasta el 8'), ('sello_se_repone', 'El sello se repone'),
      ('repone_y_menos1vida', 'Se repone y −1 vida'), ('propuesta', 'Propuesta combinada')]
if X:
    fig, ax = plt.subplots(figsize=(7.2, 2.9))
    w = 0.27
    for k, p in enumerate(['casual', 'experto', 'vidente']):
        ys = [100 * X[f'whatif:{p}:{k2}']['conq'] / X[f'whatif:{p}:{k2}']['n'] if f'whatif:{p}:{k2}' in X else float('nan') for k2, _ in WI]
        ax.bar([i + (k - 1) * w for i in range(len(WI))], ys, width=w - 0.03, color=PCOL[p], label=PNAME[p])
    ax.set_xticks(range(len(WI))); ax.set_xticklabels([n for _, n in WI], rotation=30, ha='right')
    ax.set_ylabel('% de subidas que conquistan'); ax.set_title('¿Y si...? Cambios posibles en el Castillo', loc='left'); ax.legend(fontsize=7.5)
    figs['whatif'] = save(fig, 'whatif.png')

# 8) Jefes con la regla del sello que se repone
if 'cantrip:experto:0' in X:
    fig, ax = plt.subplots(figsize=(7.2, 2.6))
    for p in ['casual', 'experto']:
        ax.plot(range(1, 13), [wr(d(f'boss:{p}:{b}:0')) * 100 for b in range(12)], color=PCOL[p], marker='o', markersize=3, label=f'{PNAME[p]} · ahora')
        ax.plot(range(1, 13), [100 * X[f'cantrip:{p}:{b}']['win'] / X[f'cantrip:{p}:{b}']['n'] for b in range(12)], color=PCOL[p], marker='s', markersize=3, linestyle='--', label=f'{PNAME[p]} · el sello se repone')
    ax.set_xticks(range(1, 13)); ax.set_xticklabels([BSHORT[b] for b in BOSSES], rotation=35, ha='right'); ax.set_ylim(0, 100)
    ax.set_ylabel('% de victorias'); ax.set_title('Jefes: ahora y con «el sello se repone» (para los dos bandos)', loc='left')
    ax.legend(ncol=2, fontsize=7.5, loc='upper right')
    figs['cantrip'] = save(fig, 'cantrip.png')

# --- PDF ---
pdfmetrics.registerFont(TTFont('DV', os.path.join(fpath, 'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DVB', os.path.join(fpath, 'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFont(TTFont('DVI', os.path.join(fpath, 'DejaVuSans-Oblique.ttf')))
from reportlab.lib.fonts import addMapping
addMapping('DV', 0, 0, 'DV'); addMapping('DV', 1, 0, 'DVB'); addMapping('DV', 0, 1, 'DVI'); addMapping('DV', 1, 1, 'DVB')
INK, INK2, MUTED, ACC = colors.HexColor('#0b0b0b'), colors.HexColor('#52514e'), colors.HexColor('#898781'), colors.HexColor('#c2410c')
S = {
    'title': ParagraphStyle('t', fontName='DVB', fontSize=24, leading=29, textColor=INK, spaceAfter=6),
    'sub': ParagraphStyle('s', fontName='DV', fontSize=11.5, leading=16, textColor=INK2, spaceAfter=14),
    'h1': ParagraphStyle('h1', fontName='DVB', fontSize=15, leading=19, textColor=INK, spaceBefore=6, spaceAfter=7),
    'h2': ParagraphStyle('h2', fontName='DVB', fontSize=11, leading=14, textColor=INK, spaceBefore=9, spaceAfter=4),
    'p': ParagraphStyle('p', fontName='DV', fontSize=9.2, leading=13.4, textColor=INK, spaceAfter=6),
    'small': ParagraphStyle('sm', fontName='DV', fontSize=7.8, leading=10.5, textColor=INK2, spaceAfter=4),
    'li': ParagraphStyle('li', fontName='DV', fontSize=9.2, leading=13.2, textColor=INK, leftIndent=12, bulletIndent=2, spaceAfter=3),
    'cell': ParagraphStyle('c', fontName='DV', fontSize=7.6, leading=9.6, textColor=INK),
    'cellb': ParagraphStyle('cb', fontName='DVB', fontSize=7.6, leading=9.6, textColor=INK),
    'kpi': ParagraphStyle('k', fontName='DVB', fontSize=17, leading=20, textColor=INK),
    'kpil': ParagraphStyle('kl', fontName='DV', fontSize=7.6, leading=9.8, textColor=INK2),
}
def P(t, s='p'): return Paragraph(t, S[s])
def bullets(items): return [Paragraph(t, S['li'], bulletText='•') for t in items]
def img(p, width=174 * mm):
    from PIL import Image as PI
    w, h = PI.open(p).size
    return Image(p, width=width, height=width * h / w)
def table(rows, widths, header=True, zebra=True, align_right_from=1):
    data = [[Paragraph(str(c), S['cellb'] if (header and i == 0) else S['cell']) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    st = [('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LINEBELOW', (0, 0), (-1, 0), 0.6, MUTED), ('TOPPADDING', (0, 0), (-1, -1), 2.2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.2)]
    if zebra:
        for i in range(1, len(rows)):
            if i % 2 == 0: st.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f4f3ef')))
    t.setStyle(TableStyle(st)); return t
def txt(key, default=''):
    v = TEXT.get(key, default)
    return v
def paras(key):
    v = TEXT.get(key)
    if not v: return []
    out = []
    for x in v:
        if isinstance(x, list): out += bullets(x)
        else: out.append(P(x))
    return out

# Totales para la portada
total_games = 0
for k, v in R.items():
    t, dd = v['task'], v['data']
    if t['kind'] in ('boss', 'forest'): total_games += dd['n']
    elif t['kind'] == 'deck': total_games += dd['vsSov']['n'] + dd['vsForest']['n']
    elif t['kind'] == 'castle': total_games += sum(dd['reach'])
    elif t['kind'] == 'campaign': total_games += sum(p['totalMatches'] for p in dd['players'])
for k, v in X.items():
    if k.startswith('mirror:'): total_games += v['n']
    if k.startswith('whatif:'): total_games += v['n']  # (subidas; las peleas son más)
players = sum(len(v['data']['players']) for k, v in R.items() if v['task']['kind'] == 'campaign')
castle_runs = sum(v['data']['n'] for k, v in R.items() if v['task']['kind'] == 'castle')

story = []
story.append(Spacer(1, 30 * mm))
story.append(P('Magic Poker', 'title'))
story.append(P('Informe de balanceo: simulación con bots', 'sub'))
story.append(P(txt('cover_lead', ''), 'p'))
kp = [[P(f'{total_games:,}'.replace(',', '.'), 'kpi'), P(f'{players:,}'.replace(',', '.'), 'kpi'), P(f'{castle_runs:,}'.replace(',', '.'), 'kpi'), P('6', 'kpi')],
      [P('partidas simuladas', 'kpil'), P('campañas completas (jugador de principio a fin)', 'kpil'), P('subidas al Castillo', 'kpil'), P('tipos de jugador (bots)', 'kpil')]]
t = Table(kp, colWidths=[43 * mm] * 4); t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0)])); story += [Spacer(1, 8), t, Spacer(1, 14)]
story.append(P('Resumen', 'h1'))
story += paras('summary')
story.append(PageBreak())

# Metodología
story.append(P('1. Cómo se ha hecho', 'h1'))
story += paras('method')
rows = [['Perfil', 'Cómo juega']] + [[PNAME[p], PDESC[p]] for p in PERSONAS]
story.append(table(rows, [26 * mm, 148 * mm]))
story.append(Spacer(1, 6))
story += paras('method2')
if X:
    story.append(P('Calibración', 'h2'))
    rows = [['Prueba (mismo mazo estándar, sin sellos, 4 vidas)', 'Partidas', 'Gana el bot', 'Empate', 'Gana el bot si abre él']]
    for k, lbl in [('mirror:experto:hard', 'Experto contra la IA difícil'), ('mirror:casual:normal', 'Casual contra la IA normal'), ('mirror:novato:easy', 'Novato contra la IA fácil'), ('mirror:vidente:hard', 'Omnisciente contra la IA difícil')]:
        v = X.get(k)
        if not v: continue
        dec = v['n'] - v['draw']
        rows.append([lbl, f"{v['n']}", pct(v['win'] / v['n'], 1), pct(v['draw'] / v['n'], 1), pct(v['openerWin'] / max(1, v['opener']), 1)])
    story.append(table(rows, [70 * mm, 20 * mm, 26 * mm, 26 * mm, 32 * mm]))
    story += paras('calib')
story.append(PageBreak())

# Campaña
story.append(P('2. La campaña entera', 'h1'))
story += paras('campaign_intro')
story.append(img(figs['funnel']))
rows = [['Perfil', 'Vence a los 12', 'Conquista el Castillo', 'Se atasca sobre todo en', 'Partidas para ver el final*']]
for p in PERSONAS:
    c = d(f'campaign:{p}')
    if not c: continue
    pl = c['players']; n = len(pl)
    stuck = {}
    for x in pl:
        if x['stuckAt'] is not None: stuck[x['stuckAt']] = stuck.get(x['stuckAt'], 0) + 1
    top = sorted(stuck.items(), key=lambda kv: -kv[1])[:2]
    tops = ', '.join(f"{BSHORT[BOSSES[i]]} ({100*v/n:.0f} %)" for i, v in top) or '—'
    fin = [x['totalMatches'] for x in pl if x['castleConquered']]
    med = sorted(fin)[len(fin) // 2] if fin else None
    rows.append([PNAME[p], pct(sum(1 for x in pl if x['stuckAt'] is None) / n), pct(sum(1 for x in pl if x['castleConquered']) / n), tops, f'{med}' if med else '—'])
story.append(table(rows, [24 * mm, 26 * mm, 32 * mm, 56 * mm, 36 * mm]))
story.append(P('* Mediana de partidas (jefes + peleas del Castillo) de quien llega a conquistar el Castillo.', 'small'))
# Intentos medios por jefe
rows = [['Jefe'] + [PNAME[p] for p in PERSONAS]]
for i, b in enumerate(BOSSES):
    r = [f'{i+1}. {BSHORT[b]}']
    for p in PERSONAS:
        c = d(f'campaign:{p}')
        tries = [x['bossTries'][i] for x in c['players'] if x['bossTries'][i] is not None] if c else []
        r.append(f'{sum(tries)/len(tries):.1f}' if tries else '—')
    rows.append(r)
story.append(P('Intentos medios para vencer a cada jefe (de quien lo vence)', 'h2'))
story.append(table(rows, [30 * mm] + [24 * mm] * 6, ))
story += paras('campaign_notes')
story.append(PageBreak())

# Jefes
story.append(P('3. Los jefes, uno a uno', 'h1'))
story += paras('bosses_intro')
story.append(img(figs['boss_curve']))
story.append(img(figs['boss_heat']))
rows = [['Jefe', 'Sello', 'Vidas', 'IA', 'Rondas medias', 'Empates', 'Gana quien abre**']]
for i, b in enumerate(BOSSES):
    a = d(f'boss:experto:{i}:0')
    rows.append([f'{i+1}. {BNAME[b]}', BSEAL[b], str(BLIVES[i]), 'normal' if i < 4 else 'difícil', f"{a['rounds']/a['n']:.1f}", pct(a['draw'] / a['n']),
                 pct(a['openerPWin'] / max(1, a['openerP'])) + ' / ' + pct(a['openerOWin'] / max(1, a['n'] - a['openerP']))])
story.append(P('Detalle (Experto)', 'h2'))
story.append(table(rows, [36 * mm, 18 * mm, 13 * mm, 17 * mm, 25 * mm, 20 * mm, 45 * mm]))
story.append(P('** Victorias del Experto cuando abre él la primera ronda / cuando abre el jefe.', 'small'))
story += paras('bosses_notes')
story.append(PageBreak())

story.append(P('4. Revanchas', 'h1'))
story += paras('rematch_intro')
story.append(img(figs['rematch_curve']))
story.append(img(figs['rematch_heat']))
story += paras('rematch_notes')
story.append(PageBreak())

# Castillo
story.append(P('5. El Castillo', 'h1'))
story += paras('castle_intro')
rows = [['Perfil', 'Subidas', 'Conquista', 'Pisos medios', 'Cae en el 1.er piso', 'Llega al Soberano']]
for p in PERSONAS:
    c = d(f'castle:{p}:none')
    if not c: continue
    n = c['n']
    rows.append([PNAME[p], f'{n}', pct(c['conquered'] / n, 2), f"{sum(i * v for i, v in enumerate(c['floors'])) / n:.2f}", pct(c['floors'][0] / n), pct(c['reach'][11] / n, 2)])
story.append(table(rows, [26 * mm, 18 * mm, 24 * mm, 24 * mm, 36 * mm, 36 * mm]))
story.append(Spacer(1, 6))
story.append(img(figs['castle_surv']))
story.append(img(figs['castle_hazard']))
story += paras('castle_notes')
story.append(P('Desafíos', 'h2'))
story.append(img(figs['castle_chal']))
story += paras('castle_chal')
if 'whatif' in figs:
    story.append(P('¿Y si...? Cambios probados en la simulación', 'h2'))
    story += paras('whatif_intro')
    story.append(img(figs['whatif']))
    rows = [['Cambio'] + [f'{PNAME[p]}: conquista / pisos' for p in ['casual', 'experto', 'vidente']]]
    for k2, n2 in WI:
        r = [n2]
        for p in ['casual', 'experto', 'vidente']:
            v = X.get(f'whatif:{p}:{k2}')
            r.append(f"{pct(v['conq']/v['n'],1)} / {sum(i*c for i,c in enumerate(v['floors']))/v['n']:.1f}" if v else '—')
        rows.append(r)
    story.append(table(rows, [40 * mm, 44 * mm, 44 * mm, 44 * mm]))
    story += paras('whatif_notes')
story.append(PageBreak())

# Bosque
story.append(P('6. El Bosque', 'h1'))
story += paras('forest_intro')
story.append(img(figs['forest_heat']))
rows = [['Nivel', 'Sale (%)'] + [PNAME[p] for p in PERSONAS]]
for tier in ['normal', 'hard', 'nightmare', 'unique', 'renegade']:
    r = [TNAME[tier], f'{TWEIGHT[tier]}']
    for p in PERSONAS:
        ids = [a for a, _, t in FOREST if t == tier]
        r.append(pct(sum(wr(d(f'forest:{p}:{a}')) for a in ids) / len(ids)))
    rows.append(r)
r = ['Media ponderada', '100']
for p in PERSONAS:
    tot = 0
    for tier, wgt in TWEIGHT.items():
        ids = [a for a, _, t in FOREST if t == tier]
        tot += wgt / 100 * sum(wr(d(f'forest:{p}:{a}')) for a in ids) / len(ids)
    r.append(pct(tot))
rows.append(r)
story.append(table(rows, [30 * mm, 18 * mm] + [21 * mm] * 6))
story += paras('forest_notes')
story.append(PageBreak())

# Mazos
story.append(P('7. Mazos y sellos', 'h1'))
story += paras('decks_intro')
story.append(img(figs['decks']))
rows = [['Mazo', 'contra el Soberano', 'contra el Bosque difícil/pesadilla']]
for k, a, b in zip(decks, vs_sov, vs_for):
    rows.append([dname[k], f'{a:.0f} %', f'{b:.0f} %'])
story.append(table(rows, [50 * mm, 40 * mm, 60 * mm]))
cdeck = [(k, d(f'castle:experto:none:{k}')) for k in ['defecto', 'sin_flojas', 'sin_sellos']]
if all(c for _, c in cdeck):
    story.append(P('Y en el Castillo (Experto)', 'h2'))
    rows = [['Mazo de partida', 'Conquista', 'Pisos medios']] + [[dname[k], pct(c['conquered'] / c['n'], 2), f"{sum(i*v for i,v in enumerate(c['floors']))/c['n']:.2f}"] for k, c in cdeck]
    story.append(table(rows, [50 * mm, 30 * mm, 30 * mm]))
story += paras('decks_notes')
story.append(PageBreak())

if SEALX:
    story.append(P('8. Por qué los sellos restan', 'h1'))
    story += paras('sealx_intro')
    lbl = {'defecto': 'Mazo por defecto (5 sellos, los juega)', 'sellos_sin_jugar': 'Los mismos 5 sellos, sin jugarlos nunca', 'sin_sellos': 'Sin sellos',
           'mazo_aparte': 'Sellos en un mazo aparte (roba 1 carta + 1 sello)', 'sello_se_repone': '¿Y si...? El sello se repone al robarlo',
           'aparte_2_cartas': '¿Y si...? Mazo aparte robando 2 cartas + 1 sello'}
    rows = [['Mazo del Experto', 'contra el Soberano', 'contra el Bosque difícil/pesadilla']]
    for k, v in SEALX.items():
        if k in lbl: rows.append([lbl[k], pct(v['sov'], 1), pct(v['forest'], 1)])
    story.append(table(rows, [86 * mm, 36 * mm, 52 * mm]))
    if 'espejista_con_sellos' in SEALX:
        story.append(P(f"El mismo efecto del otro lado: contra el Espejista con sus sellos el Experto gana el {100*SEALX['espejista_con_sellos']['sov']:.1f} %; contra un Espejista igual pero sin sellos, solo el {100*SEALX['espejista_sin_sellos']['sov']:.1f} %.", 'p'))
    story += paras('sealx_notes')
    if 'cantrip' in figs:
        story.append(img(figs['cantrip']))
        story += paras('cantrip_notes')
    story.append(PageBreak())

if REAL:
    story.append(P('9. Comparación con jugadores reales', 'h1'))
    story += paras('real_intro')
    rows = [['Bosque, nivel', 'Duelos', 'Jugadores', 'Humanos ganan', 'Experto (bot)', 'Prudente (bot)', 'Omnisciente (bot)']]
    for tier in ['normal', 'hard', 'nightmare', 'unique', 'renegade']:
        w_, l_, dr, pl = REAL['forest'][tier]
        ids = [a for a, _, t in FOREST if t == tier]
        bot = lambda p: sum(wr(d(f'forest:{p}:{a}')) for a in ids) / len(ids)
        rows.append([TNAME[tier], f'{w_+l_+dr}', f'{pl}', pct(w_ / (w_ + l_ + dr)), pct(bot('experto')), pct(bot('prudente')), pct(bot('vidente'))])
    story.append(table(rows, [26 * mm, 18 * mm, 20 * mm, 26 * mm, 26 * mm, 28 * mm, 30 * mm]))
    story.append(Spacer(1, 6))
    c = d('castle:experto:none'); cv = d('castle:vidente:none')
    rows = [['Castillo, piso', 'Peleas', 'Jugadores', 'Humanos ganan', 'Experto (bot)', 'Omnisciente (bot)']]
    for i, (name, w_, l_, dr, pl) in enumerate(REAL['castle']):
        rows.append([name, f'{w_+l_+dr}', f'{pl}', pct(w_ / (w_ + l_ + dr)), pct(1 - c['deaths'][i] / c['reach'][i]), pct(1 - cv['deaths'][i] / cv['reach'][i])])
    story.append(table(rows, [44 * mm, 18 * mm, 20 * mm, 28 * mm, 28 * mm, 32 * mm]))
    story.append(Spacer(1, 6))
    rows = [['Jefe (1.ª vez)', 'Partidas', 'Jugadores', 'Humanos ganan', 'Experto (bot)', 'Prudente (bot)']]
    idx = {'1. Forastero': 0, '2. Muro': 1, '3. Duelista': 2, '5. Ladrona': 4}
    for name, w_, l_, dr, pl in REAL['bosses']:
        i = idx[name]
        rows.append([name, f'{w_+l_+dr}', f'{pl}', pct(w_ / (w_ + l_ + dr)), pct(wr(d(f'boss:experto:{i}:0'))), pct(wr(d(f'boss:prudente:{i}:0')))])
    story.append(table(rows, [44 * mm, 18 * mm, 20 * mm, 28 * mm, 28 * mm, 32 * mm]))
    story.append(P('Fuente: ' + REAL['source'] + '. Pocos jugadores (probablemente incluye las partidas de prueba del propio desarrollo): sirve para orientar, no como medida.', 'small'))
    story += paras('real_notes')
    story.append(PageBreak())

story.append(P('10. Conclusiones y recomendaciones', 'h1'))
story += paras('conclusions')
story.append(P('Límites de este estudio', 'h2'))
story += paras('limits')
story.append(P('Cómo repetirlo', 'h2'))
story += paras('repro')

def on_page(c, doc):
    c.saveState(); c.setFont('DV', 7.5); c.setFillColor(MUTED)
    c.drawString(18 * mm, 10 * mm, 'Magic Poker · Informe de balanceo')
    c.drawRightString(A4[0] - 18 * mm, 10 * mm, f'{doc.page}')
    c.restoreState()
doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
                        title='Magic Poker: informe de balanceo', author='Magic Poker')
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print('PDF:', OUT)
