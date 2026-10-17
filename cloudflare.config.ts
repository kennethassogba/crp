import { bindings, defineConfig, triggers } from "cf/config";
export default defineConfig({
  accountId: "05838fc24a89cefaf6081066cca13544",
  worker: {
    name: "crp-keff",
    entrypoint: "./worker/index.js",
    compatibilityDate: "2026-10-17",
    assets: {
      runWorkerFirst: true,
      htmlHandling: "none",
      notFoundHandling: "none",
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({
        id: "b2ebf887-2ed3-45d7-9141-7080ca687bf1",
        name: "crp-db",
      }),
      OPENAI_API_KEY: bindings.secret(),
    },
    domains: ["crp.keff.uk"],
    triggers: [triggers.scheduled({ schedule: "*/15 * * * *" })],
    workersDev: true,
    observability: {
      enabled: true,
      redactQueryString: true,
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
  },
});
