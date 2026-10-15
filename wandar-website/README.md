# Wandar website: Claude Code handover

This is the complete website source, including the latest seven section icons, the six-section homepage and all four product pages.

## Start here
1. Extract this ZIP.
2. Open the extracted wandar-website folder in Claude Code.
3. Give Claude the instruction in START-HERE.md.

## Structure
- dist/index.html: six-section homepage
- dist/social-demand/index.html
- dist/sales-agent/index.html
- dist/sales-workspace/index.html
- dist/safari-ai/index.html
- dist/style.css: shared styles, responsive layout and icons
- dist/script.js: navigation and Build with us dialog
- dist/assets/: original Wandar logos and images
- build-pages.py and icons.json: page generator and reusable SVG icons

## Run locally
This is a static HTML/CSS/JavaScript website. There is no npm installation or framework build step.

With Python installed, run from this folder:

    python -m http.server 8000 --directory dist

Open http://localhost:8000/. On Windows, use py instead of python if needed. Serve dist as the web root; opening the HTML directly with file:// will not resolve root-relative asset paths correctly.

To regenerate HTML after editing the content generator:

    python build-pages.py

Keep the generator and rendered HTML synchronized. CSS and JavaScript are edited directly in dist.

## Existing integrations
The Build with us form submits to https://www.getwandar.com/ using the existing early-access form endpoint. A real submission has not been tested from this copy. Verify the intended form destination before publishing; do not submit test enquiries to the real endpoint without the owner's permission.

Google Fonts loads Plus Jakarta Sans. Existing social-sharing metadata references Wandar's current og-card.jpg.

ChatGPT-specific hosting identity and Git credentials are intentionally excluded. This export can be hosted as static files on the user's chosen host. The supplied public-facing assets and copy are the baseline to preserve.
