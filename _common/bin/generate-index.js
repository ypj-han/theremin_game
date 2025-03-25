#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, "package.json");

const projectName = fs.existsSync(packageJsonPath)
  ? JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).name ||
    "p5.js Sketches"
  : "p5.js Sketches";

const sketchesDir = path.join(projectRoot, "src");
const sketches = fs.existsSync(sketchesDir)
  ? fs
      .readdirSync(sketchesDir)
      .filter((file) =>
        fs.statSync(path.join(sketchesDir, file)).isDirectory()
      )
  : [];

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
</head>
<body>
    <h1>${projectName}</h1>
    <ul>
        ${sketches
          .map(
            (sketch) =>
              `<li><a href="src/${sketch}/index.html">${sketch}</a></li>`
          )
          .join("\n")}
    </ul>
</body>
</html>
`;

fs.writeFileSync(path.join(projectRoot, "index.html"), htmlContent);
console.log("✅ Sketch index generated successfully!");
