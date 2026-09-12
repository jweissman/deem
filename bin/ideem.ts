#!/usr/bin/env bun

// with readline (history, editing)
// import readline from 'readline';
// import Deem from '../src/deem';

// import { Template } from '../src/orsino/Template';
// import Generator from '../src/orsino/Generator';
// import { loadSetting } from "../src/orsino/loader";

// let settingName = "fantasy";
// Generator.setting = settingName ? loadSetting(settingName) : Generator.defaultSetting;
// await Template.bootstrapDeem({});

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
//   prompt: '> ',
// });

// rl.prompt();

// rl.on('line', (line) => {
//   try {
//     const result = Deem.evaluate(line);
//     console.log(result);
//   } catch (err) {
//     console.error('Error:', err);
//   }
//   rl.prompt();
// }).on('close', () => {
//   console.log('Exiting Deem console.');
//   process.exit(0);
// });