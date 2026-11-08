# Damned If I Know

The handwritten cookbook & journal of Sudie Lea O'Connor, begun May 5, 1962.

A static site with no build step:

- `index.html`: page markup
- `styles.css`: recipe-box styling
- `app.js`: search, filters and views
- `data/recipes.json`: every recipe, journal entry and page note. Edit this file to change content.

## Run locally

    python3 -m http.server 8765

Then open http://localhost:8765. You can't open `index.html` directly, because the browser blocks loading the JSON from a `file://` URL.

## Deploy

Netlify deploys from `main` on every push (see `netlify.toml`).
