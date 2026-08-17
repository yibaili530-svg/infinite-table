# Infinite Table / 无限牌桌

A clean, browser-based Texas Hold'em table for one human player and five computer opponents.

在线试玩：[无限牌桌](https://xinliu-poker.yibaili530.chatgpt.site)

## Features

- Six-player Texas Hold'em with randomized dealing and full betting streets
- Five computer opponents with distinct, hidden playing styles
- Ten difficulty levels that change decision quality and randomness
- In-game text chat, quick replies, and emoji
- Chinese and English interface
- Responsive white / light-gray UI with neon-green accents

## Local development

Requirements: Node.js 22.13 or newer and a Linux environment with `flock`, `curl`, and GNU `timeout`.

```bash
npm ci
npm run dev
```

Useful commands:

```bash
npm run lint
npm test
npm run build
```

The main game implementation lives in `app/page.tsx`; global styling is in `app/globals.css`.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md), open an issue for larger changes, and submit improvements through a pull request.

## License

[MIT](LICENSE)
