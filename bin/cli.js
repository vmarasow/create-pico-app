#!/usr/bin/env node
console.log("--- DEBUG: I am running the new code! ---"); // <--- Add this line
import { Command } from "commander";
import inquirer from "inquirer";
import { generateProject } from "../src/generator.js";

const program = new Command();

program
  .name("create-pico-app")
  .description("Scaffold a robust Raspberry Pi Pico C++ project")
  .argument("[name]", "The name of the project")
  .action(async (cliName) => {
    // 1. dynamic questions based on whether name was provided
    const questions = [];

    // Only ask for name if the user didn't type it in the command line
    if (!cliName) {
      questions.push({
        type: "input",
        name: "name",
        message: "What is your project name?",
        default: "my-pico-project",
        validate: (input) =>
          /^[a-z0-9-_]+$/i.test(input)
            ? true
            : "Use only letters, numbers, dashes, or underscores",
      });
    }

    questions.push({
      type: "list",
      name: "board",
      message: "Which board are you using?",
      choices: [
        {
          name: "Raspberry Pi Pico   (Standard - LED on GP25)",
          value: "pico",
        },
        {
          name: "Raspberry Pi Pico W (Wireless - LED on WiFi chip)",
          value: "pico_w",
        },
      ],
      default: "pico",
    });

    questions.push({
      type: "confirm",
      name: "localSdk",
      message:
        "Do you want to download a local copy of the SDK? (Recommended for portability)",
      default: false,
    });

    const answers = await inquirer.prompt(questions);

    // 2. Merge the CLI argument with the answers
    const finalOptions = {
      ...answers,
      name: cliName || answers.name,
    };

    // 3. Trigger Generation
    await generateProject(answers);
  });

program.parse(process.argv);
