"""Builds website/index.html from the template.

Usage: python3 website/src/build.py
Publish website/index.html with website/assets/*, shots/*, rooms/* and collection/* as its files.
Icons are Lucide (ISC, see src/icons/LICENSE-lucide), inlined at build time.
"""
import base64, html, json, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, ".."))
BRAND = os.path.normpath(os.path.join(HERE, "..", "..", "brand"))
GAME = "https://claude.ai/artifact/VN7r7NMHe5kzcG5jzaDr3g"
# The parent company. The user confirmed this spelling on 2026-10-16.
COMPANY = "Chacklate Experiences"


def icon(name):
    s = open(os.path.join(HERE, "icons", name + ".svg")).read()
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    # files that went through the shared folder carry provenance metadata; the page does not need it
    s = re.sub(r"<metadata>.*?</metadata>", "", s, flags=re.S)
    s = re.sub(r'\s+xmlns:c2pa="[^"]*"', "", s)
    s = re.sub(r'\s*class="[^"]*"', "", s)
    s = re.sub(r'\s(width|height)="24"', "", s)
    return re.sub(r"\s+", " ", s).replace("> <", "><").strip().replace("<svg ", '<svg aria-hidden="true" ', 1)


def data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode()


def band(key, still, alt):
    """A full-bleed band: the looping game video when it exists, else the still picture."""
    img = f'<img src="rooms/{still}-1800.jpg" srcset="rooms/{still}-1800.jpg 1800w, rooms/{still}.jpg 2880w" sizes="100vw" alt="{alt}">'
    if not os.path.exists(os.path.join(SITE, "video", key + ".mp4")):
        return img
    poster = f"video/{key}-poster.jpg" if os.path.exists(os.path.join(SITE, "video", key + "-poster.jpg")) else f"rooms/{still}-1800.jpg"
    webm = f'<source src="video/{key}.webm" type="video/webm">' if os.path.exists(os.path.join(SITE, "video", key + ".webm")) else ""
    return (f'<video autoplay muted loop playsinline preload="metadata" poster="{poster}" aria-label="{alt}">{webm}'
            f'<source src="video/{key}.mp4" type="video/mp4"></video>')


ROOM_TOUR = [("al-fahidi-majlis", "Al Fahidi Majlis"), ("tokyo-janso", "Tokyo Jansō"), ("hk-teahouse", "Hong Kong Tea House"), ("imperial", "Forbidden City")]


def rooms_tour(alt):
    """The room tour: one 8-second clip per room, crossfaded in the page, each opening with its name."""
    clips = [(k, n) for k, n in ROOM_TOUR if os.path.exists(os.path.join(SITE, "video", f"room-{k}.mp4"))]
    if len(clips) < len(ROOM_TOUR):
        return band("rooms", "room-dubai", alt)
    data = html.escape(json.dumps([[f"video/room-{k}.mp4", n] for k, n in clips], ensure_ascii=False))
    k0 = clips[0][0]
    names = "".join(f'<span class="rt-n" data-i="{i}">{html.escape(n)}</span>' for i, (k, n) in enumerate(clips))
    return (f'<div class="rtour" data-clips="{data}" aria-label="{html.escape(alt)}" role="img">'
            f'<video muted playsinline preload="auto" poster="video/room-{k0}-poster.jpg" src="video/room-{k0}.mp4"></video>'
            f'<video muted playsinline preload="none"></video>'
            f'<p class="rt-title" aria-hidden="true">{names}</p></div>')


def tour():
    lines = json.load(open(os.path.join(SITE, "tour", "lines.json")))
    cp = os.path.join(SITE, "tour", "captions.json")
    caps = json.load(open(cp)) if os.path.exists(cp) else {}
    out = {}
    for k, text in lines.items():
        if not isinstance(text, str):
            text = " ".join(x if isinstance(x, str) else x["zh"] for x in text)
        cues = caps.get(k) or [{"t": 0, "text": x} for x in re.split(r"(?<=[.!?])\s+", text.strip())]
        out[k] = {"src": f"tour/mei-{k}.mp3", "cues": cues}
    return out


def i18n():
    """Every language's dictionary (English text -> translation), from src/i18n/<lang>.json."""
    d = {}
    for lang in ["zh-Hans", "zh-Hant", "ja", "ar", "hi"]:
        f = os.path.join(HERE, "i18n", lang + ".json")
        if os.path.exists(f):
            d[lang] = json.load(open(f))
    return d


