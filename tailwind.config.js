module.exports = {
  content: ["**/*.{html,js}"],

  theme: {
    extend: {},
  },
  variants: {
    backgroundColor: ["active", "even", "odd"],
  },
  plugins: [require("tailwindcss"), require("@tailwindcss/typography")],
};
