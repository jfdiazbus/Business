// The stylesheet is one hand-written file, ordered by section (tokens, bar,
// layout, cards, footer) rather than by selector specificity.
// `no-descending-specificity` reads that deliberate order as a mistake, so it
// is off here; everything else from the recommended set stays on.

export default {
  extends: ["stylelint-config-recommended"],
  rules: {
    "no-descending-specificity": null,
  },
};
