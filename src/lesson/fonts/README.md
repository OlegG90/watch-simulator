# Interface fonts

Local copies, so the app does not depend on the network: offline (and when served
over a local network with `npm run serve`) the typography stays the one the design
was made for.

| Family | Weights | Where it is used |
|---|---|---|
| **Literata** | 400, 600 | card prose, headings |
| **IBM Plex Sans** | 400, 500, 600 | interface |
| **IBM Plex Mono** | 400, 500, 600 | numbers, formulas, technical captions |

Only the **latin** and **cyrillic** subsets are kept; `unicode-range` is preserved,
so the browser downloads a subset only when it is really needed.

The files and `../fonts.css` are generated from `fonts.googleapis.com` — do not edit
them by hand, regenerate instead.

## Licence

Both families are **SIL Open Font License 1.1** (text in [OFL.txt](OFL.txt)).

- Literata © 2017 Type Network, Google
- IBM Plex © 2017 IBM Corp.
