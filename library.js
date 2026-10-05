/* =========================================================
   STORY CARD FORGER
   Version 1.0

   Commands:
     !forge <type> [name]      Forge a new story card
     !template                 List all templates
     !template <type>          View/create a template
     !template <type> reset    Restore built-in default
     !config                   Show the config card
     !config reset             Reset config to defaults
     !help                     Show command reference
     Aliases: !create !make !new
              !templates
              !settings
              !commands

   Config card: STORY_CARD_FORGER_CONFIG
     User-editable. Controls retries, toasts, sentinels,
     known-facts extraction, fallback type, per-field hints,
     and the one-time !help banner.
   ========================================================= */

var TemplateFactory = (function () {

    var VERSION = "1.0";
    var TEMPLATE_PREFIX = "TEMPLATE_";
    var CONFIG_KEY = "STORY_CARD_FORGER_CONFIG";
    var SILENT_MARKER = ".";

    var MARK_FORGING = "\u2692\uFE0F";
    var MARK_FORGED  = "\u2728";
    var MARK_FAILED  = "\u26A0\uFE0F";

    var TEXT_FORGING = "F O R G I N G   A   C A R D\u2026";
    var TEXT_FORGED  = "C A R D   F O R G E D";
    var TEXT_FAILED  = "F O R G I N G   F A I L E D";

    var SENTINEL_TEXTS = [TEXT_FORGING, TEXT_FORGED, TEXT_FAILED];

    var HELP_BANNER = "\n    \u24D8  !help  \u00b7  !template  \u00b7  !config\n";

    var DEFAULT_CONFIG_ENTRY = [
        "# Story Card Forger configuration. Edit values below.",
        "# Boolean values: true / false. Unknown lines are ignored.",
        "",
        "Max Attempts: 3",
        "Enable Toasts: true",
        "Enable Sentinels: true",
        "Known Facts Enabled: true",
        "Known Facts Limit: 12",
        "Fallback Type: generic",
        "Announce Help On First Use: true",
        "Generate Names With AI: true",
        "",
        "# Per-field hints override the built-in brevity rules.",
        "# Format:  Hint <Field Label>: <hint text>",
        "# Hint Description: ONE short sentence covering build, hair, eyes, and a distinguishing feature"
    ].join("\n");

    var DEFAULT_TEMPLATES = {
        character: { entry: [
            "Full name: {{name}}",
            "Age: {{age}}",
            "Gender: {{gender}}",
            "Description: {{description}}"
        ].join("\n") },
        location: { entry: [
            "Name: {{name}}",
            "Type: {{type}}",
            "Description: {{description}}",
            "Atmosphere: {{atmosphere}}",
            "Notable Features: {{features}}"
        ].join("\n") },
        item: { entry: [
            "Name: {{name}}",
            "Type: {{type}}",
            "Description: {{description}}",
            "Properties: {{properties}}",
            "Origin: {{origin}}"
        ].join("\n") },
        faction: { entry: [
            "Name: {{name}}",
            "Type: {{type}}",
            "Description: {{description}}",
            "Goals: {{goals}}",
            "Notable Members: {{members}}"
        ].join("\n") },
        generic: { entry: [
            "Name: {{name}}",
            "Type: {{type}}",
            "Description: {{description}}"
        ].join("\n") }
    };

    var POOLED_TYPES = ["character", "location", "item", "faction"];

    var NAME_POOLS = {
        character: {
            first: [
                "Alric","Bryn","Cass","Dara","Elara","Finn","Greta","Halden",
                "Iris","Joren","Kael","Lyra","Mira","Nyx","Orin","Perrin",
                "Quinn","Rhea","Sable","Tarin","Una","Vera","Wren","Xara",
                "Yrsa","Zane","Ashe","Bela","Corvin","Dain","Ewan","Faye",
                "Gale","Hana","Idris","Joss","Kira","Lior","Maren","Nia",
                "Pax","Rune","Soren","Thea","Ursa","Vesper","Wyatt","Yara","Zeph"
            ],
            last: [
                "Abernathy","Blackwood","Corvin","Drakemoor","Everhart",
                "Farrow","Greystone","Holloway","Ironwood","Kestrel",
                "Lockhart","Marsh","Nightingale","Oakley","Pryce",
                "Quillon","Ravenscroft","Stone","Thorne","Underhill",
                "Valen","Winterbourne","Yates","Ashford","Brightwater",
                "Cairn","Duskwind","Emberly"
            ]
        },
        location: {
            prefix: [
                "Dark","Silent","Frozen","Broken","Golden","Crimson",
                "Hollow","Ancient","Forgotten","Shimmering","Whispering",
                "Sunken","Emerald","Iron","Crystal","Bleeding","Gilded",
                "Pale","Ashen","Verdant"
            ],
            suffix: [
                "Forest","Peak","Hollow","Vale","Ruins","Glade","Cave",
                "Pass","Bay","Isle","Keep","Citadel","Sanctum","Grove",
                "Reach","Wastes","Moor","Fen","Cliff","Chasm","Wilds",
                "Marsh","Highlands","Crossroads","Crossing"
            ]
        },
        item: {
            prefix: [
                "Rusted","Ancient","Glowing","Cracked","Blessed","Cursed",
                "Silver","Onyx","Ember","Frost","Tarnished","Gilded",
                "Whispering","Moonlit","Sunforged"
            ],
            noun: [
                "Blade","Amulet","Key","Chalice","Tome","Ring","Cloak",
                "Lantern","Sigil","Idol","Scroll","Orb","Dagger","Crown",
                "Mask","Pendant","Compass","Mirror","Bell","Candle"
            ]
        },
        faction: {
            prefix: [
                "Crimson","Silver","Iron","Black","Golden","Ashen",
                "Verdant","Obsidian","Ivory","Sable","Copper","Emerald"
            ],
            suffix: [
                "Order","Covenant","Syndicate","Legion","Assembly",
                "Consortium","Brotherhood","Cabal","Conclave","Circle",
                "Compact","Accord"
            ]
        }
    };

    /* ================= UTILITIES ================= */

    function clean(v) { return String(v == null ? "" : v).replace(/\r/g, "").trim(); }
    function normalize(v) { return clean(v).toLowerCase().replace(/\s+/g, " "); }
    function titleCase(s) {
        return String(s || "").replace(/\w\S*/g, function (t) { return t.charAt(0).toUpperCase() + t.substring(1).toLowerCase(); });
    }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function normPh(s) { return String(s || "").toLowerCase().replace(/[\s_\-]+/g, ""); }
    function number(v, def) {
        var n = Number(v);
        return isFinite(n) ? n : (def == null ? 0 : def);
    }
    function parseBool(v, def) {
        if (v == null || v === "") return def;
        var s = String(v).toLowerCase().trim();
        if (s === "false" || s === "no" || s === "off" || s === "0") return false;
        if (s === "true" || s === "yes" || s === "on" || s === "1") return true;
        return def;
    }

    function toast(state, msg, cfg) {
        if (cfg && cfg.enableToasts === false) return;
        try { if (state) state.message = msg; } catch (e) {}
    }

    /* ================= CONFIG ================= */

    function defaultConfig() {
        return {
            maxAttempts: 3,
            enableToasts: true,
            enableSentinels: true,
            knownFactsEnabled: true,
            knownFactsLimit: 12,
            fallbackType: "generic",
            announceHelpOnFirstUse: true,
            generateNamesWithAI: true,
            hintOverrides: {}
        };
    }

    function readConfig(storyCards) {
        var cfg = defaultConfig();
        var found = findCard(CONFIG_KEY, storyCards);
        if (!found) return cfg;
        var raw = cardEntry(found.card);
        raw.split("\n").forEach(function (line) {
            var s = line.trim();
            if (!s) return;
            if (s.charAt(0) === "#") return;
            var p = s.indexOf(":");
            if (p === -1) return;
            var k = s.substring(0, p).trim().toLowerCase();
            var v = s.substring(p + 1).trim();
            if (k === "max attempts")               cfg.maxAttempts = Math.max(1, Math.min(10, number(v, 3)));
            else if (k === "enable toasts")         cfg.enableToasts = parseBool(v, true);
            else if (k === "enable sentinels")      cfg.enableSentinels = parseBool(v, true);
            else if (k === "known facts enabled")   cfg.knownFactsEnabled = parseBool(v, true);
            else if (k === "known facts limit")     cfg.knownFactsLimit = Math.max(0, Math.min(50, number(v, 12)));
            else if (k === "fallback type")         cfg.fallbackType = clean(v) || "generic";
            else if (k === "announce help on first use")
                                                    cfg.announceHelpOnFirstUse = parseBool(v, true);
            else if (k === "generate names with ai") cfg.generateNamesWithAI = parseBool(v, true);
            else if (k.indexOf("hint ") === 0) {
                var label = k.substring(5).trim();
                if (label) cfg.hintOverrides[label] = v;
            }
        });
        return cfg;
    }

    function ensureConfigCard(storyCards) {
        if (findCard(CONFIG_KEY, storyCards)) return;
        try { addStoryCard(CONFIG_KEY, DEFAULT_CONFIG_ENTRY, "Config"); } catch (e) {}
    }

    function configHelpText(storyCards) {
        var cfg = readConfig(storyCards);
        var lines = ["===== STORY CARD FORGER CONFIG ====="];
        lines.push("Card key: " + CONFIG_KEY);
        lines.push("");
        lines.push("Effective settings:");
        lines.push("  Max Attempts                " + cfg.maxAttempts);
        lines.push("  Enable Toasts               " + cfg.enableToasts);
        lines.push("  Enable Sentinels            " + cfg.enableSentinels);
        lines.push("  Known Facts Enabled         " + cfg.knownFactsEnabled);
        lines.push("  Known Facts Limit           " + cfg.knownFactsLimit);
        lines.push("  Fallback Type               " + cfg.fallbackType);
        lines.push("  Announce Help On First Use  " + cfg.announceHelpOnFirstUse);
        lines.push("  Generate Names With AI      " + cfg.generateNamesWithAI);
        var hintKeys = Object.keys(cfg.hintOverrides);
        if (hintKeys.length) {
            lines.push("");
            lines.push("Hint overrides:");
            hintKeys.forEach(function (k) {
                lines.push("  " + titleCase(k) + " \u2192 " + cfg.hintOverrides[k]);
            });
        }
        lines.push("");
        lines.push("Edit the story card to change any value.");
        lines.push("  !config reset   \u2014 restore defaults");
        lines.push("====================================");
        return lines.join("\n");
    }

    function resetConfig(storyCards) {
        var found = findCard(CONFIG_KEY, storyCards);
        if (found) {
            try { updateStoryCard(found.index, CONFIG_KEY, DEFAULT_CONFIG_ENTRY, "Config"); } catch (e) {}
            return "Config reset to defaults.";
        }
        try { addStoryCard(CONFIG_KEY, DEFAULT_CONFIG_ENTRY, "Config"); } catch (e) {}
        return "Config card created with defaults.";
    }

    /* ================= HELP ================= */

    function helpText() {
        var lines = [];
        lines.push("===== STORY CARD FORGER =====");
        lines.push("");
        lines.push("!forge <type> [name]       Forge a new story card");
        lines.push("                           Type can be any word \u2014 unknown types");
        lines.push("                           use the fallback template.");
        lines.push("                           Leave name empty for a random one.");
        lines.push("");
        lines.push("!template                  List all templates");
        lines.push("!template <type>           Create or view a template");
        lines.push("!template <type> reset     Restore the built-in default");
        lines.push("");
        lines.push("!config                    Show current settings");
        lines.push("!config reset              Reset settings to defaults");
        lines.push("");
        lines.push("!help                      This message");
        lines.push("");
        lines.push("Aliases:  !create  !make  !new       for !forge");
        lines.push("          !templates                 for !template");
        lines.push("          !settings                  for !config");
        lines.push("          !commands                  for !help");
        lines.push("");
        lines.push("Built-in types: " + POOLED_TYPES.join(", "));
        lines.push("Custom types:   add a story card keyed TEMPLATE_<TYPE>");
        lines.push("Config card:    " + CONFIG_KEY);
        lines.push("=============================");
        return lines.join("\n");
    }

    /* ================= FIELD HINTS ================= */

    function fieldHint(label, cardType, cfg) {
        var l = String(label || "").toLowerCase().trim();
        var t = String(cardType || "").toLowerCase().trim();
        if (cfg && cfg.hintOverrides && cfg.hintOverrides[l]) return cfg.hintOverrides[l];
        if (l === "description") {
            if (t === "character") {
                return "ONE short sentence (15\u201325 words) covering overall build, hair length and colour, eye colour, and \u2014 if female \u2014 bust size, plus ONE distinguishing feature";
            }
            return "ONE short sentence (12\u201320 words)";
        }
        if (l === "age")              return "a short value like \"27\" or \"mid-30s\"";
        if (l === "gender")           return "a single word (Male, Female, Non-binary, etc.)";
        if (l === "atmosphere")       return "3\u20136 evocative words";
        if (l === "notable features") return "a comma-separated list of 3\u20134 short features";
        if (l === "properties")       return "a comma-separated list of 3\u20134 short traits";
        if (l === "origin")           return "3\u20138 words about where it came from";
        if (l === "goals")            return "5\u201310 words about what the faction wants";
        if (l === "notable members")  return "a comma-separated list of 2\u20133 names";
        if (l === "job title" || l === "job" || l === "occupation" || l === "role")
            return "a short occupation like \"Baker\" or \"Blacksmith\" (1\u20133 words)";
        if (l === "hair" || l === "hair colour" || l === "hair color")
            return "hair colour and length in 3\u20136 words";
        if (l === "eyes" || l === "eye colour" || l === "eye color")
            return "eye colour in 1\u20133 words";
        if (l === "title" || l === "epithet" || l === "nickname")
            return "a short title or epithet (1\u20134 words)";
        if (l === "full name" || l === "name") return "the entity's complete name";
        return "one short sentence";
    }

    /* ================= NAME POOLS ================= */

    function generateName(type, storyCards) {
        var t = normalize(type);
        var base = "";
        if (t === "character") {
            base = pick(NAME_POOLS.character.first) + " " + pick(NAME_POOLS.character.last);
        } else if (t === "location") {
            base = pick(NAME_POOLS.location.prefix) + " " + pick(NAME_POOLS.location.suffix);
        } else if (t === "item") {
            base = pick(NAME_POOLS.item.prefix) + " " + pick(NAME_POOLS.item.noun);
        } else if (t === "faction") {
            base = pick(NAME_POOLS.faction.prefix) + " " + pick(NAME_POOLS.faction.suffix);
        } else {
            base = "Unnamed " + titleCase(type);
        }
        return uniqueName(base, storyCards);
    }
    function uniqueName(base, storyCards) {
        if (!findCard(base, storyCards)) return base;
        for (var i = 2; i < 100; i++) {
            var candidate = base + " " + i;
            if (!findCard(candidate, storyCards)) return candidate;
        }
        return base + " " + Math.floor(Date.now() % 100000);
    }

    /* ================= MENTIONS ================= */

    function extractMentions(text, name, limit) {
        if (!text || !name) return [];
        var n = String(name).toLowerCase().trim();
        if (n.length < 2) return [];
        var flat = String(text).replace(/\s*\n\s*/g, " ");
        var sentences = flat.split(/(?<=[.!?])\s+/);
        var out = [];
        for (var i = 0; i < sentences.length; i++) {
            var s = sentences[i].trim();
            if (!s || s.length < 12) continue;
            var re = new RegExp("(?:^|[^A-Za-z])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:[^A-Za-z]|$)", "i");
            if (re.test(s)) out.push(s);
        }
        var cap = number(limit, 12);
        if (cap > 0 && out.length > cap) out = out.slice(-cap);
        return out;
    }

    /* ================= CARD READERS ================= */

    function keyArray(card) {
        if (!card) return [];
        var raw = card.keys;
        if (raw == null) raw = card.key;
        if (Array.isArray(raw)) return raw.map(String);
        if (typeof raw === "string") return raw.split(",").map(clean).filter(function (x) { return x !== ""; });
        if (raw == null) return [];
        return [String(raw)];
    }
    function cardEntry(card) {
        if (!card) return "";
        var raw = card.entry != null ? card.entry : card.value;
        if (raw == null) return "";
        return String(raw)
            .replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n")
            .replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    }
    function findCard(key, storyCards) {
        var wanted = normalize(key);
        var list = Array.isArray(storyCards) ? storyCards : [];
        for (var i = 0; i < list.length; i++) {
            var ks = keyArray(list[i]);
            for (var j = 0; j < ks.length; j++) {
                if (normalize(ks[j]) === wanted) return { card: list[i], index: i };
            }
        }
        return null;
    }
    function substitute(text, name, type) {
        return String(text || "")
            .replace(/\{\{\s*name\s*\}\}/gi, name)
            .replace(/\{\{\s*type\s*\}\}/gi, type);
    }

    /* ================= PENDING STATE ================= */

    function getPending(state) { return state && state.pendingCardFill; }
    function setPending(state, data) { if (state) state.pendingCardFill = data; }
    function clearPending(state) { if (state) delete state.pendingCardFill; }

    /* ================= HELP-BANNER SESSION FLAG ================= */

    function helpBannerConsumed(state) {
        if (!state) return true;
        return state.forgerHelpAnnounced === true;
    }
    function markHelpBannerConsumed(state) {
        if (state) state.forgerHelpAnnounced = true;
    }

    /* ================= TEMPLATE RESOLUTION ================= */

    function templateKey(type) {
        return TEMPLATE_PREFIX + String(type).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    }

    function resolveTemplate(type, storyCards, cfg) {
        cfg = cfg || defaultConfig();
        var key = templateKey(type);
        var found = findCard(key, storyCards);
        if (found) return { card: found.card, index: found.index, kind: normalize(type), userDefined: true };

        var builtin = DEFAULT_TEMPLATES[normalize(type)];
        if (builtin) return { card: null, index: -1, kind: normalize(type), default: builtin, userDefined: false };

        var fbType = cfg.fallbackType || "generic";
        var fbKey = templateKey(fbType);
        var fbFound = findCard(fbKey, storyCards);
        if (fbFound) return { card: fbFound.card, index: fbFound.index, kind: normalize(fbType), userDefined: true };

        return { card: null, index: -1, kind: "generic", default: DEFAULT_TEMPLATES.generic, userDefined: false };
    }

    function ensureDefaultTemplates(storyCards) {
        Object.keys(DEFAULT_TEMPLATES).forEach(function (type) {
            var key = templateKey(type);
            if (!findCard(key, storyCards)) {
                try { addStoryCard(key, DEFAULT_TEMPLATES[type].entry, "Template"); } catch (e) {}
            }
        });
        ensureConfigCard(storyCards);
    }

    function listTemplates(storyCards) {
        var lines = ["===== STORY CARD FORGER ====="];
        lines.push("");
        lines.push("Commands:");
        lines.push("  !forge <type> [name]       forge a new card");
        lines.push("  !template                  list all templates");
        lines.push("  !template <type>           view or create a template");
        lines.push("  !template <type> reset     restore built-in default");
        lines.push("  !config                    show the config card");
        lines.push("  !config reset              reset config to defaults");
        lines.push("  !help                      full command reference");
        lines.push("");
        lines.push("Built-in types: " + POOLED_TYPES.join(", "));
        lines.push("(Any word works \u2014 unknown types use the fallback template.)");
        lines.push("Empty name is randomised based on type.");
        lines.push("");
        lines.push("Existing templates in this save:");
        var seen = {};
        var list = Array.isArray(storyCards) ? storyCards : [];
        for (var i = 0; i < list.length; i++) {
            var ks = keyArray(list[i]);
            for (var j = 0; j < ks.length; j++) {
                var k = clean(ks[j]).toUpperCase();
                if (k.indexOf(TEMPLATE_PREFIX) === 0) {
                    var type = k.substring(TEMPLATE_PREFIX.length).toLowerCase();
                    if (!seen[type]) { seen[type] = true; lines.push("  \u2022 " + type); }
                    break;
                }
            }
        }
        lines.push("");
        lines.push("Edit:  open the story card with key TEMPLATE_<TYPE>");
        lines.push("=============================");
        return lines.join("\n");
    }

    function showTemplate(type, storyCards, cfg) {
        var t = resolveTemplate(type, storyCards, cfg);
        if (!t) return "No template found for type: " + type;
        var lines = ["===== TEMPLATE: " + t.kind.toUpperCase() + " ====="];
        if (t.card) {
            lines.push("Source: story card (editable)");
            lines.push("Card keys: " + keyArray(t.card).join(", "));
            lines.push("");
            lines.push(cardEntry(t.card));
        } else if (t.default) {
            lines.push("Source: built-in default");
            lines.push("");
            lines.push(t.default.entry);
        }
        lines.push("");
        lines.push("Placeholders: {{name}}, {{type}}, and any other {{placeholder}}.");
        lines.push("Lines may mix them, e.g. \"Name: {{name}} the {{title}}\".");
        lines.push("================================");
        return lines.join("\n");
    }

    function generateTemplate(type, storyCards, cfg) {
        var t = normalize(type);
        if (!t) return "Usage: !template <type>";
        var key = templateKey(t);
        var found = findCard(key, storyCards);
        if (found) {
            return showTemplate(t, storyCards, cfg) + "\n\n(Existing template shown above.)";
        }
        var content = "";
        if (DEFAULT_TEMPLATES[t]) {
            content = DEFAULT_TEMPLATES[t].entry;
        } else {
            var fb = (cfg && cfg.fallbackType) || "generic";
            content = (DEFAULT_TEMPLATES[fb] || DEFAULT_TEMPLATES.generic).entry;
        }
        try {
            addStoryCard(key, content, "Template");
        } catch (e) {
            return "Could not create template card: " + key;
        }
        return "Created template: " + key + "\n\n" + content + "\n\nEdit the story card to customise it, then use  !forge " + t + " <name>.";
    }

    function resetTemplate(type, storyCards) {
        var t = normalize(type);
        var def = DEFAULT_TEMPLATES[t];
        if (!def) return "No built-in default for type: " + type + "  (edit the card directly instead)";
        var key = templateKey(t);
        var found = findCard(key, storyCards);
        if (found) {
            try { updateStoryCard(found.index, key, def.entry, "Template"); } catch (e) {}
            return "Template reset to default: " + type;
        }
        try { addStoryCard(key, def.entry, "Template"); } catch (e) {}
        return "Template created from default: " + type;
    }

    /* ================= PLACEHOLDER EXTRACTION ================= */

    function extractPlaceholders(rawEntry) {
        var seen = {};
        var fields = [];
        var re = /\{\{([^}]+)\}\}/g;

        rawEntry.split("\n").forEach(function (ln) {
            var labelMatch = ln.match(/^\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.+)$/);
            var rawLabel = labelMatch ? labelMatch[1].trim() : "";
            var m;
            re.lastIndex = 0;
            while ((m = re.exec(ln)) !== null) {
                var ph = m[1].trim();
                var phNorm = normPh(ph);
                if (!phNorm) continue;
                if (phNorm === "name" || phNorm === "type") continue;
                if (seen[phNorm]) continue;
                seen[phNorm] = true;

                var effectiveLabel = rawLabel;
                if (!effectiveLabel || /^(full name|name|type)$/i.test(effectiveLabel)) {
                    effectiveLabel = titleCase(ph);
                }
                fields.push({ label: effectiveLabel, placeholder: phNorm });
            }
        });
        return fields;
    }

    /* ================= CARD CREATION ================= */

    function createFromTemplate(type, name, storyCards, state, cfg, needAIName) {
        var t = resolveTemplate(type, storyCards, cfg);
        if (!t) return { ok: false, msg: "No template for type: " + type };

        var rawTemplate = "";
        var keyTemplate = "";

        if (t.card) {
            rawTemplate = cardEntry(t.card);
            var lines = rawTemplate.split("\n");
            var keep = [];
            var foundKeys = false;
            lines.forEach(function (ln) {
                var m = ln.match(/^Keys?\s*:\s*(.+)$/i);
                if (m) { keyTemplate = m[1]; foundKeys = true; }
                else keep.push(ln);
            });
            if (!foundKeys) keyTemplate = "{{name}}";
            rawTemplate = keep.join("\n");
        } else if (t.default) {
            rawTemplate = t.default.entry;
            keyTemplate = "{{name}}";
        }

        var typeLabel = titleCase(type);

        /* ---- Fully-AI path: no name given, no card created here ---- */
        if (needAIName) {
            var bodyForFill = rawTemplate.replace(/\{\{\s*type\s*\}\}/gi, typeLabel);
            var fields = extractPlaceholders(bodyForFill);

            setPending(state, {
                cardKey: null,
                cardName: "",
                originalName: "",
                keysTemplate: keyTemplate,
                rawTemplate: rawTemplate,
                typeLabel: typeLabel,
                needAIName: true,
                type: type,
                displayType: typeLabel,
                rawEntry: bodyForFill,
                fields: fields,
                values: {},
                attempts: 0
            });

            toast(state, "\uD83D\uDCDD Forging " + typeLabel + "\u2026", cfg);
            return { ok: true, done: false };
        }

        /* ---- Named path: user supplied a name; create immediately ---- */
        var body = rawTemplate
            .replace(/\{\{\s*type\s*\}\}/gi, typeLabel)
            .replace(/\{\{\s*name\s*\}\}/gi, name);
        var keys = keyTemplate
            .replace(/\{\{\s*name\s*\}\}/gi, name)
            .replace(/\{\{\s*type\s*\}\}/gi, typeLabel);

        try {
            var idx = addStoryCard(keys, body, typeLabel);
            if (idx === false) return { ok: false, msg: "A story card with those keys already exists." };
        } catch (e) {
            return { ok: false, msg: "Could not create the story card." };
        }

        var fields2 = extractPlaceholders(body);
        if (fields2.length === 0) {
            toast(state, "\uD83D\uDCDD Card created: " + name + " (" + typeLabel + ")", cfg);
            return { ok: true, done: true };
        }

        setPending(state, {
            cardKey: keys,
            cardName: name,
            originalName: name,
            keysTemplate: keyTemplate,
            rawTemplate: rawTemplate,
            typeLabel: typeLabel,
            needAIName: false,
            type: type,
            displayType: typeLabel,
            rawEntry: body,
            fields: fields2,
            values: {},
            attempts: 0
        });

        toast(state, "\uD83D\uDCDD Forging " + typeLabel + ": " + name + "\u2026", cfg);
        return { ok: true, done: false };
    }

    /* ================= FIELD PARSING ================= */

    function parseFields(text, pending) {
        var values = {};
        var lookup = {};
        pending.fields.forEach(function (f) {
            lookup[f.label.toLowerCase()] = f;
            lookup[f.placeholder] = f;
        });

        String(text || "").split("\n").forEach(function (ln) {
            var s = ln
                .replace(/^\s*[\s>*#\u2022\u25b8\-]+\s*/, "")
                .replace(/\*\*/g, "")
                .replace(/^["'\u201c\u201d\u2018\u2019]+/, "")
                .replace(/["'\u201c\u201d\u2018\u2019]+\s*$/, "")
                .replace(/\s+$/, "");
            var m = s.match(/^([A-Za-z][A-Za-z ]{1,30}?)\s*:\s*(.+)$/);
            if (!m) return;
            var key = m[1].trim().toLowerCase();
            var val = m[2].trim();
            if (!val) return;
            if (!lookup[key]) return;
            if (looksLikeNarration(val)) return;
            values[lookup[key].placeholder] = val;
        });
        return values;
    }
    function looksLikeNarration(val) {
        var v = String(val).toLowerCase();
        if (/\byou\s+(?:see|hear|smell|feel|are|were|walk|step|stand|notice|realize|recognize)\b/.test(v)) {
            if (!/^you(?:'re| are)\s+(?:a|an|someone|the kind|one who)\b/.test(v)) return true;
        }
        if (/\b(?:lies? before|towering|crumbling|faded carv|shafts? of (?:sun)?light|dust (?:swirl|motes))\b/.test(v)) return true;
        return false;
    }
    function buildEntry(pending, values) {
        return pending.rawEntry.replace(/\{\{([^}]+)\}\}/g, function (match, ph) {
            var key = normPh(ph);
            if (key === "name") return pending.cardName;
            if (key === "type") return pending.displayType;
            if (values[key]) return values[key];
            return match;
        });
    }

    /* ================= SENTINELS ================= */

    function frameLine(marker, text, cfg) {
        if (cfg && cfg.enableSentinels === false) return ".";
        return "\n\n" + marker + "  " + text + "\n";
    }

    /* The forging sentinel optionally carries the one-time help
       banner. Caller decides whether to include it. */
    function forgingSentinel(cfg, withBanner) {
        if (cfg && cfg.enableSentinels === false) return ".";
        var out = "\n\n" + MARK_FORGING + "  " + TEXT_FORGING + "\n";
        if (withBanner) out += HELP_BANNER;
        return out;
    }
    function completionSentinel(cfg) { return frameLine(MARK_FORGED, TEXT_FORGED, cfg); }
    function failureSentinel(cfg)    { return frameLine(MARK_FAILED, TEXT_FAILED, cfg); }

    function scrubContext(text) {
        if (!text) return text;
        var t = String(text);
        t = t.split("\n").filter(function (ln) {
            for (var i = 0; i < SENTINEL_TEXTS.length; i++) {
                if (ln.indexOf(SENTINEL_TEXTS[i]) !== -1) return false;
            }
            /* Strip any line that is just the help banner. */
            if (/\u24D8\s*!help/.test(ln)) return false;
            return true;
        }).join("\n");
        t = t.replace(/\{\{[^}]+\}\}/g, "");
        t = t.replace(/^\s*!\s*(?:forge|create|template|make|new|config|settings|help|commands)\b.*$/gmi, " ");
        t = t.replace(/^.*\uD83D\uDCDD.*$/gmi, " ");
        t = t.replace(/[ \t]{2,}/g, " ");
        t = t.replace(/\n{3,}/g, "\n\n");
        return t;
    }

    /* ================= COMMAND PARSING ================= */

    function stripCommandWrapper(text) {
        var t = clean(text);
        t = t.replace(/^>\s*/, "");
        t = t.replace(/^You\s+(?:say|says|shout|shouts|whisper|whispers|yell|yells|ask|asks|reply|replies|do|does|try|tries|attempt|attempts|exclaim|exclaims)[,:]?\s*/i, "");
        t = t.replace(/[.!?]+\s*$/, "");
        t = t.replace(/^["'\u201c\u201d\u2018\u2019](.+)["'\u201c\u201d\u2018\u2019]$/, "$1");
        return clean(t);
    }
    function parseCommand(text) {
        var t = stripCommandWrapper(text);
        var m = t.match(/^!\s*(\w+)\s*(.*)$/);
        if (!m) return null;
        var cmd = m[1].toLowerCase();
        var arg = clean(m[2]);
        if (cmd === "forge" || cmd === "create" || cmd === "make" || cmd === "new") return { cmd: "forge", arg: arg };
        if (cmd === "template" || cmd === "templates") return { cmd: "template", arg: arg };
        if (cmd === "config" || cmd === "settings") return { cmd: "config", arg: arg };
        if (cmd === "help" || cmd === "commands") return { cmd: "help", arg: arg };
        return null;
    }
    function handleForge(arg, storyCards, state, cfg) {
        if (!arg) {
            return { ok: false, msg: "Usage: !forge <type> [name]\nTypes: " +
                POOLED_TYPES.join(", ") + "  (or any word for a custom template)\nExample: !forge character  /  !forge location Dark Forest" };
        }
        var parts = arg.split(/\s+/);
        var type = (parts[0] || "").toLowerCase();
        if (type === "help" || type === "?" || type === "list" || type === "types") {
            return { ok: false, msg: listTemplates(storyCards) };
        }
        var name = parts.slice(1).join(" ").trim();

        /* Fully AI path: no name means the AI invents one. The pool is
           no longer consulted here. */
        if (!name) {
            return createFromTemplate(type, "", storyCards, state, cfg, true);
        }
        return createFromTemplate(type, name, storyCards, state, cfg, false);
    }
    function handleTemplate(arg, storyCards, cfg) {
        if (!arg || normalize(arg) === "list") return listTemplates(storyCards);
        var parts = arg.split(/\s+/);
        var type = (parts[0] || "").toLowerCase();
        var sub = (parts[1] || "").toLowerCase();
        if (sub === "reset") return resetTemplate(type, storyCards);
        return generateTemplate(type, storyCards, cfg);
    }
    function handleConfig(arg, storyCards) {
        var sub = normalize(arg);
        if (sub === "reset") return resetConfig(storyCards);
        return configHelpText(storyCards);
    }
    function isTrivialInput(raw) {
        if (!raw) return true;
        if (/^[\s.]+$/.test(raw)) return true;
        if (/^(?:continue|go|next|ok|okay|yes|y|sure|more|\u2026+)$/i.test(raw)) return true;
        if (raw.length <= 3) return true;
        return false;
    }

    /* ================= HOOKS ================= */

    function onInput(text, storyCards, state) {
        ensureDefaultTemplates(storyCards);
        var cfg = readConfig(storyCards);
        var p = getPending(state);

        if (p) {
            var raw = clean(text);
            if (/^!\s*cancel\b/i.test(raw)) {
                clearPending(state);
                toast(state, "\u2716 Card creation cancelled.", cfg);
                return { text: ".", stop: false };
            }
            if (isTrivialInput(raw)) {
                return { text: ".", stop: false };
            }
            clearPending(state);
            toast(state, "\u2716 Card creation abandoned.", cfg);
        }

        var parsed = parseCommand(text);
        if (parsed) {
            if (parsed.cmd === "help") {
                return { text: helpText(), stop: false };
            }
            if (parsed.cmd === "forge") {
                var res = handleForge(parsed.arg, storyCards, state, cfg);
                if (res.ok) return { text: ".", stop: false };
                toast(state, res.msg, cfg);
                return { text: ".", stop: false };
            }
            if (parsed.cmd === "template") {
                return { text: handleTemplate(parsed.arg, storyCards, cfg), stop: false };
            }
            if (parsed.cmd === "config") {
                return { text: handleConfig(parsed.arg, storyCards), stop: false };
            }
        }
        return { text: text, stop: false };
    }

    function onContext(text, storyCards, state) {
        ensureDefaultTemplates(storyCards);
        var cfg = readConfig(storyCards);
        var p = getPending(state);
        if (p) {
            var mentions = cfg.knownFactsEnabled
                ? extractMentions(text, p.cardName, cfg.knownFactsLimit)
                : [];
            text = scrubContext(text);

            var lines = [];
            lines.push("");
            lines.push("");
            lines.push("==========================================================");
            lines.push("<<< STOP. NEW TASK. DISCARD THE STORY-FORM ABOVE. >>>");
            lines.push("==========================================================");
            lines.push("");
            lines.push("You are NOT writing prose this turn. Do not write story");
            lines.push("beats, action, or dialogue. Instead, you are filling in");
            lines.push("the fields of a story card.");
            lines.push("");

            if (mentions.length) {
                lines.push("The following facts about " + p.cardName + " are already");
                lines.push("established in the story above. Your fields MUST agree");
                lines.push("with every one of them:");
                lines.push("");
                mentions.forEach(function (m) { lines.push("  \u2022 " + m); });
                lines.push("");
                lines.push("If any of these contradict each other, prefer the most");
                lines.push("recent. Do NOT invent traits that conflict with the");
                lines.push("above. Do NOT repeat the story text verbatim \u2014 distill it");
                lines.push("into the card fields.");
                lines.push("");
            } else {
                lines.push(p.cardName + " has not yet appeared in the story in");
                lines.push("any significant way. Infer their details from the tone,");
                lines.push("genre, and setting established above. Stay consistent.");
                lines.push("");
            }

            lines.push("The card you are writing is for:");
            lines.push("  Type: " + p.displayType);
            if (p.needAIName) {
                lines.push("  Name: (unknown \u2014 choose one and put it in \"New name\" below)");
            } else {
                lines.push("  Name: " + p.cardName);
            }
            lines.push("");
            var totalFields = p.fields.length + (p.needAIName ? 1 : 0);
            lines.push("Write exactly these " + totalFields + " lines, in this order.");
            lines.push("No quotes, no markdown, no headings, no commentary.");
            lines.push("");
            if (p.needAIName) {
                lines.push("New name: <invent a name matching the story's tone, genre, and setting \u2014 2 to 4 words. Do NOT reuse \"" + p.cardName + "\">");
            }
            var forText = p.needAIName ? "for this new card" : ("for " + p.cardName);
            p.fields.forEach(function (f) {
                lines.push(f.label + ": <" + fieldHint(f.label, p.type, cfg) + " \u2014 " + forText + ">");
            });
            lines.push("");
            if (p.needAIName) {
                lines.push("Your reply must begin with the exact text \"New name:\"");
            } else {
                lines.push("Your reply must begin with the exact text \"" + p.fields[0].label + ":\"");
            }
            lines.push("and must end after the last field. Nothing else.");
            lines.push("==========================================================");
            return { text: text + "\n" + lines.join("\n"), stop: false };
        }

        var instr = "\n\n[STORY CARD FORGER]\n" +
            "The player can forge story cards with: !forge <type> [name]\n" +
            "Built-in types: " + POOLED_TYPES.join(", ") + "  (custom types use their TEMPLATE_<TYPE> card).\n" +
            "Templates live in story cards with keys TEMPLATE_<TYPE> and are user-editable.\n" +
            "When the player forges a card, treat it as authoritative world lore.\n";
        return { text: text + instr, stop: false };
    }

    function onOutput(text, storyCards, state) {
        var cfg = readConfig(storyCards);
        var p = getPending(state);
        if (!p) return { text: text, stop: false };

        var parsed = parseFields(text, p);

        /* ---- AI name extraction (bullet + markdown tolerant) ---- */
        var aiName = null;
        if (p.needAIName) {
            var _lines = String(text || "").split("\n");
            for (var _i = 0; _i < _lines.length; _i++) {
                var _nl = _lines[_i]
                    .replace(/^\s*[\s>*#\u2022\u25b8\-]+\s*/, "")
                    .replace(/\*\*/g, "")
                    .replace(/^["'\u201c\u201d\u2018\u2019]+/, "")
                    .replace(/["'\u201c\u201d\u2018\u2019]+\s*$/, "")
                    .replace(/\s+$/, "");
                var _m = _nl.match(/^(?:New\s+name|Full\s+name|Name)\s*:\s*(.+)$/i);
                if (!_m) continue;
                var _c = clean(_m[1])
                    .replace(/^["'\u201c\u201d\u2018\u2019]+/, "")
                    .replace(/["'\u201c\u201d\u2018\u2019]+\s*$/, "")
                    .replace(/\*\*/g, "")
                    .replace(/\s+$/, "");
                if (_c && _c.length < 80) { aiName = _c; break; }
            }
        }

        if (!p.values) p.values = {};
        Object.keys(parsed).forEach(function (k) { p.values[k] = parsed[k]; });

        var gotAll = p.fields.every(function (f) { return !!p.values[f.placeholder]; });
        if (p.needAIName && !aiName) gotAll = false;

        /* ---- Build the final entry, substituting name + values ---- */
        function buildBody(finalName, values) {
            return String(p.rawTemplate || "").replace(/\{\{([^}]+)\}\}/g, function (match, ph) {
                var key = normPh(ph);
                if (key === "name") return finalName;
                if (key === "type") return p.typeLabel || p.displayType;
                if (values[key]) return values[key];
                return match;
            });
        }
        function buildKey(finalName) {
            return String(p.keysTemplate || "{{name}}")
                .replace(/\{\{\s*name\s*\}\}/gi, finalName)
                .replace(/\{\{\s*type\s*\}\}/gi, p.typeLabel || p.displayType);
        }
        function uniqueKey(candidate) {
            if (!findCard(candidate, storyCards)) return candidate;
            for (var i = 2; i < 100; i++) {
                var c = candidate + " " + i;
                if (!findCard(c, storyCards)) return c;
            }
            return candidate + " " + Math.floor(Date.now() % 100000);
        }

        /* ---- Success ---- */
        if (gotAll) {
            var finalName = p.needAIName ? aiName : p.cardName;
            var finalKey = uniqueKey(buildKey(finalName));
            var finalBody = buildBody(finalName, p.values);

            try { addStoryCard(finalKey, finalBody, p.displayType); } catch (e) {}

            toast(state, "\u2728 Card forged: " + finalName + " (" + p.displayType + ")", cfg);
            clearPending(state);
            return { text: completionSentinel(cfg), stop: false };
        }

        /* ---- Retry or fallback ---- */
        p.attempts = (p.attempts || 0) + 1;
        var maxAttempts = Math.max(1, number(cfg.maxAttempts, 3));

        if (p.attempts >= maxAttempts) {
            /* Last-resort fallback: pool name if needed. */
            var fallbackName = p.needAIName ? generateName(p.type, storyCards) : p.cardName;
            var fbKey = uniqueKey(buildKey(fallbackName));
            var fbBody = buildBody(fallbackName, p.values || {});
            try { addStoryCard(fbKey, fbBody, p.displayType); } catch (e) {}

            if (p.needAIName) {
                toast(state, "\u26A0 Card forged with a fallback name: " + fallbackName + " \u2014 edit in STORY CARDS panel.", cfg);
            } else {
                toast(state, "\u26A0 Card partially filled: " + fallbackName + " \u2014 edit in STORY CARDS panel.", cfg);
            }
            clearPending(state);
            return { text: failureSentinel(cfg), stop: false };
        }

        setPending(state, p);

        var withBanner = false;
        if (cfg.announceHelpOnFirstUse !== false && !helpBannerConsumed(state)) {
            withBanner = true;
            markHelpBannerConsumed(state);
        }
        return { text: forgingSentinel(cfg, withBanner), stop: false };
    }

    return {
        VERSION: VERSION,
        DEFAULT_TEMPLATES: DEFAULT_TEMPLATES,
        NAME_POOLS: NAME_POOLS,
        CONFIG_KEY: CONFIG_KEY,
        onInput: onInput,
        onContext: onContext,
        onOutput: onOutput,
        createFromTemplate: createFromTemplate,
        generateName: generateName,
        readConfig: readConfig,
        helpText: helpText,
        listTemplates: listTemplates,
        showTemplate: showTemplate,
        generateTemplate: generateTemplate,
        resetTemplate: resetTemplate,
        ensureDefaultTemplates: ensureDefaultTemplates,
        findCard: findCard,
        keyArray: keyArray,
        cardEntry: cardEntry,
        extractMentions: extractMentions,
        extractPlaceholders: extractPlaceholders
    };

})();
