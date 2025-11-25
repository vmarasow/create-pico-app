import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import * as templates from "./templates.js";

export async function generateProject(options) {
  const { name, board, localSdk, template } = options;
  const projectPath = path.join(process.cwd(), name);

  try {
    // 1. Create Directory Structure
    await fs.mkdir(projectPath);
    await fs.mkdir(path.join(projectPath, "src"));
    await fs.mkdir(path.join(projectPath, "build"));
    await fs.mkdir(path.join(projectPath, ".vscode"));

    // NEW: Create scripts folder
    await fs.mkdir(path.join(projectPath, "scripts"));

    // NEW: Create GitHub Actions folders
    // recursive: true allows making .github AND .github/workflows in one go
    await fs.mkdir(path.join(projectPath, ".github/workflows"), {
      recursive: true,
    });

    // 2. Write Standard Files
    console.log(chalk.blue("ℹ Writing configuration files..."));

    await fs.writeFile(
      path.join(projectPath, "CMakeLists.txt"),
      templates.getCmakeLists(name, board, template)
    );

    await fs.writeFile(
      path.join(projectPath, "src/main.cpp"),
      templates.getMainCpp(board, template)
    );

    await fs.writeFile(
      path.join(projectPath, "pico_sdk_import.cmake"),
      templates.getSdkImport()
    );

    await fs.writeFile(
      path.join(projectPath, ".vscode/c_cpp_properties.json"),
      templates.getVsCodeProperties(localSdk)
    );

    // NEW: Write the Workflow file
    console.log(chalk.blue("ℹ Generating GitHub Actions workflow..."));
    await fs.writeFile(
      path.join(projectPath, ".github/workflows/build.yml"),
      templates.getGithubAction(options.board)
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

    // 3. Write FreeRTOS Config
    if (template === "freertos") {
      await fs.writeFile(
        path.join(projectPath, "src/FreeRTOSConfig.h"),
        templates.getFreeRTOSConfig()
      );
    }

    // 4. Handle Local SDK (Git Submodule)
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

      if (template === "freertos") {
        console.log(chalk.yellow("ℹ Checking FreeRTOS Submodule..."));
        const sdkPath = path.join(projectPath, "pico-sdk");

        try {
          // 1. Try standard update (Best case)
          execSync("git submodule update --init lib/FreeRTOS-Kernel", {
            cwd: sdkPath,
            stdio: "ignore",
          });
        } catch (e) {
          // 2. Force Add (The fix for your error)
          console.log(
            chalk.yellow("⚠ Submodule missing. Injecting FreeRTOS Kernel...")
          );
          try {
            execSync(
              "git submodule add https://github.com/raspberrypi/FreeRTOS-Kernel.git lib/FreeRTOS-Kernel",
              { cwd: sdkPath, stdio: "inherit" }
            );
          } catch (addError) {
            // 3. Fallback: If 'add' fails (e.g., folder exists but empty), force a raw clone
            // This happens if a previous run failed halfway through.
            console.log(
              chalk.yellow("⚠ Git add failed. Falling back to raw clone...")
            );
            execSync(
              "git clone https://github.com/raspberrypi/FreeRTOS-Kernel.git lib/FreeRTOS-Kernel",
              { cwd: sdkPath, stdio: "inherit" }
            );
          }
        }
      }
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
