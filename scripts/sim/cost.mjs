// $ per million tokens (input, output, cache read, cache write) + web search per request.
const PRICE = {
  "claude-opus-5-5": [4, 20, 0.2, 5],
  "claude-sonnet-5": [2, 10, 0.1, 2.5],
  "claude-haiku-4-5": [1, 5, 0.1, 1.25],
};
const meter = { total: 0, byPart: {} };
export const BUDGET = Number(process.env.SIM_BUDGET || 2);

export function charge(part, model, u) {
  const [i, o, cr, cw] = PRICE[model] ?? PRICE["claude-opus-5-5"];
  const input = u.input ?? u.input_tokens ?? 0;
  const output = u.output ?? u.output_tokens ?? 0;
  const read = u.cacheRead ?? u.cache_read_input_tokens ?? 0;
  const write = u.cacheWrite ?? u.cache_creation_input_tokens ?? 0;
  const searches = u.searches ?? u.server_tool_use?.web_search_requests ?? 0;
  const usd = (input * i + output * o + read * cr + write * cw) / 1e6 + searches * 0.01;
  meter.total += usd;
  meter.byPart[part] = (meter.byPart[part] ?? 0) + usd;
  return usd;
}

export function overBudget() {
  return meter.total >= BUDGET;
}

export function report() {
  const parts = Object.entries(meter.byPart).map(([k, v]) => `${k} $${v.toFixed(2)}`).join(" · ");
  return `spent $${meter.total.toFixed(2)} of $${BUDGET.toFixed(2)} budget (${parts})`;
}
