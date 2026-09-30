# Ticker FX

A responsive, market-inspired currency terminal hosted on GitHub Pages. Built with plain HTML, CSS, and JavaScript; no build step or API keys.

## Features
- Currency conversion, currency swapping, and automatic refresh every five minutes while visible.
- Daily historical exchange-rate charts over one week, one month, three months, or one year.
- Major currency board with changes against the previous available reference-rate day.
- Accessible controls, mobile layouts, loading states, and connection error handling.

Data comes from [Frankfurter](https://frankfurter.dev/). These are daily reference rates, not tick-by-tick trading quotes. Each currency's source date is displayed. The public API must be available for conversion to work.

## Run locally
Serve this folder with any static HTTP server, for example `npx serve .`. Open the URL it prints.

## Deployment
GitHub Pages serves the root of the `main` branch. All assets use relative paths so the site works under a repository URL.
