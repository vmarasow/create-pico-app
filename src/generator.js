import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import * as templates from "./templates.js";

export async function generateProject(options) {
  const { name, board, localSdk } = options;
  const projectPath = path.join(process.cwd(), name);

  try {
    // 1. Create Directory Structure
    await fs.mkdir(projectPath);
    await fs.mkdir(path.join(projectPath, "src"));
    await fs.mkdir(path.join(projectPath, "build"));
    await fs.mkdir(path.join(projectPath, ".vscode"));

    // NEW: Create scripts folder
    await fs.mkdir(path.join(projectPath, "scripts"));

    // 2. Write Standard Files
    console.log(chalk.blue("ℹ Writing configuration files..."));

    await fs.writeFile(
      path.join(projectPath, "CMakeLists.txt"),
      templates.getCmakeLists(name, board)
    );

    await fs.writeFile(
      path.join(projectPath, "src/main.cpp"),
      templates.getMainCpp(board)
    );

    await fs.writeFile(
      path.join(projectPath, "pico_sdk_import.cmake"),
      templates.getSdkImport()
    );

    await fs.writeFile(
      path.join(projectPath, ".vscode/c_cpp_properties.json"),
      templates.getVsCodeProperties(localSdk)
    );

    // NEW: Write Package.json and Scripts
    console.log(chalk.blue("ℹ Adding Node.js build scripts..."));

    await fs.writeFile(
      path.join(projectPath, "package.json"),
      templates.getPackageJson(name, board)
    );

    await fs.writeFile(
      path.join(projectPath, "scripts/flash.js"),
      templates.getFlashScript(name)
    );

    await fs.writeFile(
      path.join(projectPath, "scripts/clean.js"),
      templates.getCleanScript()
    );

    // 3. Handle Local SDK (Git Submodule)
    if (localSdk) {
      console.log(
        chalk.yellow(
          "ℹ Initializing Git and downloading Pico SDK (this may take a moment)..."
        )
      );

      // We use execSync here to keep the CLI simple (blocking is fine for this step)
      execSync("git init", { cwd: projectPath, stdio: "ignore" });

      // Add the submodule
      execSync(
        "git submodule add https://github.com/raspberrypi/pico-sdk.git",
        { cwd: projectPath, stdio: "inherit" }
      );

      // Initialize submodules of the SDK (tinyusb etc)
      console.log(chalk.yellow("ℹ Updating SDK submodules..."));
      execSync("git submodule update --init", {
        cwd: path.join(projectPath, "pico-sdk"),
        stdio: "inherit",
      });
    }

    console.log(chalk.green(`\n✔ Project "${name}" created successfully!`));
  } catch (err) {
    if (err.code === "EEXIST") {
      console.error(chalk.red(`Error: Directory "${name}" already exists.`));
    } else {
      console.error(chalk.red("Unexpected error:"), err);
    }
    process.exit(1);
  }
}
