# React + Vite

## Demo op de laptop

De zware PC draait Ollama (`margit:latest`) en `npm run serve`. Die print het adres. Op de laptop, zelfde netwerk, geen Ollama:

```
npm run demo -- 192.168.1.42
```

Open http://127.0.0.1:5173 en tik op Begin. Het beeld is 2D. Nederlands blijft de spraak van de browser. Poort 3001 moet op de PC open zijn.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
