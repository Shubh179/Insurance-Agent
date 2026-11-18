# Agent Insure frontend

## Agent Insure public demo

Open [the sample inbox](https://insurance-agent-frontend-kappa.vercel.app/demo) from **Continue without login** on the homepage or **Try with sample data** on the branding page. Open a fictional email, choose a coverage question, and follow the cited clause back to its source. The demo runs a browser-only, rule-based version of the classification, retrieval, and coverage-check workflow. The signed-in app uses Gmail and server-side AI analysis.

Run the evaluation from the frontend directory:

```sh
node --test tests/demo-coverage.test.js
```

The fixed synthetic cases measure exact source selection and whether the demo gives or withholds a definitive answer. They include clear coverage and exclusions, a missing endorsement, conflicting documents, irrelevant mail, an empty inbox, and instructions embedded in email.

| Check | Result |
| --- | --- |
| Expected coverage outcome | 8/8 cases |
| Exact source selection | 8/8 cases |
| Withheld a definitive answer when evidence was missing or conflicting | 5/5 cases |
| Named the missing endorsement | 1/1 targeted check |

These results describe the local demo rules on synthetic fixtures. The production model and live Gmail integration require a separate evaluation.

## React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