def strings(page):
    """The English text a visitor can see or hear, for the translators (src/i18n/en.json)."""
    from html.parser import HTMLParser
    found, skip = [], []
    class P(HTMLParser):
        def handle_starttag(self, tag, attrs):
            a = dict(attrs)
            if tag in ("script", "style"): skip.append(tag)
            for k in ("alt", "aria-label"):
                if a.get(k, "").strip(): found.append(a[k].strip())
        def handle_endtag(self, tag):
            if skip and tag == skip[-1]: skip.pop()
        def handle_data(self, data):
            if not skip and data.strip() and not re.fullmatch(r"[\d\s/·.,%+-]+", data.strip()): found.append(re.sub(r"\s+", " ", data.strip()))
    P().feed(page)
    for k, v in tour().items():
        found += [c["text"] for c in v["cues"]]
    found += ["Tap anywhere and I will carry on the tour."]
    seen, out = set(), []
    for x in found:
        if x not in seen and x not in ("JongClub", "English", "简体中文", "繁體中文", "日本語", "العربية", "हिन्दी", "M"):
            seen.add(x); out.append(x)
    return out


# brand assets published beside the page
assets = os.path.join(SITE, "assets")
os.makedirs(assets, exist_ok=True)
for src, dst in [("png/jongclub-crest-1024.webp", "crest-1024.webp"), ("png/jongclub-crest-256.webp", "crest-256.webp"),
                 ("jongclub-wordmark-embossed.svg", "wordmark.svg")]:
    data = open(os.path.join(BRAND, src), "rb").read()
    if dst.endswith(".svg"):
        data = re.sub(rb"<metadata>.*?</metadata>", b"", data, flags=re.S)
    open(os.path.join(assets, dst), "wb").write(data)
# the studio's placeholder mark (brand/chacklate), cream lettering for the dark page
for src, dst in [("chacklate/chacklate-logo-dark-bg.svg", "chacklate-logo.svg"), ("chacklate/chacklate-mark.svg", "chacklate-mark.svg")]:
    data = re.sub(rb"<metadata>.*?</metadata>", b"", open(os.path.join(BRAND, src), "rb").read(), flags=re.S)
    open(os.path.join(assets, dst), "wb").write(data)


# ---- the Atelier, from the game's catalogue (src/collection.json, written by the capture tool)
cat = json.load(open(os.path.join(HERE, "collection.json")))
fmt = lambda n: f"{n:,}"
def price(c):
    if c.get("earnedBy"):
        return f'<span class="price"><span class="icon">{icon("route")}</span>{html.escape(c["earnedBy"].split(" reward track")[0])}</span>'
    if not c["price"]:
        return f'<span class="price"><span class="icon">{icon("gem")}</span>Yours from the start</span>'
    return f'<span class="price"><span class="icon">{icon("coins")}</span>{fmt(c["price"])} JP</span>'
def piece(c, img, alt, head=""):
    blurb = html.escape(c["blurb"].split(" Or open it free")[0])
    return (f'<figure class="piece"><div class="case"><img src="{img}" alt="{html.escape(alt)}"></div>'
            f'<figcaption>{head}<h3>{html.escape(c["name"])}</h3><p>{blurb}</p>{price(c)}</figcaption></figure>')
tiles = [t for t in cat["tiles"] if not t["id"].startswith("season-")]
seasons = [t for t in cat["tiles"] if t["id"].startswith("season-")]
# the price pill already names each season's city, so the six blurbs share one short line
for t in seasons:
    t["blurb"] = "Earned on the season track, never sold."
# shorter showcase lines than the game's catalogue carries, so the page reads quickly
SHORT = {
    "classic-ivory": "Warm ivory on a jade-green lacquer back.",
    "jade": "Mottled jade, brush-carved glyphs, a cloud engraved on each back.",
    "obsidian": "Volcanic glass, gold-leaf glyphs and kintsugi veins.",
    "pearl": "Iridescent shell faces that shift colour as they turn.",
    "crystal": "Clear faceted glass, gem-coloured glyphs glowing within.",
    "black-marble": "Carrara faces carved like a monument, backed in black stone.",
    "royal-gold": "Solid gilded tiles with an embossed dragon seal on every back.",
    "champagne": "Blush faces, rose-gold Art Deco backs, fine Song calligraphy.",
    "sapphire": "Ming porcelain, cobalt brushwork, waves painted on the backs.",
    "noyer": "The grand-maison set: ivory resin on solid walnut, stamped with a gilt sparrow seal.",
    "amethyst": "Polished amethyst in gold, set with gilt symbols and ruby cabochons.",
    "gilt-porcelain": "White porcelain in a beaded gilt frame, on blush backs.",
    "rack-table": "Cut from the table’s own wood, lined in brass.",
    "rack-walnut": "Oiled walnut, green baize ledges and brass end caps.",
    "rack-rosewood": "Polished rosewood, twin brass lines, oxblood leather ledges.",
    "rack-trunk": "Walnut, beech, green suede and brass rivets, like a travelling games trunk.",
    "rack-pearl": "Gloss ebony inlaid with mother-of-pearl on midnight velvet.",
    "rack-jade": "Dark zitan with carved jade cartouches framed in gold.",
    "rack-gilt": "Solid gilt engraved with clouds, set with jade and rubies. The emperor’s own.",
    "private-club": "Walnut panelling, porcelain shelves, low light, leather and brass.",
    "tokyo": "A tatami room behind shoji screens, neon rain beyond.",
    "taipei": "Red lacquer columns, a moon gate and strings of lanterns.",
    "dubai": "Mashrabiya arches and a brass lantern at desert sunset.",
    "shanghai": "A jazz-age lounge in black lacquer and gold, the Bund beyond.",
    "kyoto": "A tea pavilion over bamboo and maple, in soft afternoon light.",
    "hk-teahouse": "Teak booths, green-tiled walls, birdcages and a slow ceiling fan.",
    "tokyo-janso": "A Shōwa-era mahjong parlour, rule boards on the wall, rain on the window.",
    "al-fahidi-majlis": "Coral-stone walls, sadu cushions and cardamom coffee.",
}
for c in cat["tiles"] + cat["racks"] + cat["envs"]:
    c["blurb"] = SHORT.get(c["id"], c["blurb"])
