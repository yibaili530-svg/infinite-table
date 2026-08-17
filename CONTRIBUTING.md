# Contributing to Infinite Table

Thanks for helping improve Infinite Table.

## Ways to contribute

- Report gameplay, accessibility, or responsive-layout bugs through GitHub Issues.
- Suggest improvements to the computer-player strategy or interface.
- Fix an issue and submit a pull request.
- Improve documentation or translations.

## Development workflow

1. Fork the repository and create a focused branch from `main`.
2. Install dependencies with `npm ci`.
3. Make one coherent change and keep unrelated formatting out of the diff.
4. Run `npm run lint` and `npm test`.
5. Open a pull request that explains what changed, why, and how it was tested.

For a large feature or game-rule change, please open an issue before implementation so the approach can be discussed.

## Pull request checklist

- The game can complete a full hand without getting stuck.
- Desktop and narrow-screen layouts remain usable.
- Both Chinese and English interface text are considered.
- No secrets, credentials, generated build output, or dependency folders are committed.
- Relevant checks pass locally.

By contributing, you agree that your contribution will be licensed under the MIT License used by this project.
