import { analyze, bootstrap, grossReturns } from "../../lib/warrants.mjs";
self.onmessage = ({ data }) => {
  try {
    const { dataset, options, product, type } = data;
    if (type === "screen") {
      const cache = new Map();
      const rows = dataset.products.map((p: { underlying: string }) => {
        const result = analyze(p, dataset.assets[p.underlying], {
          ...options,
          cache,
        });
        if ("long" in result) {
          if (result.long) result.long.net = [];
          if (result.short) result.short.net = [];
        }
        return { product: p, result };
      });
      self.postMessage({ type, rows });
    } else {
      const history = dataset.assets[product.underlying];
      const result = analyze(product, history, options);
      const interval =
        "horizon" in result && history
          ? bootstrap(
              product,
              result.spot,
              grossReturns(history.closes, result.horizon, 1254, false),
              options.budget,
              options.fx,
              {
                repetitions: 2000,
                block: result.horizon,
                neutral: options.neutral,
              },
            )
          : null;
      self.postMessage({ type, result, interval });
    }
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Calcul indisponible",
    });
  }
};
