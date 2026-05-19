# Othello Opening Trainer

Vite + TypeScript SPA for practicing named Othello openings from a curated JSON opening book.

## Features

- Choose black or white side.
- Practice a selected opening line, failing when you leave that line.
- Use free mode, where the computer follows a random continuation from the current opening-book node.
- See reached opening names when a free-mode branch hits a known terminal.
- Installable PWA with a small offline cache.

## Development

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

## Data

The app uses `src/data/othello_openings.json`, generated from public opening references and preserving source IDs per entry. Coordinate orientation is source-preserving; normalize rotations/reflections in code if you want symmetry-equivalent lookup.
