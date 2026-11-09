#!/usr/bin/env node
// 네이티브 android/ 폴더 생성: `npm run android:prebuild` (처음부터 다시: `npm run android:prebuild:clean`)
// app.config.ts·config plugin·.env.local(PLEOS_CLIENT_*)을 바꾼 뒤에는 --clean 으로 다시 만든다.

import { parseArgs } from "node:util";

import { expo } from "./lib.mjs";

const { values } = parseArgs({ options: { clean: { type: "boolean", default: false } } });

expo(["prebuild", "--platform", "android", "--no-install", ...(values.clean ? ["--clean"] : [])]);