STAR = "noyer"
order = [STAR, "amethyst", "gilt-porcelain", "royal-gold", "obsidian", "jade", "crystal", "pearl", "cinnabar", "sapphire", "black-marble", "emerald", "champagne", "walnut", "bone-bamboo", "classic-ivory"]
tiles = sorted(tiles, key=lambda t: order.index(t["id"]) if t["id"] in order else 99)
racks = sorted(cat["racks"], key=lambda r: r["price"] or 0)


def thumb(src):
    """A small copy of a picture for the carousel's thumbnail strip."""
    from PIL import Image
    out = src.replace(".jpg", "-thumb.jpg").replace("rooms/room-", "rooms/thumb-").replace("-1800-thumb", "-thumb")
    full = os.path.join(SITE, out)
    if not os.path.exists(full) or os.path.getmtime(full) < os.path.getmtime(os.path.join(SITE, src)):
        im = Image.open(os.path.join(SITE, src)).convert("RGB")
        im.thumbnail((480, 480))
        im.save(full, quality=80, optimize=True, progressive=True)
    return out


def orbit(kind, cid):
    """A room's slow 3D orbit, played over its still while that room is on show."""
    if kind != "rooms" or not os.path.exists(os.path.join(SITE, "video", f"orbit-{cid}.mp4")):
        return ""
    return f'<video class="orbit" muted loop playsinline preload="none" aria-hidden="true" data-src="video/orbit-{cid}.mp4"></video>'
def slide(c, img, alt, eyebrow, i, kind):
    blurb = html.escape(c["blurb"].split(" Or open it free")[0])
    on = " on" if i == 0 else ""
    return (f'<div class="slide{on}" data-i="{i}" data-voice="item-{kind}-{c['id']}"><div class="car-view"><div class="case"><img src="{img}" alt="{html.escape(alt)}"{"" if i == 0 else " loading=\"lazy\""}>{orbit(kind, c['id'])}</div></div>'
            f'<div class="car-info"><span class="eyebrow">{eyebrow}</span><h3>{html.escape(c["name"])}</h3><p>{blurb}</p>{price(c)}</div></div>')


def panel(key, label, ic, items, first):
    slides, thumbs = [], []
    for i, (c, img, alt, eyebrow) in enumerate(items):
        slides.append(slide(c, img, alt, eyebrow, i, key))
        thumbs.append(f'<button type="button" data-i="{i}" aria-label="{html.escape(c["name"])}"{" aria-current=\"true\"" if i == 0 else ""}><img src="{thumb(img)}" alt="" loading="lazy"><span class="tn">{html.escape(c["name"])}</span></button>')
    hidden = "" if first else " hidden"
    return (f'<div class="car-panel" id="car-{key}" role="tabpanel" aria-label="{label}"{hidden}>'
            f'<div class="car-stage">{"".join(slides)}</div>'
            f'<div class="car-nav"><button type="button" class="prev" aria-label="Previous"><span class="icon">{icon("chevron-left")}</span></button>'
            f'<span class="count"><b>1</b> / {len(items)}</span>'
            f'<button type="button" class="next" aria-label="Next"><span class="icon">{icon("chevron-right")}</span></button></div>'
            f'<div class="tstrip"><button type="button" class="tarrow l" aria-label="Previous" tabindex="-1"><span class="icon">{icon("chevron-left")}</span></button>'
            f'<div class="thumbs">{"".join(thumbs)}</div>'
            f'<button type="button" class="tarrow r" aria-label="Next" tabindex="-1"><span class="icon">{icon("chevron-right")}</span></button></div>'
            f'<div class="tbar" aria-hidden="true"><span></span></div></div>')


