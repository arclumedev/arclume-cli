import fs from "fs/promises";
import path from "path";

export interface DetectedStack {
  languages: string[];
  frameworks: string[];
  entryPoints: string[];
}

export async function detectLanguages(): Promise<string[]> {
  const root = process.cwd();
  const languages: string[] = [];

  const checks: Array<{ files: string[]; lang: string }> = [
    { files: ["package.json", "tsconfig.json"], lang: "typescript" },
    { files: ["pyproject.toml", "setup.py", "setup.cfg"], lang: "python" },
    { files: ["go.mod"], lang: "go" },
    { files: ["Cargo.toml"], lang: "rust" },
  ];

  for (const check of checks) {
    for (const file of check.files) {
      try {
        await fs.access(path.join(root, file));
        if (!languages.includes(check.lang)) {
          languages.push(check.lang);
        }
        break;
      } catch {
        // file not found, continue
      }
    }
  }

  return languages;
}

export async function detectFrameworks(): Promise<string[]> {
  const root = process.cwd();
  const frameworks: string[] = [];

  try {
    const pkgRaw = await fs.readFile(path.join(root, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    const frameworkMap: Record<string, string> = {
      next: "next.js",
      react: "react",
      express: "express",
      fastify: "fastify",
      "hono": "hono",
      "koa": "koa",
      "nestjs/core": "nestjs",
      "@nestjs/core": "nestjs",
      vue: "vue",
      nuxt: "nuxt",
      svelte: "svelte",
      "@sveltejs/kit": "sveltekit",
      remix: "remix",
      "@remix-run/node": "remix",
      astro: "astro",
    };

    for (const [dep, frameworkName] of Object.entries(frameworkMap)) {
      if (dep in allDeps && !frameworks.includes(frameworkName)) {
        frameworks.push(frameworkName);
      }
    }
  } catch {
    // no package.json or parse error
  }

  return frameworks;
}

export function inferEntryPoints(languages: string[]): string[] {
  const entryPoints: string[] = [];

  for (const lang of languages) {
    switch (lang) {
      case "typescript":
        entryPoints.push("src/index.ts", "src/main.ts");
        break;
      case "python":
        entryPoints.push("main.py", "app.py");
        break;
      case "go":
        entryPoints.push("cmd/", "main.go");
        break;
      case "rust":
        entryPoints.push("src/main.rs");
        break;
    }
  }

  return entryPoints;
}

export async function detectStack(): Promise<DetectedStack> {
  const languages = await detectLanguages();
  const frameworks = await detectFrameworks();
  const entryPoints = inferEntryPoints(languages);

  return { languages, frameworks, entryPoints };
}
