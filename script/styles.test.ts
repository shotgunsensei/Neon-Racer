import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { compile } from "@tailwindcss/node";
import postcss from "postcss";
import { cn } from "../client/src/lib/utils";

const require = createRequire(import.meta.url);
const stylesheet = fileURLToPath(new URL("../client/src/index.css", import.meta.url));
const candidates = ["text-primary", "bg-primary/20", "rounded-sm", "rounded-md", "rounded-lg",
  "backdrop-blur-sm", "shadow-sm", "outline-hidden", "hover:box-glow-primary", "prose",
  "prose-headings:text-primary", "max-h-[var(--radix-select-content-available-height)]",
  "origin-[var(--radix-tooltip-content-transform-origin)]", "bg-linear-to-r/srgb", "from-primary", "to-secondary",
  "border-rose-500", "text-violet-300", "text-violet-200", "border-purple-400", "bg-purple-600/20"];

const compiled = (async () => {
  const compiler = await compile(await readFile(stylesheet, "utf8"), {
    base: dirname(stylesheet), onDependency() {},
  });
  return postcss.parse(compiler.build(candidates));
})();

test("migrated CSS preserves custom tokens, radii, blur, shadow and restart hover glow", async () => {
  const root = await compiled;
  const variables: Record<string, string> = {};
  root.walkDecls(decl => { if (decl.prop.startsWith("--")) variables[decl.prop] = decl.value; });
  const resolve = (value: string) => value.replace(/var\((--[\w-]+)\)/g, (match, key) => variables[key] ?? match);
  const declarations = (selector: string) => {
    const values: Record<string, string> = {};
    root.walkRules(rule => { if (rule.selector === selector) {
      rule.walkDecls(decl => { values[decl.prop] = decl.value; });
    } });
    return values;
  };
  assert.equal(variables["--primary"], "174 93% 54%");
  for (const [token, value] of Object.entries({ "--color-rose-500": "#f43f5e", "--color-violet-300": "#c4b5fd",
    "--color-violet-200": "#ddd6fe", "--color-purple-400": "#c084fc", "--color-purple-600": "#9333ea" })) {
    assert.equal(variables[token], value);
  }
  assert.ok(resolve(declarations(".text-primary").color).includes("174 93% 54%"));
  for (const [name, radius] of [["sm", 0.1875], ["md", 0.375], ["lg", 0.5625]] as const) {
    assert.equal(parseFloat(resolve(declarations(`.rounded-${name}`)["border-radius"])), radius);
  }
  assert.ok(resolve(declarations(".backdrop-blur-sm")["--tw-backdrop-blur"]).includes("4px"));
  assert.match(resolve(declarations(".shadow-sm")["--tw-shadow"]), /1px 2px/);
  assert.ok(declarations(".hover\\:box-glow-primary:hover")["box-shadow"].includes("14px 40px"));
  assert.ok(declarations(".outline-hidden").outline?.includes("transparent") || root.toString().includes("forced-colors"));
});

test("migrated CSS compiles valid variable utilities, typography and sRGB gradient interpolation", async () => {
  const root = await compiled;
  const values: string[] = [];
  root.walkDecls(decl => values.push(`${decl.prop}: ${decl.value}`));
  assert.ok(values.includes("max-height: var(--radix-select-content-available-height)"));
  assert.ok(values.includes("transform-origin: var(--radix-tooltip-content-transform-origin)"));
  assert.ok(values.some(value => value.includes("to right in srgb")));
  let headingRule = false;
  root.walkRules(rule => { if (rule.selector.includes(":where(h1)")) headingRule = true; });
  assert.ok(headingRule, "typography still emits heading styles through its patched parser");
  assert.ok(!values.some(value => /^(max-height|transform-origin|background-color|border-color): --/.test(value)));
});

test("patched typography selector parser preserves pseudo relocation and ordinary/escaped selectors", () => {
  const entry = require.resolve("@tailwindcss/typography");
  const typographyRequire = createRequire(entry);
  const { version } = typographyRequire("postcss-selector-parser/package.json");
  const [major, minor, patch] = version.split(".").map(Number);
  assert.ok(major === 7 && (minor > 1 || (minor === 1 && patch >= 6)));
  const { commonTrailingPseudos } = require(join(dirname(entry), "utils.js"));
  const [pseudo, selectors] = commonTrailingPseudos(".a::before, .b::before");
  assert.equal(pseudo, "::before");
  assert.equal(selectors.replaceAll(" ", ""), ".a,.b");
  for (const selector of [".a::before, .b::after", "article a:hover", ".scope :where(h2, h3)"]) {
    assert.deepEqual(commonTrailingPseudos(selector), [null, selector]);
  }
  assert.deepEqual(commonTrailingPseudos(".a\\:focus::marker"), ["::marker", ".a\\:focus"]);
  const parser = typographyRequire("postcss-selector-parser")();
  const nested = (depth: number) => ":is(".repeat(depth) + ".a" + ")".repeat(depth);
  assert.doesNotThrow(() => parser.astSync(nested(256)));
  assert.throws(() => parser.astSync(nested(257)), /maximum.*256|depth.*256/i);
});

test("class merging supports the migrated focus and variable utilities with caller overrides", () => {
  assert.equal(cn("outline-hidden", "outline-none"), "outline-none");
  assert.equal(cn("max-h-[var(--radix-select-content-available-height)]", "max-h-64"), "max-h-64");
  assert.equal(cn("border-primary/50", "border-secondary"), "border-secondary");
  assert.equal(cn("rounded-sm", { "rounded-lg": true }), "rounded-lg");
  assert.equal(cn("bg-primary/20", ["bg-card/60"]), "bg-card/60");
});
