# sanjeevani

A live isometric digital twin of a hospital, built for Haunted Hacks: Real-Time AI Edition. The demo hospital is called Haven General.

All hospital data is simulated in the browser. Terse Durable Actors and Agent Relay are not connected yet.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5199. There is no bundler in dev: the app is plain ES modules, served by `tools/serve.mjs`.

To build one self-contained file that opens by double-click and works offline:

```bash
npm run build
```

That writes `dist/haven-general.html`.

## Where things live

| Path | What |
|---|---|
| `src/sim` | The twin: patients, staff, flows, scenarios, agent feed. Everything else reads from this. |
| `src/engine` | Renderer, camera, light, picking |
| `src/world` | Floor plan, building shell, room furnishing |
| `src/props` | 3D hospital equipment and furniture |
| `src/people` | People and vehicles |
| `src/ui` | Interface and guided tour |
| `docs/CONTRACT.md` | How the modules fit together |
| `tools` | Screenshot, frame-rate and tour test scripts, plus the build |

URL parameters for testing: `?skipIntro=1&floor=ground|level1|stack&hours=21.5&speed=8&scenario=flu&focus=icu&warm=120&quality=high`.