cats = [
    ("tiles", "Tile sets", "gem", [(t, f"collection/tiles-{t['id']}.jpg", f"The {t['name']} tile set.", "The masterpiece" if t["id"] == STAR else "Tile set") for t in tiles]
     + [(t, f"collection/tiles-{t['id']}.jpg", f"The {t['name']} season tile set.", "Season exclusive") for t in seasons]),
    ("racks", "Racks", "armchair", [(r, f"collection/racks-{r['id']}.jpg", f"The {r['name']} tile rack.", "Tile rack") for r in racks]),
    ("rooms", "Rooms", "lamp-ceiling", [(e, f"rooms/room-{e['id']}-1800.jpg", e["name"] + (" room." if not e["name"].startswith("The ") else "."), "Room") for e in cat["envs"]]),
]
tabs = "".join(f'<button type="button" role="tab" aria-controls="car-{k}" aria-selected="{"true" if n == 0 else "false"}"><span class="icon">{icon(ic)}</span>{label}<small>{len(items)}</small></button>' for n, (k, label, ic, items) in enumerate(cats))
carousel = f'<div class="car"><div class="car-tabs" role="tablist" aria-label="The collection">{tabs}</div>' + "".join(panel(k, label, ic, items, n == 0) for n, (k, label, ic, items) in enumerate(cats)) + "</div>"
groups = [("table", "Table cloths"), ("frame", "Portrait frames"), ("avatar", "Outfits"), ("accessory", "Accessories"), ("winAnimation", "Win animations"), ("tableEffect", "Table effects"), ("sound", "Sounds")]
extras = []
for key, label in groups:
    items = [r for r in cat["rest"] if r["cat"] == key and r["id"] not in ("none", "fx-none")]
    sw = items[min(3, len(items) - 1)]["swatch"]
    names = ", ".join(r["name"] for r in items[:2])
    medal = os.path.join(SITE, "assets", "details", key + ".webp")
    art = (f'<img class="medal" src="assets/details/{key}.webp" alt="" width="360" height="360">' if os.path.exists(medal)
           else f'<span class="swatch" style="background:conic-gradient({sw[0]} 0 45%, {sw[1]} 0 80%, {sw[2]} 0)"></span>')
    n, word = len(items), label.lower()
    extras.append(f'<div class="extra">{art}<div><b>{n} {word}</b><span>{html.escape(names)} and more</span></div></div>')

page = open(os.path.join(HERE, "index.template.html")).read()
page = re.sub(r"\{\{ICON:([a-z0-9-]+)\}\}", lambda m: icon(m.group(1)), page)
page = (page
        .replace("{{FAVICON}}", data_uri(os.path.join(BRAND, "png", "jongclub-crest-64.png"), "image/png"))
        .replace("{{CREST_LG}}", "assets/crest-1024.webp")
        .replace("{{CREST_SM}}", "assets/crest-256.webp")
        .replace("{{WORDMARK}}", "assets/wordmark.svg")
        .replace("{{COMPANY}}", COMPANY)
        .replace("{{GAME}}", GAME)
        .replace("{{CAROUSEL}}", carousel)
        .replace("{{BAND_OPENING}}", band("opening", "room-taipei", "The match opening in the Taipei Night Market room: the automatic table shuffles and builds the walls."))
        .replace("{{BAND_ROOMS}}", rooms_tour("A slow walk through the club's rooms, from the Dubai Majlis to Tokyo and Hong Kong."))
        .replace("{{EXTRAS}}", "\n".join(extras))
        .replace("{{N_TILESETS}}", str(len(cat["tiles"]))).replace("{{N_ROOMS}}", str(len(cat["envs"]))))
# one-line chapter titles: the CSS sizes each by its character count
page = re.sub(r'<h2 class="title"([^>]*)>(.*?)</h2>', lambda m: f'<h2 class="title"{m.group(1)} style="--len:{len(html.unescape(re.sub(r"<[^>]+>", "", m.group(2))).strip())}">{m.group(2)}</h2>', page, flags=re.S)
page = page.replace("{{TOUR}}", json.dumps(tour(), ensure_ascii=False)).replace("{{ZEN}}", open(os.path.join(HERE, "zen.js")).read().strip())
en = strings(page.replace("{{I18N}}", "{}"))
json.dump(en, open(os.path.join(HERE, "i18n", "en.json"), "w"), ensure_ascii=False, indent=0)
page = page.replace("{{I18N}}", json.dumps(i18n(), ensure_ascii=False))
assert "{{" not in page, re.findall(r"\{\{[^}]*\}\}", page)
open(os.path.join(SITE, "index.html"), "w").write(page)
print("wrote website/index.html", len(page) // 1024, "KB")
