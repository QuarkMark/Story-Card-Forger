# Story-Card-Forger
AI Dungeon script for instant, AI-filled story cards. !forge &lt;type> [name] creates a card for anyone or anything — characters, locations, items, factions, or custom types. Story-aware, template-editable, config card included.

# 🔨 Story Card Forger

**Forge AI-written story cards mid-scene with a single command.**

Type `!forge character Alice` and the card writes itself — honouring everything the story has already established about her. Works for characters, locations, items, factions, or anything else you invent. Silent, seamless, zero setup.

Built for [AI Dungeon](https://aidungeon.com/) scenarios.

---

## ✨ Features

- 🎴 **Instant story cards** for anyone or anything
- 🤖 **AI fills the fields** — one short sentence per field
- 🧠 **Story-aware** — honours established facts about the entity
- 🎲 **Random names** when you skip the name
- 🤫 **Silent two-turn flow** — no clutter in the story log
- ⚙️ **Fully editable templates** — redesign card shapes mid-game
- 📝 **Onboard config card** — retries, hints, toasts, and more
- 🧩 **Custom types** — add a `TEMPLATE_DRAGON` card, and `!forge dragon` just works
- 🔗 **Composite placeholders** — `{{name}} the {{jobtitle}}` → *"Alice the Baker"*

---

## 📦 Installation

1. Open your AI Dungeon scenario → **Scripts**.
2. Paste each file into its matching tab:

   | File | Tab |
   |---|---|
   | `library.js` | **Library** |
   | `input.js` | **Input** |
   | `context.js` | **Context** |
   | `output.js` | **Output** |

3. Save and start a new game.

That's it. The first time you run a `!forge` command, the built-in templates and config card are created automatically.

---

## 🕹️ Commands

| Command | What it does |
|---|---|
| `!forge <type> [name]` | Forge a new story card |
| `!template` | List all templates |
| `!template <type>` | View or create a template |
| `!template <type> reset` | Restore the built-in default |
| `!config` | Show current settings |
| `!config reset` | Reset settings to defaults |
| `!help` | Full command reference |

**Aliases:**
`!create` · `!make` · `!new` for `!forge`
`!templates` for `!template`
`!settings` for `!config`
`!commands` for `!help`

---

## 📚 Card types

| Type | Fields |
|---|---|
| 🧑 `character` | Full name · Age · Gender · Description |
| 🏔️ `location` | Name · Type · Description · Atmosphere · Notable Features |
| ⚔️ `item` | Name · Type · Description · Properties · Origin |
| 🛡️ `faction` | Name · Type · Description · Goals · Notable Members |
| 🎲 *anything else* | Falls back to `TEMPLATE_GENERIC` |

---


